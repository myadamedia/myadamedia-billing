const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { execSync } = require('child_process');

const viewsDir = path.join(__dirname, '..', 'views');
let tpl = fs.readFileSync(path.join(viewsDir, 'admin/map.ejs'), 'utf8');

// Replace darkLayer.addTo(map) with osm.addTo(map)
tpl = tpl.replace(/darkLayer\.addTo\(map\);/g, 'osm.addTo(map);');

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
  stats: { totalOdps: 1, totalOdcs: 1, totalPorts: 56, usedPorts: 16, freePorts: 40, activeCustomers: 1, suspendedCustomers: 0, freeCustomers: 0 },
  sidebarSections: [],
  sidebarBottomNavItems: [],
  msg: null,
  settings: { office_lat: '-6.200000', office_lng: '106.816666' },
  t: (key, def) => def || key
}, { filename: path.join(viewsDir, 'admin/map.ejs') });

fs.writeFileSync(path.join(__dirname, 'debug_map_real_osm.html'), rendered);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const cmd = `"${chromePath}" --headless=new --disable-gpu --window-size=1400,1200 --virtual-time-budget=4000 --screenshot="${path.join(__dirname, 'debug_map_real_osm.png')}" "${path.join(__dirname, 'debug_map_real_osm.html')}"`;

console.log('Running Chrome for real OSM...');
execSync(cmd, { stdio: 'inherit' });
console.log('Done real OSM screenshot.');
