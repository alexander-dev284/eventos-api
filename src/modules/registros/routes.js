import { Router } from 'express';
import {
  crearInscripcionTransaccional,
  listarRegistros,
  obtenerRegistro,
  eliminarRegistro
} from './controller.js';
import { verificarToken } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(verificarToken);

router.get('/', listarRegistros);
router.get('/:id', obtenerRegistro);
router.post('/', crearInscripcionTransaccional);
router.delete('/:id', eliminarRegistro);

export default router;
