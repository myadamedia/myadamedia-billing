const Database = require('better-sqlite3');
const path = require('path');

const curDb = new Database(path.join(__dirname, '../database/billing.db'), { readonly: true });
const bkpDb = new Database(path.join(__dirname, '../backups/billing_db_20260913_014759.db'), { readonly: true });

console.log('=== COMPARISON CURRENT VS BACKUP ===');
const tables = bkpDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);

for (const t of tables) {
  let cCur = 0, cBkp = 0;
  try { cCur = curDb.prepare(`SELECT count(*) as c FROM "${t}"`).get().c; } catch(e) { cCur = 'N/A'; }
  try { cBkp = bkpDb.prepare(`SELECT count(*) as c FROM "${t}"`).get().c; } catch(e) { cBkp = 'N/A'; }
  console.log(`${t.padEnd(25)} | Cur: ${String(cCur).padEnd(6)} | Bkp: ${cBkp}`);
}

curDb.close();
bkpDb.close();
process.exit(0);
