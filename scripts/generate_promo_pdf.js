const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');
const { spawnSync } = require('child_process');

const baseDir = path.join(__dirname, '..', 'file md');
const pdfFile = path.join(baseDir, 'BANNER_PROMOSI_MEDIA_SOSIAL.pdf');

function toBase64(filename) {
  const p = path.join(baseDir, filename);
  if (fs.existsSync(p)) {
    return 'data:image/jpeg;base64,' + fs.readFileSync(p).toString('base64');
  }
  return '';
}

const banners = [
  {
    num: '01',
    title: 'All-in-One Integrated ISP Platform',
    filename: 'banner_promo_1.jpg',
    filenameAlt: 'banner_promo_1_all_in_one.jpg',
    theme: 'Ekosistem Lengkap ISP & RT/RW-Net',
    target: 'Pengusaha RT/RW-Net & ISP yang butuh sistem manajemen & billing menyeluruh',
    hook: 'Masih kelola ratusan pelanggan ISP secara manual pakai catatan excel?',
    color: '#0284c7',
    colorLight: '#e0f2fe',
    badge: 'ALL-IN-ONE SOLUTION',
    img: toBase64('banner_promo_1.jpg'),
    caption: [
      '🚀 *KENDALIKAN BISNIS INTERNET ANDA SECARA OTOMATIS!*',
      '',
      'Capek catat tagihan manual, isolir pelanggan satu-satu di MikroTik, atau kirim pengingat WhatsApp manual tiap akhir bulan?',
      '',
      'Saatnya beralih ke *MyAdamedia Billing* — Solusi Billing & Manajemen ISP / RT/RW-Net Terlengkap:',
      '✅ Auto-Isolir MikroTik & FreeRADIUS',
      '✅ Pengingat Tagihan Otomatis via WhatsApp Bot',
      '✅ Pembayaran Instan via QRIS & Multi Payment Gateway',
      '✅ Pemetaan Tiang ODP & Kabel Fiber via Peta GIS Interaktif',
      '✅ Monitoring Redaman ONT Jarak Jauh via TR-069 GenieACS',
      '',
      '💬 Hubungi kami sekarang dan coba demonya!',
      '📲 WhatsApp: [Nomor WhatsApp Anda]',
      '🌐 Website: [URL Website Anda]'
    ],
    hashtags: ['#RTRWNet', '#BisnisInternet', '#MikroTikIndonesia', '#ISPBilling', '#MyAdamediaBilling', '#PengusahaMuda', '#FTTHIndonesia']
  },
  {
    num: '02',
    title: 'Auto-Isolir & Tagihan Otomatis (Hands-Free)',
    filename: 'banner_promo_2.jpg',
    filenameAlt: 'banner_promo_2_auto_isolir.jpg',
    theme: 'Otomasi Penuh MikroTik & WhatsApp Bot',
    target: 'ISP & pengelola jaringan yang lelah menagih dan mengisolir pelanggan secara manual',
    hook: 'Biar server yang kerja, Anda tinggal nikmati hasilnya tanpa pusing!',
    color: '#059669',
    colorLight: '#d1fae5',
    badge: '100% AUTOMATED',
    img: toBase64('banner_promo_2.jpg'),
    caption: [
      '⚡ *TAGIHAN & ISOLIR OTOMATIS: BISNIS INTERNET JALAN SENDIRI!*',
      '',
      'Pelanggan nunggak tapi lupa diisolir? Giliran bayar malam hari, Anda harus bangun buka akses manual? 😴',
      '',
      'Tinggalkan cara lama! Dengan *MyAdamedia Billing*:',
      '🔒 Sistem otomatis isolir pelanggan yang lewat tanggal jatuh tempo.',
      '📲 Bot WhatsApp otomatis kirim invoice & reminder ramah.',
      '✨ Begitu pelanggan bayar, akses internet LANGSUNG AKTIF detik itu juga tanpa perlu admin standby!',
      '',
      'Bebaskan waktu Anda untuk kembangkan jaringan baru!',
      '',
      '📲 Konsultasi & Demo Sistem: [Link Bio / WhatsApp]'
    ],
    hashtags: ['#OtomasiISP', '#AutoIsolir', '#MikroTik', '#BillingRTRWNet', '#SolusiJaringan', '#InternetProvider', '#AutoBilling']
  },
  {
    num: '03',
    title: 'Multi-Payment Gateway & QRIS Dinamis',
    filename: 'banner_promo_3.jpg',
    filenameAlt: 'banner_promo_3_qris_payment.jpg',
    theme: 'Pembayaran Instan 24 Jam Nonstop',
    target: 'ISP modern yang ingin pembayaran terverifikasi otomatis tanpa konfirmasi manual',
    hook: 'Pelanggan bayar tengah malam, internet langsung aktif otomatis tanpa konfirmasi bukti transfer!',
    color: '#7c3aed',
    colorLight: '#ede9fe',
    badge: 'FINTECH & QRIS READY',
    img: toBase64('banner_promo_3.jpg'),
    caption: [
      '💳 *TERIMA PEMBAYARAN APAPUN, VERIFIKASI INSTAN 24 JAM NONSTOP!*',
      '',
      'Jangan repotkan pelanggan Anda dengan minta bukti transfer foto struk.',
      '',
      '*MyAdamedia Billing* dilengkapi integrasi Payment Gateway terlengkap:',
      '🔹 QRIS Dinamis & Statis (Scan langsung dari HP)',
      '🔹 Virtual Account BCA, Mandiri, BRI, BNI, Permata',
      '🔹 E-Wallet: Dana, OVO, ShopeePay, GoPay',
      '🔹 Gerai Retail: Indomaret & Alfamart',
      '',
      '💰 Uang langsung masuk rekening, status invoice berubah LUNAS otomatis, dan bandwidth langsung ON!',
      '',
      'Modernkan pembayaran ISP Anda sekarang!',
      '📲 Klik link di bio untuk info harga & promo terbatas!'
    ],
    hashtags: ['#QRIS', '#Fintech', '#PaymentGateway', '#BisnisRTNet', '#BillingOtomatis', '#MyAdamedia', '#QRISDinamis']
  },
  {
    num: '04',
    title: 'Kontrol Total Jaringan Fiber & TR-069',
    filename: 'banner_promo_4.jpg',
    filenameAlt: 'banner_promo_4_tr069_gis_odp.jpg',
    theme: 'GenieACS TR-069 & Pemetaan GIS ODP',
    target: 'Tim NOC, Teknisi Jaringan, dan ISP yang mengelola jaringan kabel fiber FTTH',
    hook: 'Pantau modem mati dan redaman drop langsung dari HP, tanpa perlu datang ke lokasi pelanggan!',
    color: '#ea580c',
    colorLight: '#ffedd5',
    badge: 'NOC & FIBER GIS',
    img: toBase64('banner_promo_4.jpg'),
    caption: [
      '🌐 *KONTROL TOTAL JARINGAN FIBER OPTIK & MODEM DARI SATU LAYAR!*',
      '',
      'Sering dapat komplain "Internet Lemot" tanpa tahu masalahnya di mana?',
      '',
      'Fitur unggulan *MyAdamedia Billing* untuk Tim NOC & Teknisi Lapangan:',
      '🗺️ *Peta Interaktif GIS ODP:* Visualisasi jalur kabel fiber, titik sambungan, dan kapasitas port ODP secara akurat.',
      '📡 *GenieACS TR-069:* Pantau status redaman optic (-dBm), uptime, dan restart modem pelanggan dari dashboard.',
      '🚀 *Cepat Lacak Titik Putus:* Permudah teknisi melacak lokasi kerusakan kabel di lapangan.',
      '',
      'Bikin layanan ISP Anda sekelas provider nasional!',
      '📲 Jadwalkan Live Demo Sekarang: [Nomor WhatsApp]'
    ],
    hashtags: ['#FiberOptic', '#ODP', '#GenieACS', '#TR069', '#NOCIndonesia', '#TeknisiJaringan', '#FTTH', '#PetaGIS']
  },
  {
    num: '05',
    title: 'Scale Up Bisnis RT/RW-Net & Dobel Omset',
    filename: 'banner_promo_5.jpg',
    filenameAlt: 'banner_promo_5_scale_up_bisnis.jpg',
    theme: 'Skala Bisnis, Finansial & Multi-Role',
    target: 'Owner ISP yang ingin ekspansi ribuan pelanggan dengan profit optimal & tim terkoordinasi',
    hook: 'Dari puluhan pelanggan jadi ribuan pelanggan tanpa pusing tambah banyak admin!',
    color: '#0d9488',
    colorLight: '#ccfbf1',
    badge: 'BUSINESS GROWTH',
    img: toBase64('banner_promo_5.jpg'),
    caption: [
      '📈 *SAATNYA SCALE UP BISNIS RT/RW-NET ANDA KE LEVEL BERIKUTNYA!*',
      '',
      'Ingin bisnis internet tumbuh pesat tapi takut operasional berantakan?',
      '',
      '*MyAdamedia Billing* dirancang dengan arsitektur tangguh siap skala besar:',
      '📊 Laporan Keuangan & Arus Kas Real-Time (Pendapatan, Piutang, Biaya Operasional)',
      '👥 Manajemen Hak Akses Multi-Role: Admin, Kasir, Teknisi Lapangan, dan Reseller/Mitra',
      '💎 Lisensi sekali bayar, tanpa potongan bulanan yang mencekik margin keuntungan Anda.',
      '',
      'Investasi cerdas terbaik untuk masa depan bisnis internet Anda!',
      '',
      '🚀 Dapatkan penawaran promo spesial bulan ini:',
      '📲 WhatsApp: [Nomor WhatsApp Anda]'
    ],
    hashtags: ['#BisnisBerkah', '#PengusahaISP', '#ScaleUpBusiness', '#RTNetIndonesia', '#InovasiJaringan', '#ProfitBisnis']
  }
];

