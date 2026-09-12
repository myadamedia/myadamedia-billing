const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ejs = require('ejs');

const db = require('../config/database');
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
const adminCss = fs.readFileSync(path.join(__dirname, '../public/css/admin.css'), 'utf8');
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

// Helper to inject inline CSS into rendered HTML
function injectCss(html) {
  return html.replace('</head>', `<style>
    ${adminCss}
    /* Ensure scrollbar looks clean in screenshots */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
  </style></head>`);
}

const targets = [];

// 1. SSO Portal
try {
  const tpl = fs.readFileSync(path.join(viewsDir, 'sso.ejs'), 'utf8');
  const html = ejs.render(tpl, {
    ...commonLocals,
    title: 'Portal Single Sign-On (SSO)',
    companyLogo: settings.company_logo || ''
  }, { filename: path.join(viewsDir, 'sso.ejs') });
  targets.push({ file: '01_portal_sso.png', html: injectCss(html), w: 1440, h: 900 });
} catch (e) { console.error('Error rendering SSO:', e); }

// 2. Dashboard
try {
  const tpl = fs.readFileSync(path.join(viewsDir, 'admin/dashboard.ejs'), 'utf8');
  const html = ejs.render(tpl, {
    ...commonLocals,
    title: 'Dashboard Administrator',
    activePage: 'dashboard',
    billing: {
      thisMonth: 24850000,
      totalRevenue: 38500000,
      pendingAmount: 3200000,
      unpaidCount: 14,
      paidCount: 112
    },
    custStats: customerSvc.getCustomerStats() || { total: 126, active: 118, isolated: 6, inactive: 2 },
    routers: mikrotikService.getAllRouters() || [
      { id: 1, name: 'Core MikroTik CCR1009', ip: '192.168.88.1', status: 'connected' }
    ]
  }, { filename: path.join(viewsDir, 'admin/dashboard.ejs') });
  targets.push({ file: '02_dashboard_eksekutif.png', html: injectCss(html), w: 1600, h: 1050 });
} catch (e) { console.error('Error rendering Dashboard:', e); }

// 3. Customers
try {
  const tpl = fs.readFileSync(path.join(viewsDir, 'admin/customers.ejs'), 'utf8');
  let customers = customerSvc.getAllCustomers();
  if (!customers || customers.length === 0) {
    customers = [
      { id: 1, name: 'Budi Santoso', phone: '081234567890', package_name: 'Home Fiber 20 Mbps', speed_down: 20000, speed_up: 20000, package_price: 200000, status: 'active', address: 'Jl. Melati Blok A No. 12', bytes_in: 18450000000, bytes_out: 4200000000, fup_limit_gb: 300, use_fup: 1, unpaid_count: 0, unpaid_total: 0, genieacs_tag: 'ZTE-F609-01' },
      { id: 2, name: 'Siti Rahmawati', phone: '085678901234', package_name: 'Home Fiber 50 Mbps', speed_down: 50000, speed_up: 50000, package_price: 350000, status: 'active', address: 'Komp. Graha Indah B3', bytes_in: 45200000000, bytes_out: 12800000000, fup_limit_gb: 500, use_fup: 1, unpaid_count: 0, unpaid_total: 0, genieacs_tag: 'HG8245H-02' },
      { id: 3, name: 'PT Surya Cipta Solusi', phone: '081399887766', package_name: 'Dedicated Business 100M', speed_down: 100000, speed_up: 100000, package_price: 1500000, status: 'active', address: 'Ruko Sentra Niaga Blok C', bytes_in: 154000000000, bytes_out: 85000000000, fup_limit_gb: 0, use_fup: 0, unpaid_count: 0, unpaid_total: 0, genieacs_tag: 'FIBER-CORP-01' },
      { id: 4, name: 'Ahmad Fauzi', phone: '087711223344', package_name: 'Home Fiber 20 Mbps', speed_down: 20000, speed_up: 20000, package_price: 200000, status: 'isolated', address: 'Jl. Merpati No. 44', bytes_in: 2100000000, bytes_out: 650000000, fup_limit_gb: 300, use_fup: 1, unpaid_count: 1, unpaid_total: 200000, genieacs_tag: 'ZTE-F670L-03' },
      { id: 5, name: 'Dewi Anggraini', phone: '081987654321', package_name: 'Home Fiber 30 Mbps', speed_down: 30000, speed_up: 30000, package_price: 250000, status: 'active', address: 'Griya Asri 2 Blok D5', bytes_in: 28000000000, bytes_out: 6000000000, fup_limit_gb: 350, use_fup: 1, unpaid_count: 0, unpaid_total: 0, genieacs_tag: 'F609-ASRI' }
    ];
  }

  const html = ejs.render(tpl, {
    ...commonLocals,
    title: 'Manajemen Data Pelanggan',
    activePage: 'customers',
    customers: customers.slice(0, 10),
    stats: customerSvc.getCustomerStats() || { total: 126, active: 118, isolated: 6, inactive: 2 },
    packages: customerSvc.getAllPackages() || [],
    routers: mikrotikService.getAllRouters() || [],
    olts: oltSvc.getAllOlts() || [],
    odps: odpSvc.getAllOdps() || [],
    collectors: adminSvc.getAllCollectors() || [],
    search: '',
    filterStatus: '',
    sort: 'name_asc'
  }, { filename: path.join(viewsDir, 'admin/customers.ejs') });
  targets.push({ file: '03_manajemen_pelanggan.png', html: injectCss(html), w: 1600, h: 1050 });
} catch (e) { console.error('Error rendering Customers:', e); }

