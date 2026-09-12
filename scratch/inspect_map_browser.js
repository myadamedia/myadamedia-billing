const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { execSync } = require('child_process');

const viewsDir = path.join(__dirname, '..', 'views');
const tpl = fs.readFileSync(path.join(viewsDir, 'admin/map.ejs'), 'utf8');

const rendered = ejs.render(tpl, {
  lang: 'id',
  title: 'Peta Jaringan & Topologi Fiber Optik',
  company: 'MyAdamedia',
  currentUser: { username: 'admin', role: 'admin' },
  unreadCount: 0,
  customers: [
    { id: '1', name: 'Budi Santoso', lat: -6.200, lng: 106.816, status: 'Aktif', package_name: 'Home 20 Mbps', odp_id: 'ODP-01', cable_path: null },
    { id: '2', name: 'Siti Aminah', lat: -6.205, lng: 106.820, status: 'Isolir', package_name: 'Home 10 Mbps', odp_id: 'ODP-02', cable_path: null }
  ],
  odps: [
    { id: 'ODC-01', name: 'ODC Utama', type: 'ODC', lat: -6.198, lng: 106.810, total_ports: 48, used_ports: 12 },
    { id: 'ODP-01', name: 'ODP-01', type: 'ODP', lat: -6.201, lng: 106.815, total_ports: 8, used_ports: 4 },
    { id: 'ODP-02', name: 'ODP-02', type: 'ODP', lat: -6.206, lng: 106.819, total_ports: 16, used_ports: 8 }
  ],
  olts: [],
  stats: { totalOdps: 2, totalOdcs: 1, totalPorts: 72, usedPorts: 24, freePorts: 48, activeCustomers: 1, suspendedCustomers: 1, freeCustomers: 0 },
  sidebarSections: [],
  sidebarBottomNavItems: [],
  msg: null,
  settings: { office_lat: '-6.200000', office_lng: '106.816666' },
  t: (key, def) => def || key
}, { filename: path.join(viewsDir, 'admin/map.ejs') });

// Inject script to log tile errors and network errors to console
const injectedHtml = rendered.replace('</body>', `
<script>
  window.addEventListener('load', () => {
    console.log('[MAP_DIAG] Window loaded.');
  });
</script>
</body>`);

fs.writeFileSync(path.join(__dirname, 'debug_map.html'), injectedHtml);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const cmd = `"${chromePath}" --headless=new --disable-gpu --window-size=1400,1200 --virtual-time-budget=4000 --screenshot="${path.join(__dirname, 'debug_map_dark.png')}" "${path.join(__dirname, 'debug_map.html')}"`;

console.log('Running Chrome...');
execSync(cmd, { stdio: 'inherit' });
console.log('Done screenshot.');
