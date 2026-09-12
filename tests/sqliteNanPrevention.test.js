const customerSvc = require('../services/customerService');
const billingSvc = require('../services/billingService');
const attendanceSvc = require('../services/attendanceService');
const auditTrailSvc = require('../services/auditTrailService');
const settingsManager = require('../config/settingsManager');

describe('SQLite NaN Prevention Tests', () => {
  afterAll(() => {
    settingsManager.stopSettingsWatcher();
  });

  describe('settingsManager Timezone & Date Handlers', () => {
    it('getCurrentDateInTimezone should always return a valid Date and never Invalid Date', () => {
      const dt = settingsManager.getCurrentDateInTimezone();
      expect(dt instanceof Date).toBe(true);
      expect(isNaN(dt.getTime())).toBe(false);
      expect(Number.isFinite(dt.getMonth())).toBe(true);
      expect(Number.isFinite(dt.getFullYear())).toBe(true);
    });

    it('getCurrentTimeInfo should always return finite numeric fields', () => {
      const info = settingsManager.getCurrentTimeInfo();
      expect(Number.isFinite(info.year)).toBe(true);
      expect(Number.isFinite(info.month)).toBe(true);
      expect(Number.isFinite(info.day)).toBe(true);
      expect(Number.isFinite(info.hour)).toBe(true);
      expect(Number.isFinite(info.minute)).toBe(true);
      expect(Number.isFinite(info.second)).toBe(true);
      expect(info.hour).toBeGreaterThanOrEqual(0);
      expect(info.hour).toBeLessThan(24);
    });

    it('getNowLocal should return valid YYYY-MM-DD HH:mm:ss format with hours 00-23', () => {
      const nowStr = settingsManager.getNowLocal();
      expect(typeof nowStr).toBe('string');
      expect(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(nowStr)).toBe(true);
      const hour = parseInt(nowStr.split(' ')[1].split(':')[0], 10);
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThan(24);
    });
  });

  describe('customerService.getAllCustomers', () => {
    it('should never throw SqliteError "no such column: NaN"', () => {
      expect(() => {
        const list = customerSvc.getAllCustomers();
        expect(Array.isArray(list)).toBe(true);
      }).not.toThrow();
    });

    it('should handle search queries without throwing', () => {
      expect(() => {
        const list = customerSvc.getAllCustomers('test');
        expect(Array.isArray(list)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('billingService.getAllInvoices', () => {
    it('should not throw "no such column: NaN" when limit is undefined, null, NaN, or non-numeric', () => {
      const testCases = [
        {},
        { limit: undefined },
        { limit: null },
        { limit: NaN },
        { limit: 'NaN' },
        { limit: 'all' },
        { limit: '' },
        { limit: -10 },
        { limit: 'abc' }
      ];

      testCases.forEach(c => {
        expect(() => {
          const invoices = billingSvc.getAllInvoices(c);
          expect(Array.isArray(invoices)).toBe(true);
        }).not.toThrow();
      });
    });

    it('should handle NaN month or year without throwing SqliteError', () => {
      expect(() => {
        const invoices = billingSvc.getAllInvoices({ month: 'NaN', year: 'NaN' });
        expect(Array.isArray(invoices)).toBe(true);
      }).not.toThrow();

      expect(() => {
        const invoices = billingSvc.getAllInvoices({ month: NaN, year: NaN });
        expect(Array.isArray(invoices)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('attendanceService queries', () => {
    it('should handle getAttendanceStats with and without date parameter', () => {
      expect(() => {
        const stats = attendanceSvc.getAttendanceStats();
        expect(Array.isArray(stats)).toBe(true);
      }).not.toThrow();

      expect(() => {
        const stats = attendanceSvc.getAttendanceStats('2026-09-13');
        expect(Array.isArray(stats)).toBe(true);
      }).not.toThrow();
    });

    it('should handle getLateCheckIns and getNotCheckedOut', () => {
      expect(() => {
        attendanceSvc.getLateCheckIns('2026-09-13');
        attendanceSvc.getNotCheckedOut('2026-09-13');
      }).not.toThrow();
    });
  });

  describe('auditTrailService.cleanupOldAuditTrail', () => {
    it('should handle non-numeric or NaN days gracefully', () => {
      expect(() => {
        auditTrailSvc.cleanupOldAuditTrail(NaN);
      }).not.toThrow();

      expect(() => {
        auditTrailSvc.cleanupOldAuditTrail('invalid');
      }).not.toThrow();

      expect(() => {
        auditTrailSvc.cleanupOldAuditTrail(30);
      }).not.toThrow();
    });
  });
});
