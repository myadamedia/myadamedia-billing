const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { getSetting, getSettings } = require('../../config/settingsManager');
const { requireAdminSession, restrictToAdmin } = require('./auth');
const { disconnectUserByUsername } = require('../../services/radiusCoaService');
const mikrotikSvc = require('../../services/mikrotikService');

const sidebarMenuSvc = require('../../services/sidebarMenuService');

function company() {
  return getSetting('company_header', 'ISP Admin');
}

function flashMsg(req) {
  const m = req.session._msg;
  delete req.session._msg;
  return m || null;
}

// Middleware untuk memastikan res.locals selalu tersedia untuk template partials
router.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.sidebarSections = sidebarMenuSvc.getSidebarSections(req.session);
  res.locals.sidebarBottomNavItems = sidebarMenuSvc.getBottomNavItems(req.session);
  res.locals.settings = getSettings();
  res.locals.company = company();
  next();
});

// ─── 1. DAFTAR ROUTER NAS (RADIUS CLIENTS) ───
router.get('/', requireAdminSession, async (req, res) => {
  try {
    const nasList = db.prepare(`
      SELECT rn.*, r.name as router_name, r.host as router_host
      FROM radius_nas rn
      LEFT JOIN routers r ON rn.router_id = r.id
      ORDER BY rn.id DESC
    `).all();

    const routers = db.prepare('SELECT id, name, host FROM routers WHERE is_active = 1').all();

    res.render('admin/radius/nas_management', {
      title: 'Manajemen RADIUS NAS',
      company: company(),
      activePage: 'radius_nas',
      nasList,
      routers,
      msg: flashMsg(req)
    });
  } catch (err) {
    res.status(500).send('Error rendering RADIUS NAS page: ' + err.message);
  }
});

// Tambah Router NAS Baru
router.post('/nas', requireAdminSession, restrictToAdmin, express.urlencoded({ extended: true }), (req, res) => {
  try {
    const { nasname, shortname, secret, ports, type, description, router_id } = req.body;
    if (!nasname || !shortname || !secret) {
      throw new Error('IP NAS (nasname), Alias (shortname), dan Secret Key wajib diisi.');
    }

    db.prepare(`
      INSERT INTO radius_nas (nasname, shortname, secret, ports, type, description, router_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(nasname).trim(),
      String(shortname).trim(),
      String(secret).trim(),
      Number(ports) || 1812,
      type || 'mikrotik',
      description || '',
      router_id ? Number(router_id) : null
    );

    req.session._msg = { type: 'success', text: `Router NAS ${shortname} (${nasname}) berhasil ditambahkan.` };
  } catch (err) {
    req.session._msg = { type: 'error', text: 'Gagal menambah NAS: ' + err.message };
  }
  res.redirect('/admin/radius');
});

// Edit Router NAS
router.post('/nas/:id/update', requireAdminSession, restrictToAdmin, express.urlencoded({ extended: true }), (req, res) => {
  try {
    const { nasname, shortname, secret, ports, type, description, router_id, is_active } = req.body;

    db.prepare(`
      UPDATE radius_nas SET
        nasname = ?,
        shortname = ?,
        secret = ?,
        ports = ?,
        type = ?,
        description = ?,
        router_id = ?,
        is_active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      String(nasname).trim(),
      String(shortname).trim(),
      String(secret).trim(),
      Number(ports) || 1812,
      type || 'mikrotik',
      description || '',
      router_id ? Number(router_id) : null,
      is_active === '0' ? 0 : 1,
      req.params.id
    );

    req.session._msg = { type: 'success', text: 'Data Router NAS berhasil diperbarui.' };
  } catch (err) {
    req.session._msg = { type: 'error', text: 'Gagal memperbarui NAS: ' + err.message };
  }
  res.redirect('/admin/radius');
});

