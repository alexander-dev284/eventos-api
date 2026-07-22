import assert from 'assert';
const fetch = globalThis.fetch;
import { db } from '../../src/config/database.js';

const API = 'http://localhost:6767';

async function login(user, pass) {
  const r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }) });
  return { status: r.status, body: await r.json() };
}

async function post(path, token, body) {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  const text = await r.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { parsed = text; }
  return { status: r.status, body: parsed };
}

async function run() {
  console.log('Iniciando pruebas backend...');

  const admin = await login('admin', 'admin123');
  assert(admin.body && admin.body.token, 'No se pudo loguear como admin');
  const token = admin.body.token;

  // Crear evento con capacidad 1
  const tomorrow = new Date(Date.now() + 24*60*60*1000).toISOString();
  const evCreate = await post('/api/eventos', token, { nombre: 'PRUEBA_EVENTO_FULL', fecha_inicio: tomorrow, capacidad: 1, ubicacion: 'Test' });
  assert(evCreate.status === 201, 'No se pudo crear evento para test');
  const eventId = evCreate.body.id || evCreate.body.data?.id || evCreate.body.eve_id;
  console.log('Evento creado:', eventId);

  // Obtener o crear asistentes
  const asistentes = await db.any('SELECT asi_id AS id FROM asistentes ORDER BY asi_id LIMIT 2');
  let asi1 = asistentes[0];
  let asi2 = asistentes[1];
  if (!asi1) {
    const a1 = await db.one("INSERT INTO asistentes (asi_identificacion, asi_nombre, asi_email) VALUES ('900000001','Prueba A1','a1@test') RETURNING asi_id AS id");
    asi1 = a1;
  }
  if (!asi2) {
    const a2 = await db.one("INSERT INTO asistentes (asi_identificacion, asi_nombre, asi_email) VALUES ('900000002','Prueba A2','a2@test') RETURNING asi_id AS id");
    asi2 = a2;
  }
  console.log('Asistentes:', asi1.id, asi2.id);

  // Count registros for asi2 before
  const before = await db.one('SELECT COUNT(*)::int AS c FROM registro_evento WHERE reg_asi_id = $1', [asi2.id]);
  const beforeCount = before.c;

  // 1) Inscribir asi1 en el evento (debe funcionar)
  const reg1 = await post('/api/registros', token, { asi_id: asi1.id, eventos: [eventId] });
  assert(reg1.status === 201, 'La primera inscripción debería haber sido exitosa');

  // 2) Intentar inscribir asi2 en evento lleno + evento inexistente para forzar fallo
  const badEventId = 99999999;
  const reg2 = await post('/api/registros', token, { asi_id: asi2.id, eventos: [eventId, badEventId] });
  assert(reg2.status >= 400, 'La transacción fallida debería retornar error');
  assert(reg2.body && reg2.body.errores, 'La respuesta de error debe incluir detalles');
  // Ensure errors include cupo and inexistente
  const hasCupo = reg2.body.errores.some(e => e.error && e.error.toLowerCase().includes('cupo'));
  const hasNoExiste = reg2.body.errores.some(e => e.error && e.error.toLowerCase().includes('no existe'));
  assert(hasCupo || hasNoExiste, 'Errores esperados (cupo o no existe) no encontrados');

  // Verify no new registro_evento for asi2 was created
  const after = await db.one('SELECT COUNT(*)::int AS c FROM registro_evento WHERE reg_asi_id = $1', [asi2.id]);
  const afterCount = after.c;
  assert(afterCount === beforeCount, `Rollback failed: registros antes=${beforeCount}, despues=${afterCount}`);

  console.log('Prueba de rollback y manejo de cupos exitosa.');
}

run().then(()=>process.exit(0)).catch(err=>{ console.error('FALLÓ PRUEBAS:', err); process.exit(2); });
