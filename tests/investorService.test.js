const db = require('../config/database');
const investorService = require('../investor/services/investorService');

describe('Investor Service Financial & Customer Analytics Tests', () => {
  let freePkgId;
  let paidPkgId;
  let freeCustId;
  let paidCustId;

  beforeAll(() => {
    // Create a Free Package and a Paid Package
    const resFree = db.prepare("INSERT INTO packages (name, price, speed_down, speed_up) VALUES ('PROMO-FREE-10M', 0, 10000, 10000)").run();
    freePkgId = resFree.lastInsertRowid;

    const resPaid = db.prepare("INSERT INTO packages (name, price, speed_down, speed_up) VALUES ('REGULAR-20M', 200000, 20000, 20000)").run();
    paidPkgId = resPaid.lastInsertRowid;

    // Create a Free Customer
    const resCustFree = db.prepare(`
      INSERT INTO customers (name, phone, package_id, status, pppoe_username, connection_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('Pelanggan Free Demo', '081111111111', freePkgId, 'active', 'free_user_demo', 'pppoe');
    freeCustId = resCustFree.lastInsertRowid;

    // Create a Paid Customer
    const resCustPaid = db.prepare(`
      INSERT INTO customers (name, phone, package_id, status, pppoe_username, connection_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('Pelanggan Regular Paid', '082222222222', paidPkgId, 'active', 'paid_user_demo', 'pppoe');
    paidCustId = resCustPaid.lastInsertRowid;
  });

  afterAll(() => {
    if (freeCustId) db.prepare('DELETE FROM customers WHERE id=?').run(freeCustId);
    if (paidCustId) db.prepare('DELETE FROM customers WHERE id=?').run(paidCustId);
    if (freePkgId) db.prepare('DELETE FROM packages WHERE id=?').run(freePkgId);
    if (paidPkgId) db.prepare('DELETE FROM packages WHERE id=?').run(paidPkgId);
  });

  test('getExecutiveSummary should return accurate activeCustomers and freeCustomers metrics', () => {
    const summary = investorService.getExecutiveSummary('this_month');

    expect(typeof summary.totalCustomers).toBe('number');
    expect(typeof summary.activeCustomers).toBe('number');
    expect(typeof summary.freeCustomers).toBe('number');
    expect(typeof summary.freePsbThisMonth).toBe('number');
    expect(typeof summary.psbThisMonth).toBe('number');

    expect(summary.freeCustomers).toBeGreaterThanOrEqual(1);
    expect(summary.freePsbThisMonth).toBeGreaterThanOrEqual(1);
  });

  test('getMapData should include freeCustomers in stats', () => {
    const mapData = investorService.getMapData();

    expect(mapData).toHaveProperty('stats');
    expect(typeof mapData.stats.freeCustomers).toBe('number');
    expect(typeof mapData.stats.activeCustomers).toBe('number');
  });

  test('formatRp should format numbers into Indonesian Rupiah currency string', () => {
    expect(investorService.formatRp(250000)).toMatch(/Rp.*250\.000/);
    expect(investorService.formatRp(0)).toMatch(/Rp.*0/);
  });
});
