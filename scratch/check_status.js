const db = require('../config/database');

console.log('--- Customer statuses ---');
try {
  const custStats = db.prepare('SELECT status, count(*) as count FROM customers GROUP BY status').all();
  console.log(custStats);
} catch (e) {
  console.error('Cust status error:', e.message);
}

console.log('--- Customer columns ---');
try {
  const info = db.prepare("PRAGMA table_info(customers)").all();
  console.log(info.map(c => c.name));
} catch (e) {
  console.error('Table info error:', e.message);
}

console.log('--- Customers with unpaid / overdue invoices ---');
try {
  const overdue = db.prepare(`
    SELECT c.id, c.name, c.status, c.due_date, c.pppoe_username, count(i.id) as unpaid_invoices
    FROM customers c
    LEFT JOIN invoices i ON c.id = i.customer_id AND i.status = 'unpaid'
    GROUP BY c.id
    HAVING c.status = 'suspended' OR c.status = 'isolated' OR unpaid_invoices > 0
    LIMIT 20
  `).all();
  console.log(overdue);
} catch (e) {
  console.error('Overdue error:', e.message);
}
