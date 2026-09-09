import {
  getWhatsappAdminNumbers,
  loadWhatsappAdminSet,
  isWhatsappAdminKey,
  parseCommand
} from '../services/whatsappBot.mjs';

describe('WhatsApp Bot Admin & Command Parsing Unit Tests', () => {
  describe('getWhatsappAdminNumbers & loadWhatsappAdminSet', () => {
    test('should extract admin numbers from settings and expand variations', () => {
      const adminNumbers = getWhatsappAdminNumbers();
      expect(Array.isArray(adminNumbers)).toBe(true);

      const adminSet = loadWhatsappAdminSet();
      expect(adminSet instanceof Set).toBe(true);
      // In settings.json, "085179966227" is configured
      expect(adminSet.has('085179966227') || adminSet.has('6285179966227')).toBe(true);
      expect(adminSet.has('6285179966227@s.whatsapp.net')).toBe(true);
    });
  });

  describe('isWhatsappAdminKey Verification', () => {
    const mockAdminSet = new Set([
      '085179966227', '6285179966227', '081234567890', '6281234567890',
      '6285179966227@s.whatsapp.net', '6281234567890@s.whatsapp.net'
    ]);

    test('should recognize admin by standard @s.whatsapp.net remoteJid', () => {
      const key1 = { remoteJid: '6285179966227@s.whatsapp.net' };
      expect(isWhatsappAdminKey(key1, mockAdminSet)).toBe(true);

      const key2 = { remoteJid: '6281234567890@s.whatsapp.net' };
      expect(isWhatsappAdminKey(key2, mockAdminSet)).toBe(true);

      const nonAdminKey = { remoteJid: '6289999999999@s.whatsapp.net' };
      expect(isWhatsappAdminKey(nonAdminKey, mockAdminSet)).toBe(false);
    });

    test('should recognize admin with multi-device device suffix (e.g. :0 or :12)', () => {
      const keyWithDevice0 = { remoteJid: '6285179966227:0@s.whatsapp.net' };
      expect(isWhatsappAdminKey(keyWithDevice0, mockAdminSet)).toBe(true);

      const keyWithDevice12 = { remoteJid: '6285179966227:12@s.whatsapp.net' };
      expect(isWhatsappAdminKey(keyWithDevice12, mockAdminSet)).toBe(true);

      const keyWithSenderPnDevice0 = {
        remoteJid: '284849204918239@lid',
        senderPn: '6285179966227:0@s.whatsapp.net'
      };
      expect(isWhatsappAdminKey(keyWithSenderPnDevice0, mockAdminSet)).toBe(true);
    });

    test('should recognize admin by senderPn in multi-device JID', () => {
      const key = {
        remoteJid: '284849204918239@lid',
        senderPn: '6285179966227@s.whatsapp.net'
      };
      expect(isWhatsappAdminKey(key, mockAdminSet)).toBe(true);
    });

    test('should recognize admin by participant in group/broadcast messages', () => {
      const key = {
        remoteJid: '12036302482910@g.us',
        participant: '6285179966227:0@s.whatsapp.net'
      };
      expect(isWhatsappAdminKey(key, mockAdminSet)).toBe(true);
    });

    test('should recognize admin mapped via lidStore', () => {
      const mockLidStore = {
        get: (jid) => (jid === '284849204918239@lid' ? '085179966227' : null)
      };

      const key = {
        remoteJid: '284849204918239@lid'
      };
      expect(isWhatsappAdminKey(key, mockAdminSet, mockLidStore)).toBe(true);

      const unknownLidKey = {
        remoteJid: '999999999999999@lid'
      };
      expect(isWhatsappAdminKey(unknownLidKey, mockAdminSet, mockLidStore)).toBe(false);
    });

    test('should return false for empty or non-admin input', () => {
      expect(isWhatsappAdminKey(null, mockAdminSet)).toBe(false);
      expect(isWhatsappAdminKey({}, mockAdminSet)).toBe(false);
      expect(isWhatsappAdminKey({ remoteJid: 'invalid-jid' }, mockAdminSet)).toBe(false);
    });
  });

  describe('parseCommand Validation', () => {
    test('should parse public/customer commands correctly', () => {
      expect(parseCommand('menu')).toEqual({ cmd: 'menu', rest: '' });
      expect(parseCommand('/menu')).toEqual({ cmd: 'menu', rest: '' });
      expect(parseCommand('bantuan')).toEqual({ cmd: 'menu', rest: '' });
      expect(parseCommand('help')).toEqual({ cmd: 'menu', rest: '' });
      expect(parseCommand('cektagihan')).toEqual({ cmd: 'cektagihan', rest: '' });
      expect(parseCommand('daftar 081234567890')).toEqual({ cmd: 'daftar', rest: '081234567890' });
      expect(parseCommand('link 081234567890')).toEqual({ cmd: 'daftar', rest: '081234567890' });
    });

    test('should parse adminmenu deterministically with adminOnly flag and prefix support', () => {
      expect(parseCommand('adminmenu')).toEqual({ cmd: 'adminmenu', admin: true, adminOnly: true, rest: '' });
      expect(parseCommand('/adminmenu')).toEqual({ cmd: 'adminmenu', admin: true, adminOnly: true, rest: '' });
      expect(parseCommand('!adminmenu')).toEqual({ cmd: 'adminmenu', admin: true, adminOnly: true, rest: '' });
      expect(parseCommand('#adminmenu')).toEqual({ cmd: 'adminmenu', admin: true, adminOnly: true, rest: '' });

      expect(parseCommand('admin')).toEqual({ cmd: 'adminmenu', admin: true, adminOnly: true, rest: '' });
      expect(parseCommand('/admin')).toEqual({ cmd: 'adminmenu', admin: true, adminOnly: true, rest: '' });
      expect(parseCommand('menuadmin')).toEqual({ cmd: 'adminmenu', admin: true, adminOnly: true, rest: '' });
    });

    test('should parse admin registration command format "admin 085179966227" as daftar', () => {
      expect(parseCommand('admin 085179966227')).toEqual({ cmd: 'daftar', rest: '085179966227' });
      expect(parseCommand('/admin 085179966227')).toEqual({ cmd: 'daftar', rest: '085179966227' });
    });

    test('should parse administrative management commands with adminOnly flag', () => {
      expect(parseCommand('listonu')).toEqual({ cmd: 'listonu', admin: true, adminOnly: true });
      expect(parseCommand('mtactive')).toEqual({ cmd: 'mtactive', admin: true, adminOnly: true });
      expect(parseCommand('ringkasan')).toEqual({ cmd: 'ringkasan', admin: true, adminOnly: true });
      expect(parseCommand('lunas INV-1001')).toEqual({ cmd: 'lunas', admin: true, adminOnly: true, targetId: 'INV-1001' });
      expect(parseCommand('generate 09 2026')).toEqual({ cmd: 'generate', admin: true, adminOnly: true, month: '09', year: '2026' });
      expect(parseCommand('isolir 45')).toEqual({ cmd: 'isolir', admin: true, adminOnly: true, targetId: '45' });
      expect(parseCommand('buka 45')).toEqual({ cmd: 'buka', admin: true, adminOnly: true, targetId: '45' });
      expect(parseCommand('kickuser john')).toEqual({ cmd: 'kickuser', admin: true, adminOnly: true, args: ['john'] });
    });

    test('should return null for unrecognized command', () => {
      expect(parseCommand('randomcommandxyz')).toBeNull();
      expect(parseCommand('')).toBeNull();
      expect(parseCommand(null)).toBeNull();
    });
  });
});