let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Panduan Banner Promosi Social Media - MyAdamedia Billing</title>';
html += '<style>';
html += '@page { size: A4 portrait; margin: 12mm 12mm 14mm 12mm; }';
html += '* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }';
html += 'body { font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background: #ffffff; margin: 0; padding: 0; font-size: 10pt; line-height: 1.45; }';
html += '.page { page-break-after: always; height: 1020px; position: relative; overflow: hidden; }';
html += '.page:last-child { page-break-after: avoid; }';

// Header Cover
html += '.cover-header { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #064e3b 100%); border-radius: 12px; padding: 22px 24px; color: white; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.12); }';
html += '.brand-badge { display: inline-block; background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; font-weight: 700; font-size: 8.5pt; padding: 3px 10px; border-radius: 20px; letter-spacing: 0.5px; margin-bottom: 8px; }';
html += '.cover-title { font-size: 18pt; font-weight: 800; line-height: 1.2; margin: 0 0 6px 0; color: #f8fafc; letter-spacing: -0.5px; }';
html += '.cover-subtitle { font-size: 10pt; color: #94a3b8; margin: 0 0 14px 0; }';
html += '.meta-bar { display: flex; gap: 8px; flex-wrap: wrap; }';
html += '.meta-item { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 4px 10px; font-size: 8pt; color: #e2e8f0; font-weight: 500; }';
html += '.meta-item strong { color: #38bdf8; }';

