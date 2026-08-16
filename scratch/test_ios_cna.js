const isolatedPortalSvc = require('../services/isolatedPortalService');

const simulatedRequests = [
  // 1. Apple iOS standard request
  {
    headers: {
      host: 'captive.apple.com',
      'user-agent': 'CaptiveNetworkSupport-450.40.1 wispr'
    },
    path: '/hotspot-detect.html'
  },
  // 2. Apple iOS alternative domain
  {
    headers: {
      host: 'www.appleiphonecell.com',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    },
    path: '/'
  },
  // 3. Apple iOS test success request
  {
    headers: {
      host: 'www.apple.com',
      'user-agent': 'CaptiveNetworkSupport-450.40.1 wispr'
    },
    path: '/library/test/success.html'
  },
  // 4. Android Google connectivitycheck
  {
    headers: {
      host: 'connectivitycheck.gstatic.com',
      'user-agent': 'Dalvik/2.1.0 (Linux; U; Android 14; Pixel 7 Build/UQ1A.240105.004)'
    },
    path: '/generate_204'
  },
  // 5. Windows 11 NCSI
  {
    headers: {
      host: 'www.msftconnecttest.com',
      'user-agent': 'Microsoft NCSI'
    },
    path: '/connecttest.txt'
  },
  // 6. Normal browser visit (e.g. user visits /customer/login)
  {
    headers: {
      host: '192.168.1.100',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    },
    path: '/customer/login'
  }
];

console.log('=== TESTING CNA PROBE INTERCEPTOR ===');
simulatedRequests.forEach((req, idx) => {
  const isCna = isolatedPortalSvc.isCnaRequest(req);
  console.log(`[${idx + 1}] Host: ${req.headers.host.padEnd(30)} Path: ${req.path.padEnd(28)} -> isCna: ${isCna ? 'YES (CNA Intercepted!)' : 'NO (Normal Request)'}`);
});
