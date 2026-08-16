const isolatedPortalSvc = require('../services/isolatedPortalService');
const mikrotikSvc = require('../services/mikrotikService');

const suspended = isolatedPortalSvc.getSuspendedCustomers();
const routers = mikrotikSvc.getAllRouters();

console.log('=== TEST RESULT ===');
console.log('Suspended customers count:', suspended.length);
console.log('Target routers count:', routers.length);

if (suspended.length > 0 && routers.length > 0) {
  console.log('SUCCESS! Both queries return valid data.');
} else {
  console.error('FAILED! Some query returned 0.');
}
