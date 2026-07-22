import assert from 'assert';

const API = 'http://localhost:6767';

async function login(username, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function fetchView(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res;
}

function assertHasFunctions(usuario, expected) {
  const functions = (usuario && usuario.funciones) || [];
  expected.forEach(fn => {
    assert(functions.includes(fn), `Debe incluir la función ${fn}`);
  });
}

async function run() {
  console.log('Iniciando pruebas de menú dinámico...');

  const admin = await login('admin', 'admin123');
  assert(admin.status === 200, 'Login de admin falló');
  assert(admin.body && admin.body.token, 'Admin no devolvió token');
  assertHasFunctions(admin.body.usuario, ['CRUD Asistentes', 'CRUD Eventos', 'Registro Transaccional', 'Reportes', 'CRUD Usuarios', 'CRUD Roles']);
  const adminToken = admin.body.token;

  const operador = await login('operador', '123456');
  assert(operador.status === 200, 'Login de operador falló');
  assert(operador.body && operador.body.token, 'Operador no devolvió token');
  assertHasFunctions(operador.body.usuario, ['CRUD Asistentes', 'Registro Transaccional']);
  const operadorToken = operador.body.token;

  const pages = [
    { path: '/asistentes.html', admin: 200, operador: 200 },
    { path: '/eventos.html', admin: 200, operador: 403 },
    { path: '/registros.html', admin: 200, operador: 200 },
    { path: '/reportes.html', admin: 200, operador: 403 },
    { path: '/usuarios.html', admin: 200, operador: 403 },
    { path: '/roles.html', admin: 200, operador: 403 }
  ];

  for (const page of pages) {
    const adminRes = await fetchView(page.path, adminToken);
    assert(adminRes.status === page.admin, `Admin debe recibir ${page.admin} en ${page.path}, obtuvo ${adminRes.status}`);

    const operadorRes = await fetchView(page.path, operadorToken);
    assert(operadorRes.status === page.operador, `Operador debe recibir ${page.operador} en ${page.path}, obtuvo ${operadorRes.status}`);
  }

  console.log('Prueba de menús dinámicos exitosa.');
}

run().then(() => process.exit(0)).catch(err => {
  console.error('FALLÓ PRUEBAS:', err.message || err);
  process.exit(2);
});
