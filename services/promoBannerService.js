/**
 * Service: Promo Banner Management
 * Mengelola banner promosi untuk Customer Dashboard & Login serta Admin Dashboard
 */
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { logger } = require('../config/logger');

// Pastikan direktori penyimpanan berkas banner tersedia
const BANNER_UPLOAD_DIR = path.join(__dirname, '../public/uploads/banners');
if (!fs.existsSync(BANNER_UPLOAD_DIR)) {
  try {
    fs.mkdirSync(BANNER_UPLOAD_DIR, { recursive: true });
  } catch (err) {
    logger.error(`[PromoBanner] Gagal membuat direktori uploads/banners: ${err.message}`);
  }
}

/**
 * Inisialisasi tabel promo_banners jika belum ada
 */
function initPromoBannerTable() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS promo_banners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        image_url TEXT NOT NULL,
        target_url TEXT DEFAULT '',
        description TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT (NOW_LOCAL()),
        updated_at DATETIME DEFAULT (NOW_LOCAL())
      );
      CREATE INDEX IF NOT EXISTS idx_promo_banners_active ON promo_banners(is_active, sort_order);
    `);
  } catch (err) {
    logger.error(`[PromoBanner] Gagal inisialisasi tabel promo_banners: ${err.message}`);
  }
}

initPromoBannerTable();

/**
 * Mengambil semua banner promosi (untuk panel Admin)
 * @returns {Array<Object>}
 */
function getAllBanners() {
  try {
    const stmt = db.prepare(`
      SELECT id, title, image_url, target_url, description, sort_order, is_active, created_at, updated_at
      FROM promo_banners
      ORDER BY sort_order ASC, id DESC
    `);
    return stmt.all();
  } catch (err) {
    logger.error(`[PromoBanner] Error getAllBanners: ${err.message}`);
    return [];
  }
}

/**
 * Mengambil banner promosi yang aktif saja (untuk Customer Dashboard & Login)
 * @returns {Array<Object>}
 */
function getActiveBanners() {
  try {
    const stmt = db.prepare(`
      SELECT id, title, image_url, target_url, description, sort_order, is_active, created_at
      FROM promo_banners
      WHERE is_active = 1
      ORDER BY sort_order ASC, id DESC
    `);
    return stmt.all();
  } catch (err) {
    logger.error(`[PromoBanner] Error getActiveBanners: ${err.message}`);
    return [];
  }
}

/**
 * Mengambil banner berdasarkan ID
 * @param {number|string} id
 * @returns {Object|null}
 */
function getBannerById(id) {
  try {
    const stmt = db.prepare(`
      SELECT id, title, image_url, target_url, description, sort_order, is_active, created_at, updated_at
      FROM promo_banners
      WHERE id = ?
    `);
    return stmt.get(Number(id)) || null;
  } catch (err) {
    logger.error(`[PromoBanner] Error getBannerById: ${err.message}`);
    return null;
  }
}

/**
 * Menambahkan banner promosi baru
 * @param {Object} data
 * @param {string} data.title
 * @param {string} data.image_url
 * @param {string} [data.target_url]
 * @param {string} [data.description]
 * @param {number} [data.sort_order]
 * @param {number} [data.is_active]
 * @returns {Object} { id, ... }
 */
function createBanner(data) {
  if (!data || !data.title || !data.image_url) {
    throw new Error('Judul dan berkas gambar banner wajib diisi.');
  }

  const title = String(data.title).trim();
  const imageUrl = String(data.image_url).trim();
  const targetUrl = data.target_url ? String(data.target_url).trim() : '';
  const description = data.description ? String(data.description).trim() : '';
  const sortOrder = Number.isInteger(Number(data.sort_order)) ? Number(data.sort_order) : 0;
  const isActive = data.is_active !== undefined ? (Number(data.is_active) ? 1 : 0) : 1;

  try {
    const stmt = db.prepare(`
      INSERT INTO promo_banners (title, image_url, target_url, description, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW_LOCAL(), NOW_LOCAL())
    `);
    const info = stmt.run(title, imageUrl, targetUrl, description, sortOrder, isActive);
    return {
      id: info.lastInsertRowid,
      title,
      image_url: imageUrl,
      target_url: targetUrl,
      description,
      sort_order: sortOrder,
      is_active: isActive
    };
  } catch (err) {
    logger.error(`[PromoBanner] Error createBanner: ${err.message}`);
    throw err;
  }
}

/**
 * Memperbarui data banner promosi
 * @param {number|string} id
 * @param {Object} data
 * @returns {boolean}
 */
function updateBanner(id, data) {
  const existing = getBannerById(id);
  if (!existing) {
    throw new Error(`Banner dengan ID ${id} tidak ditemukan.`);
  }

  const title = data.title !== undefined ? String(data.title).trim() : existing.title;
  const imageUrl = data.image_url !== undefined ? String(data.image_url).trim() : existing.image_url;
  const targetUrl = data.target_url !== undefined ? String(data.target_url).trim() : existing.target_url;
  const description = data.description !== undefined ? String(data.description).trim() : existing.description;
  const sortOrder = data.sort_order !== undefined && Number.isInteger(Number(data.sort_order)) ? Number(data.sort_order) : existing.sort_order;
  const isActive = data.is_active !== undefined ? (Number(data.is_active) ? 1 : 0) : existing.is_active;

  // Jika URL gambar berubah, hapus gambar lama dari disk
  if (data.image_url && data.image_url !== existing.image_url && existing.image_url.startsWith('/uploads/banners/')) {
    deletePhysicalFile(existing.image_url);
  }

  try {
    const stmt = db.prepare(`
      UPDATE promo_banners
      SET title = ?, image_url = ?, target_url = ?, description = ?, sort_order = ?, is_active = ?, updated_at = NOW_LOCAL()
      WHERE id = ?
    `);
    stmt.run(title, imageUrl, targetUrl, description, sortOrder, isActive, Number(id));
    return true;
  } catch (err) {
    logger.error(`[PromoBanner] Error updateBanner: ${err.message}`);
    throw err;
  }
}

/**
 * Mengubah status aktif / nonaktif banner
 * @param {number|string} id
 * @returns {boolean}
 */
function toggleBannerStatus(id) {
  const existing = getBannerById(id);
  if (!existing) {
    throw new Error(`Banner dengan ID ${id} tidak ditemukan.`);
  }

  const newStatus = existing.is_active ? 0 : 1;
  try {
    const stmt = db.prepare(`
      UPDATE promo_banners
      SET is_active = ?, updated_at = NOW_LOCAL()
      WHERE id = ?
    `);
    stmt.run(newStatus, Number(id));
    return newStatus === 1;
  } catch (err) {
    logger.error(`[PromoBanner] Error toggleBannerStatus: ${err.message}`);
    throw err;
  }
}

/**
 * Menghapus banner promosi beserta berkas fisiknya
 * @param {number|string} id
 * @returns {boolean}
 */
function deleteBanner(id) {
  const existing = getBannerById(id);
  if (!existing) {
    throw new Error(`Banner dengan ID ${id} tidak ditemukan.`);
  }

  // Hapus berkas fisik jika disimpan secara lokal
  if (existing.image_url && existing.image_url.startsWith('/uploads/banners/')) {
    deletePhysicalFile(existing.image_url);
  }

  try {
    const stmt = db.prepare(`DELETE FROM promo_banners WHERE id = ?`);
    stmt.run(Number(id));
    return true;
  } catch (err) {
    logger.error(`[PromoBanner] Error deleteBanner: ${err.message}`);
    throw err;
  }
}

/**
 * Helper internal untuk menghapus berkas gambar dari disk secara aman
 * @param {string} fileUrl e.g. '/uploads/banners/banner-123.jpg'
 */
function deletePhysicalFile(fileUrl) {
  try {
    const filename = path.basename(fileUrl);
    if (!filename) return;
    const fullPath = path.join(BANNER_UPLOAD_DIR, filename);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      logger.info(`[PromoBanner] Berkas gambar ${fullPath} berhasil dihapus.`);
    }
  } catch (err) {
    logger.warn(`[PromoBanner] Gagal menghapus file fisik ${fileUrl}: ${err.message}`);
  }
}

module.exports = {
  BANNER_UPLOAD_DIR,
  initPromoBannerTable,
  getAllBanners,
  getActiveBanners,
  getBannerById,
  createBanner,
  updateBanner,
  toggleBannerStatus,
  deleteBanner
};
