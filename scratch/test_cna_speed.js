const isolatedPortalSvc = require('../services/isolatedPortalService');

const testPaths = [
  '/generate_204',
  '/gen_204',
  '/check_network_status.txt',
  '/hotspot-detect.html',
  '/ncsi.txt',
  '/connecttest.txt',
  '/canonical.html',
  '/mobile/status.php'
];

console.log('=== TESTING CNA PROBE PATHS ===');
testPaths.forEach(path => {
  const isCna = isolatedPortalSvc.isCnaProbePath(path);
  console.log(`Path: ${path.padEnd(30)} -> isCna: ${isCna ? 'YES (Match)' : 'NO'}`);
});

console.log('\n=== MIKROTIK SCRIPT GENERATION TEST ===');
const script = isolatedPortalSvc.generateMikrotikIsolatedScript('192.168.1.100', 80);
console.log(script);
