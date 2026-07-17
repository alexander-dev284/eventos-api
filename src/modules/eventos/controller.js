import { db } from '../../config/database.js';

const CAMPOS = "eve_id AS id, eve_nombre AS nombre, eve_fecha_inicio AS fecha_inicio, eve_capacidad AS capacidad, eve_ubicacion AS ubicacion, CASE WHEN eve_fecha_inicio > CURRENT_TIMESTAMP THEN 'Pendiente' ELSE 'Terminado' END AS estado";

export async function listarEventos(req, res) {
  try {
    const { page = 1, limit = 10, fecha } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `SELECT ${CAMPOS} FROM eventos`;
    const params = [];
    
    // Filtro por fecha si se provee
    if (fecha) {
      query += ` WHERE eve_fecha_inicio::date = $1`;
      params.push(fecha);
    }
    
    query += ` ORDER BY eve_fecha_inicio ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const eventos = await db.any(query, params);
    
    // Conteo total para paginación
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
