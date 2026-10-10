const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../database/billing.db'), { readonly: true });
console.log('Audit trail in billing.db:');
try {
  const audits = db.prepare('SELECT * FROM audit_trail ORDER BY id DESC LIMIT 10').all();
  console.log(audits);
} catch (e) {
  console.error(e.message);
}
db.close();
process.exit(0);
