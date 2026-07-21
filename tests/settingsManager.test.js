// Mock fs module before requiring settingsManager
jest.mock('fs');

describe('settingsManager', () => {
  let fs;
  let settingsManager;
  let mockWatcher;
  let watchCallback;
  let mockSettings;

  beforeEach(() => {
    // Reset modules registry
    jest.resetModules();
    jest.restoreAllMocks();

    // Re-require mock fs to obtain the active instance in this module context
    fs = require('fs');

    mockSettings = {
      timezone: 'Asia/Jakarta',
      server_port: 3001,
      server_host: 'localhost',
      session_secret: 'some-custom-secret-key-123456789'
    };

    // Set up fs mock implementations on the active instance
    fs.readFileSync = jest.fn().mockImplementation(() => JSON.stringify(mockSettings));
    fs.writeFileSync = jest.fn().mockImplementation(() => true);
    
    mockWatcher = {
      close: jest.fn()
    };
    fs.watch = jest.fn().mockImplementation((path, cb) => {
      watchCallback = cb;
      return mockWatcher;
    });

    // Require the module which will now load the mocked fs instance defined above
    settingsManager = require('../config/settingsManager');
  });

  afterEach(() => {
    // Ensure watcher is stopped to prevent handles leak
    if (settingsManager && typeof settingsManager.stopSettingsWatcher === 'function') {
      settingsManager.stopSettingsWatcher();
    }
  });

  describe('getSettings', () => {
    it('should read and parse settings file successfully', () => {
      const settings = settingsManager.getSettings();
      expect(fs.readFileSync).toHaveBeenCalled();
      expect(settings).toEqual(mockSettings);
    });

    it('should fallback to generated session secret if default is used or session secret is empty', () => {
      mockSettings.session_secret = 'rahasia-portal-pelanggan-default-ganti-ini';
      fs.readFileSync.mockImplementation(() => JSON.stringify(mockSettings));

      const settings1 = settingsManager.getSettings();
      expect(settings1.session_secret).toBeDefined();
      expect(settings1.session_secret).not.toBe('rahasia-portal-pelanggan-default-ganti-ini');

      const settings2 = settingsManager.getSettings();
      expect(settings2.session_secret).toBe(settings1.session_secret);
    });

    it('should fallback to Asia/Jakarta if timezone is empty or invalid', () => {
      // Test empty timezone
      mockSettings.timezone = '';
      fs.readFileSync.mockImplementation(() => JSON.stringify(mockSettings));
      let settings = settingsManager.getSettings();
      expect(settings.timezone).toBe('Asia/Jakarta');

      // Test invalid timezone
      mockSettings.timezone = 'Invalid/Timezone';
      fs.readFileSync.mockImplementation(() => JSON.stringify(mockSettings));
      settings = settingsManager.getSettings();
      expect(settings.timezone).toBe('Asia/Jakarta');
    });

    it('should fallback to empty object if settings file parses to null', () => {
      fs.readFileSync.mockImplementationOnce(() => 'null');
      const settings = settingsManager.getSettings();
      expect(settings.session_secret).toBeDefined();
      expect(settings.timezone).toBe('Asia/Jakarta');
    });

    it('should fallback timezone if timezone is not a string', () => {
      mockSettings.timezone = 12345; // Not a string
      fs.readFileSync.mockImplementation(() => JSON.stringify(mockSettings));
      const settings = settingsManager.getSettings();
      expect(settings.timezone).toBe('Asia/Jakarta');
    });

    it('should return empty object and log error if fs.readFileSync throws', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const settings = settingsManager.getSettings();
      expect(settings).toEqual({});
    });
  });

  describe('getSettingsWithCache, getSetting, getSettingsByKeys', () => {
    it('should return cached settings if called within cache duration', () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
      
      settingsManager.getSettingsWithCache();
      settingsManager.getSettingsWithCache();
      
      // Should read file only once
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
      
      // Advance time beyond 2 seconds (CACHE_DURATION = 2000 ms)
      nowSpy.mockReturnValue(4000);
      settingsManager.getSettingsWithCache();
      
      // Should read file again
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
      
      nowSpy.mockRestore();
    });

    it('should get a single setting by key with fallback', () => {
      expect(settingsManager.getSetting('server_port')).toBe(3001);
      expect(settingsManager.getSetting('non_existent', 'default-value')).toBe('default-value');
    });

    it('should get multiple settings by keys', () => {
      const result = settingsManager.getSettingsByKeys(['server_port', 'server_host']);
      expect(result).toEqual({
        server_port: 3001,
        server_host: 'localhost'
      });
    });
  });

  describe('saveSettings', () => {
    it('should write settings object to file and update cache', () => {
      const newSettings = { server_port: 3002 };
      const success = settingsManager.saveSettings(newSettings);
      
      expect(success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
      
      // Cache should be updated with new values
      expect(settingsManager.getSetting('server_port')).toBe(3002);
    });

    it('should return false if fs.writeFileSync throws error', () => {
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Write error');
      });
      
      const success = settingsManager.saveSettings({ server_port: 3002 });
      expect(success).toBe(false);
    });
  });

  describe('startSettingsWatcher and stopSettingsWatcher', () => {
    it('should start watcher and react to file change event', () => {
      expect(fs.watch).toHaveBeenCalled();
      
      // Trigger watcher callback
      fs.readFileSync.mockClear();
      watchCallback('change', 'settings.json');
      
      // Verify cache is cleared by checking that file is read again
      settingsManager.getSettingsWithCache();
      expect(fs.readFileSync).toHaveBeenCalled();
    });

    it('should ignore non-settings.json file changes', () => {
      // Populate cache first
      settingsManager.getSettingsWithCache();
      fs.readFileSync.mockClear();

      // Trigger with other filename
      watchCallback('change', 'other.json');
      
      // Cache should not be cleared, so readFileSync shouldn't be called if cache is valid
      settingsManager.getSettingsWithCache();
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('should log error if settings reload fails during watch event', () => {
      const { logger } = require('../config/logger');
      const spy = jest.spyOn(logger, 'info').mockImplementationOnce(() => {
        throw new Error('Reload error');
      });

      // Trigger change
      expect(() => {
        watchCallback('change', 'settings.json');
      }).not.toThrow();

      spy.mockRestore();
    });

    it('should ignore non-change events in watcher', () => {
      watchCallback('rename', 'settings.json');
      // Should exit early without reload
    });

    it('should fallback port and host in watcher if missing', () => {
      // Set readFileSync to return empty object to force watcher console log fallbacks
      fs.readFileSync.mockImplementation(() => '{}');
      watchCallback('change', 'settings.json');
    });

    it('should close active watcher and not fail if closed multiple times', () => {
      settingsManager.stopSettingsWatcher();
      expect(mockWatcher.close).toHaveBeenCalledTimes(1);
      
      // Calling again should not throw and not call close again
      expect(() => settingsManager.stopSettingsWatcher()).not.toThrow();
      expect(mockWatcher.close).toHaveBeenCalledTimes(1);
    });

    it('should log error if watcher start fails', () => {
      fs.watch.mockImplementationOnce(() => {
        throw new Error('Watch registration failed');
      });
      
      expect(() => {
        settingsManager.startSettingsWatcher();
      }).not.toThrow();
    });
  });

  describe('Timezone and Date Utilities', () => {
    it('should get local current time string via getNowLocal', () => {
      const nowLocal = settingsManager.getNowLocal();
      expect(nowLocal).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('should get local Date object via getCurrentDateInTimezone', () => {
      const localDate = settingsManager.getCurrentDateInTimezone();
      expect(localDate).toBeInstanceOf(Date);
      expect(isNaN(localDate.getTime())).toBe(false);
    });

    it('should get local ISO string via getNowLocalISO', () => {
      const isoStr = settingsManager.getNowLocalISO();
      expect(isoStr).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });

    it('should parse local date string to Date object', () => {
      const dateStr = '2026-07-21 12:00:00';
      const dateObj = settingsManager.parseDateInTimezone(dateStr);
      expect(dateObj).toBeInstanceOf(Date);
      expect(isNaN(dateObj.getTime())).toBe(false);

      // Testing invalid inputs
      expect(settingsManager.parseDateInTimezone('')).toBeNull();
      expect(settingsManager.parseDateInTimezone('invalid-date')).toBeNull();
    });

    it('should format date to local string via formatDateLocal', () => {
      const date = new Date('2026-07-21T12:00:00Z');
      const formatted = settingsManager.formatDateLocal(date);
      expect(formatted).toBeDefined();
      expect(formatted).not.toBe('-');

      // Test with string and number representation
      expect(settingsManager.formatDateLocal('2026-07-21T12:00:00Z')).not.toBe('-');
      expect(settingsManager.formatDateLocal(date.getTime())).not.toBe('-');

      // Test empty or invalid
      expect(settingsManager.formatDateLocal(null)).toBe('-');
      expect(settingsManager.formatDateLocal('invalid-date-string')).toBe('-');
    });
  });
});
