const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// We can run Chrome with remote debugging or console logging flag
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const htmlPath = path.join(__dirname, 'rendered_map_live.html');

// Add a script at the very end of rendered_map_live.html to log debug information into an element or window
let html = fs.readFileSync(htmlPath, 'utf8');
const debugSnippet = `
<div id="debug-output" style="display:none;"></div>
<script>
  window.addEventListener('load', () => {
    try {
      const dbg = {
        customersLen: typeof customers !== 'undefined' ? customers.length : 'undefined',
        odpsLen: typeof odps !== 'undefined' ? odps.length : 'undefined',
        activeCustCount: activeCustGroup ? activeCustGroup.getLayers().length : 0,
        odpCount: odpGroup ? odpGroup.getLayers().length : 0,
        mapBounds: map.getBounds(),
        mapCenter: map.getCenter(),
        mapZoom: map.getZoom(),
        errors: window.__errors || []
      };
      document.getElementById('debug-output').textContent = JSON.stringify(dbg);
    } catch(e) {
      document.getElementById('debug-output').textContent = JSON.stringify({ error: e.message });
    }
  });
  window.onerror = function(msg, url, line) {
    window.__errors = window.__errors || [];
    window.__errors.push({ msg, url, line });
  };
</script>
`;

html = html.replace('</body>', debugSnippet + '</body>');
fs.writeFileSync(path.join(__dirname, 'debug_live_diag.html'), html, 'utf8');

const outPng = path.join(__dirname, 'debug_live_diag.png');
const cmd = `"${chromePath}" --headless=new --disable-gpu --window-size=1600,1200 --virtual-time-budget=5000 --dump-dom "${path.join(__dirname, 'debug_live_diag.html')}"`;

console.log('Running Chrome to dump DOM debug...');
const dom = execSync(cmd, { maxBuffer: 50 * 1024 * 1024 }).toString('utf8');
const match = dom.match(/<div id="debug-output"[^>]*>([\s\S]*?)<\/div>/);
if (match) {
  console.log('DEBUG OUTPUT FROM BROWSER:');
  console.log(match[1]);
} else {
  console.log('Debug element not found in DOM.');
}
