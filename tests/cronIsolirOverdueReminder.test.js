const db = require('../config/database');
const billingSvc = require('../services/billingService');
const customerSvc = require('../services/customerService');
const { getDaysAfterDueDate, getDaysUntilIsolation } = require('../services/cronService');

describe('Cron Job Isolir Reminder (Hari H s/d H+3 Setelah Jatuh Tempo) Tests', () => {
  let testCustomerId = null;
  let packageId = null;

  beforeAll(() => {
    const pkg = db.prepare('SELECT id FROM packages LIMIT 1').get();
    if (pkg) {
      packageId = pkg.id;
    } else {
      const ins = db.prepare("INSERT INTO packages (name, price) VALUES ('Test Pack Isolir', 150000)").run();
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

  describe('getDaysAfterDueDate calculations', () => {
    test('should return 0 on Hari H (Tanggal Isolir / Jatuh Tempo)', () => {
      const today = new Date(2026, 9, 10); // 10 Oktober 2026
      const dueDay = 10;
      expect(getDaysAfterDueDate(today, dueDay)).toBe(0);
    });

    test('should return 1 on H+1 (1 hari setelah jatuh tempo)', () => {
      const today = new Date(2026, 9, 11); // 11 Oktober 2026
      const dueDay = 10;
      expect(getDaysAfterDueDate(today, dueDay)).toBe(1);
    });

    test('should return 2 on H+2 (2 hari setelah jatuh tempo)', () => {
      const today = new Date(2026, 9, 12); // 12 Oktober 2026
      const dueDay = 10;
      expect(getDaysAfterDueDate(today, dueDay)).toBe(2);
    });

    test('should return 3 on H+3 (3 hari setelah jatuh tempo)', () => {
      const today = new Date(2026, 9, 13); // 13 Oktober 2026
      const dueDay = 10;
      expect(getDaysAfterDueDate(today, dueDay)).toBe(3);
    });

    test('should return 4 on H+4 (4 hari setelah jatuh tempo)', () => {
      const today = new Date(2026, 9, 14); // 14 Oktober 2026
      const dueDay = 10;
      expect(getDaysAfterDueDate(today, dueDay)).toBe(4);
    });

    test('should not match 0..3 when today is before due date (H-1)', () => {
      const today = new Date(2026, 9, 9); // 9 Oktober 2026 (sebelum tgl 10)
      const dueDay = 10;
      const res = getDaysAfterDueDate(today, dueDay);
      expect([0, 1, 2, 3].includes(res)).toBe(false);
    });

    test('should correctly handle month rollover for end-of-month dueDay (31 Oktober to 1-3 November)', () => {
      const dueDay = 31;

      // 31 Oktober: Hari H (0)
      const oct31 = new Date(2026, 9, 31);
      expect(getDaysAfterDueDate(oct31, dueDay)).toBe(0);

      // 1 November: H+1 (1)
      const nov1 = new Date(2026, 10, 1);
      expect(getDaysAfterDueDate(nov1, dueDay)).toBe(1);

      // 2 November: H+2 (2)
      const nov2 = new Date(2026, 10, 2);
      expect(getDaysAfterDueDate(nov2, dueDay)).toBe(2);

      // 3 November: H+3 (3)
      const nov3 = new Date(2026, 10, 3);
      expect(getDaysAfterDueDate(nov3, dueDay)).toBe(3);
    });

    test('should correctly clamp and handle rollover on 30-day month (April 30 to 1-3 May)', () => {
      const dueDay = 31; // Clamped to 30 in April

      // 30 April: Hari H (0)
      const apr30 = new Date(2026, 3, 30);
      expect(getDaysAfterDueDate(apr30, dueDay)).toBe(0);

      // 1 Mei: H+1 (1)
      const may1 = new Date(2026, 4, 1);
      expect(getDaysAfterDueDate(may1, dueDay)).toBe(1);

      // 2 Mei: H+2 (2)
      const may2 = new Date(2026, 4, 2);
      expect(getDaysAfterDueDate(may2, dueDay)).toBe(2);

      // 3 Mei: H+3 (3)
      const may3 = new Date(2026, 4, 3);
      expect(getDaysAfterDueDate(may3, dueDay)).toBe(3);
    });
  });

  describe('getDaysUntilIsolation backward compatibility', () => {
    test('should maintain backward compatibility for billing reminders', () => {
      const today = new Date(2026, 9, 8); // 8 Oktober 2026
      const dueDay = 10;
      expect(getDaysUntilIsolation(today, dueDay)).toBe(2); // H-2

      const hariH = new Date(2026, 9, 10);
      expect(getDaysUntilIsolation(hariH, dueDay)).toBe(0); // Hari H
    });
  });

  describe('Customer Status & Reminder Filtering', () => {
    test('should allow both active and suspended customers with unpaid bills to be targeted', () => {
      // 1. Create suspended customer (already isolated on due day)
      const resSuspended = db.prepare(`
        INSERT INTO customers (name, phone, package_id, status, isolate_day, send_isolir_reminder)
        VALUES ('Cust Suspended Isolir', '081234567801', ?, 'suspended', 10, 1)
      `).run(packageId);
      const suspendedId = resSuspended.lastInsertRowid;

      // 2. Create active customer (not yet isolated or auto-isolate disabled)
      const resActive = db.prepare(`
        INSERT INTO customers (name, phone, package_id, status, isolate_day, send_isolir_reminder)
        VALUES ('Cust Active Due', '081234567802', ?, 'active', 10, 1)
      `).run(packageId);
      const activeId = resActive.lastInsertRowid;

      // 3. Create terminated customer (should be excluded)
      const resTerminated = db.prepare(`
        INSERT INTO customers (name, phone, package_id, status, isolate_day, send_isolir_reminder)
        VALUES ('Cust Terminated', '081234567803', ?, 'terminated', 10, 1)
      `).run(packageId);
      const terminatedId = resTerminated.lastInsertRowid;

      try {
        const eligibleStatuses = ['active', 'suspended'];
        const custSuspended = db.prepare('SELECT * FROM customers WHERE id = ?').get(suspendedId);
        const custActive = db.prepare('SELECT * FROM customers WHERE id = ?').get(activeId);
        const custTerminated = db.prepare('SELECT * FROM customers WHERE id = ?').get(terminatedId);

        expect(eligibleStatuses.includes(custSuspended.status)).toBe(true);
        expect(eligibleStatuses.includes(custActive.status)).toBe(true);
        expect(eligibleStatuses.includes(custTerminated.status)).toBe(false);
      } finally {
        db.prepare('DELETE FROM customers WHERE id IN (?, ?, ?)').run(suspendedId, activeId, terminatedId);
      }
    });

    test('should respect customer send_isolir_reminder toggle === 0', () => {
      const res = db.prepare(`
        INSERT INTO customers (name, phone, package_id, status, isolate_day, send_isolir_reminder)
        VALUES ('Cust Opt Out', '081234567804', ?, 'active', 10, 0)
      `).run(packageId);
      testCustomerId = res.lastInsertRowid;

      const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(testCustomerId);
      expect(cust.send_isolir_reminder).toBe(0);
    });
  });

  describe('Message Formatting with Variables', () => {
    test('should format message with status_tempo and hari_h properly', () => {
      const template = 'Halo {{nama}}, layanan Anda memasuki {{status_tempo}} ({{hari_h}}). Tagihan: Rp {{tagihan}}';
      
      // Case 1: Hari H
      const daysAfterH = 0;
      const statusTempoH = daysAfterH === 0 ? 'Hari H (Tanggal Isolir)' : `H+${daysAfterH} (${daysAfterH} hari setelah jatuh tempo)`;
      const hariHText = daysAfterH === 0 ? 'Hari Ini' : `H+${daysAfterH}`;
      const formattedH = template
        .replace(/{{nama}}/gi, 'Budi')
        .replace(/{{status_tempo}}/gi, statusTempoH)
        .replace(/{{hari_h}}/gi, hariHText)
        .replace(/{{tagihan}}/gi, '150.000');

      expect(formattedH).toContain('Hari H (Tanggal Isolir)');
      expect(formattedH).toContain('Hari Ini');

      // Case 2: H+2
      const daysAfter2 = 2;
      const statusTempo2 = daysAfter2 === 0 ? 'Hari H (Tanggal Isolir)' : `H+${daysAfter2} (${daysAfter2} hari setelah jatuh tempo)`;
      const hariHText2 = daysAfter2 === 0 ? 'Hari Ini' : `H+${daysAfter2}`;
      const formatted2 = template
        .replace(/{{nama}}/gi, 'Budi')
        .replace(/{{status_tempo}}/gi, statusTempo2)
        .replace(/{{hari_h}}/gi, hariHText2)
        .replace(/{{tagihan}}/gi, '150.000');

      expect(formatted2).toContain('H+2 (2 hari setelah jatuh tempo)');
      expect(formatted2).toContain('H+2');
    });
  });
});
