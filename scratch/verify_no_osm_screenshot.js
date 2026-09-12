const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { execSync } = require('child_process');

const baseDir = path.resolve(__dirname, '..');
const viewsDir = path.join(baseDir, 'views');
const tpl = fs.readFileSync(path.join(viewsDir, 'admin/map.ejs'), 'utf8');

const rendered = ejs.render(tpl, {
  lang: 'id',
  title: 'Peta Jaringan & Topologi Fiber Optik',
  company: 'MyAdamedia',
  currentUser: { username: 'admin', role: 'admin' },
  unreadCount: 0,
  customers: [
    { id: '1', name: 'Budi Santoso', lat: -6.200, lng: 106.816, status: 'Aktif', package_name: 'Home 20 Mbps', odp_id: 'ODP-01', cable_path: null }
  ],
  odps: [
    { id: 'ODC-01', name: 'ODC Utama', type: 'ODC', lat: -6.198, lng: 106.810, total_ports: 48, used_ports: 12 }
  ],
  olts: [],
  stats: { totalOdps: 1, totalOdcs: 1, totalPorts: 48, usedPorts: 12, freePorts: 36, activeCustomers: 1, suspendedCustomers: 0, freeCustomers: 0 },
  sidebarSections: [],
  sidebarBottomNavItems: [],
  msg: null,
  settings: { office_lat: '-6.200000', office_lng: '106.816666' },
  t: (key, def) => def || key
}, { filename: path.join(viewsDir, 'admin/map.ejs') });

// In Leaflet, expand the layer control by default so we can see the radio buttons in the screenshot!
const expandedHtml = rendered.replace(
  'L.control.layers(baseMaps).addTo(map);',
  'L.control.layers(baseMaps, null, { collapsed: false }).addTo(map);'
);

const htmlPath = path.join(__dirname, 'verify_no_osm.html');
const imgPath = path.join(__dirname, 'verify_no_osm.png');
fs.writeFileSync(htmlPath, expandedHtml);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
execSync(`"${chromePath}" --headless=new --disable-gpu --window-size=1400,1000 --virtual-time-budget=4000 --screenshot="${imgPath}" "${htmlPath}"`, { stdio: 'inherit' });
console.log('Saved', imgPath);
