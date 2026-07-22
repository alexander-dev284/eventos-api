import { db } from '../../config/database.js';
import XLSX from 'xlsx';

function escapeCsvValue(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function formatCsvDate(value) {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(',', '');
}

function buildCsv(rows) {
  const headers = [
    'Evento ID',
    'Evento',
    'Fecha Inicio',
    'Ubicación',
    'Capacidad',
    'Inscritos',
    'Disponibles',
    'Ocupación %',
    'Asistentes registrados'
  ];

  const lines = [headers.join(';')];

  if (rows && rows.length > 0) {
    rows.forEach(row => {
      const line = [
        escapeCsvValue(row.evento_id),
        escapeCsvValue(row.evento_nombre),
        escapeCsvValue(formatCsvDate(row.evento_fecha_inicio)),
        escapeCsvValue(row.evento_ubicacion),
        escapeCsvValue(row.capacidad_total),
        escapeCsvValue(row.inscritos_reales),
        escapeCsvValue(row.cupos_disponibles),
        escapeCsvValue(row.porcentaje_ocupacion),
        escapeCsvValue(row.asistentes_registrados)
      ];
      lines.push(line.join(';'));
    });
  }

  return '\ufeff' + lines.join('\r\n');
}

/**
 * PBI-24: Endpoint de reporte de inscripciones (JOINs complejos, filtros, paginación, cupo vs inscritos)
 * GET /api/reportes/inscripciones
 */
export async function reporteInscripciones(req, res) {
  try {
    const { page = 1, limit = 10, fecha, evento_id, eve_id } = req.query;
    const exportType = req.query.export;
    const targetEventoId = evento_id || eve_id;
    const offset = (page - 1) * limit;

    const baseWhere = [];
    const baseParams = [];

    if (targetEventoId) {
      baseParams.push(targetEventoId);
      baseWhere.push(`e.eve_id = $${baseParams.length}`);
    }

    if (fecha) {
      baseParams.push(fecha);
      baseWhere.push(`e.eve_fecha_inicio::date = $${baseParams.length}`);
    }

    if (exportType === 'csv' || exportType === 'xlsx') {
      let csvQuery = `
        SELECT
          e.eve_id AS evento_id,
          e.eve_nombre AS evento_nombre,
          e.eve_fecha_inicio AS evento_fecha_inicio,
          e.eve_ubicacion AS evento_ubicacion,
          e.eve_capacidad AS capacidad_total,
          ast.ase_id AS asistencia_id,
          a.asi_id AS asistente_id,
          a.asi_nombre AS asistente_nombre,
          a.asi_identificacion AS asistente_identificacion,
          a.asi_email AS asistente_email,
          r.reg_fecha AS fecha_registro,
          ast.ase_estado AS estado_asistencia
        FROM eventos e
        LEFT JOIN asistencias ast ON e.eve_id = ast.ase_eve_id AND ast.ase_estado != 'Cancelado'
        LEFT JOIN registro_evento r ON ast.ase_reg_id = r.reg_id
        LEFT JOIN asistentes a ON r.reg_asi_id = a.asi_id
      `;

      if (baseWhere.length > 0) {
        csvQuery += ` WHERE ${baseWhere.join(' AND ')}`;
      }

      csvQuery += ` ORDER BY e.eve_fecha_inicio DESC, a.asi_nombre ASC`;

      const rows = await db.any(csvQuery, baseParams);

      if (exportType === 'csv') {
        const csv = buildCsv(rows);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="inscripciones-reportes.csv"');
        return res.send(csv);
      }

      const workbook = XLSX.utils.book_new();
      const data = rows.map(row => ({
        'Evento ID': row.evento_id,
        'Evento': row.evento_nombre,
        'Fecha Inicio': formatCsvDate(row.evento_fecha_inicio),
        'Ubicación': row.evento_ubicacion,
        'Capacidad': row.capacidad_total,
        'Asistencia ID': row.asistencia_id,
        'Asistente ID': row.asistente_id,
        'Asistente': row.asistente_nombre,
        'Cédula': row.asistente_identificacion,
        'Email': row.asistente_email,
        'Fecha Registro': formatCsvDate(row.fecha_registro),
        'Estado Asistencia': row.estado_asistencia
      }));
      const worksheet = XLSX.utils.json_to_sheet(data);
      worksheet['!cols'] = [
        { wch: 12 },
        { wch: 30 },
        { wch: 20 },
        { wch: 24 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 28 },
        { wch: 28 },
        { wch: 20 },
        { wch: 18 }
      ];
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="inscripciones-reportes.xlsx"');
      return res.send(buffer);
    }

    let query = `
      SELECT 
        e.eve_id AS evento_id,
        e.eve_nombre AS evento_nombre,
        e.eve_fecha_inicio AS evento_fecha_inicio,
        e.eve_ubicacion AS evento_ubicacion,
        e.eve_capacidad AS capacidad_total,
        COUNT(ast.ase_id)::int AS inscritos_reales,
        (e.eve_capacidad - COUNT(ast.ase_id)::int) AS cupos_disponibles,
        ROUND((COUNT(ast.ase_id) * 100.0 / NULLIF(e.eve_capacidad, 0)), 2) AS porcentaje_ocupacion,
        COALESCE(
          json_agg(
            json_build_object(
              'asistencia_id', ast.ase_id,
              'asistente_id', a.asi_id,
              'asistente_nombre', a.asi_nombre,
              'asistente_identificacion', a.asi_identificacion,
              'asistente_email', a.asi_email,
              'fecha_registro', r.reg_fecha,
              'estado_asistencia', ast.ase_estado
            )
          ) FILTER (WHERE a.asi_id IS NOT NULL), '[]'
        ) AS asistentes
      FROM eventos e
      LEFT JOIN asistencias ast ON e.eve_id = ast.ase_eve_id AND ast.ase_estado != 'Cancelado'
      LEFT JOIN registro_evento r ON ast.ase_reg_id = r.reg_id
      LEFT JOIN asistentes a ON r.reg_asi_id = a.asi_id
    `;

    if (baseWhere.length > 0) {
      query += ` WHERE ` + baseWhere.join(' AND ');
    }

    query += ` GROUP BY e.eve_id ORDER BY e.eve_fecha_inicio DESC LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`;
    const params = [...baseParams, limit, offset];

    const reportes = await db.any(query, params);

    // Conteo total para meta de paginación
    let countQuery = `SELECT COUNT(DISTINCT e.eve_id)::int FROM eventos e`;
    const countParams = [...baseParams];

    if (baseWhere.length > 0) {
      countQuery += ` WHERE ` + baseWhere.join(' AND ');
    }

    const { count } = await db.one(countQuery, countParams);

    return res.json({
      data: reportes,
      meta: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al generar el reporte de inscripciones', error: error.message });
  }
}
