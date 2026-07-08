const crypto = require('crypto');

// Parameters for scrypt
const SCRYPT_PARAMS = {
  keylen: 64,
  cost: 16384,
  blockSize: 8,
  parallelization: 1
};

/**
 * Hash a password using scrypt
 * @param {string} password 
 * @returns {string} format: scrypt$cost$blockSize$parallelization$salt$hash
 */
function hashPassword(password) {
  if (!password) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.cost,
    r: SCRYPT_PARAMS.blockSize,
    p: SCRYPT_PARAMS.parallelization
  }).toString('hex');
  
  return `scrypt$${SCRYPT_PARAMS.cost}$${SCRYPT_PARAMS.blockSize}$${SCRYPT_PARAMS.parallelization}$${salt}$${hash}`;
}

/**
 * Verify a password against a hash (with plaintext fallback)
 * @param {string} password 
 * @param {string} hashOrPlaintext 
 * @returns {boolean}
 */
function verifyPassword(password, hashOrPlaintext) {
  if (!password || !hashOrPlaintext) return false;
  
  // Check if it is a scrypt hash
  if (hashOrPlaintext.startsWith('scrypt$')) {
    const parts = hashOrPlaintext.split('$');
    if (parts.length === 6) {
      const [, costStr, blockSizeStr, parallelizationStr, salt, hash] = parts;
      const N = parseInt(costStr, 10);
      const r = parseInt(blockSizeStr, 10);
      const p = parseInt(parallelizationStr, 10);
      const keylen = Buffer.from(hash, 'hex').length;
      
      try {
        const derived = crypto.scryptSync(password, salt, keylen, { N, r, p }).toString('hex');
        return derived === hash;
      } catch (e) {
        return false;
      }
    }
  }
  
  // Fallback to plaintext comparison
  return password === hashOrPlaintext;
}

/**
 * Check if the stored string is actually a hash or plaintext
 * @param {string} hashOrPlaintext 
 * @returns {boolean}
 */
function isHash(hashOrPlaintext) {
  return typeof hashOrPlaintext === 'string' && hashOrPlaintext.startsWith('scrypt$');
}

module.exports = {
  hashPassword,
  verifyPassword,
  isHash
};
