const db = require('../config/database');

describe('RADIUS Customer Session Matching Tests', () => {
  let testCustomer1Id;
  let testCustomer2Id;

  beforeAll(() => {
    // 1. Dapatkan package id
    let pkg = db.prepare('SELECT id FROM packages LIMIT 1').get();
    let pkgId = pkg ? pkg.id : null;
    if (!pkgId) {
      const res = db.prepare("INSERT INTO packages (name, price, speed_down, speed_up) VALUES ('Paket-Radius-Test', 150000, 20000, 20000)").run();
      pkgId = res.lastInsertRowid;
    }

    // 2. Insert dummy customer dengan pppoe_username kustom
    const insert1 = db.prepare(`
      INSERT INTO customers (name, phone, address, package_id, pppoe_username, hotspot_username, connection_type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Budi Santoso', '081234567891', 'Jl. Merdeka No. 1', pkgId, 'MDE0099_Budi', '', 'pppoe', 'active'
    );
    testCustomer1Id = insert1.lastInsertRowid;

    // 3. Insert dummy customer dengan hotspot_username
    const insert2 = db.prepare(`
      INSERT INTO customers (name, phone, address, package_id, pppoe_username, hotspot_username, connection_type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Siti Aminah', '081234567892', 'Jl. Melati No. 2', pkgId, '', 'hotspot_siti_01', 'hotspot', 'active'
    );
    testCustomer2Id = insert2.lastInsertRowid;
  });

  afterAll(() => {
    if (testCustomer1Id) {
      db.prepare('DELETE FROM customers WHERE id=?').run(testCustomer1Id);
    }
    if (testCustomer2Id) {
      db.prepare('DELETE FROM customers WHERE id=?').run(testCustomer2Id);
    }
  });

  function getCustomerLookupHelper() {
    const customerById = new Map();
    const customerByFormattedId = new Map();
    const customerByPppoe = new Map();
    const customerByHotspot = new Map();
    const customerByName = new Map();

    const customers = db.prepare(`
      SELECT c.*, p.name as package_name, p.price as package_price 
      FROM customers c 
      LEFT JOIN packages p ON c.package_id = p.id
    `).all();

    customers.forEach(c => {
      const cid = Number(c.id);
      customerById.set(cid, c);

      const formattedId = ('MDE-' + String(cid).padStart(4, '0')).toLowerCase();
      const rawIdStr = ('MDE' + String(cid).padStart(4, '0')).toLowerCase();
      customerByFormattedId.set(formattedId, c);
      customerByFormattedId.set(rawIdStr, c);

      if (c.pppoe_username) {
        customerByPppoe.set(c.pppoe_username.toLowerCase().trim(), c);
      }
      if (c.hotspot_username) {
        customerByHotspot.set(c.hotspot_username.toLowerCase().trim(), c);
      }
      if (c.name) {
        customerByName.set(c.name.toLowerCase().trim(), c);
      }
    });

    return function findCustomer(rawUsername) {
      if (!rawUsername) return null;
      const u = String(rawUsername).trim().toLowerCase();

      if (customerByPppoe.has(u)) return customerByPppoe.get(u);
      if (customerByHotspot.has(u)) return customerByHotspot.get(u);
      if (customerByFormattedId.has(u)) return customerByFormattedId.get(u);

      const mdeMatch = u.match(/^mde-?0*(\d+)$/i);
      if (mdeMatch) {
        const idNum = parseInt(mdeMatch[1], 10);
        if (customerById.has(idNum)) return customerById.get(idNum);
      }

      if (customerByName.has(u)) return customerByName.get(u);

      if (/^\d+$/.test(u)) {
        const idNum = parseInt(u, 10);
        if (customerById.has(idNum)) return customerById.get(idNum);
      }

      return null;
    };
  }

  test('Should accurately find customer by exact PPPoE username', () => {
    const findCustomer = getCustomerLookupHelper();
    const result = findCustomer('MDE0099_Budi');
    expect(result).not.toBeNull();
    expect(result.id).toBe(testCustomer1Id);
    expect(result.name).toBe('Budi Santoso');
  });

  test('Should accurately find customer by exact Hotspot username', () => {
    const findCustomer = getCustomerLookupHelper();
    const result = findCustomer('hotspot_siti_01');
    expect(result).not.toBeNull();
    expect(result.id).toBe(testCustomer2Id);
    expect(result.name).toBe('Siti Aminah');
  });

  test('Should accurately find customer by formatted MDE ID (e.g. MDE-000X)', () => {
    const findCustomer = getCustomerLookupHelper();
    const formattedCode = 'MDE-' + String(testCustomer1Id).padStart(4, '0');
    const result = findCustomer(formattedCode);
    expect(result).not.toBeNull();
    expect(result.id).toBe(testCustomer1Id);
    expect(result.name).toBe('Budi Santoso');
  });

  test('Should accurately find customer by direct numeric ID', () => {
    const findCustomer = getCustomerLookupHelper();
    const result = findCustomer(String(testCustomer2Id));
    expect(result).not.toBeNull();
    expect(result.id).toBe(testCustomer2Id);
    expect(result.name).toBe('Siti Aminah');
  });

  test('Should return null for non-existent username', () => {
    const findCustomer = getCustomerLookupHelper();
    const result = findCustomer('non_existent_random_user_99999');
    expect(result).toBeNull();
  });
});
