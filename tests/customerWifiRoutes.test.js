const express = require('express');
const session = require('express-session');
const http = require('http');
const db = require('../config/database');

const customerPortalRouter = require('../routes/customerPortal');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: true
}));

const testPhone = '081299991111';
const testTag = 'ZTEG11223344';

let server;
let baseUrl;

beforeAll((done) => {
  let pkg = db.prepare('SELECT id FROM packages LIMIT 1').get();
  let pkgId = pkg ? pkg.id : 1;

  db.prepare(`
    INSERT OR REPLACE INTO customers (id, name, phone, pppoe_username, status, package_id, genieacs_tag)
    VALUES (999, 'Tester Route', ?, 'tester_route_user', 'active', ?, ?)
  `).run(testPhone, pkgId, testTag);

  const initialParams = JSON.stringify({
    'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID': { _value: 'MyAdamedia-Route-Test' },
    'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase': { _value: 'oldpass12345' }
  });

  db.prepare(`
    INSERT OR REPLACE INTO acs_devices (id, serial_number, product_class, manufacturer, oui, params, tags, last_inform, updated_at)
    VALUES (?, ?, 'F670L', 'ZTE', '00259E', ?, ?, ?, ?)
  `).run(testTag, testTag, initialParams, JSON.stringify([testTag, testPhone]), new Date().toISOString(), new Date().toISOString());

  // Middleware inject session
  app.use('/customer', (req, res, next) => {
    req.session.phone = testPhone;
    next();
  }, customerPortalRouter);

  server = http.createServer(app);
  server.listen(0, () => {
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    done();
  });
});

afterAll((done) => {
  db.prepare('DELETE FROM customers WHERE id = 999').run();
  db.prepare('DELETE FROM acs_devices WHERE id = ?').run(testTag);
  if (server) {
    server.close(done);
  } else {
    done();
  }
});

describe('Customer Portal WiFi Endpoints End-to-End', () => {
  test('GET /customer/api/wifi/info should return Wi-Fi info', async () => {
    const res = await fetch(`${baseUrl}/customer/api/wifi/info`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.ssid24).toBe('MyAdamedia-Route-Test');
  });

  test('POST /customer/api/wifi/update should update Wi-Fi via AJAX', async () => {
    const res = await fetch(`${baseUrl}/customer/api/wifi/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ssid: 'MyAdamedia-New-SSID',
        password: 'PasswordBaru2026!',
        sync5g: true
      })
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.message).toMatch(/berhasil diperbarui/i);
  });

  test('GET /customer/api/wifi/qr should generate QR data URL', async () => {
    const res = await fetch(`${baseUrl}/customer/api/wifi/qr?ssid=MyAdamedia-New-SSID&password=PasswordBaru2026!`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(data.ssid).toBe('MyAdamedia-New-SSID');
  });
});
