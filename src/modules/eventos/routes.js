import { Router } from 'express';
import { listarEventos, crearEvento, editarEvento, eliminarEvento } from './controller.js';
import { verificarToken, autorizarRoles } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(verificarToken);
router.use(autorizarRoles('ADMIN'));

router.get('/', listarEventos);
router.post('/', crearEvento);
router.put('/:id', editarEvento);
router.delete('/:id', eliminarEvento);

export default router;
