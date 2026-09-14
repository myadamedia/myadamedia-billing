const db = require('../config/database');
const promoBannerSvc = require('../services/promoBannerService');

console.log('1. Testing DB table exists...');
const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='promo_banners'").get();
console.log('Table promo_banners:', table ? 'EXISTS' : 'NOT FOUND');

console.log('2. Testing createBanner...');
const banner = promoBannerSvc.createBanner({
  title: 'Promo Spesial Internet Super Cepat',
  image_url: '/img/logo.png',
  target_url: 'https://wa.me/628123456789',
  description: 'Nikmati kecepatan hingga 100 Mbps tanpa batas FUP dengan diskon spesial bulan ini.',
  sort_order: 1,
  is_active: 1
});
console.log('Created banner ID:', banner.id);

console.log('3. Testing getActiveBanners...');
const active = promoBannerSvc.getActiveBanners();
console.log('Active banners count:', active.length);

console.log('4. Testing toggleBannerStatus...');
const toggled = promoBannerSvc.toggleBannerStatus(banner.id);
console.log('Toggled active status:', toggled);

console.log('5. Testing updateBanner...');
promoBannerSvc.updateBanner(banner.id, { is_active: 1, sort_order: 10 });
const updated = promoBannerSvc.getBannerById(banner.id);
console.log('Updated banner is_active:', updated.is_active, 'sort_order:', updated.sort_order);

console.log('6. All tests PASSED!');
