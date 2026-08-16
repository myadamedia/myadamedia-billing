const express = require('express');
const router = express.Router();
const sidebarMenuSvc = require('../../services/sidebarMenuService');
const isolatedPortalSvc = require('../../services/isolatedPortalService');
const mikrotikSvc = require('../../services/mikrotikService');
const { getSettingsWithCache } = require('../../config/settingsManager');
const { logger } = require('../../config/logger');
const db = require('../../config/database');

// Middleware otentikasi & permission admin
router.use((req, res, next) => {
  if (!req.session || !req.session.isAdmin) {
    return res.redirect('/admin/login');
  }
  const access = sidebarMenuSvc.evaluateMenuAccess('isolated_portal', req.session);
  if (!access.allowed) {
    req.session._msg = {
      type: 'error',
      text: access.reason === 'locked'
        ? `Menu Portal Isolir terkunci.`
        : 'Anda tidak memiliki akses ke menu Portal Isolir.'
    };
    return res.redirect('/admin');
  }

  res.locals.sidebarSections = sidebarMenuSvc.getSidebarSections(req.session);
  res.locals.sidebarBottomNavItems = sidebarMenuSvc.getBottomNavItems(req.session);
  res.locals.activePage = 'isolated_portal';
  res.locals.company = req.app.locals.company || 'MyAdamedia Billing';
  res.locals.settings = getSettingsWithCache();
  next();
});

// GET /admin/isolated-portal - Halaman utama Manajemen Portal Isolir
router.get('/', (req, res) => {
  try {
    const config = isolatedPortalSvc.getIsolatedPortalConfig();
    const suspendedCustomers = isolatedPortalSvc.getSuspendedCustomers();
    const settings = getSettingsWithCache();
    const billingHost = req.hostname || '192.168.1.100';

    // Ambil daftar router MikroTik dari database
    let routers = [];
    try {
      routers = db.prepare('SELECT id, name, host, port, username, is_active FROM routers ORDER BY name ASC').all();
    } catch (e) {
      logger.warn(`[IsolatedPortalRoute] Router fetch warn: ${e.message}`);
    }

    const mikrotikScript = isolatedPortalSvc.generateMikrotikIsolatedScript(billingHost, 80);

    let msg = null;
    if (req.session._msg) {
      msg = req.session._msg;
      delete req.session._msg;
    }

    res.render('admin/isolated_portal', {
      config,
      suspendedCustomers,
      settings,
      routers,
      mikrotikScript,
      billingHost,
      msg,
      cnaProbes: isolatedPortalSvc.CNA_PROBE_USER_AGENTS_AND_PATHS
    });
  } catch (error) {
    logger.error(`[IsolatedPortalRoute] Error rendering page: ${error.message}`);
    req.session._msg = { type: 'error', text: `Gagal memuat halaman Portal Isolir: ${error.message}` };
    res.redirect('/admin');
  }
});

// POST /admin/isolated-portal/settings - Simpan Pengaturan Portal Isolir
router.post('/settings', (req, res) => {
  try {
    const payload = {
      ...req.body,
      enabled: req.body.enabled === 'true' || req.body.enabled === 'on' || req.body.enabled === true,
      cna_push_enabled: req.body.cna_push_enabled === 'true' || req.body.cna_push_enabled === 'on' || req.body.cna_push_enabled === true,
      auto_sync_mikrotik: req.body.auto_sync_mikrotik === 'true' || req.body.auto_sync_mikrotik === 'on' || req.body.auto_sync_mikrotik === true
    };
    const result = isolatedPortalSvc.saveIsolatedPortalConfig(payload);
    if (result.success) {
      req.session._msg = { type: 'success', text: 'Konfigurasi Portal Isolir & Walled Garden berhasil diperbarui.' };
    } else {
      req.session._msg = { type: 'error', text: `Gagal menyimpan konfigurasi: ${result.error}` };
    }
  } catch (error) {
    logger.error(`[IsolatedPortalRoute] Save settings error: ${error.message}`);
    req.session._msg = { type: 'error', text: `Terjadi kesalahan: ${error.message}` };
  }
  res.redirect('/admin/isolated-portal');
});

// POST /admin/isolated-portal/test-cna - Uji coba CNA Probe secara otomatis
router.post('/test-cna', (req, res) => {
  const { probePath } = req.body;
  const isCna = isolatedPortalSvc.isCnaProbePath(probePath);
  return res.json({
    success: true,
    probePath,
    isCnaProbe: isCna,
    simulatedStatus: 200,
    simulatedAction: isCna ? 'Intercepted! Triggering Push Pop-up Window (HTTP 200 OK + /isolated view)' : 'Normal Pass-through'
  });
});

module.exports = router;
