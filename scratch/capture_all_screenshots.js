const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ejs = require('ejs');
const { spawnSync } = require('child_process');

const customerSvc = require('../services/customerService');
const oltSvc = require('../services/oltService');
const odpSvc = require('../services/odpService');
const adminSvc = require('../services/adminService');
const billingSvc = require('../services/billingService');
const mikrotikService = require('../services/mikrotikService');
const { getSettings, formatCustomerId, getCurrentTimeInfo } = require('../config/settingsManager');

const screenshotDir = path.join(__dirname, '../file md/screenshots');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

const viewsDir = path.join(__dirname, '../views');
const settings = getSettings();
const company = settings.company_header || 'MyAdamedia Digital Ekosistem';
const timeInfo = getCurrentTimeInfo();

const commonLocals = {
  company,
  settings: {
    ...settings,
    customer_id_prefix: 'MDE',
    customer_id_separator: '-',
    customer_id_padding: 4
  },
  formatCustomerId: (id) => formatCustomerId(id, { customer_id_prefix: 'MDE', customer_id_separator: '-', customer_id_padding: 4 }),
  version: '13.0.12',
  lang: 'id',
  t: (k, fb) => fb || k,
  msg: null,
  sidebarSections: [],
  sidebarBottomNavItems: [],
  paymentWebhookUrl: 'http://localhost:3001/customer/payment/callback',
  session: { isAdmin: true, adminName: 'Super Admin', adminRole: 'superadmin' }
};

const renderedPages = {};

console.log('Rendering EJS pages...');

// 1. SSO Portal
try {
  const tpl = fs.readFileSync(path.join(viewsDir, 'sso.ejs'), 'utf8');
  renderedPages['/sso.html'] = ejs.render(tpl, {
    ...commonLocals,
    title: 'Portal Single Sign-On (SSO)',
    companyLogo: settings.company_logo || ''
  }, { filename: path.join(viewsDir, 'sso.ejs') });
  console.log('✓ Rendered /sso.html');
} catch (e) { console.error('Error rendering SSO:', e.message); }

// 2. Dashboard
try {
  const tpl = fs.readFileSync(path.join(viewsDir, 'admin/dashboard.ejs'), 'utf8');
  renderedPages['/dashboard.html'] = ejs.render(tpl, {
    ...commonLocals,
    title: 'Dashboard Administrator',
    activePage: 'dashboard',
    billing: billingSvc.getDashboardStats() || {
      incomeThisMonth: 18500000,
      totalUnpaid: 2400000,
      unpaidCount: 12,
      paidCount: 88,
      todayIncome: 1250000,
      recentInvoices: []
    },
    custStats: customerSvc.getCustomerStats() || { total: 100, active: 94, isolated: 4, inactive: 2 },
    routers: mikrotikService.getAllRouters() || [
      { id: 1, name: 'Core MikroTik CCR1009', ip: '192.168.88.1', status: 'connected' }
    ]
  }, { filename: path.join(viewsDir, 'admin/dashboard.ejs') });
  console.log('✓ Rendered /dashboard.html');
} catch (e) { console.error('Error rendering Dashboard:', e.message); }

