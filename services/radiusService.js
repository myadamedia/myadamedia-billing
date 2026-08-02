/**
 * services/radiusService.js
 * Engine Embedded RADIUS Server (UDP Port 1812 Authentication & UDP Port 1813 Accounting)
 * Terintegrasi langsung dengan SQLite (billing.db) untuk PPPoE & Hotspot Vouchers.
 */

const dgram = require('dgram');
const crypto = require('crypto');
const radiusCodec = require('./radiusCodec');
const db = require('../config/database');
const { logger } = require('../config/logger');
const { createMikrotikVSA } = require('./radiusDictionary');

/**
 * Validasi password mendukung PAP (User-Password) dan CHAP (CHAP-Password & CHAP-Challenge)
 */
function validatePassword(packet, expectedPassword) {
  const exp = String(expectedPassword || '').trim();
  if (!exp) return true;

  const userPassword = String(packet.attributes['User-Password'] || '').trim();
  if (userPassword && userPassword === exp) {
    return true;
  }

  const chapPassword = packet.attributes['CHAP-Password'];
  if (chapPassword && Buffer.isBuffer(chapPassword) && chapPassword.length >= 17) {
    const chapIdent = chapPassword.readUInt8(0);
    const chapResponse = chapPassword.slice(1, 17);
    const chapChallenge = packet.attributes['CHAP-Challenge'];
    const challenge = (chapChallenge && Buffer.isBuffer(chapChallenge) && chapChallenge.length > 0)
      ? chapChallenge
      : packet.authenticator;

    const hash = crypto.createHash('md5')
      .update(Buffer.from([chapIdent]))
      .update(Buffer.from(exp, 'utf8'))
      .update(challenge)
      .digest();

    if (hash.equals(chapResponse)) {
      return true;
    }
  }

  return false;
}

const AUTH_PORT = Number(process.env.RADIUS_AUTH_PORT) || 1812;
const ACCT_PORT = Number(process.env.RADIUS_ACCT_PORT) || 1813;
const DEFAULT_INTERIM_INTERVAL = 300; // 5 menit (300 detik)

let authSocket = null;
let acctSocket = null;

/**
 * Mencari data NAS berdasarkan IP Address pengirim (rinfo.address) atau atribut NAS-IP-Address
 * @param {string} remoteIp IP pengirim paket UDP
 * @param {string} [nasIpAttr] Atribut NAS-IP-Address dari dalam paket RADIUS
 * @returns {Object|null} Record NAS dari DB
 */
function findNasRecord(remoteIp, nasIpAttr) {
  try {
    const ip = String(remoteIp || '').replace(/^::ffff:/, '').trim();
    const nasIp = nasIpAttr ? String(nasIpAttr).replace(/^::ffff:/, '').trim() : '';
    let record = db.prepare('SELECT * FROM radius_nas WHERE nasname = ? AND is_active = 1').get(ip);
    if (!record && nasIp) {
      record = db.prepare('SELECT * FROM radius_nas WHERE nasname = ? AND is_active = 1').get(nasIp);
    }
    // Jika tidak ditemukan dan hanya ada 1 NAS terdaftar, atau nasname = '0.0.0.0' (Wildcard/Any NAS)
    if (!record) {
      record = db.prepare("SELECT * FROM radius_nas WHERE nasname = '0.0.0.0' AND is_active = 1 LIMIT 1").get();
    }
    return record || null;
  } catch (err) {
    logger.error(`[RADIUS Service] Error lookup NAS record (${remoteIp}): ${err.message}`);
    return null;
  }
}

/**
 * Mengolah Paket UDP Access-Request (Port 1812)
 */