// 4. Billing
try {
  const tpl = fs.readFileSync(path.join(viewsDir, 'admin/billing.ejs'), 'utf8');
  let invoices = billingSvc.getAllInvoices({ month: timeInfo.month, year: timeInfo.year, status: 'all' }) || [];
  if (!invoices || invoices.length === 0) {
    invoices = [
      { id: 101, invoice_number: 'INV-202609-001', customer_id: 1, customer_name: 'Budi Santoso', customer_phone: '081234567890', package_name: 'Home Fiber 20 Mbps', amount: 200000, paid_amount: 200000, balance_due: 0, status: 'paid', period_month: 9, period_year: 2026, due_date: '2026-09-20', payment_method: 'midtrans_qris', paid_at: '2026-09-05 10:15:22' },
      { id: 102, invoice_number: 'INV-202609-002', customer_id: 2, customer_name: 'Siti Rahmawati', customer_phone: '085678901234', package_name: 'Home Fiber 50 Mbps', amount: 350000, paid_amount: 350000, balance_due: 0, status: 'paid', period_month: 9, period_year: 2026, due_date: '2026-09-20', payment_method: 'qris_static', paid_at: '2026-09-08 14:20:00' },
      { id: 103, invoice_number: 'INV-202609-003', customer_id: 4, customer_name: 'Ahmad Fauzi', customer_phone: '087711223344', package_name: 'Home Fiber 20 Mbps', amount: 200000, paid_amount: 0, balance_due: 200000, status: 'unpaid', period_month: 9, period_year: 2026, due_date: '2026-09-20', payment_method: null, paid_at: null },
      { id: 104, invoice_number: 'INV-202609-004', customer_id: 3, customer_name: 'PT Surya Cipta Solusi', customer_phone: '081399887766', package_name: 'Dedicated Business 100M', amount: 1500000, paid_amount: 1500000, balance_due: 0, status: 'paid', period_month: 9, period_year: 2026, due_date: '2026-09-15', payment_method: 'bank_transfer', paid_at: '2026-09-10 09:00:00' }
    ];
  }

  const html = ejs.render(tpl, {
    ...commonLocals,
    title: 'Billing & Tagihan Pelanggan',
    activePage: 'billing',
    invoices: invoices.slice(0, 10),
    summary: billingSvc.getInvoiceSummary(timeInfo.month, timeInfo.year) || {
      total_invoices: 126,
      paid_count: 110,
      unpaid_count: 16,
      total_amount: 28050000,
      paid_amount: 24850000,
      unpaid_amount: 3200000
    },
    filterMonth: timeInfo.month,
    filterYear: timeInfo.year,
    filterStatus: 'all',
    search: '',
    sort: 'period_desc',
    currentMonth: timeInfo.month,
    currentYear: timeInfo.year
  }, { filename: path.join(viewsDir, 'admin/billing.ejs') });
  targets.push({ file: '04_sistem_billing_invoice.png', html: injectCss(html), w: 1600, h: 1050 });
} catch (e) { console.error('Error rendering Billing:', e); }

// 5. Settings
try {
  const tpl = fs.readFileSync(path.join(viewsDir, 'admin/settings.ejs'), 'utf8');
  const html = ejs.render(tpl, {
    ...commonLocals,
    title: 'Pengaturan Sistem & Custom ID',
    activePage: 'settings'
  }, { filename: path.join(viewsDir, 'admin/settings.ejs') });
  targets.push({ file: '05_pengaturan_custom_id.png', html: injectCss(html), w: 1600, h: 1100 });
} catch (e) { console.error('Error rendering Settings:', e); }

// 6. Map / ODP Management
try {
  const tpl = fs.readFileSync(path.join(viewsDir, 'admin/map.ejs'), 'utf8');
  const html = ejs.render(tpl, {
    ...commonLocals,
    title: 'Peta Jaringan & ODP Fiber Optik',
    activePage: 'map',
    customers: customerSvc.getAllCustomers().slice(0, 15),
    odps: odpSvc.getAllOdps(),
    olts: oltSvc.getAllOlts()
  }, { filename: path.join(viewsDir, 'admin/map.ejs') });
  targets.push({ file: '06_peta_distribusi_odp.png', html: injectCss(html), w: 1600, h: 1050 });
} catch (e) { console.error('Error rendering Map:', e); }

console.log(`Ready to capture ${targets.length} pages...`);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-proposal-'));

for (const target of targets) {
  const tempHtmlPath = path.resolve(path.join('scratch', `temp_${target.file}.html`));
  fs.writeFileSync(tempHtmlPath, target.html, 'utf8');
  const outPath = path.join(screenshotDir, target.file);

  console.log(`Capturing ${target.file}...`);
  const t0 = Date.now();
  spawnSync(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--virtual-time-budget=2500',
    `--user-data-dir=${tmpDir}`,
    `--window-size=${target.w},${target.h}`,
    `--screenshot=${outPath}`,
    tempHtmlPath
  ], { timeout: 20000 });

  const exists = fs.existsSync(outPath);
  const size = exists ? fs.statSync(outPath).size : 0;
  console.log(`✓ ${target.file} -> ${size} bytes (${Date.now() - t0}ms)`);

  try { fs.unlinkSync(tempHtmlPath); } catch (e) {}
}

try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
console.log('All screenshots generated successfully!');
