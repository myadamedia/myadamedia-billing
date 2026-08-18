const db = require('../config/database');

console.log('--- PACKAGES ---');
console.log(db.prepare('SELECT id, name, price FROM packages').all());

console.log('--- CUSTOMER STATUS BREAKDOWN ---');
console.log(db.prepare('SELECT status, count(*) as count FROM customers GROUP BY status').all());

console.log('--- FREE / GRATIS CUSTOMERS ---');
const freeCusts = db.prepare(`
  SELECT c.id, c.name, c.status, c.package_id, c.created_at, p.name as pkg_name, p.price as pkg_price 
  FROM customers c 
  LEFT JOIN packages p ON c.package_id = p.id 
  WHERE LOWER(c.status) = 'free' 
     OR LOWER(COALESCE(p.name, '')) LIKE '%free%' 
     OR LOWER(COALESCE(p.name, '')) LIKE '%gratis%' 
     OR p.price = 0
`).all();
console.log('Found:', freeCusts.length);
console.log(freeCusts);
