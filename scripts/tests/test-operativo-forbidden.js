async function run() {
  try {
    const PORT = process.env.PORT || 4004;
    // Login as operador
    const loginRes = await fetch(`http://localhost:${PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'operador', password: '123456' })
    });
    const login = await loginRes.json();
    console.log('LOGIN status:', loginRes.status);
    console.log('Login response:', login);
    if (!login.token) return console.error('No token received');

    // Decode JWT payload (no verification) to inspect role
    const token = login.token;
    const payloadB64 = token.split('.')[1];
    const payloadJson = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
    console.log('Decoded JWT payload:', payloadJson);

    // Try to call admin-only endpoint: delete an event
    const eventId = 1;
    const res = await fetch(`http://localhost:${PORT}/api/eventos/${eventId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('\nDELETE /api/eventos/1 status:', res.status);
    try { const body = await res.json(); console.log('Response body:', body); } catch(e) { console.log('No JSON body'); }

    // Also try admin-only users endpoint if exists (GET /api/usuarios protected?)
    const res2 = await fetch(`http://localhost:${PORT}/api/usuarios`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('\nGET /api/usuarios status:', res2.status);
    try { const body2 = await res2.json(); console.log('Response body:', body2); } catch(e) { console.log('No JSON body'); }

  } catch (err) {
    console.error('ERROR', err);
  }
}
run();
