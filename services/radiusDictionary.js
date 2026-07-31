/**
 * services/radiusDictionary.js
 * Kamus Vendor-Specific Attributes (VSA) MikroTik & RFC RADIUS Standard
 * Vendor ID MikroTik: 14988
 */

const MIKROTIK_VENDOR_ID = 14988;

const MIKROTIK_ATTRIBUTES = {
  'Mikrotik-Recv-Limit': { id: 1, type: 'integer' },
  'Mikrotik-Xmit-Limit': { id: 2, type: 'integer' },
  'Mikrotik-Group': { id: 3, type: 'string' },
  'Mikrotik-Wireless-Forward': { id: 4, type: 'integer' },
  'Mikrotik-Wireless-Skip-Dot1x': { id: 5, type: 'integer' },
  'Mikrotik-Wireless-Enc-Algo': { id: 6, type: 'integer' },
  'Mikrotik-Wireless-Enc-Key': { id: 7, type: 'string' },
  'Mikrotik-Rate-Limit': { id: 8, type: 'string' },
  'Mikrotik-Realm': { id: 9, type: 'string' },
  'Mikrotik-Host-IP': { id: 10, type: 'ipaddr' },
  'Mikrotik-Mark-Id': { id: 11, type: 'string' },
  'Mikrotik-Advertise-URL': { id: 12, type: 'string' },
  'Mikrotik-Advertise-Interval': { id: 13, type: 'integer' },
  'Mikrotik-Recv-Limit-Gigawords': { id: 14, type: 'integer' },
  'Mikrotik-Xmit-Limit-Gigawords': { id: 15, type: 'integer' },
  'Mikrotik-Wireless-PSK': { id: 16, type: 'string' },
  'Mikrotik-Total-Limit': { id: 17, type: 'integer' },
  'Mikrotik-Total-Limit-Gigawords': { id: 18, type: 'integer' },
  'Mikrotik-Address-List': { id: 19, type: 'string' }
};

/**
 * Menyusun Vendor-Specific Attributes (VSA) MikroTik ke dalam format buffer RADIUS RFC 2865
 * @param {string} attrName Nama Atribut (contoh: 'Mikrotik-Rate-Limit')
 * @param {string|number} value Nilai Atribut
 * @returns {Array} Format [Vendor-Specific, Buffer VSA]
 */
function createMikrotikVSA(attrName, value) {
  const meta = MIKROTIK_ATTRIBUTES[attrName];
  if (!meta) {
    throw new Error(`Atribut MikroTik VSA '${attrName}' tidak ditemukan dalam kamus.`);
  }

  let valBuf;
  if (meta.type === 'string') {
    valBuf = Buffer.from(String(value), 'utf8');
  } else if (meta.type === 'integer') {
    valBuf = Buffer.alloc(4);
    valBuf.writeUInt32BE(Number(value) || 0, 0);
  } else if (meta.type === 'ipaddr') {
    const parts = String(value).split('.').map(Number);
    valBuf = Buffer.from(parts);
  } else {
    valBuf = Buffer.from(String(value), 'utf8');
  }

  // Header VSA per atribut: [Type (1 byte), Length (1 byte), Value]
  const attrLen = 2 + valBuf.length;
  const vsaAttrBuf = Buffer.alloc(attrLen);
  vsaAttrBuf.writeUInt8(meta.id, 0);
  vsaAttrBuf.writeUInt8(attrLen, 1);
  valBuf.copy(vsaAttrBuf, 2);

  // Outer Vendor-Specific Header: [Vendor-Id (4 bytes), VSA Payload]
  const vsaPayloadLen = 4 + vsaAttrBuf.length;
  const vsaBuffer = Buffer.alloc(vsaPayloadLen);
  vsaBuffer.writeUInt32BE(MIKROTIK_VENDOR_ID, 0);
  vsaAttrBuf.copy(vsaBuffer, 4);

  return ['Vendor-Specific', vsaBuffer];
}

module.exports = {
  MIKROTIK_VENDOR_ID,
  MIKROTIK_ATTRIBUTES,
  createMikrotikVSA
};
