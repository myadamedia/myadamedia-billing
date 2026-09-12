const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const os = require('os');
const { spawnSync } = require('child_process');
const { getSettings } = require('../config/settingsManager');

const viewsDir = path.join(__dirname, '../views');
const adminCss = fs.readFileSync(path.join(__dirname, '../public/css/admin.css'), 'utf8');
const settings = getSettings();

const tpl = fs.readFileSync(path.join(viewsDir, 'admin/settings.ejs'), 'utf8');
let html = ejs.render(tpl, {
  company: settings.company_header || 'MyAdamedia Digital Ekosistem',
  settings: {
    ...settings,
    customer_id_prefix: 'MDE',
    customer_id_separator: '-',
    customer_id_padding: 4
  },
  version: '13.0.12',
  lang: 'id',
  t: (k, fb) => fb || k,
  msg: null,
  sidebarSections: [],
  sidebarBottomNavItems: [],
  paymentWebhookUrl: 'http://localhost:3001/customer/payment/callback',
  title: 'Pengaturan Sistem & Custom ID',
  activePage: 'settings'
}, { filename: path.join(viewsDir, 'admin/settings.ejs') });

// Inject script to scroll to custom id block and style it
const scrollScript = `
<style>
  ${adminCss}
  /* Highlight custom ID card */
  #cfg_cust_prefix { border-color: #38bdf8 !important; box-shadow: 0 0 10px rgba(56,189,248,0.3) !important; }
</style>
<script>
  window.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('cfg_cust_prefix');
    if (el) {
      el.scrollIntoView({ block: 'center' });
    }
  });
</script>
`;

html = html.replace('</head>', scrollScript + '</head>');

const tempHtml = path.resolve('scratch/temp_settings.html');
fs.writeFileSync(tempHtml, html, 'utf8');
const out = path.resolve('file md/screenshots/05_pengaturan_custom_id.png');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-'));
spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--no-first-run',
  '--virtual-time-budget=2000',
  '--user-data-dir=' + tmpDir,
  '--window-size=1600,1050',
  '--screenshot=' + out,
  tempHtml
], { timeout: 15000 });

console.log('Updated 05_pengaturan_custom_id.png size:', fs.statSync(out).size);
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.unlinkSync(tempHtml);
