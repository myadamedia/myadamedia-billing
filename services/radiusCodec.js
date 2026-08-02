/**
 * services/radiusCodec.js
 * Implementation murni Node.js (Crypto & Buffer) untuk Encoding & Decoding Paket RADIUS
 * Standar RFC 2865, RFC 2866, dan RFC 3576 (Disconnection / CoA).
 * Eliminasi dependensi NPM eksternal untuk keandalan 100%.
 */

const crypto = require('crypto');

const CODES = {
  1: 'Access-Request',
  2: 'Access-Accept',
  3: 'Access-Reject',
  4: 'Accounting-Request',
  5: 'Accounting-Response',
  40: 'Disconnect-Request',
  41: 'Disconnect-ACK',
  42: 'Disconnect-NAK'
};

const CODE_NUMBERS = {
  'Access-Request': 1,
  'Access-Accept': 2,
  'Access-Reject': 3,
  'Accounting-Request': 4,
  'Accounting-Response': 5,
  'Disconnect-Request': 40,
  'Disconnect-ACK': 41,
  'Disconnect-NAK': 42
};

const ATTR_TYPES = {
  1: { name: 'User-Name', type: 'string' },
  2: { name: 'User-Password', type: 'password' },
  3: { name: 'CHAP-Password', type: 'octets' },
  4: { name: 'NAS-IP-Address', type: 'ip' },
  5: { name: 'NAS-Port', type: 'integer' },
  6: { name: 'Service-Type', type: 'integer' },
  7: { name: 'Framed-Protocol', type: 'integer' },
  8: { name: 'Framed-IP-Address', type: 'ip' },
  26: { name: 'Vendor-Specific', type: 'vsa' },
  30: { name: 'Called-Station-Id', type: 'string' },
  31: { name: 'Calling-Station-Id', type: 'string' },
  40: { name: 'Acct-Status-Type', type: 'integer' },
  44: { name: 'Acct-Session-Id', type: 'string' },
  45: { name: 'Acct-Authentic', type: 'integer' },
  46: { name: 'Acct-Session-Time', type: 'integer' },
  47: { name: 'Acct-Input-Octets', type: 'integer' },
  48: { name: 'Acct-Output-Octets', type: 'integer' },
  49: { name: 'Acct-Terminate-Cause', type: 'integer' },
  60: { name: 'CHAP-Challenge', type: 'octets' },
  85: { name: 'Acct-Interim-Interval', type: 'integer' }
};

const ACCT_STATUS_MAP = {
  1: 'Start',
  2: 'Stop',
  3: 'Interim-Update',
  7: 'Accounting-On',
  8: 'Accounting-Off'
};

const SERVICE_TYPE_MAP = {
  1: 'Login-User',
  2: 'Framed-User',
  3: 'Callback-Login-User',
  4: 'Callback-Framed-User',
  5: 'Outbound-User',
  6: 'Administrative-User'
};

/**
 * Memecah password terenkripsi PAP sesuai RFC 2865
 */
function decryptPapPassword(encryptedBuf, secret, authenticator) {
  if (!encryptedBuf || encryptedBuf.length < 16 || encryptedBuf.length % 16 !== 0) {
    return '';
  }

  let decrypted = Buffer.alloc(encryptedBuf.length);
  let lastBlock = authenticator;

  for (let i = 0; i < encryptedBuf.length; i += 16) {
    const hash = crypto.createHash('md5').update(secret).update(lastBlock).digest();
    for (let j = 0; j < 16; j++) {
      decrypted[i + j] = encryptedBuf[i + j] ^ hash[j];
    }
    lastBlock = encryptedBuf.slice(i, i + 16);
  }

  // Potong null-byte padding di akhir
  let len = decrypted.length;
  while (len > 0 && decrypted[len - 1] === 0) {
    len--;
  }

  return decrypted.slice(0, len).toString('utf8');
}

/**
 * Mendekode paket RADIUS dari Buffer UDP
 */
