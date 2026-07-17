import { Router } from 'express';
import { listarEventos } from './controller.js';
import { verificarToken } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(verificarToken);

router.get('/', listarEventos);

export default router;
