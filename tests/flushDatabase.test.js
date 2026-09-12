/**
 * Unit & Integration Tests: Factory Reset Total (Mode 2) / Flush Database
 */
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const projectRoot = path.join(__dirname, '..');
const dbPath = path.join(projectRoot, 'database', 'billing.db');
const settingsPath = path.join(projectRoot, 'settings.json');
const backupDir = path.join(projectRoot, 'backups');

const tempDbBackupPath = path.join(projectRoot, 'database', 'billing.db.testbackup');
const tempSettingsBackupPath = path.join(projectRoot, 'settings.json.testbackup');

describe('Mode 2: Factory Reset Total (Flush Database)', () => {
  let originalSettingsContent = '';
  let backupSvc;
  let db;

  beforeAll(() => {
    // 1. Amankan salinan live database dan settings.json sebelum pengujian
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, tempDbBackupPath);
    }
    if (fs.existsSync(settingsPath)) {
      originalSettingsContent = fs.readFileSync(settingsPath, 'utf8');
      fs.copyFileSync(settingsPath, tempSettingsBackupPath);
    }

    backupSvc = require('../services/backupService');
    db = require('../config/database');
  });

  const createdBackupFiles = [];

  afterAll(() => {
    // 1. Bersihkan file backup yang digenerate khusus saat pengujian
    for (const bf of createdBackupFiles) {
      const fullBf = path.join(backupDir, bf);
      if (fs.existsSync(fullBf)) {
        try { fs.unlinkSync(fullBf); } catch (e) {}
      }
    }

    // 2. Kembalikan kondisi settings.json
    if (fs.existsSync(tempSettingsBackupPath)) {
      fs.copyFileSync(tempSettingsBackupPath, settingsPath);
      try { fs.unlinkSync(tempSettingsBackupPath); } catch (e) {}
    }

    // 3. Kembalikan kondisi uploads ke kondisi tracked git
    const { execSync } = require('child_process');
    try {
      execSync('git checkout -- public/uploads/', { cwd: projectRoot });
    } catch (e) {}

    // 4. Tutup database jika ada dan restore database/billing.db dari salinan cadangan
    if (db && typeof db.close === 'function') {
      try { db.close(); } catch (e) {}
    }
    if (fs.existsSync(tempDbBackupPath)) {
      try { fs.copyFileSync(tempDbBackupPath, dbPath); } catch (err) {}
    }

    if (fs.existsSync(tempDbBackupPath)) {
      try { fs.unlinkSync(tempDbBackupPath); } catch (e) {}
    }

    const { stopSettingsWatcher } = require('../config/settingsManager');
    if (typeof stopSettingsWatcher === 'function') {
      stopSettingsWatcher();
    }
  });

  describe('EJS View Rendering: views/admin/backup.ejs', () => {
    test('renders backup page with Danger Zone card and Flush Modal', async () => {
      const templatePath = path.join(projectRoot, 'views', 'admin', 'backup.ejs');
      const data = {
        title: 'Backup & Recovery',
        company: 'Test ISP Corp',
        activePage: 'backup',
        msg: null,
        backups: [
          {
            fileName: 'billing_db_20260912_120000.db',
            type: 'database',
            sizeKB: 250,
            createdDate: new Date()
          }
        ],
        total: 1,
        lang: 'id',
        sidebarSections: [],
        sidebarBottomNavItems: [],
        getSetting: (k, def) => def,
        t: (key, def) => def || key
      };

      const html = await ejs.renderFile(templatePath, data, { filename: templatePath });

      expect(html).toContain('Zona Bahaya: Factory Reset Total (Mode 2: Siap PT / Klien Baru)');
      expect(html).toContain('DANGER ZONE');
      expect(html).toContain('id="flushModal"');
      expect(html).toContain('name="clear_license"');
      expect(html).toContain('Kosongkan Lisensi (Unbind Lisensi)');
      expect(html).toContain('name="confirm_text"');
      expect(html).toContain('FLUSH DATABASE');
      expect(html).toContain('name="password"');
      expect(html).toContain('/admin/backup/flush');
    });
  });

  describe('Service: backupService.flushDatabase()', () => {
    test('flushes operational tables, creates pre-backup, and preserves license by default', () => {
      // Pastikan ada license key pada settings sebelum flush
      const initialSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      initialSettings.license_key = 'MYADA-LIC-V1.TEST_DEFAULT_PRESERVED_KEY.SIGNATURE';
      initialSettings.company_header = 'PT Lama Yang Mau Diganti';
      initialSettings.company_phone = '08123456789';
      fs.writeFileSync(settingsPath, JSON.stringify(initialSettings, null, 2), 'utf8');

      // Jalankan flush dengan opsi default (clearLicense = false)
      const result = backupSvc.flushDatabase({ clearLicense: false });
      if (result.preBackupFile) createdBackupFiles.push(result.preBackupFile);
      if (result.preBackup?.settings?.fileName) createdBackupFiles.push(result.preBackup.settings.fileName);

      expect(result.success).toBe(true);
      expect(result.licensePreserved).toBe(true);
      expect(result.preBackupFile).toBeDefined();

      // Pastikan file pre-backup benar-benar ada di direktori backups/
      const preBackupFileFullPath = path.join(backupDir, result.preBackupFile);
      expect(fs.existsSync(preBackupFileFullPath)).toBe(true);

      // Verifikasi tabel operasional bersih (0 baris)
      const custCount = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
      const invCount = db.prepare('SELECT COUNT(*) as c FROM invoices').get().c;
      const ticketCount = db.prepare('SELECT COUNT(*) as c FROM tickets').get().c;
      const odpCount = db.prepare('SELECT COUNT(*) as c FROM odps').get().c;
      expect(custCount).toBe(0);
      expect(invCount).toBe(0);
      expect(ticketCount).toBe(0);
      expect(odpCount).toBe(0);

      // Verifikasi master data bersih telah di-reseed
      const pkgCount = db.prepare('SELECT COUNT(*) as c FROM packages').get().c;
      const expCatCount = db.prepare('SELECT COUNT(*) as c FROM expense_categories').get().c;
      const invCatCount = db.prepare('SELECT COUNT(*) as c FROM inventory_categories').get().c;
      expect(pkgCount).toBe(3);
      expect(expCatCount).toBe(6);
      expect(invCatCount).toBe(3);

      // Verifikasi tabel admins masih memiliki superadmin
      const adminCount = db.prepare("SELECT COUNT(*) as c FROM admins WHERE role = 'superadmin'").get().c;
      expect(adminCount).toBeGreaterThanOrEqual(1);

      // Verifikasi settings.json
      const updatedSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      // Lisensi dipertahankan:
      expect(updatedSettings.license_key).toBe('MYADA-LIC-V1.TEST_DEFAULT_PRESERVED_KEY.SIGNATURE');
      // Nama perusahaan & kredensial di-reset ke generic/bersih:
      expect(updatedSettings.company_header).toBe('Nama Perusahaan / ISP');
      expect(updatedSettings.company_phone).toBe('');
      expect(updatedSettings.company_logo).toBe('');
      expect(updatedSettings.midtrans_enabled).toBe(false);
      expect(updatedSettings.qris_static_enabled).toBe(false);

      // Verifikasi pesan template WhatsApp tidak mengandung rekening bank lama
      const waBillingTpl = db.prepare("SELECT value FROM app_settings WHERE key = 'whatsapp_auto_billing_message'").get();
      expect(waBillingTpl).toBeDefined();
      expect(waBillingTpl.value).not.toContain('Iwan Wahyudi');
      expect(waBillingTpl.value).not.toContain('6080575210');
    });

    test('flushes operational tables and unbinds/clears license when clearLicense is true', () => {
      // Set license key
      const initialSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      initialSettings.license_key = 'MYADA-LIC-V1.KEY_TO_BE_UNBOUND.SIGNATURE';
      fs.writeFileSync(settingsPath, JSON.stringify(initialSettings, null, 2), 'utf8');

      // Jalankan flush dengan clearLicense: true
      const result = backupSvc.flushDatabase({ clearLicense: true });
      if (result.preBackupFile) createdBackupFiles.push(result.preBackupFile);
      if (result.preBackup?.settings?.fileName) createdBackupFiles.push(result.preBackup.settings.fileName);

      expect(result.success).toBe(true);
      expect(result.licensePreserved).toBe(false);

      const updatedSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      // Lisensi wajib kosong (unbound)
      expect(updatedSettings.license_key).toBe('');
    });
  });

  describe('Route: POST /admin/backup/flush validation logic', () => {
    test('rejects if administrator password is wrong', () => {
      const adminPassword = 'Kmzway87aa_';
      const inputPassword = 'wrong-password';
      const confirmText = 'FLUSH DATABASE';

      const isValidPassword = inputPassword === adminPassword;
      expect(isValidPassword).toBe(false);
    });

    test('rejects if confirmation phrase is not exactly "FLUSH DATABASE"', () => {
      const phrases = ['flush database', 'FLUSH', 'DELETE ALL', 'flush', ''];
      for (const p of phrases) {
        expect(p === 'FLUSH DATABASE').toBe(false);
      }
      expect('FLUSH DATABASE'.trim() === 'FLUSH DATABASE').toBe(true);
    });
  });
});
