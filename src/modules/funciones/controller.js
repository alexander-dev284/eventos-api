import db from '../../config/database.js';

export async function listarFunciones(req, res) {
  try {
    const funciones = await db.any('SELECT id, nombre, descripcion, activo FROM funciones ORDER BY id');
    return res.json(funciones);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al listar funciones', error: error.message });
  }
}

export async function crearFuncion(req, res) {
  try {
    const { nombre, descripcion } = req.body;

    if (!nombre) {
      return res.status(400).json({ mensaje: 'El nombre de la función es requerido' });
    }

    const funcion = await db.one(
      'INSERT INTO funciones (nombre, descripcion) VALUES ($1, $2) RETURNING id, nombre, descripcion, activo',
      [nombre, descripcion ?? null]
    );

    return res.status(201).json(funcion);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe una función con ese nombre' });
    }
    return res.status(500).json({ mensaje: 'Error al crear función', error: error.message });
  }
}

export async function actualizarFuncion(req, res) {
  try {
    const { nombre, descripcion, activo } = req.body;

    const funcion = await db.oneOrNone(
      `UPDATE funciones
       SET nombre = COALESCE($1, nombre),
           descripcion = COALESCE($2, descripcion),
           activo = COALESCE($3, activo),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, nombre, descripcion, activo`,
      [nombre ?? null, descripcion ?? null, activo ?? null, req.params.id]
    );

    if (!funcion) {
      return res.status(404).json({ mensaje: 'Función no encontrada' });
    }

    return res.json(funcion);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al actualizar función', error: error.message });
  }
}

export async function eliminarFuncion(req, res) {
  try {
    const resultado = await db.result('DELETE FROM funciones WHERE id = $1', [req.params.id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: 'Función no encontrada' });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al eliminar función', error: error.message });
  }
}

export async function listarFuncionesDeRol(req, res) {
  try {
    const permisos = await db.any(
      `SELECT funciones.id AS "funcionId", funciones.nombre AS "funcionNombre",
              roles_funciones.puede_crear AS "puedeCrear",
              roles_funciones.puede_leer AS "puedeLeer",
              roles_funciones.puede_editar AS "puedeEditar",
              roles_funciones.puede_eliminar AS "puedeEliminar"
       FROM roles_funciones
       JOIN funciones ON funciones.id = roles_funciones.funcion_id
       WHERE roles_funciones.rol_id = $1`,
      [req.params.rolId]
    );

    return res.json(permisos);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al listar permisos del rol', error: error.message });
  }
}

export async function asignarFuncionARol(req, res) {
  try {
    const { rolId } = req.params;
    const { funcionId, puedeCrear, puedeLeer, puedeEditar, puedeEliminar } = req.body;

    if (!funcionId) {
      return res.status(400).json({ mensaje: 'funcionId es requerido' });
    }

    const permiso = await db.one(
      `INSERT INTO roles_funciones (rol_id, funcion_id, puede_crear, puede_leer, puede_editar, puede_eliminar)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (rol_id, funcion_id) DO UPDATE
         SET puede_crear = EXCLUDED.puede_crear,
             puede_leer = EXCLUDED.puede_leer,
             puede_editar = EXCLUDED.puede_editar,
             puede_eliminar = EXCLUDED.puede_eliminar,
             updated_at = NOW()
       RETURNING id, rol_id AS "rolId", funcion_id AS "funcionId",
                 puede_crear AS "puedeCrear", puede_leer AS "puedeLeer",
                 puede_editar AS "puedeEditar", puede_eliminar AS "puedeEliminar"`,
      [rolId, funcionId, Boolean(puedeCrear), puedeLeer ?? true, Boolean(puedeEditar), Boolean(puedeEliminar)]
    );

    return res.status(201).json(permiso);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al asignar función al rol', error: error.message });
  }
}

export async function quitarFuncionDeRol(req, res) {
  try {
    const { rolId, funcionId } = req.params;

    const resultado = await db.result(
      'DELETE FROM roles_funciones WHERE rol_id = $1 AND funcion_id = $2',
      [rolId, funcionId]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: 'Asignación no encontrada' });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al quitar función del rol', error: error.message });
  }
}
