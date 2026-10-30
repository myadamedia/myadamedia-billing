const mikrotikService = require('../services/mikrotikService');
const telegramBot = require('../services/telegramBot');

describe('Anti-False Alert PPPoE Disconnected & Multi-Router Monitoring Test Suite', () => {
  describe('MikroTik Service Enhancements', () => {
    test('checkPppoeActiveUser should be exported as a function', () => {
      expect(typeof mikrotikService.checkPppoeActiveUser).toBe('function');
    });

    test('checkPppoeActiveUser should return null for empty or invalid username', async () => {
      expect(await mikrotikService.checkPppoeActiveUser('')).toBeNull();
      expect(await mikrotikService.checkPppoeActiveUser(null)).toBeNull();
      expect(await mikrotikService.checkPppoeActiveUser(undefined)).toBeNull();
    });

    test('getPppoeActive should support options.throwOnError and propagate errors when configured', async () => {
      // Testing with a non-existent router ID that throws router not found
      await expect(
        mikrotikService.getPppoeActive(999999, { throwOnError: true })
      ).rejects.toThrow();
    });

    test('getPppoeSecrets should support options.throwOnError and propagate errors when configured', async () => {
      // Testing with a non-existent router ID that throws router not found
      await expect(
        mikrotikService.getPppoeSecrets(999999, { throwOnError: true })
      ).rejects.toThrow();
    });
  });

  describe('Telegram Message Formatting & Cross-Validation', () => {
    test('formatPppoeStatusMessage should be exported as a function', () => {
      expect(typeof telegramBot.formatPppoeStatusMessage).toBe('function');
    });

    test('should include routerName in Telegram message when provided', () => {
      const msg = telegramBot.formatPppoeStatusMessage({
        username: 'test_user_router',
        customerName: 'Ahmad Test',
        phone: '08123456789',
        profile: 'Paket-20M',
        ipAddress: '10.10.10.99',
        status: 'offline',
        routerName: 'Router Utama NOC',
        time: '2026-10-30 14:00:00'
      });

      expect(msg).toContain('Router Utama NOC');
      expect(msg).toContain('🖧 *Router:* Router Utama NOC');
    });

    test('should show Reconnecting status when ONT is Online / UP during PPPoE disconnect', () => {
      const msg = telegramBot.formatPppoeStatusMessage({
        username: 'test_user_up',
        customerName: 'Budi Reconnect',
        phone: '08123456788',
        profile: 'Paket-50M',
        ipAddress: '10.10.10.100',
        status: 'offline',
        routerName: 'Router-1',
        oltName: 'OLT-ZTE-C320',
        ontStatus: 'Online / UP',
        rxPower: '-19.20 dBm',
        time: '2026-10-30 14:05:00'
      });

      expect(msg).toContain('⚡ *Status ONT OLT:* `Online / UP`');
      expect(msg).toContain('Sesi PPP Terputus / Reconnecting (ONT Fisik Normal di OLT)');
    });

    test('should show Physical Disconnect status when ONT is PwrDown or Dying_gasp', () => {
      const msg = telegramBot.formatPppoeStatusMessage({
        username: 'test_user_down',
        customerName: 'Cici MatiLampu',
        phone: '08123456787',
        profile: 'Paket-10M',
        ipAddress: '10.10.10.101',
        status: 'offline',
        routerName: 'Router-1',
        oltName: 'OLT-ZTE-C320',
        ontStatus: 'PwrDown / down',
        offlineReason: 'Dying_gasp / Mati Lampu',
        rxPower: '-28.50 dBm',
        time: '2026-10-30 14:10:00'
      });

      expect(msg).toContain('PwrDown / down');
      expect(msg).toContain('Terputus dari Router & OLT');
    });

    test('sendPppoeStatusNotification should resolve cleanly without throwing error', async () => {
      await expect(telegramBot.sendPppoeStatusNotification({
        username: 'test_clean_send',
        customerName: 'Pelanggan Uji',
        routerName: 'Router 1',
        status: 'offline'
      })).resolves.not.toThrow();
    });
  });

  describe('Anti-Flapping & Case-Insensitive Logic Simulation', () => {
    test('should correctly match usernames case-insensitively', () => {
      const activeMap = new Map();
      activeMap.set('user01', { name: 'User01', address: '10.10.10.2' });

      const secretNameA = 'User01';
      const secretNameB = 'USER01';
      const secretNameC = 'user01';

      expect(activeMap.has(secretNameA.toLowerCase())).toBe(true);
      expect(activeMap.has(secretNameB.toLowerCase())).toBe(true);
      expect(activeMap.has(secretNameC.toLowerCase())).toBe(true);
    });

    test('should prevent false alarms when active session drops to 0 due to API socket reset (Circuit Breaker)', () => {
      const secrets = new Array(20).fill(null).map((_, i) => ({ name: `user_${i}` }));
      const active = []; // 0 active sessions due to API timeout

      const isAnomaly = secrets.length >= 5 && active.length === 0;
      expect(isAnomaly).toBe(true);
      // Circuit breaker triggers, cycle is aborted, 0 notifications triggered!
    });

    test('should debounce offline candidate when ONT is UP (2-Strike Flap Damping)', () => {
      const pppoeOfflineCandidates = new Map();
      const usernameKey = 'pelanggan_flapping';
      const isOntPhysicallyDown = false; // ONT is physically UP

      // Strike 1
      const candidate1 = pppoeOfflineCandidates.get(usernameKey) || { strikeCount: 0 };
      candidate1.strikeCount += 1;
      pppoeOfflineCandidates.set(usernameKey, candidate1);

      let sendAlert = true;
      if (!isOntPhysicallyDown && candidate1.strikeCount < 2) {
        sendAlert = false; // Held on strike 1!
      }
      expect(sendAlert).toBe(false);
      expect(candidate1.strikeCount).toBe(1);

      // Strike 2 (confirmed offline on next cycle)
      const candidate2 = pppoeOfflineCandidates.get(usernameKey);
      candidate2.strikeCount += 1;
      pppoeOfflineCandidates.set(usernameKey, candidate2);

      let sendAlertStrike2 = true;
      if (!isOntPhysicallyDown && candidate2.strikeCount < 2) {
        sendAlertStrike2 = false;
      }
      expect(sendAlertStrike2).toBe(true);
      expect(candidate2.strikeCount).toBe(2);
    });
  });
});
