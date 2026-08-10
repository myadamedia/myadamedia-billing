/**
 * License Route Handler
 * Manages License Activation Page and License Info Status in Admin Portal
 */
const express = require('express');
const router = express.Router();
const licenseService = require('../../services/licenseService');
const sidebarMenuSvc = require('../../services/sidebarMenuService');
const { getSetting, getSettings } = require('../../config/settingsManager');

function company() {
  return getSetting('company_header', 'ISP Admin');
}

// Middleware untuk memasang variabel lokal template admin (sidebar, company, settings)
router.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.sidebarSections = sidebarMenuSvc.getSidebarSections(req.session);
  res.locals.sidebarBottomNavItems = sidebarMenuSvc.getBottomNavItems(req.session);
  res.locals.settings = getSettings();
  res.locals.company = company();
  res.locals.lang = req.session?.lang || 'id';
  next();
});

// GET Activation Page
router.get('/activate', (req, res) => {
  const status = licenseService.getLicenseStatus();
  res.render('admin/license_activate', {
    title: 'Aktivasi Lisensi Aplikasi',
    activePage: 'license',
    licenseStatus: status,
    machineId: status.machineId,
    error: req.query.error || null,
    success: req.query.success || null
  });
});

// POST Process Activation
router.post('/activate', (req, res) => {
  const { licenseKey } = req.body;

  if (!licenseKey || typeof licenseKey !== 'string') {
    return res.render('admin/license_activate', {
      title: 'Aktivasi Lisensi Aplikasi',
      activePage: 'license',
      licenseStatus: licenseService.getLicenseStatus(),
      machineId: licenseService.getMachineId(),
      error: 'Masukkan License Key yang valid.',
      success: null
    });
  }

  const result = licenseService.activateLicense(licenseKey.trim());

  if (!result.valid) {
    return res.render('admin/license_activate', {
      title: 'Aktivasi Lisensi Aplikasi',
      activePage: 'license',
      licenseStatus: result,
      machineId: result.machineId,
      error: result.reason || 'Gagal memverifikasi Lisensi Key.',
      success: null
    });
  }

  return res.render('admin/license_activate', {
    title: 'Aktivasi Lisensi Aplikasi',
    activePage: 'license',
    licenseStatus: result,
    machineId: result.machineId,
    error: null,
    success: `Aktivasi Berhasil! Lisensi Seumur Hidup atas nama "${result.companyName}" telah Aktif.`
  });
});

// GET License Status in Settings Panel
router.get('/', (req, res) => {
  const status = licenseService.getLicenseStatus();
  res.render('admin/license_status', {
    title: 'Informasi Lisensi Aplikasi',
    activePage: 'license',
    licenseStatus: status
  });
});

// GET API Status Endpoint
router.get('/api/status', (req, res) => {
  const status = licenseService.getLicenseStatus();
  res.json(status);
});

module.exports = router;
