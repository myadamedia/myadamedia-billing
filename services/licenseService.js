/**
 * License Service - Offline RSA License Verification & Activation
 * Validates lifetime licenses signed by BroLinks RSA Private Key against local Machine ID.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const machineIdService = require('./machineIdService');

const publicKeyPath = path.join(__dirname, '../config/keys/vendor_public_key.pem');
const settingsPath = path.join(__dirname, '../settings.json');

/**
 * Read vendor RSA public key
 */
function getPublicKey() {
  try {
    if (!fs.existsSync(publicKeyPath)) {
      return null;
    }
    return fs.readFileSync(publicKeyPath, 'utf8');
  } catch (error) {
    console.error('[LicenseService] Error reading public key:', error.message);
    return null;
  }
}

/**
 * Get current raw license key stored in settings.json
 */
function getStoredLicenseKey() {
  try {
    if (!fs.existsSync(settingsPath)) return null;
    const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return data.license_key || null;
  } catch (error) {
    return null;
  }
}

/**
 * Save raw license key to settings.json
 */
function saveLicenseKey(licenseKey) {
  try {
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    settings.license_key = licenseKey;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('[LicenseService] Error saving license key:', error.message);
    return false;
  }
}

/**
 * Clear/Revoke license key from settings.json
 */
function clearLicenseKey() {
  try {
    if (!fs.existsSync(settingsPath)) return false;
    let settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    settings.license_key = '';
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log('[LicenseService] SUCCESS: License key cleared from settings.json');
    return true;
  } catch (error) {
    console.error('[LicenseService] Error clearing license key:', error.message);
    return false;
  }
}

/**
 * Parse and verify license key
 * Format expected: MYADA-LIC-V1.<base64Payload>.<base64Signature>
 */
function verifyLicenseKey(licenseKeyStr) {
  const currentMachineId = machineIdService.getMachineId();

  if (!licenseKeyStr || typeof licenseKeyStr !== 'string') {
    return {
      valid: false,
      reason: 'Key lisensi kosong atau tidak valid.',
      machineId: currentMachineId
    };
  }

  const parts = licenseKeyStr.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'MYADA-LIC-V1') {
    return {
      valid: false,
      reason: 'Format key lisensi tidak dikenali.',
      machineId: currentMachineId
    };
  }

  const payloadB64 = parts[1];
  const signatureB64 = parts[2];

  let payloadObj;
  try {
    const payloadJson = Buffer.from(payloadB64, 'base64').toString('utf8');
    payloadObj = JSON.parse(payloadJson);
  } catch (err) {
    return {
      valid: false,
      reason: 'Gagal membaca payload lisensi.',
      machineId: currentMachineId
    };
  }

  const publicKey = getPublicKey();
  if (!publicKey) {
    return {
      valid: false,
      reason: 'Vendor public key tidak ditemukan di server.',
      machineId: currentMachineId
    };
  }

  // 1. RSA Signature Verification
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(payloadB64);
    verifier.end();

    const isSignatureValid = verifier.verify(publicKey, signatureB64, 'base64');
    if (!isSignatureValid) {
      return {
        valid: false,
        reason: 'Tanda tangan digital lisensi tidak sah (Lisensi terindikasi palsu/diubah).',
        machineId: currentMachineId
      };
    }
  } catch (err) {
    return {
      valid: false,
      reason: `Error verifikasi RSA: ${err.message}`,
      machineId: currentMachineId
    };
  }

  // 2. Machine ID Matching Check
  if (payloadObj.machineId !== currentMachineId) {
    return {
      valid: false,
      reason: `Lisensi ini terdaftar untuk Hardware Server lain (${payloadObj.machineId}). Server saat ini: ${currentMachineId}.`,
      machineId: currentMachineId,
      targetMachineId: payloadObj.machineId,
      companyName: payloadObj.companyName
    };
  }

  // 3. License Type Check
  if (payloadObj.licenseType !== 'LIFETIME') {
    return {
      valid: false,
      reason: 'Tipe lisensi tidak valid.',
      machineId: currentMachineId
    };
  }

  // 4. Co-located Vendor Database Revocation Check (Local Sync)
  const brolinksDbPath = path.join(__dirname, '../../BroLinks/database/brolinks.sqlite');
  if (fs.existsSync(brolinksDbPath)) {
    try {
      const Database = require('better-sqlite3');
      const vendorDb = new Database(brolinksDbPath, { readonly: true });
      const lic = vendorDb.prepare('SELECT id, status FROM licenses WHERE license_key = ?').get(licenseKeyStr.trim());
      vendorDb.close();

      if (!lic || lic.status !== 'ACTIVE') {
        clearLicenseKey();
        return {
          valid: false,
          reason: 'Lisensi telah dicabut atau dihapus oleh Vendor.',
          machineId: currentMachineId
        };
      }
    } catch (err) {
      console.warn('[LicenseService] Warning reading vendor database:', err.message);
    }
  }

  return {
    valid: true,
    reason: 'Lisensi Seumur Hidup Aktif',
    companyName: payloadObj.companyName,
    buyerName: payloadObj.buyerName,
    machineId: payloadObj.machineId,
    licenseType: payloadObj.licenseType,
    licenseId: payloadObj.licenseId,
    issuedAt: payloadObj.issuedAt
  };
}

/**
 * Get current system license status
 */
function getLicenseStatus() {
  const storedKey = getStoredLicenseKey();
  return verifyLicenseKey(storedKey);
}

/**
 * Activate application with new license key string
 */
function activateLicense(licenseKeyStr) {
  const result = verifyLicenseKey(licenseKeyStr);
  if (result.valid) {
    saveLicenseKey(licenseKeyStr);
  }
  return result;
}

module.exports = {
  getMachineId: machineIdService.getMachineId,
  getLicenseStatus,
  verifyLicenseKey,
  activateLicense,
  saveLicenseKey,
  clearLicenseKey
};
