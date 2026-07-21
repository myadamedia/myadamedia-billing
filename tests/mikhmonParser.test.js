const { parseMikhmonOnLogin } = require('../utils/mikhmonParser');

describe('mikhmonParser', () => {
  it('should return null for empty or falsy inputs', () => {
    expect(parseMikhmonOnLogin(null)).toBeNull();
    expect(parseMikhmonOnLogin(undefined)).toBeNull();
    expect(parseMikhmonOnLogin('')).toBeNull();
  });

  describe('Format 1: :put (",rem,COST,VALIDITY,PRICE,...)', () => {
    it('should parse standard ROS6/ROS7 put script', () => {
      const script = ':put (",rem,4000,2d,5000,,Disable,");';
      const result = parseMikhmonOnLogin(script);
      expect(result).toEqual({
        cost: 4000,
        validity: '2d',
        price: 5000
      });
    });

    it('should match Format 1 regex exactly with non-quote rem prefix', () => {
      const script = ':put (,rem,3000,1d,4000)';
      const result = parseMikhmonOnLogin(script);
      expect(result).toEqual({
        cost: 3000,
        validity: '1d',
        price: 4000
      });
    });

    it('should fallback cost to 0 if cost has no digits', () => {
      const script = ':put (,rem,abc,1d,4000)';
      const result = parseMikhmonOnLogin(script);
      expect(result).toEqual({
        cost: 0,
        validity: '1d',
        price: 4000
      });
    });

    it('should handle different spacing and casing', () => {
      const script = ' :PUT  ( ",rem" , 3000 , 1d , 4000 ) ';
      const result = parseMikhmonOnLogin(script);
      expect(result).toEqual({
        cost: 3000,
        validity: '1d',
        price: 4000
      });
    });

    it('should handle non-digit characters in price and cost', () => {
      const script = ':put (",rem,Rp. 4.000,2d,Rp. 5.000,")';
      const result = parseMikhmonOnLogin(script);
      expect(result).toEqual({
        cost: 4000,
        validity: '2d',
        price: 5000
      });
    });

    it('should return null if price is <= 0 or validity is missing', () => {
      expect(parseMikhmonOnLogin(':put (,rem,4000,,5000)')).toBeNull();
      expect(parseMikhmonOnLogin(':put (,rem,4000,2d,0)')).toBeNull();
      expect(parseMikhmonOnLogin(':put (,rem,4000,2d,abc)')).toBeNull();
    });
  });

  describe('Format 2: $HARGA^VALIDITAS', () => {
    it('should parse shorthand format', () => {
      const script = '$5000^1d';
      const result = parseMikhmonOnLogin(script);
      expect(result).toEqual({
        price: 5000,
        validity: '1d',
        cost: 0
      });
    });

    it('should handle spaces', () => {
      const script = '   $10000^7d   ';
      const result = parseMikhmonOnLogin(script);
      expect(result).toEqual({
        price: 10000,
        validity: '7d',
        cost: 0
      });
    });

    it('should return null if price <= 0', () => {
      expect(parseMikhmonOnLogin('$0^1d')).toBeNull();
    });
  });

  describe('Format 3: HARGA^VALIDITAS (without dollar)', () => {
    it('should parse bare format with valid time suffixes', () => {
      const script = '5000^1d';
      const result = parseMikhmonOnLogin(script);
      expect(result).toEqual({
        price: 5000,
        validity: '1d',
        cost: 0
      });
    });

    it('should parse in semicolon or comma lists', () => {
      expect(parseMikhmonOnLogin('limit;10000^7d')).toEqual({
        price: 10000,
        validity: '7d',
        cost: 0
      });
      expect(parseMikhmonOnLogin('test,2000^12h')).toEqual({
        price: 2000,
        validity: '12h',
        cost: 0
      });
    });

    it('should return null if not matching time suffixes', () => {
      expect(parseMikhmonOnLogin('5000^abc')).toBeNull();
    });
  });

  describe('Format 4: Comma-split fallback', () => {
    it('should parse comma-split values containing rem', () => {
      const script = 'abc, rem, 4000, 30d, 6000, xyz';
      const result = parseMikhmonOnLogin(script);
      expect(result).toEqual({
        cost: 4000,
        validity: '30d',
        price: 6000
      });
    });

    it('should handle non-digit characters in price/cost for fallback', () => {
      const script = 'rem, Rp 2.000, 1w, 3000';
      const result = parseMikhmonOnLogin(script);
      expect(result).toEqual({
        cost: 2000,
        validity: '1w',
        price: 3000
      });
    });

    it('should return null if trailing index is out of bounds or invalid values', () => {
      expect(parseMikhmonOnLogin('some,rem,1000,2d')).toBeNull(); // Missing price
      expect(parseMikhmonOnLogin('some,rem,1000,2d,0')).toBeNull(); // Price is 0
    });

    it('should handle comma-split fallback with empty spaces', () => {
      const script = ',,rem,4000,,5000';
      expect(parseMikhmonOnLogin(script)).toBeNull(); // Missing validity
    });

    it('should fallback cost to 0 if cost has no digits in comma split', () => {
      const script = 'abc, rem, xyz, 30d, 6000, other';
      const result = parseMikhmonOnLogin(script);
      expect(result).toEqual({
        cost: 0,
        validity: '30d',
        price: 6000
      });
    });
  });

  describe('Non-matching fallbacks', () => {
    it('should return null if script has completely random text', () => {
      expect(parseMikhmonOnLogin('hello-world-no-match')).toBeNull();
      expect(parseMikhmonOnLogin('rem, 4000')).toBeNull();
    });
  });
});
