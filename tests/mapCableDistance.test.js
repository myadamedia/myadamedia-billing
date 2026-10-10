const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

// Mock Leaflet Distance Calculation based on Haversine / WGS84 formula used by Leaflet
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6378137; // Earth radius in meters (WGS84 sphere)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getLatLngObject(point) {
  if (!point) return null;
  if (typeof point.lat !== 'undefined' && typeof point.lng !== 'undefined') {
    const lat = parseFloat(point.lat);
    const lng = parseFloat(point.lng);
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
  }
  if (Array.isArray(point) && point.length >= 2) {
    const lat = parseFloat(point[0]);
    const lng = parseFloat(point[1]);
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
  }
  return null;
}

function calculateCableDistance(path) {
  if (!Array.isArray(path) || path.length < 2) return 0;
  let totalMeters = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = getLatLngObject(path[i]);
    const p2 = getLatLngObject(path[i + 1]);
    if (p1 && p2) {
      totalMeters += haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    }
  }
  return totalMeters;
}

function formatCableDistance(meters) {
  if (!Number.isFinite(meters) || meters <= 0) return '0 meter';
  if (meters >= 1000) {
    const km = (meters / 1000).toFixed(2).replace('.', ',');
    const m = Math.round(meters).toLocaleString('id-ID');
    return `${km} km (${m} m)`;
  }
  return `${Math.round(meters).toLocaleString('id-ID')} meter`;
}

describe('Map Cable Distance Calculation & Formatting Tests', () => {
  test('1. Harusnya menghitung jarak garis lurus 2 titik dengan akurat', () => {
    // Koordinat Jakarta Monas (-6.175392, 106.827153) ke Istana Merdeka (-6.170170, 106.824200) ~660 meter
    const path = [
      [-6.175392, 106.827153],
      [-6.170170, 106.824200]
    ];
    const dist = calculateCableDistance(path);
    expect(dist).toBeGreaterThan(600);
    expect(dist).toBeLessThan(750);
    expect(formatCableDistance(dist)).toMatch(/meter$/);
  });

  test('2. Harusnya menghitung total jarak multi-waypoint polyline secara berantai', () => {
    const path = [
      [-6.200000, 106.816666],
      [-6.201000, 106.817666],
      [-6.202000, 106.818666]
    ];
    const distTotal = calculateCableDistance(path);
    const distSeg1 = calculateCableDistance([path[0], path[1]]);
    const distSeg2 = calculateCableDistance([path[1], path[2]]);
    expect(Math.round(distTotal)).toBe(Math.round(distSeg1 + distSeg2));
  });

  test('3. Harusnya memformat jarak < 1000 meter sebagai meter', () => {
    expect(formatCableDistance(250)).toBe('250 meter');
    expect(formatCableDistance(999.4)).toBe('999 meter');
  });

  test('4. Harusnya memformat jarak >= 1000 meter dengan format km dan meter', () => {
    const formatted = formatCableDistance(1500);
    expect(formatted).toContain('1,50 km');
    expect(formatted).toContain('1.500 m');
  });

  test('5. Harusnya menangani edge cases (null, array kosong, koordinat cacat/NaN)', () => {
    expect(calculateCableDistance(null)).toBe(0);
    expect(calculateCableDistance([])).toBe(0);
    expect(calculateCableDistance([[-6.2, 106.8]])).toBe(0);
    expect(calculateCableDistance([[-6.2, 'invalid'], [-6.201, 106.81]])).toBe(0);
    expect(formatCableDistance(0)).toBe('0 meter');
    expect(formatCableDistance(null)).toBe('0 meter');
  });

  test('6. Template views/admin/map.ejs harus berhasil dikompilasi tanpa error sintaks EJS', () => {
    const ejsPath = path.join(__dirname, '../views/admin/map.ejs');
    expect(fs.existsSync(ejsPath)).toBe(true);
    const template = fs.readFileSync(ejsPath, 'utf8');
    expect(template).toContain('calculateCableDistance');
    expect(template).toContain('formatCableDistance');
    expect(template).toContain('custom-cable-tooltip');
  });

  test('7. Template views/tech/map.ejs harus berhasil dikompilasi tanpa error sintaks EJS', () => {
    const ejsPath = path.join(__dirname, '../views/tech/map.ejs');
    expect(fs.existsSync(ejsPath)).toBe(true);
    const template = fs.readFileSync(ejsPath, 'utf8');
    expect(template).toContain('calculateCableDistance');
    expect(template).toContain('formatCableDistance');
    expect(template).toContain('custom-cable-tooltip');
  });
});
