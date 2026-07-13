import { db } from '../../config/database.js';

/**
 * PBI-20 & PBI-21 & PBI-23: Endpoint transaccional para inscripciones masivas.
 * POST /api/registros
 * Payload esperado:
 * {
 *   "asi_id": 1,          // O "reg_asi_id"
 *   "eventos": [1, 2, 3]  // Arreglo de IDs de eventos
 * }
 */
export async function crearInscripcionTransaccional(req, res) {
  try {
    const asiId = req.body.asi_id || req.body.reg_asi_id;
    let eventosIds = req.body.eventos;

    if (!eventosIds && req.body.asistencias && Array.isArray(req.body.asistencias)) {
      eventosIds = req.body.asistencias.map((a) => (typeof a === 'object' ? a.ase_eve_id || a.eve_id : a));
    }

    if (!asiId) {
      return res.status(400).json({ mensaje: 'El ID del asistente (asi_id) es obligatorio.' });
    }

    if (!eventosIds || !Array.isArray(eventosIds) || eventosIds.length === 0) {
      return res.status(400).json({ mensaje: 'Debe proporcionar una lista de eventos (eventos: [id1, id2, ...]).' });
    }

    // Transacción atómica usando pg-promise (t.tx)
    const resultado = await db.tx(async (t) => {
      // 1. Validar existencia del asistente
      const asistente = await t.oneOrNone(
        'SELECT asi_id, asi_nombre, asi_identificacion FROM asistentes WHERE asi_id = $1',
        [asiId]
      );

      if (!asistente) {
        const err = new Error('Asistente no encontrado');
        err.status = 404;
        throw err;
      }

      const erroresItems = [];
      const eventosValidados = [];

      // 2. Validaciones de negocio por evento (PBI-23)
      for (const eveId of eventosIds) {
        const evento = await t.oneOrNone(
          'SELECT eve_id, eve_nombre, eve_capacidad, eve_fecha_inicio, eve_estado FROM eventos WHERE eve_id = $1',
          [eveId]
        );

        // Validar existencia del evento
        if (!evento) {
          erroresItems.push({ eve_id: eveId, error: 'El evento especificado no existe.' });
          continue;
        }

        // Validar si el evento está activo (o fecha inicio no pasada)
        const fechaEvento = new Date(evento.eve_fecha_inicio);
        const hoy = new Date();
        const estaInactivo = evento.eve_estado && evento.eve_estado.toLowerCase() !== 'activo';

        if (estaInactivo || fechaEvento < hoy) {
          erroresItems.push({
            eve_id: eveId,
            evento: evento.eve_nombre,
            error: 'El evento no se encuentra activo o ya finalizó.'
          });
          continue;
        }

        // Validar cupo máximo (eve_capacidad vs inscritos reales)
        const { inscritos } = await t.one(
          `SELECT COUNT(*)::int AS inscritos FROM asistencias WHERE ase_eve_id = $1 AND ase_estado != 'Cancelado'`,
          [eveId]
        );

        if (inscritos >= evento.eve_capacidad) {
          erroresItems.push({
            eve_id: eveId,
            evento: evento.eve_nombre,
            error: `Cupo máximo excedido (${inscritos}/${evento.eve_capacidad}).`
          });
          continue;
        }

        // Validar duplicidad de inscripción (cruces)
        const yaInscrito = await t.oneOrNone(
          `SELECT a.ase_id 
           FROM asistencias a 
           JOIN registro_evento r ON a.ase_reg_id = r.reg_id 
           WHERE r.reg_asi_id = $1 AND a.ase_eve_id = $2 AND a.ase_estado != 'Cancelado'`,
          [asiId, eveId]
        );

        if (yaInscrito) {
          erroresItems.push({
            eve_id: eveId,
            evento: evento.eve_nombre,
            error: 'El asistente ya se encuentra inscrito en este evento.'
          });
          continue;
        }

        eventosValidados.push(evento);
      }

      // Si existe algún error en los ítems, abortamos la transacción (ROLLBACK atómico)
      if (erroresItems.length > 0) {
        const errorTransaccion = new Error('Fallaron las validaciones de inscripción.');
        errorTransaccion.status = 400;
        errorTransaccion.detalles = erroresItems;
        throw errorTransaccion;
      }

      // 3. Crear Registro Cabecera (registro_evento)
      const cabecera = await t.one(
        `INSERT INTO registro_evento (reg_asi_id, reg_fecha)
         VALUES ($1, CURRENT_TIMESTAMP)
         RETURNING reg_id AS id, reg_fecha AS fecha, reg_asi_id AS asistente_id`,
        [asiId]
      );

      // 4. Crear Detalle de Asistencias (asistencias)
      const detalles = [];
      for (const evento of eventosValidados) {
        const detalle = await t.one(
          `INSERT INTO asistencias (ase_reg_id, ase_eve_id, ase_estado)
           VALUES ($1, $2, 'Inscrito')
           RETURNING ase_id AS id, ase_reg_id AS registro_id, ase_eve_id AS evento_id, ase_estado AS estado`,
          [cabecera.id, evento.eve_id]
        );
        detalles.push({
          ...detalle,
          evento_nombre: evento.eve_nombre
        });
      }

      return {
        registro: {
          ...cabecera,
          asistente_nombre: asistente.asi_nombre,
          asistente_identificacion: asistente.asi_identificacion
        },
        asistencias: detalles
      };
    });

    return res.status(201).json({
      mensaje: 'Inscripción realizada exitosamente.',
      data: resultado
    });
  } catch (error) {
    if (error.detalles) {
      return res.status(error.status || 400).json({
        mensaje: 'La transacción fue revertida (ROLLBACK) debido a errores de validación.',
        errores: error.detalles
      });
    }

    return res.status(error.status || 500).json({
      mensaje: error.message || 'Error al procesar la inscripción transaccional',
      error: error.message
    });
  }
}

