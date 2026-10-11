/**
 * Service: Google Drive Multi-Cloud Backup Service
 * Mengelola integrasi Google Drive v3 REST API untuk pencadangan database & konfigurasi
 * Mendukung Service Account (RS256 JWT) & OAuth2 Refresh Token tanpa dependensi eksternal berat
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { logger } = require('../config/logger');
const { getSetting, setSetting } = require('../config/settingsManager');

// In-memory token cache agar tidak membebani auth server di setiap panggilan
let tokenCache = {
  accessToken: null,
  expiresAt: 0,
  authType: null
};

/**
 * Base64URL encoding helper
 */
function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf-8');
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Validasi dan parse Service Account JSON key
 */
function parseServiceAccountKey(keyInput) {
  if (!keyInput) return null;
  if (typeof keyInput === 'object' && keyInput.client_email && keyInput.private_key) {
    return keyInput;
  }
  if (typeof keyInput === 'string') {
    try {
      const parsed = JSON.parse(keyInput.trim());
      if (parsed.client_email && parsed.private_key) {
        return parsed;
      }
    } catch (e) {
      // Input bukan JSON string yang valid
      return null;
    }
  }
  return null;
}

/**
 * Buat signed JWT untuk Google Service Account (RS256)
 */
function createServiceAccountJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, // 1 jam ke depan
    iat: now
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  
  // Format private key jika \n masih berbentuk string literal
  let privateKey = serviceAccount.private_key;
  if (typeof privateKey === 'string' && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const signature = signer.sign(privateKey, 'base64url');
  return `${unsignedToken}.${signature}`;
}

/**
 * Dapatkan Access Token dari Google (dengan auto-refresh dan caching)
 */
async function getAccessToken(customConfig = null) {
  const authType = customConfig?.authType || getSetting('gdrive_auth_type', 'service_account');
  const now = Date.now();

  const saEmail = customConfig?.serviceAccountJson?.client_email || '';
  const oauthClient = customConfig?.clientId || '';
  const cacheKey = `${authType}:${saEmail || oauthClient || 'global'}`;

  // Kembalikan token cache jika masih berlaku (margin 60 detik)
  if (tokenCache.accessToken && tokenCache.expiresAt > now + 60000 && tokenCache.cacheKey === cacheKey) {
    return tokenCache.accessToken;
  }

  if (authType === 'service_account') {
    const rawKey = customConfig?.serviceAccountJson || getSetting('gdrive_service_account_json', '');
    const sa = parseServiceAccountKey(rawKey);
    if (!sa) {
      throw new Error('Kredensial Google Service Account (JSON Key) tidak valid atau belum diisi');
    }

    const assertion = createServiceAccountJwt(sa);
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    const accessToken = tokenRes.data.access_token;
    const expiresIn = (tokenRes.data.expires_in || 3600) * 1000;

    tokenCache = {
      accessToken,
      expiresAt: now + expiresIn,
      authType: 'service_account',
      cacheKey
    };

    return accessToken;
  } else if (authType === 'oauth') {
    const clientId = customConfig?.clientId || getSetting('gdrive_oauth_client_id', '');
    const clientSecret = customConfig?.clientSecret || getSetting('gdrive_oauth_client_secret', '');
    const refreshToken = customConfig?.refreshToken || getSetting('gdrive_oauth_refresh_token', '');

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Kredensial OAuth (Client ID, Secret, atau Refresh Token) belum lengkap');
    }

    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');

    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    });

    const accessToken = tokenRes.data.access_token;
    const expiresIn = (tokenRes.data.expires_in || 3600) * 1000;

    tokenCache = {
      accessToken,
      expiresAt: now + expiresIn,
      authType: 'oauth',
      cacheKey
    };

    return accessToken;
  } else {
    throw new Error(`Tipe autentikasi Google Drive tidak dikenal: ${authType}`);
  }
}

/**
 * Periksa apakah konfigurasi Google Drive sudah lengkap dan diaktifkan
 */
function isGoogleDriveConfigured() {
  const enabled = getSetting('gdrive_backup_enabled', false);
  if (!enabled) return false;

  const authType = getSetting('gdrive_auth_type', 'service_account');
  if (authType === 'service_account') {
    const rawKey = getSetting('gdrive_service_account_json', '');
    const sa = parseServiceAccountKey(rawKey);
    return !!(sa && sa.client_email && sa.private_key);
  } else if (authType === 'oauth') {
    const clientId = getSetting('gdrive_oauth_client_id', '');
    const clientSecret = getSetting('gdrive_oauth_client_secret', '');
    const refreshToken = getSetting('gdrive_oauth_refresh_token', '');
    return !!(clientId && clientSecret && refreshToken);
  }
  return false;
}

/**
 * Uji koneksi ke Google Drive API v3
 */
