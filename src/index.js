// Package
import express from 'express';
//import routes from './modules/pizzas/routes.js';
//import ingredientsRoutes from './modules/ingredients/routes.js';
//import pizzaIngredientsRoutes from './modules/pizza_ingredients/routes.js';

const app = express();
const PORT = 6767;

// Middleware
// Permite recibir datos en formato JSON
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// Routes
//app.use('/pizzas', routes);
//app.use('/ingredients', ingredientsRoutes);
//app.use('/pizza-ingredients', pizzaIngredientsRoutes);

// Esto nos dice que cuando se haga una solicitud GET a la raíz ('/'), se ejecutará esta función que envía un mensaje de bienvenida como respuesta.
app.get('/', (req, res) => {
    res.send('😺🐴🐒🐖🦣🐝👀👀🦴');
});


// Service execution
// Esto inicia el servidor y lo pone a escuchar en el puerto especificado (PORT). Cuando el servidor esté corriendo, se ejecutará la función de callback que imprime un mensaje en la consola indicando que el servidor está activo y en qué puerto está escuchando.
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});