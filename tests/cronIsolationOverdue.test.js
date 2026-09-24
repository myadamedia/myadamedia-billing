const db = require('../config/database');
const billingSvc = require('../services/billingService');
const customerSvc = require('../services/customerService');
const isolatedPortalSvc = require('../services/isolatedPortalService');

describe('Cron Job & Billing Overdue Isolation Tests', () => {
  let testCustomerId = null;
  let packageId = null;

  beforeAll(() => {
    // Setup dummy package if needed
    const pkg = db.prepare('SELECT id FROM packages LIMIT 1').get();
    if (pkg) {
      packageId = pkg.id;
    } else {
      const ins = db.prepare("INSERT INTO packages (name, price) VALUES ('Test Pack', 100000)").run();
      packageId = ins.lastInsertRowid;
    }
  });

  afterEach(() => {
    if (testCustomerId) {
      db.prepare('DELETE FROM invoices WHERE customer_id = ?').run(testCustomerId);
      db.prepare('DELETE FROM customers WHERE id = ?').run(testCustomerId);
      testCustomerId = null;
    }
  });

  describe('getCustomerDueDay', () => {
    test('should return customer.isolate_day when set', () => {
      const c = { isolate_day: 15 };
      expect(billingSvc.getCustomerDueDay(c)).toBe(15);
    });

    test('should fallback to install_date day when isolate_day is missing or invalid', () => {
      const c = { isolate_day: null, install_date: '2026-05-18' };
      expect(billingSvc.getCustomerDueDay(c)).toBe(18);
    });

    test('should fallback to settings.isolir_day (default 20) when both isolate_day and install_date are absent', () => {
      const c = { isolate_day: null, install_date: null };
      const dueDay = billingSvc.getCustomerDueDay(c);
      expect(dueDay).toBeGreaterThanOrEqual(1);
      expect(dueDay).toBeLessThanOrEqual(31);
      expect(dueDay).toBe(20); // settings.json isolir_day is 20
    });
  });

  describe('isInvoiceOverdue', () => {
    test('should return false for paid invoices', () => {
      const inv = { status: 'paid', amount: 100000, paid_amount: 100000, period_month: 9, period_year: 2026 };
      const cust = { isolate_day: 20 };
      const now = new Date(2026, 8, 25); // 25 Sept 2026
      expect(billingSvc.isInvoiceOverdue(inv, cust, now)).toBe(false);
    });

    test('should return false for future month invoices (Advance Billing)', () => {
      const inv = { status: 'unpaid', amount: 100000, paid_amount: 0, balance_due: 100000, period_month: 10, period_year: 2026 };
      const cust = { isolate_day: 20 };
      const now = new Date(2026, 8, 24); // 24 Sept 2026 (Month 9)
      // Even though today (24) >= isolate_day (20), invoice is for October (Month 10), so NOT overdue
      expect(billingSvc.isInvoiceOverdue(inv, cust, now)).toBe(false);
    });

    test('should return false for future year invoices', () => {
      const inv = { status: 'unpaid', amount: 100000, paid_amount: 0, balance_due: 100000, period_month: 1, period_year: 2027 };
      const cust = { isolate_day: 10 };
      const now = new Date(2026, 8, 24);
      expect(billingSvc.isInvoiceOverdue(inv, cust, now)).toBe(false);
    });

    test('should return true for past month invoices (Arrears from August in September)', () => {
      const inv = { status: 'unpaid', amount: 100000, paid_amount: 0, balance_due: 100000, period_month: 8, period_year: 2026 };
      const cust = { isolate_day: 25 };
      const now = new Date(2026, 8, 5); // 5 Sept 2026
      // Today is only day 5, customer isolate_day is 25, but invoice is from August -> OVERDUE
      expect(billingSvc.isInvoiceOverdue(inv, cust, now)).toBe(true);
    });

    test('should return false for current month invoice before due date', () => {
      const inv = { status: 'unpaid', amount: 100000, paid_amount: 0, balance_due: 100000, period_month: 9, period_year: 2026 };
      const cust = { isolate_day: 20 };
      const now = new Date(2026, 8, 12); // 12 Sept 2026
      expect(billingSvc.isInvoiceOverdue(inv, cust, now)).toBe(false);
    });

    test('should return true for current month invoice on or after due date', () => {
      const inv = { status: 'unpaid', amount: 100000, paid_amount: 0, balance_due: 100000, period_month: 9, period_year: 2026 };
      const cust = { isolate_day: 20 };
      const onDueDate = new Date(2026, 8, 20); // 20 Sept 2026
      const afterDueDate = new Date(2026, 8, 24); // 24 Sept 2026
      expect(billingSvc.isInvoiceOverdue(inv, cust, onDueDate)).toBe(true);
      expect(billingSvc.isInvoiceOverdue(inv, cust, afterDueDate)).toBe(true);
    });

    test('should return false for newly installed customer in current month after due date', () => {
      const inv = { status: 'unpaid', amount: 50000, paid_amount: 0, balance_due: 50000, period_month: 9, period_year: 2026 };
      // Customer installed on 15 Sept 2026, but isolate_day is 10
      const cust = { isolate_day: 10, install_date: '2026-09-15' };
      const now = new Date(2026, 8, 16); // 16 Sept 2026
      // Because install_date (15) > dueDay (10), initial invoice cannot be overdue in the same month
      expect(billingSvc.isInvoiceOverdue(inv, cust, now)).toBe(false);
    });
  });

  describe('isCustomerOverdue and syncAllOverdueCustomers integration', () => {
    test('should NOT mark customer as overdue when customer only has next month invoice', () => {
      // 1. Create active customer with isolate_day = 20
      const res = db.prepare(`
        INSERT INTO customers (name, phone, package_id, status, isolate_day, auto_isolate)
        VALUES ('Test Future Cust', '081234567890', ?, 'active', 20, 1)
      `).run(packageId);
      testCustomerId = res.lastInsertRowid;

      // 2. Create invoice for next month (Month 10 / 2026)
      db.prepare(`
        INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
        VALUES (?, 10, 2026, 150000, 0, 150000, 'unpaid')
      `).run(testCustomerId);

      // Now is 24 September 2026 (day 24 >= isolate_day 20)
      const now = new Date(2026, 8, 24);

      // Verify isCustomerOverdue
      expect(billingSvc.isCustomerOverdue(testCustomerId, now)).toBe(false);

      // Verify syncAllOverdueCustomers does NOT isolate this customer
      const syncRes = isolatedPortalSvc.syncAllOverdueCustomers();
      const updatedCust = db.prepare('SELECT status FROM customers WHERE id = ?').get(testCustomerId);
      expect(updatedCust.status).toBe('active');
    });

    test('should mark customer as overdue and isolate when past due date in current month', async () => {
      // 1. Create active customer with isolate_day = 20
      const res = db.prepare(`
        INSERT INTO customers (name, phone, package_id, status, isolate_day, auto_isolate)
        VALUES ('Test Overdue Cust', '081234567891', ?, 'active', 20, 1)
      `).run(packageId);
      testCustomerId = res.lastInsertRowid;

      // 2. Create invoice for Month 9 / 2026
      db.prepare(`
        INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
        VALUES (?, 9, 2026, 150000, 0, 150000, 'unpaid')
      `).run(testCustomerId);

      // Now is 24 September 2026 (day 24 >= isolate_day 20)
      const now = new Date(2026, 8, 24);

      // Verify isCustomerOverdue is true
      expect(billingSvc.isCustomerOverdue(testCustomerId, now)).toBe(true);
    });

    test('should respect auto_isolate = 0 even if overdue', async () => {
      const res = db.prepare(`
        INSERT INTO customers (name, phone, package_id, status, isolate_day, auto_isolate)
        VALUES ('Test No Auto Isolate', '081234567892', ?, 'active', 20, 0)
      `).run(packageId);
      testCustomerId = res.lastInsertRowid;

      db.prepare(`
        INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
        VALUES (?, 9, 2026, 150000, 0, 150000, 'unpaid')
      `).run(testCustomerId);

      const now = new Date(2026, 8, 24);
      expect(billingSvc.isCustomerOverdue(testCustomerId, now)).toBe(true);

      // syncAllOverdueCustomers checks auto_isolate !== 0, so it will skip
      await isolatedPortalSvc.syncAllOverdueCustomers();
      const updated = db.prepare('SELECT status FROM customers WHERE id = ?').get(testCustomerId);
      expect(updated.status).toBe('active');
    });
  });
});
