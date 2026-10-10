const Database = require('better-sqlite3');
const activeDb = new Database('database/billing.db');
const backupDb = new Database('backups/billing_db_20260913_014759.db');

['customers', 'odps', 'packages', 'routers', 'olts', 'technicians'].forEach(tbl => {
  const activeCols = activeDb.prepare(`PRAGMA table_info(${tbl})`).all().map(c => c.name);
  const backupCols = backupDb.prepare(`PRAGMA table_info(${tbl})`).all().map(c => c.name);
  
  const diff1 = activeCols.filter(x => !backupCols.includes(x));
  const diff2 = backupCols.filter(x => !activeCols.includes(x));
  console.log(`Table ${tbl}:`);
  console.log('  Cols in Active but not in Backup:', diff1);
  console.log('  Cols in Backup but not in Active:', diff2);
});
