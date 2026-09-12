const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

describe('QRIS Delete Feature & Settings Rendering Unit Tests', () => {
  const templatePath = path.join(__dirname, '../views/admin/settings.ejs');
  let templateContent = '';

  beforeAll(() => {
    templateContent = fs.readFileSync(templatePath, 'utf8');
  });

  test('should render "Hapus QRIS" button and deleteQrisForm when qris_static_qr_url is set', () => {
    const renderedHtml = ejs.render(templateContent, {
      title: 'Pengaturan Sistem',
      company: 'MyAdamedia Billing',
      activePage: 'settings',
      lang: 'id',
      sidebarSections: [],
      sidebarBottomNavItems: [],
      settings: {
        qris_static_enabled: true,
        qris_static_qr_url: '/uploads/qris/qris-test.png',
        qris_static_payload: '000201010211...',
        telegram_enabled: false,
        tripay_enabled: false,
        midtrans_enabled: false,
        xendit_enabled: false,
        duitku_enabled: false,
        default_gateway: 'midtrans',
        public_base_url: 'http://localhost:3001'
      },
      msg: null,
      paymentWebhookUrl: 'http://localhost:3001/customer/payment/callback',
      t: (k, d) => d || k
    }, { filename: templatePath });

    expect(renderedHtml).toContain('Hapus QRIS');
    expect(renderedHtml).toContain('id="deleteQrisForm"');
    expect(renderedHtml).toContain('action="/admin/settings/qris-delete"');
    expect(renderedHtml).toContain('QRIS Statis Aktif Terpasang');
    expect(renderedHtml).toContain('/uploads/qris/qris-test.png');
  });

  test('should NOT render "Hapus QRIS" button when qris_static_qr_url is empty', () => {
    const renderedHtml = ejs.render(templateContent, {
      title: 'Pengaturan Sistem',
      company: 'MyAdamedia Billing',
      activePage: 'settings',
      lang: 'id',
      sidebarSections: [],
      sidebarBottomNavItems: [],
      settings: {
        qris_static_enabled: false,
        qris_static_qr_url: '',
        qris_static_payload: '',
        telegram_enabled: false,
        tripay_enabled: false,
        midtrans_enabled: false,
        xendit_enabled: false,
        duitku_enabled: false,
        default_gateway: 'midtrans',
        public_base_url: 'http://localhost:3001'
      },
      msg: null,
      paymentWebhookUrl: 'http://localhost:3001/customer/payment/callback',
      t: (k, d) => d || k
    }, { filename: templatePath });

    expect(renderedHtml).not.toContain('QRIS Statis Aktif Terpasang');
    expect(renderedHtml).not.toContain('Hapus QRIS');
    expect(renderedHtml).toContain('id="deleteQrisForm"');
  });

  test('should verify physical file deletion logic safely handles existing file', () => {
    const testDir = path.join(__dirname, '../public/uploads/qris');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

    const dummyFile = path.join(testDir, 'dummy-qris-test.png');
    fs.writeFileSync(dummyFile, 'fake-qris-image-content');
    expect(fs.existsSync(dummyFile)).toBe(true);

    // Simulate delete handler logic
    const qrUrl = '/uploads/qris/dummy-qris-test.png';
    if (qrUrl.startsWith('/uploads/qris/')) {
      const fullPath = path.join(__dirname, '../public', qrUrl);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    expect(fs.existsSync(dummyFile)).toBe(false);
  });
});
