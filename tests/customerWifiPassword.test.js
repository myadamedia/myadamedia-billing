const db = require('../config/database');
const customerDeviceService = require('../services/customerDeviceService');

describe('Customer Portal WiFi Password and SSID Update Tests', () => {
  let testCustomerId;
  const testPppoe = 'test_wifi_user_99';
  const testPhone = '081299887766';
  const testDeviceId = 'ZTEG12345678';

  beforeAll(() => {
    // 1. Insert dummy package if not exists
    let pkg = db.prepare('SELECT id FROM packages LIMIT 1').get();
    let pkgId = pkg ? pkg.id : null;
    if (!pkgId) {
      const res = db.prepare("INSERT INTO packages (name, price, speed_down, speed_up) VALUES ('Paket-Test-Wifi', 150000, 20000, 20000)").run();
      pkgId = res.lastInsertRowid;
    }

    // 2. Insert dummy customer with genieacs_tag
    const custRes = db.prepare(`
      INSERT INTO customers (name, phone, email, address, package_id, pppoe_username, pppoe_password, connection_type, status, genieacs_tag)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Pelanggan Test Wifi', testPhone, 'testwifi@example.com', 'Jl. Wifi No. 88',
      pkgId, testPppoe, 'secret123', 'pppoe', 'active', testDeviceId
    );
    testCustomerId = custRes.lastInsertRowid;

    // 3. Insert mock device into acs_devices table (Built-in ACS format)
    const initialParams = JSON.stringify({
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID': { _value: 'MyAdamedia-Old-2.4G' },
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase': { _value: 'oldpassword123' },
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID': { _value: 'MyAdamedia-Old-5G' },
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase': { _value: 'oldpassword123' }
    });

    db.prepare(`
      INSERT OR REPLACE INTO acs_devices (id, serial_number, product_class, manufacturer, oui, params, tags, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testDeviceId, testDeviceId, 'F670L', 'ZTE', '00259E',
      initialParams, JSON.stringify([testDeviceId, testPppoe, testPhone]), new Date().toISOString()
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

  test('resolveDeviceToken should resolve device using PPPoE username or genieacs_tag', async () => {
    const tokenByPppoe = await customerDeviceService.resolveDeviceToken([testPppoe]);
    expect(tokenByPppoe).toBeDefined();
    expect(tokenByPppoe._id).toBe(testDeviceId);

    const tokenByTag = await customerDeviceService.resolveDeviceToken([testDeviceId]);
    expect(tokenByTag).toBeDefined();
    expect(tokenByTag._id).toBe(testDeviceId);

    const tokenByPhone = await customerDeviceService.resolveDeviceToken([testPhone]);
    expect(tokenByPhone).toBeDefined();
    expect(tokenByPhone._id).toBe(testDeviceId);
  });

  test('updateSSID should update SSID in built-in ACS storage without TR-069 path conflicts', async () => {
    const newSSID = 'MyAdamedia-Home-Fast';
    const result = await customerDeviceService.updateSSID(testDeviceId, newSSID, {
      type: 'customer',
      id: testCustomerId,
      name: 'Pelanggan Test Wifi'
    });

    expect(result).toBe(true);

    // Verify database params were updated in SQLite acs_devices
    const dev = db.prepare('SELECT params FROM acs_devices WHERE id = ?').get(testDeviceId);
    const parsedParams = JSON.parse(dev.params || '{}');
    expect(parsedParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID']._value).toBe(newSSID);
    expect(parsedParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID']._value).toBe(`${newSSID}-5G`);
  });

  test('updatePassword should update WiFi password in built-in ACS storage and set parameter values correctly', async () => {
    const newPassword = 'SuperSecretWifiPass2026!';
    const result = await customerDeviceService.updatePassword(testDeviceId, newPassword, {
      type: 'customer',
      id: testCustomerId,
      name: 'Pelanggan Test Wifi'
    });

    expect(result).toBe(true);

    // Verify database params were updated in SQLite acs_devices
    const dev = db.prepare('SELECT params FROM acs_devices WHERE id = ?').get(testDeviceId);
    const parsedParams = JSON.parse(dev.params || '{}');
    expect(parsedParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase']._value).toBe(newPassword);
    expect(parsedParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase']._value).toBe(newPassword);
  });

  test('updatePassword for TR-181 data model should resolve TR-181 WiFi AccessPoint parameters', async () => {
    const tr181DeviceId = 'TR181_TEST_ONT_01';
    const tr181Params = JSON.stringify({
      'Device.WiFi.SSID.1.SSID': { _value: 'TR181-Old-SSID' },
      'Device.WiFi.AccessPoint.1.Security.KeyPassphrase': { _value: 'oldpass123' }
    });

    db.prepare(`
      INSERT OR REPLACE INTO acs_devices (id, serial_number, product_class, manufacturer, oui, params, tags, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tr181DeviceId, tr181DeviceId, 'HG8245W5', 'Huawei', '00259E',
      tr181Params, JSON.stringify(['tr181_user']), new Date().toISOString()
    );

    try {
      const passResult = await customerDeviceService.updatePassword(tr181DeviceId, 'NewSecurePass2026', {
        type: 'customer',
        name: 'TR181 Customer'
      });
      expect(passResult).toBe(true);

      const dev = db.prepare('SELECT params FROM acs_devices WHERE id = ?').get(tr181DeviceId);
      const parsed = JSON.parse(dev.params || '{}');
      expect(parsed['Device.WiFi.AccessPoint.1.Security.KeyPassphrase']._value).toBe('NewSecurePass2026');
    } finally {
      db.prepare('DELETE FROM acs_devices WHERE id = ?').run(tr181DeviceId);
    }
  });

  test('updateSSID and updatePassword should fail gracefully when device does not exist or password is too short', async () => {
    const nonExistentId = 'NON_EXISTENT_DEVICE_999999';
    const ssidRes = await customerDeviceService.updateSSID(nonExistentId, 'ValidSSID');
    expect(ssidRes).toBe(false);

    const passRes = await customerDeviceService.updatePassword(nonExistentId, 'ValidPassword123');
    expect(passRes).toBe(false);

    const shortPassRes = await customerDeviceService.updatePassword(testDeviceId, 'short');
    expect(shortPassRes).toBe(false);
  });
});
