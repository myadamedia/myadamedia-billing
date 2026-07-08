const adminSvc = require('../services/adminService');
try {
  console.log('Testing authentication...');
  const res = adminSvc.authenticateAdmin('admin', 'admin123');
  console.log('Authentication result:', res);
} catch (e) {
  console.error('Error during authentication:', e);
}
