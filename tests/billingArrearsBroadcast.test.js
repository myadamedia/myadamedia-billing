const db = require('../config/database');
const billingSvc = require('../services/billingService');
const customerSvc = require('../services/customerService');

describe('Billing Arrears and WhatsApp Broadcast Integration Tests', () => {
  let testCustomerId = null;
  let testPackageId = null;

  beforeAll(() => {
    // Create a dummy package
    const pkgResult = db.prepare(`
      INSERT INTO packages (name, price, speed_down, speed_up)
      VALUES (?, ?, ?, ?)
    `).run('Paket-Test-Arrears', 150000, 20, 20);
    testPackageId = pkgResult.lastInsertRowid;

    // Create a dummy customer
    const custResult = db.prepare(`
      INSERT INTO customers (name, phone, package_id, status, isolate_day)
      VALUES (?, ?, ?, ?, ?)
    `).run('Pelanggan Tunggakan Test', '081299990001', testPackageId, 'active', 10);
    testCustomerId = custResult.lastInsertRowid;
  });

  afterAll(() => {
    // Clean up created test data
    if (testCustomerId) {
      db.prepare('DELETE FROM invoices WHERE customer_id = ?').run(testCustomerId);
      db.prepare('DELETE FROM customers WHERE id = ?').run(testCustomerId);
    }
    if (testPackageId) {
      db.prepare('DELETE FROM packages WHERE id = ?').run(testPackageId);
    }
  });

  beforeEach(() => {
    db.prepare('DELETE FROM invoices WHERE customer_id = ?').run(testCustomerId);
  });

  test('should return empty summary when customer has no unpaid invoices', () => {
    const summary = billingSvc.getCustomerBillingSummary(testCustomerId);
    expect(summary.totalTagihan).toBe(0);
    expect(summary.sisaLalu).toBe(0);
    expect(summary.unpaidInvoices.length).toBe(0);
    expect(summary.hasArrears).toBe(false);
  });

  test('should include partial invoices in getUnpaidInvoicesByCustomerId and getCustomerBillingSummary', () => {
    // Create a partial invoice from month 7 (previous month)
    // Total 150.000, paid 100.000, remaining balance_due 50.000
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 7, 2026, 150000, 100000, 50000, 'partial');

    const unpaidList = billingSvc.getUnpaidInvoicesByCustomerId(testCustomerId);
    expect(unpaidList.length).toBe(1);
    expect(unpaidList[0].status).toBe('partial');
    expect(unpaidList[0].balance_due).toBe(50000);

    const summary = billingSvc.getCustomerBillingSummary(testCustomerId);
    expect(summary.totalTagihan).toBe(50000);
    expect(summary.sisaLalu).toBe(50000);
    expect(summary.rincianBulan).toBe('7/2026');
    expect(summary.hasArrears).toBe(true);
  });

  test('should automatically add previous month partial arrears to current month bill', () => {
    // Month 7: Partial invoice (remaining due: 50.000)
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, carried_balance, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 7, 2026, 150000, 100000, 50000, 0, 'partial');

    // Month 8: Current month unpaid invoice (package amount: 150.000, carried_balance: 50.000)
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, carried_balance, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 8, 2026, 150000, 0, 150000, 50000, 'unpaid');

    const unpaidList = billingSvc.getUnpaidInvoicesByCustomerId(testCustomerId);
    expect(unpaidList.length).toBe(2);

    const summary = billingSvc.getCustomerBillingSummary(testCustomerId);
    // Total should automatically be 50.000 (Month 7) + 150.000 (Month 8) = 200.000
    expect(summary.totalTagihan).toBe(200000);
    expect(summary.sisaLalu).toBe(50000);
    expect(summary.rincianBulan).toBe('7/2026, 8/2026');
    expect(summary.hasArrears).toBe(true);
  });

  test('should correctly format WhatsApp broadcast message with {{tagihan}}, {{sisa_lalu}}, and {{rincian_sisa}}', () => {
    // Setup partial arrears (Rp 60.000) + current invoice (Rp 150.000)
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 7, 2026, 150000, 90000, 60000, 'partial');

    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, carried_balance, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 8, 2026, 150000, 0, 150000, 60000, 'unpaid');

    const summary = billingSvc.getCustomerBillingSummary(testCustomerId);
    expect(summary.totalTagihan).toBe(210000);
    expect(summary.sisaLalu).toBe(60000);

    const template = 'Yth. {{nama}},\nTagihan: Rp {{tagihan}}\n{{rincian_sisa}}Periode: {{rincian}}';
    const rincianSisaText = summary.sisaLalu > 0 
      ? `📌 *Termasuk Sisa Tagihan Bulan Lalu:* Rp ${summary.sisaLalu.toLocaleString('id-ID')}\n`
      : '';

    const formatted = template
      .replace(/{{nama}}/gi, 'Budi')
      .replace(/{{tagihan}}/gi, summary.totalTagihan.toLocaleString('id-ID'))
      .replace(/{{sisa_lalu}}/gi, summary.sisaLalu.toLocaleString('id-ID'))
      .replace(/{{rincian_sisa}}/gi, rincianSisaText)
      .replace(/{{rincian}}/gi, summary.rincianBulan);

    expect(formatted).toContain('Tagihan: Rp 210.000');
    expect(formatted).toContain('Termasuk Sisa Tagihan Bulan Lalu:* Rp 60.000');
    expect(formatted).toContain('Periode: 7/2026, 8/2026');
  });

  test('should reflect partial invoices in customerService.getAllCustomers unpaid_count and unpaid_total', () => {
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 7, 2026, 150000, 100000, 50000, 'partial');

    const all = customerSvc.getAllCustomers('Pelanggan Tunggakan Test');
    expect(all.length).toBe(1);
    expect(all[0].unpaid_count).toBe(1);
    expect(all[0].unpaid_total).toBe(50000);
  });

  test('should strictly display shortfall (balance_due / yang kurang), never display paid_amount (yang sudah dibayar)', () => {
    // Pelanggan bayar parsial 100.000 dari 150.000 -> sisa yang kurang adalah 50.000
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, carried_balance, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 7, 2026, 150000, 100000, 50000, 0, 'partial');

    // Invoice bulan berjalan 150.000
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, carried_balance, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 8, 2026, 150000, 0, 150000, 0, 'unpaid');

    const summary = billingSvc.getCustomerBillingSummary(testCustomerId);
    
    // Tagihan yang kurang dari bulan lalu: 50.000 (BUKAN 100.000 yang sudah dibayar)
    expect(summary.sisaLalu).toBe(50000);
    expect(summary.sisaLalu).not.toBe(100000);

    // Total tagihan: 150.000 + 50.000 = 200.000 (BUKAN 250.000 hasil penambahan 100.000 yang sudah dibayar)
    expect(summary.totalTagihan).toBe(200000);
    expect(summary.totalTagihan).not.toBe(250000);

    // Pastikan tagihan periode berjalan adalah 150.000
    expect(summary.tagihanBerjalan).toBe(150000);
  });
});
