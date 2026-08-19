const db = require('../config/database');
const customerSvc = require('../services/customerService');
const mikrotikSvc = require('../services/mikrotikService');
const radiusCoaService = require('../services/radiusCoaService');

describe('Customer Update PPPoE Disconnect Isolation Tests', () => {
  let testCustomerId;

  beforeAll(() => {
    // Insert a dummy package if needed
    let pkg = db.prepare('SELECT id FROM packages LIMIT 1').get();
    let pkgId = pkg ? pkg.id : null;
    if (!pkgId) {
      const res = db.prepare("INSERT INTO packages (name, price, speed_down, speed_up) VALUES ('Paket-Test', 100000, 10000, 10000)").run();
      pkgId = res.lastInsertRowid;
    }

    // Insert dummy customer for testing
    const insert = db.prepare(`
      INSERT INTO customers (name, phone, email, address, package_id, pppoe_username, pppoe_password, connection_type, status, isolate_day, auto_isolate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Pelanggan Test PPPoE', '081234567890', 'test@example.com', 'Jl. Test No. 123',
      pkgId, 'test_pppoe_user_1', 'secret123', 'pppoe', 'active', 10, 1
    );
    testCustomerId = insert.lastInsertRowid;
  });

  afterAll(() => {
    if (testCustomerId) {
      db.prepare('DELETE FROM customers WHERE id=?').run(testCustomerId);
    }
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test('Updating non-status fields (name, phone, address, notes) should NOT kick or disconnect PPPoE session', async () => {
    const kickSpy = jest.spyOn(mikrotikSvc, 'kickPppoeUser').mockResolvedValue(true);
    const quietSpy = jest.spyOn(mikrotikSvc, 'updatePppoeSecretByName').mockResolvedValue(true);
    const coaSpy = jest.spyOn(radiusCoaService, 'disconnectUserByUsername').mockResolvedValue(true);

    const custBefore = customerSvc.getCustomerById(testCustomerId);
    expect(custBefore.status).toBe('active');

    // Update customer name and phone while status remains 'active'
    customerSvc.updateCustomer(testCustomerId, {
      name: 'Pelanggan Test PPPoE Updated',
      phone: '089876543210',
      address: 'Jl. Baru No. 456',
      notes: 'Catatan diperbarui',
      status: 'active',
      pppoe_username: 'test_pppoe_user_1'
    });

    const custAfter = customerSvc.getCustomerById(testCustomerId);
    expect(custAfter.name).toBe('Pelanggan Test PPPoE Updated');
    expect(custAfter.phone).toBe('089876543210');
    expect(custAfter.address).toBe('Jl. Baru No. 456');

    // Verify kickPppoeUser and RADIUS CoA Disconnect were NOT called
    expect(kickSpy).not.toHaveBeenCalled();
    expect(coaSpy).not.toHaveBeenCalled();
  });

  test('Changing status to suspended SHOULD trigger syncCustomerIsolation and notifyCustomerIsolated', async () => {
    const NotificationService = require('../services/notificationService');
    const notifSpy = jest.spyOn(NotificationService, 'notifyCustomerIsolated').mockResolvedValue(true);
    const kickSpy = jest.spyOn(mikrotikSvc, 'kickPppoeUser').mockResolvedValue(true);
    const profileSpy = jest.spyOn(mikrotikSvc, 'setPppoeProfile').mockResolvedValue(true);
    const hookSpy = jest.spyOn(mikrotikSvc, 'ensurePppProfileIsolirAddressListHook').mockResolvedValue(true);
    const coaSpy = jest.spyOn(radiusCoaService, 'disconnectUserByUsername').mockResolvedValue(true);

    customerSvc.updateCustomer(testCustomerId, {
      name: 'Pelanggan Test PPPoE Updated',
      status: 'suspended',
      pppoe_username: 'test_pppoe_user_1'
    });

    const cust = customerSvc.getCustomerById(testCustomerId);
    expect(cust.status).toBe('suspended');

    await new Promise(r => setTimeout(r, 100));

    expect(profileSpy).toHaveBeenCalled();
    expect(kickSpy).toHaveBeenCalled();
    expect(coaSpy).toHaveBeenCalledWith('test_pppoe_user_1');
    expect(notifSpy).toHaveBeenCalledWith(testCustomerId);
  });

  test('Changing status from suspended to active SHOULD trigger syncCustomerActivation', async () => {
    const kickSpy = jest.spyOn(mikrotikSvc, 'kickPppoeUser').mockResolvedValue(true);
    const profileSpy = jest.spyOn(mikrotikSvc, 'setPppoeProfile').mockResolvedValue(true);
    const coaSpy = jest.spyOn(radiusCoaService, 'disconnectUserByUsername').mockResolvedValue(true);

    customerSvc.updateCustomer(testCustomerId, {
      name: 'Pelanggan Test PPPoE Updated',
      status: 'active',
      pppoe_username: 'test_pppoe_user_1'
    });

    const cust = customerSvc.getCustomerById(testCustomerId);
    expect(cust.status).toBe('active');

    await new Promise(r => setTimeout(r, 100));

    expect(profileSpy).toHaveBeenCalled();
    expect(kickSpy).toHaveBeenCalled();
    expect(coaSpy).toHaveBeenCalledWith('test_pppoe_user_1');
  });

  test('Changing status to inactive SHOULD trigger syncCustomerInactivation', async () => {
    const kickSpy = jest.spyOn(mikrotikSvc, 'kickPppoeUser').mockResolvedValue(true);
    const secretSpy = jest.spyOn(mikrotikSvc, 'updatePppoeSecretByName').mockResolvedValue(true);
    const coaSpy = jest.spyOn(radiusCoaService, 'disconnectUserByUsername').mockResolvedValue(true);

    customerSvc.updateCustomer(testCustomerId, {
      name: 'Pelanggan Test PPPoE Updated',
      status: 'inactive',
      pppoe_username: 'test_pppoe_user_1'
    });

    const cust = customerSvc.getCustomerById(testCustomerId);
    expect(cust.status).toBe('inactive');

    await new Promise(r => setTimeout(r, 100));

    expect(secretSpy).toHaveBeenCalledWith('test_pppoe_user_1', { disabled: true }, null);
    expect(kickSpy).toHaveBeenCalledWith('test_pppoe_user_1', null);
    expect(coaSpy).toHaveBeenCalledWith('test_pppoe_user_1');
  });

  test('updatePppoeSecretByName should return false gracefully if username is missing or empty', async () => {
    const res = await mikrotikSvc.updatePppoeSecretByName('', { password: 'new' });
    expect(res).toBe(false);
  });
});
