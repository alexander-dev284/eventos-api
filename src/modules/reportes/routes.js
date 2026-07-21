import { Router } from 'express';
import { reporteInscripciones } from './controller.js';
import { verificarToken, autorizarRoles } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(verificarToken);
router.use(autorizarRoles('ADMIN'));

router.get('/inscripciones', reporteInscripciones);
router.get('/', reporteInscripciones);

export default router;
