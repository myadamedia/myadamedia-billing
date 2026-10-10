const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

// Test suite for Dual-ACS Hybrid Mode (Built-in ACS and External GenieACS concurrent execution)
describe('Dual-ACS Hybrid Mode & Server Aggregation Tests', () => {
  let genieacsModule;
  let settingsManager;

  beforeAll(() => {
    // Clear require cache to ensure fresh module instances
    jest.resetModules();
    settingsManager = require('../config/settingsManager');
    genieacsModule = require('../config/genieacs');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('1. Harusnya mengembalikan KEDUA server (builtin & legacy) saat mode Hybrid aktif', () => {
    // Mock getSetting
    jest.spyOn(settingsManager, 'getSetting').mockImplementation((key, defaultVal) => {
      if (key === 'use_builtin_acs') return true;
      if (key === 'genieacs_url') return 'http://192.168.8.89:7557';
      if (key === 'genieacs_username') return 'admin_test';
      if (key === 'genieacs_password') return 'secret123';
      return defaultVal;
    });

    const servers = genieacsModule.getAllACSServers();
    expect(Array.isArray(servers)).toBe(true);
    
    const builtinServer = servers.find(s => s.id === 'builtin');
    const legacyServer = servers.find(s => s.id === 'legacy');

    expect(builtinServer).toBeDefined();
    expect(builtinServer.name).toBe('Built-in ACS');
    expect(builtinServer.url).toBe('local');

    expect(legacyServer).toBeDefined();
    expect(legacyServer.name).toBe('Default ACS');
    expect(legacyServer.url).toBe('http://192.168.8.89:7557');
    expect(legacyServer.username).toBe('admin_test');

    // Both servers should exist simultaneously
    expect(servers.length).toBeGreaterThanOrEqual(2);
  });

  test('2. Harusnya hanya mengembalikan server builtin saat use_builtin_acs aktif dan genieacs_url kosong', () => {
    jest.spyOn(settingsManager, 'getSetting').mockImplementation((key, defaultVal) => {
      if (key === 'use_builtin_acs') return true;
      if (key === 'genieacs_url') return '';
      return defaultVal;
    });

    const servers = genieacsModule.getAllACSServers();
    const builtinServer = servers.find(s => s.id === 'builtin');
    const legacyServer = servers.find(s => s.id === 'legacy');

    expect(builtinServer).toBeDefined();
    expect(legacyServer).toBeUndefined();
  });

  test('3. Harusnya hanya mengembalikan server legacy saat use_builtin_acs nonaktif dan genieacs_url terisi', () => {
    jest.spyOn(settingsManager, 'getSetting').mockImplementation((key, defaultVal) => {
      if (key === 'use_builtin_acs') return false;
      if (key === 'genieacs_url') return 'http://10.10.10.1:7557';
      return defaultVal;
    });

    const servers = genieacsModule.getAllACSServers();
    const builtinServer = servers.find(s => s.id === 'builtin');
    const legacyServer = servers.find(s => s.id === 'legacy');

    expect(builtinServer).toBeUndefined();
    expect(legacyServer).toBeDefined();
    expect(legacyServer.url).toBe('http://10.10.10.1:7557');
  });

  test('4. getACSServer("builtin") dan getACSServer("legacy") harus mengembalikan objek konfigurasi yang tepat', () => {
    jest.spyOn(settingsManager, 'getSetting').mockImplementation((key, defaultVal) => {
      if (key === 'genieacs_url') return 'http://192.168.1.100:7557';
      if (key === 'genieacs_username') return 'genie_user';
      return defaultVal;
    });

    const builtin = genieacsModule.getACSServer('builtin');
    expect(builtin).toEqual({
      id: 'builtin',
      name: 'Built-in ACS',
      url: 'local',
      status: 'active'
    });

    const legacy = genieacsModule.getACSServer('legacy');
    expect(legacy).toBeDefined();
    expect(legacy.id).toBe('legacy');
    expect(legacy.url).toBe('http://192.168.1.100:7557');
    expect(legacy.username).toBe('genie_user');
  });

  test('5. createAxiosInstance harus menghasilkan proxy lokal untuk builtin dan axios instance untuk eksternal', () => {
    const builtinServer = { id: 'builtin', url: 'local' };
    const externalServer = { id: 'legacy', url: 'http://192.168.1.50:7557' };

    const builtinProxy = genieacsModule.createAxiosInstance(builtinServer);
    expect(typeof builtinProxy.get).toBe('function');
    expect(typeof builtinProxy.post).toBe('function');
    expect(typeof builtinProxy.put).toBe('function');
    expect(typeof builtinProxy.delete).toBe('function');

    const externalInstance = genieacsModule.createAxiosInstance(externalServer);
    expect(typeof externalInstance.get).toBe('function');
    expect(externalInstance.defaults?.baseURL).toBe('http://192.168.1.50:7557');
  });

  test('6. resolveServerForDevice harus dapat mengembalikan server target saat serverId diberikan atau fallback', async () => {
    if (typeof genieacsModule.resolveServerForDevice === 'function') {
      const server = await genieacsModule.resolveServerForDevice('TEST-DEVICE-1', 'builtin');
      expect(server).toBeDefined();
      expect(server.id).toBe('builtin');
    }
  });

  test('7. Template views/admin/settings.ejs harus berhasil dikompilasi tanpa error sintaks EJS', () => {
    const filePath = path.join(__dirname, '../views/admin/settings.ejs');
    const content = fs.readFileSync(filePath, 'utf8');

    const mockData = {
      title: 'Pengaturan Sistem',
      settings: {
        use_builtin_acs: true,
        genieacs_url: 'http://192.168.8.89:7557',
        genieacs_username: 'admin',
        genieacs_password: 'pwd',
        mikrotik_host: '192.168.1.1',
        mikrotik_port: 8728,
        mikrotik_user: 'admin',
        mikrotik_password: 'pwd',
        admin_username: 'admin',
        admin_password: 'pwd',
        company_header: 'MyAdamedia',
        telegram_bot_token: '',
        telegram_chat_id: '',
        telegram_enabled: false,
        telegram_pppoe_notify_enabled: false,
        telegram_pppoe_notify_recovery: false,
        auto_isolir_grace_days: 3
      },
      session: { isCashier: false },
      user: { isCashier: false },
      t: (key, fallback) => fallback || key,
      lang: 'id',
      version: '15.5.2',
      ip: '127.0.0.1',
      waReady: true,
      waQr: null
    };

    // Validasi kompilasi sintaks EJS
    expect(() => {
      ejs.compile(content, { filename: filePath });
    }).not.toThrow();
  });

  test('8. Template views/admin/acs.ejs harus berhasil dikompilasi tanpa error sintaks EJS', () => {
    const filePath = path.join(__dirname, '../views/admin/acs.ejs');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(() => {
      ejs.compile(content, { filename: filePath });
    }).not.toThrow();
  });
});
