const db = require('../config/database');
const mikrotikSvc = require('../services/mikrotikService');

console.log('--- ROUTERS ---');
try {
  const routers = mikrotikSvc.getAllRouters();
  console.log('Router count:', routers.length);
  console.log(routers);
} catch (e) {
  console.error('Router error:', e.message);
}

console.log('--- CUSTOMERS COLUMNS ---');
const custCols = db.prepare("PRAGMA table_info(customers)").all().map(c => c.name);
console.log('Columns in customers:', custCols);

console.log('--- TEST SUSPENDED QUERY ---');
try {
  const query = `
    SELECT 
      c.id, c.name, c.phone, c.pppoe_username, c.status, c.address, c.ip_address,
      c.due_date, c.isolir_date, c.auto_isolir, c.router_id,
      p.name as package_name, p.price as package_price,
      r.name as router_name,
      (SELECT COUNT(*) FROM invoices WHERE customer_id = c.id AND status = 'unpaid') as unpaid_count,
      (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE customer_id = c.id AND status = 'unpaid') as unpaid_total
    FROM customers c
    LEFT JOIN packages p ON c.package_id = p.id
    LEFT JOIN routers r ON c.router_id = r.id
    WHERE c.status IN ('suspended', 'isolated')
    ORDER BY c.name ASC
  `;
  const res = db.prepare(query).all();
  console.log('Query success! Count:', res.length);
  console.log(res);
} catch (e) {
  console.error('Query error:', e.message);
}