// Table
html += '.section-heading { font-size: 11.5pt; font-weight: 700; color: #0f172a; margin: 14px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; display: flex; align-items: center; gap: 6px; }';
html += '.table-container { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }';
html += 'table { width: 100%; border-collapse: collapse; font-size: 8.5pt; text-align: left; }';
html += 'th { background: #f8fafc; color: #475569; font-weight: 700; padding: 8px 10px; border-bottom: 1px solid #cbd5e1; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; }';
html += 'td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }';
html += 'tr:last-child td { border-bottom: none; }';
html += 'tr:nth-child(even) { background: #fafafa; }';
html += '.badge-pill { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 7.5pt; font-weight: 700; color: white; }';
html += '.code-pill { font-family: Consolas, monospace; background: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-size: 8pt; color: #0f172a; font-weight: 600; }';

// Gallery
html += '.gallery-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 10px; }';
html += '.gallery-item { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #f8fafc; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }';
html += '.gallery-img { width: 100%; aspect-ratio: 9/16; object-fit: cover; display: block; }';
html += '.gallery-caption { padding: 5px 3px; font-size: 7pt; font-weight: 700; color: #334155; line-height: 1.2; }';

// Banner Pages (Detail)
html += '.banner-card { display: flex; gap: 18px; align-items: flex-start; }';
html += '.banner-col-img { flex: 0 0 240px; text-align: center; }';
html += '.banner-main-img { width: 100%; border-radius: 10px; box-shadow: 0 6px 20px rgba(0,0,0,0.15); border: 2px solid #e2e8f0; object-fit: cover; display: block; }';
html += '.banner-col-content { flex: 1; min-width: 0; }';
html += '.banner-num-badge { display: inline-block; font-size: 8pt; font-weight: 800; padding: 3px 9px; border-radius: 20px; color: white; letter-spacing: 0.5px; margin-bottom: 5px; }';
html += '.banner-title-text { font-size: 14pt; font-weight: 800; color: #0f172a; margin: 0 0 3px 0; line-height: 1.2; }';
html += '.banner-subtitle-text { font-size: 9.5pt; color: #64748b; font-weight: 500; margin: 0 0 10px 0; }';

