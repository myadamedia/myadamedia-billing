const db = require('../config/database');
const mikrotikSvc = require('../services/mikrotikService');
const customerSvc = require('../services/customerService');

describe('Permanent LIST_ISOLIR & ONT Restart IP Change Tests', () => {
  let testCustSuspendedId;
  let testCustActiveId;

  beforeAll(() => {
    let pkg = db.prepare('SELECT id FROM packages LIMIT 1').get();
    let pkgId = pkg ? pkg.id : null;
    if (!pkgId) {
      const res = db.prepare("INSERT INTO packages (name, price, speed_down, speed_up) VALUES ('Paket-Test-Isolir', 150000, 10000, 10000)").run();
      pkgId = res.lastInsertRowid;
    }

    const ins1 = db.prepare(`
      INSERT INTO customers (name, phone, pppoe_username, pppoe_password, connection_type, status, package_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('User Suspended Isolir', '08123450001', 'user_isolir_test_1', 'pass1', 'pppoe', 'suspended', pkgId);
    testCustSuspendedId = ins1.lastInsertRowid;

    const ins2 = db.prepare(`
      INSERT INTO customers (name, phone, pppoe_username, pppoe_password, connection_type, status, package_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('User Active Normal', '08123450002', 'user_active_test_2', 'pass2', 'pppoe', 'active', pkgId);
    testCustActiveId = ins2.lastInsertRowid;
  });

  afterAll(() => {
    if (testCustSuspendedId) db.prepare('DELETE FROM customers WHERE id=?').run(testCustSuspendedId);
    if (testCustActiveId) db.prepare('DELETE FROM customers WHERE id=?').run(testCustActiveId);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test('ensurePppProfileIsolirAddressListHook strips timeout=23h and adds ONT restart IP cleanup to existing profile', async () => {
    let setPayload = null;
    const mockProfileMenu = {
      get: jest.fn().mockResolvedValue([
        {
          '.id': '*1',
          name: 'isolir',
          'on-up': '/ip firewall address-list add list=LIST_ISOLIR address=$remote-address comment=$user timeout=23h',
          'on-down': '/ip firewall address-list remove [find list=LIST_ISOLIR address=$remote-address]'
        }
      ]),
      set: jest.fn().mockImplementation((payload, id) => {
        setPayload = payload;
        return Promise.resolve(true);
      }),
      add: jest.fn().mockResolvedValue(true)
    };

    const mockConn = {
      client: {
        menu: jest.fn((path) => {
          if (path === '/ppp/profile') return mockProfileMenu;
          return {};
        })
      },
      api: { close: jest.fn() }
    };

    jest.spyOn(mikrotikSvc, 'getConnection').mockResolvedValue(mockConn);

    const res = await mikrotikSvc.ensurePppProfileIsolirAddressListHook('isolir', null, mockConn);
    expect(res.ok).toBe(true);
    expect(mockProfileMenu.set).toHaveBeenCalled();

    // Verifikasi timeout=23h telah dibersihkan secara total
    expect(setPayload['on-up']).not.toContain('timeout=23h');
    expect(setPayload['on-up']).not.toContain('timeout=');

    // Verifikasi skrip on-up menyertakan pembersihan IP lama berdasarkan comment=$user saat ONT restart
    expect(setPayload['on-up']).toContain('remove [find list=LIST_ISOLIR comment=$user]');
    expect(setPayload['on-up']).toContain('address-list add list=LIST_ISOLIR address=$remote-address comment=$user');

    // Verifikasi on-down menyertakan pembersihan comment=$user
    expect(setPayload['on-down']).toContain('comment=$user');
  });

  test('handlePppoeIpChanged inserts new IP and removes old IP for suspended customers upon ONT restart', async () => {
    const addressListRows = [
      { '.id': '*10', list: 'LIST_ISOLIR', address: '10.10.10.25', comment: 'user_isolir_test_1' }
    ];
    let removedIds = [];
    let addedPayloads = [];

    const mockAddrListMenu = {
      where: jest.fn(function(key, val) {
        return {
          where: jest.fn(function(key2, val2) {
            return {
              get: jest.fn().mockImplementation(() => {
                return Promise.resolve(
                  addressListRows.filter(r => r[key] === val && r[key2] === val2)
                );
              })
            };
          }),
          get: jest.fn().mockImplementation(() => {
            return Promise.resolve(
              addressListRows.filter(r => r[key] === val)
            );
          })
        };
      }),
      add: jest.fn().mockImplementation((payload) => {
        addedPayloads.push(payload);
        return Promise.resolve(true);
      }),
      remove: jest.fn().mockImplementation((id) => {
        removedIds.push(id);
        return Promise.resolve(true);
      })
    };

    const mockConn = {
      client: {
        menu: jest.fn((path) => {
          if (path === '/ip/firewall/address-list') return mockAddrListMenu;
          return {};
        })
      },
      api: { close: jest.fn() }
    };

    jest.spyOn(mikrotikSvc, 'getConnection').mockResolvedValue(mockConn);

    // Simulasi ONT direstart: IP lama 10.10.10.25 berubah menjadi 10.10.10.88
    const ok = await mikrotikSvc.handlePppoeIpChanged('user_isolir_test_1', '10.10.10.88', '10.10.10.25');
    expect(ok).toBe(true);

    // IP lama (*10) harus dihapus
    expect(removedIds).toContain('*10');

    // IP baru (10.10.10.88) harus ditambahkan secara permanen ke LIST_ISOLIR
    const addedEntry = addedPayloads.find(p => p.address === '10.10.10.88');
    expect(addedEntry).toBeDefined();
    expect(addedEntry.list).toBe('LIST_ISOLIR');
    expect(addedEntry.comment).toBe('user_isolir_test_1');
    expect(addedEntry.timeout).toBeUndefined(); // TIDAK BOLEH ADA TIMEOUT
  });

  test('handlePppoeIpChanged refuses to add active (non-suspended) customers to LIST_ISOLIR', async () => {
    const connSpy = jest.spyOn(mikrotikSvc, 'getConnection');

    // User active_test_2 berstatus 'active'
    const ok = await mikrotikSvc.handlePppoeIpChanged('user_active_test_2', '10.10.10.99');
    expect(ok).toBe(false);
    expect(connSpy).not.toHaveBeenCalled();
  });

  test('reconcileIsolirAddressList upgrades dynamic/timeout entries to permanent entries', async () => {
    const addressListRows = [
      { '.id': '*21', list: 'LIST_ISOLIR', address: '192.168.10.50', comment: 'user_expiring', timeout: '14:22:05', dynamic: 'true' }
    ];
    let removedEntries = [];
    let addedEntries = [];

    const mockAddrListMenu = {
      where: jest.fn((key, val) => ({
        get: jest.fn().mockImplementation(() => {
          return Promise.resolve(addressListRows.filter(r => r[key] === val));
        })
      })),
      add: jest.fn().mockImplementation((payload) => {
        addedEntries.push(payload);
        return Promise.resolve(true);
      }),
      remove: jest.fn().mockImplementation((id) => {
        removedEntries.push(id);
        return Promise.resolve(true);
      })
    };

    const mockActiveMenu = {
      get: jest.fn().mockResolvedValue([])
    };

    const mockProfileMenu = {
      get: jest.fn().mockResolvedValue([
        { '.id': '*1', name: 'isolir', 'on-up': 'test', 'on-down': 'test' }
      ]),
      set: jest.fn().mockResolvedValue(true)
    };

    const mockConn = {
      client: {
        menu: jest.fn((path) => {
          if (path === '/ip/firewall/address-list') return mockAddrListMenu;
          if (path === '/ppp/active') return mockActiveMenu;
          if (path === '/ppp/profile') return mockProfileMenu;
          return {};
        })
      },
      api: { close: jest.fn() }
    };

    jest.spyOn(mikrotikSvc, 'getAllRouters').mockReturnValue([{ id: 1, name: 'Main Router' }]);
    jest.spyOn(mikrotikSvc, 'getConnection').mockResolvedValue(mockConn);
    jest.spyOn(mikrotikSvc, 'ensurePppProfileIsolirAddressListHook').mockResolvedValue({ ok: true });

    const summary = await mikrotikSvc.reconcileIsolirAddressList();
    expect(summary.dynamicEntriesCleaned).toBe(1);
    expect(removedEntries).toContain('*21');

    const recreated = addedEntries.find(e => e.address === '192.168.10.50');
    expect(recreated).toBeDefined();
    expect(recreated.list).toBe('LIST_ISOLIR');
    expect(recreated.timeout).toBeUndefined(); // Menjadi permanen
  });
});
