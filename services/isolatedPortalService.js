const { getSetting, getSettings, saveSettings } = require('../config/settingsManager');
const { logger } = require('../config/logger');
const db = require('../config/database');

const SETTINGS_KEY_PORTAL_ISOLATED = 'isolated_portal_config';

const DEFAULT_CONFIG = {
  enabled: true,
  cna_push_enabled: true,
  custom_title: 'Layanan Terisolir',
  custom_message: 'Layanan internet Anda sementara terisolir karena terdapat administrasi tagihan yang belum diselesaikan.',
  custom_wa_message: 'Halo Admin, akun internet saya terisolir. Mohon info pembayaran.',
  walled_garden_domains: [
    'midtrans.com',
    'api.midtrans.com',
    'tripay.co.id',
    'xendit.co',
    'api.xendit.co',
    'qris.id',
    'wa.me',
    'whatsapp.com',
    'api.whatsapp.com'
  ],
  redirect_url: '/isolated',
  auto_sync_mikrotik: true
};

/**
 * Mengambil konfigurasi portal isolir gabungan dari settings manager dengan default fallback.
 */
function getIsolatedPortalConfig() {
  try {
    const rawConfig = getSetting(SETTINGS_KEY_PORTAL_ISOLATED, {});
    return {
      ...DEFAULT_CONFIG,
      ...(rawConfig || {})
    };
  } catch (error) {
    logger.error(`[IsolatedPortalService] Gagal membaca konfigurasi: ${error.message}`);
    return DEFAULT_CONFIG;
  }
}

/**
 * Menyimpan konfigurasi portal isolir.
 */
