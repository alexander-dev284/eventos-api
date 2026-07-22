import db from '../../config/database.js';

const CAMPOS_PUBLICOS = `
  usuarios.usu_id AS id, usuarios.usu_username AS username,
  usuarios.usu_rol_id AS "rolId", roles.rol_nombre AS "rolNombre"
`;

export async function listarUsuarios(req, res) {
  try {
    const usuarios = await db.any(
      `SELECT ${CAMPOS_PUBLICOS}
       FROM usuarios
       JOIN roles ON roles.rol_id = usuarios.usu_rol_id
       ORDER BY usuarios.usu_id`
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
       JOIN roles ON roles.rol_id = usuarios.usu_rol_id
       WHERE usuarios.usu_id = $1`,
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
    const { username, password, rolId } = req.body;

    if (!username || !password || !rolId) {
      return res.status(400).json({ mensaje: 'username, password y rolId son requeridos' });
    }

    const usuario = await db.one(
      `INSERT INTO usuarios (usu_username, usu_password, usu_rol_id)
       VALUES ($1, $2, $3)
       RETURNING usu_id AS id, usu_username AS username, usu_rol_id AS "rolId"`,
      [username, password, rolId]
    );

    return res.status(201).json(usuario);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un usuario con ese username' });
    }
    return res.status(500).json({ mensaje: 'Error al crear usuario', error: error.message });
  }
}

export async function actualizarUsuario(req, res) {
  try {
    const { username, password, rolId } = req.body;
    const passwordValue = password === '' ? null : password;

    const usuario = await db.oneOrNone(
      `UPDATE usuarios
       SET usu_username = COALESCE($1, usu_username),
           usu_password = COALESCE($2, usu_password),
           usu_rol_id = COALESCE($3, usu_rol_id)
       WHERE usu_id = $4
       RETURNING usu_id AS id, usu_username AS username, usu_rol_id AS "rolId"`,
      [username ?? null, passwordValue, rolId ?? null, req.params.id]
    );

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    return res.json(usuario);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un usuario con ese username' });
    }
    return res.status(500).json({ mensaje: 'Error al actualizar usuario', error: error.message });
  }
}

export async function eliminarUsuario(req, res) {
  try {
    const resultado = await db.result('DELETE FROM usuarios WHERE usu_id = $1', [req.params.id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al eliminar usuario', error: error.message });
  }
}
