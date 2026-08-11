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


function cleanupStaleRadiusSessions() {
  try {
    const nowStr = new Date().toISOString();
    
    // 1. Tutup sesi duplikat lama untuk username yang sama (hanya simpan 1 sesi terbaru)
    db.prepare(`
      UPDATE radius_acct 
      SET acctstoptime = COALESCE(acctupdatetime, ?), 
          acctterminatecause = 'Stale-Session-Closed'
      WHERE acctstoptime IS NULL 
        AND radacctid NOT IN (
          SELECT MAX(radacctid) 
          FROM radius_acct 
          WHERE acctstoptime IS NULL 
          GROUP BY username
        )
    `).run(nowStr);

    // 2. Tutup sesi gantung yang tidak menerima update > 24 jam
    db.prepare(`
      UPDATE radius_acct 
      SET acctstoptime = COALESCE(acctupdatetime, ?), 
          acctterminatecause = 'Session-Timeout'
      WHERE acctstoptime IS NULL 
        AND datetime(COALESCE(acctupdatetime, acctstarttime)) < datetime('now', '-24 hours')
    `).run(nowStr);
  } catch (err) {
    logger.error('Error auto-cleaning RADIUS stale sessions:', err);
  }
}

// In-memory delta tracker untuk menghitung Bps dari akumulasi byte RADIUS
const sessionDeltaTracker = new Map();

// Helper untuk mendapatkan list router ID MikroTik unik
function getActiveRouterIds() {
  const routerIds = new Set();
  try {
    const nasRouters = db.prepare('SELECT DISTINCT router_id FROM radius_nas WHERE is_active = 1 AND router_id IS NOT NULL').all();
    nasRouters.forEach(r => routerIds.add(Number(r.router_id)));

    const activeRouters = db.prepare('SELECT id FROM routers WHERE is_active = 1').all();
    activeRouters.forEach(r => routerIds.add(Number(r.id)));
  } catch (e) {}
  return Array.from(routerIds);
}

// ─── 2. MONITORING ACTIVE SESSIONS & LIVE ACCOUNTING ───
router.get('/sessions', requireAdminSession, async (req, res) => {
  try {
    cleanupStaleRadiusSessions();

    const activeSessions = db.prepare(`
      SELECT * FROM radius_acct
      WHERE acctstoptime IS NULL
      ORDER BY radacctid DESC
    `).all();

    let totalInputOctets = 0;
    let totalOutputOctets = 0;
    let totalLiveRxBps = 0;
    let totalLiveTxBps = 0;

    const now = Date.now();
    const enrichedSessions = activeSessions.map(s => {
      const rxOctets = Number(s.acctoutputoctets || 0);
      const txOctets = Number(s.acctinputoctets || 0);
      const sessionTime = Math.max(1, Number(s.acctsessiontime || 1));

      totalOutputOctets += rxOctets;
      totalInputOctets += txOctets;

      let rxBps = 0;
      let txBps = 0;

      const prev = sessionDeltaTracker.get(s.username);
      if (prev) {
        rxBps = prev.rxBps;
        txBps = prev.txBps;
      } else {
        rxBps = Math.round((rxOctets * 8) / sessionTime);
        txBps = Math.round((txOctets * 8) / sessionTime);
        sessionDeltaTracker.set(s.username, {
          lastRxOctets: rxOctets,
          lastTxOctets: txOctets,
          lastTime: now,
          rxBps,
          txBps
        });
      }

      totalLiveRxBps += rxBps;
      totalLiveTxBps += txBps;

      return {
        ...s,
        rxBps,
        txBps
      };
    });

    res.render('admin/radius/active_sessions', {
      title: 'Active RADIUS Sessions',
      company: company(),
      activePage: 'radius_sessions',
      activeSessions: enrichedSessions,
      totalInputOctets,
      totalOutputOctets,
      totalLiveRxBps,
      totalLiveTxBps,
      msg: flashMsg(req)
    });
  } catch (err) {
    res.status(500).send('Error rendering RADIUS Sessions page: ' + err.message);
  }
});

