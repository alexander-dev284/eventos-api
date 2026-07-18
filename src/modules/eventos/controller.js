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

export async function crearEvento(req, res) {
  try {
    const { nombre, fecha_inicio, capacidad, ubicacion } = req.body;

    // Validación de campos obligatorios
    if (!nombre || !fecha_inicio || capacidad === undefined || !ubicacion) {
      return res.status(400).json({ mensaje: 'nombre, fecha_inicio, capacidad y ubicacion son requeridos' });
    }

    // Validar cupo > 0
    if (Number(capacidad) <= 0) {
      return res.status(400).json({ mensaje: 'La capacidad (cupo) debe ser mayor a 0' });
    }

    // Validar fecha coherente (no en el pasado)
    const fechaEvento = new Date(fecha_inicio);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Ignorar la hora para comparar solo fecha
    
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
