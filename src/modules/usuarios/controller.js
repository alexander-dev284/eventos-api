import bcrypt from 'bcrypt';
import db from '../../config/database.js';

const SALT_ROUNDS = 10;

const CAMPOS_PUBLICOS = `
  usuarios.id, usuarios.nombres, usuarios.apellidos, usuarios.email,
  usuarios.rol_id AS "rolId", usuarios.activo,
  roles.nombre AS "rolNombre"
`;

export async function listarUsuarios(req, res) {
  try {
    const usuarios = await db.any(
      `SELECT ${CAMPOS_PUBLICOS}
       FROM usuarios
       JOIN roles ON roles.id = usuarios.rol_id
       ORDER BY usuarios.id`
    );
    return res.json(usuarios);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al listar usuarios', error: error.message });
  }
}

export async function obtenerUsuario(req, res) {
  try {
    const usuario = await db.oneOrNone(
      `SELECT ${CAMPOS_PUBLICOS}
       FROM usuarios
       JOIN roles ON roles.id = usuarios.rol_id
       WHERE usuarios.id = $1`,
      [req.params.id]
    );

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    return res.json(usuario);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener usuario', error: error.message });
  }
}

export async function crearUsuario(req, res) {
  try {
    const { nombres, apellidos, email, password, rolId } = req.body;

    if (!nombres || !apellidos || !email || !password || !rolId) {
      return res.status(400).json({ mensaje: 'Todos los campos son requeridos' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const usuario = await db.one(
      `INSERT INTO usuarios (nombres, apellidos, email, password, rol_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombres, apellidos, email, rol_id AS "rolId", activo`,
      [nombres, apellidos, email, passwordHash, rolId]
    );

    return res.status(201).json(usuario);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un usuario con ese email' });
    }
    return res.status(500).json({ mensaje: 'Error al crear usuario', error: error.message });
  }
}

export async function actualizarUsuario(req, res) {
  try {
    const { nombres, apellidos, email, password, rolId, activo } = req.body;
    const passwordHash = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;

    const usuario = await db.oneOrNone(
      `UPDATE usuarios
       SET nombres = COALESCE($1, nombres),
           apellidos = COALESCE($2, apellidos),
           email = COALESCE($3, email),
           password = COALESCE($4, password),
           rol_id = COALESCE($5, rol_id),
           activo = COALESCE($6, activo),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, nombres, apellidos, email, rol_id AS "rolId", activo`,
      [nombres ?? null, apellidos ?? null, email ?? null, passwordHash, rolId ?? null, activo ?? null, req.params.id]
    );

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    return res.json(usuario);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al actualizar usuario', error: error.message });
  }
}

export async function eliminarUsuario(req, res) {
  try {
    const resultado = await db.result('DELETE FROM usuarios WHERE id = $1', [req.params.id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al eliminar usuario', error: error.message });
  }
}
