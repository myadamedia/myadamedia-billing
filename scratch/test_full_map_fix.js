const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const html = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { margin: 0; padding: 10px; background: #0f172a; font-family: sans-serif; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .card { background: #1e293b; padding: 10px; border-radius: 12px; }
    .card h3 { color: #f8fafc; margin: 0 0 8px 0; font-size: 14px; }
    .map-box { height: 320px; border-radius: 8px; overflow: hidden; }

    /* Modern Dark Mode Map Tile Filter */
    .leaflet-tile-dark {
      filter: invert(100%) hue-rotate(180deg) brightness(92%) contrast(96%) !important;
    }
  </style>
</head>
<body>
  <div class="grid">
    <div class="card">
      <h3>1. Mode Gelap (Dark Mode - Zero Watermark, Fast)</h3>
      <div id="map-dark" class="map-box"></div>
    </div>
    <div class="card">
      <h3>2. Satelit (Hybrid Google)</h3>
      <div id="map-sat" class="map-box"></div>
    </div>
    <div class="card">
      <h3>3. Peta Jalan (Google Streets)</h3>
      <div id="map-street" class="map-box"></div>
    </div>
    <div class="card">
      <h3>4. OpenStreetMap (Direct Round-Robin + MaxNativeZoom)</h3>
      <div id="map-osm" class="map-box"></div>
    </div>
  </div>

  <script>
    const center = [-6.200000, 106.816666]; // Jakarta
    const zoom = 15;

    // 1. Dark Mode
    const mapDark = L.map('map-dark').setView(center, zoom);
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      className: 'leaflet-tile-dark',
      attribution: '© Google Maps'
    }).addTo(mapDark);
    L.marker(center).addTo(mapDark).bindPopup('ODC Titik Pusat');

    // 2. Satelit Hybrid
    const mapSat = L.map('map-sat').setView(center, zoom);
    L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '© Google Satellite'
    }).addTo(mapSat);
    L.marker(center).addTo(mapSat);

    // 3. Peta Jalan
    const mapStreet = L.map('map-street').setView(center, zoom);
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '© Google Maps'
    }).addTo(mapStreet);
    L.marker(center).addTo(mapStreet);

    // 4. OSM with maxNativeZoom
    const mapOsm = L.map('map-osm').setView(center, zoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxNativeZoom: 19,
      maxZoom: 20,
      attribution: '© OpenStreetMap'
    }).addTo(mapOsm);
    L.marker(center).addTo(mapOsm);
  </script>
</body>
</html>`;

const htmlPath = path.join(__dirname, 'test_full_map_fix.html');
const imgPath = path.join(__dirname, 'test_full_map_fix.png');
fs.writeFileSync(htmlPath, html);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
execSync(`"${chromePath}" --headless=new --disable-gpu --window-size=1200,800 --virtual-time-budget=4000 --screenshot="${imgPath}" "${htmlPath}"`, { stdio: 'inherit' });
console.log('Saved', imgPath);
