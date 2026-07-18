import { Router } from 'express';
import { listarEventos, crearEvento } from './controller.js';
import { verificarToken } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(verificarToken);

router.get('/', listarEventos);
router.post('/', crearEvento);

export default router;
