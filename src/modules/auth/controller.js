import jwt from 'jsonwebtoken';
import db from '../../config/database.js';

export async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ mensaje: 'username y password son requeridos' });
    }

    const usuario = await db.oneOrNone(
      `SELECT usuarios.usu_id AS id, usuarios.usu_username AS username, usuarios.usu_password AS password,
              usuarios.usu_rol_id AS "rolId", roles.rol_nombre AS "rolNombre"
       FROM usuarios
       JOIN roles ON roles.rol_id = usuarios.usu_rol_id
       WHERE usuarios.usu_username = $1`,
      [username]
    );

    if (!usuario || usuario.password !== password) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas' });
    }

    const funciones = await db.any(
      `SELECT funciones.fun_nombre AS nombre
       FROM roles_funciones
       JOIN funciones ON funciones.fun_id = roles_funciones.rof_fun_id
       WHERE roles_funciones.rof_rol_id = $1`,
      [usuario.rolId]
    );

    const token = jwt.sign(
      {
        id: usuario.id,
        username: usuario.username,
        rolId: usuario.rolId,
        rolNombre: usuario.rolNombre,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.json({
      token,
      usuario: {
        id: usuario.id,
        username: usuario.username,
        rol: usuario.rolNombre,
        funciones: funciones.map((f) => f.nombre),
      },
    });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al iniciar sesión', error: error.message });
  }
}