// JSON API Active Sessions (Untuk Auto-Refresh Frontend & Live Traffic Calculations)
router.get('/api/sessions', requireAdminSession, async (req, res) => {
  try {
    cleanupStaleRadiusSessions();

    const sessions = db.prepare(`
      SELECT * FROM radius_acct
      WHERE acctstoptime IS NULL
      ORDER BY radacctid DESC
    `).all();

    // 1. Dapatkan daftar seluruh MikroTik Router ID yang aktif (hanya query API jika live monitoring aktif)
    const isLive = req.query.live !== '0';
    const routerIds = isLive ? getActiveRouterIds() : [];
    const liveApiTrafficMap = new Map();

    if (routerIds.length > 0) {
      await Promise.all(routerIds.map(async (rid) => {
        try {
          const rates = await mikrotikSvc.getLiveActiveSessionsTraffic(rid);
          for (const [key, val] of rates.entries()) {
            liveApiTrafficMap.set(key, val);
          }
        } catch (e) {
          // Ignore error dari router MikroTik individual
        }
      }));
    }

    const now = Date.now();
    let totalInputOctets = 0;
    let totalOutputOctets = 0;
    let totalLiveRxBps = 0;
    let totalLiveTxBps = 0;

    const enrichedSessions = sessions.map(s => {
      const rxOctets = Number(s.acctoutputoctets || 0); // Download byte
      const txOctets = Number(s.acctinputoctets || 0); // Upload byte
      const sessionTime = Math.max(1, Number(s.acctsessiontime || 1));

      totalOutputOctets += rxOctets;
      totalInputOctets += txOctets;

      const uLower = String(s.username || '').toLowerCase();
      const ipAddr = String(s.framedipaddress || '').trim();

      let rxBps = 0;
      let txBps = 0;
      let trafficSource = 'none';

      // Prioritas 1: Data live rate dari MikroTik RouterOS API Simple Queues
      const apiRate = liveApiTrafficMap.get(uLower) || (ipAddr ? liveApiTrafficMap.get(ipAddr) : null);

      if (apiRate) {
        rxBps = Number(apiRate.rxBps) || 0;
        txBps = Number(apiRate.txBps) || 0;
        trafficSource = 'mikrotik_api';
      } else {
        // Prioritas 2: Delta Bps murni berbasis selisih byte RADIUS Interim update
        const prev = sessionDeltaTracker.get(s.username);
        if (prev) {
          const dt = (now - prev.lastTime) / 1000;
          const rxDelta = rxOctets - prev.lastRxOctets;
          const txDelta = txOctets - prev.lastTxOctets;

          if (rxDelta > 0 && dt > 0) {
            rxBps = Math.round((rxDelta * 8) / dt);
          } else if (prev.rxBps > 0 && (now - prev.lastTime) < 180000) {
            rxBps = prev.rxBps;
          } else if (rxDelta === 0 && (now - prev.lastTime) >= 180000) {
            rxBps = 0;
          } else {
            rxBps = prev.rxBps || Math.round((rxOctets * 8) / sessionTime);
          }

          if (txDelta > 0 && dt > 0) {
            txBps = Math.round((txDelta * 8) / dt);
          } else if (prev.txBps > 0 && (now - prev.lastTime) < 180000) {
            txBps = prev.txBps;
          } else if (txDelta === 0 && (now - prev.lastTime) >= 180000) {
            txBps = 0;
          } else {
            txBps = prev.txBps || Math.round((txOctets * 8) / sessionTime);
          }
        } else {
          // Baseline inisialisasi awal saat server baru dinyalakan / sesi baru pertama dipoll
          rxBps = Math.round((rxOctets * 8) / sessionTime);
          txBps = Math.round((txOctets * 8) / sessionTime);
        }

        // Simpan snapshot posisi saat ini untuk delta berikutnya
        sessionDeltaTracker.set(s.username, {
          lastRxOctets: rxOctets,
          lastTxOctets: txOctets,
          lastTime: now,
          rxBps,
          txBps
        });
        trafficSource = 'radius_delta';
      }

      totalLiveRxBps += rxBps;
      totalLiveTxBps += txBps;

      return {
        ...s,
        rxBps,
        txBps,
        trafficSource
      };
    });

    res.json({
      success: true,
      sessions: enrichedSessions,
      totalInputOctets,
      totalOutputOctets,
      totalLiveRxBps,
      totalLiveTxBps,
      timestamp: now
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// REST API Customer Detail Popup berdasarkan RADIUS Username
router.get('/api/customer-detail', requireAdminSession, (req, res) => {
  try {
    const rawUsername = String(req.query.username || '').trim();
    if (!rawUsername) {
      return res.status(400).json({ success: false, error: 'Username wajib diisi' });
    }

    // 1. Cari data pelanggan berdasarkan pppoe_username, hotspot_username, atau name
    const customer = db.prepare(`
      SELECT c.*, p.name as package_name, p.price as package_price
      FROM customers c
      LEFT JOIN packages p ON c.package_id = p.id
      WHERE LOWER(c.pppoe_username) = LOWER(?)
         OR LOWER(c.hotspot_username) = LOWER(?)
         OR LOWER(c.name) = LOWER(?)
      LIMIT 1
    `).get(rawUsername, rawUsername, rawUsername);

    // 2. Ambil data sesi aktif RADIUS (jika sedang online)
    const activeSession = db.prepare(`
      SELECT * FROM radius_acct
      WHERE acctstoptime IS NULL AND LOWER(username) = LOWER(?)
      ORDER BY radacctid DESC LIMIT 1
    `).get(rawUsername);

    if (!customer) {
      return res.json({
        success: true,
        found: false,
        username: rawUsername,
        message: `Username '${rawUsername}' terhubung di RADIUS, namun belum ditautkan ke profil pelanggan di basis data billing.`,
        activeSession: activeSession || null
      });
    }

    // 3. Ambil ringkasan tagihan (tunggakan)
    const unpaidSummary = db.prepare(`
      SELECT COUNT(*) as unpaid_count, COALESCE(SUM(balance_due), 0) as total_unpaid_amount
      FROM invoices
      WHERE customer_id = ? AND status IN ('unpaid', 'partial')
    `).get(customer.id);

    res.json({
      success: true,
      found: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone || '-',
        address: customer.address || '-',
        connection_type: customer.connection_type || 'PPPoE',
        pppoe_username: customer.pppoe_username || '-',
        hotspot_username: customer.hotspot_username || '-',
        status: customer.status,
        package_name: customer.package_name || 'Tanpa Paket',
        package_price: customer.package_price || 0,
        install_date: customer.install_date || '-',
        isolate_day: customer.isolate_day || 20,
        unpaid_count: unpaidSummary ? unpaidSummary.unpaid_count : 0,
        total_unpaid_amount: unpaidSummary ? unpaidSummary.total_unpaid_amount : 0
      },
      activeSession: activeSession || null
    });
  } catch (err) {
    console.error('[Radius Router] API Customer Detail Error:', err.message);
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