function saveIsolatedPortalConfig(newConfig = {}) {
  try {
    const current = getIsolatedPortalConfig();
    let cleanWalledGarden = current.walled_garden_domains;
    
    if (typeof newConfig.walled_garden_domains === 'string') {
      cleanWalledGarden = newConfig.walled_garden_domains
        .split('\n')
        .map(d => d.trim().toLowerCase())
        .filter(Boolean);
    } else if (Array.isArray(newConfig.walled_garden_domains)) {
      cleanWalledGarden = newConfig.walled_garden_domains.map(d => String(d).trim().toLowerCase()).filter(Boolean);
    }

    const updated = {
      ...current,
      enabled: newConfig.enabled !== undefined ? (newConfig.enabled === 'true' || newConfig.enabled === 'on' || newConfig.enabled === true) : current.enabled,
      cna_push_enabled: newConfig.cna_push_enabled !== undefined ? (newConfig.cna_push_enabled === 'true' || newConfig.cna_push_enabled === 'on' || newConfig.cna_push_enabled === true) : current.cna_push_enabled,
      custom_title: newConfig.custom_title !== undefined ? String(newConfig.custom_title || current.custom_title).trim() : current.custom_title,
      custom_message: newConfig.custom_message !== undefined ? String(newConfig.custom_message || current.custom_message).trim() : current.custom_message,
      custom_wa_message: newConfig.custom_wa_message !== undefined ? String(newConfig.custom_wa_message || current.custom_wa_message).trim() : current.custom_wa_message,
      walled_garden_domains: Array.from(new Set(cleanWalledGarden)),
      auto_sync_mikrotik: newConfig.auto_sync_mikrotik !== undefined ? (newConfig.auto_sync_mikrotik === 'true' || newConfig.auto_sync_mikrotik === 'on' || newConfig.auto_sync_mikrotik === true) : current.auto_sync_mikrotik
    };

    saveSettings({ [SETTINGS_KEY_PORTAL_ISOLATED]: updated });
    logger.info('[IsolatedPortalService] Berhasil mengupdate konfigurasi portal isolir.');
    return { success: true, config: updated };
  } catch (error) {
    logger.error(`[IsolatedPortalService] Gagal menyimpan konfigurasi: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Mengambil daftar pelanggan yang berstatus suspended / terisolir beserta info tagihan.
 */
function getSuspendedCustomers() {
  try {
    const customerSvc = require('./customerService');
    const all = customerSvc.getAllCustomers();
    return all.filter(c => c.status === 'suspended' || c.status === 'isolated');
  } catch (error) {
    logger.error(`[IsolatedPortalService] Gagal mengambil pelanggan terisolir: ${error.message}`);
    return [];
  }
}

/**
 * Menyinkronkan seluruh pelanggan yang jatuh tempo/belum bayar dan mengisolir secara otomatis ke MikroTik & RADIUS.
 */
async function syncAllOverdueCustomers() {
  const customerSvc = require('./customerService');
  const now = new Date();
  const today = now.getDate();
  
  const allCustomers = customerSvc.getAllCustomers();
  let isolatedCount = 0;
  const errors = [];

  for (const c of allCustomers) {
    const isAutoIsolate = (c.auto_isolir !== undefined ? c.auto_isolir : c.auto_isolate) !== 0;
    const isolateDay = Number(c.isolir_date || c.due_date || c.isolate_day || 10);
    
    if (isAutoIsolate && c.status === 'active' && Number(c.unpaid_count) > 0 && today >= isolateDay) {
      try {
        await customerSvc.suspendCustomer(c.id);
        isolatedCount++;
      } catch (err) {
        errors.push(`${c.name}: ${err.message}`);
        logger.error(`[IsolatedPortalService] Gagal isolir pelanggan ${c.name}: ${err.message}`);
      }
    }
  }

  // Sinkronkan seluruh pelanggan suspended yang ada ke router MikroTik
  const currentSuspended = getSuspendedCustomers();
  for (const s of currentSuspended) {
    try {
      await customerSvc.syncCustomerIsolation(s);
    } catch (err) {
      logger.warn(`[IsolatedPortalService] Sync isolir router warning (${s.name}): ${err.message}`);
    }
  }

  return {
    success: true,
    isolatedCount,
    totalSuspended: currentSuspended.length,
    errors
  };
}

/**
 * Menghasilkan script MikroTik komprehensif untuk Portal Isolir & CNA Push Popup.
 */
function generateMikrotikIsolatedScript(billingHost = '192.168.1.100', httpPort = 80) {
  const config = getIsolatedPortalConfig();
  const host = String(billingHost || '192.168.1.100').trim();

  const scriptLines = [
    '# =========================================================================',
    '# SCRIPT CONFIGURATION MIKROTIK PORTAL ISOLIR & CNA PUSH POPUP',
    '# Auto-generated by MyAdamedia Billing System',
    '# =========================================================================',
    '',
    '# 1. Bersihkan Rule Lama (Comment BILLING_ISOLIR_*)',
    '/ip firewall filter remove [find comment~"BILLING_ISOLIR_"]',
    '/ip firewall nat remove [find comment~"BILLING_ISOLIR_"]',
    '',
    '# 2. DNS Resolution untuk Pelanggan Terisolir (Wajib izinkan UDP Port 53)',
    '/ip firewall filter add chain=forward src-address-list=LIST_ISOLIR protocol=udp dst-port=53 action=accept comment="BILLING_ISOLIR_DNS_UDP"',
    '/ip firewall filter add chain=forward src-address-list=LIST_ISOLIR protocol=tcp dst-port=53 action=accept comment="BILLING_ISOLIR_DNS_TCP"',
    '',
    '# 3. Izinkan Akses Langsung ke Billing Server',
    `/ip firewall filter add chain=forward src-address-list=LIST_ISOLIR dst-address=${host} action=accept comment="BILLING_ISOLIR_ALLOW_SERVER"`,
    '',
    '# 4. DST-NAT HTTP Traffic Port 80 menuju Billing Server (Memicu CNA Push Pop-Up)',
    `/ip firewall nat add chain=dstnat protocol=tcp dst-port=80 src-address-list=LIST_ISOLIR action=dst-nat to-addresses=${host} to-ports=${httpPort} comment="BILLING_ISOLIR_NAT_HTTP"`,
    '',
    '# 5. Walled Garden Bypass untuk Domain Payment Gateway & WA'
  ];

  config.walled_garden_domains.forEach(domain => {
    scriptLines.push(`/ip firewall address-list add list=WALLED_GARDEN_ISOLATE address=${domain} comment="BILLING_ISOLIR_WG_${domain}" disabled=no`);
  });

  scriptLines.push('');
  scriptLines.push('# 6. Izinkan Forwarding Traffic ke Walled Garden');
  scriptLines.push('');
  scriptLines.push('# 7. Reject TCP Traffic dengan TCP-Reset agar browser Android/iOS/Windows tidak hang atau menunggu timeout koneksi HTTPS');
  scriptLines.push('/ip firewall filter add chain=forward src-address-list=LIST_ISOLIR protocol=tcp action=reject reject-with=tcp-reset comment="BILLING_ISOLIR_REJECT_TCP"');
  scriptLines.push('');
  scriptLines.push('# 8. Blokir Sisa Traffic UDP/ICMP Pelanggan Terisolir');
  scriptLines.push('/ip firewall filter add chain=forward src-address-list=LIST_ISOLIR action=drop comment="BILLING_ISOLIR_BLOCK_REST"');
  scriptLines.push('');
  scriptLines.push('# 9. Contoh PPPoE Profile On-Up Command:');
  scriptLines.push('# Set script berikut pada PPPoE Profile On-Up untuk memasukkan IP secara otomatis:');
  scriptLines.push('# /ip firewall address-list add list=LIST_ISOLIR address=$remote-address comment=$user');

  return scriptLines.join('\n');
}

/**
 * Daftar endpoint probe populer yang dikirim oleh OS perangkat untuk deteksi Captive Portal (CNA).
 */
const CNA_PROBE_USER_AGENTS_AND_PATHS = [
  // iOS / iPadOS / macOS (Apple)
  '/hotspot-detect.html',
  '/library/test/success.html',
  '/success.html',
  
  // Android / ChromeOS (Google / AOSP)
  '/generate_204',
  '/gen_204',
  '/check_network_status.txt',
  '/mobile/status.php',
  '/wpad.dat',
  
  // Windows 10/11 (Microsoft)
  '/connecttest.txt',
  '/ncsi.txt',
  '/redirect',
  
  // Firefox, Linux & Others
  '/canonical.html',
  '/kindle-wifi/wifiredirect.html'
];

/**
 * Memeriksa apakah suatu URI path merupakan probe CNA dari OS.
 */
function isCnaProbePath(requestPath = '') {
  const path = String(requestPath || '').toLowerCase().trim();
  if (!path) return false;

  return CNA_PROBE_USER_AGENTS_AND_PATHS.some(probe => {
    return path === probe || path.endsWith(probe);
  });
}

module.exports = {
  getIsolatedPortalConfig,
  saveIsolatedPortalConfig,
  getSuspendedCustomers,
  syncAllOverdueCustomers,
  generateMikrotikIsolatedScript,
  isCnaProbePath,
  CNA_PROBE_USER_AGENTS_AND_PATHS
};
