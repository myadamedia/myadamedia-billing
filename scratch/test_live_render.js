const Database = require('better-sqlite3');
const path = require('path');
const ejs = require('ejs');
const fs = require('fs');

const liveDb = new Database(path.join(__dirname, '../database/billing.db'), { readonly: true });
const customers = liveDb.prepare('SELECT * FROM customers').all();
const odps = liveDb.prepare('SELECT * FROM odps').all();
const olts = liveDb.prepare('SELECT * FROM olts').all();
liveDb.close();

console.log('Customers loaded from LIVE database:', customers.length);
console.log('Customers with lat/lng:', customers.filter(c => c.lat && c.lng).length);
console.log('ODPs loaded from LIVE database:', odps.length);

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
console.log('Contains updated bounds logic:', html.includes('allBoundsCoords'));

fs.writeFileSync(path.join(__dirname, 'rendered_map_live.html'), html);
console.log('SUCCESS: Rendered live map saved to rendered_map_live.html');
process.exit(0);
