import { db } from '../../config/database.js';

/**
 * PBI-24: Endpoint de reporte de inscripciones (JOINs complejos, filtros, paginación, cupo vs inscritos)
 * GET /api/reportes/inscripciones
 */
export async function reporteInscripciones(req, res) {
  try {
    const { page = 1, limit = 10, fecha, evento_id, eve_id } = req.query;
    const targetEventoId = evento_id || eve_id;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        e.eve_id AS evento_id,
        e.eve_nombre AS evento_nombre,
        e.eve_fecha_inicio AS evento_fecha_inicio,
        e.eve_ubicacion AS evento_ubicacion,
        e.eve_capacidad AS capacidad_total,
        COUNT(ast.ase_id)::int AS inscritos_reales,
        (e.eve_capacidad - COUNT(ast.ase_id)::int) AS cupos_disponibles,
        ROUND((COUNT(ast.ase_id) * 100.0 / NULLIF(e.eve_capacidad, 0)), 2) AS porcentaje_ocupacion,
        COALESCE(
          json_agg(
            json_build_object(
              'asistencia_id', ast.ase_id,
              'asistente_id', a.asi_id,
              'asistente_nombre', a.asi_nombre,
              'asistente_identificacion', a.asi_identificacion,
              'asistente_email', a.asi_email,
              'fecha_registro', r.reg_fecha,
              'estado_asistencia', ast.ase_estado
            )
          ) FILTER (WHERE a.asi_id IS NOT NULL), '[]'
        ) AS asistentes
      FROM eventos e
      LEFT JOIN asistencias ast ON e.eve_id = ast.ase_eve_id AND ast.ase_estado != 'Cancelado'
      LEFT JOIN registro_evento r ON ast.ase_reg_id = r.reg_id
      LEFT JOIN asistentes a ON r.reg_asi_id = a.asi_id
    `;

    const whereClauses = [];
    const params = [];

    if (targetEventoId) {
      params.push(targetEventoId);
      whereClauses.push(`e.eve_id = $${params.length}`);
    }

    if (fecha) {
      params.push(fecha);
      whereClauses.push(`e.eve_fecha_inicio::date = $${params.length}`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ` + whereClauses.join(' AND ');
    }

    query += ` GROUP BY e.eve_id ORDER BY e.eve_fecha_inicio DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const reportes = await db.any(query, params);

    // Conteo total para meta de paginación
    let countQuery = `SELECT COUNT(DISTINCT e.eve_id)::int FROM eventos e`;
    const countParams = [];

    if (whereClauses.length > 0) {
      // Reconstruir los parámetros para el conteo
      if (targetEventoId) {
        countParams.push(targetEventoId);
      }
      if (fecha) {
        countParams.push(fecha);
      }
      countQuery += ` WHERE ` + whereClauses.join(' AND ');
    }

    const { count } = await db.one(countQuery, countParams);

    return res.json({
      data: reportes,
      meta: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al generar el reporte de inscripciones', error: error.message });
  }
}
