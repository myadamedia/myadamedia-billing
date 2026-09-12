const fs = require('fs');
const http = require('http');

// Let's create a minimal test page with the exact Leaflet tileLayer code from map.ejs
const html = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>#map { width: 800px; height: 600px; }</style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map').setView([-6.2, 106.816666], 13);
    
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    });

    const googleHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '© Google Satellite'
    });

    const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '© CARTO'
    });

    osm.on('tileerror', function(error, tile) {
      console.error('OSM TILE ERROR:', error.url || error.message || error);
    });

    osm.on('tileload', function(e) {
      console.log('OSM TILE LOADED:', e.url);
    });

    darkLayer.on('tileerror', function(error, tile) {
      console.error('CARTO TILE ERROR:', error.url || error.message || error);
    });

    darkLayer.on('tileload', function(e) {
      console.log('CARTO TILE LOADED:', e.url);
    });

    // Test darkLayer first
    darkLayer.addTo(map);

    setTimeout(() => {
      console.log('Switching to OSM...');
      map.removeLayer(darkLayer);
      osm.addTo(map);
    }, 2000);
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

server.listen(4567, () => {
  console.log('Test server running at http://localhost:4567');
});
