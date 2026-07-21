import { Router } from 'express';
import {
  listarFunciones,
  crearFuncion,
  actualizarFuncion,
  eliminarFuncion,
  listarFuncionesDeRol,
  asignarFuncionARol,
  quitarFuncionDeRol,
} from './controller.js';
import { verificarToken, autorizarRoles } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(verificarToken);

router.get('/', listarFunciones);
router.post('/', autorizarRoles('ADMIN'), crearFuncion);
router.put('/:id', autorizarRoles('ADMIN'), actualizarFuncion);
router.delete('/:id', autorizarRoles('ADMIN'), eliminarFuncion);

router.get('/roles/:rolId', listarFuncionesDeRol);
router.post('/roles/:rolId', autorizarRoles('ADMIN'), asignarFuncionARol);
router.delete('/roles/:rolId/:funcionId', autorizarRoles('ADMIN'), quitarFuncionDeRol);

export default router;
