const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-'));
const html = path.resolve('scratch/test.html');
fs.writeFileSync(html, '<html><body style="background:#0b0f19;color:white;padding:40px;"><h1>Testing Screenshot OK</h1></body></html>');
const img = path.resolve('scratch/test.png');

console.log('Starting screenshot...');
const t0 = Date.now();
const res = spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--no-first-run',
  '--user-data-dir=' + tmpDir,
  '--screenshot=' + img,
  '--window-size=1280,800',
  html
], { timeout: 10000 });

console.log('Finished in', Date.now() - t0, 'ms. Exists:', fs.existsSync(img));
if (fs.existsSync(img)) console.log('Size:', fs.statSync(img).size);
fs.rmSync(tmpDir, { recursive: true, force: true });
if (fs.existsSync(html)) fs.unlinkSync(html);
if (fs.existsSync(img)) fs.unlinkSync(img);
