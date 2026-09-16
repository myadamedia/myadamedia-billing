const db = require('../config/database');
const billingSvc = require('../services/billingService');
const customerSvc = require('../services/customerService');

describe('Due Distribution Terminate Customer Exclusion Tests', () => {
  let testPkgId;
  let testCustId;
  const testMonth = 9;
  const testYear = 2026;
  const targetDay = 17;

  beforeAll(() => {
    // 1. Create or get paid test package
    const pkgRes = db.prepare(`
      INSERT INTO packages (name, price, speed_down, speed_up)
      VALUES ('Paket Due Dist Test', 150000, 20000, 20000)
    `).run();
    testPkgId = pkgRes.lastInsertRowid;

    // 2. Create customer with active status and isolate_day = targetDay
    const custRes = db.prepare(`
      INSERT INTO customers (name, phone, email, address, package_id, pppoe_username, pppoe_password, connection_type, status, isolate_day)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Pelanggan Test Due Terminate', '081299990001', 'duetest@example.com', 'Jl. Distribusi No. 17',
      testPkgId, 'test_pppoe_due_01', 'pwd123', 'pppoe', 'active', targetDay
    );
    testCustId = custRes.lastInsertRowid;
  });

  afterAll(() => {
    if (testCustId) {
      db.prepare('DELETE FROM invoices WHERE customer_id = ?').run(testCustId);
      db.prepare('DELETE FROM customers WHERE id = ?').run(testCustId);
    }
    if (testPkgId) {
      db.prepare('DELETE FROM packages WHERE id = ?').run(testPkgId);
    }
  });

  test('Active customer should be included in due distribution summary and details', () => {
    // Check summary
    const summary = billingSvc.getDueDistributionSummary(testMonth, testYear);
    const dayStats = summary.days.find(d => d.day === targetDay);
    expect(dayStats).toBeDefined();
    expect(dayStats.total_customers).toBeGreaterThanOrEqual(1);

    // Check details
    const details = billingSvc.getDueDistributionDetailsByDay(targetDay, testMonth, testYear);
    expect(details.customers).toBeDefined();
    const found = details.customers.some(c => c.id === testCustId);
    expect(found).toBe(true);
  });

  test('Terminated customer (status=terminated) should be strictly EXCLUDED from due distribution', () => {
    // Set status to terminated
    db.prepare("UPDATE customers SET status = 'terminated' WHERE id = ?").run(testCustId);

    // Check details: must NOT contain testCustId
    const details = billingSvc.getDueDistributionDetailsByDay(targetDay, testMonth, testYear);
    const foundInDetails = details.customers.some(c => c.id === testCustId);
    expect(foundInDetails).toBe(false);

    // Check summary
    const summaryAfter = billingSvc.getDueDistributionSummary(testMonth, testYear);
    const dayStatsAfter = summaryAfter.days.find(d => d.day === targetDay);
    expect(dayStatsAfter.total_customers).toBe(details.total_customers);
  });

  test('Customer with status=terminate or status=inactive should also be EXCLUDED', () => {
    // Test status = 'terminate'
    db.prepare("UPDATE customers SET status = 'terminate' WHERE id = ?").run(testCustId);
    let details = billingSvc.getDueDistributionDetailsByDay(targetDay, testMonth, testYear);
    expect(details.customers.some(c => c.id === testCustId)).toBe(false);

    // Test status = 'inactive'
    db.prepare("UPDATE customers SET status = 'inactive' WHERE id = ?").run(testCustId);
    details = billingSvc.getDueDistributionDetailsByDay(targetDay, testMonth, testYear);
    expect(details.customers.some(c => c.id === testCustId)).toBe(false);
  });

  test('Re-activating customer should make them appear back in due distribution', () => {
    db.prepare("UPDATE customers SET status = 'active' WHERE id = ?").run(testCustId);

    const details = billingSvc.getDueDistributionDetailsByDay(targetDay, testMonth, testYear);
    const found = details.customers.some(c => c.id === testCustId);
    expect(found).toBe(true);
  });
});
