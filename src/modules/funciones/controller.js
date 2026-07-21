import db from '../../config/database.js';

export async function listarFunciones(req, res) {
  try {
    const funciones = await db.any('SELECT fun_id AS id, fun_nombre AS nombre FROM funciones ORDER BY fun_id');
    return res.json(funciones);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al listar funciones', error: error.message });
  }
}

export async function crearFuncion(req, res) {
  try {
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ mensaje: 'El nombre de la función es requerido' });
    }

    const funcion = await db.one(
      'INSERT INTO funciones (fun_nombre) VALUES ($1) RETURNING fun_id AS id, fun_nombre AS nombre',
      [nombre]
    );

    return res.status(201).json(funcion);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al crear función', error: error.message });
  }
}

export async function actualizarFuncion(req, res) {
  try {
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ mensaje: 'El nombre de la función es requerido' });
    }

    const funcion = await db.oneOrNone(
      'UPDATE funciones SET fun_nombre = $1 WHERE fun_id = $2 RETURNING fun_id AS id, fun_nombre AS nombre',
      [nombre, req.params.id]
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
    const resultado = await db.result('DELETE FROM funciones WHERE fun_id = $1', [req.params.id]);

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
    const funciones = await db.any(
      `SELECT funciones.fun_id AS id, funciones.fun_nombre AS nombre
       FROM roles_funciones
       JOIN funciones ON funciones.fun_id = roles_funciones.rof_fun_id
       WHERE roles_funciones.rof_rol_id = $1`,
      [req.params.rolId]
    );

    return res.json(funciones);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al listar funciones del rol', error: error.message });
  }
}

export async function asignarFuncionARol(req, res) {
  try {
    const { rolId } = req.params;
    const { funcionId } = req.body;

    if (!funcionId) {
      return res.status(400).json({ mensaje: 'funcionId es requerido' });
    }

    await db.none(
      'INSERT INTO roles_funciones (rof_rol_id, rof_fun_id) VALUES ($1, $2)',
      [rolId, funcionId]
    );

    return res.status(201).json({ rolId: Number(rolId), funcionId: Number(funcionId) });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Esa función ya está asignada a este rol' });
    }
    return res.status(500).json({ mensaje: 'Error al asignar función al rol', error: error.message });
  }
}

export async function quitarFuncionDeRol(req, res) {
  try {
    const { rolId, funcionId } = req.params;

    const resultado = await db.result(
      'DELETE FROM roles_funciones WHERE rof_rol_id = $1 AND rof_fun_id = $2',
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
