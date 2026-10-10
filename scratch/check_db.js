const db = require('../config/database');
const count = db.prepare('SELECT count(*) as c FROM customers').get();
console.log('Customer count in DB:', count);
const sample = db.prepare('SELECT id, name, lat, lng, odp_id FROM customers LIMIT 5').all();
console.log('Sample customers:', sample);
const odps = db.prepare('SELECT id, name, lat, lng, type FROM odps LIMIT 5').all();
console.log('Sample odps:', odps);
process.exit(0);