html += '.info-box { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 6px 10px; border-radius: 0 6px 6px 0; margin-bottom: 8px; font-size: 8.5pt; }';
html += '.info-box strong { color: #1e293b; }';

html += '.hook-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 6px 10px; margin-bottom: 10px; }';
html += '.hook-label { font-size: 7pt; text-transform: uppercase; font-weight: 800; color: #d97706; letter-spacing: 0.5px; margin-bottom: 2px; }';
html += '.hook-text { font-size: 8.5pt; font-weight: 600; color: #92400e; font-style: italic; }';

html += '.caption-container { border: 1px solid #cbd5e1; border-radius: 7px; background: #ffffff; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }';
html += '.caption-header { background: #f1f5f9; padding: 5px 10px; font-size: 7.5pt; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; border-radius: 7px 7px 0 0; }';
html += '.caption-body { padding: 8px 10px; font-size: 8pt; line-height: 1.4; color: #334155; white-space: pre-wrap; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }';

html += '.hashtags-wrap { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }';
html += '.hashtag-tag { background: #e0f2fe; color: #0369a1; font-size: 7pt; font-weight: 600; padding: 2px 6px; border-radius: 10px; border: 1px solid #bae6fd; }';

// Page footer
html += '.page-footer { position: absolute; bottom: 8px; left: 0; right: 0; display: flex; justify-content: space-between; font-size: 7.5pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 4px; }';
html += '</style></head><body>';

// PAGE 1: COVER & OVERVIEW
html += '<div class="page">';
html += '  <div class="cover-header">';
html += '    <div class="brand-badge">MYADAMEDIA BILLING SYSTEM</div>';
html += '    <h1 class="cover-title">Panduan & Katalog Banner Promosi Social Media</h1>';
html += '    <p class="cover-subtitle">Materi visual dan panduan copywriting resmi rasio 9:16 untuk Instagram Story, Reels, TikTok, & WhatsApp Story</p>';
html += '    <div class="meta-bar">';
html += '      <div class="meta-item">Rasio: <strong>9:16 Vertikal (HD)</strong></div>';
html += '      <div class="meta-item">Format: <strong>JPG File</strong></div>';
html += '      <div class="meta-item">Jumlah Varian: <strong>5 Pilihan Desain</strong></div>';
html += '      <div class="meta-item">AI Engine: <strong>Gemini AI</strong></div>';
html += '      <div class="meta-item">Folder: <strong>file md/</strong></div>';
html += '    </div>';
html += '  </div>';

html += '  <div class="section-heading">📋 Ringkasan 5 Pilihan Banner</div>';
html += '  <div class="table-container">';
html += '    <table>';
html += '      <thead>';
html += '        <tr>';
html += '          <th style="width: 8%; text-align: center;">No</th>';
html += '          <th style="width: 28%;">Nama Berkas</th>';
html += '          <th style="width: 28%;">Tema / Konsep Utama</th>';
html += '          <th style="width: 36%;">Target Audiens & Fokus</th>';
html += '        </tr>';
html += '      </thead>';
html += '      <tbody>';

banners.forEach(b => {
  html += '      <tr>';
  html += '        <td style="text-align: center;"><span class="badge-pill" style="background: ' + b.color + ';">' + b.num + '</span></td>';
  html += '        <td><span class="code-pill">' + b.filename + '</span></td>';
  html += '        <td><strong>' + b.title + '</strong><br><span style="color: #64748b; font-size: 7.5pt;">' + b.theme + '</span></td>';
  html += '        <td style="font-size: 8pt; color: #475569;">' + b.target + '</td>';
  html += '      </tr>';
});

html += '      </tbody>';
html += '    </table>';
html += '  </div>';

html += '  <div class="section-heading">🖼️ Galeri Visual 5 Pilihan Banner (Rasio 9:16)</div>';
html += '  <div class="gallery-grid">';

