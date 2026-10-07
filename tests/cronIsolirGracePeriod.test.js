const db = require('../config/database');
const billingSvc = require('../services/billingService');
const customerSvc = require('../services/customerService');
const isolatedPortalSvc = require('../services/isolatedPortalService');

describe('Customer Isolation Grace Period (H+3 & Hybrid Per-Customer Override)', () => {
  let packageId;
  let testCustomerIds = [];

  beforeAll(() => {
    const pkg = db.prepare('INSERT INTO packages (name, price) VALUES (?, ?)').run('Test Grace Pkg', 150000);
    packageId = pkg.lastInsertRowid;
  });

  afterAll(() => {
    testCustomerIds.forEach(cid => {
      try {
        db.prepare('DELETE FROM invoices WHERE customer_id = ?').run(cid);
        db.prepare('DELETE FROM customers WHERE id = ?').run(cid);
      } catch (e) {}
    });
    try {
      db.prepare('DELETE FROM packages WHERE id = ?').run(packageId);
    } catch (e) {}
  });

  describe('getCustomerGraceDays', () => {
    test('should return customer isolate_grace_days when explicitly set (0, 1, 2, 3)', () => {
      expect(billingSvc.getCustomerGraceDays({ isolate_grace_days: 0 })).toBe(0);
      expect(billingSvc.getCustomerGraceDays({ isolate_grace_days: 1 })).toBe(1);
      expect(billingSvc.getCustomerGraceDays({ isolate_grace_days: 2 })).toBe(2);
      expect(billingSvc.getCustomerGraceDays({ isolate_grace_days: 3 })).toBe(3);
    });

    test('should fallback to global setting when customer isolate_grace_days is null, undefined, or -1', () => {
      // settings.json has auto_isolir_grace_days: 3
      expect(billingSvc.getCustomerGraceDays({ isolate_grace_days: -1 })).toBe(3);
      expect(billingSvc.getCustomerGraceDays({ isolate_grace_days: null })).toBe(3);
      expect(billingSvc.getCustomerGraceDays({})).toBe(3);
    });
  });

  describe('getInvoiceIsolationDate', () => {
    test('should calculate target isolation date for standard month (due 20 + grace 3 -> 23)', () => {
      const inv = { period_year: 2026, period_month: 10 };
      const cust = { isolate_day: 20, isolate_grace_days: 3 };
      const isoDate = billingSvc.getInvoiceIsolationDate(inv, cust);

      expect(isoDate.getFullYear()).toBe(2026);
      expect(isoDate.getMonth()).toBe(9); // October (0-indexed 9)
      expect(isoDate.getDate()).toBe(23);
    });

    test('should handle month-end rollover accurately (due 30 Sept + grace 3 -> 3 Oct)', () => {
      const inv = { period_year: 2026, period_month: 9 };
      const cust = { isolate_day: 30, isolate_grace_days: 3 };
      const isoDate = billingSvc.getInvoiceIsolationDate(inv, cust);

      expect(isoDate.getFullYear()).toBe(2026);
      expect(isoDate.getMonth()).toBe(9); // October
      expect(isoDate.getDate()).toBe(3);
    });

    test('should handle leap year February rollover accurately (due 28 Feb 2028 leap year + grace 3 -> 2 Mar)', () => {
      const inv = { period_year: 2028, period_month: 2 };
      const cust = { isolate_day: 28, isolate_grace_days: 3 };
      const isoDate = billingSvc.getInvoiceIsolationDate(inv, cust);

      expect(isoDate.getFullYear()).toBe(2028);
      expect(isoDate.getMonth()).toBe(2); // March (0-indexed 2)
      expect(isoDate.getDate()).toBe(2);
    });
  });

  describe('isInvoiceEligibleForIsolation', () => {
    const custHPlus3 = { isolate_day: 20, isolate_grace_days: 3 };
    const invOct = { period_year: 2026, period_month: 10, amount: 150000, paid_amount: 0, status: 'unpaid' };

    test('should return false on Hari H (20 Oct) when grace period is 3', () => {
      const nowDay20 = new Date(2026, 9, 20); // 20 Oct 2026
      expect(billingSvc.isInvoiceOverdue(invOct, custHPlus3, nowDay20)).toBe(true); // financially overdue
      expect(billingSvc.isInvoiceEligibleForIsolation(invOct, custHPlus3, nowDay20)).toBe(false); // but NOT isolated yet!
    });

    test('should return false on H+1 (21 Oct) and H+2 (22 Oct)', () => {
      const nowDay21 = new Date(2026, 9, 21);
      const nowDay22 = new Date(2026, 9, 22);
      expect(billingSvc.isInvoiceEligibleForIsolation(invOct, custHPlus3, nowDay21)).toBe(false);
      expect(billingSvc.isInvoiceEligibleForIsolation(invOct, custHPlus3, nowDay22)).toBe(false);
    });

    test('should return true on H+3 (23 Oct) and thereafter', () => {
      const nowDay23 = new Date(2026, 9, 23);
      const nowDay24 = new Date(2026, 9, 24);
      expect(billingSvc.isInvoiceEligibleForIsolation(invOct, custHPlus3, nowDay23)).toBe(true);
      expect(billingSvc.isInvoiceEligibleForIsolation(invOct, custHPlus3, nowDay24)).toBe(true);
    });

    test('should immediately isolate on Hari H when customer chooses grace 0 (Hari H)', () => {
      const custGrace0 = { isolate_day: 20, isolate_grace_days: 0 };
      const nowDay20 = new Date(2026, 9, 20);
      expect(billingSvc.isInvoiceEligibleForIsolation(invOct, custGrace0, nowDay20)).toBe(true);
    });

    test('should isolate on H+1 when customer chooses grace 1', () => {
      const custGrace1 = { isolate_day: 20, isolate_grace_days: 1 };
      const nowDay20 = new Date(2026, 9, 20);
      const nowDay21 = new Date(2026, 9, 21);
      expect(billingSvc.isInvoiceEligibleForIsolation(invOct, custGrace1, nowDay20)).toBe(false);
      expect(billingSvc.isInvoiceEligibleForIsolation(invOct, custGrace1, nowDay21)).toBe(true);
    });

    test('should return false for future month advance billing', () => {
      const invNov = { period_year: 2026, period_month: 11, amount: 150000, paid_amount: 0, status: 'unpaid' };
      const nowOct25 = new Date(2026, 9, 25);
      expect(billingSvc.isInvoiceEligibleForIsolation(invNov, custHPlus3, nowOct25)).toBe(false);
    });

    test('should return true for past month unpaid invoice (no grace delay for past months)', () => {
      const invAug = { period_year: 2026, period_month: 8, amount: 150000, paid_amount: 0, status: 'unpaid' };
      const nowSept05 = new Date(2026, 8, 5); // 5 September
      expect(billingSvc.isInvoiceEligibleForIsolation(invAug, custHPlus3, nowSept05)).toBe(true);
    });

    test('should return false if invoice is already paid', () => {
      const invPaid = { period_year: 2026, period_month: 10, amount: 150000, paid_amount: 150000, status: 'paid' };
      const nowOct25 = new Date(2026, 9, 25);
      expect(billingSvc.isInvoiceEligibleForIsolation(invPaid, custHPlus3, nowOct25)).toBe(false);
    });
  });

  describe('Database and Isolation Execution Integration', () => {
    test('should respect H+3 grace period during syncAllOverdueCustomers', async () => {
      // Create customer with due day 20 and inherit global grace 3
      const res = customerSvc.createCustomer({
        name: 'Cust Grace Global H3',
        phone: '08129999001',
        package_id: packageId,
        status: 'active',
        isolate_day: 20,
        isolate_grace_days: -1,
        auto_isolate: 1
      });
      const cid = res.lastInsertRowid;
      testCustomerIds.push(cid);

      // Create invoice for Month 9 / 2026
      db.prepare(`
        INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
        VALUES (?, 9, 2026, 150000, 0, 150000, 'unpaid')
      `).run(cid);

      // On 21 Sept (H+1): Overdue is true, but eligible for isolation is false
      const now21 = new Date(2026, 8, 21);
      expect(billingSvc.isCustomerOverdue(cid, now21)).toBe(true);
      expect(billingSvc.isCustomerEligibleForIsolation(cid, now21)).toBe(false);

      // On 23 Sept (H+3): Eligible for isolation becomes true
      const now23 = new Date(2026, 8, 23);
      expect(billingSvc.isCustomerEligibleForIsolation(cid, now23)).toBe(true);
    });

    test('should allow custom customer override to isolate immediately on Hari H', async () => {
      // Create customer with due day 20 and custom grace 0 (Hari H)
      const res = customerSvc.createCustomer({
        name: 'Cust Grace Immediate H0',
        phone: '08129999002',
        package_id: packageId,
        status: 'active',
        isolate_day: 20,
        isolate_grace_days: 0,
        auto_isolate: 1
      });
      const cid = res.lastInsertRowid;
      testCustomerIds.push(cid);

      db.prepare(`
        INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, status)
        VALUES (?, 9, 2026, 150000, 0, 150000, 'unpaid')
      `).run(cid);

      // On 20 Sept (Hari H): Eligible for isolation is immediately true
      const now20 = new Date(2026, 8, 20);
      expect(billingSvc.isCustomerEligibleForIsolation(cid, now20)).toBe(true);
    });
  });
});