function handleAuthPacket(msg, rinfo) {
  try {
    // 1. Uji dekode awal untuk membaca atribut NAS-IP-Address dulu
    let unverifiedPacket;
    try {
      unverifiedPacket = radiusCodec.decodePacket(msg, '');
    } catch (e) {
      logger.warn(`[RADIUS Auth] Paket tidak valid dari ${rinfo.address}:${rinfo.port}`);
      return;
    }

    const nasIpAttr = unverifiedPacket.attributes['NAS-IP-Address'];
    const nasRecord = findNasRecord(rinfo.address, nasIpAttr);

    if (!nasRecord) {
      logger.warn(`[RADIUS Auth] Ditolak: Router NAS ${rinfo.address} (NAS-IP: ${nasIpAttr}) tidak terdaftar atau non-aktif.`);
      return;
    }

    const secret = nasRecord.secret;

    // 2. Dekode resmi dengan Shared Secret NAS
    let packet;
    try {
      packet = radiusCodec.decodePacket(msg, secret);
    } catch (e) {
      logger.error(`[RADIUS Auth] Invalid Shared Secret untuk NAS ${rinfo.address}: ${e.message}`);
      return;
    }

    if (packet.code !== 'Access-Request' && packet.codeNum !== 1) {
      logger.warn(`[RADIUS Auth] Membuang paket non Access-Request (Code=${packet.code}) dari ${rinfo.address}`);
      return;
    }

    const username = String(packet.attributes['User-Name'] || '').trim();
    const userPassword = String(packet.attributes['User-Password'] || '').trim();
    const serviceType = String(packet.attributes['Service-Type'] || '');
    const isMsChap = !!(packet.attributes['MS-CHAP2-Response'] || packet.attributes['MS-CHAP-Response']);
    const isChap = !!packet.attributes['CHAP-Password'];
    const authTypeStr = isMsChap ? 'MS-CHAPv2' : (isChap ? 'CHAP' : (userPassword ? 'PAP' : 'UNKNOWN/NONE'));

    logger.info(`[RADIUS Auth] Access-Request dari ${rinfo.address} | User: "${username}" | Proto: ${authTypeStr} | Service: ${serviceType || 'Unknown'}`);

    if (isMsChap) {
      logger.warn(`[RADIUS Auth] DITOLAK: Router NAS ${rinfo.address} mengirimkan MS-CHAPv2. Mohon AKTIFKAN PAP dan CHAP pada MikroTik PPP/Hotspot Profile (MS-CHAPv2 MD4 hashing diblokir oleh OpenSSL 3.0).`);
      sendAuthResponse('Access-Reject', packet, secret, [], rinfo);
      return;
    }

    if (!username) {
      logger.warn(`[RADIUS Auth] Ditolak: Username kosong dari ${rinfo.address}`);
      sendAuthResponse('Access-Reject', packet, secret, [], rinfo);
      return;
    }

    const cleanUsername = username.split('@')[0].trim();

    // 3. Cek Autentikasi Pengguna di Database

    // --- A. Cek Pelanggan PPPoE ---
    const customer = db.prepare(`
      SELECT c.*, p.name as package_name, p.speed_down, p.speed_up, p.mikrotik_rate_limit
      FROM customers c
      LEFT JOIN packages p ON c.package_id = p.id
      WHERE LOWER(c.pppoe_username) = LOWER(?) OR LOWER(c.pppoe_username) = LOWER(?)
         OR c.phone = ? OR LOWER(c.name) = LOWER(?)
      LIMIT 1
    `).get(username, cleanUsername, username, username);

    if (customer) {
      const expectedPassword = String(customer.pppoe_password || '').trim();
      const isPasswordValid = validatePassword(packet, expectedPassword);

      if (!isPasswordValid) {
        logger.warn(`[RADIUS Auth] DITOLAK (Password Salah) untuk PPPoE User: "${username}" (Expected pass length: ${expectedPassword.length})`);
        sendAuthResponse('Access-Reject', packet, secret, [], rinfo);
        return;
      }

      const isIsolated = customer.status === 'isolated' || customer.status === 'suspended';

      const responseAttributes = [
        ['Service-Type', 'Framed-User'],
        ['Framed-Protocol', 'PPP'],
        ['Acct-Interim-Interval', DEFAULT_INTERIM_INTERVAL]
      ];

      const ipAddress = customer.static_ip || customer.pppoe_remote_address;
      if (ipAddress) {
        responseAttributes.push(['Framed-IP-Address', ipAddress]);
      }

      if (isIsolated) {
        logger.info(`[RADIUS Auth] Pelanggan ${username} berstatus TERISOLIR. Menetapkan profil isolir.`);
        responseAttributes.push(createMikrotikVSA('Mikrotik-Address-List', 'LIST_ISOLIR'));
        responseAttributes.push(createMikrotikVSA('Mikrotik-Rate-Limit', '512k/512k'));
      } else {
        let rateLimitStr = customer.mikrotik_rate_limit;
        if (!rateLimitStr && (customer.speed_down || customer.speed_up)) {
          const down = customer.speed_down ? `${customer.speed_down}M` : '10M';
          const up = customer.speed_up ? `${customer.speed_up}M` : '10M';
          rateLimitStr = `${up}/${down}`;
        }
        if (rateLimitStr) {
          responseAttributes.push(createMikrotikVSA('Mikrotik-Rate-Limit', rateLimitStr));
        }
      }

      logger.info(`[RADIUS Auth] Access-Accept DIBERIKAN untuk PPPoE User: ${username} (Rate: ${customer.speed_down || 0}M)`);
      sendAuthResponse('Access-Accept', packet, secret, responseAttributes, rinfo);
      return;
    }

    // --- B. Cek Voucher Hotspot ---
    const voucher = db.prepare(`
      SELECT v.*, vp.price, vp.validity
      FROM vouchers v
      LEFT JOIN voucher_batches vb ON v.batch_id = vb.id
      LEFT JOIN voucher_packages vp ON (vb.profile_name = vp.profile_name OR v.profile_name = vp.profile_name)
      WHERE LOWER(v.code) = LOWER(?) OR LOWER(v.code) = LOWER(?)
      LIMIT 1
    `).get(username, cleanUsername);

    if (voucher) {
      const expectedPassword = String(voucher.password || '').trim();
      const isPasswordValid = validatePassword(packet, expectedPassword) || (userPassword && userPassword === username);

      if (!isPasswordValid) {
        logger.warn(`[RADIUS Auth] DITOLAK (Password Salah) untuk Voucher Hotspot: "${username}"`);
        sendAuthResponse('Access-Reject', packet, secret, [], rinfo);
        return;
      }

      if (voucher.status === 'pending') {
        const nowStr = new Date().toISOString();
        db.prepare("UPDATE vouchers SET status = 'used', used_at = ? WHERE id = ?").run(nowStr, voucher.id);
      }

      const responseAttributes = [
        ['Service-Type', 'Login-User'],
        ['Acct-Interim-Interval', DEFAULT_INTERIM_INTERVAL]
      ];

      if (voucher.profile_name) {
        responseAttributes.push(createMikrotikVSA('Mikrotik-Group', voucher.profile_name));
      }

      logger.info(`[RADIUS Auth] Access-Accept DIBERIKAN untuk Voucher Hotspot: ${username} (Profile: ${voucher.profile_name})`);
      sendAuthResponse('Access-Accept', packet, secret, responseAttributes, rinfo);
      return;
    }

    logger.warn(`[RADIUS Auth] DITOLAK: Username "${username}" tidak terdaftar di database (PPPoE / Voucher).`);
    sendAuthResponse('Access-Reject', packet, secret, [], rinfo);

  } catch (err) {
    logger.error(`[RADIUS Auth] Exception handling auth packet dari ${rinfo.address}: ${err.message}`);
  }
}

