const http = require('http');

// Cek apakah ada admin di database
const db = require('../config/database');
const admin = db.prepare('SELECT * FROM admins LIMIT 1').get();
console.log('Admin in current DB:', admin ? admin.username : 'NO ADMIN');
const custs = db.prepare('SELECT count(*) as c FROM customers').get();
console.log('Customers in current DB:', custs.c);
const odps = db.prepare('SELECT count(*) as c FROM odps').get();
console.log('ODPs in current DB:', odps.c);

process.exit(0);
