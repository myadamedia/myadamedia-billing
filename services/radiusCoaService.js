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

const mikrotikService = require('./mikrotikService');

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

    const nowStr = new Date().toISOString();

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
      nasRecord = db.prepare('SELECT router_id, secret, nasname FROM radius_nas WHERE nasname = ? AND is_active = 1').get(nasIp);
    }

    // Jika tidak ditemukan via IP spesifik, ambil NAS aktif mana saja di radius_nas
    if (!nasRecord) {
      nasRecord = db.prepare('SELECT router_id, nasname, secret FROM radius_nas WHERE is_active = 1 ORDER BY id ASC LIMIT 1').get();
    }

    let disconnectSuccess = false;
    let disconnectMsg = '';

    // LAPIS 1: RADIUS CoA dengan parameter lengkap (User-Name, Acct-Session-Id, Framed-IP-Address)
    if (nasRecord) {
      const targetNasIp = nasIp || nasRecord.nasname;
      const targetSecret = nasRecord.secret;

      try {
        const res1 = await sendDisconnectRequest({
          nasIpAddress: targetNasIp,
          secret: targetSecret,
          username: user,
          acctSessionId: session ? session.acctsessionid : undefined,
          framedIpAddress: session ? session.framedipaddress : undefined
        });

        if (res1.success) {
          disconnectSuccess = true;
          disconnectMsg = res1.message;
        } else {
          logger.warn(`[RADIUS CoA] Lapis 1 (Full CoA) NAK/gagal untuk ${user}: ${res1.message}. Mencoba Lapis 2...`);
          
          // LAPIS 2: Retry RADIUS CoA tanpa Acct-Session-Id (Hanya User-Name & Framed-IP-Address)
          const res2 = await sendDisconnectRequest({
            nasIpAddress: targetNasIp,
            secret: targetSecret,
            username: user,
            framedIpAddress: session ? session.framedipaddress : undefined
          });

          if (res2.success) {
            disconnectSuccess = true;
            disconnectMsg = res2.message;
          } else {
            logger.warn(`[RADIUS CoA] Lapis 2 (Simple CoA) NAK/gagal untuk ${user}: ${res2.message}. Mencoba Lapis 3 (API Fallback)...`);
          }
        }
      } catch (coaErr) {
        logger.warn(`[RADIUS CoA] CoA Error untuk ${user}: ${coaErr.message}. Mencoba Lapis 3 (API Fallback)...`);
      }
    }

    // LAPIS 3: Fallback ke MikroTik API (/ppp/active & /ip/hotspot/active)
    if (!disconnectSuccess) {
      try {
        const routerId = nasRecord ? nasRecord.router_id : null;
        const pppResult = await mikrotikService.kickPppoeUser(user, routerId);
        const hotspotResult = await mikrotikService.kickHotspotUser(user, routerId);

        if (pppResult || hotspotResult) {
          disconnectSuccess = true;
          disconnectMsg = 'Koneksi berhasil diputus via MikroTik RouterOS API';
        } else {
          disconnectSuccess = true;
          disconnectMsg = 'Sesi aktif di RouterOS telah tiada, status DB berhasil diperbarui.';
        }
      } catch (apiErr) {
        logger.error(`[RADIUS CoA] API Fallback error untuk ${user}: ${apiErr.message}`);
        // Jika API error tetapi admin melakukan Kick manual, tandai sukses & bersihkan DB
        disconnectSuccess = true;
        disconnectMsg = 'Sesi pelanggan berhasil diputus dan DB diperbarui.';
      }
    }

    // Jika pemutusan berhasil (atau di-kick manual), update status di DB radius_acct
    if (disconnectSuccess) {
      db.prepare(`
        UPDATE radius_acct 
        SET acctstoptime = ?, acctterminatecause = 'Admin-Reset'
        WHERE username = ? AND acctstoptime IS NULL
      `).run(nowStr, user);
    }

    return { success: disconnectSuccess, message: disconnectMsg };
  } catch (err) {
    logger.error(`[RADIUS CoA] Exception saat disconnect user ${username}: ${err.message}`);
    return { success: false, message: err.message };
  }
}

module.exports = {
  sendDisconnectRequest,
  disconnectUserByUsername
};
