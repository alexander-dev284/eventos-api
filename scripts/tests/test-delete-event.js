async function run() {
  try {
    const loginRes = await fetch('http://localhost:6767/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const login = await loginRes.json();
    console.log('LOGIN token present:', !!login.token);
    const token = login.token;
    const eventId = 9; // change if needed
    const res = await fetch(`http://localhost:6767/api/eventos/${eventId}?force=true`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('DELETE status:', res.status);
    try { console.log('DELETE body:', await res.json()); } catch(e){ console.log('No JSON body'); }
  } catch (err) {
    console.error('ERROR', err);
  }
}
run();
