import { Router } from 'express';
import {
  listarRoles,
  obtenerRol,
  crearRol,
  actualizarRol,
  eliminarRol,
} from './controller.js';
import { verificarToken, autorizarRoles } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(verificarToken);

router.get('/', listarRoles);
router.get('/:id', obtenerRol);
router.post('/', autorizarRoles('ADMIN'), crearRol);
router.put('/:id', autorizarRoles('ADMIN'), actualizarRol);
router.delete('/:id', autorizarRoles('ADMIN'), eliminarRol);

export default router;