function decodePacket(buffer, secret = '') {
  if (buffer.length < 20) {
    throw new Error('Paket RADIUS terlalu pendek (minimal 20 byte).');
  }

  const codeNum = buffer.readUInt8(0);
  const identifier = buffer.readUInt8(1);
  const length = buffer.readUInt16BE(2);
  const authenticator = buffer.slice(4, 20);

  const code = CODES[codeNum] || `Unknown-${codeNum}`;
  const attributes = {};
  const rawAttributes = [];

  let offset = 20;
  const maxLen = Math.min(length, buffer.length);

  while (offset < maxLen) {
    if (offset + 2 > maxLen) break;
    const attrType = buffer.readUInt8(offset);
    const attrLen = buffer.readUInt8(offset + 1);

    if (attrLen < 2 || offset + attrLen > maxLen) break;

    const valBuf = buffer.slice(offset + 2, offset + attrLen);
    const attrMeta = ATTR_TYPES[attrType];

    let val = valBuf;
    let attrName = attrMeta ? attrMeta.name : `Attr-${attrType}`;

    if (attrMeta) {
      if (attrMeta.type === 'string') {
        val = valBuf.toString('utf8');
      } else if (attrMeta.type === 'integer') {
        val = valBuf.length >= 4 ? valBuf.readUInt32BE(0) : 0;
        if (attrName === 'Acct-Status-Type') {
          val = ACCT_STATUS_MAP[val] || val;
        } else if (attrName === 'Service-Type') {
          val = SERVICE_TYPE_MAP[val] || val;
        }
      } else if (attrMeta.type === 'ip') {
        val = valBuf.length === 4 ? Array.from(valBuf).join('.') : '';
      } else if (attrMeta.type === 'password' && secret) {
        val = decryptPapPassword(valBuf, secret, authenticator);
      } else if (attrMeta.type === 'octets') {
        val = valBuf;
      }
    }

    if (attrType === 26 && valBuf.length >= 6) {
      const vendorId = valBuf.readUInt32BE(0);
      if (vendorId === 311) {
        let vOffset = 4;
        while (vOffset + 2 <= valBuf.length) {
          const vType = valBuf.readUInt8(vOffset);
          const vLen = valBuf.readUInt8(vOffset + 1);
          if (vLen < 2 || vOffset + vLen > valBuf.length) break;
          const vData = valBuf.slice(vOffset + 2, vOffset + vLen);
          if (vType === 25) attributes['MS-CHAP2-Response'] = vData;
          if (vType === 11) attributes['MS-CHAP-Challenge'] = vData;
          if (vType === 1) attributes['MS-CHAP-Response'] = vData;
          vOffset += vLen;
        }
      }
    }

    attributes[attrName] = val;
    rawAttributes.push({ type: attrType, name: attrName, value: val, raw: valBuf });
    offset += attrLen;
  }

  return {
    code,
    codeNum,
    identifier,
    length,
    authenticator,
    attributes,
    rawAttributes
  };
}

/**
 * Mengkodekan respons RADIUS (Access-Accept, Access-Reject, Accounting-Response)
 */
