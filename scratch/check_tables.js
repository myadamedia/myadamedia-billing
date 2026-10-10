const Database = require('better-sqlite3');
const activeDb = new Database('database/billing.db');
const backupDb = new Database('backups/billing_db_20260913_014759.db');

const getTables = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);
const activeTables = getTables(activeDb);
const backupTables = getTables(backupDb);

console.log('Tables comparison:');
backupTables.forEach(t => {
  const bCount = backupDb.prepare('SELECT count(*) as c FROM ' + t).get().c;
  let aCount = -1;
  try {
    aCount = activeDb.prepare('SELECT count(*) as c FROM ' + t).get().c;
  } catch(e) {}
  console.log(t.padEnd(25), 'Backup:', bCount, 'Active:', aCount);
});