// 3. Customers
try {
  const tpl = fs.readFileSync(path.join(viewsDir, 'admin/customers.ejs'), 'utf8');
  const allCust = customerSvc.getAllCustomers();
  const sampleCustomers = allCust.length > 0 ? allCust.slice(0, 10) : [
    { id: 1, name: 'Budi Santoso', phone: '081234567890', package_name: 'Home Fiber 20 Mbps', speed_down: 20000, speed_up: 20000, package_price: 200000, status: 'active', address: 'Jl. Melati Blok A No. 12', bytes_in: 18450000000, bytes_out: 4200000000, fup_limit_gb: 300, use_fup: 1, unpaid_count: 0, unpaid_total: 0, genieacs_tag: 'ZTE-F609-01' },
    { id: 2, name: 'Siti Rahmawati', phone: '085678901234', package_name: 'Home Fiber 50 Mbps', speed_down: 50000, speed_up: 50000, package_price: 350000, status: 'active', address: 'Komp. Graha Indah B3', bytes_in: 45200000000, bytes_out: 12800000000, fup_limit_gb: 500, use_fup: 1, unpaid_count: 0, unpaid_total: 0, genieacs_tag: 'HG8245H-02' },
    { id: 3, name: 'PT Surya Cipta Solusi', phone: '081399887766', package_name: 'Dedicated Business 100M', speed_down: 100000, speed_up: 100000, package_price: 1500000, status: 'active', address: 'Ruko Sentra Niaga Blok C', bytes_in: 154000000000, bytes_out: 85000000000, fup_limit_gb: 0, use_fup: 0, unpaid_count: 0, unpaid_total: 0, genieacs_tag: 'FIBER-CORP-01' },
    { id: 4, name: 'Ahmad Fauzi', phone: '087711223344', package_name: 'Home Fiber 20 Mbps', speed_down: 20000, speed_up: 20000, package_price: 200000, status: 'isolated', address: 'Jl. Merpati No. 44', bytes_in: 2100000000, bytes_out: 650000000, fup_limit_gb: 300, use_fup: 1, unpaid_count: 1, unpaid_total: 200000, genieacs_tag: 'ZTE-F670L-03' }
  ];

  renderedPages['/customers.html'] = ejs.render(tpl, {
    ...commonLocals,
    title: 'Manajemen Data Pelanggan',
    activePage: 'customers',
    customers: sampleCustomers,
    stats: customerSvc.getCustomerStats() || { total: 100, active: 94, isolated: 4, inactive: 2 },
    packages: customerSvc.getAllPackages() || [],
    routers: mikrotikService.getAllRouters() || [],
    olts: oltSvc.getAllOlts() || [],
    odps: odpSvc.getAllOdps() || [],
    collectors: adminSvc.getAllCollectors() || [],
    search: '',
    filterStatus: '',
    sort: 'name_asc'
  }, { filename: path.join(viewsDir, 'admin/customers.ejs') });
  console.log('✓ Rendered /customers.html');
} catch (e) { console.error('Error rendering Customers:', e.message); }

// 4. Billing
try {
  const tpl = fs.readFileSync(path.join(viewsDir, 'admin/billing.ejs'), 'utf8');
  const invoices = billingSvc.getAllInvoices({ month: timeInfo.month, year: timeInfo.year, status: 'all' }) || [];
  const summary = billingSvc.getInvoiceSummary(timeInfo.month, timeInfo.year) || {
    total_invoices: 85,
    paid_count: 72,
    unpaid_count: 13,
    total_amount: 18500000,
    paid_amount: 15700000,
    unpaid_amount: 2800000
  };

  renderedPages['/billing.html'] = ejs.render(tpl, {
    ...commonLocals,
    title: 'Billing & Tagihan Pelanggan',
    activePage: 'billing',
    invoices: invoices.length > 0 ? invoices.slice(0, 12) : [
      { id: 101, invoice_number: 'INV-202609-001', customer_id: 1, customer_name: 'Budi Santoso', customer_phone: '081234567890', package_name: 'Home Fiber 20 Mbps', amount: 200000, paid_amount: 200000, balance_due: 0, status: 'paid', period_month: 9, period_year: 2026, due_date: '2026-09-20', payment_method: 'midtrans_qris', paid_at: '2026-09-05 10:15:22' },
      { id: 102, invoice_number: 'INV-202609-002', customer_id: 2, customer_name: 'Siti Rahmawati', customer_phone: '085678901234', package_name: 'Home Fiber 50 Mbps', amount: 350000, paid_amount: 350000, balance_due: 0, status: 'paid', period_month: 9, period_year: 2026, due_date: '2026-09-20', payment_method: 'qris_static', paid_at: '2026-09-08 14:20:00' },
      { id: 103, invoice_number: 'INV-202609-003', customer_id: 4, customer_name: 'Ahmad Fauzi', customer_phone: '087711223344', package_name: 'Home Fiber 20 Mbps', amount: 200000, paid_amount: 0, balance_due: 200000, status: 'unpaid', period_month: 9, period_year: 2026, due_date: '2026-09-20', payment_method: null, paid_at: null }
    ],
    summary,
    filterMonth: timeInfo.month,
    filterYear: timeInfo.year,
    filterStatus: 'all',
    search: '',
    sort: 'period_desc',
    currentMonth: timeInfo.month,
    currentYear: timeInfo.year
  }, { filename: path.join(viewsDir, 'admin/billing.ejs') });
  console.log('✓ Rendered /billing.html');
} catch (e) { console.error('Error rendering Billing:', e.message); }

