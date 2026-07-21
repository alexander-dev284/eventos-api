import db from '../../config/database.js';

const CAMPOS = 'asi_id AS id, asi_identificacion AS identificacion, asi_nombre AS nombre, asi_email AS email';

export async function listarAsistentes(req, res) {
  try {
    const asistentes = await db.any(`SELECT ${CAMPOS} FROM asistentes ORDER BY asi_id`);
    return res.json(asistentes);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al listar asistentes', error: error.message });
  }
}

export async function obtenerAsistente(req, res) {
  try {
    const asistente = await db.oneOrNone(
      `SELECT ${CAMPOS} FROM asistentes WHERE asi_id = $1`,
      [req.params.id]
    );

    if (!asistente) {
      return res.status(404).json({ mensaje: 'Asistente no encontrado' });
    }

    return res.json(asistente);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener asistente', error: error.message });
  }
}

export async function crearAsistente(req, res) {
  try {
    const { identificacion, nombre, email } = req.body;

    if (!identificacion || !nombre || !email) {
      return res.status(400).json({ mensaje: 'identificacion, nombre y email son requeridos' });
    }

    const asistente = await db.one(
      `INSERT INTO asistentes (asi_identificacion, asi_nombre, asi_email)
       VALUES ($1, $2, $3)
       RETURNING ${CAMPOS}`,
      [identificacion, nombre, email]
    );

    return res.status(201).json(asistente);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un asistente con esa identificación o email' });
    }
    return res.status(500).json({ mensaje: 'Error al crear asistente', error: error.message });
  }
}

export async function actualizarAsistente(req, res) {
  try {
    const { identificacion, nombre, email } = req.body;

    const asistente = await db.oneOrNone(
      `UPDATE asistentes
       SET asi_identificacion = COALESCE($1, asi_identificacion),
           asi_nombre = COALESCE($2, asi_nombre),
           asi_email = COALESCE($3, asi_email)
       WHERE asi_id = $4
       RETURNING ${CAMPOS}`,
      [identificacion ?? null, nombre ?? null, email ?? null, req.params.id]
    );

    if (!asistente) {
      return res.status(404).json({ mensaje: 'Asistente no encontrado' });
    }

    return res.json(asistente);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un asistente con esa identificación o email' });
    }
    return res.status(500).json({ mensaje: 'Error al actualizar asistente', error: error.message });
  }
}

export async function eliminarAsistente(req, res) {
  try {
    const resultado = await db.result('DELETE FROM asistentes WHERE asi_id = $1', [req.params.id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: 'Asistente no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ mensaje: 'No se puede eliminar: el asistente tiene registros de evento' });
    }
    return res.status(500).json({ mensaje: 'Error al eliminar asistente', error: error.message });
  }
}
