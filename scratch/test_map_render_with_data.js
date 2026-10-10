const Database = require('better-sqlite3');
const path = require('path');
const ejs = require('ejs');
const fs = require('fs');

const bkpDb = new Database(path.join(__dirname, '../backups/billing_db_20260913_014759.db'), { readonly: true });
const customers = bkpDb.prepare('SELECT * FROM customers').all();
const odps = bkpDb.prepare('SELECT * FROM odps').all();
const olts = bkpDb.prepare('SELECT * FROM olts').all();
bkpDb.close();

console.log('Customers loaded from backup:', customers.length);
console.log('Customers with lat/lng:', customers.filter(c => c.lat && c.lng).length);
console.log('ODPs loaded from backup:', odps.length);

const templatePath = path.join(__dirname, '../views/admin/map.ejs');
const tpl = fs.readFileSync(templatePath, 'utf8');

const html = ejs.render(tpl, {
  lang: 'id',
  title: 'Peta Jaringan',
  company: { name: 'MyAdamedia' },
  activePage: 'map',
  sidebarSections: [],
  sidebarBottomNavItems: [],
  customers,
  odps,
  olts,
  opticalData: { summary: {}, customers: {} },
  msg: null,
  settings: {},
  t: (key, fallback) => fallback || key
}, { filename: templatePath });

console.log('Rendered HTML size:', html.length);
console.log('Contains customers data:', html.includes('ABDUL GOFUR'));
console.log('Contains lat/lng in script:', html.includes('-6.38966069'));

fs.writeFileSync(path.join(__dirname, 'rendered_map_test.html'), html);
console.log('Saved rendered_map_test.html successfully!');
process.exit(0);