function encodeResponse(options) {
  const { code, secret, identifier, authenticator, attributes = [] } = options;

  const codeNum = typeof code === 'number' ? code : (CODE_NUMBERS[code] || 2);
  let attrBuffers = [];

  for (const attr of attributes) {
    let type = 0;
    let valBuf = Buffer.alloc(0);

    if (Array.isArray(attr)) {
      const [name, val] = attr;
      if (name === 'Vendor-Specific' && Buffer.isBuffer(val)) {
        type = 26;
        valBuf = val;
      } else if (name === 'Service-Type') {
        type = 6;
        valBuf = Buffer.alloc(4);
        const codeVal = typeof val === 'number' ? val : (val === 'Framed-User' ? 2 : 1);
        valBuf.writeUInt32BE(codeVal, 0);
      } else if (name === 'Framed-Protocol') {
        type = 7;
        valBuf = Buffer.alloc(4);
        valBuf.writeUInt32BE(val === 'PPP' ? 1 : 1, 0);
      } else if (name === 'Framed-IP-Address') {
        type = 8;
        const parts = String(val).split('.').map(Number);
        valBuf = Buffer.from(parts);
      } else if (name === 'Acct-Interim-Interval') {
        type = 85;
        valBuf = Buffer.alloc(4);
        valBuf.writeUInt32BE(Number(val) || 300, 0);
      } else {
        // String fallback
        type = 1;
        valBuf = Buffer.from(String(val), 'utf8');
      }
    }

    if (type > 0 && valBuf.length > 0) {
      const len = 2 + valBuf.length;
      const buf = Buffer.alloc(len);
      buf.writeUInt8(type, 0);
      buf.writeUInt8(len, 1);
      valBuf.copy(buf, 2);
      attrBuffers.push(buf);
    }
  }

  const allAttrsBuf = Buffer.concat(attrBuffers);
  const totalLength = 20 + allAttrsBuf.length;

  const headerBuf = Buffer.alloc(20);
  headerBuf.writeUInt8(codeNum, 0);
  headerBuf.writeUInt8(identifier & 0xff, 1);
  headerBuf.writeUInt16BE(totalLength, 2);
  authenticator.copy(headerBuf, 4);

  // Response Authenticator = MD5(Code + ID + Length + RequestAuthenticator + Attributes + Secret)
  const hash = crypto.createHash('md5')
    .update(headerBuf.slice(0, 4))
    .update(authenticator)
    .update(allAttrsBuf)
    .update(secret)
    .digest();

  hash.copy(headerBuf, 4);

  return Buffer.concat([headerBuf, allAttrsBuf]);
}

/**
 * Mengkodekan Disconnect-Request (PoD / CoA - RFC 3576 / UDP 3799)
 */
function encodeRequest(options) {
  const { code = 'Disconnect-Request', secret, identifier = Math.floor(Math.random() * 255), attributes = [] } = options;
  const codeNum = CODE_NUMBERS[code] || 40;

  let attrBuffers = [];
  for (const [name, val] of attributes) {
    let type = 0;
    let valBuf = Buffer.alloc(0);

    if (name === 'User-Name') {
      type = 1;
      valBuf = Buffer.from(String(val), 'utf8');
    } else if (name === 'Acct-Session-Id') {
      type = 44;
      valBuf = Buffer.from(String(val), 'utf8');
    } else if (name === 'Framed-IP-Address') {
      type = 8;
      valBuf = Buffer.from(String(val).split('.').map(Number));
    }

    if (type > 0 && valBuf.length > 0) {
      const len = 2 + valBuf.length;
      const buf = Buffer.alloc(len);
      buf.writeUInt8(type, 0);
      buf.writeUInt8(len, 1);
      valBuf.copy(buf, 2);
      attrBuffers.push(buf);
    }
  }

  const allAttrsBuf = Buffer.concat(attrBuffers);
  const totalLength = 20 + allAttrsBuf.length;
  const zeroAuth = Buffer.alloc(16, 0);

  const headerBuf = Buffer.alloc(20);
  headerBuf.writeUInt8(codeNum, 0);
  headerBuf.writeUInt8(identifier & 0xff, 1);
  headerBuf.writeUInt16BE(totalLength, 2);

  // Authenticator CoA = MD5(Code + ID + Length + 16 Zero Bytes + Attributes + Secret)
  const hash = crypto.createHash('md5')
    .update(headerBuf.slice(0, 4))
    .update(zeroAuth)
    .update(allAttrsBuf)
    .update(secret)
    .digest();

  hash.copy(headerBuf, 4);

  return Buffer.concat([headerBuf, allAttrsBuf]);
}

module.exports = {
  CODES,
  decodePacket,
  encodeResponse,
  encodeRequest
};
