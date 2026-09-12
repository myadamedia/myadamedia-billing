/**
 * Service: Backup & Recovery System
 * Melakukan backup otomatis database dan settings
 */
const fs = require('fs');
const path = require('path');
const { logger } = require('../config/logger');
const { getSetting, getSettings, getCurrentDateInTimezone, getNowLocalISO } = require('../config/settingsManager');
const db = require('../config/database');

const projectRoot = path.join(__dirname, '..');
const backupDir = path.join(projectRoot, 'backups');
const dbPath = path.join(projectRoot, 'database', 'billing.db');
const settingsPath = path.join(projectRoot, 'settings.json');

// Pastikan direktori backup ada
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
  logger.info('[Backup] Created backup directory');
}

/**
 * Generate timestamp untuk nama file backup
 */
function getBackupTimestamp() {
  const now = getCurrentDateInTimezone();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Backup database SQLite
 */
function backupDatabase() {
  try {
    const timestamp = getBackupTimestamp();
    const backupFileName = `billing_db_${timestamp}.db`;
    const backupFilePath = path.join(backupDir, backupFileName);

    // Copy database file
    fs.copyFileSync(dbPath, backupFilePath);

    // Compress backup (optional - bisa ditambahkan nanti)
    const stats = fs.statSync(backupFilePath);
    const sizeKB = Math.round(stats.size / 1024);

    logger.info(`[Backup] Database backup created: ${backupFileName} (${sizeKB} KB)`);
    
    return {
      success: true,
      fileName: backupFileName,
      size: stats.size,
      timestamp: getNowLocalISO()
    };
  } catch (e) {
    logger.error(`[Backup] Failed to backup database: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Backup settings.json
 */
function backupSettings() {
  try {
    const timestamp = getBackupTimestamp();
    const backupFileName = `settings_${timestamp}.json`;
    const backupFilePath = path.join(backupDir, backupFileName);

    // Copy settings file
    fs.copyFileSync(settingsPath, backupFilePath);

    const stats = fs.statSync(backupFilePath);
    const sizeKB = Math.round(stats.size / 1024);

    logger.info(`[Backup] Settings backup created: ${backupFileName} (${sizeKB} KB)`);
    
    return {
      success: true,
      fileName: backupFileName,
      size: stats.size,
      timestamp: getNowLocalISO()
    };
  } catch (e) {
    logger.error(`[Backup] Failed to backup settings: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Backup semua (database + settings)
 */
function backupAll() {
  const dbResult = backupDatabase();
  const settingsResult = backupSettings();

  return {
    database: dbResult,
    settings: settingsResult,
    timestamp: getNowLocalISO()
  };
}

/**
 * Restore database dari backup
 */
function restoreDatabase(backupFileName) {
  try {
    const backupFilePath = path.join(backupDir, backupFileName);

    // Cek apakah file backup ada
    if (!fs.existsSync(backupFilePath)) {
      return {
        success: false,
        error: `Backup file not found: ${backupFileName}`
      };
    }

    // Backup database saat ini sebelum restore
    const preRestoreBackup = backupDatabase();
    if (!preRestoreBackup.success) {
      logger.warn('[Backup] Failed to create pre-restore backup');
    }

    // Restore database
    fs.copyFileSync(backupFilePath, dbPath);

    const stats = fs.statSync(dbPath);
    const sizeKB = Math.round(stats.size / 1024);

    logger.info(`[Backup] Database restored from: ${backupFileName} (${sizeKB} KB)`);
    
    return {
      success: true,
      fileName: backupFileName,
      size: stats.size,
      timestamp: getNowLocalISO(),
      preRestoreBackup: preRestoreBackup.fileName
    };
  } catch (e) {
    logger.error(`[Backup] Failed to restore database: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Restore settings dari backup
 */
function restoreSettings(backupFileName) {
  try {
    const backupFilePath = path.join(backupDir, backupFileName);

    // Cek apakah file backup ada
    if (!fs.existsSync(backupFilePath)) {
      return {
        success: false,
        error: `Backup file not found: ${backupFileName}`
      };
    }

    // Backup settings saat ini sebelum restore
    const preRestoreBackup = backupSettings();
    if (!preRestoreBackup.success) {
      logger.warn('[Backup] Failed to create pre-restore backup');
    }

    // Restore settings
    fs.copyFileSync(backupFilePath, settingsPath);

    const stats = fs.statSync(settingsPath);
    const sizeKB = Math.round(stats.size / 1024);

    logger.info(`[Backup] Settings restored from: ${backupFileName} (${sizeKB} KB)`);
    
    return {
      success: true,
      fileName: backupFileName,
      size: stats.size,
      timestamp: getNowLocalISO(),
      preRestoreBackup: preRestoreBackup.fileName
    };
  } catch (e) {
    logger.error(`[Backup] Failed to restore settings: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Daftar semua backup yang tersedia
 */
function listBackups() {
  try {
    const files = fs.readdirSync(backupDir);
    const backups = [];

    for (const file of files) {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      
      // Parse filename untuk mendapatkan tanggal
      let backupDate = null;
      let backupType = null;
      
      if (file.startsWith('billing_db_') && file.endsWith('.db')) {
        backupType = 'database';
        const timestamp = file.replace('billing_db_', '').replace('.db', '');
        backupDate = parseBackupTimestamp(timestamp);
      } else if (file.startsWith('settings_') && file.endsWith('.json')) {
        backupType = 'settings';
        const timestamp = file.replace('settings_', '').replace('.json', '');
        backupDate = parseBackupTimestamp(timestamp);
      }

      backups.push({
        fileName: file,
        type: backupType,
        size: stats.size,
        sizeKB: Math.round(stats.size / 1024),
        created: stats.birthtime,
        createdDate: backupDate,
        modified: stats.mtime
      });
    }

    // Sort by created date (terbaru dulu)
    backups.sort((a, b) => b.created - a.created);

    return {
      success: true,
      backups: backups,
      total: backups.length
    };
  } catch (e) {
    logger.error(`[Backup] Failed to list backups: ${e.message}`);
    return {
      success: false,
      error: e.message,
      backups: []
    };
  }
}

/**
 * Parse timestamp dari nama file backup
 */
function parseBackupTimestamp(timestamp) {
  try {
    // Format: YYYYMMDD_HHMMSS
    const [datePart, timePart] = timestamp.split('_');
    const year = datePart.substring(0, 4);
    const month = datePart.substring(4, 6);
    const day = datePart.substring(6, 8);
    const hours = timePart.substring(0, 2);
    const minutes = timePart.substring(2, 4);
    const seconds = timePart.substring(4, 6);

    return new Date(year, month - 1, day, hours, minutes, seconds);
  } catch (e) {
    return null;
  }
}

/**
 * Hapus backup lama berdasarkan retention policy
 */
function cleanupOldBackups(retentionDays = 30) {
  try {
    const result = listBackups();
    if (!result.success) {
      return result;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedCount = 0;
    const deletedFiles = [];

    for (const backup of result.backups) {
      if (backup.created < cutoffDate) {
        const filePath = path.join(backupDir, backup.fileName);
        fs.unlinkSync(filePath);
        deletedCount++;
        deletedFiles.push(backup.fileName);
        logger.info(`[Backup] Deleted old backup: ${backup.fileName}`);
      }
    }

    return {
      success: true,
      deletedCount,
      deletedFiles,
      retentionDays
    };
  } catch (e) {
    logger.error(`[Backup] Failed to cleanup old backups: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Cek kapasitas backup dan hapus jika perlu
 */
function checkBackupCapacity(maxSizeMB = 500) {
  try {
    const result = listBackups();
    if (!result.success) {
      return result;
    }

    const totalSize = result.backups.reduce((sum, backup) => sum + backup.size, 0);
    const totalSizeMB = totalSize / (1024 * 1024);

    if (totalSizeMB > maxSizeMB) {
      logger.warn(`[Backup] Backup size (${totalSizeMB.toFixed(2)} MB) exceeds limit (${maxSizeMB} MB)`);
      
      // Hapus backup paling lama sampai kapasitas aman
      const sortedBackups = [...result.backups].sort((a, b) => a.created - b.created);
      let deletedCount = 0;
      
      for (const backup of sortedBackups) {
        if (totalSizeMB <= maxSizeMB * 0.8) { // Hapus sampai 80% dari limit
          break;
        }
        
        const filePath = path.join(backupDir, backup.fileName);
        fs.unlinkSync(filePath);
        totalSizeMB -= backup.size / (1024 * 1024);
        deletedCount++;
        logger.info(`[Backup] Deleted backup for capacity: ${backup.fileName}`);
      }

      return {
        success: true,
        action: 'cleanup',
        deletedCount,
        totalSizeMB: totalSizeMB.toFixed(2),
        maxSizeMB
      };
    }

    return {
      success: true,
      action: 'none',
      totalSizeMB: totalSizeMB.toFixed(2),
      maxSizeMB
    };
  } catch (e) {
    logger.error(`[Backup] Failed to check backup capacity: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Jadwal backup otomatis
 */
function scheduleAutoBackup() {
  const nodeCron = require('node-cron');
  const enabled = getSetting('auto_backup_enabled', true);
  const schedule = getSetting('auto_backup_schedule', '0 2 * * *'); // Default jam 2 pagi setiap hari

  if (!enabled) {
    logger.info('[Backup] Auto backup disabled');
    return;
  }

  nodeCron.schedule(schedule, () => {
    logger.info('[Backup] Starting scheduled backup...');
    const result = backupAll();
    
    if (result.database.success && result.settings.success) {
      logger.info('[Backup] Scheduled backup completed successfully');
    } else {
      logger.error('[Backup] Scheduled backup failed');
    }
  });

  logger.info(`[Backup] Auto backup scheduled: ${schedule}`);
}

/**
 * Dapatkan path file backup aman dari nama file
 */
function getBackupFilePath(fileName) {
  if (!fileName) return null;
  const safeName = path.basename(fileName);
  const targetPath = path.join(backupDir, safeName);
  if (!fs.existsSync(targetPath)) return null;
  return targetPath;
}

/**
 * Simpan file database yang di-upload dari browser ke direktori backups/
 */
function saveUploadedDatabase(fileBuffer, originalName) {
  try {
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      return { success: false, error: 'File buffer tidak valid' };
    }

    const ext = path.extname(originalName || '').toLowerCase();
    if (!['.db', '.sqlite', '.sqlite3', '.json'].includes(ext)) {
      return { success: false, error: 'Ekstensi file harus berupa .db, .sqlite, atau .json' };
    }

    const timestamp = getBackupTimestamp();
    const prefix = ext === '.json' ? 'settings_uploaded_' : 'billing_db_uploaded_';
    const newFileName = `${prefix}${timestamp}${ext === '.json' ? '.json' : '.db'}`;
    const targetPath = path.join(backupDir, newFileName);

    fs.writeFileSync(targetPath, fileBuffer);

    const stats = fs.statSync(targetPath);
    const sizeKB = Math.round(stats.size / 1024);

    logger.info(`[Backup] Uploaded database saved: ${newFileName} (${sizeKB} KB)`);

    return {
      success: true,
      fileName: newFileName,
      type: ext === '.json' ? 'settings' : 'database',
      size: stats.size,
      sizeKB,
      timestamp: getNowLocalISO()
    };
  } catch (e) {
    logger.error(`[Backup] Failed to save uploaded database: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Helper untuk membersihkan isi file di dalam sebuah folder tanpa menghapus foldernya
 */
function cleanDirectoryContents(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return 0;
    const entries = fs.readdirSync(dirPath);
    let count = 0;
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(fullPath);
        }
        count++;
      } catch (err) {
        logger.warn(`[Backup] Gagal menghapus berkas ${fullPath}: ${err.message}`);
      }
    }
    return count;
  } catch (e) {
    logger.warn(`[Backup] Error saat membersihkan direktori ${dirPath}: ${e.message}`);
    return 0;
  }
}

/**
 * Mode 2: Factory Reset Total (Siap PT / Klien Baru)
 * - Lisensi dipertahankan secara default (atau dikosongkan jika options.clearLicense === true)
 * - Mandatory pre-flush auto backup
 * - SQLite transaction untuk menghapus data operasional dan sequence
 * - Reseed starter packages, expense categories, inventory categories
 * - Reset template pesan WhatsApp di app_settings
 * - Reset settings.json ke konfigurasi PT baru yang bersih
 * - Clean uploaded files & WhatsApp session
 */
function flushDatabase(options = {}) {
  try {
    logger.warn('[Backup] MEMULAI PROSES FACTORY RESET TOTAL (MODE 2)...');

    // 1. Mandatory Pre-Flush Auto Backup
    const preBackup = backupAll();
    if (!preBackup.database.success || !preBackup.settings.success) {
      const err = preBackup.database.error || preBackup.settings.error || 'Gagal membuat cadangan sebelum flush';
      logger.error(`[Backup] Aborting flush database because pre-backup failed: ${err}`);
      return {
        success: false,
        error: `Auto-backup pra-reset gagal: ${err}. Proses dibatalkan demi keamanan data.`
      };
    }
    logger.info(`[Backup] Pre-flush backup berhasil dibuat: ${preBackup.database.fileName}, ${preBackup.settings.fileName}`);

    // 2. Daftar Tabel Operasional yang Dikosongkan
    const tablesToWipe = [
      'customers',
      'invoices',
      'collector_payment_requests',
      'customer_topup_requests',
      'customer_usage',
      'tickets',
      'expenses',
      'cash_in',
      'vouchers',
      'voucher_batches',
      'voucher_packages',
      'public_voucher_orders',
      'public_ppob_orders',
      'attendance',
      'payroll_slips',
      'payroll_settings',
      'audit_trail',
      'whatsapp_chats',
      'whatsapp_messages',
      'webhook_payment_notifs',
      'acs_tasks',
      'acs_devices',
      'radius_acct',
      'radius_nas',
      'inventory_logs',
      'inventory_stock',
      'inventory_items',
      'odps',
      'olts',
      'routers',
      'genieacs_servers',
      'collectors',
      'technicians',
      'cashiers',
      'agents',
      'agent_hotspot_prices',
      'agent_topup_requests',
      'agent_transactions',
      'investors',
      'packages',
      'expense_categories',
      'inventory_categories'
    ];

    // Cek tabel mana saja yang benar-benar ada di database
    const existingDbTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    const validWipeTables = tablesToWipe.filter(t => existingDbTables.includes(t));

    // 3. Eksekusi Penghapusan dan Reseeding dalam Transaksi SQLite
    db.pragma('foreign_keys = OFF');
    const wipeTransaction = db.transaction(() => {
      // Hapus data tabel operasional
      for (const table of validWipeTables) {
        db.prepare(`DELETE FROM "${table}"`).run();
      }

      // Reset auto-increment sequence
      if (existingDbTables.includes('sqlite_sequence')) {
        db.prepare("DELETE FROM sqlite_sequence").run();
      }

      // Bersihkan non-superadmin dari tabel admins
      if (existingDbTables.includes('admins')) {
        db.prepare("DELETE FROM admins WHERE role != 'superadmin'").run();
        // Pastikan superadmin default tetap ada jika tabel admins kosong
        const adminCount = db.prepare("SELECT COUNT(*) as count FROM admins").get().count;
        if (adminCount === 0) {
          db.prepare("INSERT INTO admins (username, password, name, role) VALUES ('admin', 'admin123', 'Super Admin', 'superadmin')").run();
        }
      }

      // Reseed Kategori Pengeluaran (expense_categories)
      if (existingDbTables.includes('expense_categories')) {
        const insertExpCat = db.prepare(`
          INSERT INTO expense_categories (name, description, icon, color, is_active)
          VALUES (?, ?, ?, ?, 1)
        `);
        const defaultExpCats = [
          ['Operasional Kantor', 'Biaya utilitas, ATK, dan operasional harian kantor', 'bi bi-building', '#3b82f6'],
          ['Gaji & Upah', 'Gaji karyawan, bonus teknisi, dan komisi staf', 'bi bi-people', '#10b981'],
          ['Bandwidth & Upstream', 'Biaya sewa bandwidth ISP utama / upstream', 'bi bi-router', '#6366f1'],
          ['Perangkat & Kabel', 'Pengadaan kabel dropcore, ONT, router, switch', 'bi bi-hdd-network', '#f59e0b'],
          ['Listrik & Utilitas', 'Tagihan PLN PoP / server dan air', 'bi bi-lightning-charge', '#ef4444'],
          ['Promosi & Pemasaran', 'Brosur, spanduk, iklan sosial media', 'bi bi-megaphone', '#8b5cf6']
        ];
        for (const cat of defaultExpCats) {
          insertExpCat.run(...cat);
        }
      }

      // Reseed Paket Internet (packages)
      if (existingDbTables.includes('packages')) {
        const insertPkg = db.prepare(`
          INSERT INTO packages (name, price, speed_down, speed_up, description, is_active)
          VALUES (?, ?, ?, ?, ?, 1)
        `);
        const defaultPkgs = [
          ['Home Basic 10 Mbps', 150000, 10, 10, 'Paket internet fiber optik rumah hemat 10 Mbps'],
          ['Home Fast 20 Mbps', 200000, 20, 20, 'Paket internet fiber optik cepat 20 Mbps'],
          ['Home Pro 50 Mbps', 300000, 50, 50, 'Paket internet fiber optik ultra cepat 50 Mbps']
        ];
        for (const pkg of defaultPkgs) {
          insertPkg.run(...pkg);
        }
      }

      // Reseed Kategori Inventaris (inventory_categories)
      if (existingDbTables.includes('inventory_categories')) {
        const insertInvCat = db.prepare(`
          INSERT INTO inventory_categories (name, description)
          VALUES (?, ?)
        `);
        const defaultInvCats = [
          ['Modem & ONT', 'Perangkat ONT, Modem GPON/EPON, dan Router Wi-Fi'],
          ['Kabel & Konektor', 'Kabel dropcore, patchcord, fast connector, pigtail, joint closure'],
          ['Perangkat Jaringan', 'Switch Hub, Media Converter, SFP, Patch Panel, OLT']
        ];
        for (const cat of defaultInvCats) {
          insertInvCat.run(...cat);
        }
      }

      // Reset template notifikasi WhatsApp di app_settings ke format generik (menghapus data PT lama & rekening)
      if (existingDbTables.includes('app_settings')) {
        const setAppSetting = db.prepare(`
          INSERT INTO app_settings (key, value, updated_at) 
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `);

        setAppSetting.run(
          'whatsapp_auto_billing_message',
          JSON.stringify('Yth. Pelanggan Bapak/Ibu *{{nama}}* (*ID* {{id_pelanggan}}),\n\nKami informasikan tagihan internet Anda telah terbit dan dapat dibayarkan:\n\n📦 *Paket:* {{paket}}\n📅 *Periode:* {{rincian}}\n📅 *Jatuh Tempo:* {{jatuh_tempo}}\n💰 *Total Tagihan:* Rp {{tagihan}}\n\nMohon lakukan pembayaran tepat waktu melalui portal pelanggan: {{link}}\n\nTerima kasih.\n*Admin Billing*')
        );

        setAppSetting.run(
          'whatsapp_billing_qris_message',
          JSON.stringify('Yth. Pelanggan Bapak/Ibu *{{nama}}* (*ID* {{id_pelanggan}}),\n\nBerikut rincian tagihan internet Anda:\n\n📦 *Paket:* {{paket}}\n📅 *Periode:* {{periode}}\n📅 *Jatuh Tempo:* {{jatuh_tempo}}\n💰 *Total Tagihan:* Rp {{tagihan}}\n💰 *Nominal QRIS:* Rp {{qris_nominal}}\n\nSilakan scan QRIS berikut untuk melakukan pembayaran:\n{{qris_qr}}\n\nTerima kasih.\n*Admin Billing*')
        );

        setAppSetting.run(
          'whatsapp_payment_success_message',
          JSON.stringify('Yth. Pelanggan Bapak/Ibu *{{nama}}* (*ID* {{id_pelanggan}}),\n\n✅ *PEMBAYARAN BERHASIL (LUNAS)*\n\n📅 *Periode:* {{periode}}\n💰 *Total Bayar:* Rp {{total}}\n💳 *Metode:* {{metode}}\n\nLayanan internet Anda aktif. Terima kasih atas kepercayaan Anda.\nSalam,\n*Admin Billing*')
        );

        setAppSetting.run(
          'whatsapp_payment_partial_message',
          JSON.stringify('Yth. Pelanggan Bapak/Ibu *{{nama}}* (*ID* {{id_pelanggan}}),\n\n*PEMBAYARAN SEBAGIAN DITERIMA*\n\n📅 *Periode:* {{periode}}\n💰 *Nominal Dibayar:* Rp {{total}}\n💳 *Metode:* {{metode}}\n⚠️ *Sisa Tagihan:* Rp {{sisa_tagihan}}\n\nCatatan: Sisa tagihan akan diperhitungkan pada penagihan berikutnya. Terima kasih.')
        );

        setAppSetting.run(
          'whatsapp_isolir_message',
          JSON.stringify('Yth. Pelanggan Bapak/Ibu *{{nama}}* (*ID* {{id_pelanggan}}),\n\nLayanan internet Anda (Paket {{paket}}) saat ini dinonaktifkan sementara (Terisolir) karena terdapat administrasi tagihan yang belum diselesaikan sebesar *Rp {{tagihan}}*.\n\nSilakan lakukan pembayaran melalui portal pelanggan: {{link}}\n\nTerima kasih.\n*Admin Billing*')
        );

        setAppSetting.run(
          'whatsapp_auto_isolir_message',
          JSON.stringify('Yth. Pelanggan Bapak/Ibu *{{nama}}* (*ID* {{id_pelanggan}}),\n\nPengingat penting: Layanan internet Anda (Paket {{paket}}) akan terisolir otomatis dalam {{hari_h}} hari jika belum diselesaikan.\n\n💰 *Total Tagihan:* Rp {{tagihan}}\n📅 *Jatuh Tempo:* {{jatuh_tempo}}\n\nSilakan lakukan pembayaran melalui portal: {{link}}\n\nTerima kasih.\n*Admin Billing*')
        );
      }
    });

    // Jalankan transaksi
    wipeTransaction();
    db.pragma('foreign_keys = ON');

    // 4. SQLite Checkpoint & VACUUM untuk Merapikan Ukuran Berkas DB
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.exec('VACUUM');
      logger.info('[Backup] SQLite checkpoint and VACUUM completed');
    } catch (vacuumErr) {
      logger.warn(`[Backup] VACUUM warning (non-fatal): ${vacuumErr.message}`);
    }

    // 5. Reset settings.json ke Mode Bersih (PT Baru)
    const currentSettings = getSettings();
    const clearLicense = options.clearLicense === true;

    const preservedUsername = currentSettings.admin_username || 'admin';
    const preservedPassword = currentSettings.admin_password || 'admin123';
    const preservedPort = currentSettings.server_port || 3001;
    const preservedHost = currentSettings.server_host || 'localhost';
    const preservedSecret = currentSettings.session_secret || 'change-this-to-random-secret-key';
    const preservedApiKey = currentSettings.admin_api_key || 'admin-api-key-change-this';
    const preservedTimezone = currentSettings.timezone || 'Asia/Jakarta';

    // Lisensi dipertahankan secara default, KECUALI jika clearLicense === true
    const licenseKeyToSet = clearLicense ? '' : (currentSettings.license_key || '');

    const newSettings = {
      // Core Admin & Server
      admin_username: preservedUsername,
      admin_password: preservedPassword,
      admin_api_key: preservedApiKey,
      server_port: preservedPort,
      server_host: preservedHost,
      session_secret: preservedSecret,
      timezone: preservedTimezone,
      license_key: licenseKeyToSet,

      // Company & Branding (Bersih untuk PT Baru)
      company_header: 'Nama Perusahaan / ISP',
      company_manager: '',
      footer_info: 'Billing & Network Management System',
      company_logo: '',
      company_phone: '',
      company_email: '',
      company_address: '',
      operational_hours: 'Senin - Sabtu: 08.00 - 17.00 WIB',
      public_base_url: '',

      // MikroTik / Router
      mikrotik_host: '',
      mikrotik_user: '',
      mikrotik_password: '',
      mikrotik_port: 8728,
      isolir_day: 20,

      // Payment Gateways
      default_gateway: 'midtrans',
      midtrans_enabled: false,
      midtrans_server_key: '',
      midtrans_client_key: '',
      midtrans_mode: 'sandbox',
      tripay_enabled: false,
      tripay_api_key: '',
      tripay_private_key: '',
      tripay_merchant_code: '',
      tripay_mode: 'sandbox',
      xendit_enabled: false,
      xendit_api_key: '',
      duitku_enabled: false,
      duitku_merchant_code: '',
      duitku_api_key: '',
      duitku_mode: 'sandbox',

      // Static QRIS
      qris_static_enabled: false,
      qris_static_qr_url: '',
      qris_static_payload: '',
      qris_file: '',

      // WhatsApp Integration
      whatsapp_enabled: false,
      whatsapp_auth_folder: 'auth_info_baileys',
      whatsapp_lid_map_file: 'data/wa-lid-map.json',
      whatsapp_admin_numbers: [],
      whatsapp_auto_billing_enabled: false,
      whatsapp_billing_to_customer_enabled: false,
      whatsapp_auto_billing_days: '1',
      whatsapp_auto_isolir_enabled: false,
      whatsapp_auto_isolir_days: '1',
      whatsapp_broadcast_delay: 60,

      // Telegram Bot
      telegram_enabled: false,
      telegram_bot_token: '',
      telegram_admin_id: '',

      // Security
      login_otp_enabled: false,
      collector_auto_approve: 'false',

      // Attendance & Location
      office_lat: '',
      office_lng: '',
      attendance_geofencing: 'false',
      attendance_radius: '100',

      // GenieACS
      genieacs_url: '',
      genieacs_username: '',
      genieacs_password: '',
      genieacs_timeout: 30000,
      genieacs_monitoring_enabled: false,
      genieacs_monitoring_interval: 6,
      genieacs_rxpower_threshold: -28,
      use_builtin_acs: true,

      // Auto Backup
      auto_backup_enabled: false,

      // Isolated Portal Config
      isolated_portal_config: {
        enabled: true,
        cna_push_enabled: true,
        template: 'corporate_navy',
        custom_title: 'Layanan Terisolir',
        custom_message: 'Layanan internet Anda sementara terisolir karena terdapat administrasi tagihan yang belum diselesaikan.',
        custom_wa_message: 'Halo Admin, akun internet saya terisolir. Mohon info pembayaran.',
        walled_garden_domains: [
          'midtrans.com',
          'api.midtrans.com',
          'tripay.co.id',
          'xendit.co',
          'api.xendit.co',
          'qris.id',
          'wa.me',
          'whatsapp.com',
          'api.whatsapp.com'
        ],
        redirect_url: '/isolated',
        auto_sync_mikrotik: false
      }
    };

    fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2), 'utf-8');
    logger.info(`[Backup] Settings.json telah di-reset ke konfigurasi PT baru (Lisensi: ${clearLicense ? 'DIKOSONGKAN' : 'DIPERTAHANKAN'})`);

    // 6. Bersihkan Berkas Upload & Sesi WhatsApp
    const uploadsDir = path.join(projectRoot, 'public', 'uploads');
    const uploadSubdirs = ['logo', 'qris', 'payment_proofs', 'tickets'];
    uploadSubdirs.forEach(sub => {
      const subPath = path.join(uploadsDir, sub);
      cleanDirectoryContents(subPath);
      if (!fs.existsSync(subPath)) {
        fs.mkdirSync(subPath, { recursive: true });
      }
    });

    const baileysDir = path.join(projectRoot, 'auth_info_baileys');
    if (fs.existsSync(baileysDir)) {
      try {
        fs.rmSync(baileysDir, { recursive: true, force: true });
        logger.info('[Backup] WhatsApp auth_info_baileys folder cleared');
      } catch (err) {
        logger.warn(`[Backup] Warning removing auth_info_baileys: ${err.message}`);
      }
    }

    const lidMapFile = path.join(projectRoot, 'data', 'wa-lid-map.json');
    if (fs.existsSync(lidMapFile)) {
      try {
        fs.unlinkSync(lidMapFile);
      } catch (err) {
        // ignore
      }
    }

    logger.info('[Backup] FACTORY RESET TOTAL (MODE 2) BERHASIL SELESAI.');

    return {
      success: true,
      preBackup,
      preBackupFile: preBackup.database.fileName,
      licensePreserved: !clearLicense,
      tablesCleared: validWipeTables.length,
      timestamp: getNowLocalISO()
    };
  } catch (error) {
    logger.error(`[Backup] Factory reset fatal error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  backupDatabase,
  backupSettings,
  backupAll,
  restoreDatabase,
  restoreSettings,
  listBackups,
  cleanupOldBackups,
  checkBackupCapacity,
  scheduleAutoBackup,
  getBackupFilePath,
  saveUploadedDatabase,
  flushDatabase
};

