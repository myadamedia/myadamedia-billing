const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../backups/billing_db_20260913_014759.db');
const db = new Database(dbPath, { readonly: true });

console.log('Tables and row counts in backup billing_db_20260913_014759.db:');
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
db.close();
process.exit(0);
