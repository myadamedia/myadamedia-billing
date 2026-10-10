const Database = require('better-sqlite3');
const path = require('path');

function inspectDb(filePath) {
  console.log('=== Inspecting:', filePath);
  try {
    const db = new Database(filePath, { readonly: true });
    const custCount = db.prepare('SELECT count(*) as c FROM customers').get();
    const odpCount = db.prepare('SELECT count(*) as c FROM odps').get();
    console.log('Customers count:', custCount.c);
    console.log('ODPs count:', odpCount.c);
    if (custCount.c > 0) {
      const sample = db.prepare('SELECT id, name, lat, lng FROM customers LIMIT 3').all();
      console.log('Sample cust:', sample);
    }
    db.close();
  } catch (e) {
    console.error('Error reading db:', e.message);
  }
}

inspectDb(path.join(__dirname, '../database/billing.db'));
inspectDb(path.join(__dirname, '../backups/billing_db_20260913_014759.db'));
inspectDb(path.join(__dirname, '../backups/billing_db_20260623_183738.db'));
process.exit(0);
