/**
 * investor/routes/adminInvestors.js
 * Express Router untuk Admin Mengelola Akun Investor (/admin/investors/*)
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { hashPassword } = require('../../utils/securityHelper');
const { requireAdminSession } = require('../../routes/admin/auth');
const sidebarMenuSvc = require('../../services/sidebarMenuService');
const { getSettings } = require('../../config/settingsManager');

// Middleware untuk memastikan res.locals selalu tersedia untuk partials & sidebar admin
router.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.sidebarSections = sidebarMenuSvc.getSidebarSections(req.session);
  res.locals.sidebarBottomNavItems = sidebarMenuSvc.getBottomNavItems(req.session);
  res.locals.settings = getSettings();
  res.locals.company = getSettings().company_header || 'ISP Admin';
  next();
});

router.use(requireAdminSession);

/**
 * GET /admin/investors - Menampilkan Daftar Investor & Modal Tambah/Edit
 */
router.get('/', (req, res) => {
  try {
    const investors = db.prepare(`SELECT * FROM investors ORDER BY id DESC`).all();

    // Hitung total share % teralokasi
    const totalSharePercent = investors.reduce((sum, inv) => sum + (Number(inv.share_percentage) || 0), 0);

    res.render('../investor/views/admin_investors', {
      investors,
      totalSharePercent,
      error: req.query.error || null,
      success: req.query.success || null,
      session: req.session
    });
  } catch (err) {
    console.error('[Admin Investors] Error list:', err.message);
    res.status(500).send('Terjadi kesalahan saat memuat data investor.');
  }
});

/**
 * POST /admin/investors - Menambah Akun Investor Baru
 */
router.post('/', (req, res) => {
  try {
    const { name, username, password, share_percentage } = req.body;

    if (!name || !username || !password) {
      return res.redirect('/admin/investors?error=' + encodeURIComponent('Nama, Username, dan Password wajib diisi.'));
    }

    // Cek duplikasi username
    const existing = db.prepare(`SELECT id FROM investors WHERE username = ?`).get(username.trim());
    if (existing) {
      return res.redirect('/admin/investors?error=' + encodeURIComponent('Username sudah digunakan oleh investor lain.'));
    }

    const shareVal = parseFloat(share_percentage) || 0;
    const hashedPassword = hashPassword(password.trim());

    db.prepare(`
      INSERT INTO investors (name, username, password, share_percentage, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(name.trim(), username.trim(), hashedPassword, shareVal);

    return res.redirect('/admin/investors?success=' + encodeURIComponent('Berhasil menambahkan akun investor baru.'));
  } catch (err) {
    console.error('[Admin Investors] Error add:', err.message);
    return res.redirect('/admin/investors?error=' + encodeURIComponent('Gagal menambahkan investor: ' + err.message));
  }
});

/**
 * POST /admin/investors/:id/update - Mengubah Data Akun Investor
 */
router.post('/:id/update', (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, password, share_percentage, is_active } = req.body;

    const investor = db.prepare(`SELECT * FROM investors WHERE id = ?`).get(id);
    if (!investor) {
      return res.redirect('/admin/investors?error=' + encodeURIComponent('Data investor tidak ditemukan.'));
    }

    // Cek username unik jika diubah
    if (username.trim() !== investor.username) {
      const dup = db.prepare(`SELECT id FROM investors WHERE username = ? AND id != ?`).get(username.trim(), id);
      if (dup) {
        return res.redirect('/admin/investors?error=' + encodeURIComponent('Username sudah digunakan investor lain.'));
      }
    }

    const shareVal = parseFloat(share_percentage) || 0;
    const activeVal = is_active === '1' || is_active === 1 || is_active === 'on' ? 1 : 0;

    let newPasswordHash = investor.password;
    if (password && password.trim() !== '') {
      newPasswordHash = hashPassword(password.trim());
    }

    db.prepare(`
      UPDATE investors
      SET name = ?, username = ?, password = ?, share_percentage = ?, is_active = ?, updated_at = NOW_LOCAL()
      WHERE id = ?
    `).run(name.trim(), username.trim(), newPasswordHash, shareVal, activeVal, id);

    return res.redirect('/admin/investors?success=' + encodeURIComponent('Data investor berhasil diperbarui.'));
  } catch (err) {
    console.error('[Admin Investors] Error update:', err.message);
    return res.redirect('/admin/investors?error=' + encodeURIComponent('Gagal memperbarui investor: ' + err.message));
  }
});

/**
 * POST /admin/investors/:id/delete - Menghapus Akun Investor
 */
router.post('/:id/delete', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare(`DELETE FROM investors WHERE id = ?`).run(id);
    return res.redirect('/admin/investors?success=' + encodeURIComponent('Akun investor berhasil dihapus.'));
  } catch (err) {
    console.error('[Admin Investors] Error delete:', err.message);
    return res.redirect('/admin/investors?error=' + encodeURIComponent('Gagal menghapus investor: ' + err.message));
  }
});

module.exports = router;
