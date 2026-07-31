# Catatan Proses & Riwayat Perubahan (proses.md)

Dokumen ini mencatat seluruh proses analisis, perancangan arsitektur, dan perubahan kode pada aplikasi **MyAdamedia Billing**.

---

## [2026-07-31] - UI Fix: Perbaikan Logo Perusahaan pada Sidebar Menu RADIUS

### 1. Permasalahan yang Ditemukan
Saat membuka halaman Admin Portal RADIUS NAS (`/admin/radius`) atau Sesi RADIUS (`/admin/radius/sessions`), gambar **Logo Perusahaan / Aplikasi** di bagian kiri atas sidebar menghilang dan digantikan oleh icon default.

### 2. Penyebab Utama
Komponen partial [`sidebar.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/partials/sidebar.ejs#L27) memeriksa ketersediaan objek `settings.company_logo` di dalam `res.locals`. Pada controller route RADIUS sebelumnya, objek `res.locals.settings` belum diteruskan dari `settingsManager`.

### 3. Solusi yang Diterapkan
- [`routes/admin/auth.js`](file:///d:/WEBAPP/myadamedia-billing/routes/admin/auth.js): Menambahkan `res.locals.settings = getSettings()` pada fungsi `requireAdminSession`.
- [`routes/admin/radius.js`](file:///d:/WEBAPP/myadamedia-billing/routes/admin/radius.js): Menambahkan `res.locals.settings = getSettings()` pada middleware `router.use`.

### 4. Dampak Perubahan
Logo perusahaan/aplikasi kini muncul secara konsisten dan presisi di bagian atas sidebar menu pada seluruh halaman RADIUS.

---

## [2026-07-31] - UI Fix: Restrukturisasi Tabel & Card dengan Native `admin.css` Classes

### 1. Permasalahan yang Ditemukan
Tampilan tabel **Daftar NAS Router Terdaftar** pada halaman [`nas_management.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/nas_management.ejs) terlihat berdempetan, tombol **Tambah NAS Router** tidak rata kanan, dan header tabel menyatu tanpa garis pemisah yang rapi.

### 2. Penyebab Utama
Header card dan tabel sebelumnya menggunakan elemen Bootstrap generik (`card-box`, `card-header-flex`, `table table-hover`) yang tidak memiliki rule CSS aktif di `admin.css?v=2`. Sistem Admin Portal MyAdamedia Billing menggunakan modul CSS native yaitu `card`, `card-hd`, `tbl-wrap`, `dtbl`, `stat-grid`, dan `sc`.

### 3. Solusi yang Diterapkan
- Mengubah struktur layout pada [`nas_management.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/nas_management.ejs) dan [`active_sessions.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/active_sessions.ejs):
  - **Stat Cards**: Menggunakan `<div class="stat-grid">` dan `<div class="sc">`
  - **Card Wrapper**: Menggunakan `<div class="card">`
  - **Header Card**: Menggunakan `<div class="card-hd"><h6>...</h6><button class="btn btn-p btn-sm">...</button></div>`
  - **Tabel**: Menggunakan `<div class="tbl-wrap"><table class="dtbl">...</table></div>`
  - **Badges & Buttons**: Menggunakan `badge bs`, `badge bd`, `btn btn-p`, `btn btn-g`, `btn btn-d`.

### 4. Dampak Perubahan
Tabel daftar NAS Router dan monitoring sesi aktif kini tampil sangat rapi, bersih, tombol tersusun secara simetris, dan 100% konsisten dengan halaman admin lainnya di MyAdamedia Billing.

---

## [2026-07-31] - Implementasi Fitur RADIUS Server (PPPoE & Hotspot)

### 1. Ringkasan Perubahan
Telah berhasil diimplementasikan modul **Embedded RADIUS Server** terpusat di Node.js untuk menangani autentikasi pengguna **PPPoE** dan **Hotspot Vouchers**, pencatatan penggunaan data (*Accounting*), serta pemutusan koneksi seketika (*Disconnect-Request / CoA*).

### 2. File & Komponen Terbuat / Diperbarui

