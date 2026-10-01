const db = require('../config/database');
const billingSvc = require('../services/billingService');

describe('Billing Future Invoice Exclusion Tests', () => {
  let testCustomerId = null;
  let testPackageId = null;

  beforeAll(() => {
    // Buat dummy package
    const pkgResult = db.prepare(`
      INSERT INTO packages (name, price, speed_down, speed_up)
      VALUES (?, ?, ?, ?)
    `).run('Paket-Test-Future-Exclusion', 150000, 20, 20);
    testPackageId = pkgResult.lastInsertRowid;

    // Buat dummy customer
    const custResult = db.prepare(`
      INSERT INTO customers (name, phone, package_id, status, isolate_day)
      VALUES (?, ?, ?, ?, ?)
    `).run('Pelanggan Future Test', '081299990002', testPackageId, 'active', 10);
    testCustomerId = custResult.lastInsertRowid;
  });

  afterAll(() => {
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

  test('should NOT combine next month invoice when both current and next month are generated (current=9, next=10)', () => {
    // Bulan berjalan: 9/2026 (150.000)
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 9, 2026, 150000, 0, 150000, 'unpaid');

    // Bulan berikutnya yang sudah digenerate duluan: 10/2026 (150.000)
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 10, 2026, 150000, 0, 150000, 'unpaid');

    // As of September 2026
    const asOfSep = new Date(2026, 8, 20); // Bulan 9 (0-indexed = 8)
    const summary = billingSvc.getCustomerBillingSummary(testCustomerId, { asOfDate: asOfSep });

    // Harus HANYA memuat tagihan bulan berjalan (9/2026), tidak menggabungkan bulan berikutnya (10/2026)
    expect(summary.totalTagihan).toBe(150000);
    expect(summary.tagihanBerjalan).toBe(150000);
    expect(summary.sisaLalu).toBe(0);
    expect(summary.rincianBulan).toBe('9/2026');
    expect(summary.unpaidInvoices.length).toBe(1);
    expect(summary.futureInvoices.length).toBe(1);
    expect(summary.futureInvoices[0].period_month).toBe(10);
  });

  test('should combine current month (9) and previous month (8), but EXCLUDE next month (10)', () => {
    // Bulan sebelumnya (tunggakan): 8/2026 (150.000)
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 8, 2026, 150000, 0, 150000, 'unpaid');

    // Bulan berjalan: 9/2026 (150.000)
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 9, 2026, 150000, 0, 150000, 'unpaid');

    // Bulan berikutnya (advance billing): 10/2026 (150.000)
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 10, 2026, 150000, 0, 150000, 'unpaid');

    const asOfSep = new Date(2026, 8, 25);
    const summary = billingSvc.getCustomerBillingSummary(testCustomerId, { asOfDate: asOfSep });

    // Total tagihan: 150.000 (Bulan 8) + 150.000 (Bulan 9) = 300.000
    // Bulan 10 (150.000) TIDAK BOLEH digabungkan!
    expect(summary.totalTagihan).toBe(300000);
    expect(summary.tagihanBerjalan).toBe(150000);
    expect(summary.sisaLalu).toBe(150000);
    expect(summary.rincianBulan).toBe('8/2026, 9/2026');
    expect(summary.rincianBulan).not.toContain('10/2026');
    expect(summary.unpaidInvoices.length).toBe(2);
    expect(summary.futureInvoices.length).toBe(1);
    expect(summary.futureInvoices[0].period_month).toBe(10);
  });

  test('should return 0 tagihan if current & past months are paid, even if next month is generated', () => {
    // Bulan 9/2026 sudah LUNAS
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 9, 2026, 150000, 150000, 0, 'paid');

    // Bulan 10/2026 sudah ter-generate tapi masih di masa depan
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 10, 2026, 150000, 0, 150000, 'unpaid');

    const asOfSep = new Date(2026, 8, 25);
    const summary = billingSvc.getCustomerBillingSummary(testCustomerId, { asOfDate: asOfSep });

    // Karena bulan berjalan & lampau sudah lunas, sistem tidak boleh menagih tagihan bulan depan
    expect(summary.totalTagihan).toBe(0);
    expect(summary.tagihanBerjalan).toBe(0);
    expect(summary.sisaLalu).toBe(0);
    expect(summary.unpaidInvoices.length).toBe(0);
    expect(summary.hasArrears).toBe(false);
    expect(summary.futureInvoices.length).toBe(1);
  });

  test('should include future invoice only when includeFuture: true is explicitly requested', () => {
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 9, 2026, 150000, 0, 150000, 'unpaid');

    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 10, 2026, 150000, 0, 150000, 'unpaid');

    const asOfSep = new Date(2026, 8, 20);
    const summary = billingSvc.getCustomerBillingSummary(testCustomerId, { asOfDate: asOfSep, includeFuture: true });

    expect(summary.totalTagihan).toBe(300000);
    expect(summary.unpaidInvoices.length).toBe(2);
    expect(summary.rincianBulan).toContain('9/2026');
    expect(summary.rincianBulan).toContain('10/2026');
  });

  test('should use targetInvoice as cutoff when admin explicitly sends a specific invoice', () => {
    // Bulan 9 (150.000)
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 9, 2026, 150000, 0, 150000, 'unpaid');

    // Bulan 10 (150.000)
    const inv10Res = db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 10, 2026, 150000, 0, 150000, 'unpaid');

    // Bulan 11 (150.000)
    db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testCustomerId, 11, 2026, 150000, 0, 150000, 'unpaid');

    // Admin memilih mengirim invoice bulan 10
    const inv10 = { id: inv10Res.lastInsertRowid, period_month: 10, period_year: 2026 };
    const summary = billingSvc.getCustomerBillingSummary(testCustomerId, { targetInvoice: inv10 });

    // Bulan 9 (150k) + Bulan 10 (150k) = 300k. Bulan 11 TIDAK digabungkan.
    expect(summary.totalTagihan).toBe(300000);
    expect(summary.tagihanBerjalan).toBe(150000);
    expect(summary.sisaLalu).toBe(150000);
    expect(summary.rincianBulan).toBe('9/2026, 10/2026');
    expect(summary.rincianBulan).not.toContain('11/2026');
    expect(summary.futureInvoices.length).toBe(1);
    expect(summary.futureInvoices[0].period_month).toBe(11);
  });
});