/**
 * PBI-20: Listar registros de inscripción (Cabecera y Detalle)
 * GET /api/registros
 */
export async function listarRegistros(req, res) {
  try {
    const { page = 1, limit = 10, asi_id } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT r.reg_id AS id, r.reg_fecha AS fecha, r.reg_asi_id AS asistente_id,
             a.asi_nombre AS asistente_nombre, a.asi_identificacion AS asistente_identificacion, a.asi_email AS asistente_email,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', ast.ase_id,
                   'evento_id', e.eve_id,
                   'evento_nombre', e.eve_nombre,
                   'fecha_inicio', e.eve_fecha_inicio,
                   'estado', ast.ase_estado
                 )
               ) FILTER (WHERE ast.ase_id IS NOT NULL), '[]'
             ) AS asistencias
      FROM registro_evento r
      JOIN asistentes a ON r.reg_asi_id = a.asi_id
      LEFT JOIN asistencias ast ON r.reg_id = ast.ase_reg_id
      LEFT JOIN eventos e ON ast.ase_eve_id = e.eve_id
    `;

    const params = [];
    if (asi_id) {
      query += ` WHERE r.reg_asi_id = $1`;
      params.push(asi_id);
    }

    query += ` GROUP BY r.reg_id, a.asi_id ORDER BY r.reg_fecha DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const registros = await db.any(query, params);

    const countQuery = asi_id
      ? `SELECT COUNT(*) FROM registro_evento WHERE reg_asi_id = $1`
      : `SELECT COUNT(*) FROM registro_evento`;
    const countParams = asi_id ? [asi_id] : [];
    const { count } = await db.one(countQuery, countParams);

    return res.json({
      data: registros,
      meta: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al listar registros', error: error.message });
  }
}

/**
 * PBI-20: Obtener un registro por ID con su detalle
 * GET /api/registros/:id
 */
export async function obtenerRegistro(req, res) {
  try {
    const registro = await db.oneOrNone(
      `SELECT r.reg_id AS id, r.reg_fecha AS fecha, r.reg_asi_id AS asistente_id,
              a.asi_nombre AS asistente_nombre, a.asi_identificacion AS asistente_identificacion, a.asi_email AS asistente_email,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', ast.ase_id,
                    'evento_id', e.eve_id,
                    'evento_nombre', e.eve_nombre,
                    'fecha_inicio', e.eve_fecha_inicio,
                    'estado', ast.ase_estado
                  )
                ) FILTER (WHERE ast.ase_id IS NOT NULL), '[]'
              ) AS asistencias
       FROM registro_evento r
       JOIN asistentes a ON r.reg_asi_id = a.asi_id
       LEFT JOIN asistencias ast ON r.reg_id = ast.ase_reg_id
       LEFT JOIN eventos e ON ast.ase_eve_id = e.eve_id
       WHERE r.reg_id = $1
       GROUP BY r.reg_id, a.asi_id`,
      [req.params.id]
    );

    if (!registro) {
      return res.status(404).json({ mensaje: 'Registro de evento no encontrado' });
    }

    return res.json(registro);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener registro', error: error.message });
  }
}

/**
 * Eliminar / Cancelar registro de evento
 * DELETE /api/registros/:id
 */
export async function eliminarRegistro(req, res) {
  try {
    const resultado = await db.result('DELETE FROM registro_evento WHERE reg_id = $1', [req.params.id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: 'Registro no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al eliminar registro', error: error.message });
  }
}
