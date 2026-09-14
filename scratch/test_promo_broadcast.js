const ejs = require('ejs');
const path = require('path');
const promoBannerSvc = require('../services/promoBannerService');
const customerSvc = require('../services/customerService');
const { getSettingsWithCache } = require('../config/settingsManager');

const viewsDir = path.join(__dirname, '../views');
const settings = getSettingsWithCache();
const packages = customerSvc.getAllPackages();
const activeBanners = promoBannerSvc.getActiveBanners();
const allBanners = promoBannerSvc.getAllBanners();

const defaultPromoTemplate =
  `🔥 *PROMO SPESIAL DARI {{perusahaan}}!* 🔥\n\n` +
  `Halo *{{nama}}*, ada penawaran terbaik untuk upgrade internet Anda!\n\n` +
  `🚀 *Paket Promo:* {{nama_paket}}\n` +
  `⚡ *Kecepatan:* Hingga {{kecepatan}}\n` +
  `💰 *Harga Promo:* *{{harga_promo}}*/bulan *(Hemat {{hemat}})*\n` +
  `🏷️ *Harga Normal:* ~{{harga_normal}}~\n` +
  `⏳ *Masa Berlaku:* {{durasi_promo}}\n\n` +
  `✨ *Keunggulan Layanan:*\n{{deskripsi_paket}}\n\n` +
  `Nikmati internet stabil dan cepat tanpa batas! Daftar atau upgrade sekarang melalui:\n` +
  `👉 Link Registrasi: {{link_daftar}}\n` +
  `👉 Portal Pelanggan: {{link_portal}}\n\n` +
  `Ada pertanyaan? Balas pesan ini untuk terhubung dengan staf kami.\n` +
  `Salam hangat,\n*{{perusahaan}}*`;

console.log('Testing render views/admin/promo_broadcast.ejs...');
try {
  ejs.renderFile(path.join(viewsDir, 'admin/promo_broadcast.ejs'), {
    title: 'Broadcast Promo WhatsApp',
    company: 'MyAdamedia ISP',
    activePage: 'promo_broadcast',
    packages,
    activeBanners,
    allBanners,
    preselectedPackageId: null,
    preselectedBannerId: null,
    defaultPromoTemplate,
    promoBroadcastStatus: { active: false, total: 0, sent: 0, failed: 0 },
    getSetting: (k, d) => d,
    msg: null,
    lang: 'id',
    t: (k, def) => def || k,
    sidebarSections: [],
    sidebarBottomNavItems: [],
    session: { isAdmin: true }
  }, (err, str) => {
    if (err) {
      console.error('ERROR in promo_broadcast.ejs:', err);
      process.exit(1);
    }
    console.log('SUCCESS: promo_broadcast.ejs rendered OK! Length:', str.length);
  });
} catch (e) {
  console.error('CRASH in promo_broadcast.ejs:', e);
  process.exit(1);
}

// Test render broadcast.ejs
console.log('Testing render views/admin/broadcast.ejs...');
try {
  ejs.renderFile(path.join(viewsDir, 'admin/broadcast.ejs'), {
    title: 'Broadcast WhatsApp',
    company: 'MyAdamedia ISP',
    activePage: 'broadcast',
    broadcastStatus: { active: false, total: 0, sent: 0, failed: 0 },
    getSetting: (k, d) => d,
    autoBillingMsg: 'Sample',
    autoIsolirMsg: 'Sample',
    msg: null,
    lang: 'id',
    t: (k, def) => def || k,
    sidebarSections: [],
    sidebarBottomNavItems: [],
    session: { isAdmin: true }
  }, (err, str) => {
    if (err) {
      console.error('ERROR in broadcast.ejs:', err);
      process.exit(1);
    }
    console.log('SUCCESS: broadcast.ejs rendered OK! Length:', str.length);
  });
} catch (e) {
  console.error('CRASH in broadcast.ejs:', e);
  process.exit(1);
}

// Test render whatsapp.ejs
console.log('Testing render views/admin/whatsapp.ejs...');
try {
  ejs.renderFile(path.join(viewsDir, 'admin/whatsapp.ejs'), {
    title: 'Status WhatsApp',
    company: 'MyAdamedia ISP',
    activePage: 'whatsapp',
    msg: null,
    lang: 'id',
    t: (k, def) => def || k,
    sidebarSections: [],
    sidebarBottomNavItems: [],
    session: { isAdmin: true }
  }, (err, str) => {
    if (err) {
      console.error('ERROR in whatsapp.ejs:', err);
      process.exit(1);
    }
    console.log('SUCCESS: whatsapp.ejs rendered OK! Length:', str.length);
  });
} catch (e) {
  console.error('CRASH in whatsapp.ejs:', e);
  process.exit(1);
}

