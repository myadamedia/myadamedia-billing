const express = require('express');
const router = express.Router();
const { getSetting } = require('../../config/settingsManager');
const adminSvc = require('../../services/adminService');

function company() { return getSetting('company_header', 'ISP Admin'); }

// ─── AUTH MIDDLEWARES ───
function requireAdmin(req, res, next) {
  if (req.session?.isAdmin || req.session?.isCashier) return next();
  const adminKey = getSetting('admin_api_key', '');
  const providedKey = req.headers['x-admin-key'] || req.query.key;
  if (adminKey && providedKey === adminKey) return next();
  return res.status(401).json({ error: 'Unauthorized - Admin/Staff access required' });
}

const sidebarMenuSvc = require('../../services/sidebarMenuService');
const { getSettings } = require('../../config/settingsManager');

function requireAdminSession(req, res, next) {
  if (req.session?.isAdmin || req.session?.isCashier) {
    res.locals.session = req.session;
    res.locals.sidebarSections = sidebarMenuSvc.getSidebarSections(req.session);
    res.locals.sidebarBottomNavItems = sidebarMenuSvc.getBottomNavItems(req.session);
    res.locals.settings = getSettings();
    res.locals.company = company();
    return next();
  }
  return res.redirect('/admin/login');
}

// Middleware strictly for Admin (hanya Super Admin)
function restrictToAdmin(req, res, next) {
  const role = req.session?.adminRole || 'superadmin';
  if (req.session?.isAdmin && role === 'superadmin') return next();
  req.session._msg = { type: 'error', text: 'Hanya Super Admin yang dapat mengakses halaman/tindakan ini.' };
  return res.redirect('/admin');
}

// Middleware for specific roles
function restrictToRoles(allowedRoles) {
  return (req, res, next) => {
    const role = req.session?.adminRole || 'superadmin';
    if (req.session?.isAdmin && (role === 'superadmin' || allowedRoles.includes(role))) {
      return next();
    }
    req.session._msg = { type: 'error', text: 'Anda tidak memiliki hak akses untuk tindakan ini.' };
    return res.redirect('/admin');
  };
}

// ─── AUTH ROUTES ───
router.get('/login', (req, res) => {
  if (req.session?.isAdmin || req.session?.isCashier) return res.redirect('/admin');
  res.render('admin/login', { title: 'Admin Login', company: company(), error: null });
});

router.post('/login', express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;
  
  // 1. Cek Admin Utama (dari settings.json) - Selalu Super Admin
  if (username === getSetting('admin_username', 'admin') && password === getSetting('admin_password', 'admin123')) {
    req.session.isAdmin = true;
    req.session.adminUser = username;
    req.session.adminName = 'Super Admin';
    req.session.adminRole = 'superadmin';
    return res.redirect('/admin');
  }

  // 2. Cek Admin Multi-Tingkat (dari database)
  const admin = adminSvc.authenticateAdmin(username, password);
  if (admin) {
    req.session.isAdmin = true;
    req.session.adminId = admin.id;
    req.session.adminName = admin.name;
    req.session.adminUser = admin.username;
    req.session.adminRole = admin.role; // superadmin, finance, teknisi, kolektor, noc
    return res.redirect('/admin');
  }
  
  // 3. Cek Cashier (Legacy)
  const cashier = adminSvc.authenticateCashier(username, password);
  if (cashier) {
    req.session.isCashier = true;
    req.session.cashierId = cashier.id;
    req.session.cashierName = cashier.name;
    req.session.cashierUsername = cashier.username;
    req.session.adminRole = 'finance'; // Posisikan cashier ke role finance untuk kompatibilitas menu
    return res.redirect('/admin');
  }

  res.render('admin/login', { title: 'Admin Login', company: company(), error: 'Username atau password salah' });
});

router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/admin/login'); });

module.exports = {
  router,
  requireAdmin,
  requireAdminSession,
  restrictToAdmin,
  restrictToRoles
};
