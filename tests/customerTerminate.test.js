const db = require('../config/database');
const customerSvc = require('../services/customerService');

describe('Customer Terminate Status Tests', () => {
  let testCustId;
  const testPppoe = 'test_terminate_user_01';
  const testPhone = '081288889999';

  beforeAll(() => {
    // 1. Ensure a package exists
    let pkg = db.prepare('SELECT id FROM packages LIMIT 1').get();
    let pkgId = pkg ? pkg.id : null;
    if (!pkgId) {
      const res = db.prepare("INSERT INTO packages (name, price, speed_down, speed_up) VALUES ('Paket-Test-Term', 100000, 10000, 10000)").run();
      pkgId = res.lastInsertRowid;
    }

    // 2. Insert test customer with active status
    const custRes = db.prepare(`
      INSERT INTO customers (name, phone, email, address, package_id, pppoe_username, pppoe_password, connection_type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Pelanggan Test Terminate', testPhone, 'testterm@example.com', 'Jl. Terminate No. 1',
      pkgId, testPppoe, 'secretterm', 'pppoe', 'active'
    );
    testCustId = custRes.lastInsertRowid;
  });

  afterAll(() => {
    if (testCustId) {
      db.prepare('DELETE FROM customers WHERE id = ?').run(testCustId);
    }
  });

  test('getCustomerStats should return terminated count', () => {
    const stats = customerSvc.getCustomerStats();
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('active');
    expect(stats).toHaveProperty('suspended');
    expect(stats).toHaveProperty('terminated');
    expect(typeof stats.terminated).toBe('number');
  });

  test('updateCustomer should transition customer from active to terminated', () => {
    const cust = customerSvc.getCustomerById(testCustId);
    expect(cust.status).toBe('active');

    const initialStats = customerSvc.getCustomerStats();

    customerSvc.updateCustomer(testCustId, {
      ...cust,
      status: 'terminated'
    });

    const updatedCust = customerSvc.getCustomerById(testCustId);
    expect(updatedCust.status).toBe('terminated');

    const updatedStats = customerSvc.getCustomerStats();
    expect(updatedStats.terminated).toBe(initialStats.terminated + 1);
  });

  test('terminateCustomer helper should update customer status to terminated', async () => {
    // Set to active first
    await customerSvc.activateCustomer(testCustId);
    let cust = customerSvc.getCustomerById(testCustId);
    expect(cust.status).toBe('active');

    // Terminate
    await customerSvc.terminateCustomer(testCustId);
    cust = customerSvc.getCustomerById(testCustId);
    expect(cust.status).toBe('terminated');
  });

  test('activateCustomer helper should re-activate a terminated customer', async () => {
    await customerSvc.activateCustomer(testCustId);
    const cust = customerSvc.getCustomerById(testCustId);
    expect(cust.status).toBe('active');
  });
});