// Test render whatsapp_templates.ejs
console.log('Testing render views/admin/whatsapp_templates.ejs...');
try {
  ejs.renderFile(path.join(viewsDir, 'admin/whatsapp_templates.ejs'), {
    title: 'Template Pesan WA',
    company: 'MyAdamedia ISP',
    activePage: 'whatsapp_templates',
    templates: {
      whatsapp_auto_billing_message: 'Billing',
      whatsapp_billing_qris_message: 'QRIS',
      whatsapp_payment_success_message: 'Success',
      whatsapp_payment_partial_message: 'Partial',
      whatsapp_isolir_message: 'Isolir'
    },
    msg: null,
    lang: 'id',
    t: (k, def) => def || k,
    sidebarSections: [],
    sidebarBottomNavItems: [],
    session: { isAdmin: true }
  }, (err, str) => {
    if (err) {
      console.error('ERROR in whatsapp_templates.ejs:', err);
      process.exit(1);
    }
    console.log('SUCCESS: whatsapp_templates.ejs rendered OK! Length:', str.length);
  });
} catch (e) {
  console.error('CRASH in whatsapp_templates.ejs:', e);
  process.exit(1);
}

// Test render whatsapp_monitoring.ejs
console.log('Testing render views/admin/whatsapp_monitoring.ejs...');
try {
  ejs.renderFile(path.join(viewsDir, 'admin/whatsapp_monitoring.ejs'), {
    title: 'Alert Monitoring WA',
    company: 'MyAdamedia ISP',
    activePage: 'whatsapp_monitoring',
    settings: {
      monitoring_rx_power_alert_enabled: true,
      monitoring_rx_power_threshold: -27,
      monitoring_offline_alert_enabled: true,
      monitoring_offline_threshold_hours: 24
    },
    msg: null,
    lang: 'id',
    t: (k, def) => def || k,
    sidebarSections: [],
    sidebarBottomNavItems: [],
    session: { isAdmin: true }
  }, (err, str) => {
    if (err) {
      console.error('ERROR in whatsapp_monitoring.ejs:', err);
      process.exit(1);
    }
    console.log('SUCCESS: whatsapp_monitoring.ejs rendered OK! Length:', str.length);
  });
} catch (e) {
  console.error('CRASH in whatsapp_monitoring.ejs:', e);
  process.exit(1);
}

// Test render packages.ejs
console.log('Testing render views/admin/packages.ejs...');
try {
  ejs.renderFile(path.join(viewsDir, 'admin/packages.ejs'), {
    title: 'Paket Internet',
    company: 'MyAdamedia ISP',
    activePage: 'packages',
    packages,
    profiles: [],
    routers: [],
    msg: null,
    lang: 'id',
    t: (k, def) => def || k,
    sidebarSections: [],
    sidebarBottomNavItems: [],
    session: { isAdmin: true }
  }, (err, str) => {
    if (err) {
      console.error('ERROR in packages.ejs:', err);
      process.exit(1);
    }
    console.log('SUCCESS: packages.ejs rendered OK! Length:', str.length);
  });
} catch (e) {
  console.error('CRASH in packages.ejs:', e);
  process.exit(1);
}

// Test render promo_banners.ejs
console.log('Testing render views/admin/promo_banners.ejs...');
try {
  ejs.renderFile(path.join(viewsDir, 'admin/promo_banners.ejs'), {
    title: 'Manajemen Banner Promosi',
    company: 'MyAdamedia ISP',
    activePage: 'promo_banners',
    banners: allBanners,
    msg: null,
    lang: 'id',
    t: (k, def) => def || k,
    sidebarSections: [],
    sidebarBottomNavItems: [],
    session: { isAdmin: true }
  }, (err, str) => {
    if (err) {
      console.error('ERROR in promo_banners.ejs:', err);
      process.exit(1);
    }
    console.log('SUCCESS: promo_banners.ejs rendered OK! Length:', str.length);
  });
} catch (e) {
  console.error('CRASH in promo_banners.ejs:', e);
  process.exit(1);
}

console.log('\n--- ALL VIEWS TEST PASSED! ---');
