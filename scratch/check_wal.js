const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../database/billing.db');
const db = new Database(dbPath);

console.log('Tables and row counts in billing.db:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
for (const t of tables) {
  try {
    const cnt = db.prepare(`SELECT count(*) as c FROM "${t.name}"`).get();
    if (cnt.c > 0) {
      console.log(`- ${t.name}: ${cnt.c}`);
    }
  } catch (e) {
    console.log(`- ${t.name}: error (${e.message})`);
  }
}

// Coba checkpoint WAL
console.log('Checkpointing WAL...');
db.pragma('wal_checkpoint(TRUNCATE)');

console.log('After checkpoint:');
const custCount = db.prepare('SELECT count(*) as c FROM customers').get();
console.log('customers:', custCount.c);
const odpCount = db.prepare('SELECT count(*) as c FROM odps').get();
console.log('odps:', odpCount.c);

db.close();
process.exit(0);