// 5. Settings
try {
  const tpl = fs.readFileSync(path.join(viewsDir, 'admin/settings.ejs'), 'utf8');
  renderedPages['/settings.html'] = ejs.render(tpl, {
    ...commonLocals,
    title: 'Pengaturan Sistem & Custom ID',
    activePage: 'settings'
  }, { filename: path.join(viewsDir, 'admin/settings.ejs') });
  console.log('✓ Rendered /settings.html');
} catch (e) { console.error('Error rendering Settings:', e.message); }

// 6. Map / ODP Management
try {
  const tpl = fs.readFileSync(path.join(viewsDir, 'admin/map.ejs'), 'utf8');
  renderedPages['/map.html'] = ejs.render(tpl, {
    ...commonLocals,
    title: 'Peta Jaringan & ODP Fiber Optik',
    activePage: 'map',
    customers: customerSvc.getAllCustomers().slice(0, 20),
    odps: odpSvc.getAllOdps(),
    olts: oltSvc.getAllOlts()
  }, { filename: path.join(viewsDir, 'admin/map.ejs') });
  console.log('✓ Rendered /map.html');
} catch (e) { console.error('Error rendering Map:', e.message); }

// 2. Start HTTP server
const publicDir = path.join(__dirname, '../public');
const server = http.createServer((req, res) => {
  const parsedUrl = req.url.split('?')[0];

  if (renderedPages[parsedUrl]) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(renderedPages[parsedUrl]);
  }

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

const PORT = 4589;
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-capture-'));

  const captures = [
    { url: `http://localhost:${PORT}/sso.html`, file: '01_portal_sso.png', w: 1440, h: 900 },
    { url: `http://localhost:${PORT}/dashboard.html`, file: '02_dashboard_eksekutif.png', w: 1600, h: 1000 },
    { url: `http://localhost:${PORT}/customers.html`, file: '03_manajemen_pelanggan.png', w: 1600, h: 1000 },
    { url: `http://localhost:${PORT}/billing.html`, file: '04_sistem_billing_invoice.png', w: 1600, h: 1000 },
    { url: `http://localhost:${PORT}/settings.html`, file: '05_pengaturan_custom_id.png', w: 1600, h: 1000 },
    { url: `http://localhost:${PORT}/map.html`, file: '06_peta_distribusi_odp.png', w: 1600, h: 1000 }
  ];

  for (const item of captures) {
    const out = path.join(screenshotDir, item.file);
    console.log(`Capturing ${item.file}...`);
    const t0 = Date.now();
    spawnSync(chromePath, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      `--user-data-dir=${tmpProfile}`,
      `--window-size=${item.w},${item.h}`,
      `--screenshot=${out}`,
      item.url
    ], { timeout: 15000 });
    const exists = fs.existsSync(out);
    const size = exists ? fs.statSync(out).size : 0;
    console.log(`✓ ${item.file} saved (${size} bytes, ${Date.now() - t0}ms)`);
  }

  try {
    fs.rmSync(tmpProfile, { recursive: true, force: true });
  } catch (e) {}

  server.close(() => {
    console.log('Capture finished, server closed.');
    process.exit(0);
  });
});
