// Package
import express from 'express';
import protegerPlantillas from './middlewares/staticAuth.middleware.js';
import authRoutes from './modules/auth/routes.js';
import usuariosRoutes from './modules/usuarios/routes.js';
import rolesRoutes from './modules/roles/routes.js';
import funcionesRoutes from './modules/funciones/routes.js';
import asistentesRoutes from './modules/asistentes/routes.js';
import eventosRoutes from './modules/eventos/routes.js';
import registrosRoutes from './modules/registros/routes.js';
import reportesRoutes from './modules/reportes/routes.js';

const app = express();
const PORT = 4004;

// Middleware
// Permite recibir datos en formato JSON
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend sin almacenamiento en caché (Cache-Control: no-store)
// Protect HTML templates before serving static files
app.use(protegerPlantillas);
app.use(express.static('vistas', {
    setHeaders: (res, path) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/funciones', funcionesRoutes);
app.use('/api/asistentes', asistentesRoutes);
app.use('/api/eventos', eventosRoutes);
app.use('/api/registros', registrosRoutes);
app.use('/api/reportes', reportesRoutes);

// Esto nos dice que cuando se haga una solicitud GET a la raíz ('/'), se ejecutará esta función que envía un mensaje de bienvenida como respuesta.
app.get('/', (req, res) => {
    res.send('Bienvenido a la API de Eventos. Por favor, use las rutas de la API para interactuar con el sistema.');
});


// Service execution
// Esto inicia el servidor y lo pone a escuchar en el puerto especificado (PORT). Cuando el servidor esté corriendo, se ejecutará la función de callback que imprime un mensaje en la consola indicando que el servidor está activo y en qué puerto está escuchando.
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});