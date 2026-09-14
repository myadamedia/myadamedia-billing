const ejs = require('ejs');
const path = require('path');
const promoBannerSvc = require('../services/promoBannerService');
const { getSettingsWithCache } = require('../config/settingsManager');

const viewsDir = path.join(__dirname, '../views');
const settings = getSettingsWithCache();
const promoBanners = promoBannerSvc.getActiveBanners();
const allBanners = promoBannerSvc.getAllBanners();

console.log('Testing render views/admin/promo_banners.ejs...');
try {
  const html = ejs.renderFile(path.join(viewsDir, 'admin/promo_banners.ejs'), {
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
    if (err) throw err;
    console.log('admin/promo_banners.ejs rendered OK! Output length:', str.length);
  });
} catch (e) {
  console.error('ERROR in admin/promo_banners.ejs:', e);
}

console.log('Testing render views/login.ejs...');
try {
  ejs.renderFile(path.join(viewsDir, 'login.ejs'), {
    settings,
    packages: [],
    error: null,
    promoBanners,
    lang: 'id',
    t: (k, def) => def || k
  }, (err, str) => {
    if (err) throw err;
    console.log('login.ejs rendered OK! Output length:', str.length);
  });
} catch (e) {
  console.error('ERROR in login.ejs:', e);
}

console.log('Testing render views/dashboard.ejs...');
try {
  ejs.renderFile(path.join(viewsDir, 'dashboard.ejs'), {
    customer: { pppoeIP: '10.10.10.2', phone: '08123456789' },
    profile: { id: 1, name: 'Budi Santoso', package_name: 'Fiber 20M', status: 'active' },
    invoices: [],
    tickets: [],
    settings,
    paymentChannels: [],
    trafficMaxDownMbps: 20,
    trafficMaxUpMbps: 20,
    connectedUsers: [],
    customerBalance: 0,
    isLoggedIn: true,
    showPPOB: false,
    notif: null,
    promoBanners,
    lang: 'id',
    t: (k, def) => def || k
  }, (err, str) => {
    if (err) throw err;
    console.log('dashboard.ejs rendered OK! Output length:', str.length);
  });
} catch (e) {
  console.error('ERROR in dashboard.ejs:', e);
}

console.log('Testing render views/register.ejs...');
try {
  ejs.renderFile(path.join(viewsDir, 'register.ejs'), {
    settings,
    packages: [{ id: 1, name: 'Home 20M', price: 150000, speed_down: 20, speed_up: 20 }],
    error: null,
    success: null,
    promoBanners
  }, (err, str) => {
    if (err) throw err;
    console.log('register.ejs rendered OK! Output length:', str.length);
  });
} catch (e) {
  console.error('ERROR in register.ejs:', e);
}

setTimeout(() => process.exit(0), 500);
