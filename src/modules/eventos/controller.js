import { db } from '../../config/database.js';

const CAMPOS = "eve_id AS id, eve_nombre AS nombre, eve_fecha_inicio AS fecha_inicio, eve_capacidad AS capacidad, eve_ubicacion AS ubicacion, CASE WHEN eve_fecha_inicio > CURRENT_TIMESTAMP THEN 'Pendiente' ELSE 'Terminado' END AS estado";

export async function listarEventos(req, res) {
  try {
    const { page = 1, limit = 10, fecha } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `SELECT ${CAMPOS} FROM eventos`;
    const params = [];
    
    if (fecha) {
      query += ` WHERE eve_fecha_inicio::date = $1`;
      params.push(fecha);
    }
    
    query += ` ORDER BY eve_fecha_inicio ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const eventos = await db.any(query, params);
    
    const totalQuery = fecha ? `SELECT COUNT(*) FROM eventos WHERE eve_fecha_inicio::date = $1` : `SELECT COUNT(*) FROM eventos`;
    const totalParams = fecha ? [fecha] : [];
    const { count } = await db.one(totalQuery, totalParams);
    
    return res.json({
      data: eventos,
      meta: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al listar eventos', error: error.message });
  }
}

export async function crearEvento(req, res) {
  try {
    const { nombre, fecha_inicio, capacidad, ubicacion } = req.body;

    if (!nombre || !fecha_inicio || capacidad === undefined || !ubicacion) {
      return res.status(400).json({ mensaje: 'nombre, fecha_inicio, capacidad y ubicacion son requeridos' });
    }

    if (Number(capacidad) <= 0) {
      return res.status(400).json({ mensaje: 'La capacidad (cupo) debe ser mayor a 0' });
    }

    const fechaEvento = new Date(fecha_inicio);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    if (fechaEvento < hoy) {
      return res.status(400).json({ mensaje: 'La fecha de inicio no puede estar en el pasado' });
    }

    const evento = await db.one(
      `INSERT INTO eventos (eve_nombre, eve_fecha_inicio, eve_capacidad, eve_ubicacion)
       VALUES ($1, $2, $3, $4)
       RETURNING ${CAMPOS}`,
      [nombre, fecha_inicio, capacidad, ubicacion]
    );

    return res.status(201).json(evento);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al crear evento', error: error.message });
  }
}

export async function editarEvento(req, res) {
  try {
    const { nombre, fecha_inicio, capacidad, ubicacion } = req.body;
    
    if (capacidad !== undefined && Number(capacidad) <= 0) {
      return res.status(400).json({ mensaje: 'La capacidad (cupo) debe ser mayor a 0' });
    }

    if (fecha_inicio) {
      const fechaEvento = new Date(fecha_inicio);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      if (fechaEvento < hoy) {
        return res.status(400).json({ mensaje: 'La fecha de inicio no puede estar en el pasado' });
      }
    }

    const evento = await db.oneOrNone(
      `UPDATE eventos
       SET eve_nombre = COALESCE($1, eve_nombre),
           eve_fecha_inicio = COALESCE($2, eve_fecha_inicio),
           eve_capacidad = COALESCE($3, eve_capacidad),
           eve_ubicacion = COALESCE($4, eve_ubicacion)
       WHERE eve_id = $5
       RETURNING ${CAMPOS}`,
      [nombre ?? null, fecha_inicio ?? null, capacidad ?? null, ubicacion ?? null, req.params.id]
    );

    if (!evento) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }

    return res.json(evento);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al editar evento', error: error.message });
  }
}

export async function eliminarEvento(req, res) {
  try {
    const eventId = parseInt(req.params.id, 10);
    const force = req.query.force === 'true' || req.query.force === '1';

    const { count: asistCount } = await db.one(
      'SELECT COUNT(*)::int AS count FROM asistencias WHERE ase_eve_id = $1 AND ase_estado != $2',
      [eventId, 'Cancelado']
    );

    if (asistCount > 0 && !force) {
      return res.status(409).json({ mensaje: 'No se puede eliminar: el evento tiene inscripciones registradas. Use ?force=true para forzar la eliminación (eliminará las inscripciones relacionadas).' });
    }

    if (force) {
      await db.tx(async (t) => {
        await t.none('DELETE FROM asistencias WHERE ase_eve_id = $1', [eventId]);
        await t.none(`DELETE FROM registro_evento r WHERE NOT EXISTS (SELECT 1 FROM asistencias a WHERE a.ase_reg_id = r.reg_id)`);
        const result = await t.result('DELETE FROM eventos WHERE eve_id = $1', [eventId]);
        if (result.rowCount === 0) {
          const err = new Error('Evento no encontrado');
          err.status = 404;
          throw err;
        }
      });
      return res.status(204).send();
    }

    const resultado = await db.result('DELETE FROM eventos WHERE eve_id = $1', [eventId]);
    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }
    return res.status(204).send();
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }
    return res.status(error.status || 500).json({ mensaje: error.message || 'Error al eliminar evento', error: error.message });
  }
}
