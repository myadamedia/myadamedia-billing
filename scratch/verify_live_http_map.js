const axios = require('axios');

async function testAdminMapHttp() {
  const client = axios.create({
    baseURL: 'http://localhost:3001',
    validateStatus: () => true,
    maxRedirects: 0
  });

  console.log('1. Mengirim login ke http://localhost:3001/admin/login...');
  const loginRes = await client.post('/admin/login',
    new URLSearchParams({ username: 'myadamedia', password: 'Kmzway87aa_' }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  console.log('Status login:', loginRes.status);
  const cookieHeaders = loginRes.headers['set-cookie'];
  if (!cookieHeaders) {
    console.error('Login gagal, tidak ada cookie!');
    return;
  }

  const sessionCookie = cookieHeaders.map(c => c.split(';')[0]).join('; ');
  console.log('Login sukses! Cookie didapat.');

  console.log('\n2. Mengambil http://localhost:3001/admin/map via HTTP...');
  const mapRes = await client.get('/admin/map', {
    headers: { Cookie: sessionCookie }
  });

  console.log('Status /admin/map:', mapRes.status);
  console.log('Panjang konten HTML:', mapRes.data.length, 'karakter');
  console.log('Mengandung data pelanggan (ABDUL GOFUR)?', mapRes.data.includes('ABDUL GOFUR'));
  console.log('Mengandung koordinat pelanggan (-6.38966069)?', mapRes.data.includes('-6.38966069'));
  console.log('Mengandung fungsi buildMapsLink?', mapRes.data.includes('function buildMapsLink'));
  console.log('Mengandung allBoundsCoords?', mapRes.data.includes('allBoundsCoords'));

  // Ambil count data dari JSON string script di HTML
  const custMatch = mapRes.data.match(/<script id="customers-data"[^>]*>([\s\S]*?)<\/script>/);
  if (custMatch) {
    try {
      const custs = JSON.parse(custMatch[1]);
      console.log('Jumlah pelanggan terkirim ke browser:', custs.length);
    } catch(e) {
      console.error('Error parse customers-data JSON:', e.message);
    }
  }

  const odpMatch = mapRes.data.match(/<script id="odps-data"[^>]*>([\s\S]*?)<\/script>/);
  if (odpMatch) {
    try {
      const odps = JSON.parse(odpMatch[1]);
      console.log('Jumlah ODP terkirim ke browser:', odps.length);
    } catch(e) {
      console.error('Error parse odps-data JSON:', e.message);
    }
  }
}

testAdminMapHttp().catch(e => console.error('Error:', e.message));
