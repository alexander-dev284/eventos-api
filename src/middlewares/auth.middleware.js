import jwt from 'jsonwebtoken';

export function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ mensaje: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload;
    next();
  } catch (error) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
}

export function autorizarRoles(...rolesPermitidos) {
  const rolesNormalizados = rolesPermitidos.map((rol) => rol.toLowerCase());

  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ mensaje: 'No autenticado' });
    }

    // Support multiple token payload shapes: `rolNombre`, `rol`, or `role`
    const roleFromToken = (req.usuario.rolNombre || req.usuario.rol || req.usuario.role || '').toString().toLowerCase();
    if (!rolesNormalizados.includes(roleFromToken)) {
      return res.status(403).json({ mensaje: 'No tiene permisos para esta acción' });
    }

    next();
  };
}
