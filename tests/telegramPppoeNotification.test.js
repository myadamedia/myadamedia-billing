const telegramBot = require('../services/telegramBot');
const { validateSettings } = require('../config/settingsValidator');

describe('Telegram PPPoE Notification Unit Test', () => {
  test('should export sendPppoeStatusNotification function', () => {
    expect(typeof telegramBot.sendPppoeStatusNotification).toBe('function');
  });

  test('should return false if pppoeData or username is missing', async () => {
    expect(await telegramBot.sendPppoeStatusNotification(null)).toBe(false);
    expect(await telegramBot.sendPppoeStatusNotification({})).toBe(false);
    expect(await telegramBot.sendPppoeStatusNotification({ username: '' })).toBe(false);
  });

  test('should execute sendPppoeStatusNotification for offline alert without throwing error', async () => {
    const dummyData = {
      username: 'budi_pppoe_test',
      customerName: 'Budi Test',
      phone: '081234567890',
      profile: 'Paket-20Mbps',
      ipAddress: '10.10.10.50',
      status: 'offline',
      time: '2026-08-28 09:30:00'
    };

    await expect(telegramBot.sendPppoeStatusNotification(dummyData)).resolves.not.toThrow();
  });

  test('should execute sendPppoeStatusNotification with OLT/ONT PwrDown & OfflineReason data', async () => {
    const dummyOltData = {
      username: 'budi_pppoe_test',
      customerName: 'Budi Test',
      phone: '081234567890',
      profile: 'Paket-50Mbps',
      ipAddress: '10.10.10.55',
      status: 'offline',
      oltName: 'OLT-Pusat-Hioso',
      ontStatus: 'PwrDown',
      offlineReason: 'Dying_gasp / Mati Listrik',
      rxPower: '-23.40 dBm',
      time: '2026-08-28 09:40:00'
    };

    await expect(telegramBot.sendPppoeStatusNotification(dummyOltData)).resolves.not.toThrow();
  });

  test('should execute sendPppoeStatusNotification for recovery alert without throwing error', async () => {
    const dummyData = {
      username: 'budi_pppoe_test',
      customerName: 'Budi Test',
      phone: '081234567890',
      profile: 'Paket-20Mbps',
      ipAddress: '10.10.10.50',
      status: 'online',
      oltName: 'OLT-Pusat-Hioso',
      ontStatus: 'Online / UP',
      rxPower: '-19.50 dBm',
      time: '2026-08-28 09:42:00'
    };

    await expect(telegramBot.sendPppoeStatusNotification(dummyData)).resolves.not.toThrow();
  });

  test('should validate new settings keys in settingsValidator', () => {
    const validSettings = {
      telegram_pppoe_notify_enabled: true,
      telegram_pppoe_notify_recovery: false,
      telegram_pppoe_check_interval: 5
    };

    const result = validateSettings(validSettings);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should catch invalid types or values in settingsValidator', () => {
    const invalidSettings = {
      telegram_pppoe_notify_enabled: 'not-a-boolean',
      telegram_pppoe_check_interval: 100 // exceeds max 60
    };

    const result = validateSettings(invalidSettings);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
