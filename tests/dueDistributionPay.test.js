const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const billingSvc = require('../services/billingService');

describe('Due Distribution Tandai Lunas Tests', () => {
  const ejsPath = path.join(__dirname, '..', 'views', 'admin', 'billing_due_distribution.ejs');
  const routesPath = path.join(__dirname, '..', 'routes', 'adminPortal.js');

  let testPkgId;
  let testCustId;
  let testInvoiceId;
  const testMonth = 10;
  const testYear = 2026;
  const targetDay = 22;

  beforeAll(() => {
    // 1. Create test package
    const pkgRes = db.prepare(`
      INSERT INTO packages (name, price, speed_down, speed_up)
      VALUES ('Paket Test Tandai Lunas', 175000, 20000, 20000)
    `).run();
    testPkgId = pkgRes.lastInsertRowid;

    // 2. Create customer with isolate_day = targetDay
    const custRes = db.prepare(`
      INSERT INTO customers (name, phone, email, address, package_id, pppoe_username, pppoe_password, connection_type, status, isolate_day)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Pelanggan Test Lunas', '081299990888', 'testlunas@example.com', 'Jl. Sukses Selalu No. 22',
      testPkgId, 'test_pppoe_lunas_22', 'pass123', 'pppoe', 'active', targetDay
    );
    testCustId = custRes.lastInsertRowid;

    // 3. Create unpaid invoice for the customer
    const invRes = db.prepare(`
      INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
      VALUES (?, ?, ?, ?, 0, ?, 'unpaid')
    `).run(testCustId, testMonth, testYear, 175000, 175000);
    testInvoiceId = invRes.lastInsertRowid;
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

  test('billing_due_distribution.ejs should include Tandai Lunas button and duePayModal', () => {
    const ejsContent = fs.readFileSync(ejsPath, 'utf8');

    // 1. Tombol Tandai Lunas di kolom aksi
    expect(ejsContent).toContain('due-pay-btn');
    expect(ejsContent).toContain('title="Tandai Lunas"');
    expect(ejsContent).toContain('data-customer-id');
    expect(ejsContent).toContain('data-invoice-id');

    // 2. Modal Konfirmasi Pelunasan
    expect(ejsContent).toContain('id="duePayModal"');
    expect(ejsContent).toContain('id="duePayCustomerName"');
    expect(ejsContent).toContain('id="duePayAmountText"');
    expect(ejsContent).toContain('id="duePayByName"');
    expect(ejsContent).toContain('id="duePayNotes"');
    expect(ejsContent).toContain('id="duePaySubmitBtn"');

    // 3. Skrip AJAX interaktif
    expect(ejsContent).toContain('function openDuePayModal(');
    expect(ejsContent).toContain('async function submitDuePayment(');
    expect(ejsContent).toContain('/admin/billing/due-distribution/pay');
  });

  test('routes/adminPortal.js should define POST /billing/due-distribution/pay route', () => {
    const routesContent = fs.readFileSync(routesPath, 'utf8');
    expect(routesContent).toContain("router.post('/billing/due-distribution/pay'");
    expect(routesContent).toContain('billingSvc.markAsPaid');
    expect(routesContent).toContain('billingSvc.payInvoiceForCustomerPeriod');
  });

  test('billingService should correctly process payment and reflect on getDueDistributionDetailsByDay', () => {
    // Verifikasi awal: status harus unpaid
    let details = billingSvc.getDueDistributionDetailsByDay(targetDay, testMonth, testYear);
    let custItem = details.customers.find(c => c.id === testCustId);
    expect(custItem).toBeDefined();
    expect(custItem.status).toBe('unpaid');
    expect(custItem.unpaid_amount).toBe(175000);

    // Jalankan pelunasan
    billingSvc.markAsPaid(testInvoiceId, 'Kasir Admin Testing', 'Lunas via Due Distribution');

    // Verifikasi setelah pelunasan: status harus paid
    details = billingSvc.getDueDistributionDetailsByDay(targetDay, testMonth, testYear);
    custItem = details.customers.find(c => c.id === testCustId);
    expect(custItem).toBeDefined();
    expect(custItem.status).toBe('paid');
    expect(custItem.unpaid_amount).toBe(0);
    expect(custItem.paid_amount).toBe(175000);

    // Verifikasi invoice di DB
    const inv = db.prepare('SELECT status, paid_by_name, notes FROM invoices WHERE id = ?').get(testInvoiceId);
    expect(inv.status).toBe('paid');
    expect(inv.paid_by_name).toBe('Kasir Admin Testing');
    expect(inv.notes).toBe('Lunas via Due Distribution');
  });
});