// Hapus Router NAS
router.post('/nas/:id/delete', requireAdminSession, restrictToAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM radius_nas WHERE id = ?').run(req.params.id);
    req.session._msg = { type: 'success', text: 'Router NAS berhasil dihapus.' };
  } catch (err) {
    req.session._msg = { type: 'error', text: 'Gagal menghapus NAS: ' + err.message };
  }
  res.redirect('/admin/radius');
});

// 1-Click Auto Setup RouterOS RADIUS Client
router.post('/nas/:id/auto-setup', requireAdminSession, restrictToAdmin, async (req, res) => {
  try {
    const nas = db.prepare('SELECT * FROM radius_nas WHERE id = ?').get(req.params.id);
    if (!nas) throw new Error('Data NAS tidak ditemukan.');
    if (!nas.router_id) throw new Error('Router NAS ini belum dihubungkan dengan Router MikroTik di billing.');

    // Ambil IP Server Billing ini (Host tempat Node.js berjalan, atau dari app_settings / req.hostname)
    const serverHost = req.hostname || '127.0.0.1';

    // Eksekusi skrip API di MikroTik untuk mengaktifkan RADIUS PPP & Hotspot
    // 1. /radius/add service=ppp,hotspot address=<serverHost> secret=<secret>
    // 2. /ppp/aaa/set use-radius=yes
    // 3. /ip/hotspot/profile/set [find] use-radius=yes
    const routerRecord = db.prepare('SELECT * FROM routers WHERE id = ?').get(nas.router_id);
    if (!routerRecord) throw new Error('Router MikroTik tidak ditemukan.');

    req.session._msg = { 
      type: 'success', 
      text: `Perintah setup RADIUS disiapkan. Jalankan skrip berikut di Terminal RouterOS:\n` +
            `/radius add service=ppp,hotspot address=${serverHost} secret="${nas.secret}" authentication-port=1812 accounting-port=1813 timeout=3s;\n` +
            `/ppp aaa set use-radius=yes;\n` +
            `/ip hotspot profile set [find] use-radius=yes;`
    };
  } catch (err) {
    req.session._msg = { type: 'error', text: 'Auto Setup Gagal: ' + err.message };
  }
  res.redirect('/admin/radius');
});


// ─── 2. MONITORING ACTIVE SESSIONS & LIVE ACCOUNTING ───
router.get('/sessions', requireAdminSession, async (req, res) => {
  try {
    const activeSessions = db.prepare(`
      SELECT * FROM radius_acct
      WHERE acctstoptime IS NULL
      ORDER BY radacctid DESC
    `).all();

    res.render('admin/radius/active_sessions', {
      title: 'Active RADIUS Sessions',
      company: company(),
      activePage: 'radius_sessions',
      activeSessions,
      msg: flashMsg(req)
    });
  } catch (err) {
    res.status(500).send('Error rendering RADIUS Sessions page: ' + err.message);
  }
});

// JSON API Active Sessions (Untuk Auto-Refresh Frontend)
router.get('/api/sessions', requireAdminSession, (req, res) => {
  try {
    const sessions = db.prepare(`
      SELECT * FROM radius_acct
      WHERE acctstoptime IS NULL
      ORDER BY radacctid DESC
    `).all();
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Post Kick / Disconnect Session (Disconnect-Request CoA)
router.post('/sessions/:username/disconnect', requireAdminSession, restrictToAdmin, async (req, res) => {
  try {
    const username = req.params.username;
    const result = await disconnectUserByUsername(username);

    if (result.success) {
      req.session._msg = { type: 'success', text: `Sesi user ${username} berhasil diputus via RADIUS CoA.` };
    } else {
      req.session._msg = { type: 'warning', text: `Disconnect ${username}: ${result.message}` };
    }
  } catch (err) {
    req.session._msg = { type: 'error', text: 'Gagal disconnect user: ' + err.message };
  }
  res.redirect('/admin/radius/sessions');
});

module.exports = router;
