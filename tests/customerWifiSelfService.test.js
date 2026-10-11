const db = require('../config/database');
const customerDeviceService = require('../services/customerDeviceService');
const QRCode = require('qrcode');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

describe('Customer Portal Self-Service Wi-Fi & QR Code Comprehensive Tests', () => {
  let testCustomerId;
  const testPppoe = 'test_selfservice_wifi_user';
  const testPhone = '081288889999';
  const testDeviceId = 'ZTEG98765432';

  beforeAll(() => {
    // 1. Ensure dummy package
    let pkg = db.prepare('SELECT id FROM packages LIMIT 1').get();
    let pkgId = pkg ? pkg.id : null;
    if (!pkgId) {
      const res = db.prepare("INSERT INTO packages (name, price, speed_down, speed_up) VALUES ('Paket-SelfService', 150000, 20000, 20000)").run();
      pkgId = res.lastInsertRowid;
    }

    // 2. Insert dummy customer
    const custRes = db.prepare(`
      INSERT INTO customers (name, phone, email, address, package_id, pppoe_username, pppoe_password, connection_type, status, genieacs_tag)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Pelanggan Mandiri WiFi', testPhone, 'selfservice@example.com', 'Jl. Mandiri No. 1',
      pkgId, testPppoe, 'secret123', 'pppoe', 'active', testDeviceId
    );
    testCustomerId = custRes.lastInsertRowid;

    // 3. Insert mock device in acs_devices
    const initialParams = JSON.stringify({
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID': { _value: 'MyAdamedia-Default-2.4G' },
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase': { _value: 'defaultpass123' },
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID': { _value: 'MyAdamedia-Default-5G' },
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase': { _value: 'defaultpass123' }
    });

    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO acs_devices (id, serial_number, product_class, manufacturer, oui, params, tags, last_inform, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testDeviceId, testDeviceId, 'F670L', 'ZTE', '00259E',
      initialParams, JSON.stringify([testDeviceId, testPppoe, testPhone]), nowIso, nowIso
    );
  });

  afterAll(() => {
    if (testCustomerId) {
      db.prepare('DELETE FROM customers WHERE id = ?').run(testCustomerId);
    }
    db.prepare('DELETE FROM acs_devices WHERE id = ?').run(testDeviceId);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test('getWifiDetails should return live Wi-Fi configuration and status', async () => {
    const details = await customerDeviceService.getWifiDetails(testDeviceId);
    expect(details).toBeDefined();
    expect(details.ok).toBe(true);
    expect(details.deviceId).toBe(testDeviceId);
    expect(details.ssid24).toBe('MyAdamedia-Default-2.4G');
    expect(details.ssid5g).toBe('MyAdamedia-Default-5G');
    expect(details.model).toBe('F670L');
    expect(details.online).toBe(true);
  });

  test('updateWifiComplete: should update BOTH SSID and Password simultaneously', async () => {
    const newSsid = 'Rumah-Baru-Keluarga';
    const newPass = 'KeluargaBahagia2026!';
    const actor = {
      type: 'customer',
      id: testCustomerId,
      name: 'Pelanggan Mandiri WiFi'
    };

    const res = await customerDeviceService.updateWifiComplete(testDeviceId, {
      ssid: newSsid,
      password: newPass,
      sync5g: true
    }, actor);

    expect(res).toBeDefined();
    expect(res.ok).toBe(true);
    expect(res.changedSsid).toBe(true);
    expect(res.changedPassword).toBe(true);
    expect(res.message).toMatch(/berhasil diperbarui/i);

    // Verify values in database
    const dev = db.prepare('SELECT params FROM acs_devices WHERE id = ?').get(testDeviceId);
    const parsed = JSON.parse(dev.params || '{}');
    expect(parsed['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID']._value).toBe(newSsid);
    expect(parsed['InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID']._value).toBe(`${newSsid}-5G`);
    expect(parsed['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase']._value).toBe(newPass);
    expect(parsed['InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase']._value).toBe(newPass);
  });

  test('updateWifiComplete: should update ONLY SSID when password is omitted', async () => {
    const newSsidOnly = 'Rumah-Saja-Fast';
    const actor = {
      type: 'customer',
      id: testCustomerId,
      name: 'Pelanggan Mandiri WiFi'
    };

    const res = await customerDeviceService.updateWifiComplete(testDeviceId, {
      ssid: newSsidOnly,
      sync5g: true
    }, actor);

    expect(res).toBeDefined();
    expect(res.ok).toBe(true);
    expect(res.changedSsid).toBe(true);
    expect(res.changedPassword).toBe(false);
    expect(res.message).toMatch(/Nama Wi-Fi \(SSID\) berhasil diperbarui/i);

    const dev = db.prepare('SELECT params FROM acs_devices WHERE id = ?').get(testDeviceId);
    const parsed = JSON.parse(dev.params || '{}');
    expect(parsed['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID']._value).toBe(newSsidOnly);
    // Password should remain unchanged
    expect(parsed['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase']._value).toBe('KeluargaBahagia2026!');
  });

  test('updateWifiComplete: should update ONLY Password when SSID is omitted', async () => {
    const newPassOnly = 'SuperPasswordTerbaru99!';
    const actor = {
      type: 'customer',
      id: testCustomerId,
      name: 'Pelanggan Mandiri WiFi'
    };

    const res = await customerDeviceService.updateWifiComplete(testDeviceId, {
      password: newPassOnly
    }, actor);

    expect(res).toBeDefined();
    expect(res.ok).toBe(true);
    expect(res.changedSsid).toBe(false);
    expect(res.changedPassword).toBe(true);
    expect(res.message).toMatch(/Password Wi-Fi berhasil diperbarui/i);

    const dev = db.prepare('SELECT params FROM acs_devices WHERE id = ?').get(testDeviceId);
    const parsed = JSON.parse(dev.params || '{}');
    expect(parsed['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID']._value).toBe('Rumah-Saja-Fast');
    expect(parsed['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase']._value).toBe(newPassOnly);
  });

  test('updateWifiComplete: should reject short password < 8 characters', async () => {
    const actor = {
      type: 'customer',
      id: testCustomerId,
      name: 'Pelanggan Mandiri WiFi'
    };

    const res = await customerDeviceService.updateWifiComplete(testDeviceId, {
      password: '1234'
    }, actor);

    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/minimal 8 karakter/i);
  });

  test('updateWifiComplete: should reject if device token does not exist', async () => {
    const actor = {
      type: 'customer',
      id: 99999,
      name: 'NonExistent'
    };

    const res = await customerDeviceService.updateWifiComplete('NON_EXISTENT_TAG_999', {
      ssid: 'Sample-SSID'
    }, actor);

    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/(Gagal memperbarui|tidak terdeteksi|tidak ditemukan)/i);
  }, 15000);

  test('QR Code generation with QRCode.toDataURL format check', async () => {
    const escapeWifi = (s) => String(s).replace(/([\\;,:"])/g, '\\$1');
    const ssid = 'Rumah-Saja-Fast';
    const password = 'SuperPasswordTerbaru99!';
    const qrString = `WIFI:T:WPA;S:${escapeWifi(ssid)};P:${escapeWifi(password)};;`;

    const dataUrl = await QRCode.toDataURL(qrString, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 8
    });

    expect(dataUrl).toBeDefined();
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(100);
  });

  test('views/dashboard.ejs renders Wi-Fi Self-Service modals and scripts accurately', () => {
    const tplPath = path.join(__dirname, '..', 'views', 'dashboard.ejs');
    const tpl = fs.readFileSync(tplPath, 'utf8');

    const dummyCustomer = {
      id: testCustomerId,
      name: 'Pelanggan Mandiri WiFi',
      phone: testPhone,
      pppoe_username: testPppoe,
      ssid: 'Rumah-Saja-Fast',
      address: 'Jl. Mandiri No. 1',
      current_bill_month: 10,
      current_bill_year: 2026,
      status: 'active'
    };

    const dummyData = {
      customer: dummyCustomer,
      profile: dummyCustomer,
      invoices: [],
      totalUnpaidAmount: 0,
      monthNamesIndo: { 10: 'Oktober' },
      paymentChannels: [],
      unpaidCount: 0,
      speedPackage: '20 Mbps',
      routerStatus: { online: true, model: 'F670L' },
      activeTickets: [],
      connectedDevices: [],
      settings: { company_header: 'MyAdamedia' },
      t: (key, fallback) => fallback || key,
      currentLang: 'id',
      session: { phone: testPhone }
    };

    const rendered = ejs.render(tpl, dummyData, { filename: tplPath });

    // Assert key UI components are present
    expect(rendered).toContain('id="wifiModal"');
    expect(rendered).toContain('id="wifiQrModal"');
    expect(rendered).toContain('Ganti Sekaligus');
    expect(rendered).toContain('Ganti Nama Saja');
    expect(rendered).toContain('Ganti Password Saja');
    expect(rendered).toContain('Acak Password Aman');
    expect(rendered).toContain('pw-strength-meter');
    expect(rendered).toContain('qr-standee-card');
    expect(rendered).toContain('function switchWifiTab');
    expect(rendered).toContain('function handleWifiSubmit');
    expect(rendered).toContain('function openWifiQrModal');
    expect(rendered).toContain('function downloadWifiQrPng');
  });
});
