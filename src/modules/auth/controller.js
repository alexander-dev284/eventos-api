import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../../config/database.js';

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ mensaje: 'Email y contraseña son requeridos' });
    }

    const usuario = await db.oneOrNone(
      `SELECT usuarios.id, usuarios.nombres, usuarios.apellidos, usuarios.email,
              usuarios.password, usuarios.rol_id AS "rolId", roles.nombre AS "rolNombre"
       FROM usuarios
       JOIN roles ON roles.id = usuarios.rol_id
       WHERE usuarios.email = $1 AND usuarios.activo = TRUE`,
      [email]
    );

    if (!usuario) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas' });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password);

    if (!passwordValido) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
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
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        email: usuario.email,
        rol: usuario.rolNombre,
      },
    });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al iniciar sesión', error: error.message });
  }
}
