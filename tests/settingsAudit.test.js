// Mock fs module before requiring settingsAudit
jest.mock('fs');

describe('settingsAudit', () => {
  let fs;
  let settingsAudit;
  let mockLogLines;

  beforeEach(() => {
    // Reset module registry and mock states
    jest.resetModules();
    jest.restoreAllMocks();

    // Obtain the active mock fs instance
    fs = require('fs');

    mockLogLines = [
      JSON.stringify({
        timestamp: '2026-07-20T10:00:00.000Z',
        actor: 'admin',
        changes: {
          server_port: { oldValue: 3001, newValue: 3002 }
        },
        ip: '127.0.0.1',
        userAgent: 'Mozilla',
        metadata: {}
      }),
      JSON.stringify({
        timestamp: '2026-07-21T09:00:00.000Z',
        actor: 'kasir',
        changes: {
          admin_password: { oldValue: 'super-secret-old', newValue: 'super-secret-new' }
        },
        ip: '192.168.1.5',
        userAgent: 'Chrome',
        metadata: {}
      })
    ];

    // Set up mock implementations on active fs instance
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.readFileSync = jest.fn().mockImplementation(() => mockLogLines.join('\n') + '\n');
    fs.appendFileSync = jest.fn().mockImplementation(() => true);
    fs.writeFileSync = jest.fn().mockImplementation(() => true);
    fs.mkdirSync = jest.fn().mockImplementation(() => true);

    settingsAudit = require('../config/settingsAudit');
  });

  describe('Initialization', () => {
    it('should create log directory if it does not exist', () => {
      jest.resetModules();
      // Re-require fs and redefine mock on the new reset instance
      fs = require('fs');
      fs.existsSync = jest.fn().mockReturnValueOnce(false); // Directory doesn't exist
      fs.mkdirSync = jest.fn().mockImplementation(() => true);
      
      require('../config/settingsAudit');
      expect(fs.mkdirSync).toHaveBeenCalled();
    });
  });

  describe('logSettingsChange', () => {
    it('should successfully log settings changes with sensitive fields masked', () => {
      const changes = {
        server_port: { oldValue: 3001, newValue: 3002 },
        admin_password: { oldValue: 'secret123456', newValue: 'newsecret123456' } // Sensitive field
      };

      const success = settingsAudit.logSettingsChange('superadmin', changes, { ip: '10.0.0.1', userAgent: 'Safari' });
      expect(success).toBe(true);
      expect(fs.appendFileSync).toHaveBeenCalled();

      // Check what was written
      const writeCallArg = fs.appendFileSync.mock.calls[0][1];
      const loggedEntry = JSON.parse(writeCallArg.trim());

      expect(loggedEntry.actor).toBe('superadmin');
      expect(loggedEntry.ip).toBe('10.0.0.1');
      expect(loggedEntry.userAgent).toBe('Safari');
      expect(loggedEntry.changes.server_port).toEqual({ oldValue: 3001, newValue: 3002 });
      
      // Sensitive field must be masked
      expect(loggedEntry.changes.admin_password.oldValue).toBe('secr****3456');
      expect(loggedEntry.changes.admin_password.newValue).toBe('news****3456');
    });

    it('should default to system actor and unknown ip/userAgent if not provided', () => {
      const changes = { server_port: { oldValue: 3001, newValue: 3002 } };
      const success = settingsAudit.logSettingsChange(null, changes);
      expect(success).toBe(true);

      const loggedEntry = JSON.parse(fs.appendFileSync.mock.calls[0][1].trim());
      expect(loggedEntry.actor).toBe('system');
      expect(loggedEntry.ip).toBe('unknown');
      expect(loggedEntry.userAgent).toBe('unknown');
    });

    it('should return false if logging throws error', () => {
      fs.appendFileSync.mockImplementationOnce(() => {
        throw new Error('Write failed');
      });

      const success = settingsAudit.logSettingsChange('admin', {});
      expect(success).toBe(false);
    });
  });

  describe('getChangeHistory', () => {
    it('should return parsed log lines reversed (latest first)', () => {
      const history = settingsAudit.getChangeHistory();
      expect(history).toHaveLength(2);
      expect(history[0].actor).toBe('kasir'); // Latest first
      expect(history[1].actor).toBe('admin');
    });

    it('should limit historical entries returned', () => {
      const history = settingsAudit.getChangeHistory(1);
      expect(history).toHaveLength(1);
      expect(history[0].actor).toBe('kasir');
    });

    it('should return empty array if log file does not exist', () => {
      fs.existsSync.mockReturnValueOnce(false); // File doesn't exist
      const history = settingsAudit.getChangeHistory();
      expect(history).toEqual([]);
    });

    it('should return empty array and log error on read exception', () => {
      fs.readFileSync.mockImplementationOnce(() => {
        throw new Error('Read failed');
      });
      const history = settingsAudit.getChangeHistory();
      expect(history).toEqual([]);
    });
  });

  describe('Filtering history', () => {
    it('should filter change history by actor', () => {
      const history = settingsAudit.getChangesByActor('kasir');
      expect(history).toHaveLength(1);
      expect(history[0].actor).toBe('kasir');
    });

    it('should handle read failures when filtering by actor', () => {
      fs.readFileSync.mockImplementationOnce(() => {
        return 'null\n';
      });
      const history = settingsAudit.getChangesByActor('kasir');
      expect(history).toEqual([]);
    });

    it('should filter change history by changed field', () => {
      const history = settingsAudit.getChangesByField('admin_password');
      expect(history).toHaveLength(1);
      expect(history[0].actor).toBe('kasir');
    });

    it('should handle read failures when filtering by field', () => {
      fs.readFileSync.mockImplementationOnce(() => {
        return 'null\n';
      });
      const history = settingsAudit.getChangesByField('server_port');
      expect(history).toEqual([]);
    });

    it('should filter change history by date range', () => {
      const history = settingsAudit.getChangesByDateRange(
        '2026-07-21T00:00:00.000Z',
        '2026-07-21T23:59:59.000Z'
      );
      expect(history).toHaveLength(1);
      expect(history[0].actor).toBe('kasir');
    });

    it('should handle read failures when filtering by date range', () => {
      fs.readFileSync.mockImplementationOnce(() => {
        return 'null\n';
      });
      const history = settingsAudit.getChangesByDateRange('2026-07-21', '2026-07-22');
      expect(history).toEqual([]);
    });
  });

  describe('exportAuditLog', () => {
    it('should export history as JSON object by default', () => {
      const exported = settingsAudit.exportAuditLog();
      expect(exported.format).toBe('json');
      expect(exported.count).toBe(2);
      expect(exported.data[0].actor).toBe('kasir');
    });

    it('should export history as CSV string format', () => {
      const exported = settingsAudit.exportAuditLog('csv');
      expect(exported.headers).toEqual(['Timestamp', 'Actor', 'Field', 'Old Value', 'New Value', 'IP']);
      expect(exported.rows).toHaveLength(2);
      // Row 1 (first index of reversed history is kasir)
      expect(exported.rows[0][1]).toBe('kasir');
      expect(exported.rows[0][2]).toBe('admin_password');
      expect(exported.rows[0][3]).toBe('super-secret-old');
      expect(exported.rows[0][4]).toBe('super-secret-new');
      expect(exported.rows[0][5]).toBe('192.168.1.5');
      
      expect(exported.data).toContain('Timestamp,Actor,Field,Old Value,New Value,IP');
      expect(exported.data).toContain('kasir,admin_password,super-secret-old,super-secret-new,192.168.1.5');
    });

    it('should return null if export throws exception', () => {
      // Return a log line that misses the changes property to force Object.keys(entry.changes) to throw a TypeError inside exportAuditLog when csv format is selected
      fs.readFileSync.mockImplementationOnce(() => {
        return JSON.stringify({ actor: 'admin' }) + '\n';
      });
      const exported = settingsAudit.exportAuditLog('csv');
      expect(exported).toBeNull();
    });
  });

  describe('clearOldLogs', () => {
    it('should clean up logs older than retention days', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-07-22T08:00:00.000Z'));

      // We clear with 1 day retention.
      // kasir is from 2026-07-21T09:00:00.000Z (within 1 day of 2026-07-22T08:00:00.000Z) -> keep
      // admin is from 2026-07-20T10:00:00.000Z (older than 1 day of 2026-07-22T08:00:00.000Z) -> clear
      const success = settingsAudit.clearOldLogs(1);
      expect(success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();

      // Check written lines
      const writeArg = fs.writeFileSync.mock.calls[0][1];
      const remainingLines = writeArg.trim().split('\n').filter(Boolean);
      expect(remainingLines).toHaveLength(1);
      expect(JSON.parse(remainingLines[0]).actor).toBe('kasir');

      jest.useRealTimers();
    });

    it('should skip clearing if log file does not exist', () => {
      fs.existsSync.mockReturnValueOnce(false); // File doesn't exist
      const success = settingsAudit.clearOldLogs(90);
      expect(success).toBeUndefined();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should skip lines that fail JSON parsing during clear', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-07-22T08:00:00.000Z'));

      fs.readFileSync.mockReturnValueOnce('invalid-json-line\n' + mockLogLines[1] + '\n');
      const success = settingsAudit.clearOldLogs(90);
      expect(success).toBe(true);
      
      const writeArg = fs.writeFileSync.mock.calls[0][1];
      const remainingLines = writeArg.trim().split('\n').filter(Boolean);
      expect(remainingLines).toHaveLength(1); // Keeps only kasir (parsed successfully and within range)
      
      jest.useRealTimers();
    });

    it('should return false and log error on exception during clear', () => {
      fs.readFileSync.mockImplementationOnce(() => {
        throw new Error('Read failed');
      });
      const success = settingsAudit.clearOldLogs(90);
      expect(success).toBe(false);
    });

    it('should default to 90 days retention if parameter is omitted', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-07-22T08:00:00.000Z'));
      const success = settingsAudit.clearOldLogs(); // Omit argument
      expect(success).toBe(true);
      jest.useRealTimers();
    });
  });

  describe('getAuditStats', () => {
    it('should calculate correct metrics for change logs', () => {
      const stats = settingsAudit.getAuditStats();
      expect(stats.totalChanges).toBe(2);
      expect(stats.uniqueActors).toBe(2); // admin, kasir
      expect(stats.changedFields).toContain('server_port');
      expect(stats.changedFields).toContain('admin_password');
      expect(stats.changesByActor).toEqual({ admin: 1, kasir: 1 });
      expect(stats.changesByField).toEqual({ server_port: 1, admin_password: 1 });
      expect(stats.lastChange.actor).toBe('kasir'); // Latest
    });

    it('should return null and handle exceptions gracefully', () => {
      // Return a log line that misses the changes property to force Object.keys(entry.changes) to throw a TypeError inside getAuditStats
      fs.readFileSync.mockImplementationOnce(() => {
        return JSON.stringify({ actor: 'admin' }) + '\n';
      });
      const stats = settingsAudit.getAuditStats();
      expect(stats).toBeNull();
    });

    it('should return default empty stats when history is empty', () => {
      fs.readFileSync.mockImplementationOnce(() => '');
      const stats = settingsAudit.getAuditStats();
      expect(stats.totalChanges).toBe(0);
      expect(stats.lastChange).toBeNull();
    });
  });
});
