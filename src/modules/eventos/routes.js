import { Router } from 'express';
import { listarEventos, crearEvento, editarEvento, eliminarEvento } from './controller.js';
import { verificarToken } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(verificarToken);

router.get('/', listarEventos);
router.post('/', crearEvento);
router.put('/:id', editarEvento);
router.delete('/:id', eliminarEvento);

export default router;
