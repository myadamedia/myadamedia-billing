const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { logger } = require('./logger');

let runtimeSessionSecret = null;
function getSecureSessionSecretFallback() {
  if (!runtimeSessionSecret) {
    runtimeSessionSecret = crypto.randomBytes(32).toString('hex');
  }
  return runtimeSessionSecret;
}

// Cache untuk settings dengan timestamp
let settingsCache = null;
let settingsCacheTime = 0;
const CACHE_DURATION = 2000; // 2 detik

// File system watcher untuk auto-reload settings
const settingsPath = path.join(__dirname, '../settings.json');
let watcher = null;

// Helper untuk baca settings.json secara dinamis
function getSettings() {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) || {};
    
    // Secure fallback for session_secret
    const defaultSecret = 'rahasia-portal-pelanggan-default-ganti-ini';
    if (!settings.session_secret || settings.session_secret === defaultSecret) {
      settings.session_secret = getSecureSessionSecretFallback();
    }

    const fallbackTz = 'Asia/Jakarta';
    const tz = typeof settings.timezone === 'string' ? settings.timezone.trim() : '';

    if (!tz) {
      settings.timezone = fallbackTz;
      return settings;
    }

    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
      settings.timezone = tz;
    } catch (e) {
      settings.timezone = fallbackTz;
    }

    return settings;
  } catch (error) {
    logger.error(`[settings] Error reading settings.json: ${error.message}`);
    return {};
  }
}

// Helper untuk baca settings.json dengan cache
function getSettingsWithCache() {
  const now = Date.now();
  if (!settingsCache || (now - settingsCacheTime) > CACHE_DURATION) {
    settingsCache = getSettings();
    settingsCacheTime = now;
  }
  return settingsCache;
}

// Helper untuk mendapatkan nilai setting dengan fallback
function getSetting(key, defaultValue = null) {
  const settings = getSettingsWithCache();
  return settings[key] !== undefined ? settings[key] : defaultValue;
}

// Helper untuk mendapatkan multiple settings
function getSettingsByKeys(keys) {
  const settings = getSettingsWithCache();
  const result = {};
  keys.forEach(key => {
    result[key] = settings[key];
  });
  return result;
}

// File system watcher untuk auto-reload settings
function startSettingsWatcher() {
  try {
    // Hapus watcher lama jika ada
    if (watcher) {
      watcher.close();
    }
    
    // Buat watcher baru
    watcher = fs.watch(settingsPath, (eventType, filename) => {
      if (eventType !== 'change') return;
      // Di Windows `filename` sering null; hanya abaikan jika jelas bukan settings.json
      if (filename != null && filename !== 'settings.json') return;

      settingsCache = null;
      settingsCacheTime = 0;

      try {
        const s = getSettingsWithCache();
        const port = s.server_port ?? 4555;
        const host = s.server_host || 'localhost';
        const gurl = s.genieacs_url || '(tidak diatur)';
        const company = s.company_header || '(default)';
        logger.info(`[settings] settings.json dimuat ulang — port ${port}, host ${host}, company: ${company}, GenieACS: ${gurl}`);
      } catch (error) {
        logger.error(`[settings] Gagal memuat ulang settings.json: ${error.message}`);
      }
    });

    logger.info('[settings] Memantau perubahan settings.json');
  } catch (error) {
    logger.error(`[settings] Error starting settings watcher: ${error.message}`);
  }
}

// Mulai watcher saat modul dimuat
startSettingsWatcher();

// Menyimpan pengaturan ke settings.json
function saveSettings(newSettings) {
  try {
    const currentSettings = getSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    fs.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2), 'utf-8');
    settingsCache = updatedSettings;
    settingsCacheTime = Date.now();
    return true;
  } catch (error) {
    logger.error(`[settings] Error saving settings.json: ${error.message}`);
    return false;
  }
}

/**
 * Helper untuk mendapatkan waktu sekarang dalam format lokal
 * sesuai timezone yang diatur di settings.json
 */
function getNowLocal() {
  const tz = getSetting('timezone', 'Asia/Jakarta');
  const now = new Date();
  try {
    const options = {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      hour12: false
    };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);
    const p = {};
    parts.forEach(part => p[part.type] = part.value);
    let hour = p.hour;
    if (hour === '24') hour = '00';
    return `${p.year}-${p.month}-${p.day} ${hour}:${p.minute}:${p.second}`;
  } catch (_) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
}

/**
 * Helper untuk mendapatkan objek Date yang sudah disesuaikan dengan timezone di settings.
 * Mengembalikan objek Date yang "angkanya" sudah sesuai dengan waktu lokal.
 */
