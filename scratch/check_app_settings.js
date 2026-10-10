const Database = require('better-sqlite3');
const path = require('path');

const curDb = new Database(path.join(__dirname, '../database/billing.db'), { readonly: true });
const bkpDb = new Database(path.join(__dirname, '../backups/billing_db_20260913_014759.db'), { readonly: true });

console.log('Current app_settings:', curDb.prepare('SELECT * FROM app_settings').all());
console.log('Backup app_settings:', bkpDb.prepare('SELECT * FROM app_settings').all());

curDb.close();
bkpDb.close();
process.exit(0);
