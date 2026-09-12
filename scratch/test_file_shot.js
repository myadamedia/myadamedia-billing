const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ejs = require('ejs');

const viewsDir = path.join(__dirname, '../views');
const adminCss = fs.readFileSync(path.join(__dirname, '../public/css/admin.css'), 'utf8');

const ssoTemplate = fs.readFileSync(path.join(viewsDir, 'sso.ejs'), 'utf8');
let rendered = ejs.render(ssoTemplate, {
  company: 'MyAdamedia Digital Ekosistem',
  companyLogo: '',
  title: 'Portal Single Sign-On (SSO)',
  version: '13.0.12',
  lang: 'id',
  t: (k, fb) => fb || k,
  settings: { company_header: 'MyAdamedia Digital Ekosistem' }
}, { filename: path.join(viewsDir, 'sso.ejs') });

// Inject CSS inline
rendered = rendered.replace('</head>', `<style>${adminCss}</style></head>`);

const htmlPath = path.resolve('scratch/test_sso.html');
fs.writeFileSync(htmlPath, rendered);

const imgPath = path.resolve('scratch/test_sso.png');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-'));

console.log('Capturing with virtual-time-budget...');
const t0 = Date.now();
const res = spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--no-first-run',
  '--virtual-time-budget=3000',
  '--user-data-dir=' + tmpDir,
  '--window-size=1440,900',
  '--screenshot=' + imgPath,
  htmlPath
], { timeout: 10000 });

console.log('Done in', Date.now() - t0, 'ms. Exists:', fs.existsSync(imgPath));
if (fs.existsSync(imgPath)) console.log('Size:', fs.statSync(imgPath).size);

fs.rmSync(tmpDir, { recursive: true, force: true });
