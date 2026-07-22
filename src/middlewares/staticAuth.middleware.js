import jwt from 'jsonwebtoken';
import path from 'path';

export function protegerPlantillas(req, res, next) {
  try {
    const reqPath = req.path || '';
    // Only guard requests for HTML files
    if (!reqPath.endsWith('.html')) return next();

    const file = path.basename(reqPath);

    // Public templates that don't require auth
    const publicFiles = new Set(['index.html', 'login.html']);
    if (publicFiles.has(file)) return next();

    // Extract token from Authorization header or query param `token`
    let token = null;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) token = authHeader.split(' ')[1];
    if (!token && req.query && req.query.token) token = req.query.token;

    if (!token) return res.status(401).send('Acceso no autorizado');

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).send('Token inválido o expirado');
    }

    const role = (payload.rolNombre || payload.role || '').toString().toUpperCase();

    // Map templates to allowed roles. If not present, default to ADMIN only.
    const accessMap = {
      'asistentes.html': ['ADMIN', 'OPERATIVO'],
      'eventos.html': ['ADMIN'],
      'registros.html': ['ADMIN', 'OPERATIVO'],
      'reportes.html': ['ADMIN'],
      'usuarios.html': ['ADMIN'],
      'roles.html': ['ADMIN']
    };

    const allowed = accessMap[file] || ['ADMIN'];
    if (allowed.includes(role)) return next();

    return res.status(403).send('No tiene permisos para acceder a esta página');
  } catch (error) {
    return res.status(500).send('Error en verificación de plantillas');
  }
}

export default protegerPlantillas;
