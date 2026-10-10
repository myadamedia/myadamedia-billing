const axios = require('axios');
const Database = require('better-sqlite3');

async function testAdminMap() {
  const db = new Database('database/billing.db', { readonly: true });
  // Let's check password hash or test default admin login
  db.close();

  // Create an axios instance with cookies
  const client = axios.create({
    baseURL: 'http://localhost:3001',
    validateStatus: () => true,
    maxRedirects: 0
  });

  // Try login
  // Let's check login endpoint
  console.log('Sending login request...');
  const loginRes = await client.post('/admin/login', 
    new URLSearchParams({ username: 'admin', password: 'password' }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  
  console.log('Login response status:', loginRes.status);
  const cookie = loginRes.headers['set-cookie'];
  console.log('Set-Cookie:', cookie ? 'Received session cookie' : 'No cookie');

  let sessionCookie = cookie ? cookie.map(c => c.split(';')[0]).join('; ') : '';

  if (!sessionCookie) {
    // Try with admin password from settings or DB
    const db2 = new Database('database/billing.db', { readonly: true });
    const row = db2.prepare('SELECT * FROM admins WHERE username = ?').get('admin');
    console.log('Admin record found:', row ? { id: row.id, username: row.username, role: row.role } : 'null');
    db2.close();
  } else {
    // Now GET /admin/map
    const mapRes = await client.get('/admin/map', {
      headers: { Cookie: sessionCookie }
    });
    console.log('/admin/map status:', mapRes.status);
    console.log('/admin/map body length:', mapRes.data.length);
    console.log('Has ABDUL GOFUR?', mapRes.data.includes('ABDUL GOFUR'));
    console.log('Has buildMapsLink?', mapRes.data.includes('function buildMapsLink'));
    console.log('Has allBoundsCoords?', mapRes.data.includes('allBoundsCoords'));
  }
}

testAdminMap().catch(e => console.error('Error:', e.message));
