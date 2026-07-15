import db from '../../config/database.js';

export async function listarRoles(req, res) {
  try {
    const roles = await db.any('SELECT id, nombre, descripcion, activo FROM roles ORDER BY id');
    return res.json(roles);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al listar roles', error: error.message });
  }
}

export async function obtenerRol(req, res) {
  try {
    const rol = await db.oneOrNone(
      'SELECT id, nombre, descripcion, activo FROM roles WHERE id = $1',
      [req.params.id]
    );

    if (!rol) {
      return res.status(404).json({ mensaje: 'Rol no encontrado' });
    }

    return res.json(rol);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener rol', error: error.message });
  }
}

export async function crearRol(req, res) {
  try {
    const { nombre, descripcion } = req.body;

    if (!nombre) {
      return res.status(400).json({ mensaje: 'El nombre del rol es requerido' });
    }

    const rol = await db.one(
      'INSERT INTO roles (nombre, descripcion) VALUES ($1, $2) RETURNING id, nombre, descripcion, activo',
      [nombre, descripcion ?? null]
    );

    return res.status(201).json(rol);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un rol con ese nombre' });
    }
    return res.status(500).json({ mensaje: 'Error al crear rol', error: error.message });
  }
}

export async function actualizarRol(req, res) {
  try {
    const { nombre, descripcion, activo } = req.body;

    const rol = await db.oneOrNone(
      `UPDATE roles
       SET nombre = COALESCE($1, nombre),
           descripcion = COALESCE($2, descripcion),
           activo = COALESCE($3, activo),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, nombre, descripcion, activo`,
      [nombre ?? null, descripcion ?? null, activo ?? null, req.params.id]
    );

    if (!rol) {
      return res.status(404).json({ mensaje: 'Rol no encontrado' });
    }

    return res.json(rol);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al actualizar rol', error: error.message });
  }
}

export async function eliminarRol(req, res) {
  try {
    const resultado = await db.result('DELETE FROM roles WHERE id = $1', [req.params.id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: 'Rol no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al eliminar rol', error: error.message });
  }
}
