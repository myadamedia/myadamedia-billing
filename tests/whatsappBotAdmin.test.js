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
    });
  });

  describe('isWhatsappAdminKey Verification', () => {
    const mockAdminSet = new Set(['085179966227', '6285179966227', '081234567890', '6281234567890']);

    test('should recognize admin by standard @s.whatsapp.net remoteJid', () => {
      const key1 = { remoteJid: '6285179966227@s.whatsapp.net' };
      expect(isWhatsappAdminKey(key1, mockAdminSet)).toBe(true);

      const key2 = { remoteJid: '6281234567890@s.whatsapp.net' };
      expect(isWhatsappAdminKey(key2, mockAdminSet)).toBe(true);

      const nonAdminKey = { remoteJid: '6289999999999@s.whatsapp.net' };
      expect(isWhatsappAdminKey(nonAdminKey, mockAdminSet)).toBe(false);
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
        participant: '6285179966227@s.whatsapp.net'
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
      expect(parseCommand('bantuan')).toEqual({ cmd: 'menu', rest: '' });
      expect(parseCommand('help')).toEqual({ cmd: 'menu', rest: '' });
      expect(parseCommand('cektagihan')).toEqual({ cmd: 'cektagihan', rest: '' });
      expect(parseCommand('daftar 081234567890')).toEqual({ cmd: 'daftar', rest: '081234567890' });
    });

    test('should parse adminmenu deterministically with adminOnly flag', () => {
      const cmd1 = parseCommand('adminmenu');
      expect(cmd1).toEqual({ cmd: 'adminmenu', admin: true, adminOnly: true, rest: '' });

      const cmd2 = parseCommand('admin');
      expect(cmd2).toEqual({ cmd: 'adminmenu', admin: true, adminOnly: true, rest: '' });

      const cmd3 = parseCommand('menuadmin');
      expect(cmd3).toEqual({ cmd: 'adminmenu', admin: true, adminOnly: true, rest: '' });
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
