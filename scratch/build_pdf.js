const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const baseDir = path.resolve(__dirname, '..');
const screenshotsDir = path.join(baseDir, 'file md', 'screenshots');
const outputHtmlPath = path.join(baseDir, 'scratch', 'proposal_printable.html');
const outputPdfPath = path.join(baseDir, 'file md', 'PROPOSAL_PENAWARAN_MYADAMEDIA_BILLING.pdf');

function getImageBase64(filename) {
    const filePath = path.join(screenshotsDir, filename);
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return '';
    }
    const data = fs.readFileSync(filePath);
    return `data:image/png;base64,${data.toString('base64')}`;
}

console.log('Loading screenshots to base64...');
const imgSso = getImageBase64('01_portal_sso.png');
const imgDash = getImageBase64('02_dashboard_eksekutif.png');
const imgCust = getImageBase64('03_manajemen_pelanggan.png');
const imgBill = getImageBase64('04_sistem_billing_invoice.png');
const imgSett = getImageBase64('05_pengaturan_custom_id.png');
const imgOdp = getImageBase64('06_peta_distribusi_odp.png');

console.log('Screenshots loaded. Building HTML template...');

const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Proposal Penawaran - MyAdamedia Billing System Enterprise</title>
<style>
  @page {
    size: A4;
    margin: 18mm 16mm 18mm 16mm;
    @bottom-right {
      content: "Halaman " counter(page);
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 8.5pt;
      color: #64748b;
    }
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    line-height: 1.55;
    font-size: 10pt;
    margin: 0;
    padding: 0;
    background: #ffffff;
  }

  .cover-page {
    height: 100%;
    min-height: 250mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 20mm 10mm 15mm 10mm;
    page-break-after: always;
  }

  .cover-badge {
    display: inline-block;
    background: #0284c7;
    color: #ffffff;
    font-weight: 700;
    font-size: 9pt;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 5px 14px;
    border-radius: 9999px;
    margin-bottom: 20px;
  }

  .cover-title {
    font-size: 26pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.2;
    margin: 0 0 12px 0;
    letter-spacing: -0.5px;
  }

  .cover-subtitle {
    font-size: 14pt;
    color: #0284c7;
    font-weight: 600;
    margin: 0 0 25px 0;
    line-height: 1.35;
  }

  .cover-divider {
    width: 80px;
    height: 5px;
    background: linear-gradient(90deg, #0284c7, #38bdf8);
    border-radius: 3px;
    margin-bottom: 25px;
  }

  .cover-desc {
    font-size: 11pt;
    color: #475569;
    line-height: 1.6;
    max-width: 90%;
  }

  .cover-meta-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 5px solid #0284c7;
    border-radius: 10px;
    padding: 16px 20px;
    margin-top: 30px;
  }

  .cover-meta-grid {
    display: grid;
    grid-template-columns: 140px 1fr;
    row-gap: 8px;
    font-size: 9.5pt;
  }

  .cover-meta-label {
    font-weight: 600;
    color: #64748b;
  }

  .cover-meta-value {
    color: #0f172a;
    font-weight: 600;
  }

  .cover-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-top: 1px solid #e2e8f0;
    padding-top: 15px;
    font-size: 8.5pt;
    color: #64748b;
  }

  .page-break {
    page-break-before: always;
  }

  .no-break {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  h1 {
    font-size: 16pt;
    font-weight: 800;
    color: #0f172a;
    border-bottom: 2px solid #0284c7;
    padding-bottom: 6px;
    margin-top: 24px;
    margin-bottom: 12px;
    letter-spacing: -0.3px;
  }

  h2 {
    font-size: 12.5pt;
    font-weight: 700;
    color: #0369a1;
    margin-top: 18px;
    margin-bottom: 8px;
  }

  h3 {
    font-size: 10.5pt;
    font-weight: 700;
    color: #1e293b;
    margin-top: 14px;
    margin-bottom: 6px;
  }

  p {
    margin-top: 0;
    margin-bottom: 10px;
    text-align: justify;
  }

  ul, ol {
    margin-top: 0;
    margin-bottom: 12px;
    padding-left: 20px;
  }

  li {
    margin-bottom: 4px;
  }

  .highlight-card {
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-left: 4px solid #0284c7;
    border-radius: 8px;
    padding: 12px 16px;
    margin: 12px 0;
  }

  .screenshot-figure {
    margin: 14px 0 16px 0;
    text-align: center;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .screenshot-img {
    width: 100%;
    max-width: 100%;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
  }

  .screenshot-caption {
    font-size: 8.5pt;
    font-style: italic;
    color: #475569;
    margin-top: 6px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 16px 0;
    font-size: 9pt;
    break-inside: avoid;
  }

  th {
    background: #0f172a;
    color: #ffffff;
    font-weight: 600;
    text-align: left;
    padding: 8px 10px;
    border: 1px solid #0f172a;
  }

  td {
    padding: 7px 10px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
  }

  tr:nth-child(even) {
    background: #f8fafc;
  }

  .pricing-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    margin: 16px 0;
    break-inside: avoid;
  }

  .pricing-card {
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    padding: 14px;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .pricing-card.featured {
    border: 2px solid #0284c7;
    background: #f0fdf4;
    position: relative;
  }

  .pricing-badge {
    position: absolute;
    top: -10px;
    right: 12px;
    background: #16a34a;
    color: #ffffff;
    font-size: 7pt;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 9999px;
    text-transform: uppercase;
  }

  .pricing-title {
    font-size: 11pt;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 4px;
  }

  .pricing-price {
    font-size: 13pt;
    font-weight: 800;
    color: #0284c7;
    margin-bottom: 8px;
  }

  .pricing-features {
    font-size: 8pt;
    color: #334155;
    padding-left: 14px;
    margin-bottom: 10px;
  }

  .pricing-features li {
    margin-bottom: 4px;
  }

  .signature-table {
    width: 100%;
    margin-top: 30px;
    border: none;
  }

  .signature-table td {
    border: none;
    width: 50%;
    text-align: center;
    padding: 10px;
  }

  .signature-space {
    height: 70px;
  }
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover-page">
  <div>
    <div class="cover-badge">Dokumen Penawaran Resmi</div>
    <div class="cover-title">PROPOSAL PENAWARAN & KEMITRAAN BISNIS</div>
    <div class="cover-subtitle">Implementasi Sistem Manajemen ISP & Automated Billing Engine<br><strong>MyAdamedia Billing System — Enterprise Edition</strong></div>
    <div class="cover-divider"></div>
    <div class="cover-desc">
      Solusi teknologi terintegrasi untuk penyedia jasa internet (ISP, WISP, RT/RW Net). Otomatisasi penagihan via WhatsApp Gateway, isolir otomatis MikroTik & Radius Server, multi-payment gateway (QRIS & Virtual Account), manajemen TR-069 GenieACS, dan pemetaan jaringan fiber optik (GIS ODP) dalam satu platform terpusat.
    </div>

    <div class="cover-meta-box">
      <div class="cover-meta-grid">
        <div class="cover-meta-label">Nomor Dokumen</div>
        <div class="cover-meta-value">: PROP-MAB/2026/09-01</div>
        <div class="cover-meta-label">Tanggal Terbit</div>
        <div class="cover-meta-value">: 12 September 2026</div>
        <div class="cover-meta-label">Disusun Oleh</div>
        <div class="cover-meta-value">: Tim Solusi & Software Engineering MyAdamedia</div>
        <div class="cover-meta-label">Ditujukan Kepada</div>
        <div class="cover-meta-value">: Pimpinan Manajemen ISP & Direksi Pengelola Jaringan</div>
        <div class="cover-meta-label">Sifat Dokumen</div>
        <div class="cover-meta-value">: Sangat Rahasia & Terbatas (Commercial Proposal)</div>
      </div>
    </div>
  </div>

  <div class="cover-footer">
    <div>MyAdamedia Software Solutions &copy; 2026. All Rights Reserved.</div>
    <div>Sistem Otomasi ISP Terpadu</div>
  </div>
</div>

<!-- SECTION 1 & 2 -->
<h1>1. RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)</h1>
<p>
  Pertumbuhan penetrasi internet di Indonesia membuka peluang bisnis yang sangat masif bagi para pelaku usaha penyedia jasa internet (*Internet Service Provider* / WISP / RT/RW Net). Namun seiring bertambahnya jumlah pelanggan dari puluhan menjadi ratusan hingga ribuan, kompleksitas operasional meningkat secara eksponensial. Penagihan manual satu per satu via WhatsApp, rekonsiliasi pembayaran transfer bank yang rentan salah, serta isolir manual pelanggan yang menunggak di MikroTik seringkali menguras energi tim dan memicu kebocoran pendapatan (*revenue leakage*).
</p>
<p>
  <strong>MyAdamedia Billing System — Enterprise Edition</strong> hadir sebagai solusi otomatisasi menyeluruh (*all-in-one automation platform*). Sistem ini mengintegrasikan seluruh lini kerja manajemen ISP: mulai dari penagihan otomatis berjadwal via WhatsApp, integrasi pembayaran digital otomatis (QRIS Statis/Dinamis & Virtual Account), isolir dan aktivasi kembali secara instan di router MikroTik dan Radius, hingga pemetaan infrastruktur kabel fiber optik (GIS ODP) dan manajemen remote modem ONT via TR-069 GenieACS.
</p>

<div class="highlight-card">
  <strong>Tujuan Utama Implementasi:</strong> Menghemat 90% waktu operasional staf administrasi, menekan angka tunggakan tagihan hingga di bawah 2%, mengeliminasi selisih keuangan, serta memberikan pengalaman layanan profesional berkelas korporat kepada seluruh pelanggan Anda.
</div>

<h1>2. LATAR BELAKANG & TANTANGAN PENGELOLAAN ISP</h1>
<p>
  Berdasarkan survei dan pengalaman empiris kami mendampingi ratusan penyedia jasa internet di berbagai daerah di Indonesia, berikut adalah tantangan fundamental yang kerap dihadapi:
</p>
<ul>
  <li><strong>Beban Administrasi Manual yang Tinggi:</strong> Staf menghabiskan 3-5 hari di setiap awal bulan hanya untuk mengirimkan pesan tagihan satu per satu kepada ratusan pelanggan.</li>
  <li><strong>Piutang Menumpuk Akibat Keterlambatan Isolir:</strong> Pelanggan yang belum membayar tetap dapat menikmati akses internet gratis karena teknisi tidak sempat melakukan isolir manual pada MikroTik.</li>
  <li><strong>Stres Rekonsiliasi Bank:</strong> Pengecekan mutasi transfer manual memakan waktu berjam-jam dan rentan klaim struk palsu dari oknum pelanggan.</li>
  <li><strong>Dokumentasi Jaringan yang Tercecer:</strong> Lokasi box ODP, nomor tiang, dan kapasitas port seringkali hanya dicatat di buku catatan atau grup chat, menyulitkan teknisi baru saat melakukan sambungan baru.</li>
</ul>

<!-- SECTION 3 & 4 -->
<div class="page-break"></div>
<h1>3. MODUL UNGGULAN & TAMPILAN SISTEM (SYSTEM SHOWCASE)</h1>
<p>
  Berikut adalah demonstrasi visual antarmuka asli dari sistem yang siap diimplementasikan di lingkungan operasional perusahaan Anda:
</p>

<h2>3.1. Portal Akses Terpadu (Single Sign-On Multi-Role)</h2>
<p>
  Sistem dilengkapi dengan gerbang masuk terpadu (*Single Sign-On*) yang secara cerdas membedakan hak akses dan antarmuka kerja antara manajemen eksekutif, teknisi lapangan, dan pelanggan akhir:
</p>
<ul>
  <li><strong>Portal Administrator:</strong> Pengelolaan keuangan, konfigurasi server, backup, dan pengaturan jaringan.</li>
  <li><strong>Portal Teknisi:</strong> Akses tiket aduan, pemasangan baru, dan peta ODP tanpa akses data finansial.</li>
  <li><strong>Portal Mandiri Pelanggan:</strong> Akses mandiri untuk cek tagihan, download invoice, bayar QRIS, dan speedtest.</li>
</ul>

<div class="screenshot-figure">
  <img class="screenshot-img" src="${imgSso}" alt="Portal SSO">
  <div class="screenshot-caption">Gambar 1: Antarmuka Portal SSO Terpadu dengan desain modern, cepat, dan ramah pengguna di semua perangkat.</div>
</div>

<h2>3.2. Dashboard Eksekutif & Pemantauan Finansial Real-Time</h2>
<p>
  Manajemen puncak dapat memantau detak jantung finansial dan operasional secara seketika (*real-time*). Data analitik menyajikan total omzet bulan berjalan, potensi pendapatan tertunda, jumlah pelanggan menunggak, status kesehatan CPU & memori MikroTik, serta grafik konsumsi bandwidth FUP pelanggan.
</p>

<div class="screenshot-figure">
  <img class="screenshot-img" src="${imgDash}" alt="Dashboard Eksekutif">
  <div class="screenshot-caption">Gambar 2: Dashboard Eksekutif menampilkan ringkasan pendapatan, performa router MikroTik, dan metriks operasional.</div>
</div>

<div class="page-break"></div>
<h2>3.3. Manajemen Pelanggan & Format Custom ID Dinamis</h2>
<p>
  Pengelolaan data pelanggan dirancang sangat terstruktur dan adaptif terhadap standarisasi penomoran di perusahaan Anda. Dilengkapi fitur <strong>Custom ID Pelanggan</strong> yang memungkinkan pembuatan ID unik (contoh: <code>MDE-0001</code>, <code>NET/2026/0001</code>) lengkap dengan pemantauan status bayar berwarna, indikator kuota FUP, serta sinkronisasi otomatis ke PPPoE Secrets MikroTik.
</p>

<div class="screenshot-figure">
  <img class="screenshot-img" src="${imgCust}" alt="Manajemen Pelanggan">
  <div class="screenshot-caption">Gambar 3: Tabel Manajemen Pelanggan dengan Custom ID dinamis, status lunas/isolir, dan tombol aksi instan.</div>
</div>

<h2>3.4. Sistem Billing, Invoicing & Integrasi Pembayaran Digital</h2>
<p>
  Sistem penagihan otomatis yang menghasilkan invoice resmi setiap tanggal cetak tagihan. Mendukung pembayaran digital otomatis melalui payment gateway (Tripay, Midtrans, Xendit), Virtual Account seluruh bank besar, dan fitur <strong>QRIS Statis/Dinamis</strong> yang terverifikasi instan tanpa perlu pengecekan manual.
</p>

<div class="screenshot-figure">
  <img class="screenshot-img" src="${imgBill}" alt="Sistem Billing & Invoice">
  <div class="screenshot-caption">Gambar 4: Pusat Kontrol Billing & Invoicing dengan rincian status pembayaran dan cetak struk/invoice PDF.</div>
</div>

<div class="page-break"></div>
<h2>3.5. Pengaturan Sistem & Fleksibilitas Custom ID Pelanggan</h2>
<p>
  Pusat kendali pengaturan aplikasi memberikan keleluasaan penuh kepada perusahaan untuk mengatur Prefix ID, pemisah (separator), panjang digit padding dengan <strong>Live Interactive Preview</strong>, konfigurasi API MikroTik, WhatsApp Gateway, serta manajemen lisensi dan database.
</p>

<div class="screenshot-figure">
  <img class="screenshot-img" src="${imgSett}" alt="Pengaturan Custom ID">
  <div class="screenshot-caption">Gambar 5: Konfigurasi Parameter Sistem terfokus pada Format Custom ID Pelanggan dengan pratinjau langsung.</div>
</div>

<h2>3.6. Pemetaan Infrastruktur Jaringan Fiber Optik (GIS ODP)</h2>
<p>
  Sistem informasi geografis yang memetakan seluruh titik ODP (*Optical Distribution Point*) dan jalur kabel fiber optik di peta digital. Tim teknisi dan tim sales dapat mengetahui kapasitas port yang tersedia di setiap tiang secara presisi sebelum melakukan pemasangan ke rumah pelanggan.
</p>

<div class="screenshot-figure">
  <img class="screenshot-img" src="${imgOdp}" alt="Pemetaan ODP GIS">
  <div class="screenshot-caption">Gambar 6: Peta Geografis Sebaran ODP interaktif menampilkan kapasitas port terpakai dan titik lokasi fisik.</div>
</div>

<div class="page-break"></div>
<h1>4. STUDI KOMPARASI & KEUNGGULAN KOMPETITIF</h1>
<p>
  Tabel perbandingan berikut menunjukkan keunggulan investasi MyAdamedia Billing System dibandingkan dengan alternatif lain di industri:
</p>

<table>
  <thead>
    <tr>
      <th style="width: 28%;">Fitur / Aspek Evaluasi</th>
      <th style="width: 22%;">Software Manual / Excel</th>
      <th style="width: 25%;">Aplikasi SaaS Berlangganan</th>
      <th style="width: 25%;">MyAdamedia Billing System</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Model Biaya Lisensi</strong></td>
      <td>Gratis namun boros waktu kerja</td>
      <td>Bayar per pelanggan per bulan (Makin besar makin mahal)</td>
      <td><strong>Investasi Sekali Bayar (Hemat Jangka Panjang)</strong></td>
    </tr>
    <tr>
      <td><strong>Privasi & Lokasi Data</strong></td>
      <td>Lokal rawan hilang/rusak</td>
      <td>Server pihak ketiga (Risiko privasi)</td>
      <td><strong>100% Server Milik Anda (On-Premise / Cloud VPS)</strong></td>
    </tr>
    <tr>
      <td><strong>Auto-Isolir MikroTik</strong></td>
      <td>Tidak Ada (Harus manual)</td>
      <td>Terbatas di paket termahal</td>
      <td><strong>Native & Otomatis Real-Time (v6 & v7)</strong></td>
    </tr>
    <tr>
      <td><strong>Notifikasi WhatsApp</strong></td>
      <td>Ketik manual satu per satu</td>
      <td>Dibatasi kuota pesan bulanan</td>
      <td><strong>Integrasi Bebas Pulsa / Kuota Tak Terbatas</strong></td>
    </tr>
    <tr>
      <td><strong>Pemetaan GIS ODP</strong></td>
      <td>Tidak Tersedia</td>
      <td>Sangat Jarang Disediakan</td>
      <td><strong>Bawaan Sistem (Interactive GIS Map)</strong></td>
    </tr>
    <tr>
      <td><strong>TR-069 Remote ONT</strong></td>
      <td>Tidak Ada</td>
      <td>Tidak Tersedia</td>
      <td><strong>Didukung Penuh (GenieACS Engine)</strong></td>
    </tr>
    <tr>
      <td><strong>Kustomisasi Brand</strong></td>
      <td>Terbatas</td>
      <td>Merek penyedia aplikasi</td>
      <td><strong>Full Whitelabel atas Nama Perusahaan Anda</strong></td>
    </tr>
  </tbody>
</table>

<h1>5. SPESIFIKASI TEKNIS & ARSITEKTUR SISTEM</h1>
<p>
  Aplikasi dibangun dengan arsitektur modern yang ringan, aman, dan sangat stabil:
</p>
<ul>
  <li><strong>Core Engine:</strong> Node.js Express dengan arsitektur non-blocking asynchronous I/O berkecepatan tinggi.</li>
  <li><strong>Database Layer:</strong> SQLite / MySQL dengan indexing teroptimasi untuk pencarian instan ribuan data pelanggan.</li>
  <li><strong>Protokol Jaringan:</strong> MikroTik RouterOS API v6 & v7, FreeRADIUS AAA Server, TR-069 CWMP Daemon.</li>
  <li><strong>Persyaratan Server Minimal:</strong> 2 vCPU, 2 GB RAM, 20 GB SSD Storage (Ubuntu Server 20.04/22.04 LTS atau Debian).</li>
</ul>

<div class="page-break"></div>
<h1>6. PAKET PENAWARAN INVESTASI & LISENSI RESMI</h1>
<p>
  Kami menyediakan skema investasi yang transparan, terukur, dan bebas dari biaya tersembunyi (*no hidden fees*):
</p>

<div class="pricing-grid">
  <!-- PLAN 1 -->
  <div class="pricing-card">
    <div>
      <div class="pricing-title">STARTER ISP</div>
      <div style="font-size: 7.5pt; color: #64748b; margin-bottom: 6px;">Untuk RT/RW Net & WISP Pemula</div>
      <div class="pricing-price">Rp 2.500.000,-</div>
      <ul class="pricing-features">
        <li>Kapasitas: <strong>Hingga 500 Pelanggan</strong></li>
        <li>1 Router MikroTik terintegrasi</li>
        <li>Auto-Isolir & Auto-Aktif MikroTik</li>
        <li>Billing & Invoicing Otomatis</li>
        <li>WhatsApp Gateway Notifikasi</li>
        <li>QRIS Statis Semi-Otomatis</li>
        <li>Dukungan Teknis: 1 Bulan</li>
      </ul>
    </div>
    <div style="font-size: 7.5pt; color: #0284c7; font-weight: 700; text-align: center;">Lifetime License</div>
  </div>

  <!-- PLAN 2 -->
  <div class="pricing-card featured">
    <div class="pricing-badge">PALING POPULER</div>
    <div>
      <div class="pricing-title">PROFESSIONAL ISP</div>
      <div style="font-size: 7.5pt; color: #16a34a; margin-bottom: 6px;">Pilihan Utama ISP Berkembang</div>
      <div class="pricing-price" style="color: #16a34a;">Rp 4.500.000,-</div>
      <ul class="pricing-features">
        <li>Kapasitas: <strong>Hingga 2.500 Pelanggan</strong></li>
        <li>Hingga 3 Router MikroTik sekaligus</li>
        <li><strong>Modul Pemetaan GIS ODP Interaktif</strong></li>
        <li><strong>Multi-Payment Gateway (Tripay / Midtrans)</strong></li>
        <li><strong>Format Custom ID Pelanggan Dinamis</strong></li>
        <li>Portal Mandiri Pelanggan (Self-Service)</li>
        <li>Portal Teknisi Lapangan</li>
        <li>FreeRADIUS Engine Bawaan</li>
        <li>Backup Otomatis ke Telegram / Drive</li>
        <li>Dukungan & Pendampingan: 3 Bulan</li>
      </ul>
    </div>
    <div style="font-size: 7.5pt; color: #16a34a; font-weight: 700; text-align: center;">Rekomendasi Terbaik</div>
  </div>

  <!-- PLAN 3 -->
  <div class="pricing-card">
    <div>
      <div class="pricing-title">ENTERPRISE WHITELABEL</div>
      <div style="font-size: 7.5pt; color: #64748b; margin-bottom: 6px;">Skala Korporat & Multi-Branch</div>
      <div class="pricing-price">Rp 8.500.000,-</div>
      <ul class="pricing-features">
        <li>Kapasitas: <strong>UNLIMITED Pelanggan</strong></li>
        <li>Router MikroTik <strong>Tanpa Batas</strong></li>
        <li><strong>Integrasi GenieACS TR-069 Remote ONT</strong></li>
        <li><strong>Full Whitelabel (Brand & Logo Anda)</strong></li>
        <li><strong>Fitur Multi-PT / Database Flush</strong></li>
        <li>Dukungan Source Code Terkonfigurasi</li>
        <li>Setup Cloud VPS & Hardening Firewall</li>
        <li>Dukungan Prioritas (SLA 24/7): 6 Bulan</li>
      </ul>
    </div>
    <div style="font-size: 7.5pt; color: #0284c7; font-weight: 700; text-align: center;">Solusi Skala Maksimal</div>
  </div>
</div>

<div class="highlight-card">
  <strong>PENAWARAN PROMOSI SPESIAL BULAN INI:</strong><br>
  Dapatkan <strong>GRATIS Biaya Instalasi Awal & Jasa Migrasi Data Pelanggan</strong> (senilai Rp 1.000.000,-) untuk konfirmasi pemesanan Paket Professional atau Enterprise dalam 14 hari kalender sejak penerbitan dokumen ini.
</div>

<h1>7. TAHAPAN IMPLEMENTASI & JAMINAN LAYANAN (SLA)</h1>
<p>
  Implementasi sistem dilaksanakan dalam 5 hari kerja tanpa menimbulkan *downtime* pada akses internet pelanggan Anda:
</p>
<ul>
  <li><strong>Hari 1:</strong> Setup lingkungan server (Cloud VPS / On-Premise) dan instalasi aplikasi inti.</li>
  <li><strong>Hari 2:</strong> Integrasi tunneling aman ke MikroTik dan aktivasi WhatsApp Gateway.</li>
  <li><strong>Hari 3:</strong> Migrasi data pelanggan dari Excel/database lama dan plotting titik ODP ke GIS.</li>
  <li><strong>Hari 4:</strong> Pengujian User Acceptance Test (UAT), simulasi pembayaran & auto-isolir.</li>
  <li><strong>Hari 5:</strong> Pelatihan menyeluruh staf admin, kasir, teknisi, dan *official go-live*.</li>
</ul>

<div class="no-break">
  <h1>8. LEMBAR PERSETUJUAN KERJASAMA & KEMITRAAN</h1>
  <p>
    Demikian proposal ini kami sampaikan sebagai wujud komitmen kami dalam menghadirkan solusi otomasi terbaik bagi kemajuan bisnis penyedia jasa internet Anda.
  </p>

  <table class="signature-table">
    <tr>
      <td>
        <strong>Disetujui & Diterima Oleh:</strong><br>
        Manajemen Perusahaan Klien
        <div class="signature-space"></div>
        <strong>( _______________________________ )</strong><br>
        Nama Jelas & Cap Perusahaan<br>
        Tanggal: ____ / ____ / 2026
      </td>
      <td>
        <strong>Diajukan Oleh:</strong><br>
        Tim Solusi MyAdamedia
        <div class="signature-space"></div>
        <strong>( TIM BUSINESS DEVELOPMENT )</strong><br>
        MyAdamedia Software Solutions<br>
        Tanggal: 12 September 2026
      </td>
    </tr>
  </table>
</div>

</body>
</html>
`;

fs.writeFileSync(outputHtmlPath, htmlContent, 'utf8');
console.log('HTML printable generated at:', outputHtmlPath);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (!fs.existsSync(chromePath)) {
    console.error('Chrome executable not found at:', chromePath);
    process.exit(1);
}

console.log('Generating PDF via Chrome headless...');
const cmd = `"${chromePath}" --headless=new --disable-gpu --no-sandbox --no-first-run --run-all-compositor-stages-before-draw --print-to-pdf="${outputPdfPath}" "${outputHtmlPath}"`;

try {
    execSync(cmd, { stdio: 'inherit' });
    if (fs.existsSync(outputPdfPath)) {
        const stats = fs.statSync(outputPdfPath);
        console.log('PDF successfully created at:', outputPdfPath, 'Size:', stats.size, 'bytes');
    } else {
        console.error('PDF file was not created.');
    }
} catch (err) {
    console.error('Error generating PDF:', err.message);
}
