const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const html = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { margin: 0; background: #0f172a; }
    #map1, #map2, #map3 { width: 400px; height: 350px; float: left; margin: 10px; border-radius: 12px; }
    
    /* Option 1: Clean Cyberpunk Dark filter on Google Roads */
    .tiles-dark-google {
      filter: invert(100%) hue-rotate(180deg) brightness(90%) contrast(95%);
    }

    /* Option 2: Deep Midnight Dark filter */
    .tiles-midnight-google {
      filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
    }
  </style>
</head>
<body>
  <div id="map1"></div>
  <div id="map2"></div>
  <div id="map3"></div>
  <script>
    const center = [-6.2, 106.816666];

    // Map 1: Invert 180deg Google Roads (Sleek Dark Mode)
    const m1 = L.map('map1').setView(center, 14);
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      className: 'tiles-dark-google'
    }).addTo(m1);

    // Map 2: Midnight Dark
    const m2 = L.map('map2').setView(center, 14);
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      className: 'tiles-midnight-google'
    }).addTo(m2);

    // Map 3: Esri Dark Gray with maxNativeZoom: 16
    const m3 = L.map('map3').setView(center, 14);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 16, maxZoom: 20,
      attribution: '© Esri'
    }).addTo(m3);
  </script>
</body>
</html>`;

const htmlPath = path.join(__dirname, 'test_dark_options.html');
const imgPath = path.join(__dirname, 'test_dark_options.png');
fs.writeFileSync(htmlPath, html);
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
execSync(`"${chromePath}" --headless=new --disable-gpu --window-size=1300,450 --virtual-time-budget=3000 --screenshot="${imgPath}" "${htmlPath}"`, { stdio: 'inherit' });
console.log('Saved', imgPath);