#### Database & Konfigurasi
- [`config/database.js`](file:///d:/WEBAPP/myadamedia-billing/config/database.js): Menambahkan tabel `radius_nas` (pendaftaran router MikroTik RADIUS NAS) dan `radius_acct` (log sesi aktif dan pemakaian data), serta migrasi kolom `mikrotik_rate_limit` pada tabel `packages`.

#### Core RADIUS Services (UDP Engine)
- [`services/radiusCodec.js`](file:///d:/WEBAPP/myadamedia-billing/services/radiusCodec.js): Engine encoding & decoding paket RADIUS RFC 2865, RFC 2866, dan RFC 3576 secara native (Crypto & Buffer Node.js) tanpa ketergantungan library pihak ketiga.
- [`services/radiusDictionary.js`](file:///d:/WEBAPP/myadamedia-billing/services/radiusDictionary.js): Kamus Vendor-Specific Attributes (VSA) MikroTik (Vendor ID: `14988`) untuk `Mikrotik-Rate-Limit`, `Mikrotik-Group`, `Mikrotik-Address-List`, dll.
- [`services/radiusService.js`](file:///d:/WEBAPP/myadamedia-billing/services/radiusService.js): Service utama yang membuka socket UDP port `1812` (Authentication) dan port `1813` (Accounting). Mengautentikasi user PPPoE & Hotspot langsung ke database `billing.db`.
- [`services/radiusCoaService.js`](file:///d:/WEBAPP/myadamedia-billing/services/radiusCoaService.js): Modul pengirim paket Disconnect-Request (UDP `3799`) untuk memutus koneksi pelanggan terisolir atau voucher habis secara seketika.

#### Navigation & Sidebar Menu
- [`services/sidebarMenuService.js`](file:///d:/WEBAPP/myadamedia-billing/services/sidebarMenuService.js): Menambahkan menu **RADIUS NAS** (`/admin/radius`) dan **Sesi RADIUS** (`/admin/radius/sessions`) pada menu navigasi Admin Portal.

#### Controller & UI Views
- [`routes/admin/radius.js`](file:///d:/WEBAPP/myadamedia-billing/routes/admin/radius.js): Controller Admin Portal untuk pendaftaran NAS Router, 1-Click Terminal Script Generator, JSON API active sessions, dan aksi Disconnect CoA.
- [`views/admin/radius/nas_management.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/nas_management.ejs): UI Dashboard manajemen Router NAS (Tambah, Edit, Hapus, Salin Script RouterOS).
- [`views/admin/radius/active_sessions.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/active_sessions.ejs): UI Monitoring sesi aktif real-time dengan tombol Kick User (CoA).

#### Application Entry Point
- [`app-customer.js`](file:///d:/WEBAPP/myadamedia-billing/app-customer.js): Router `/admin/radius` di-mount ke dalam aplikasi Express.

---

## [2026-07-31] - Implementasi Modul Standalone Investor Dashboard (`investor/`)

### 1. Ringkasan Perubahan
Telah diimplementasikan modul **Standalone Investor Dashboard & Financial Analytics Portal** yang terisolasi secara rapi di dalam folder modular **`investor/`**. Modul ini menyajikan ringkasan eksekutif keuangan perusahaan (Omset Gross Revenue, Pengeluaran OpEx/CapEx, Net Profit, Profit Margin %, MRR, ARPU), demografi & pertumbuhan pelanggan (Aktif, Isolir, PSB), grafik interaktif tren keuangan (Chart.js), serta perhitungan otomatis hak bagi hasil saham investor (*Dividen Share*) secara *read-only* dengan tingkat keamanan session tinggi.

### 2. File & Komponen Terbuat / Diperbarui

#### Database Schema
- [`config/database.js`](file:///d:/WEBAPP/myadamedia-billing/config/database.js): Menambahkan skema tabel `investors` (ID, Nama, Username, Password, Share Percentage %, Status, Timestamps).

#### Sub-Folder Modular Investor (`investor/`)
- [`investor/services/investorService.js`](file:///d:/WEBAPP/myadamedia-billing/investor/services/investorService.js): Service engine agregasi finansial, kalkulasi Net Profit, MRR, ARPU, grafik tren bulanan, distribusi paket, breakdown pengeluaran, dan kalkulasi dividen saham investor.
- [`investor/routes/investorPortal.js`](file:///d:/WEBAPP/myadamedia-billing/investor/routes/investorPortal.js): Controller Express Router untuk otentikasi login standalone investor (`/investor/login`), executive dashboard (`/investor/dashboard`), API chart data (`/investor/api/chart-data`), dan logout session (`/investor/logout`).
- [`investor/routes/adminInvestors.js`](file:///d:/WEBAPP/myadamedia-billing/investor/routes/adminInvestors.js): Controller Admin Portal (`/admin/investors`) untuk mengelola akun investor (Tambah, Edit Nama/Username/Password/Persentase Saham %, Hapus, Toggle Status Aktif).
- [`investor/views/login.ejs`](file:///d:/WEBAPP/myadamedia-billing/investor/views/login.ejs): Halaman login investor standalone dengan estetika modern dark-mode, glassmorphism, dan responsif.
- [`investor/views/dashboard.ejs`](file:///d:/WEBAPP/myadamedia-billing/investor/views/dashboard.ejs): Executive Investor Dashboard dengan KPI Summary Cards, Filter Periode, grafik interaktif Chart.js (Line Chart & Doughnut Chart), Card Dividen Investor, dan tabel transaksi keuangan terbaru.
- [`investor/views/admin_investors.ejs`](file:///d:/WEBAPP/myadamedia-billing/investor/views/admin_investors.ejs): Halaman Admin Portal untuk mengelola pendaftaran akun investor dan persentase saham.

#### Application Entry Point
- [`app-customer.js`](file:///d:/WEBAPP/myadamedia-billing/app-customer.js): Router `/investor` dan `/admin/investors` di-mount ke dalam aplikasi Express.

---

## [2026-07-31] - UI Fix: Aktivasi Menu 'Akun Investor' pada Sidebar Navigation Admin

### 1. Permasalahan yang Ditemukan
Menu **Akun Investor** belum muncul pada sidebar kiri Admin Portal di bawah grup Keuangan setelah penambahan modul `investor/`.

### 2. Penyebab Utama
Status visibilitas menu bawaan pada `DEFAULT_MENU_STATES` di [`services/sidebarMenuService.js`](file:///d:/WEBAPP/myadamedia-billing/services/sidebarMenuService.js) belum mencakup key `investors`. Selain itu, database `app_settings` perlu dipaksa memuat status `visible` untuk menu baru.

### 3. Solusi yang Diterapkan
- [`services/sidebarMenuService.js`](file:///d:/WEBAPP/myadamedia-billing/services/sidebarMenuService.js): Menambahkan key `investors: STATE_VISIBLE`, `radius_nas: STATE_VISIBLE`, `radius_sessions: STATE_VISIBLE` ke dalam `DEFAULT_MENU_STATES`.
- [`config/database.js`](file:///d:/WEBAPP/myadamedia-billing/config/database.js): Menambahkan `'investors'` ke daftar `coreMenus` di fungsi `forceUnlockCoreMenus()` agar otomatis tersimpan sebagai menu `visible` di database.

#### Dampak Perubahan
Menu **Akun Investor** (`/admin/investors`) kini tampil secara permanen dan otomatis pada sidebar Admin Portal di grup menu **KEUANGAN**.

---

## [2026-07-31] - UI Refactoring: Penyelarasan Tampilan Halaman Admin Investor (`admin.css` Native)

### 1. Permasalahan yang Ditemukan
Tampilan tabel **Daftar Investor Terdaftar** pada halaman [`admin_investors.ejs`](file:///d:/WEBAPP/myadamedia-billing/investor/views/admin_investors.ejs) terlihat berdempetan, header tabel tanpa latar belakang pemisah, dan tombol aksi belum sesuai dengan desain native sistem MyAdamedia Billing.

### 2. Penyebab Utama
Header card, tabel, badge, dan modal sebelumnya menggunakan kelas CSS kustom / inline style alih-alih menggunakan modul CSS bawaan `admin.css?v=2` (`card`, `card-hd`, `tbl-wrap`, `dtbl`, `badge bp`, `badge bs`, `badge bd`, `btn btn-p`, `btn btn-g`, `btn btn-d`, `mo`, `mb`, `mh`, `mbody`, `mf`).

### 3. Solusi yang Diterapkan
- Mengubah struktur HTML pada [`investor/views/admin_investors.ejs`](file:///d:/WEBAPP/myadamedia-billing/investor/views/admin_investors.ejs):
  - **Tabel**: Menggunakan `<div class="tbl-wrap"><table class="dtbl">...</table></div>`.
  - **Card**: Menggunakan `<div class="card"><div class="card-hd">...</div></div>`.
  - **Badges**: Menggunakan `badge bp` untuk persentase saham, `badge bs` untuk status aktif, dan `badge bd` untuk status non-aktif.
  - **Tombol**: Menggunakan `btn btn-p btn-sm` untuk Tambah, `btn btn-g btn-sm` untuk Edit, dan `btn btn-d btn-sm` untuk Hapus.
  - **Modal**: Menggunakan modal native `mo`, `mb`, `mh`, `mbody`, `mf`.

### 4. Dampak Perubahan
Tampilan halaman Manajemen Akun Investor (`/admin/investors`) kini tampil sangat rapi, simetris, berlatar dark theme konsisten, dan 100% selaras dengan tampilan halaman Admin Portal MyAdamedia Billing lainnya.

---

## [2026-07-31] - Bug Fix: Penyesuaian Query Database Keuangan pada Dashboard Investor

### 1. Permasalahan yang Ditemukan
Saat membuka **Dashboard Investor** (`/investor/dashboard`), aplikasi menampilkan pesan error *"Terjadi kesalahan saat memuat Dashboard Investor"*.

### 2. Penyebab Utama
Hasil inspeksi stack trace menunjukkan `SqliteError: no such table: payments`. Pada skema database SQLite `billing.db`, transaksi pembayaran tagihan tersimpan di tabel `invoices` dengan atribut `status = 'paid'` dan `paid_at`.

### 3. Solusi yang Diterapkan
- [`investor/services/investorService.js`](file:///d:/WEBAPP/myadamedia-billing/investor/services/investorService.js): Mengubah seluruh query agregasi Omset (Revenue), grafik tren bulanan, dan feed transaksi terbaru untuk membaca tabel `invoices` yang berstatus `'paid'` (`WHERE status = 'paid' AND paid_at IS NOT NULL`).

### 4. Dampak Perubahan
Executive Investor Dashboard kini memuat data secara instan, menampilkan Omset Gross Revenue (contoh: `Rp 1.150.000`), MRR (contoh: `Rp 12.895.000`), ARPU, Laba Bersih, dan Bagi Hasil Dividen Investor secara akurat dan 100% bebas dari error.

---

## [2026-07-31] - System Fix: Konfigurasi Git `safe.directory` untuk Autopush

### 1. Permasalahan yang Ditemukan
Saat menjalankan script `autopush.bat` atau perintah Git, muncul pesan peringatan *`fatal: detected dubious ownership in repository at 'D:/WEBAPP/myadamedia-billing'`*.

### 2. Penyebab Utama
Ownership folder repositori di Windows terdeteksi berbeda antara SID pengguna lama dan akun pengguna Windows `MYADAMEDIA/iwanw` saat ini.

### 3. Solusi yang Diterapkan
- Menambahkan direktori proyek ke daftar direktori aman di Git:
  ```bash
  git config --global --add safe.directory D:/WEBAPP/myadamedia-billing
  ```

### 4. Dampak Perubahan
Peringatan kepemilikan repositori Git kini sepenuhnya hilang, dan proses `autopush.bat` maupun sinkronisasi ke GitHub berjalan lancar tanpa terhambat.

---