async function testConnection(customConfig = null) {
  try {
    const accessToken = await getAccessToken(customConfig);
    const folderId = customConfig?.folderId || getSetting('gdrive_folder_id', '');

    // 1. Cek info akun & kuota drive
    const aboutRes = await axios.get('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000
    });

    const user = aboutRes.data.user || {};
    const quota = aboutRes.data.storageQuota || {};
    const limitBytes = parseInt(quota.limit || 0, 10);
    const usageBytes = parseInt(quota.usage || 0, 10);

    let folderInfo = null;
    if (folderId && folderId.trim()) {
      try {
        const folderRes = await axios.get(`https://www.googleapis.com/drive/v3/files/${folderId.trim()}?fields=id,name,mimeType,capabilities`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000
        });
        folderInfo = {
          id: folderRes.data.id,
          name: folderRes.data.name,
          canAddChildren: folderRes.data.capabilities?.canAddChildren !== false
        };
      } catch (fErr) {
        return {
          ok: false,
          user: user.displayName || user.emailAddress || 'Connected Account',
          email: user.emailAddress,
          error: `Folder ID '${folderId}' tidak ditemukan atau Service Account belum diberikan izin Editor di folder tersebut. (${fErr.response?.data?.error?.message || fErr.message})`
        };
      }
    }

    return {
      ok: true,
      user: user.displayName || user.emailAddress || 'Google Drive User',
      email: user.emailAddress,
      folder: folderInfo,
      storage: {
        limitMB: limitBytes > 0 ? (limitBytes / (1024 * 1024)).toFixed(1) : 'Unlimited',
        usageMB: (usageBytes / (1024 * 1024)).toFixed(1),
        percent: limitBytes > 0 ? Math.round((usageBytes / limitBytes) * 100) : 0
      }
    };
  } catch (error) {
    logger.error(`[GoogleDrive] Test connection failed: ${error.message}`);
    return {
      ok: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
}

/**
 * Upload file ke Google Drive (Multipart Upload v3)
 */
async function uploadFile(filePath, options = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Berkas tidak ditemukan: ${filePath}`);
    }

    const fileName = options.fileName || path.basename(filePath);
    const folderId = options.folderId || getSetting('gdrive_folder_id', '');
    const accessToken = await getAccessToken(options.customConfig);

    const fileStats = fs.statSync(filePath);
    const fileContent = fs.readFileSync(filePath);

    // Tentukan MIME Type
    const ext = path.extname(fileName).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === '.db' || ext === '.sqlite' || ext === '.sqlite3') {
      mimeType = 'application/x-sqlite3';
    } else if (ext === '.json') {
      mimeType = 'application/json';
    } else if (ext === '.zip') {
      mimeType = 'application/zip';
    }

    // Buat metadata JSON
    const metadata = {
      name: fileName,
      description: options.description || `Backup MyAdamedia Billing created on ${new Date().toISOString()}`
    };

    if (folderId && folderId.trim()) {
      metadata.parents = [folderId.trim()];
    }

    // Bangun payload multipart/related
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = Buffer.from(
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata)
    );

    const mediaHeader = Buffer.from(
      delimiter +
      `Content-Type: ${mimeType}\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n`
    );

    const multipartBody = Buffer.concat([
      metadataPart,
      mediaHeader,
      fileContent,
      Buffer.from(closeDelimiter)
    ]);

    const uploadRes = await axios.post(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,webViewLink,createdTime',
      multipartBody,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': multipartBody.length
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 60000
      }
    );

    const result = {
      success: true,
      fileId: uploadRes.data.id,
      name: uploadRes.data.name,
      size: fileStats.size,
      sizeKB: Math.round(fileStats.size / 1024),
      webViewLink: uploadRes.data.webViewLink,
      createdTime: uploadRes.data.createdTime
    };

    logger.info(`[GoogleDrive] Berkas '${fileName}' berhasil diunggah ke Google Drive (ID: ${result.fileId})`);
    return result;
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    logger.error(`[GoogleDrive] Gagal upload berkas '${path.basename(filePath)}': ${errorMsg}`);
    return {
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Ambil daftar berkas backup di folder Google Drive
 */
async function listCloudBackups(folderId = null, options = {}) {
  try {
    const targetFolderId = folderId || getSetting('gdrive_folder_id', '');
    const accessToken = await getAccessToken(options.customConfig);

    let query = "trashed = false and (name contains 'billing_db_' or name contains 'settings_')";
    if (targetFolderId && targetFolderId.trim()) {
      query += ` and '${targetFolderId.trim()}' in parents`;
    }

    const res = await axios.get('https://www.googleapis.com/drive/v3/files', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        q: query,
        fields: 'files(id, name, size, createdTime, webViewLink)',
        orderBy: 'createdTime desc',
        pageSize: 50
      },
      timeout: 15000
    });

    return {
      success: true,
      files: res.data.files || []
    };
  } catch (error) {
    logger.error(`[GoogleDrive] Gagal mengambil daftar backup di Google Drive: ${error.message}`);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
      files: []
    };
  }
}

/**
 * Hapus backup lama di Google Drive berdasarkan retensi (jumlah file / umur hari)
 */
async function cleanupOldCloudBackups(retentionDays = 30, options = {}) {
  try {
    const listResult = await listCloudBackups(options.folderId, options);
    if (!listResult.success || !listResult.files || listResult.files.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    const accessToken = await getAccessToken(options.customConfig);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (parseInt(retentionDays, 10) || 30));

    let deletedCount = 0;
    for (const file of listResult.files) {
      const fileDate = new Date(file.createdTime);
      if (fileDate < cutoffDate) {
        try {
          await axios.delete(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000
          });
          deletedCount++;
          logger.info(`[GoogleDrive] Dihapus backup lama dari Google Drive: ${file.name} (${file.id})`);
        } catch (delErr) {
          logger.warn(`[GoogleDrive] Gagal menghapus file ${file.id}: ${delErr.message}`);
        }
      }
    }

    return {
      success: true,
      deletedCount
    };
  } catch (error) {
    logger.error(`[GoogleDrive] Cleanup error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Reset token cache (berguna saat test atau perubahan settings)
 */
function resetTokenCache() {
  tokenCache = {
    accessToken: null,
    expiresAt: 0,
    authType: null
  };
}

module.exports = {
  getAccessToken,
  testConnection,
  uploadFile,
  listCloudBackups,
  cleanupOldCloudBackups,
  isGoogleDriveConfigured,
  parseServiceAccountKey,
  createServiceAccountJwt,
  resetTokenCache
};
