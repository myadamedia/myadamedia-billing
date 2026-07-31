/**
 * services/radiusCoaService.js
 * Modul Pengirim RADIUS Disconnect-Request (PoD / CoA) via UDP Port 3799
 * Digunakan untuk pemutusan koneksi seketika (Instant Isolation / Disconnect) saat user diisolir atau voucher habis.
 */

const dgram = require('dgram');
const radiusCodec = require('./radiusCodec');
const db = require('../config/database');
const { logger } = require('../config/logger');

/**
 * Mengirimkan paket Disconnect-Request (RFC 3576 / RFC 5176) ke MikroTik NAS
 * @param {Object} options
 * @param {string} options.nasIpAddress IP Address MikroTik Router NAS
 * @param {string} options.secret Secret Key RADIUS NAS
 * @param {string} options.username Username PPPoE atau Voucher Hotspot
 * @param {string} [options.acctSessionId] Acct-Session-Id opsional
 * @param {string} [options.framedIpAddress] Framed-IP-Address opsional
 * @param {number} [options.port=3799] Port UDP CoA MikroTik (default 3799)
 * @param {number} [options.timeoutMs=3000] Timeout dalam milidetik
 * @returns {Promise<Object>} Resolves dengan status ACK/NAK
 */
function sendDisconnectRequest(options) {
  return new Promise((resolve, reject) => {
    const {
      nasIpAddress,
      secret,
      username,
      acctSessionId,
      framedIpAddress,
      port = 3799,
      timeoutMs = 3000
    } = options;

    if (!nasIpAddress || !secret || !username) {
      return reject(new Error('Parameter nasIpAddress, secret, dan username wajib diisi.'));
    }

    const attributes = [
      ['User-Name', username]
    ];

    if (acctSessionId) {
      attributes.push(['Acct-Session-Id', String(acctSessionId)]);
    }
    if (framedIpAddress) {
      attributes.push(['Framed-IP-Address', String(framedIpAddress)]);
    }

    let encoded;
    try {
      encoded = radiusCodec.encodeRequest({
        code: 'Disconnect-Request',
        secret: secret,
        attributes: attributes
      });
    } catch (err) {
      logger.error(`[RADIUS CoA] Gagal melakukan encode Disconnect-Request untuk user ${username}: ${err.message}`);
      return reject(err);
    }

    const client = dgram.createSocket('udp4');
    let timer = null;

    client.on('message', (msg) => {
      clearTimeout(timer);
      client.close();
      try {
        const decoded = radiusCodec.decodePacket(msg, secret);
        logger.info(`[RADIUS CoA] Menerima balasan dari NAS ${nasIpAddress} (${username}): Code=${decoded.code}`);
        if (decoded.code === 'Disconnect-ACK' || decoded.codeNum === 41) {
          resolve({ success: true, code: decoded.code, message: 'Koneksi berhasil diputus (Disconnect-ACK)' });
        } else {
          resolve({ success: false, code: decoded.code, message: `Disconnect gagal/ditolak (${decoded.code})` });
        }
      } catch (err) {
        reject(new Error(`Gagal decode balasan RADIUS CoA dari NAS: ${err.message}`));
      }
    });


    client.on('error', (err) => {
      clearTimeout(timer);
      client.close();
      logger.error(`[RADIUS CoA] Socket UDP error (${nasIpAddress}): ${err.message}`);
      reject(err);
    });

    client.send(encoded, 0, encoded.length, port, nasIpAddress, (err) => {
      if (err) {
        clearTimeout(timer);
        client.close();
        logger.error(`[RADIUS CoA] Gagal mengirim paket UDP ke ${nasIpAddress}:${port}: ${err.message}`);
        return reject(err);
      }
      logger.info(`[RADIUS CoA] Disconnect-Request terkirim ke NAS ${nasIpAddress}:${port} untuk user ${username}`);
    });

    timer = setTimeout(() => {
      client.close();
      logger.warn(`[RADIUS CoA] Timeout (${timeoutMs}ms) menunggu balasan Disconnect-ACK dari NAS ${nasIpAddress}`);
      resolve({ success: false, code: 'TIMEOUT', message: `Timeout ${timeoutMs}ms tidak ada balasan dari Router NAS` });
    }, timeoutMs);
  });
}

/**
 * Helper untuk memutus koneksi pelanggan secara otomatis berdasarkan username
 * Membaca data NAS aktif dari tabel radius_acct dan radius_nas
 * @param {string} username
 * @returns {Promise<Object>}
 */
async function disconnectUserByUsername(username) {
  try {
    const user = String(username || '').trim();
    if (!user) {
      return { success: false, message: 'Username kosong' };
    }

    // Cari sesi aktif dari tabel radius_acct
    const session = db.prepare(`
      SELECT nasipaddress, acctsessionid, framedipaddress 
      FROM radius_acct 
      WHERE username = ? AND acctstoptime IS NULL 
      ORDER BY radacctid DESC LIMIT 1
    `).get(user);

    if (!session) {
      logger.info(`[RADIUS CoA] Tidak ada sesi aktif berstatus online di DB untuk username: ${user}`);
    }

    const nasIp = session ? session.nasipaddress : null;

    // Cari secret NAS dari DB radius_nas
    let nasRecord = null;
    if (nasIp) {
      nasRecord = db.prepare('SELECT secret FROM radius_nas WHERE nasname = ? AND is_active = 1').get(nasIp);
    }

    // Jika tidak ditemukan via IP spesifik, ambil NAS aktif mana saja di radius_nas
    if (!nasRecord) {
      nasRecord = db.prepare('SELECT nasname, secret FROM radius_nas WHERE is_active = 1 ORDER BY id ASC LIMIT 1').get();
    }

    if (!nasRecord) {
      return { success: false, message: 'Tidak ada Router NAS aktif yang terdaftar di database.' };
    }

    const targetNasIp = nasIp || nasRecord.nasname;
    const targetSecret = nasRecord.secret;

    return await sendDisconnectRequest({
      nasIpAddress: targetNasIp,
      secret: targetSecret,
      username: user,
      acctSessionId: session ? session.acctsessionid : undefined,
      framedIpAddress: session ? session.framedipaddress : undefined
    });
  } catch (err) {
    logger.error(`[RADIUS CoA] Exception saat disconnect user ${username}: ${err.message}`);
    return { success: false, message: err.message };
  }
}

module.exports = {
  sendDisconnectRequest,
  disconnectUserByUsername
};
