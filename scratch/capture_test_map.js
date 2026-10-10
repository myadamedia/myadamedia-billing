const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const htmlPath = path.join(__dirname, 'rendered_map_live.html');
const outPng = path.join(__dirname, 'rendered_map_live_result.png');
const cmd = `"${chromePath}" --headless=new --disable-gpu --window-size=1600,1200 --virtual-time-budget=6000 --screenshot="${outPng}" "${htmlPath}"`;

console.log('Capturing live map with Chrome...');
try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('Captured screenshot successfully to:', outPng);
} catch (e) {
  console.error('Error capturing screenshot:', e.message);
}
process.exit(0);
