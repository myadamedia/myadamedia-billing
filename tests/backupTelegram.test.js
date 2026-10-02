const fs = require('fs');
const path = require('path');
const telegramBot = require('../services/telegramBot');
const backupSvc = require('../services/backupService');

describe('Backup Database to Telegram Tests', () => {
  const ejsPath = path.join(__dirname, '..', 'views', 'admin', 'backup.ejs');
  const routesPath = path.join(__dirname, '..', 'routes', 'adminPortal.js');
  const telegramBotPath = path.join(__dirname, '..', 'services', 'telegramBot.js');
  const backupServicePath = path.join(__dirname, '..', 'services', 'backupService.js');

  test('telegramBot.js should export sendTelegramDocument and sendTelegramAdminDocument', () => {
    expect(typeof telegramBot.sendTelegramDocument).toBe('function');
    expect(typeof telegramBot.sendTelegramAdminDocument).toBe('function');

    const botContent = fs.readFileSync(telegramBotPath, 'utf8');
    expect(botContent).toContain('sendTelegramDocument(');
    expect(botContent).toContain('sendTelegramAdminDocument(');
    expect(botContent).toContain('bot.sendDocument');
    expect(botContent).toContain('form.append(\'document\'');
  });

  test('sendTelegramDocument should return false safely when telegram is disabled or chatId is missing', async () => {
    // When chatId is empty or null
    const result1 = await telegramBot.sendTelegramDocument('', 'non-existent-file.db');
    expect(result1).toBe(false);

    const result2 = await telegramBot.sendTelegramDocument(12345, 'non-existent-file.db');
    expect(result2).toBe(false);

    // sendTelegramAdminDocument should also return false or not throw
    await expect(telegramBot.sendTelegramAdminDocument('dummy.db')).resolves.not.toThrow();
  });

  test('backupService.js should include auto-backup Telegram integration in scheduleAutoBackup', () => {
    const backupContent = fs.readFileSync(backupServicePath, 'utf8');
    expect(backupContent).toContain('telegramBot.sendTelegramAdminDocument');
    expect(backupContent).toContain('AUTO-BACKUP DATABASE (SCHEDULED)');
    expect(backupContent).toContain('scheduleAutoBackup');
  });

  test('routes/adminPortal.js should register POST /backup/send-telegram and handle send_telegram on /backup/create', () => {
    const routesContent = fs.readFileSync(routesPath, 'utf8');
    expect(routesContent).toContain("router.post('/backup/send-telegram'");
    expect(routesContent).toContain('telegramBot.sendTelegramAdminDocument');
    expect(routesContent).toContain('send_telegram');
    expect(routesContent).toContain('backupSvc.getBackupFilePath');
  });

  test('views/admin/backup.ejs should include Telegram UI elements, status banner, and action buttons', () => {
    const ejsContent = fs.readFileSync(ejsPath, 'utf8');

    // 1. Status Integrasi Telegram
    expect(ejsContent).toContain('Integrasi Pengiriman Telegram:');
    expect(ejsContent).toContain('isTgConfigured');

    // 2. Tombol di Hero Banner
    expect(ejsContent).toContain('Backup & Kirim ke Telegram');
    expect(ejsContent).toContain('name="send_telegram"');

    // 3. Checkbox di Form Buat Backup Baru
    expect(ejsContent).toContain('Langsung kirim hasil backup ke Telegram Admin');

    // 4. Tombol aksi di tabel riwayat
    expect(ejsContent).toContain('action="/admin/backup/send-telegram"');
    expect(ejsContent).toContain('title="Kirim file backup ini ke Telegram Admin"');
    expect(ejsContent).toContain('function confirmSendTelegram(');
  });
});
