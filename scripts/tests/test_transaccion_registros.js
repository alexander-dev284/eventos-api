
const fetch = globalThis.fetch || require('node-fetch');
const API = 'http://localhost:6767';

async function login(username, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return { status: res.status, body: await res.json() };
}

async function post(path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch(e) { parsed = text; }
  return { status: res.status, body: parsed };
}

async function get(path, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'GET',
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}) }
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch(e) { parsed = text; }
  return { status: res.status, body: parsed };
}

(async function main(){
  console.log('Login as admin...');
  const adminLogin = await login('admin', 'admin123');
  if (!adminLogin.body || !adminLogin.body.token) {
    console.error('No se pudo loguear como admin:', adminLogin);
    process.exit(1);
  }
  const adminToken = adminLogin.body.token;
  console.log('Admin token obtained.');

  // Crear evento con capacidad 1 (futuro)
  const tomorrow = new Date(Date.now() + 24*60*60*1000);
  const eventPayload = { nombre: 'Evento-Test-FULL', fecha_inicio: tomorrow.toISOString(), capacidad: 1, ubicacion: 'Sala A' };
  const evCreate = await post('/api/eventos', adminToken, eventPayload);
  if (evCreate.status !== 200 && evCreate.status !== 201) {
    console.error('Fallo al crear evento FULL:', evCreate);
    process.exit(1);
  }
  const eventFull = evCreate.body.data ? evCreate.body.data : evCreate.body;
  // controller listarEventos returns { data: [...] } for GET, but POST likely returns created object; handle both
  const eventFullId = eventFull.id || (eventFull[0] && eventFull[0].id) || eventFull.eve_id || evCreate.body.id || null;
  console.log('Created eventFull id:', eventFullId);

  // Usaremos un ID de evento inexistente para forzar error de validación (evento no existe)
  const eventPastId = 9999999; // ID que no debería existir

  // Obtener asistentes existentes
  const ast = await get('/api/asistentes', adminToken);
  if (ast.status !== 200) {
    console.error('Error obteniendo asistentes:', ast);
    process.exit(1);
  }
  const asistentes = Array.isArray(ast.body) ? ast.body : ast.body.data || [];
  if (asistentes.length < 2) {
    console.log('Menos de 2 asistentes existentes, creando dos nuevos...');
    const a1 = await post('/api/asistentes', adminToken, { identificacion: '999999001', nombre: 'Test A1', email: 'a1@test.local' });
    const a2 = await post('/api/asistentes', adminToken, { identificacion: '999999002', nombre: 'Test A2', email: 'a2@test.local' });
    // After creation, fetch again
    const ast2 = await get('/api/asistentes', adminToken);
    const arr = Array.isArray(ast2.body) ? ast2.body : ast2.body.data || [];
    asistentes.splice(0, asistentes.length, ...arr);
  }

  const asi1 = asistentes[0];
  const asi2 = asistentes[1] || asistentes[0];
  console.log('Using asistentes:', asi1.id, asi2.id);

  // 1) Registrar asi1 en eventFull (debe ocupar el cupo)
  console.log('Registrando primer asistente para llenar el evento...');
  const reg1 = await post('/api/registros', adminToken, { asi_id: asi1.id, eventos: [eventFullId] });
  console.log('reg1:', reg1.status, reg1.body);
  if (reg1.status !== 201) {
    console.error('Fallo al inscribir primer asistente (debe funcionar):', reg1);
    process.exit(1);
  }

  // 2) Intentar transacción que incluya: eventFull (lleno) y eventPastId (inexistente) para asi2
  console.log('Intentando transacción con errores (evento lleno + evento inexistente)...');
  const reg2 = await post('/api/registros', adminToken, { asi_id: asi2.id, eventos: [eventFullId, eventPastId] });
  console.log('reg2 status:', reg2.status);
  console.log('reg2 body:', JSON.stringify(reg2.body, null, 2));

  // 3) Verificar que no se creó ningún registro para asi2
  const registrosAsi2 = await get(`/api/registros?asi_id=${asi2.id}`, adminToken);
  console.log('registros for asi2 status:', registrosAsi2.status, 'body:', JSON.stringify(registrosAsi2.body, null, 2));

  // Resultado final
  if (reg2.status >= 400) {
    console.log('\nRESULTADO: La transacción fue rechazada como se esperaba y se devolvieron errores.');
  } else {
    console.error('\nRESULTADO: La transacción se procesó correctamente (esto NO era lo esperado).');
  }

  console.log('\nComprobación final: los registros del segundo asistente deben ser 0 (ningún registro nuevo).');
  process.exit(0);
})();
