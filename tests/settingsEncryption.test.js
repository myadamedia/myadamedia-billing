describe('settingsEncryption', () => {
  let encryption;
  const defaultSecret = 'default-master-key-change-this-in-production';

  beforeEach(() => {
    // Reset modules to reload settingsEncryption cleanly
    jest.resetModules();
  });

  describe('with default master key', () => {
    beforeEach(() => {
      delete process.env.SETTINGS_MASTER_KEY;
      encryption = require('../config/settingsEncryption');
    });

    it('should encrypt and decrypt a string value', () => {
      const plaintext = 'super-secret-password-123';
      const encrypted = encryption.encryptValue(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(encrypted.startsWith('enc:')).toBe(true);
      
      const decrypted = encryption.decryptValue(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should return original value if it is not a string or empty', () => {
      expect(encryption.encryptValue(null)).toBeNull();
      expect(encryption.encryptValue(12345)).toBe(12345);
      expect(encryption.encryptValue('')).toBe('');

      expect(encryption.decryptValue(null)).toBeNull();
      expect(encryption.decryptValue(12345)).toBe(12345);
      expect(encryption.decryptValue('')).toBe('');
    });

    it('should return original value if decryptValue receives a non-encrypted string', () => {
      const plain = 'not-encrypted';
      expect(encryption.decryptValue(plain)).toBe(plain);
    });

    it('should return original value and log error on decryption failure (e.g. invalid format)', () => {
      const invalidEnc = 'enc:too:few:parts';
      const result = encryption.decryptValue(invalidEnc);
      expect(result).toBe(invalidEnc);
    });

    it('should return original value and log error on invalid encrypted format length', () => {
      const invalidEnc = 'enc:a:b:c:d'; // 5 parts instead of 4
      const result = encryption.decryptValue(invalidEnc);
      expect(result).toBe(invalidEnc);
    });

    it('should return original value on encrypt failure (e.g. value is object but somehow forced to encrypt)', () => {
      // Forcing error by mocking crypto.createCipheriv to throw error
      const crypto = require('crypto');
      const spy = jest.spyOn(crypto, 'createCipheriv').mockImplementationOnce(() => {
        throw new Error('Cipher error');
      });

      const val = 'test';
      const result = encryption.encryptValue(val);
      expect(result).toBe(val);
      
      spy.mockRestore();
    });

    it('should encrypt and decrypt settings objects', () => {
      const settings = {
        server_port: 3001,
        admin_password: 'admin-password-plaintext',
        company_header: 'My ISP'
      };

      const encrypted = encryption.encryptSettings(settings);
      expect(encrypted.server_port).toBe(3001);
      expect(encrypted.company_header).toBe('My ISP');
      expect(encrypted.admin_password.startsWith('enc:')).toBe(true);

      const decrypted = encryption.decryptSettings(encrypted);
      expect(decrypted.admin_password).toBe('admin-password-plaintext');
    });

    it('should skip non-existent sensitive fields in encryptSettings and decryptSettings', () => {
      const settings = {
        server_port: 3001
      };
      const encrypted = encryption.encryptSettings(settings);
      expect(encrypted).toEqual({ server_port: 3001 });

      const decrypted = encryption.decryptSettings(settings);
      expect(decrypted).toEqual({ server_port: 3001 });
    });

    it('should mask values properly', () => {
      expect(encryption.maskValue(null)).toBeNull();
      expect(encryption.maskValue(1234)).toBe(1234);
      expect(encryption.maskValue('short')).toBe('****');
      expect(encryption.maskValue('eightchr')).toBe('****');
      expect(encryption.maskValue('longerplaintextvalue')).toBe('long****alue');
    });

    it('should mask sensitive fields in settings', () => {
      const settings = {
        server_port: 3001,
        admin_password: 'my-longer-admin-password',
        company_header: 'My ISP'
      };

      const masked = encryption.getMaskedSettings(settings);
      expect(masked.server_port).toBe(3001);
      expect(masked.company_header).toBe('My ISP');
      expect(masked.admin_password).toBe('my-l****word');
    });

    it('should correctly identify sensitive fields', () => {
      expect(encryption.isSensitiveField('admin_password')).toBe(true);
      expect(encryption.isSensitiveField('server_port')).toBe(false);
    });
  });

  describe('with custom master key and fallback decryption', () => {
    beforeEach(() => {
      process.env.SETTINGS_MASTER_KEY = 'custom-secure-master-key-xyz';
      encryption = require('../config/settingsEncryption');
    });

    afterEach(() => {
      delete process.env.SETTINGS_MASTER_KEY;
    });

    it('should decrypt using primary custom key successfully', () => {
      const plaintext = 'custom-secret-data';
      const encrypted = encryption.encryptValue(plaintext);
      
      const decrypted = encryption.decryptValue(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should fallback to default master key when decryption with custom key fails but default key works', () => {
      let defaultEncryption;
      
      // 1. Generate encrypted value using default key
      jest.isolateModules(() => {
        delete process.env.SETTINGS_MASTER_KEY;
        defaultEncryption = require('../config/settingsEncryption');
      });
      const plaintext = 'data-encrypted-with-default-key';
      const encryptedWithDefault = defaultEncryption.encryptValue(plaintext);

      // 2. Decrypt with custom key configuration. Primary will fail, fallback default key will succeed.
      const decrypted = encryption.decryptValue(encryptedWithDefault);
      expect(decrypted).toBe(plaintext);
    });

    it('should return original value if both primary custom key and fallback default key fail', () => {
      const badEncryptedVal = 'enc:1234567890abcdef1234567890abcdef:1234567890abcdef1234567890abcdef:abcdef123456';
      
      const result = encryption.decryptValue(badEncryptedVal);
      expect(result).toBe(badEncryptedVal);
    });

    it('should handle empty custom master key', () => {
      process.env.SETTINGS_MASTER_KEY = '';
      jest.resetModules();
      const tempEncryption = require('../config/settingsEncryption');
      const val = 'test-empty';
      const enc = tempEncryption.encryptValue(val);
      expect(enc.startsWith('enc:')).toBe(true);
      expect(tempEncryption.decryptValue(enc)).toBe(val);
    });
  });
});