/**
 * Mengirimkan Paket Balasan Auth (Access-Accept / Access-Reject)
 */
function sendAuthResponse(code, reqPacket, secret, attributes, rinfo) {
  try {
    const encoded = radiusCodec.encodeResponse({
      code: code,
      secret: secret,
      identifier: reqPacket.identifier,
      authenticator: reqPacket.authenticator,
      attributes: attributes
    });

    authSocket.send(encoded, 0, encoded.length, rinfo.port, rinfo.address, (err) => {
      if (err) {
        logger.error(`[RADIUS Auth] Gagal mengirim paket ${code} ke ${rinfo.address}:${rinfo.port}: ${err.message}`);
      }
    });
  } catch (err) {
    logger.error(`[RADIUS Auth] Gagal encode_response ${code}: ${err.message}`);
  }
}


/**
 * Mengolah Paket UDP Accounting-Request (Port 1813)
 */
function handleAcctPacket(msg, rinfo) {
  try {
    let unverifiedPacket;
    try {
      unverifiedPacket = radiusCodec.decodePacket(msg, '');
    } catch (e) {
      return;
    }

    const nasIpAttr = unverifiedPacket.attributes['NAS-IP-Address'];
    const nasRecord = findNasRecord(rinfo.address, nasIpAttr);

    if (!nasRecord) {
      logger.warn(`[RADIUS Acct] Ditolak: NAS ${rinfo.address} tidak terdaftar.`);
      return;
    }

    const secret = nasRecord.secret;

    let packet;
    try {
      packet = radiusCodec.decodePacket(msg, secret);
    } catch (e) {
      logger.error(`[RADIUS Acct] Invalid Secret untuk NAS ${rinfo.address}: ${e.message}`);
      return;
    }

    if (packet.code !== 'Accounting-Request' && packet.codeNum !== 4) {
      return;
    }

    const username = String(packet.attributes['User-Name'] || '').trim();
    const acctStatusType = String(packet.attributes['Acct-Status-Type'] || ''); // Start, Interim-Update, Stop, Accounting-On, etc.
    const sessionId = String(packet.attributes['Acct-Session-Id'] || '');
    const nasIp = String(packet.attributes['NAS-IP-Address'] || rinfo.address).replace(/^::ffff:/, '');
    const framedIp = String(packet.attributes['Framed-IP-Address'] || '');
    const callingStationId = String(packet.attributes['Calling-Station-Id'] || ''); // MAC Address
    const sessionTime = Number(packet.attributes['Acct-Session-Time']) || 0;
    const inputOctets = Number(packet.attributes['Acct-Input-Octets']) || 0;   // Upload
    const outputOctets = Number(packet.attributes['Acct-Output-Octets']) || 0; // Download
    const terminateCause = String(packet.attributes['Acct-Terminate-Cause'] || '');
    const serviceType = String(packet.attributes['Service-Type'] || '');

    logger.info(`[RADIUS Acct] Paket Accounting Diterima | NAS=${nasIp} | User="${username}" | Status=${acctStatusType} | Session="${sessionId}"`);

    const nowStr = new Date().toISOString();

    const isStart = acctStatusType === 'Start' || acctStatusType === '1';
    const isInterim = acctStatusType === 'Interim-Update' || acctStatusType === '3';
    const isStop = acctStatusType === 'Stop' || acctStatusType === '2';

    if (isStart) {
      logger.info(`[RADIUS Acct] START Session: Username="${username}" | IP=${framedIp} | NAS=${nasIp} | SessionId=${sessionId}`);
      const existing = db.prepare("SELECT radacctid FROM radius_acct WHERE acctsessionid = ? AND username = ? AND acctstoptime IS NULL").get(sessionId, username);
      if (!existing) {
        db.prepare(`
          INSERT INTO radius_acct (
            acctsessionid, username, nasipaddress, acctstarttime, acctupdatetime,
            framedipaddress, callingstationid, servicetype
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(sessionId, username, nasIp, nowStr, nowStr, framedIp, callingStationId, serviceType);
      } else {
        db.prepare(`
          UPDATE radius_acct SET acctupdatetime = ?, framedipaddress = COALESCE(NULLIF(?, ''), framedipaddress)
          WHERE radacctid = ?
        `).run(nowStr, framedIp, existing.radacctid);
      }

    } else if (isInterim) {
      const res = db.prepare(`
        UPDATE radius_acct SET
          acctupdatetime = ?,
          acctsessiontime = ?,
          acctinputoctets = ?,
          acctoutputoctets = ?,
          framedipaddress = COALESCE(NULLIF(?, ''), framedipaddress),
          callingstationid = COALESCE(NULLIF(?, ''), callingstationid)
        WHERE acctsessionid = ? AND username = ? AND acctstoptime IS NULL
      `).run(nowStr, sessionTime, inputOctets, outputOctets, framedIp, callingStationId, sessionId, username);

      // Jika belum ada record (karena paket Start terlewat / user konek sebelum RADIUS restart) -> auto UPSERT
      if (res.changes === 0) {
        logger.info(`[RADIUS Acct] Auto-UPSERT Interim Session baru: Username="${username}" | SessionId=${sessionId}`);
        db.prepare(`
          INSERT INTO radius_acct (
            acctsessionid, username, nasipaddress, acctstarttime, acctupdatetime,
            acctsessiontime, acctinputoctets, acctoutputoctets,
            framedipaddress, callingstationid, servicetype
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(sessionId, username, nasIp, nowStr, nowStr, sessionTime, inputOctets, outputOctets, framedIp, callingStationId, serviceType);
      }

    } else if (isStop) {
      logger.info(`[RADIUS Acct] STOP Session: Username="${username}" | Uptime=${sessionTime}s | Cause=${terminateCause || 'Normal'}`);
      db.prepare(`
        UPDATE radius_acct SET
          acctstoptime = ?,
          acctupdatetime = ?,
          acctsessiontime = ?,
          acctinputoctets = ?,
          acctoutputoctets = ?,
          acctterminatecause = ?
        WHERE acctsessionid = ? AND username = ? AND acctstoptime IS NULL
      `).run(nowStr, nowStr, sessionTime, inputOctets, outputOctets, terminateCause, sessionId, username);

      // Update last seen voucher jika ini sesi voucher
      db.prepare(`
        UPDATE vouchers SET last_seen_at = ?, last_seen_uptime = ? WHERE code = ?
      `).run(nowStr, `${sessionTime}s`, username);
    }

    // Kirim Balasan Accounting-Response (RFC 2866)
    const encoded = radiusCodec.encodeResponse({
      code: 'Accounting-Response',
      secret: secret,
      identifier: packet.identifier,
      authenticator: packet.authenticator,
      attributes: []
    });

    acctSocket.send(encoded, 0, encoded.length, rinfo.port, rinfo.address, (err) => {
      if (err) {
        logger.error(`[RADIUS Acct] Gagal membalas Accounting-Response ke ${rinfo.address}: ${err.message}`);
      }
    });


  } catch (err) {
    logger.error(`[RADIUS Acct] Exception handling acct packet dari ${rinfo.address}: ${err.message}`);
  }
}

/**
 * Memulai Service UDP RADIUS Server
 */
function startRadiusServer() {
  if (authSocket || acctSocket) {
    logger.warn('[RADIUS Service] Server sudah berjalan.');
    return;
  }

  try {
    // 1. Socket Authentication (Port 1812)
    authSocket = dgram.createSocket('udp4');
    authSocket.on('message', handleAuthPacket);
    authSocket.on('error', (err) => {
      logger.error(`[RADIUS Auth Socket Error] ${err.message}`);
    });

    authSocket.bind(AUTH_PORT, () => {
      logger.info(`[RADIUS Service] UDP Authentication Server BERJALAN di Port ${AUTH_PORT}`);
    });

    // 2. Socket Accounting (Port 1813)
    acctSocket = dgram.createSocket('udp4');
    acctSocket.on('message', handleAcctPacket);
    acctSocket.on('error', (err) => {
      logger.error(`[RADIUS Acct Socket Error] ${err.message}`);
    });

    acctSocket.bind(ACCT_PORT, () => {
      logger.info(`[RADIUS Service] UDP Accounting Server BERJALAN di Port ${ACCT_PORT}`);
    });

  } catch (err) {
    logger.error(`[RADIUS Service] Gagal memulai RADIUS Server: ${err.message}`);
  }
}

/**
 * Menghentikan Service UDP RADIUS Server
 */
function stopRadiusServer() {
  if (authSocket) {
    authSocket.close();
    authSocket = null;
  }
  if (acctSocket) {
    acctSocket.close();
    acctSocket = null;
  }
  logger.info('[RADIUS Service] UDP RADIUS Server berhasil dihentikan.');
}

module.exports = {
  startRadiusServer,
  stopRadiusServer
};