banners.forEach(b => {
  html += '    <div class="gallery-item">';
  html += '      <img class="gallery-img" src="' + b.img + '" alt="' + b.title + '">';
  html += '      <div class="gallery-caption"><span style="color: ' + b.color + ';">#' + b.num + '</span> ' + b.badge + '</div>';
  html += '    </div>';
});

html += '  </div>';

html += '  <div class="page-footer">';
html += '    <span>MyAdamedia Billing System &bull; Dokumen Pemasaran Digital</span>';
html += '    <span>Halaman 1 dari 6</span>';
html += '  </div>';
html += '</div>';

// PAGES 2 - 6: DETAILED BANNER PAGES
banners.forEach((b, idx) => {
  const pageNum = idx + 2;
  html += '<div class="page">';
  html += '  <div class="banner-card">';
  
  // Left col: image
  html += '    <div class="banner-col-img">';
  html += '      <img class="banner-main-img" src="' + b.img + '" alt="' + b.title + '">';
  html += '      <div style="margin-top: 6px; font-size: 7.5pt; color: #64748b;">';
  html += '        <strong>Berkas:</strong> <span class="code-pill">' + b.filename + '</span>';
  html += '      </div>';
  html += '    </div>';
  
  // Right col: copy & strategy
  html += '    <div class="banner-col-content">';
  html += '      <span class="banner-num-badge" style="background: ' + b.color + ';">PILIHAN ' + b.num + ' &bull; ' + b.badge + '</span>';
  html += '      <h2 class="banner-title-text">' + b.title + '</h2>';
  html += '      <div class="banner-subtitle-text">' + b.theme + '</div>';
  
  html += '      <div class="info-box" style="border-left-color: ' + b.color + ';">';
  html += '        <strong>🎯 Target Audiens:</strong> ' + b.target;
  html += '      </div>';
  
  html += '      <div class="hook-box">';
  html += '        <div class="hook-label">🎣 Hook Headline (3 Detik Pertama)</div>';
  html += '        <div class="hook-text">"' + b.hook + '"</div>';
  html += '      </div>';
  
  html += '      <div class="caption-container">';
  html += '        <div class="caption-header">';
  html += '          <span>📝 Teks Caption Siap Pakai (Instagram / TikTok / WA)</span>';
  html += '          <span style="font-size: 7pt; font-weight: normal; color: #64748b;">Salin & Tempel Langsung</span>';
  html += '        </div>';
  html += '        <div class="caption-body">' + b.caption.join('\n') + '</div>';
  html += '      </div>';
  
  html += '      <div style="font-size: 7.5pt; font-weight: 700; color: #475569; margin-top: 2px;">🏷️ Rekomendasi Hashtag:</div>';
  html += '      <div class="hashtags-wrap">';
  b.hashtags.forEach(tag => {
    html += '        <span class="hashtag-tag">' + tag + '</span>';
  });
  html += '      </div>';
  
  html += '    </div>';
  html += '  </div>';
  
  html += '  <div class="page-footer">';
  html += '    <span>MyAdamedia Billing System &bull; Dokumen Pemasaran Digital</span>';
  html += '    <span>Halaman ' + pageNum + ' dari 6</span>';
  html += '  </div>';
  html += '</div>';
});

html += '</body></html>';

const tmpHtml = path.join(os.tmpdir(), 'banner_promosi.html');
const tmpPdf = path.join(os.tmpdir(), 'banner_promosi.pdf');

fs.writeFileSync(tmpHtml, html, 'utf8');
console.log('HTML generated, size:', fs.statSync(tmpHtml).size, 'bytes');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const fileUrl = url.pathToFileURL(tmpHtml).href;

console.log('Rendering PDF via Chrome headless...');
const res = spawnSync(chromePath, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--no-pdf-header-footer',
  '--print-to-pdf=' + tmpPdf,
  fileUrl
]);

console.log('Chrome exit code:', res.status);
if (fs.existsSync(tmpPdf)) {
  const stat = fs.statSync(tmpPdf);
  console.log('PDF rendered successfully! Size:', stat.size, 'bytes');
  fs.copyFileSync(tmpPdf, pdfFile);
  console.log('Copied to destination:', pdfFile, 'Final Size:', fs.statSync(pdfFile).size);
  fs.unlinkSync(tmpPdf);
  fs.unlinkSync(tmpHtml);
} else {
  console.error('Failed to generate PDF. Stderr:', res.stderr ? res.stderr.toString() : '');
}
