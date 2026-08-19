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
      'Budi Santoso', '081234567891', 'Jl. Merdeka No. 1', pkgId, 'MDE0888_Budi', '', 'pppoe', 'active'
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
    const customerByPppoeCode = new Map();
    const customerByHotspot = new Map();
    const customerByGenieAcs = new Map();
    const customerByPhone = new Map();
    const customerByName = new Map();

    function extractMdeCode(str) {
      if (!str) return null;
      const s = String(str).trim().toLowerCase();
      const m = s.match(/(?:mde|myadamedia)[-_]?0*(\d+)/i);
      if (m) return parseInt(m[1], 10);
      return null;
    }

    const customers = db.prepare(`
      SELECT c.*, p.name as package_name, p.price as package_price 
      FROM customers c 
      LEFT JOIN packages p ON c.package_id = p.id
    `).all();

    customers.forEach(c => {
      const cid = Number(c.id);
      customerById.set(cid, c);

      const formattedId = ('mde-' + String(cid).padStart(4, '0'));
      const rawIdStr = ('mde' + String(cid).padStart(4, '0'));
      customerByFormattedId.set(formattedId, c);
      customerByFormattedId.set(rawIdStr, c);

      if (c.pppoe_username) {
        const u = c.pppoe_username.toLowerCase().trim();
        customerByPppoe.set(u, c);
        const code = extractMdeCode(u);
        if (code !== null) {
          customerByPppoeCode.set(code, c);
          customerByPppoeCode.set('mde' + code, c);
          customerByPppoeCode.set('mde-' + code, c);
          customerByPppoeCode.set('mde' + String(code).padStart(4, '0'), c);
          customerByPppoeCode.set('mde-' + String(code).padStart(4, '0'), c);
        }
      }
      if (c.hotspot_username) {
        customerByHotspot.set(c.hotspot_username.toLowerCase().trim(), c);
      }
      if (c.genieacs_tag) {
        const tag = c.genieacs_tag.toLowerCase().trim();
        customerByGenieAcs.set(tag, c);
        const code = extractMdeCode(tag);
        if (code !== null && !customerByPppoeCode.has(code)) {
          customerByPppoeCode.set(code, c);
          customerByPppoeCode.set('mde' + code, c);
          customerByPppoeCode.set('mde-' + code, c);
          customerByPppoeCode.set('mde' + String(code).padStart(4, '0'), c);
          customerByPppoeCode.set('mde-' + String(code).padStart(4, '0'), c);
        }
      }
      if (c.phone) {
        const phone = String(c.phone).trim();
        if (phone) customerByPhone.set(phone, c);
      }
      if (c.name) {
        customerByName.set(c.name.toLowerCase().trim(), c);
      }
    });

    return function findCustomer(rawUsername) {
      if (!rawUsername) return null;
      const u = String(rawUsername).trim().toLowerCase();

      if (customerByPppoe.has(u)) return customerByPppoe.get(u);

      if (customerByPppoeCode.has(u)) return customerByPppoeCode.get(u);
      const code = extractMdeCode(u);
      if (code !== null && customerByPppoeCode.has(code)) return customerByPppoeCode.get(code);

      if (customerByHotspot.has(u)) return customerByHotspot.get(u);
      if (customerByGenieAcs.has(u)) return customerByGenieAcs.get(u);
      if (customerByPhone.has(u)) return customerByPhone.get(u);
      if (customerByName.has(u)) return customerByName.get(u);
      if (customerByFormattedId.has(u)) return customerByFormattedId.get(u);

      if (/^\d+$/.test(u)) {
        const idNum = parseInt(u, 10);
        if (customerById.has(idNum)) return customerById.get(idNum);
      }

      return null;
    };
  }

  test('Should accurately find customer by exact PPPoE username', () => {
    const findCustomer = getCustomerLookupHelper();
    const result = findCustomer('MDE0888_Budi');
    expect(result).not.toBeNull();
    expect(result.id).toBe(testCustomer1Id);
    expect(result.name).toBe('Budi Santoso');
  });

  test('Should accurately find customer by PPPoE code variation (MDE-0888 & MDE0888)', () => {
    const findCustomer = getCustomerLookupHelper();
    const resultWithDash = findCustomer('MDE-0888');
    expect(resultWithDash).not.toBeNull();
    expect(resultWithDash.id).toBe(testCustomer1Id);
    expect(resultWithDash.name).toBe('Budi Santoso');

    const resultWithoutDash = findCustomer('MDE0888');
    expect(resultWithoutDash).not.toBeNull();
    expect(resultWithoutDash.id).toBe(testCustomer1Id);
    expect(resultWithoutDash.name).toBe('Budi Santoso');
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
    const formattedCode = 'MDE-' + String(testCustomer2Id).padStart(4, '0');
    const result = findCustomer(formattedCode);
    expect(result).not.toBeNull();
    expect(result.id).toBe(testCustomer2Id);
    expect(result.name).toBe('Siti Aminah');
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
