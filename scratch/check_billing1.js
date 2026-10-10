const Database = require('better-sqlite3');
const path = require('path');

try {
  const db = new Database(path.join(__dirname, '../database/billing1.db'), { readonly: true });
  console.log('Tables in billing1.db:', db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());
  db.close();
} catch (e) {
  console.log('Error billing1.db:', e.message);
}
process.exit(0);
