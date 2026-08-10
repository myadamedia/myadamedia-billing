/**
 * License Guard Middleware
 * Intercepts requests to enforce lifetime license activation before allowing access to Admin portal.
 */
const licenseService = require('../services/licenseService');

function licenseGuard(req, res, next) {
  const path = req.path || '';

  // Whitelisted paths (Static files, API public assets, and activation routes)
  const isWhitelisted = 
    path.startsWith('/css/') ||
    path.startsWith('/js/') ||
    path.startsWith('/images/') ||
    path.startsWith('/fonts/') ||
    path.startsWith('/favicon.ico') ||
    path.startsWith('/admin/license/activate') ||
    path.startsWith('/api/v1/license/status') ||
    path === '/login' ||
    path === '/admin/login';

  if (isWhitelisted) {
    return next();
  }

  // Check license status
  const licenseStatus = licenseService.getLicenseStatus();

  if (licenseStatus.valid) {
    // Attach license info to locals for header/footer display if needed
    res.locals.licenseInfo = licenseStatus;
    return next();
  }

  // If request is AJAX/API, return 403 JSON
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(403).json({
      success: false,
      error: 'LICENSE_REQUIRED',
      message: licenseStatus.reason || 'Aplikasi memerlukan Lisensi Seumur Hidup yang aktif.',
      machineId: licenseStatus.machineId
    });
  }

  // Redirect to Activation Page
  const redirectUrl = '/admin/license/activate' + (licenseStatus.reason ? `?error=${encodeURIComponent(licenseStatus.reason)}` : '');
  return res.redirect(redirectUrl);
}

module.exports = licenseGuard;
