import { Router } from 'express';
import {
  listarAsistentes,
  obtenerAsistente,
  crearAsistente,
  actualizarAsistente,
  eliminarAsistente,
} from './controller.js';
import { verificarToken } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(verificarToken);

router.get('/', listarAsistentes);
router.get('/:id', obtenerAsistente);
router.post('/', crearAsistente);
router.put('/:id', actualizarAsistente);
router.delete('/:id', eliminarAsistente);

export default router;
