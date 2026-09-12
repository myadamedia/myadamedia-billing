const http = require('http');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { spawnSync } = require('child_process');

const customerSvc = require('../services/customerService');
const oltSvc = require('../services/oltService');
const odpSvc = require('../services/odpService');
const adminSvc = require('../services/adminService');
const mikrotikService = require('../services/mikrotikService');
const { getSettings, formatCustomerId } = require('../config/settingsManager');

// Directory for screenshots
const screenshotDir = path.join(__dirname, '../file md/screenshots');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

// 1. Prepare views to render
const viewsDir = path.join(__dirname, '../views');
const settings = getSettings();
const company = settings.company_header || 'MyAdamedia Digital Ekosistem';

// Common locals
const commonLocals = {
  company,
  settings,
  formatCustomerId,
  version: '13.0.12',
  lang: 'id',
  t: (k, fb) => fb || k,
  msg: null,
  sidebarSections: [],
  sidebarBottomNavItems: [],
  paymentWebhookUrl: 'http://localhost:3001/customer/payment/callback'
};

const renderedPages = {};

try {
  // Page 1: SSO Gateway
  const ssoTemplate = fs.readFileSync(path.join(viewsDir, 'sso.ejs'), 'utf8');
  renderedPages['/sso.html'] = ejs.render(ssoTemplate, {
    ...commonLocals,
    title: 'Portal Single Sign-On (SSO)',
    companyLogo: settings.company_logo || ''
  }, { filename: path.join(viewsDir, 'sso.ejs') });
  console.log('SSO rendered successfully');

  // Page 2: Customers
  const customersTemplate = fs.readFileSync(path.join(viewsDir, 'admin/customers.ejs'), 'utf8');
  const allCustomers = customerSvc.getAllCustomers();
  const sampleCustomers = allCustomers.length > 0 ? allCustomers.slice(0, 15) : [
    { id: 1, name: 'Budi Santoso', phone: '081234567890', package_name: 'Home Fiber 20 Mbps', speed_down: 20000, speed_up: 20000, package_price: 200000, status: 'active', address: 'Jl. Melati Blok A No. 12', bytes_in: 15000000000, bytes_out: 5000000000, fup_limit_gb: 300, use_fup: 1, unpaid_count: 0, unpaid_total: 0, genieacs_tag: 'ZTE-F609' },
    { id: 2, name: 'Siti Rahmawati', phone: '085678901234', package_name: 'Home Fiber 50 Mbps', speed_down: 50000, speed_up: 50000, package_price: 350000, status: 'active', address: 'Komp. Graha Indah B3', bytes_in: 45000000000, bytes_out: 12000000000, fup_limit_gb: 500, use_fup: 1, unpaid_count: 0, unpaid_total: 0, genieacs_tag: 'HG8245H' },
    { id: 3, name: 'PT Surya Cipta Solusi', phone: '081399887766', package_name: 'Dedicated Business 100M', speed_down: 100000, speed_up: 100000, package_price: 1500000, status: 'active', address: 'Ruko Sentra Niaga Blok C', bytes_in: 120000000000, bytes_out: 80000000000, fup_limit_gb: 0, use_fup: 0, unpaid_count: 0, unpaid_total: 0, genieacs_tag: 'FIBER-01' },
    { id: 4, name: 'Ahmad Fauzi', phone: '087711223344', package_name: 'Home Fiber 20 Mbps', speed_down: 20000, speed_up: 20000, package_price: 200000, status: 'isolated', address: 'Jl. Merpati No. 44', bytes_in: 2000000000, bytes_out: 500000000, fup_limit_gb: 300, use_fup: 1, unpaid_count: 1, unpaid_total: 200000, genieacs_tag: 'ZTE-F670' }
  ];

  renderedPages['/customers.html'] = ejs.render(customersTemplate, {
    ...commonLocals,
    title: 'Manajemen Data Pelanggan',
    activePage: 'customers',
    customers: sampleCustomers,
    stats: customerSvc.getCustomerStats() || { total: 150, active: 142, isolated: 6, inactive: 2 },
    packages: customerSvc.getAllPackages() || [],
    routers: mikrotikService.getAllRouters() || [],
    olts: oltSvc.getAllOlts() || [],
    odps: odpSvc.getAllOdps() || [],
    collectors: adminSvc.getAllCollectors() || [],
    search: '',
    filterStatus: '',
    sort: 'name_asc'
  }, { filename: path.join(viewsDir, 'admin/customers.ejs') });
  console.log('Customers rendered successfully');

  // Page 3: Settings
  const settingsTemplate = fs.readFileSync(path.join(viewsDir, 'admin/settings.ejs'), 'utf8');
  renderedPages['/settings.html'] = ejs.render(settingsTemplate, {
    ...commonLocals,
    title: 'Pengaturan Sistem & Custom ID',
    activePage: 'settings'
  }, { filename: path.join(viewsDir, 'admin/settings.ejs') });
  console.log('Settings rendered successfully');

} catch (err) {
  console.error('Render error:', err);
}

// 2. Start lightweight static web server
const publicDir = path.join(__dirname, '../public');
const server = http.createServer((req, res) => {
  const parsedUrl = req.url.split('?')[0];

  if (renderedPages[parsedUrl]) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(renderedPages[parsedUrl]);
  }

  // Static file from public
  const filePath = path.join(publicDir, parsedUrl.replace(/^\//, ''));
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    return res.end(fs.readFileSync(filePath));
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(4556, () => {
  console.log('Screenshot capture server running on port 4556');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const pagesToCapture = [
    { url: 'http://localhost:4556/sso.html', file: '01_portal_sso.png', w: 1440, h: 900 },
    { url: 'http://localhost:4556/customers.html', file: '02_manajemen_pelanggan.png', w: 1600, h: 1000 },
    { url: 'http://localhost:4556/settings.html', file: '03_pengaturan_custom_id.png', w: 1600, h: 1000 }
  ];

  for (const page of pagesToCapture) {
    const outPath = path.join(screenshotDir, page.file);
    console.log(`Capturing ${page.url} to ${page.file}...`);
    const res = spawnSync(chromePath, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--window-size=${page.w},${page.h}`,
      `--screenshot=${outPath}`,
      page.url
    ]);
    console.log(`Finished ${page.file}, size: ${fs.existsSync(outPath) ? fs.statSync(outPath).size : 0} bytes`);
  }

  server.close(() => {
    console.log('Capture completed and server closed');
    process.exit(0);
  });
});
