const db = require('../config/database');

console.log('=== ALL STATUSES IN DATABASE ===');
const statuses = db.prepare("SELECT status, COUNT(*) as cnt FROM customers GROUP BY status").all();
console.log(statuses);

console.log('=== ALL CUSTOMERS ===');
const all = db.prepare("SELECT id, name, phone, status, due_date, isolir_date, auto_isolir FROM customers ORDER BY id ASC LIMIT 30").all();
console.log(all);

console.log('=== SUSPENDED OR ISOLATED CUSTOMERS ===');
const sus = db.prepare("SELECT id, name, phone, status, due_date, isolir_date, auto_isolir FROM customers WHERE status != 'active'").all();
console.log(sus);
