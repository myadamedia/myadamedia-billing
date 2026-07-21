const validator = require('../config/settingsValidator');

describe('settingsValidator', () => {
  describe('getFieldRule and getAllRules', () => {
    it('should return correct rule for a field', () => {
      const rule = validator.getFieldRule('server_port');
      expect(rule).toBeDefined();
      expect(rule.type).toBe('number');
    });

    it('should return null for non-existent field', () => {
      const rule = validator.getFieldRule('non_existent_field_123');
      expect(rule).toBeNull();
    });

    it('should return all validation rules', () => {
      const allRules = validator.getAllRules();
      expect(allRules).toBe(validator.VALIDATION_RULES);
      expect(allRules.server_port).toBeDefined();
    });
  });

  describe('validateValue', () => {
    describe('number type validation', () => {
      const rule = { type: 'number', min: 10, max: 20 };

      it('should return null for valid number', () => {
        expect(validator.validateValue('test_field', 15, rule)).toBeNull();
      });

      it('should return error if type is not number', () => {
        expect(validator.validateValue('test_field', '15', rule)).toBe('test_field harus berupa angka');
      });

      it('should return error if value is less than min', () => {
        expect(validator.validateValue('test_field', 9, rule)).toBe('test_field minimal 10');
      });

      it('should return error if value is greater than max', () => {
        expect(validator.validateValue('test_field', 21, rule)).toBe('test_field maksimal 20');
      });
    });

    describe('string type validation', () => {
      it('should return error if type is not string', () => {
        const rule = { type: 'string' };
        expect(validator.validateValue('test_field', true, rule)).toBe('test_field harus berupa string');
      });

      it('should validate minLength', () => {
        const rule = { type: 'string', minLength: 5 };
        expect(validator.validateValue('test_field', 'abc', rule)).toBe('test_field minimal 5 karakter');
        expect(validator.validateValue('test_field', 'abcde', rule)).toBeNull();
      });

      it('should validate maxLength', () => {
        const rule = { type: 'string', maxLength: 5 };
        expect(validator.validateValue('test_field', 'abcdef', rule)).toBe('test_field maksimal 5 karakter');
        expect(validator.validateValue('test_field', 'abcde', rule)).toBeNull();
      });

      it('should validate regex pattern', () => {
        const rule = { type: 'string', pattern: /^https?:\/\/.+/ };
        expect(validator.validateValue('test_field', 'not-a-url', rule)).toBe('test_field format tidak valid');
        expect(validator.validateValue('test_field', 'http://localhost', rule)).toBeNull();
      });

      it('should validate enum values', () => {
        const rule = { type: 'string', enum: ['a', 'b', 'c'] };
        expect(validator.validateValue('test_field', 'd', rule)).toBe('test_field harus salah satu dari: a, b, c');
        expect(validator.validateValue('test_field', 'b', rule)).toBeNull();
      });

      it('should trim string value before validation', () => {
        const rule = { type: 'string', minLength: 5 };
        // " abc " trimmed is "abc" which has length 3 (< 5)
        expect(validator.validateValue('test_field', ' abc ', rule)).toBe('test_field minimal 5 karakter');
      });
    });

    describe('boolean type validation', () => {
      const rule = { type: 'boolean' };

      it('should return null for valid boolean', () => {
        expect(validator.validateValue('test_field', true, rule)).toBeNull();
        expect(validator.validateValue('test_field', false, rule)).toBeNull();
      });

      it('should return error if type is not boolean', () => {
        expect(validator.validateValue('test_field', 'true', rule)).toBe('test_field harus berupa boolean');
        expect(validator.validateValue('test_field', null, rule)).toBe('test_field harus berupa boolean');
      });
    });
  });

  describe('validateSettings', () => {
    it('should pass for completely valid settings', () => {
      const validSettings = {
        server_port: 3001,
        server_host: 'localhost',
        session_secret: 'a-very-long-secret-key-that-is-at-least-32-chars-long',
        company_header: 'Valid Company',
        admin_username: 'admin',
        admin_password: 'admin-password'
      };

      const result = validator.validateSettings(validSettings);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should ignore fields that do not have validation rules', () => {
      const settings = {
        server_port: 3001,
        server_host: 'localhost',
        session_secret: 'a-very-long-secret-key-that-is-at-least-32-chars-long',
        company_header: 'Valid Company',
        admin_username: 'admin',
        admin_password: 'admin-password',
        random_custom_field: 'no-rule-for-this'
      };

      const result = validator.validateSettings(settings);
      expect(result.valid).toBe(true);
    });

    it('should fail if required fields are missing, empty, or null', () => {
      const invalidSettings = {
        server_port: 3001,
        server_host: '', // Empty required
        session_secret: undefined, // Missing required
        company_header: null, // Null required
        admin_username: 'admin',
        admin_password: 'password'
      };

      const result = validator.validateSettings(invalidSettings);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('server_host wajib diisi');
      expect(result.errors).toContain('session_secret wajib diisi');
      expect(result.errors).toContain('company_header wajib diisi');
    });

    it('should skip validation for empty optional fields', () => {
      const settings = {
        server_port: 3001,
        server_host: 'localhost',
        session_secret: 'a-very-long-secret-key-that-is-at-least-32-chars-long',
        company_header: 'Valid Company',
        admin_username: 'admin',
        admin_password: 'admin-password',
        public_base_url: '' // Optional, empty
      };

      const result = validator.validateSettings(settings);
      expect(result.valid).toBe(true);
    });

    it('should return errors for invalid values in settings object', () => {
      const invalidSettings = {
        server_port: 80, // Less than min 1024
        server_host: 'localhost',
        session_secret: 'short', // Less than minLength 32
        company_header: 'Company',
        admin_username: 'admin',
        admin_password: 'pass', // Less than minLength 6
        company_email: 'invalid-email', // Pattern mismatch
        tripay_mode: 'invalid_mode' // Enum mismatch
      };

      const result = validator.validateSettings(invalidSettings);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('server_port minimal 1024');
      expect(result.errors).toContain('session_secret minimal 32 karakter');
      expect(result.errors).toContain('admin_password minimal 6 karakter');
      expect(result.errors).toContain('company_email format tidak valid');
      expect(result.errors).toContain('tripay_mode harus salah satu dari: sandbox, live, production');
    });
  });
});
