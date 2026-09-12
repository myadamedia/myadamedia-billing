const { spawn } = require('child_process');
const http = require('http');

const serverProcess = spawn('node', ['scratch/test_tiles_browser.js'], { stdio: 'inherit' });

setTimeout(() => {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--enable-logging=stderr',
    '--v=1',
    '--virtual-time-budget=6000',
    'http://localhost:4567'
  ]);

  chrome.stdout.on('data', data => {
    console.log('[Chrome stdout]', data.toString());
  });

  chrome.stderr.on('data', data => {
    const s = data.toString();
    if (s.includes('TILE') || s.includes('CONSOLE') || s.includes('Error') || s.includes('error') || s.includes('Failed') || s.includes('carto') || s.includes('openstreetmap')) {
      console.log('[Chrome stderr]', s);
    }
  });

  chrome.on('close', code => {
    console.log('Chrome exited with code:', code);
    serverProcess.kill();
    process.exit(0);
  });
}, 1000);