function getCurrentDateInTimezone() {
  const tz = getSetting('timezone', 'Asia/Jakarta');
  const now = new Date();
  
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const p = {};
    parts.forEach(part => p[part.type] = part.value);
    
    let h = parseInt(p.hour, 10);
    if (isNaN(h) || h === 24) h = 0;
    const y = parseInt(p.year, 10) || now.getFullYear();
    const m = parseInt(p.month, 10) || (now.getMonth() + 1);
    const d = parseInt(p.day, 10) || now.getDate();
    const min = parseInt(p.minute, 10) || 0;
    const s = parseInt(p.second, 10) || 0;
    
    const dt = new Date(y, m - 1, d, h, min, s);
    if (!isNaN(dt.getTime())) {
      return dt;
    }
  } catch (_) {
    // fallback to current date
  }
  return new Date();
}

/**
 * Mendapatkan info waktu sekarang (year, month, day, dll) dalam timezone yang diatur.
 */
function getCurrentTimeInfo() {
  const tz = getSetting('timezone', 'Asia/Jakarta');
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hourCycle: 'h23',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const p = {};
    parts.forEach(part => p[part.type] = part.value);
    
    let h = parseInt(p.hour, 10);
    if (isNaN(h) || h === 24) h = 0;
    
    return {
      year: parseInt(p.year, 10) || now.getFullYear(),
      month: parseInt(p.month, 10) || (now.getMonth() + 1),
      day: parseInt(p.day, 10) || now.getDate(),
      hour: h,
      minute: parseInt(p.minute, 10) || 0,
      second: parseInt(p.second, 10) || 0
    };
  } catch (_) {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds()
    };
  }
}

/**
 * Mendapatkan string ISO-like tapi dalam waktu lokal (bukan UTC).
 * Berguna untuk timestamp log/backup.
 */
function getNowLocalISO() {
  const info = getCurrentTimeInfo();
  const pad = (n) => String(n).padStart(2, '0');
  return `${info.year}-${pad(info.month)}-${pad(info.day)}T${pad(info.hour)}:${pad(info.minute)}:${pad(info.second)}`;
}

/**
 * Memparse string tanggal (YYYY-MM-DD HH:mm:ss) menjadi objek Date
 * dengan asumsi string tersebut adalah waktu lokal sesuai setting timezone.
 */
function parseDateInTimezone(dateStr) {
  if (!dateStr) return null;
  const tz = getSetting('timezone', 'Asia/Jakarta');
  
  const date = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(date.getTime())) return null;

  const localDateStr = date.toLocaleString('en-US', { timeZone: tz, hour12: false });
  const localDate = new Date(localDateStr);
  const diff = localDate.getTime() - date.getTime();
  
  return new Date(date.getTime() - diff);
}

/**
 * Helper untuk memformat objek Date menjadi string waktu lokal
 */
function formatDateLocal(date) {
  if (!date) return '-';
  const tz = getSetting('timezone', 'Asia/Jakarta');
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { timeZone: tz });
}

function stopSettingsWatcher() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}

/**
 * Helper untuk memformat ID Pelanggan secara dinamis sesuai konfigurasi di Pengaturan
 * (Prefix, Separator, Padding)
 * Default: MDE-0001
 * 
 * @param {number|string} id - ID numerik pelanggan
 * @param {object} [customSettings] - Override settings jika diperlukan
 * @returns {string} ID pelanggan terformat, misalnya 'MDE-0001', 'PLG/00042', dll.
 */
function formatCustomerId(id, customSettings = null) {
  if (id === null || id === undefined || id === '') return '';
  const num = parseInt(id, 10);
  if (isNaN(num)) return String(id);

  const s = customSettings || getSettingsWithCache();
  const prefix = typeof s.customer_id_prefix === 'string' ? s.customer_id_prefix.trim() : 'MDE';
  const separator = typeof s.customer_id_separator === 'string' ? s.customer_id_separator : '-';
  let padding = parseInt(s.customer_id_padding, 10);
  if (isNaN(padding) || padding < 1 || padding > 8) padding = 4;

  const padStr = String(Math.max(0, num)).padStart(padding, '0');

  if (!prefix) {
    return padStr;
  }

  let cleanPrefix = prefix;
  if (separator && cleanPrefix.endsWith(separator)) {
    cleanPrefix = cleanPrefix.slice(0, -separator.length);
  }

  return `${cleanPrefix}${separator}${padStr}`;
}

module.exports = {
  getSettings,
  getSettingsWithCache,
  getSetting,
  getSettingsByKeys,
  saveSettings,
  getNowLocal,
  formatDateLocal,
  formatCustomerId,
  getCurrentDateInTimezone,
  getCurrentTimeInfo,
  getNowLocalISO,
  parseDateInTimezone,
  startSettingsWatcher,
  stopSettingsWatcher
};
