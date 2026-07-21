const securityHelper = require('../utils/securityHelper');
const crypto = require('crypto');

describe('securityHelper', () => {
  describe('hashPassword', () => {
    it('should hash a password successfully with scrypt parameters', () => {
      const password = 'my-secret-password';
      const hash = securityHelper.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash.startsWith('scrypt$16384$8$1$')).toBe(true);
      
      const parts = hash.split('$');
      expect(parts.length).toBe(6);
      expect(parts[4]).toHaveLength(32); // Hex salt (16 bytes = 32 chars)
      expect(parts[5]).toHaveLength(128); // Hex hash (64 bytes = 128 chars)
    });

    it('should return empty string if password is empty or falsy', () => {
      expect(securityHelper.hashPassword('')).toBe('');
      expect(securityHelper.hashPassword(null)).toBe('');
      expect(securityHelper.hashPassword(undefined)).toBe('');
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password and valid scrypt hash', () => {
      const password = 'correct-password';
      const hash = securityHelper.hashPassword(password);
      
      expect(securityHelper.verifyPassword(password, hash)).toBe(true);
    });

    it('should return false for incorrect password and valid scrypt hash', () => {
      const password = 'correct-password';
      const hash = securityHelper.hashPassword(password);
      
      expect(securityHelper.verifyPassword('wrong-password', hash)).toBe(false);
    });

    it('should fallback to plaintext comparison if hash does not start with scrypt$', () => {
      expect(securityHelper.verifyPassword('plain-pass', 'plain-pass')).toBe(true);
      expect(securityHelper.verifyPassword('plain-pass', 'other-pass')).toBe(false);
    });

    it('should return false if password or hash is missing', () => {
      expect(securityHelper.verifyPassword('', 'some-hash')).toBe(false);
      expect(securityHelper.verifyPassword('some-pass', '')).toBe(false);
      expect(securityHelper.verifyPassword(null, 'some-hash')).toBe(false);
      expect(securityHelper.verifyPassword('some-pass', null)).toBe(false);
    });

    it('should return false if scrypt hash parts length is not 6', () => {
      // Invalid parts count
      expect(securityHelper.verifyPassword('password', 'scrypt$16384$8$1$salt')).toBe(false);
    });

    it('should return false if scryptSync throws an error', () => {
      // Passing 123 as cost parameter (which is not a power of 2) causes crypto.scryptSync to throw
      const invalidHash = 'scrypt$123$8$1$salt$4321abcd';
      expect(securityHelper.verifyPassword('password', invalidHash)).toBe(false);
    });
  });

  describe('isHash', () => {
    it('should return true for strings starting with scrypt$', () => {
      expect(securityHelper.isHash('scrypt$16384$8$1$salt$hash')).toBe(true);
    });

    it('should return false for plaintext strings', () => {
      expect(securityHelper.isHash('plain-text')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(securityHelper.isHash(null)).toBe(false);
      expect(securityHelper.isHash(undefined)).toBe(false);
      expect(securityHelper.isHash(12345)).toBe(false);
      expect(securityHelper.isHash({})).toBe(false);
    });
  });
});
