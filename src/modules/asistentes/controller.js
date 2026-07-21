import db from '../../config/database.js';

export async function listarAsistentes(req, res) {
  try {
    const asistentes = await db.any(
      'SELECT id, nombres, apellidos, documento, email, telefono, activo FROM asistentes ORDER BY id'
    );
    return res.json(asistentes);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al listar asistentes', error: error.message });
  }
}

export async function obtenerAsistente(req, res) {
  try {
    const asistente = await db.oneOrNone(
      'SELECT id, nombres, apellidos, documento, email, telefono, activo FROM asistentes WHERE id = $1',
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
    const { nombres, apellidos, documento, email, telefono } = req.body;

    if (!nombres || !apellidos || !documento || !email) {
      return res.status(400).json({ mensaje: 'nombres, apellidos, documento y email son requeridos' });
    }

    const asistente = await db.one(
      `INSERT INTO asistentes (nombres, apellidos, documento, email, telefono)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombres, apellidos, documento, email, telefono, activo`,
      [nombres, apellidos, documento, email, telefono ?? null]
    );

    return res.status(201).json(asistente);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un asistente con ese documento o email' });
    }
    return res.status(500).json({ mensaje: 'Error al crear asistente', error: error.message });
  }
}

export async function actualizarAsistente(req, res) {
  try {
    const { nombres, apellidos, documento, email, telefono, activo } = req.body;

    const asistente = await db.oneOrNone(
      `UPDATE asistentes
       SET nombres = COALESCE($1, nombres),
           apellidos = COALESCE($2, apellidos),
           documento = COALESCE($3, documento),
           email = COALESCE($4, email),
           telefono = COALESCE($5, telefono),
           activo = COALESCE($6, activo),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, nombres, apellidos, documento, email, telefono, activo`,
      [nombres ?? null, apellidos ?? null, documento ?? null, email ?? null, telefono ?? null, activo ?? null, req.params.id]
    );

    if (!asistente) {
      return res.status(404).json({ mensaje: 'Asistente no encontrado' });
    }

    return res.json(asistente);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un asistente con ese documento o email' });
    }
    return res.status(500).json({ mensaje: 'Error al actualizar asistente', error: error.message });
  }
}

export async function eliminarAsistente(req, res) {
  try {
    const resultado = await db.result('DELETE FROM asistentes WHERE id = $1', [req.params.id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: 'Asistente no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al eliminar asistente', error: error.message });
  }
}
