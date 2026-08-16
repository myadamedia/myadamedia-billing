const db = require('../config/database');
const isolatedPortalSvc = require('../services/isolatedPortalService');
const customerSvc = require('../services/customerService');

console.log('--- getSuspendedCustomers from isolatedPortalService ---');
const suspended = isolatedPortalSvc.getSuspendedCustomers();
console.log('Count:', suspended.length);
console.log(suspended);

console.log('--- Customers with status=suspended in DB ---');
const dbSuspended = db.prepare("SELECT id, name, phone, status, isolate_day, pppoe_username FROM customers WHERE status = 'suspended'").all();
console.log(dbSuspended);

console.log('--- Invoices unpaid summary ---');
const unpaidSummary = db.prepare(`
  SELECT 
    c.id, c.name, c.status, c.isolate_day, c.auto_isolate,
    COUNT(i.id) as unpaid_inv_count,
    SUM(i.amount) as unpaid_total
  FROM customers c
  JOIN invoices i ON c.id = i.customer_id AND i.status = 'unpaid'
  GROUP BY c.id
  ORDER BY c.status DESC, unpaid_inv_count DESC
  LIMIT 15
`).all();
console.log(unpaidSummary);
