async function test() {
  try {
    const loginRes = await fetch('http://localhost:6767/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    console.log("LOGIN:", loginData);

    if (loginData.token) {
      const eventosRes = await fetch('http://localhost:6767/api/eventos', {
        headers: { 'Authorization': 'Bearer ' + loginData.token }
      });
      const eventosData = await eventosRes.json();
      console.log("EVENTOS:", JSON.stringify(eventosData, null, 2));
    }
  } catch (error) {
    console.error("TEST ERROR:", error);
  }
}
test();
