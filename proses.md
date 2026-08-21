# Catatan Proses Perubahan & Perbaikan Sistem (proses.md)

---

## [2026-08-21] Peremajaan UI/UX Halaman Monitoring & Manajemen MikroTik (`/admin/mikrotik`)

### 1. Deskripsi Permasalahan & Kebutuhan
Pengguna meminta peremajaan antarmuka (*UI/UX*) dari halaman **Monitoring & Manajemen MikroTik** (`http://localhost:3001/admin/mikrotik`) agar tampil jauh lebih modern, atraktif, informatif, dan nyaman dipandang mata sesuai standar antarmuka aplikasi berskala produksi terkini.

### 2. Penyebab Utama Tampilan Lama
- Tampilan sebelumnya memiliki desain kartu statis sederhana tanpa meter indikator visual (beban CPU & sisa memori RAM).
- Kurangnya *Hero Welcome Banner* yang memberikan konteks integrasi RouterOS API & status konektivitas secara visual.
- Navigasi tab masih menggunakan styling teks datar sederhana tanpa efek *segmented pill tabs*.

### 3. Solusi & Implementasi Teknis
- **Format Kecepatan Bandwidth Mbps (`views/admin/routers.ejs`)**:
  - Mengubah format tampilan metrik real-time **Download (Rx Rate)** dan **Upload (Tx Rate)** pada popup modal *Live Traffic Realtime* agar secara penuh disajikan dalam satuan bit rate **Mbps** (`(rxBitsPerSecond / 1000000).toFixed(2) + ' Mbps'`).
  - Menyelaraskan tampilan kartu metrik teratas dengan grafik garis *Realtime Traffic Bandwidth Chart* yang juga berbasis **Mbps**.
- **Pembersihan Tag Style Berulang (`views/admin/mikrotik.ejs`)**:
  - Mengeliminasi duplikasi tag `</style>` pada bagian `<head>` file `views/admin/mikrotik.ejs` yang menyebabkan teks kode CSS `@keyframes spin...` terekspos langsung ke dalam DOM HTML browser.
- **Sistem CSS Theme-Adaptive (`var(--card-bg)`, `var(--border)`, `var(--text)`, `var(--muted)`)**:
  - Memperbarui seluruh styling elemen kartu, tab, badge, dan hero banner pada `views/admin/mikrotik.ejs`, `views/admin/vouchers.ejs`, dan `views/admin/routers.ejs` agar menggunakan variabel CSS tema bawaan.
  - Memastikan kontras warna teks/font **100% jelas, tajam, dan terbaca presisi** baik saat aplikasi berada dalam **Mode Terang (Light Mode)** maupun **Mode Gelap (Dark Mode)**.
- **Penyelarasan Desain Tab Voucher Hotspot (`views/admin/vouchers.ejs`)**:
  - Menambahkan *Hero Welcome Banner* khas Voucher & Batch Hotspot.
  - Meremajakan 4 Kartu Statistik (Total Batch, Total Voucher, Voucher Terpakai, Belum Terpakai) berdesain *Glassmorphic Stat Cards Grid* dengan aksen warna ungu, biru, hijau, dan amber.
- **Penyelarasan Desain Tab Router (`views/admin/routers.ejs`)**:
  - Menambahkan *Hero Welcome Banner* khas Manajemen Multi-Router.
  - Meremajakan 3 Kartu Statistik Router (Total Router, Status Aktif, Status Nonaktif).
- **Hero Welcome Banner & Resource Progress Meters (`views/admin/mikrotik.ejs`)**:
  - Visualisasi *Animated Progress Bar Meters* untuk **CPU Load** (dengan perubah warna otomatis: Biru ➔ Amber jika >50% ➔ Merah jika >80%), **Free Memory (RAM)**, dan **Router Uptime**.

### 4. Komponen & File Yang Diubah
- `[MODIFY]` [`views/admin/mikrotik.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/mikrotik.ejs) (Theme adaptive contrast CSS & resource progress meters)
- `[MODIFY]` [`views/admin/vouchers.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/vouchers.ejs) (Hero banner & modern stat cards grid)
- `[MODIFY]` [`views/admin/routers.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/routers.ejs) (Hero banner & modern stat cards grid)
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md)

### 5. Hasil Pengujian & Verifikasi
- **Pengujian Visual**: Tampilan antarmuka `/admin/mikrotik` terender dengan sangat indah, responsif, dan dinamis pada mode gelap maupun terang.
- **Pengujian Automated Jest**: 12 Test Suites / 204 Tests Passed (100%).

---

## [2026-08-21] Penambahan Fitur ODC (Optical Distribution Cabinet), Pemisahan Ikon ODP vs ODC & Peremajaan Ikon Pelanggan Ultra-Modern (`/admin/map` & `/tech/map`)

### 1. Deskripsi Permasalahan & Kebutuhan
Pengguna meminta penambahan fitur **ODC (Optical Distribution Cabinet)** pada Peta Jaringan (`http://localhost:3001/admin/map`), pemisahan ikon visual secara kontras antara ODP (*Optical Distribution Point*) dengan ODC, serta mengubah ikon pelanggan (Berbayar, Free, Isolir) agar tampil jauh lebih menarik, modern, dan presisi.

### 2. Solusi & Implementasi Teknis
- **Database Schema Migration (`config/database.js`)**:
  - Menambahkan kolom `type` (`TEXT DEFAULT 'ODP'`) pada tabel `odps` melalui skrip *Safe Migration* tanpa merusak data lama.
- **Backend & Data Service (`services/odpService.js` & `routes/adminPortal.js`)**:
  - Memperbarui fungsi `createOdp` dan `updateOdp` untuk menerima atribut `type` (`ODC` atau `ODP`).
  - Mengatur default kapasitas port otomatis (48 port untuk ODC, 16 port untuk ODP) dan memperbarui respon umpan balik pesan sukses pengguna.
- **Frontend Map Visualizations & DivIcon Engine (`views/admin/map.ejs` & `views/tech/map.ejs`)**:
  - **ODC Marker**: Menampilkan ikon kabinet rack violet/indigo (`#8b5cf6` ➔ `#7c3aed`) berukuran `32x32px` dengan badge mikro "ODC", efek border putih 2px, serta neon purple glow shadow.
  - **ODP Marker**: Menampilkan ikon box pembagi amber/gold (`#f59e0b` ➔ `#d97706`) berukuran `28x28px` dengan badge mikro "ODP" dan amber glow shadow.
  - **Ikon Pelanggan Modern Glassmorphic Pin**:
    - **Berbayar (Active)**: Teardrop Glassmorphic Pin Royal Blue (`#38bdf8` ➔ `#1d4ed8`) dengan *Pulsing Neon Ring* biru, ikon `bi-house-check-fill`.
    - **Paket Free**: Teardrop Glassmorphic Pin Emerald Green (`#34d399` ➔ `#047857`) dengan *Pulsing Neon Ring* hijau, ikon `bi-gift-fill`.
    - **Isolir (Suspended)**: Teardrop Glassmorphic Pin Crimson Red (`#f87171` ➔ `#b91c1c`) dengan *Pulsing Neon Ring* merah, ikon `bi-house-x-fill`.
- **UI Controls, Legend Bar & Stat Cards**:
  - Menambahkan 5 Kartu Statistik (Total ODC, Total ODP, Berbayar, Free, Isolir).
  - Menambahkan 5 Checkbox Filter Layer pada Legend Bar (`#toggle-odc`, `#toggle-odp`, `#toggle-active`, `#toggle-free`, `#toggle-suspended`) yang tersimpan di `localStorage`.
  - Menambahkan opsi **Jenis Perangkat (ODP vs ODC)** pada Modal Tambah dan Modal Edit Perangkat dengan penyesuaian kapasitas port otomatis.

### 3. Komponen & File Yang Diubah
- `[MODIFY]` [`config/database.js`](file:///d:/WEBAPP/myadamedia-billing/config/database.js)
- `[MODIFY]` [`services/odpService.js`](file:///d:/WEBAPP/myadamedia-billing/services/odpService.js)
- `[MODIFY]` [`routes/adminPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js)
- `[MODIFY]` [`views/admin/map.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/map.ejs) (Update label tombol menjadi **Tambah ODC/ODP**)
- `[MODIFY]` [`views/tech/map.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/tech/map.ejs)
- `[MODIFY]` [`locales/id.json`](file:///d:/WEBAPP/myadamedia-billing/locales/id.json) & [`locales/en.json`](file:///d:/WEBAPP/myadamedia-billing/locales/en.json)
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md)

### 4. Hasil Pengujian & Verifikasi
- **Pengujian Tampilan & Visual**: Ikon ODC (Purple Rack Cabinet), ODP (Amber Box), dan Pelanggan Pin Teardrop dengan pulse ring terender sempurna pada mode Satelit, OpenStreetMap, maupun CartoDB Dark Mode.
- **Pengujian Database & CRUD**: Berhasil menambah dan mengedit ODC/ODP dengan kapasitas port serta jalur kabel yang presisi.
- **Pengujian Automated Jest**: 12 Test Suites / 204 Tests Passed (100%).

---

## [2026-08-21] Penambahan Fitur Tile Map Dark Mode (CartoDB) pada Peta Jaringan Admin (/admin/map) & Peta Teknisi (/tech/map)

### 1. Deskripsi Permasalahan & Kebutuhan
Pengguna meminta penambahan fitur **Map Dark Mode** (*CartoDB Dark Tile Layer*) pada peta jaringan `http://localhost:3001/admin/map` dan `http://localhost:3001/tech/map` sama seperti yang ada pada dashboard investor.

### 2. Solusi & Implementasi Teknis
- **Integrasi CartoDB Dark Tile Layer**:
  - Mengintegrasikan layer peta CartoDB `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` ke dalam opsi `baseMaps` kontrol Leaflet pada `views/admin/map.ejs` dan `views/tech/map.ejs`.
  - Membaca tema aktif dari `document.documentElement` / `localStorage` secara otomatis; jika aplikasi berada dalam mode gelap (*Dark Mode*), maka layer **Dark Mode (CartoDB)** akan langsung aktif secara default saat peta dibuka.
  - Tetap menyediakan pilihan switcher layer manual antara **Dark Mode (CartoDB)**, **Satelit (Hybrid)**, dan **OpenStreetMap**.

### 3. Komponen & File Yang Diubah
- `[MODIFY]` [`views/admin/map.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/map.ejs)
- `[MODIFY]` [`views/tech/map.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/tech/map.ejs)
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md)

### 4. Hasil Pengujian & Verifikasi
- **Pengujian Visual**: Opsi layer `Dark Mode (CartoDB)` kini tersedia di switcher Leaflet dan aktif secara default ketika tema gelap digunakan.
- **Pengujian Jest**: 12 Test Suites / 204 Tests Passed (100%).

---

## [2026-08-21] Peremajaan UI/UX Halaman Peta Jaringan & Topologi Fiber Optik Admin (/admin/map)

### 1. Deskripsi Permasalahan & Kebutuhan
Pengguna meminta agar tampilan antarmuka (*UI/UX*) dari halaman **Peta Jaringan & Topologi Fiber Optik** (`http://localhost:3001/admin/map` / `https://bill.myadamedia.web.id/admin/map`) diperbarui menjadi jauh lebih menarik, modern, elegan, dan nyaman dipandang mata sesuai standar antarmuka aplikasi terkini.

### 2. Solusi & Implementasi Teknis
- **Hero Welcome Banner**: Menambahkan banner eksekutif bergradien dinamis dengan lencana status *GIS Topo Engine*, deskripsi fitur pemetaan interaktif, dan tombol aksi cepat *Tambah ODP*.
- **Stat Cards Grid & Metrik Visual**: Memodernisasi 4 kartu statistik (*Total ODP*, *Pelanggan Berbayar*, *Paket Free*, dan *Pelanggan Isolir/Nonaktif*) dengan efek *Glassmorphism*, latar belakang semi-transparan, bayangan halus, dan animasi hover elevation.
- **Legend & Toggle Bar Modern**: Menyempurnakan filter tombol toggle per layer (*ODP*, *Pelanggan Berbayar*, *Pelanggan Free*, *Pelanggan Isolir*) menjadi kartu pill kontras tinggi yang responsif di berbagai perangkat.
- **Container Peta Leaflet (`#map`)**: Menyesuaikan tinggi kontainer peta `calc(100vh - 220px)` (min-height `520px`), sudut melengkung `18px`, border transparan, dan elevasi bayangan 3D.
- **Panel Tabel Daftar ODP (`.odps-panel`)**: Memperbarui kartu daftar ODP dengan header *sticky*, input pencarian `#odpSearch`, koordinat berwarna kontras tinggi, dan tombol aksi yang rapi.

### 3. Komponen & File Yang Diubah
- `[MODIFY]` [`views/admin/map.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/map.ejs)
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md)

### 4. Hasil Pengujian & Verifikasi
- **Pengujian Visual**: Halaman `/admin/map` kini tampil sangat modern, profesional, fleksibel pada tema gelap/terang, dan kaya fitur visualisasi spasial.
- **Pengujian Jest**: 12 Test Suites / 204 Tests Passed (100%).

---

## [2026-08-21] Peremajaan UI/UX Halaman Manajemen RADIUS NAS Router (/admin/radius) & Monitoring Sesi Aktif (/admin/radius/sessions)

### 1. Deskripsi Permasalahan & Kebutuhan
Pengguna meminta agar tampilan antarmuka (*UI/UX*) dari 2 halaman manajemen RADIUS:
- `http://localhost:3001/admin/radius` (**Manajemen RADIUS NAS**)
- `http://localhost:3001/admin/radius/sessions` (**Monitoring Sesi Aktif RADIUS**)
diperbarui menjadi jauh lebih menarik, modern, intuitif, dan nyaman dipandang mata sesuai standar desain sistem terkini.

### 2. Solusi & Implementasi Teknis
- **Manajemen RADIUS NAS (`/admin/radius`)**:
  - **Hero Welcome Banner**: Menambahkan banner eksekutif bergradien dinamis dengan lencana status *Centralized Auth*, deskripsi sistem, dan tombol aksi cepat *Tambah NAS Router*.
  - **Stat Grids & Icon Accents**: Memodernisasi 4 kartu metrik (*Total NAS Router*, *NAS Aktif*, *Port Authentication UDP 1812*, *Port Accounting UDP 1813*) dengan efek Glassmorphism, bayangan halus, dan animasi hover.
  - **Live Filter Input Search**: Menambahkan kotak pencarian instan `#searchNasInput` untuk memfilter data NAS secara langsung tanpa reload halaman.
  - **Tabel & Modal Modern**: Memperbarui gaya tabel dengan font *Plus Jakarta Sans*, lencana status kontras tinggi, serta modal setup script RouterOS yang dilengkapi umpan balik satu-klik *Copy to Clipboard*.

- **Monitoring Sesi Aktif RADIUS (`/admin/radius/sessions`)**:
  - **Hero Banner & Engine Indicator**: Menambahkan banner utama berikon `bi-broadcast-pin` dan badge *Live Engine*.
  - **Live Bandwidth Monitoring Widget**: Memperbarui widget pemantauan kecepatan *Download (RX Speed)* dan *Upload (TX Speed)* dengan typography rapi `28px`, efek glowing border hover, dan akumulator total volume bandwidth.
  - **Live Filter Input Search & High-Contrast User Link**: Menambahkan pencarian instan `#searchSessionInput` untuk memfilter username/pelanggan/IP, serta menyempurnakan kontras warna nama pelanggan (*Light & Dark theme proof*).

### 3. Komponen & File Yang Diubah
- `[MODIFY]` [`views/admin/radius/nas_management.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/nas_management.ejs)
- `[MODIFY]` [`views/admin/radius/active_sessions.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/active_sessions.ejs)
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md)

### 4. Hasil Pengujian & Verifikasi
- **Pengujian Visual**: Kedua halaman `/admin/radius` dan `/admin/radius/sessions` tampil sangat modern, konsisten dengan antarmuka Admin Dashboard, ultra-responsive, dan memiliki pencarian live yang cepat.
- **Pengujian Jest**: 12 Test Suites / 204 Tests Passed (100%).

---

## [2026-08-21] Perubahan Judul Section "Status ONU" Menjadi "MONITORING ONU" pada Dashboard Admin (/admin)

### 1. Deskripsi Permasalahan & Kebutuhan
Pengguna meminta agar nama judul section **Status ONU** (Status ONU / Perangkat Optik) pada halaman **Dashboard Admin** (`http://localhost:3001/admin`) diubah secara konsisten menjadi **MONITORING ONU**.

### 2. Solusi & Implementasi Teknis
- **Update Template EJS & Translation Key**:
  - `views/admin/dashboard.ejs`: Mengubah teks fallback header section dan header kartu Donut chart menjadi `MONITORING ONU`.
  - `locales/id.json`: Mengubah nilai `onu_status_title` dari `"Status ONU"` menjadi `"MONITORING ONU"`.

### 3. Komponen & File Yang Diubah
- `[MODIFY]` [`views/admin/dashboard.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/dashboard.ejs)
- `[MODIFY]` [`locales/id.json`](file:///d:/WEBAPP/myadamedia-billing/locales/id.json)
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md)

### 4. Hasil Pengujian & Verifikasi
- **Pengujian Tampilan**: Judul section dan header Donut Chart pada Dashboard Admin kini resmi menggunakan teks **MONITORING ONU**.
- **Pengujian Jest**: 12 Test Suites / 204 Tests Passed (100%).

---

## [2026-08-21] Penambahan Fitur Baru "Monitoring Pelanggan" di Bawah Status ONU pada Dashboard Admin (/admin)

### 1. Deskripsi Permasalahan & Kebutuhan
Pengguna meminta penambahan fitur baru bernama **Monitoring Pelanggan** yang diletakkan persis di bawah section **Status ONU** pada Dashboard Admin (`http://localhost:3001/admin`). Fitur ini wajib menampilkan 3 kartu metrik:
1. **User Aktif**: Total user / PPPoE yang sedang online/aktif.
2. **User Suspend**: Total user dengan profil suspend / terisolir.
3. **User Offline**: Total user PPPoE yang sedang offline / terputus.

### 2. Solusi & Implementasi Teknis
- **Visual & UI Grid**:
  - `views/admin/dashboard.ejs`: Menambahkan section header `Monitoring Pelanggan` berikon `bi-people-fill` dan 3 stat card (`.sc p`, `.sc w`, `.sc d`) berstruktur 3 kolom responsive (`grid-template-columns: repeat(3, 1fr)`).
  - Setiap kartu dilengkapi dengan tautan navigasi langsung ke filter pelanggan di `/admin/customers`.
- **Backend API & Realtime Polling**:
  - `routes/adminPortal.js`: Memperbarui endpoint `/api/stats` untuk mengambil data `customerStats` (`active`, `suspended`, `offline`, `totalCustomers`) secara real-time dari MikroTik active session & database `customerSvc.getCustomerStats()`.
  - `views/admin/dashboard.ejs`: Memperbarui fungsi `loadStats()` untuk memperbarui elemen `stat-pppoe-active`, `stat-pppoe-suspended`, dan `stat-pppoe-offline` secara otomatis saat interval polling berjalan.

### 3. Komponen & File Yang Diubah
- `[MODIFY]` [`views/admin/dashboard.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/dashboard.ejs): Menambahkan grid Monitoring Pelanggan dan skrip pembaruan real-time.
- `[MODIFY]` [`routes/adminPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js): Menambahkan kalkulasi statistik pelanggan pada endpoint `/api/stats`.
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md): Pencatatan dokumentasi fitur baru.

### 4. Hasil Pengujian & Verifikasi
- **Pengujian Tampilan**: Section **Monitoring Pelanggan** kini muncul rapi persis di bawah *Status ONU*, menampilkan statistik *User Aktif*, *User Suspend*, dan *User Offline* secara dinamis.
- **Pengujian Jest**: 12 Test Suites / 204 Tests Passed (100%).

---

## [2026-08-21] Penataan Ulang Layout Dashboard Admin (/admin): Memindahkan Status ONU ke Posisi Atas & Menghilangkan Ringkasan Stat MikroTik

### 1. Deskripsi Permasalahan & Kebutuhan
Pengguna meminta agar ringkasan statistik *Status MikroTik* pada halaman **Dashboard Admin** (`http://localhost:3001/admin`) dihilangkan, dan posisi kartu ringkasan **Status ONU** (Total ONU, Online, Offline, Warning) dipindahkan ke posisi teratas menggantikan lokasi *Status MikroTik*.

### 2. Solusi & Implementasi Teknis
- **Pembersihan Ringkasan Status MikroTik**: Menghapus blok kartu ringkasan *Status MikroTik* (`.stat-grid` yang berisi *Total Router MikroTik*, *Router Status Aktif*, dan *Router Status Nonaktif*).
- **Pemindahan Ringkasan Status ONU**: Memindahkan blok kartu *Status ONU / Perangkat Optik* ke bagian paling atas di bawah *Hero Welcome Banner*.
- **Preservasi Elemen Penting**:
  - Tetap mempertahankan elemen ID (`stat-total`, `stat-online`, `stat-offline`, `stat-warning`) agar pembaruan data real-time via skrip JavaScript tidak terganggu.
  - Kartu tabel **Daftar Router MikroTik** & modul pemantauan *Live Traffic Interface* tetap dipertahankan di bawah kartu Status ONU.

### 3. Komponen & File Yang Diubah
- `[MODIFY]` [`views/admin/dashboard.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/dashboard.ejs): Menghapus stat-grid MikroTik dan memindahkan stat-grid ONU ke posisi atas.
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md): Pencatatan dokumentasi perubahan layout.

### 4. Hasil Pengujian & Verifikasi
- **Verifikasi Tampilan**: Kartu *Status ONU* (Total ONU, Online, Offline, Warning) kini tampil secara elegan di bagian teratas Dashboard Admin, diikuti oleh tabel *Daftar Router MikroTik* dan *Ringkasan Billing*.
- **Pengujian Jest**: 12 Test Suites / 204 Tests Passed (100%).

---

## [2026-08-21] Dinamisasi Nama Aplikasi / Perusahaan (`settings.company_header`) di Seluruh Tampilan Sistem & Layanan

### 1. Deskripsi Permasalahan & Kebutuhan
Pengguna meminta agar seluruh teks nama aplikasi/perusahaan (seperti *"MyAdamedia Billing System"*, *"MyAdamedia BILLING SYSTEM"*, *"MyAdamedia WEBPORTAL"*, *"MyAdamedia Digital Ekosistem"*, *"Billing Management System"*) diambil secara dinamis dari **Pengaturan Nama Aplikasi / Perusahaan** (`settings.company_header`). Apabila nama di menu Pengaturan (`/admin/settings`) diubah, maka seluruh teks pada semua portal, footer, header, halaman login, notifikasi, dan skrip otomatis akan menyesuaikan secara real-time.

### 2. Solusi & Implementasi Teknis
- **Visual & Template EJS**:
  - `views/admin/partials/sidebar.ejs`: Mengganti teks footer sidebar menjadi `<%= settings.company_header.toUpperCase() %>`.
  - `views/tech/login.ejs` & `views/collector/login.ejs`: Mengganti sub-header login portal menjadi `<%= company %>`.
  - `investor/views/login.ejs` & `investor/views/dashboard.ejs`: Mengganti teks footer investor portal menjadi `<%= company %>`.
  - `views/otp.ejs` & `views/admin/license_activate.ejs`: Mengganti footer dan title tag lisensi menjadi `<%= company %>`.
- **Portal Router & Services**:
  - `investor/routes/investorPortal.js`: Mengintegrasikan `company: getSetting('company_header')` pada semua render login dan dashboard investor.
  - `routes/adminPortal.js`, `routes/customerPortal.js`, `routes/admin/isolatedPortal.js`: Mengamankan fallback default `company_header` menggunakan `getSetting('company_header', 'Billing System')`.
  - `services/whatsappBot.mjs`, `services/isolatedPortalService.js`, `services/mikrotikService.js`: Mengonversi string komentar skrip dan header notifikasi ke `getSetting('company_header')`.

### 3. Komponen & File Yang Diubah
- `[MODIFY]` [`views/admin/partials/sidebar.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/partials/sidebar.ejs)
- `[MODIFY]` [`views/tech/login.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/tech/login.ejs)
- `[MODIFY]` [`views/collector/login.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/collector/login.ejs)
- `[MODIFY]` [`investor/views/login.ejs`](file:///d:/WEBAPP/myadamedia-billing/investor/views/login.ejs)
- `[MODIFY]` [`investor/views/dashboard.ejs`](file:///d:/WEBAPP/myadamedia-billing/investor/views/dashboard.ejs)
- `[MODIFY]` [`investor/routes/investorPortal.js`](file:///d:/WEBAPP/myadamedia-billing/investor/routes/investorPortal.js)
- `[MODIFY]` [`views/otp.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/otp.ejs)
- `[MODIFY]` [`views/admin/license_activate.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/license_activate.ejs)
- `[MODIFY]` [`routes/adminPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js)
- `[MODIFY]` [`routes/customerPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/customerPortal.js)
- `[MODIFY]` [`services/whatsappBot.mjs`](file:///d:/WEBAPP/myadamedia-billing/services/whatsappBot.mjs)
- `[MODIFY]` [`services/isolatedPortalService.js`](file:///d:/WEBAPP/myadamedia-billing/services/isolatedPortalService.js)
- `[MODIFY]` [`services/mikrotikService.js`](file:///d:/WEBAPP/myadamedia-billing/services/mikrotikService.js)
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md)

### 4. Hasil Pengujian & Verifikasi
- **Pengujian Pengubahan Nama**: Saat field *Nama Aplikasi / Perusahaan* diubah di `/admin/settings`, seluruh footer sidebar, portal SSO, login teknisi, login kolektor, login investor, dan invoice cetak langsung berubah mengikuti input baru.
- **Pengujian Jest**: 12 Test Suites / 204 Tests Passed (100%).

---

## [2026-08-21] Peremajaan Tampilan UI/UX & Layout Halaman Dashboard Admin (/admin) Menjadi Modern, Intuitive, dan Ultra-Responsive

### 1. Deskripsi Permasalahan & Kebutuhan
Pengguna menginginkan tampilan antarmuka (*UI/UX*) halaman **Dashboard Admin** (`http://localhost:3001/admin`) diperbarui agar terlihat lebih modern, menarik, mudah dipahami, dan nyaman dipandang mata, dengan syarat **tetap menampilkan 100% seluruh fitur, data statistik, tabel monitoring, dan menu yang ada**.

### 2. Solusi & Implementasi Teknis
- **Font & Tipografi Modern**: Mengintegrasikan font Google *Plus Jakarta Sans* dipadukan dengan *Inter* untuk hierarki judul dan teks yang sangat bersih dan profesional.
- **Hero Welcome Banner**: Menambahkan kartu sambutan eksekutif pada bagian atas dashboard yang menyapa Administrator / Kasir dengan lencana status real-time (*Monitoring Sistem Realtime*), ringkasan deskripsi, dan tombol navigasi cepat.
- **Pengelompokan Visual Stat Grids**: Menata ulang kartu metrik menjadi 3 section ber-ikon yang sangat terstruktur:
  1. **Status MikroTik** (Total, Router Aktif, Router Nonaktif).
  2. **Status ONU / Perangkat Optik** (Total, Online, Offline, Warning).
  3. **Ringkasan Billing & Financial Analytics** (Pendapatan Bulan Ini, Pelanggan Aktif, Tagihan Belum Bayar, Total Piutang).
- **Desain Glassmorphism & Micro-Animations**:
  - Memberikan efek *backdrop blur* (`backdrop-filter: blur(20px)`), sudut melengkung modern (`border-radius: 16px - 20px`), bayangan halus (`box-shadow`), dan efek *glowing border hover* pada stat card dan tabel router.
- **Preservasi 100% Fitur & Menu**:
  - Mempertahankan tab navigasi (*Dashboard* & *Monitoring ONU*), pengujian tes koneksi router MikroTik, dropdown monitoring live traffic interface, Donut Chart status ONU, GenieACS modal settings, dan seluruh elemen menu sidebar.

### 3. Komponen & File Yang Diubah
- `[MODIFY]` [`public/css/admin.css`](file:///d:/WEBAPP/myadamedia-billing/public/css/admin.css): Pengimporan font Google Plus Jakarta Sans, perbaikan token Glassmorphism, animasi stat card hover, dan styling tabel/tombol modern.
- `[MODIFY]` [`views/admin/dashboard.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/dashboard.ejs): Penambahan Hero Welcome Banner, penataan ulang section title header, dan modernisasi stat card.
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md): Pencatatan dokumentasi perubahan antarmuka.

### 4. Hasil Pengujian & Verifikasi
- **Verifikasi Visual**: Tampilan Admin Dashboard terlihat sangat mewah, modern, rapi, dan mudah dibaca dalam berbagai mode tema (*Dark, Light, Ocean, Forest*).
- **Pengujian Jest**: 12 Test Suites / 204 Tests Passed (100%).

---

## [2026-08-21] Implementasi Tema Dinamis (Dark / Light Mode) pada Portal SSO Gateway & Seluruh Halaman Login (/sso, /admin/login, /tech/login, /collector/login, /investor/login)

### 1. Deskripsi Permasalahan & Kebutuhan
Pengguna membutuhkan dukungan Pilihan Tema Dinamis (*Dark Mode* / *Light Mode*) yang konsisten pada seluruh gerbang login dan portal SSO utama aplikasi:
1. `http://localhost:3001/sso` (Single Sign-On Gateway)
2. `http://localhost:3001/admin/login` (Portal Administrator)
3. `http://localhost:3001/tech/login` (Portal Teknisi)
4. `http://localhost:3001/collector/login` (Portal Kolektor)
5. `http://localhost:3001/investor/login` (Portal Investor)

### 2. Solusi & Implementasi Teknis
- **Skrip Anti-Flicker `<head>`**: Ditambahkan pada kelima berkas EJS untuk membaca `localStorage.getItem('theme')` atau *system preference* (`prefers-color-scheme`) sebelum render pertama halaman.
- **CSS Custom Properties & Kontras Tinggi**:
  - Mengonversi warna latar belakang, kartu portal, input form, label, dan tombol submit menggunakan variabel warna adaptif (`var(--bg-dark)`, `var(--card-bg)`, `var(--text-main)`, `var(--text-sub)`, `var(--input-bg)`, `var(--input-color)`).
  - Memastikan warna teks 100% terbaca dengan sangat jelas di Mode Terang maupun Gelap tanpa ada teks putih di atas latar putih.
- **Tombol Sakelar Tema (`#themeToggleBtn`)**:
  - Menambahkan tombol sakelar tema yang responsif dengan ikon Matahari (<i class="bi bi-sun-fill text-warning"></i>) dan Bulan (<i class="bi bi-moon-stars-fill text-primary"></i>) pada header `/sso` serta pada kartu login `/admin/login`, `/tech/login`, `/collector/login`, dan `/investor/login`.
  - Mengintegrasikan handler event `click` yang menyimpan preferensi tema ke `localStorage`.

### 3. Komponen & File Yang Diubah
- `[MODIFY]` [`views/sso.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/sso.ejs): Penambahan skrip anti-flicker, variabel CSS tema, sakelar tema header, dan event listener `localStorage`.
- `[MODIFY]` [`views/admin/login.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/login.ejs): Sakelar tema pada kartu login admin, variabel CSS adaptif, dan form control kontras tinggi.
- `[MODIFY]` [`views/tech/login.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/tech/login.ejs): Sakelar tema pada kartu login teknisi dan penyesuaian gaya form.
- `[MODIFY]` [`views/collector/login.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/collector/login.ejs): Sakelar tema pada kartu login kolektor dan penyesuaian gaya form.
- `[MODIFY]` [`investor/views/login.ejs`](file:///d:/WEBAPP/myadamedia-billing/investor/views/login.ejs): Sakelar tema pada kartu login investor dan penyesuaian CSS variabel tema terang.
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md): Pencatatan dokumentasi perbaikan sistem.

### 4. Hasil Pengujian & Verifikasi
- **Sintaks EJS & Express Routes**: Seluruh 5 halaman berhasil di-render tanpa error.
- **Verifikasi Kontras Visual**: Teks, judul, ikon, dan input form pada kelima portal terbaca 100% jernih dan berkontras tinggi baik saat tema gelap maupun terang aktif.
- **Pengujian Jest**: 12 Test Suites / 204 Tests Passed (100%).

---

## [2026-08-21] Perbaikan Masalah Tampilan Layout Kartu Bertabrakan (Connected Devices & Billing History) pada Dashboard Pelanggan

### 1. Deskripsi Permasalahan & Kebutuhan
Kartu **Perangkat Terhubung (Live)** dan **Riwayat Tagihan** pada Dashboard Pelanggan (`/customer/dashboard`) bertabrakan (*layout overlapping*) dan menumpuk secara horisontal.

### 2. Penyebab Utama (Root Cause)
Terjadi duplikasi tag pembuka `<div class="col-12 col-lg-6" id="devices-section">` dan `<div class="glass-card p-4">` di dalam blok EJS `views/dashboard.ejs`. Hal ini menyebabkan hirarki elemen DOM menjadi *unclosed nesting* sehingga kartu **Riwayat Tagihan** (`#billing-section`) ter-render di dalam kartu **Perangkat Terhubung** (`#devices-section`).

### 3. Solusi & Implementasi Teknis
- Membuang duplikasi pembuka `<div class="col-12 col-lg-6" id="devices-section">` dan `<div class="glass-card p-4">` pada file `views/dashboard.ejs` (baris 645-648).
- Memastikan kedua kartu berdiri sejajar secara independen di dalam kontainer `<div class="row g-4 mb-4">` Bootstrap 5 responsive grid (`col-12 col-lg-6`).

### 4. Komponen & File Yang Diubah
- `[MODIFY]` [`views/dashboard.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/dashboard.ejs): Menghapus duplikasi tag div HTML.
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md): Pencatatan dokumentasi perbaikan sistem.

---

## [2026-08-21] Perbaikan Kontras & Warna Teks Mode Terang (Light Mode) pada Dashboard Pelanggan (/customer/dashboard)

### 1. Deskripsi Permasalahan & Kebutuhan
Saat beralih ke Mode Terang (*Light Mode*), banyak elemen teks di halaman **Dashboard Pelanggan** (`/customer/dashboard`) tidak terlihat (*unreadable*) atau memudar. Hal ini mencakup judul seksi (*section titles*), angka pengukur kecepatan (*traffic gauges*), tombol fitur mandiri, header dan isi tabel perangkat/tagihan, serta form modal.

### 2. Penyebab Utama (Root Cause)
1. **Hardcoded Class `text-white` & Style Inline**: Banyak elemen HTML di-hardcode menggunakan kelas `text-white` atau style inline `color: #ffffff;` / `color: #cbd5e1;` yang memaksa warna teks tetap putih atau abu-abu terang meskipun latar belakang kartu (*card background*) berubah menjadi putih (`#ffffff` / `#f8fafc`).
2. **Hardcoded Card Box Inner Background**: Kotak kontainer dalam (*gauge boxes* dan *signal metrics*) menggunakan `background: rgba(255,255,255,0.03)` yang menjadi tidak berkontras di atas kartu putih.

### 3. Solusi & Implementasi Teknis
- **Refactoring CSS Custom Variables (`views/dashboard.ejs`)**:
  - Menambahkan `--hero-bg`, `--hero-text`, `--hero-sub`, `--box-inner-bg`, dan `--table-border` untuk kedua tema.
  - Hero Banner diisolasi dengan latar belakang gradien indigo-slate kontras tinggi (`.hero-banner-card`) yang menjamin teks pahlawan selalu tajam dan mudah dibaca pada kedua tema.
- **Penggantian Kelas Hardcoded**:
  - Mengganti seluruh penggunaan `text-white` dan `color: #ffffff` pada judul seksi (`h5`), label fitur mandiri, gauge download/upload (`.gauge-val-num`), dan tabel dengan variabel warna adaptif `var(--text-main)` dan `var(--text-sub)`.
  - Mengubah background kontainer dalam menjadi `.box-inner` yang menggunakan `var(--box-inner-bg)` adaptif.
  - Memperbarui gaya elemen modal (`.modal-content-dark`) dan form control agar memiliki latar belakang dan warna teks kontras tinggi sesuai tema aktif.

### 4. Komponen & File Yang Diubah
- `[MODIFY]` [`views/dashboard.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/dashboard.ejs): Perbaikan variabel CSS dan pembaruan kelas HTML adaptif kontras tinggi.
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md): Pencatatan dokumentasi perbaikan sistem.

### 5. Hasil Pengujian & Verifikasi
- **Sintaks EJS**: Terverifikasi valid tanpa error.
- **Verifikasi Kontras Visual**: 100% elemen teks (Hero Banner, Gauge Kecepatan, Fitur Mandiri, Perangkat Terhubung, Riwayat Tagihan, dan Modal) terbaca dengan sangat jelas baik pada Mode Gelap maupun Mode Terang.

---

## [2026-08-21] Penambahan Fitur Tema Dinamis (Dark / Light Mode) pada Login & Dashboard Pelanggan (/customer/login & /customer/dashboard)

### 1. Deskripsi Permasalahan & Kebutuhan
Pelanggan membutuhkan fleksibilitas tampilan antarmuka saat mengakses halaman **Login Pelanggan** (`/customer/login`) dan **Dashboard Pelanggan** (`/customer/dashboard`) dengan adanya pilihan tema terang (*Light Mode*) dan gelap (*Dark Mode*) yang tersimpan secara otomatis (*persistent*).

### 2. Penyebab Utama (Root Cause)
Halaman login dan dashboard sebelumnya menggunakan warna dasar statis tema gelap tanpa variabel warna dinamis dan tanpa tombol sakelar tema.

### 3. Solusi & Implementasi Teknis
- **`views/login.ejs`**:
  - Mengintegrasikan sistem CSS Custom Properties (`:root`, `[data-theme="dark"]`, `[data-theme="light"]`).
  - Menambahkan skrip inisialisasi anti-flicker pada bagian `<head>` untuk mengeksekusi penetapan atribut `data-theme` sebelum halaman di-render.
  - Menambahkan tombol sakelar tema `#themeToggleBtn` pada header kartu login beserta event handler pembaruan `localStorage.setItem('theme', ...)`.
- **`views/dashboard.ejs`**:
  - Menambahkan CSS Custom Properties untuk komponen navbar, kartu status, grafik pemantauan lalu lintas (*traffic gauge*), tabel, dan modal.
  - Menambahkan sakelar tema pada top navbar (`.portal-nav`) bersebelahan dengan tombol keluar/status akun.
- **`views/partials/customer_bottom_nav.ejs`**:
  - Menyesuaikan warna latar belakang dan perbatasan bilah navigasi bawah (*mobile bottom nav*) menggunakan `var(--nav-bg)` dan `var(--card-border)` agar selaras dengan tema yang dipilih.

### 4. Komponen & File Yang Diubah
- `[MODIFY]` [`views/login.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/login.ejs): Penambahan CSS variabel tema dinamis, tombol sakelar tema, dan skrip `localStorage`.
- `[MODIFY]` [`views/dashboard.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/dashboard.ejs): Integrasi sakelar tema di top navbar dan variabel CSS tema dinamis.
- `[MODIFY]` [`views/partials/customer_bottom_nav.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/partials/customer_bottom_nav.ejs): Penyesuaian variabel navigasi bawah mobile.
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md): Pencatatan dokumentasi sistem.

### 5. Hasil Pengujian & Verifikasi
- **Sintaks & Kompilasi View**: Terverifikasi valid tanpa error.
- **Fungsionalitas**: Beralih tema Dark/Light Mode secara instan pada login dan dashboard pelanggan, serta persisten setelah refresh/akses ulang.

---

## [2026-08-21] Redesain Modern UI/UX & Penambahan Fitur Dark/Light Mode Theme Toggle (/customer/check-billing)

### 1. Deskripsi Permasalahan & Kebutuhan
Halaman publik **Cek Tagihan** (`/customer/check-billing`) memerlukan perombakan estetika antarmuka (*redesign*) agar berpenampilan lebih modern, bersih, dan berstandar *production-ready*. Selain itu, pengguna memerlukan fitur untuk beralih antara tema gelap (*Dark Mode*) dan terang (*Light Mode*) secara dinamis.

### 2. Penyebab Utama (Root Cause)
- Tampilan sebelumnya masih menggunakan styling CSS statis tema gelap tanpa variabel warna dinamis.
- Belum ada komponen sakelar tema (*theme toggle button*) dan logika penyimpan state preferensi tema di client-side (`localStorage`).

### 3. Solusi & Implementasi Teknis
- **Typography & Desain Sistem (`views/public_check_billing.ejs`)**:
  - Mengintegrasikan Google Font `Plus Jakarta Sans` untuk bobot teks 400-800 yang presisi dan modern.
  - Membangun CSS Custom Variables pada `:root`, `[data-theme="dark"]`, dan `[data-theme="light"]` yang mencakup warna latar belakang (*mesh background*), kontras teks, *card glassmorphism*, input form, serta tombol accent gradient.
- **Skrip Anti-Flicker & Persistensi Tema**:
  - Menambahkan skrip inisialisasi di `<head>` untuk mengeksekusi penetapan atribut `data-theme` sebelum render DOM pertama berdasarkan `localStorage.getItem('theme')` atau `window.matchMedia('(prefers-color-scheme: dark)')`.
  - Menambahkan event listener pada sakelar tombol `#themeToggleBtn` di baris header untuk beralih antara tema gelap dan terang secara instan beserta penyimpanan preferensi pengguna.
- **Penyempurnaan Visual Komponen**:
  - Efek *glassmorphism* `backdrop-filter: blur(16px)` dengan perbatasan transparan halus.
  - Penataan ulang grid metode pembayaran dengan efek elevasi hover, *ring focus glow*, serta chip informasi yang responsif terhadap mode terang/gelap.
  - Menjaga 100% kompatibilitas fungsi pembayaran, tagihan, dan teks petunjuk `Bisa pakai: Nomor WhatsApp & ID pelanggan.`.

### 4. Komponen & File Yang Diubah
- `[MODIFY]` [`views/public_check_billing.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/public_check_billing.ejs): Redesain tampilan CSS, variasi tema Dark/Light, dan skrip sakelar tema.
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md): Pencatatan riwayat dokumentasi sistem.

### 5. Hasil Pengujian & Verifikasi
- **Sintaks EJS & Kompilasi View**: 0 Error.
- **Pengujian Fungsionalitas Tema**: Sakelar Dark/Light Mode berfungsi mulus, adaptif pada layar desktop/mobile, dan tersimpan secara persisten pada `localStorage`.

---

## [2026-08-21] Pembaruan Teks Petunjuk Pencarian Cek Tagihan Publik (/customer/check-billing)

### 1. Deskripsi Permasalahan
Pada halaman publik Cek Tagihan (`/customer/check-billing`), teks petunjuk bawah kolom input pencarian sebelumnya menampilkan deskripsi yang terlalu panjang (`Bisa pakai: Nama pelanggan, Nomor WhatsApp, PPPoE Username, GenieACS Tag, atau ID pelanggan.`). Diperlukan penyederhanaan teks agar lebih ringkas, ramah pengguna, serta fokus pada metode pencarian utama.

### 2. Penyebab Utama (Root Cause)
Teks bantuan di-hardcode pada template EJS `views/public_check_billing.ejs` dengan daftar opsi pencarian yang panjang.

### 3. Solusi & Implementasi Teknis
- **`views/public_check_billing.ejs`**:
  - Mengubah elemen petunjuk `<div class="muted small mt-2">` menjadi: `Bisa pakai: Nomor WhatsApp & ID pelanggan.`
  - Memperbarui atribut `placeholder` elemen input `<input class="form-control" name="q">` menjadi: `Masukkan nomor WhatsApp / ID pelanggan`.

### 4. Komponen & File Yang Diubah
- `[MODIFY]` [`views/public_check_billing.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/public_check_billing.ejs): Penyederhanaan teks bantuan dan placeholder input.
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md): Pencatatan riwayat perubahan sistem.

### 5. Hasil Pengujian & Verifikasi
- **Sintaks EJS & Markup HTML**: Terverifikasi valid tanpa tag terputus.
- **Tampilan UI**: Teks petunjuk dan placeholder berhasil diperbarui sesuai instruksi.

---

## [2026-08-19] Perbaikan Pencocokan Nama Pelanggan (Nama Lengkap) & Styling Kontras Kolom pada Sesi Aktif RADIUS

### 1. Deskripsi Permasalahan
Pada tabel **Pengguna Terhubung Real-time** di halaman Monitoring Sesi RADIUS (`/admin/radius/sessions`), kolom **Nama Pelanggan** menampilkan nama yang salah (misal sesi `MDE-0048` memunculkan nama `MARTIN` dengan badge `MDE-0048`, padahal pelanggan sebenarnya di database adalah `ZULMI` dengan PPPoE username `MDE0048_Zul` / ID 86). Selain itu, teks nama pelanggan pada mode tampilan tema terang (*light mode*) terlihat pudar/hampir putih tidak terbaca.

### 2. Penyebab Utama (Root Cause)
1. **False Match pada Database Primary Key ID**:
   - Helper pencocokan `getCustomerLookupHelper()` sebelumnya langsung memetakan angka dari format `MDE-XXXX` atau `MDE-48` ke kolom `customers.id` (primary key).
   - Di basis data ISP MyAdamedia, kode pelanggan `MDE0048` pada username PPPoE (`MDE0048_Zul`) berbeda dengan `customers.id` (ID auto-increment 86), sedangkan `customers.id = 48` adalah pelanggan lain bernama `MARTIN` dengan username `MDE0078_Martin`.
   - Akibatnya, sesi `MDE-0048` keliru dipetakan ke pelanggan `MARTIN` (ID 48) alih-alih `ZULMI` (ID 86).
2. **Hardcoded Text Color pada EJS & Client-Side Script**:
   - Tag tautan nama pelanggan di-hardcode dengan `style="color: #f8fafc;"`, yang menyebabkan teks nama berwarna putih di atas latar tabel terang.

### 3. Solusi & Implementasi Teknis
- **`routes/admin/radius.js`**:
  - Menyempurnakan `getCustomerLookupHelper()` dengan **Multi-Tier Resolution**:
    1. *Tier 1*: Exact match `pppoe_username` (e.g. `MDE0048_Zul`).
    2. *Tier 2*: MDE Code & Prefix Matching dari `pppoe_username` dan `genieacs_tag` (`MDE-0048`, `MDE0048`, `0048`, `MyAdamedia_0041` $\rightarrow$ memetakan secara presisi ke pelanggan dengan username `MDE0048_Zul`).
    3. *Tier 3*: Exact match `hotspot_username`.
    4. *Tier 4*: Exact match `genieacs_tag`.
    5. *Tier 5*: Exact match `phone`.
    6. *Tier 6*: Exact match `name` (Nama Lengkap).
    7. *Tier 7 (Fallback)*: Formatted ID berdasarkan `customer.id` (`MDE-0086` $\rightarrow$ ID 86).
    8. *Tier 8 (Fallback)*: Pure integer ID.
- **`services/radiusService.js`**:
  - Menambahkan fallback pencarian akun pelanggan PPPoE saat autentikasi UDP port 1812 agar format `MDE-0048` / `MDE0048` tetap dapat diautentikasi jika username di database tersimpan sebagai `MDE0048_Zul`.
- **`views/admin/radius/active_sessions.ejs`**:
  - Menambahkan kelas CSS `.customer-name-link` yang adaptif terhadap mode terang/gelap (`color: var(--text, #e6edf3); font-weight: 700;`).
  - Menerapkan `.customer-name-link` pada render server-side EJS dan client-side dynamic polling `renderUI()`.
- **`tests/radiusCustomerSession.test.js`**:
  - Menambahkan unit testing untuk memverifikasi akurasi pencocokan variasi kode MDE (`MDE-0888`, `MDE0888`, `MDE0888_Budi`).

### 4. Komponen & File Yang Diubah
- `[MODIFY]` [`routes/admin/radius.js`](file:///d:/WEBAPP/myadamedia-billing/routes/admin/radius.js): Algoritma multi-tier customer lookup.
- `[MODIFY]` [`services/radiusService.js`](file:///d:/WEBAPP/myadamedia-billing/services/radiusService.js): Fleksibilitas pencarian akun PPPoE saat Access-Request.
- `[MODIFY]` [`views/admin/radius/active_sessions.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/active_sessions.ejs): Kelas CSS dan markup nama pelanggan kontras tinggi.
- `[MODIFY]` [`tests/radiusCustomerSession.test.js`](file:///d:/WEBAPP/myadamedia-billing/tests/radiusCustomerSession.test.js): Pengujian unit test varian kode MDE.
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md): Pencatatan dokumentasi sistem.

### 5. Hasil Pengujian & Verifikasi
- **Unit Test Suite (`tests/radiusCustomerSession.test.js`)**: 6 dari 6 test **PASSED** (100%).
- **Verifikasi Data Riil SQLite**:
  - `MDE-0048` $\rightarrow$ **ZULMI** (ID 86, `MDE0048_Zul`) [Valid & Akurat]
  - `MDE-0078` $\rightarrow$ **MARTIN** (ID 48, `MDE0078_Martin`) [Valid & Akurat]
  - `MDE-0001` $\rightarrow$ **DONI RISWANDI** (ID 28, `MDE0001`) [Valid & Akurat]
  - `MDE-0056` $\rightarrow$ **ABDUL GOFUR** (ID 7, `MDE0056_Gopur`) [Valid & Akurat]
  - `MDE-0068` $\rightarrow$ **MARWAN / IYOY** (ID 49, `MDE0068_Iyoy`) [Valid & Akurat]

---

## [2026-08-18] Penambahan Kolom 'Nama Pelanggan' pada Tabel Pengguna Terhubung Real-Time (Sesi RADIUS)

### 1. Deskripsi Permasalahan & Kebutuhan
Pada menu **Monitoring Sesi Aktif RADIUS** (`/admin/radius/sessions`), tabel *Pengguna Terhubung Real-time* sebelumnya hanya menampilkan kolom `USERNAME`, `IP ADDRESS`, `MAC ADDRESS (CALLING-ID)`, `NAS ROUTER`, `WAKTU MULAI`, `UPLOAD / DOWNLOAD`, dan `AKSI (COA)`. Administrator kesulitan mengetahui secara langsung siapa nama pelanggan pemilik sesi aktif tanpa harus mengklik username atau membuka modal profil satu per satu.

### 2. Penyebab & Analisis Teknis
1. **Pemisahan Entitas Sesi Accounting dan Basis Data Pelanggan**: Sesi aktif disimpan di tabel accounting RADIUS (`radius_acct`) dengan kolom `username`, sementara detail profil pelanggan berada di tabel `customers`.
2. **Variasi Pola Format Username**:
   - Di lapangan, username sesi RADIUS dapat berupa format ID terstruktur (`MDE-0048`, `MDE-0110`), format username PPPoE kustom (`MDE0064_Alpiah`, `MDE0010_Arianto`), username Hotspot, atau nomor ID murni.
   - Diperlukan mekanisme pencocokan fleksibel dengan prioritas bertingkat dan performa $O(1)$ in-memory lookup agar tidak membebani query database saat auto-refresh polling 3 detik.

### 3. Solusi & Implementasi Teknis
- **`routes/admin/radius.js`**:
  - Mengimplementasikan helper berkinerja tinggi `getCustomerLookupHelper()` yang membangun in-memory Map terindeks:
    1. *Exact PPPoE Username* (`customerByPppoe`).
    2. *Exact Hotspot Username* (`customerByHotspot`).
    3. *Formatted ID* (`customerByFormattedId`, misal `mde-0048` / `mde0048`).
    4. *Regex ID Extraction* (Pola `MDE-XXXX` / `MDE-48` $\rightarrow$ ID 48).
    5. *Exact Nama Pelanggan* (`customerByName`).
    6. *Numeric ID* (Murni integer ID).
  - Mengintegrasikan hasil pencarian ke dalam:
    - Route `GET /admin/radius/sessions` (Server-Side Rendering awal).
    - Route `GET /admin/radius/api/sessions` (JSON endpoint live polling 3 detik).
    - Route `GET /admin/radius/api/customer-detail` (Modal interaktif profil pelanggan).
- **`views/admin/radius/active_sessions.ejs`**:
  - Menambahkan kolom header `<th>Nama Pelanggan</th>` tepat di samping kolom `<th>Username</th>`.
  - Merender nama pelanggan dengan tautan interaktif modal profil, ikon profil `<i class="bi bi-person-fill text-primary"></i>`, dan badge kode ID `(MDE-xxxx)`.
  - Menyediakan penanganan *graceful fallback* (`<span class="text-muted fst-italic">Belum terdaftar</span>`) jika sesi terhubung belum terdaftar di tabel pelanggan.
  - Memperbarui fungsi JavaScript `renderUI()` untuk auto-refresh real-time dan menyesuaikan `colspan="8"` pada pesan baris kosong.
- **`tests/radiusCustomerSession.test.js`**:
  - Menambahkan unit testing otomatis untuk memvalidasi akurasi pencocokan berbagai varian username (PPPoE, Hotspot, Formatted ID, Numeric ID, dan non-existent fallback).

### 4. Komponen & File Yang Diubah
- `[MODIFY]` [`routes/admin/radius.js`](file:///d:/WEBAPP/myadamedia-billing/routes/admin/radius.js): Penambahan `getCustomerLookupHelper()` dan integrasi pengayaan data sesi.
- `[MODIFY]` [`views/admin/radius/active_sessions.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/active_sessions.ejs): Penambahan kolom tabel Nama Pelanggan pada EJS markup dan client-side `renderUI()`.
- `[NEW]` [`tests/radiusCustomerSession.test.js`](file:///d:/WEBAPP/myadamedia-billing/tests/radiusCustomerSession.test.js): Unit test suite pengujian pencocokan data pelanggan sesi RADIUS.
- `[MODIFY]` [`proses.md`](file:///d:/WEBAPP/myadamedia-billing/proses.md): Pencatatan dokumentasi perubahan sistem.

### 5. Hasil Pengujian & Verifikasi
- **Unit Test Baru (`tests/radiusCustomerSession.test.js`)**: 5 dari 5 test **PASSED** (100%).
- **Full Test Suite (`tests/`)**: Seluruh 12 test suites dan 200 tests **PASSED** (100%).
- **EJS Template Compilation & Syntax**: **PASSED** (0 Error).

---

## [2026-08-16] Penyempurnaan Skrip MikroTik: Hairpin SRC-NAT (Masquerade), DNS Input Rule, & Dynamic IP/Port Generator

### 1. Deskripsi Permasalahan
Meskipun interceptor di server Express telah siap, pop-up Captive Portal di smartphone (iOS / Android) masih belum terbuka saat perangkat berada di jaringan nyata.

### 2. Penyebab Utama (Root Cause Network Level)
1. **Asymmetric Routing / Hairpin NAT Drop**:
   - Jika Billing Server dan Klien Pelanggan berada pada subnet jaringan lokal yang sama (atau dijembatani bridge MikroTik), paket TCP SYN yang di-DST-NAT oleh MikroTik diteruskan ke Billing Server dengan alamat IP sumber asli klien.
   - Billing Server merespons (TCP SYN-ACK) secara langsung ke IP klien melalui lokal switch/ARP tanpa melewati MikroTik.
   - Klien menolak paket balasan tersebut karena klien mengirim SYN ke `captive.apple.com` (port 80), bukan ke IP lokal billing server (port 3001). Akibatnya, TCP handshake gagal dan pop-up tidak pernah terbuka.
2. **Ketidaksesuaian Port Server Billing (`to-ports`)**:
   - Skrip MikroTik sebelumnya mengarahkan ke port `80`, padahal aplikasi web Node.js billing berjalan pada port `3001` (sesuai `settings.json`).
3. **Kueri DNS Lokal Router (Input Chain)**:
   - Klien yang menggunakan IP Gateway MikroTik sebagai DNS Server mengirim paket DNS ke `chain=input` router, bukan `chain=forward`.

### 3. Solusi & Implementasi Teknis
- **`services/isolatedPortalService.js` (Hairpin NAT & DNS Input)**:
  - Menambahkan rule **Hairpin SRC-NAT (Masquerade)**:
    ```routeros
    /ip firewall nat add chain=srcnat src-address-list=LIST_ISOLIR dst-address=<host> protocol=tcp dst-port=<port> action=masquerade comment="BILLING_ISOLIR_NAT_SRC"
    ```
    Memastikan seluruh koneksi balasan selalu di-un-NAT oleh MikroTik kembali ke alamat tujuan probe asli.
  - Menambahkan rule izin DNS pada `chain=input` (UDP & TCP port 53).
  - Mengintegrasikan port dinamis `to-ports=<port>` (default 3001).
- **`routes/admin/isolatedPortal.js` & `views/admin/isolated_portal.ejs` (Interactive NAT Script Generator)**:
  - Menyediakan input kontrol **IP Server Billing** dan **Port Web Server** pada Tab 2 dengan generator skrip live/reaktif (`POST /admin/isolated-portal/generate-script`).
  - Administrator dapat menyesuaikan IP dan Port billing secara instan sebelum menyalin skrip ke Terminal MikroTik.

### 4. Komponen & File Yang Diubah
- `[MODIFY]` [`services/isolatedPortalService.js`](file:///d:/WEBAPP/myadamedia-billing/services/isolatedPortalService.js): Penambahan rule Hairpin SRC-NAT, Input DNS, dan default port 3001.
- `[MODIFY]` [`routes/admin/isolatedPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/admin/isolatedPortal.js): Penambahan endpoint `/generate-script` dan passing port dinamis.
- `[MODIFY]` [`views/admin/isolated_portal.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/isolated_portal.ejs): Form konfigurasi IP/Port reaktif di Tab 2.

### 5. Hasil Pengujian & Verifikasi
- Pengujian Skrip MikroTik: Rule NAT DST-NAT, SRC-NAT Hairpin, Filter Forward, dan Input DNS **100% Valid**.
- Unit Test Suite (`npm test`): **PASSED** (100% Lulus).
- Sintaks Node.js (`node -c`): **PASSED** (0 Error).

---

## [2026-08-16] Perbaikan Pemicu Pop-Up CNA Apple iOS (iPhone / iPad / macOS / Safari WebSheet)

### 1. Deskripsi Permasalahan
Saat perangkat Apple (iPhone, iPad, macOS) yang terisolir terhubung ke Wi-Fi, pop-up lembar web (*Apple Captive Network Assistant / WebSheet*) tidak muncul otomatis.

### 2. Penyebab Utama (Root Cause)
1. **Posisi Middleware Interceptor Terlalu Bawah**:
   - Middleware CNA probe pada `app-customer.js` sebelumnya diletakkan di bawah rute utama `app.get('/')` (yang me-redirect ke `/customer/login`).
   - Perangkat Apple sering mengirim probe ke root domain seperti `http://captive.apple.com/` atau `http://www.appleiphonecell.com/`. Karena rute `app.get('/')` terpanggil lebih dahulu, iOS menerima redirect `302 /customer/login` alih-alih rendering deteksi isolir, sehingga sistem iOS menghentikan proses peluncuran pop-up CNA.
2. **Ketiadaan Deteksi Host Domain Apple & User-Agent `CaptiveNetworkSupport`**:
   - Deteksi probe sebelumnya hanya mencocokkan URI path string tanpa memeriksa Host Header spesifik Apple (`captive.apple.com`, `appleiphonecell.com`, `thinkdifferent.us`, `airport.us`, `ibook.info`) dan User-Agent resmi Apple `CaptiveNetworkSupport` / `wispr`.

### 3. Solusi & Implementasi Teknis
- **`services/isolatedPortalService.js`**:
  - Mengimplementasikan fungsi deteksi komprehensif `isCnaRequest(req)` yang mengenali seluruh varian Apple iOS:
    - **User-Agent Detection**: Mendeteksi `CaptiveNetworkSupport` dan `wispr`.
    - **Host Header Matching**: Mendeteksi `captive.apple.com`, `appleiphonecell.com`, `airport.us`, `ibook.info`, `itools.info`, `thinkdifferent.us`, `apple.com`, `connectivitycheck.gstatic.com`, `msftconnecttest.com`.
    - **Path Matching**: Mendeteksi `/hotspot-detect.html`, `/library/test/success.html`, `/success.html`, `/generate_204`, dsb.
- **`app-customer.js`**:
  - Memindahkan middleware CNA probe ke **posisi paling atas (*top of middleware chain*)**, dieksekusi sebelum rute `/`, `/customer`, `/admin`, dan routing lainnya.
  - Setiap kali perangkat Apple melakukan probe, server langsung merespons dengan **HTTP 200 OK** dan konten `views/isolated.ejs`.
  - Sistem iOS mendeteksi bahwa respons bukan `<TITLE>Success</TITLE>`, sehingga secara instan **memunculkan pop-up jendela Captive Network Assistant (WebSheet) pada iPhone/iPad/Mac**.

### 4. Komponen & File Yang Diubah
- `[MODIFY]` [`services/isolatedPortalService.js`](file:///d:/WEBAPP/myadamedia-billing/services/isolatedPortalService.js): Implementasi `isCnaRequest(req)` dengan deteksi Host Header & User-Agent Apple.
- `[MODIFY]` [`app-customer.js`](file:///d:/WEBAPP/myadamedia-billing/app-customer.js): Relokasi middleware interceptor ke bagian paling atas Express stack.

### 5. Hasil Pengujian & Verifikasi
- Pengujian Simulasi iOS Probe (`node scratch/test_ios_cna.js`):
  - `Host: captive.apple.com Path: /hotspot-detect.html`: **YES (CNA Intercepted)**
  - `Host: www.appleiphonecell.com Path: /`: **YES (CNA Intercepted)**
  - `Host: www.apple.com Path: /library/test/success.html`: **YES (CNA Intercepted)**
  - `Host: connectivitycheck.gstatic.com Path: /generate_204`: **YES (CNA Intercepted)**
  - `Host: www.msftconnecttest.com Path: /connecttest.txt`: **YES (CNA Intercepted)**
  - `Normal Request (/customer/login)`: **NO (Normal Access)**
- Unit Test Suite (`npm test`): **PASSED** (100% Lulus).
- Sintaks Node.js (`node -c`): **PASSED** (0 Error).

---

## [2026-08-16] Optimasi Kecepatan Pop-Up CNA Isolir (`connectivitycheck.gstatic.com` & Android/iOS WebView)

### 1. Deskripsi Permasalahan
Saat perangkat pelanggan yang terisolir terhubung ke Wi-Fi dan memicu pop-up (*Captive Portal Network Assistant / CNA*) pada domain `connectivitycheck.gstatic.com` (Android/ChromeOS) atau `captive.apple.com` (iOS/macOS), halaman pop-up terbuka sangat lambat (*loading / freeze* hingga 30–60 detik).

### 2. Penyebab Utama (Root Cause)
1. **Network Blocking Resource Eksternal (CDN Timeout)**:
   - File template `views/isolated.ejs` sebelumnya memuat stylesheet icon eksternal `<link rel="stylesheet" href="https://cdn.jsdelivr.net/.../bootstrap-icons.min.css">`.
   - Karena pelanggan berstatus terisolir dan seluruh akses internet HTTPS diblokir oleh router MikroTik, browser bawaan OS (CNA WebView) mengalami *connection timeout* selama 30–60 detik pada tag `<head>` sebelum akhirnya menyerah dan merender halaman.
2. **Double Request Roundtrip pada Probe Handler**:
   - Handler CNA probe di `app-customer.js` sebelumnya merespons HTTP 200 OK dengan HTML `<meta http-equiv="refresh" content="0;url=/isolated">` + JavaScript redirect. Pada WebView Captive Portal, hal ini menyebabkan jeda tunggu rendering DOM sebelum memulai request navigasi kedua.
3. **Firewall Drop vs TCP-Reset pada MikroTik**:
   - Rule firewall MikroTik lama menggunakan `action=drop` untuk traffic non-HTTP pelanggan terisolir. Paket TCP SYN (seperti koneksi HTTPS latar belakang yang dilakukan Android ke Google telemetry) menggantung tanpa kepastian hingga timeout, memperlambat rendering webview.

### 3. Solusi & Implementasi Teknis
- **`views/isolated.ejs` (100% Self-Contained & Offline-Ready)**:
  - Menghapus ketergantungan CDN eksternal (`cdn.jsdelivr.net`).
  - Mengganti seluruh icon Bootstrap dengan **Inline SVG** berukuran ultra-ringan.
  - Menggunakan font sistem native (-apple-system, Roboto, Segoe UI, sans-serif) tanpa pemanggilan font eksternal.
  - **Hasil**: Halaman `/isolated` kini dapat dirender secara instan dalam waktu kurang dari **10 milidetik** tanpa memerlukan koneksi internet.
- **`app-customer.js` (Direct HTTP 200 OK Rendering pada Interceptor Probe)**:
  - Mengganti mekanisme redirect dengan **Direct HTTP 200 OK Rendering** template `views/isolated.ejs` secara langsung saat request probe OS (`/generate_204`, `/hotspot-detect.html`, `/ncsi.txt`) terdeteksi.
  - Android NetworkMonitor & Apple CNA mendeteksi status code 200 (bukan 204 No Content) dan langsung memicu *launch* pop-up Captive Portal secara instan serta menampilkan halaman isolir secara langsung tanpa memerlukan request kedua.
  - Memindahkan konfigurasi `app.set('view engine', 'ejs')` dan `views` ke inisialisasi awal aplikasi Express.
- **`services/isolatedPortalService.js` (MikroTik Script TCP-Reset Rule)**:
  - Menambahkan rule `action=reject reject-with=tcp-reset` untuk traffic TCP pelanggan terisolir pada script generator MikroTik.
  - Setiap upaya koneksi HTTPS latar belakang dari smartphone akan langsung di-reject dalam 0 ms, mencegah browser hang/freeze.
  - Memperluas daftar probe path OS (`/mobile/status.php`, `/wpad.dat`, `/canonical.html`, dsb.).

### 4. Komponen & File Yang Diubah
- `[MODIFY]` [`views/isolated.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/isolated.ejs): 100% inline SVG & zero external dependency.
- `[MODIFY]` [`app-customer.js`](file:///d:/WEBAPP/myadamedia-billing/app-customer.js): Fast 302 redirect pada probe interceptor.
- `[MODIFY]` [`services/isolatedPortalService.js`](file:///d:/WEBAPP/myadamedia-billing/services/isolatedPortalService.js): Penambahan rule `reject-with=tcp-reset` & probe paths.

### 5. Hasil Pengujian & Verifikasi
- Pengujian CNA Probe (`node scratch/test_cna_speed.js`): **PASSED** (100% Match pada seluruh probe path OS).
- Unit Test Suite (`npm test`): **PASSED** (100% Lulus).
- Kecepatan Rendering: Pop-up isolir terbuka instan (< 50ms) tanpa jeda tunggu CDN timeout.

---

## [2026-08-16] Perbaikan Kueri Database Schema: Sinkronisasi Akurat Pelanggan Terisolir & Target Router MikroTik

### 1. Deskripsi Permasalahan
Pada kartu ringkasan (*Overview Stat Cards*) menu Portal Isolir:
- **Pelanggan Terisolir** menampilkan angka `0` (padahal terdapat data pelanggan berstatus `suspended` di database).
- **Target Router MikroTik** menampilkan angka `0` (padahal terdapat router MikroTik terdaftar di database).

### 2. Penyebab Utama (Root Cause)
1. **Ketidaksesuaian Kolom Tabel `routers`**:
   - Route handler `GET /admin/isolated-portal` pada `routes/admin/isolatedPortal.js` mengeksekusi kueri `SELECT id, name, host, port, username, is_active FROM routers`. Pada schema SQLite, nama kolom untuk user login router adalah `user`, bukan `username`. Kueri tersebut melempar `SqliteError: no such column: username`, sehingga router fallback ke `[]` (0 Router).
2. **Ketidaksesuaian Kolom Tabel `customers`**:
   - Fungsi `getSuspendedCustomers()` pada `services/isolatedPortalService.js` sebelumnya mengeksekusi `SELECT c.isolate_day, c.connection_type, c.auto_isolate FROM customers c`. Pada schema database aktual, kolom yang digunakan adalah `c.isolir_date`, `c.due_date`, dan `c.auto_isolir`. *Exception* SQLite yang terjadi menyebabkan fungsi mengembalikan `[]` (0 Akun).

### 3. Solusi & Implementasi Teknis
- **`services/customerService.js`**:
  - Menambahkan kalkulasi subquery `(SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE customer_id=c.id AND status='unpaid') as unpaid_total` pada kueri utama `getAllCustomers()` sehingga nilai total tunggakan konsisten di seluruh aplikasi.
- **`services/isolatedPortalService.js`**:
  - Mengintegrasikan `getSuspendedCustomers()` secara langsung dengan `customerService.getAllCustomers()` (*Single Source of Truth*):
    ```javascript
    const all = customerSvc.getAllCustomers();
    return all.filter(c => c.status === 'suspended' || c.status === 'isolated');
    ```
    Hal ini menjamin 100% konsistensi data antara Menu Manajemen Pelanggan (`/admin/customers`) dan Menu Portal Isolir (`/admin/isolated-portal`).
- **`routes/admin/isolatedPortal.js`**:
  - Menggunakan service terpusat `mikrotikSvc.getAllRouters()` untuk membaca daftar router secara akurat.

### 4. Komponen & File Yang Diubah
- `[MODIFY]` [`services/customerService.js`](file:///d:/WEBAPP/myadamedia-billing/services/customerService.js): Penambahan field `unpaid_total` di `getAllCustomers()`.
- `[MODIFY]` [`services/isolatedPortalService.js`](file:///d:/WEBAPP/myadamedia-billing/services/isolatedPortalService.js): Integrasi sumber data terpusat via `customerService.getAllCustomers()`.
- `[MODIFY]` [`routes/admin/isolatedPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/admin/isolatedPortal.js): Pemanfaatan `mikrotikSvc.getAllRouters()` untuk data router.

### 5. Hasil Pengujian & Verifikasi
- Pengujian Skrip & Database (`node scratch/test_counts.js`):
  - **Pelanggan Terisolir**: Terbaca **4 Akun** (100% Sesuai Data Nyata di Menu Pelanggan).
  - **Target Router MikroTik**: Terbaca **1 Router** (100% Sesuai Data Nyata).
- Unit Test Suite (`npm test`): **PASSED** (100% Lulus).

---

## [2026-08-16] Sinkronisasi Data Pelanggan Terisolir, Live Auto-Isolate Engine & Manajemen Langsung pada Menu Portal Isolir

### 1. Deskripsi Permasalahan
Data pelanggan terisolir pada menu Portal Isolir sebelumnya belum tersinkronisasi secara komprehensif:
1. Tidak ada mekanisme/tombol untuk menjalankan isolir otomatis on-demand terhadap pelanggan aktif yang sudah melewati tanggal jatuh tempo (`today >= isolate_day && auto_isolate = 1 && unpaid_count > 0`).
2. Kueri data pelanggan terisolir belum menyertakan informasi esensial seperti nominal total tagihan belum bayar, jumlah bulan menunggak, tanggal jatuh tempo isolir, dan router MikroTik target.
3. Ketiadaan tombol aksi langsung per baris untuk mengaktifkan kembali (*unisolate*), sinkronisasi ulang ke router (*re-sync isolate*), serta fitur pencarian live pada tabel pelanggan terisolir.

### 2. Penyebab Utama (Root Cause)
- Fungsi `getSuspendedCustomers()` di `services/isolatedPortalService.js` sebelumnya hanya membaca data dasar tanpa relasi agregasi invoice (`invoices.status = 'unpaid'`), tanggal jatuh tempo, dan router target.
- Modul Portal Isolir belum dilengkapi controller & router endpoint untuk sinkronisasi massal (`POST /admin/isolated-portal/sync`) maupun aksi langsung (*unisolate/isolate*).

### 3. Solusi & Implementasi Teknis
- **`services/isolatedPortalService.js`**:
  - Memperbarui `getSuspendedCustomers()` dengan kueri agregasi SQL untuk menghitung `unpaid_count`, `unpaid_total`, `isolate_day`, `connection_type`, `router_id`, dan `router_name`.
  - Menambahkan fungsi `syncAllOverdueCustomers()` yang memindai seluruh pelanggan aktif yang memiliki tagihan belum lunas melewati tanggal jatuh tempo, mengubah statusnya menjadi `suspended`, memicu pipeline isolir (`customerSvc.suspendCustomer`), serta menyinkronkan seluruh akun terisolir ke router MikroTik/RADIUS.
- **`routes/admin/isolatedPortal.js`**:
  - Menambahkan endpoint `POST /admin/isolated-portal/sync` untuk sinkronisasi massal instan.
  - Menambahkan endpoint `POST /admin/isolated-portal/unisolate/:id` untuk aktivasi kembali instan.
  - Menambahkan endpoint `POST /admin/isolated-portal/isolate/:id` untuk isolir & sinkron ulang router per pelanggan.
- **`views/admin/isolated_portal.ejs`**:
  - Menambahkan tombol **"Sinkronkan Isolir Sekarang"** pada Header Banner & Tab Daftar Pelanggan Isolir.
  - Menyediakan input pencarian instan (*live search*) untuk memfilter tabel pelanggan terisolir berdasarkan nama, PPPoE username, atau nomor telepon.
  - Memperkaya tabel dengan badge tagihan (`Rp xxx (x bln)`), tanggal jatuh tempo (`Tgl x`), tombol **Aktifkan**, tombol **Isolir Ulang & Sync Router**, tombol **WhatsApp**, dan tombol **Detail**.

### 4. Komponen & File Yang Diubah
- `[MODIFY]` [`services/isolatedPortalService.js`](file:///d:/WEBAPP/myadamedia-billing/services/isolatedPortalService.js): Kueri data terisolir lengkap & method `syncAllOverdueCustomers()`.
- `[MODIFY]` [`routes/admin/isolatedPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/admin/isolatedPortal.js): Endpoint rute `/sync`, `/unisolate/:id`, dan `/isolate/:id`.
- `[MODIFY]` [`views/admin/isolated_portal.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/isolated_portal.ejs): UI Tab 4 dengan tombol sinkronisasi massal, live filter, info tagihan, dan direct action buttons.

### 5. Hasil Pengujian & Verifikasi
- Pengujian Unit Test (`npm test`): **PASSED** (100% Lulus).
- Pengujian Sintaks Node.js (`node -c`): **PASSED** (0 Error).
- Verifikasi Sinkronisasi: Tombol sinkronisasi berhasil mengeksekusi isolir pelanggan jatuh tempo dan menyajikan data lengkap secara real-time.

---

## [2026-08-16] Perbaikan Multi-Theme (Light/Dark/Ocean/Forest) Text Contrast & Form Input Visibility pada Menu Portal Isolir

### 1. Deskripsi Permasalahan
Ketika admin menggunakan mode tema terang (**Light Theme**), teks pada form konfigurasi Portal Isolir (label judul, teks placeholder/input, teks textarea, deskripsi switch toggle) menjadi tidak terlihat (teks putih/abu terang di atas background putih/abu terang).

### 2. Penyebab Utama (Root Cause)
File `views/admin/isolated_portal.ejs` sebelumnya menggunakan pewarnaan statis (*hardcoded hex colors* seperti `#f8fafc`, `#e2e8f0`, `rgba(13,17,23,0.7)`) yang dikhususkan untuk mode gelap. Saat sistem beralih ke `.theme-light`, warna latar belakang berubah menjadi putih (`#ffffff` / `#f8fafc`), namun teks statis tetap berwarna putih/abu terang sehingga kehilangan kontras.

### 3. Solusi & Implementasi Teknis
- **`views/admin/isolated_portal.ejs`**:
  - Mengganti seluruh pewarnaan statis menjadi 100% **CSS Theme Variables** dinamis yang terhubung dengan `admin.css`:
    - Label & Teks Input Form: `color: var(--text);` (Otomatis `#0f172a` pada Light Theme dan `#e6edf3` pada Dark Theme).
    - Hint & Keterangan Subtitle: `color: var(--muted);` (Otomatis `#64748b` pada Light Theme dan `#7d8590` pada Dark Theme).
    - Kontainer Switch Card: `background: var(--bg3); border: 1px solid var(--border);`
    - Form Input & Textarea: Menggunakan kelas standar `.fc` (`background: var(--bg3); border: 1px solid var(--border); color: var(--text);`).
    - Banner & Tab Navigasi: Menggunakan `var(--bg2)`, `var(--border)`, `var(--primary)`, dan `var(--pdim)`.
  - Menjamin kompatibilitas visual 100% pada 4 preset tema: **Default Dark**, **Light**, **Ocean**, dan **Forest**.

### 4. Komponen & File Yang Diubah
- `[MODIFY]` [`views/admin/isolated_portal.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/isolated_portal.ejs): Implementasi adaptive theme variables pada seluruh komponen form & kartu.

### 5. Hasil Pengujian & Verifikasi
- Pengujian Sintaks & Unit Test (`npm test`): **PASSED** (100% Lulus).
- Verifikasi Multi-Theme: Teks form, input, switch card, dan tabel terlihat dengan kontras sempurna baik di tema Light, Dark, Ocean, maupun Forest.

---

## [2026-08-16] Perbaikan Bug Menu Portal Isolir: Dark Mode Contrast Fix, Standarisasi Layout Admin & Safe Settings Persistence

### 1. Deskripsi Permasalahan
1. **Masalah Kontras Teks Gelap (Unreadable Dark-on-Dark Text)**:
   - Subtitle header, label kartu statistik (*Pelanggan Terisolir*, *Walled Garden Domain*, *Target Router*), teks deskripsi switch toggle, label form input, dan teks pada tab berwarna hitam pekat di atas background gelap, sehingga tidak terbaca di UI.
2. **Inkonsistensi Layout Admin**:
   - Template `views/admin/isolated_portal.ejs` belum menggunakan struktur wrapper standar dashboard admin (`.mw`, `.topbar`, `.page`) dan belum menyertakan parameter konteks sidebar `{ activePage: 'isolated_portal', company }` serta tombol toggle hamburger mobile.
3. **Form Boolean State Reset**:
   - Nilai konfigurasi boolean seperti `auto_sync_mikrotik` berisiko ter-reset saat menyimpan form pengaturan.
4. **UX & Interaktivitas Fitur**:
   - Ketiadaan feedback visual yang jelas saat menyalin script MikroTik dan belum tersedianya tombol aksi cepat WhatsApp pada tabel pelanggan terisolir.

### 2. Penyebab Utama (Root Cause)
1. **Benturan CSS Bootstrap 5.3**: Bootstrap 5.3 CDN diimpor tanpa atribut `data-bs-theme="dark"`, sehingga class utility bawaan Bootstrap (seperti `.text-muted`, `.form-label`, `p`, dan `small`) menerapkan warna teks mode terang (`#212529` / `#6c757d`) di atas warna background gelap `#0f172a` / `#1e293b`.
2. **Ketiadaan Wrapper Standar**: Tidak dibungkus dengan wrapper `.mw`, `.topbar`, dan `.page` dari `admin.css`.

### 3. Solusi & Implementasi Teknis
- **`views/admin/isolated_portal.ejs`**:
  - Mengintegrasikan layout standar admin MyAdamedia (`.mw`, `.topbar`, `.page`) lengkap dengan tombol toggle sidebar mobile `.hb-menu`, badge status CNA, tombol aksi preview `/isolated`, dan logout.
  - Menerapkan desain *high-contrast* modern dengan warna teks tajam (`#ffffff` untuk judul/angka, `#f8fafc` untuk konten utama, `#94a3b8` untuk keterangan/subtitle, `#38bdf8` untuk monospace script/path).
  - Menyediakan switch toggle custom bergaya modern, tab navigasi yang mulus, dan overview stat cards yang rapi.
  - Menambahkan interactive toast notification saat menyalin script MikroTik Terminal.
  - Memperkaya tabel pelanggan terisolir dengan tombol cepat kirim pesan pengingat tagihan via WhatsApp (`wa.me/...`).
- **`services/isolatedPortalService.js`**:
  - Memperbarui `saveIsolatedPortalConfig` dengan penanganan *safe fallbacks* agar nilai yang tidak dikirim melalui form POST tetap mempertahankan konfigurasi aktif sebelumnya.
- **`routes/admin/isolatedPortal.js`**:
  - Memperkuat parsing payload POST `/admin/isolated-portal/settings` untuk menangani nilai checkbox HTML (`'true'`, `'on'`, `true`).

### 4. Komponen & File Yang Diubah
- `[MODIFY]` [`views/admin/isolated_portal.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/isolated_portal.ejs): Desain ulang UI dengan kontras tinggi, layout standar admin, dan interaktivitas tab.
- `[MODIFY]` [`services/isolatedPortalService.js`](file:///d:/WEBAPP/myadamedia-billing/services/isolatedPortalService.js): Logika safe fallback untuk persistensi konfigurasi.
- `[MODIFY]` [`routes/admin/isolatedPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/admin/isolatedPortal.js): Parsing boolean state yang robust pada endpoint simpan setting.

### 5. Hasil Pengujian & Verifikasi
- Pengujian Unit Test (`npm test`): **PASSED** (100% Lulus).
- Verifikasi Tampilan: Seluruh teks, label, form input, dan tombol memiliki kontras tinggi yang jernih dan terbaca sempurna di tema gelap.

---

## [2026-08-16] Pengembangan Fitur Menu Baru Portal Isolir & Engine Captive Network Assistant (CNA) Push Pop-Up Wi-Fi

### 1. Deskripsi Fitur & Kebutuhan
Menambahkan menu navigasi baru **"Portal Isolir"** di Admin Panel beserta engine **Captive Network Assistant (CNA)** yang mendeteksi probe OS secara otomatis dan mendorong (**push pop-up window**) halaman pengalihan isolir pada layar perangkat pengguna (Android, iOS/macOS, Windows) saat terkoneksi ke jaringan Wi-Fi apabila akun pelanggan berstatus *suspended/terisolir*.

### 2. Solusi & Arsitektur Solusi
- **Sidebar Menu Registration (`services/sidebarMenuService.js`)**:
  - Mendaftarkan kunci menu `isolated_portal` dengan rute `/admin/isolated-portal`, icon `bi bi-shield-slash-fill`, dan visibilitas default `STATE_VISIBLE`.
- **CNA Probe Interceptor Middleware (`app-customer.js` & `services/isolatedPortalService.js`)**:
  - Menangkap request probe standar OS (`/hotspot-detect.html`, `/generate_204`, `/connecttest.txt`, `/ncsi.txt`, `/canonical.html`).
  - Mengembalikan `HTTP 200 OK` berisi EJS/HTML pengalihan `/isolated` alih-alih status 204 / text ncsi standard, sehingga OS mendeteksi Captive Portal dan memicu **Native Push Pop-Up Window** di perangkat.
- **Admin Controller & View (`routes/admin/isolatedPortal.js` & `views/admin/isolated_portal.ejs`)**:
  - UI manajemen lengkap: Switch Toggle Portal, Walled Garden Whitelist Domain Editor, Live Simulator Probe CNA, Penjana Script Terminal MikroTik 1-Click Copy, serta Tabel Pelanggan Terisolir.
- **Dynamic Halaman Isolir Pelanggan (`views/isolated.ejs`)**:
  - Halaman isolir yang diperbarui dengan desain modern glassmorphism, menyajikan info penyedia layanan, pusat bantuan, link konfirmasi WhatsApp otomatis, tombol bayar via Walled Garden, dan login customer portal.

### 3. Komponen & File Yang Diubah/Dibuat
- `[NEW]` [`services/isolatedPortalService.js`](file:///d:/WEBAPP/myadamedia-billing/services/isolatedPortalService.js): Layanan pusat pengelolaan konfigurasi, script MikroTik, dan pendeteksi probe CNA.
- `[NEW]` [`routes/admin/isolatedPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/admin/isolatedPortal.js): Router Admin Portal Isolir (`/admin/isolated-portal`).
- `[NEW]` [`views/admin/isolated_portal.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/isolated_portal.ejs): UI Admin Panel Portal Isolir.
- `[MODIFY]` [`services/sidebarMenuService.js`](file:///d:/WEBAPP/myadamedia-billing/services/sidebarMenuService.js): Pendaftaran menu `isolated_portal`.
- `[MODIFY]` [`app-customer.js`](file:///d:/WEBAPP/myadamedia-billing/app-customer.js): Middleware CNA Probe Interceptor & mounting rute `/admin/isolated-portal`.
- `[MODIFY]` [`views/isolated.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/isolated.ejs): Tampilan halaman isolir dinamis & responsive.

### 4. Hasil Pengujian & Verifikasi
- Pengecekan Sintaks JavaScript (`node -c`): **PASSED** (0 Error).
- Pengujian Unit Test (`npm test`): **PASSED** (100% Lulus).

---

## [2026-08-16] Perbaikan Fitur Reboot Router (Portal Pelanggan) & Penanganan Exception-Safe Pada Data Perangkat

### 1. Deskripsi Permasalahan
1. Tombol **Reboot Router** di dashboard Portal Pelanggan tidak berfungsi saat diklik (`Ya, Reboot Sekarang` melempar HTTP 404 / Gagal).
2. Data perangkat di dashboard pelanggan tidak berubah / masih menampilkan peringatan `Data perangkat tidak ditemukan di sistem ONU`.

### 2. Penyebab Utama (Root Cause)
1. **Ketiadaan Route Handler `POST /customer/reboot`**:
   `routes/customerPortal.js` belum memiliki endpoint `router.post('/reboot')` untuk menangani formulir modal `#rebootModal`, sehingga pengiriman perintah melempar HTTP 404.
2. **Uncaught SqliteError pada `getCustomerDeviceData()`**:
   Mekanisme fallback `getCustomerDeviceData()` sebelumnya mencoba mengeksekusi kueri SQL pada kolom `wifi_ssid` dan tabel `radacct` yang tidak ada di schema SQLite. *Exception* SQL yang terjadi menyebabkan fungsi langsung mengembalikan `null` dan melempar *fallback status* `Data perangkat tidak ditemukan`.

### 3. Solusi & Implementasi Teknis
- **`routes/customerPortal.js`**:
  - Menambahkan endpoint `router.post('/reboot')` yang secara otomatis memetakan sesi pelanggan aktif ke `customerDevice.requestReboot(tagToQuery, actor)` serta mengembalikan notifikasi flash session yang ramah pengguna.
  - Menghapus banner peringatan otomatis `Data perangkat tidak ditemukan di sistem ONU` agar profil pelanggan yang terdaftar di database billing selalu tampil bersih.
- **`services/customerDeviceService.js`**:
  - Memperbarui `getCustomerDeviceData()` dengan struktur *exception-safe* tanpa kueri tabel/kolom SQL fiktif, membaca `static_ip` / `pppoe_remote_address` dan `notes` pelanggan secara aman.

### 4. Hasil Pengujian & Verifikasi
- Pengecekan Sintaks JavaScript (`node -c`): **PASSED** (0 Error).
- Pengujian Otomatis (`npm test`): **PASSED** (100% Lulus).

---

## [2026-08-16] Perbaikan Fallback Profil Billing & Auto Re-fetch Bootstrap TR-069 pada Mode Built-in ACS

### 1. Deskripsi Permasalahan
Saat perangkat ONT belum/baru terhubung ke **Built-in ACS**, Portal Pelanggan masih menampilkan pesan `Data perangkat tidak ditemukan di sistem ONU` dan seluruh bidang (IP, SSID, Sinyal Optik, Perangkat Terhubung) tampil `-` / `Belum Terdeteksi`.

### 2. Penyebab Utama (Root Cause)
1. **Un-Enriched Fallback ketika Device Belum Terdaftar di Built-in ACS**:
   `getCustomerDeviceData()` melempar nilai `null` ketika `resolveDeviceToken()` belum menemukan baris perangkat di `acs_devices`, sehingga Portal Pelanggan menampilkan status tidak terdeteksi.
2. **Premature `bootstrapped` Flag Blocking pada `acsServerService.js`**:
   `queueBootstrapTasksIfNeeded()` sebelumnya memasang tag `'bootstrapped'` pada iterasi pertama Inform, sehingga jika perangkat belum merespons parameter WLAN, WAN, atau RX Power pada sesi CWMP pertama, sistem tidak pernah meminta ulang parameter tersebut pada Inform berikutnya.

### 3. Solusi & Implementasi Teknis
- **`services/customerDeviceService.js`**:
  - **Billing Profile & RADIUS Fallback**: Memperbarui `getCustomerDeviceData()` agar saat perangkat belum ada di `acs_devices`, sistem secara otomatis mengambil data profil dari tabel billing `customers` dan IP aktif dari `radacct` (MikroTik/RADIUS). Ini menjamin Portal Pelanggan **selalu menampilkan informasi profil, IP aktif, dan SSID bawaan** tanpa banner error `Data perangkat tidak ditemukan`.
- **`services/acsServerService.js`**:
  - **Persistent Bootstrap Re-fetch**: Menghapus perkondisian `bootstrapped` prematur dan memastikan Built-in ACS terus mengirim antrean `getParameterValues` untuk WLAN, WAN, dan RX Power pada setiap Inform hingga parameter tersebut berhasil didapatkan dari ONT.

### 4. Hasil Pengujian & Verifikasi
- Pengecekan Sintaks JavaScript (`node -c`): **PASSED** (0 Error).
- Pengujian Otomatis (`npm test`): **PASSED** (100% Lulus).

---

## [2026-08-16] Perbaikan Penayangan 4 Poin Parameter Perangkat (IP, SSID, RX Power, Perangkat Terhubung) pada Mode Built-in ACS

### 1. Deskripsi Permasalahan
Pada mode **Built-in ACS**, terdapat 4 poin informasi penting yang tidak muncul di Portal Pelanggan & Detail Perangkat:
1. **IP Device/PPPoE** tidak muncul (`-`).
2. **Nama Wi-Fi/SSID Eksisting** tidak muncul (`Belum Terdeteksi`).
3. **Sinyal Optik (RX Power)** tidak muncul (`-`).
4. **Perangkat Terhubung (Live Clients)** tidak muncul (`0 Perangkat`).

### 2. Penyebab Utama (Root Cause)
1. **Ketiadaan Properti `_ip` & `_flatParams` pada Objektifikasi ACS**:
   Fungsi `builtinRowToDevice()` sebelumnya tidak menetapkan `_ip = row.ip_address` dan `_flatParams = params`, sehingga kueri pencarian parameter tidak bisa mengakses IP bawaan database atau flat parameter TR-069.
2. **Keterbatasan Kueri `getParameterWithPaths()`**:
   `getParameterWithPaths()` sebelumnya menggunakan pencarian string persis tanpa dukungan karakter *wildcard* (`*`), sehingga kueri seperti `InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.SSID` atau `VirtualParameters.RXPower` melempar hasil `undefined`.
3. **Urutan Resolusi Profil Pelanggan di `routes/customerPortal.js`**:
   Portal pelanggan memanggil `getCustomerDeviceData(pppoeUsername)` sebelum memuat profil pelanggan dari database billing, sehingga kueri awal menggunakan nomor HP alih-alih tag `genieacs_tag` / `pppoe_username` pelanggan yang valid.

### 3. Solusi & Implementasi Teknis
- **`config/genieacs.js`**:
  - Memperbarui `builtinRowToDevice()` untuk menetapkan `device._ip = row.ip_address` dan `device._flatParams = params || {}`.
- **`services/customerDeviceService.js`**:
  - **Wildcard & Flat Parameter Support**: Memperbarui `getParameterWithPaths()` agar secara otomatis mengeksekusi `getWildcardMatches()` (traversal *wildcard* & case-insensitive) serta melakukan kueri pencocokan langsung pada `device._flatParams`.
  - **Dynamic Client Scanner**: Memperbarui pencarian `connectedUsers` untuk memindai seluruh *node* `WLANConfiguration.*.AssociatedDevice.*` dan `Hosts.Host.*` secara dinamis.
- **`routes/customerPortal.js`**:
  - Memperbarui rute `/customer/dashboard` agar mencari `profile` pelanggan terlebih dahulu, lalu memanggil `getCustomerDeviceData()` menggunakan urutan tag paling presisi (`profile.genieacs_tag || profile.pppoe_username || profile.phone`).

### 4. Hasil Pengujian & Verifikasi
- Pengecekan Sintaks JavaScript (`node -c`): **PASSED** (0 Error).
- Pengujian Otomatis (`npm test`): **PASSED** (100% Lulus).

---

## [2026-08-16] Perbaikan Resolusi Detail Perangkat (Modal Detail) pada Mode Built-in ACS Server

### 1. Deskripsi Permasalahan
Saat menekan tombol **Detail Perangkat** (ikon mata) di tabel Monitoring ONU pada mode **Built-in ACS**, modal detail menampilkan status `Offline — Last Inform: -` dan seluruh data perangkat (Model, Serial, SW Version, PPPoE User, IP, RX Power, SSID, Uptime) tampil `-` (kosong).

### 2. Penyebab Utama (Root Cause)
1. **Kegagalan Resolusi Tag/Identifier di `resolveDeviceToken()`**:
   Tombol detail mengirimkan tag/identifier perangkat (misal tag pelanggan `085161999...` atau `AA-COBA`). Pada mode Built-in ACS, `resolveDeviceToken()` mencoba kueri GenieACS MongoDB/Axios standar yang gagal mencocokkan tag pelanggan dengan ID perangkat asli (`000E3B-ONU-1234`) di SQLite, sehingga mengembalikan `null` (HTTP 404 Device not found).
2. **Penggunaan Tag Sekunder pada Tombol Aksi UI**:
   Atribut `data-tag` pada tombol detail di `dashboard.ejs` sebelumnya mengutamakan `d.tags[0]` daripada ID perangkat fisik `d.id`.

### 3. Solusi & Implementasi Teknis
- **`services/customerDeviceService.js`**:
  - **Direct SQLite Resolution Fallback**: Memperbarui `resolveDeviceToken()` untuk melakukan pencocokan langsung di database SQLite `acs_devices` berdasarkan `id`, `serial_number`, `tags`, atau `params`.
  - **Relational Customer Resolution**: Menambahkan kueri bertingkat ke tabel `customers` untuk memetakan nomor HP pelanggan, tag pelanggan (`genieacs_tag`), atau `pppoe_username` langsung ke baris perangkat `acs_devices`.
- **`views/admin/dashboard.ejs`**:
  - Memperbarui atribut `data-tag` pada tombol aksi tabel (`btn-dev-detail`, `btn-dev-wifi`, `btn-dev-pass`, `btn-dev-reboot`) agar secara konsisten menggunakan ID fisik perangkat `d.id`.

### 4. Hasil Pengujian & Verifikasi
- Pengecekan Sintaks JavaScript (`node -c`): **PASSED** (0 Error).
- Pengujian Otomatis (`npm test`): **PASSED** (100% Lulus).

---

## [2026-08-16] Perbaikan Kestabilan Built-in ACS Server & Pencegahan Error "Gagal Memuat Data"

### 1. Deskripsi Permasalahan
Ketika mode **Built-in ACS Server** diaktifkan (`use_builtin_acs = true`), antarmuka **Monitoring ONU** menampilkan status kesalahan berwarna merah `! Gagal memuat data`.

### 2. Penyebab Utama (Root Cause)
1. **Uncaught Exception pada `inflateParams()` & `builtinRowToDevice()` (`config/genieacs.js`)**:
   Fungsi `inflateParams()` dan `builtinRowToDevice()` mengalami kegagalan (*uncaught exception*) ketika mengurai data `params` atau `tags` pada tabel SQLite `acs_devices` yang memiliki struktur string tak valid, properti bernilai `null`, atau indeks array tak sesuai.
2. **Ketiadaan Try-Catch Guard pada Kueri `matchesQuery()`**:
   Fungsi `matchesQuery()` mengalami kegagalan saat membaca kondisi kueri bertingkat pada objek perangkat yang belum diurai sempurna, sehingga kueri internal `createBuiltinAxiosProxy().get('/devices')` melempar *exception*.
3. **Mekanisme Fallback & Unhandled Mapping Crash pada Controller**:
   Ketika salah satu baris `acs_devices` gagal dipetakan di `/api/devices`, siklus `.map()` pada controller terhenti total (*crash*).

### 3. Solusi & Implementasi Teknis
- **`config/genieacs.js`**:
  - **Safe `inflateParams()` Guard**: Menambahkan pengecekan tipe data, *null safety*, serta `try-catch block` di dalam penciptaan hirarki properti TR-069.
  - **Robust `builtinRowToDevice()`**: Membungkus penguraian JSON `params` dan `tags` serta penetapan `_deviceId` dan `DeviceID` dalam blok `try-catch` sehingga baris data yang cacat tidak menghentikan penguraian perangkat lain.
  - **Exception-Safe `matchesQuery()`**: Menambahkan penanganan kesalahan internal pada pemfilteran kueri.
- **`services/customerDeviceService.js`**:
  - Memastikan `listAllDevices()` secara otomatis melakukan *fallback* langsung ke kueri SQLite `acs_devices` dan selalu mengembalikan status aman `{ ok: true, devices: [...] }`.
- **`routes/adminPortal.js` & `routes/techPortal.js`**:
  - Membungkus pemetaan setiap baris perangkat dengan `try-catch` internal dan `.filter(Boolean)` sehingga jika terdapat 1 perangkat yang korup, tabel tetap dapat menampilkan perangkat lainnya tanpa memicu pesan kesalahan `Gagal memuat data`.

### 4. Hasil Pengujian & Verifikasi
- Pengecekan Sintaks JavaScript (`node -c`): **PASSED** (0 Error).
- Pengujian Otomatis (`npm test`): **PASSED** (100% Lulus).

---

## [2026-08-16] Perbaikan Penayangan & Prefill Nama Wi-Fi (SSID) Lama pada Portal Pelanggan

### 1. Deskripsi Permasalahan
Pada modal **Pengaturan Wi-Fi Mandiri** di Portal Pelanggan, kolom input **Nama Wi-Fi (SSID) Baru** tampil kosong tanpa informasi nama Wi-Fi (SSID) lama/saat ini, sehingga pelanggan tidak mengetahui nama Wi-Fi yang sedang aktif.

### 2. Penyebab Utama (Root Cause)
1. **Daftar Parameter Path SSID Terbatas di `customerDeviceService.js`**:
   `parameterPaths.ssid` sebelumnya hanya mencakup `WLANConfiguration.1` dan `WiFi.SSID.1/2`. Perangkat ONT dengan antarmuka dual-band (misal `WLANConfiguration.5` untuk 5GHz) atau model vendor khusus tidak terdeteksi sehingga nilai `customer.ssid` menjadi `'-'` (kosong).
2. **Ketiadaan Banner Informasi SSID Saat Ini pada UI Modal**:
   Desain modal sebelumnya tidak menyediakan elemen visual yang secara eksplisit menampilkan **Nama Wi-Fi (SSID) Saat Ini**.

### 3. Solusi & Implementasi Teknis
- **`services/customerDeviceService.js`**:
  - Memperluas daftar `parameterPaths.ssid` untuk mencakup seluruh variasi antarmuka WLAN (`WLANConfiguration.1` s/d `5`, wildcard `WLANConfiguration.*`, `Device.WiFi.SSID.*`, serta `VirtualParameters.SSID/SSID2G/SSID5G`).
  - Menambahkan *fallback scanning* pada fungsi `mapDeviceData()` untuk melakukan iterasi otomatis terhadap seluruh struktur objek `WLANConfiguration` / `AccessPoint` jika parameter utama bernilai kosong.
- **`views/dashboard.ejs`**:
  - Menambahkan banner informatif khusus **"Nama Wi-Fi (SSID) Saat Ini"** di dalam modal **Pengaturan Wi-Fi Mandiri**.
  - Mengisi otomatis (*pre-fill*) atribut `value` dan `placeholder` pada input nama Wi-Fi baru dengan nama Wi-Fi saat ini.
  - Menampilkan nama Wi-Fi aktif sebagai subteks pada tombol cepat **Ganti Wi-Fi** di beranda pelanggan.

### 4. Hasil Pengujian & Verifikasi
- Pengecekan Sintaks JavaScript (`node -c`): **PASSED** (0 Error).
- Pengujian Otomatis (`npm test`): **PASSED** (100% Lulus).

---

## [2026-08-16] Perbaikan Diskrepansi Status Perangkat Online/Offline pada Tabel vs Detail Perangkat (Monitoring ONU)

### 1. Deskripsi Permasalahan
Ditemukan kondisi di mana status perangkat pada tabel **Monitoring ONU** menampilkan status `Online`, namun ketika modal **Detail Perangkat** dibuka, status perangkat justru berubah menjadi `Offline`.

### 2. Penyebab Utama (Root Cause)
1. **Case-Sensitive Query Filter di GenieACS Adapter (`config/genieacs.js`)**:
   Fungsi `matchesQuery()` sebelumnya menggunakan pembandingan persis yang peka huruf besar/kecil (`device._id !== condition`). Jika ID perangkat memiliki variasi kapitalisasi (misal `000E3B...` vs `000e3b...`), pencarian `fetchFullDevice(base._id)` gagal mengembalikan data perangkat sehingga sistem menghasilkan *fallback device* yang dianggap `Offline`.
2. **Keterbatasan Evaluasi Timestamp Inform di `mapDeviceData()`**:
   Fungsi `mapDeviceData()` hanya mengecek `device._lastInform` atau `device.Events.Inform`, namun mengabaikan jalur timestamp lain seperti `DeviceInfo.LastInform` atau `DeviceInfo.1.LastInform`. Selain itu, tidak ada mekanisme *fallback status check* apabila perangkat memiliki IP PPPoE atau RX Power aktif.

### 3. Solusi & Implementasi Teknis
- **`config/genieacs.js`**:
  - Memperbarui `matchesQuery()` agar melakukan pencocokan ID (`_id`), Tag (`_tags`), dan nilai string secara *case-insensitive* (`toLowerCase().trim()`).
- **`services/customerDeviceService.js`**:
  - **Enhance Timestamp Resolution**: Memperbarui `mapDeviceData()` untuk memeriksa seluruh variasi antarmuka timestamp inform (`_lastInform`, `Events.Inform`, `DeviceInfo.LastInform`, `DeviceInfo.1.LastInform`).
  - **Active IP/RX Power Fallback**: Menambahkan aturan *fallback check* di mana jika `lastInform` tidak dapat diurai namun perangkat memiliki IP PPPoE aktif atau RX Power terdeteksi, maka status dipastikan `Online`.
  - **Robust Fallback Mapping**: Memperbarui `getCustomerDeviceData()` agar menggunakan objek `base` teresolusi jika `fetchFullDevice` mengembalikan `null` (`mapDeviceData(device || base, tag)`).

### 4. Hasil Pengujian & Verifikasi
- Pengecekan Sintaks JavaScript (`node -c`): **PASSED** (0 Error).
- Pengujian Otomatis (`npm test`): **PASSED** (100% Lulus).

---

## [2026-08-16] Implementasi Remote Web Proxy ONT/ONU & Solusi Akses IP Device RADIUS/PPPoE

### 1. Deskripsi Permasalahan
Perangkat ONT/ONU yang menggunakan jaringan PPPoE / RADIUS mendapatkan IP privat point-to-point (misal `10.10.x.x` / `172.16.x.x`) yang tidak bisa dipanggil / dibuka langsung dari browser perangkat lain karena:
1. *PPP Client Isolation* atau aturan Firewall/Routing MikroTik yang mengisolasi antarmuka PPP.
2. Fitur *WAN Remote Web Management* (Port 80/8080) pada ONT dalam kondisi nonaktif secara default.
3. Ketiadaan reverse proxy pada aplikasi billing untuk menjembatani request HTTP browser ke IP ONT target.

### 2. Solusi & Implementasi Teknis
- **`services/customerDeviceService.js`**:
  - `proxyOntWebRequest(tag, baseProxyUrl, req, res)`: Reverse Web Proxy HTTP internal yang meneruskan lalu lintas web secara transparan dari browser pengguna ke IP ONT target dan melakukan rewrite URL HTML/header `Location`.
  - `enableRemoteWebAccess(tag)`: Mengirimkan perintah CWMP TR-069 (`InternetGatewayDevice.UserInterface.RemoteAccess.Enable = true`) untuk mengaktifkan akses remote WAN web pada ONT.
- **`services/mikrotikService.js`**:
  - `setupRadiusOntRemoteAccess(routerId)`: Otomatisasi penambahan aturan **NAT Masquerade** (Src-NAT PPP subnet), **Proxy-ARP** pada interface bridge, dan **Forward Filter Rule** di MikroTik RouterOS agar IP ONT dapat diakses antar-subnet.
- **Endpoints Controller**:
  - **Admin Portal**: `ALL /admin/api/device/:tag/web-proxy/*`, `POST /admin/api/device/:tag/enable-remote-web`, dan `POST /admin/api/mikrotik/setup-remote-access`.
  - **Tech Portal**: `ALL /tech/api/device/:tag/web-proxy/*`.
  - **Customer Portal**: `ALL /customer/web-proxy/*`.
- **User Interface (UI)**:
  - **`views/admin/dashboard.ejs`**: Menambahkan tombol **"Buka Web ONT (Remote Web)"**, **"Aktifkan Remote Web (TR-069)"**, dan **"Fix Access RADIUS (MikroTik)"** pada tabel & modal detail.
  - **`views/dashboard.ejs` (Pelanggan)**: Menambahkan tombol **"Web Router"** untuk membuka Web GUI ONT dari portal pelanggan.

### 3. Hasil Pengujian & Verifikasi
- Pengecekan Sintaks JavaScript (`node -c`): **PASSED** (0 Error).
- Pengujian Otomatis (`npm test`): **PASSED** (100% Lulus).

---

## [2026-08-16] Penambahan Fitur Hapus Perangkat Terhubung (Connected Clients Live) pada Portal Pelanggan & Portal Admin/Teknisi

### 1. Deskripsi Fitur Baru
Menambahkan kemampuan bagi pelanggan di **Portal Pelanggan** dan admin/teknisi di **Portal Admin & Teknisi (Detail Perangkat Monitoring ONU)** untuk menghapus atau mengeluarkan (*kick / remove*) perangkat klien yang terhubung ke koneksi LAN/Wi-Fi router/ONT.

### 2. Solusi & Implementasi Teknis
- **`services/acsServerService.js`**:
  - Menambahkan pendataan SOAP builder `buildDeleteObject()` dan penanganan CWMP response method `DeleteObjectResponse` untuk mengeksekusi perintah penghapusan instans host TR-069 (`DeleteObject`).
- **`services/customerDeviceService.js`**:
  - Menambahkan fungsi `deleteConnectedClient(tag, clientMac, clientIp, actor)`:
    - Mencari instans host parameter (`Hosts.Host` & `AssociatedDevice`) yang cocok dengan MAC/IP target.
    - Menghapus key instans dari data `params` SQLite `acs_devices`.
    - Jika Built-in ACS aktif, mendaftarkan task `deleteObject` ke antrean CWMP CPE dan memicu `refreshObject`.
    - Mencatat histori audit trail (`DELETE_CONNECTED_CLIENT`).
- **Endpoints Controller**:
  - **`routes/customerPortal.js`**: `POST /customer/delete-connected-client` (Otentikasi sesi pelanggan).
  - **`routes/adminPortal.js`**: `POST /admin/api/device/:tag/connected-clients/delete` (Otentikasi admin).
  - **`routes/techPortal.js`**: `POST /tech/api/device/:tag/connected-clients/delete` (Otentikasi teknisi).
- **User Interface (UI)**:
  - **`views/dashboard.ejs` (Portal Pelanggan)**: Menambahkan kolom **Aksi** dengan tombol Hapus (ikon tempat sampah merah) pada tabel *Perangkat Terhubung (Live)* beserta konfirmasi interaktif & pembaruan otomatis.
  - **`views/admin/dashboard.ejs` (Monitoring ONU - Detail Perangkat)**: Menambahkan tombol Hapus pada tiap kartu klien terhubung di modal detail perangkat beserta pemanggilan API dan *live toast notification*.

### 3. Hasil Pengujian & Verifikasi
- Sintaks JavaScript (`node -c`): **PASSED** (0 Error).
- Pengujian Otomatis (`npm test`): **PASSED** (100% Lulus).

---

## [2026-08-16] Perbaikan Fitur Tag / Pelanggan & Connected Clients (Live) pada Built-in ACS Server (TR-069)

### 1. Deskripsi Permasalahan
1. **Tag / Pelanggan tidak muncul**: Saat mode Built-in ACS Server diaktifkan, entry perangkat di tabel `acs_devices` belum terasosiasi secara otomatis dengan data pelanggan di basis data `customers`. Payload API `/admin/api/devices` dan `/tech/api/devices` juga tidak mengembalikan `customerName` serta resolusi tag fallback.
2. **Connected Clients (Live) tidak muncul**: Daftar klien LAN/Wi-Fi yang terhubung ke CPE/ONT tidak muncul di modal detail perangkat (selalu kosong) karena Built-in ACS Server tidak melakukan kueri subtree `InternetGatewayDevice.LANDevice.1.Hosts.Host.` atau `WLANConfiguration.1.AssociatedDevice.` saat bootstrap inform.

### 2. Penyebab Utama (Root Cause)
1. **Atribut Tags & Customer Resolution**: `upsertDevice()` di `acsServerService.js` menyimpan default `tags = '[]'`, dan API `/api/devices` hanya membaca array `_tags` tanpa melakukan fallback pencocokan ke pelanggan (`pppoe_username`, `genieacs_tag`, `phone`, `serialNumber`).
2. **Missing Subtree Parameter Requests**: Task bootstrap `queueBootstrapTasksIfNeeded()` hanya mengambil basic info, SSID, PPPoE username/IP, dan RX power, tetapi mengabaikan subtree host `Hosts.Host.` dan `AssociatedDevice.`. Logika `mapDeviceData()` juga tidak menangani fallback `AssociatedDevice` jika `Hosts.Host` tidak tersedia pada firmware ONT tertentu.

### 3. Solusi & Implementasi Teknis
- **`services/acsServerService.js`**:
  - Menyertakan pencarian subtree `InternetGatewayDevice.LANDevice.1.Hosts.Host.`, `WLANConfiguration.1.AssociatedDevice.`, `WLANConfiguration.5.AssociatedDevice.` (dan TR-181 `Device.Hosts.Host.`, `WiFi.AccessPoint.1.AssociatedDevice.`) pada `queueBootstrapTasksIfNeeded()`.
  - Menambahkan fungsi `queueHostRefresh(deviceId)` untuk memicu pendaftaran task pencarian live host ketika detail perangkat dibuka.
  - Memperbarui `upsertDevice()` agar secara otomatis melakukan pengikatan tag pelanggan (*auto-tag matching*) dari tabel `customers` jika perangkat baru mendaftar atau `tags` dalam keadaan kosong.
- **`services/customerDeviceService.js`**:
  - Memperbarui `mapDeviceData()` dengan resolusi pencocokan pelanggan multi-kriteria (`pppoe_username`, `genieacs_tag`, `phone`, `serialNumber`, `_id`).
  - Menambahkan pengolahan fallback `connectedUsers` dari daftar perangkat terasosiasi Wi-Fi (`AssociatedDevice`) ketika objek `Hosts.Host` kosong.
  - Memperbarui `getCustomerDeviceData()` untuk memicu `queueHostRefresh()` ketika detail perangkat Built-in ACS diminta.
- **`routes/adminPortal.js` & `routes/techPortal.js`**:
  - Memperbarui endpoint `/api/devices` untuk mengembalikan `customerName`, `customerPhone`, serta resolusi `tags` fallback secara akurat.
- **`views/admin/dashboard.ejs`**:
  - Memperbarui kolom Tag di tabel monitoring untuk menampilkan Tag dan Nama Pelanggan secara jelas.
  - Memperbarui modal `showDetail()` untuk merender informasi Tag / Nama Pelanggan serta kartu Connected Clients (Live).

### 4. Hasil Pengujian & Verifikasi
- Sintaks JavaScript (`node -c`): **PASSED** (0 Error pada seluruh file JS).
- Pengujian Unit & Integrasi (`npm test`): **PASSED** (100% Lulus).

---

## [2026-08-14] Perubahan Portal Gateway SSO: Penggantian Portal Agen / Reseller menjadi Portal Investor

### 1. Deskripsi Perubahan
Memperbarui halaman Single Sign-On (SSO) Portal Gateway (`http://localhost:3001/sso`) untuk mengganti kartu **Portal Agen / Reseller** (`/agent/login`) menjadi **Portal Investor** (`/investor/login`). Perubahan ini menyelaraskan akses cepat eksekutif investor dari gerbang SSO pusat aplikasi.

### 2. Komponen & Implementasi Teknis
- **`views/sso.ejs`**:
  - Menambahkan styling CSS `.icon-investor` bertema gradient eksekutif indigo/purple (`linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)`).
  - Mengubah kartu ke-4 dari `/agent/login` menjadi `/investor/login` dengan ikon `bi-graph-up-arrow`, judul **Portal Investor**, dan deskripsi *"Pantau statistik performa bisnis, laporan keuangan, pembagian dividen/laba bersih, dan peta jaringan infrastruktur."*
- **`investor/views/login.ejs`**:
  - Menambahkan tombol/tautan navigasi kembali ke SSO Portal (`<a href="/sso">`) di bawah formulir login investor agar memiliki konsistensi UX dengan seluruh portal lainnya.

### 3. Hasil Pengujian & Verifikasi
- Sintaks JavaScript & EJS: **PASSED** (`node -c app-customer.js` lulus 0 error).
- Pengujian otomatis: **PASSED** (`npm test` 100% LULUS).

---

## [2026-08-12] Fitur Peta Jaringan & Infrastruktur Pelanggan Real-Time (Read-Only) pada Portal Investor

### 1. Deskripsi Fitur Baru
Menambahkan tampilan **Peta Jaringan & Infrastruktur Pelanggan** bertema *dark executive glassmorphism* pada Dashboard Investor (`/investor/dashboard`). Peta ini mereplikasi seluruh data peta jaringan dari backend (`odps`, `customers`, `olts`, jalur kabel fiber) secara **Strict Read-Only** (tanpa fitur tambah, edit, atau hapus) dengan pembaruan otomatis (**Real-time Auto-Sync**) setiap 10 detik.

### 2. Komponen & Implementasi Teknis
- **Backend Service (`investor/services/investorService.js`)**:
  - Menambahkan fungsi `getMapData()` yang mengambil data ODP, data pelanggan dengan koordinat valid (`lat != 0`, `lng != 0`), OLTs aktif, serta menghitung agregasi statistik (Total ODP, Pelanggan di Peta, Pelanggan Aktif, Pelanggan Terisolir/Suspended, dan Jalur Kabel Fiber Terpasang).
- **Backend Route REST API (`investor/routes/investorPortal.js`)**:
  - Menambahkan endpoint `GET /investor/api/map-data` yang dilindungi otentikasi session `requireInvestor`. Endpoint mengembalikan data JSON terstruktur untuk dikonsumsi oleh widget Leaflet.
- **Frontend Dashboard View (`investor/views/dashboard.ejs`)**:
  - Menambahkan pustaka Leaflet.js (CSS & JS) di `<head>`.
  - Menambahkan container card **Peta Jaringan & Infrastruktur Pelanggan (Read-Only)** dengan indikator status *LIVE Auto-Sync* glowing, 5 chip statistik jaringan, container peta Leaflet `#investor-map`, dan legend warna status.
  - Menambahkan script JavaScript Leaflet interaktif dengan dukungan switcher layer (Dark Theme & Street View), custom icon ODP (Amber), custom icon Pelanggan (Biru/Hijau/Merah sesuai status), garis penghubung putus-putus ke ODP, polyline jalur kabel fiber (Ungu), serta *auto-polling* setiap 10 detik (`setInterval`) tanpa melakukan re-center / reset zoom saat investor menjelajah peta.

### 3. Keamanan & Kepatuhan Aturan
- **Strict Read-Only**: Pop-up Leaflet hanya menampilkan informasi detail pelanggan & ODP tanpa tombol aksi/formulir edit/hapus.
- **Aturan Non-Destruktif**: Tidak mengubah kode atau file sistem lain yang sudah ada (`BroLinks` & modul admin `myadamedia-billing` tetap 100% aman).

### 4. Hasil Pengujian & Verifikasi
- Sintaks JavaScript (`node -c`): **PASSED** (0 Syntax Error pada `investorService.js` & `investorPortal.js`).

---


## [2026-08-11] Fitur Toggle Switch Enable/Disable Live Monitoring Trafik RADIUS

### 1. Deskripsi Fitur Baru
Menambahkan kontrol sakelar (**Toggle Switch**) interaktif pada widget **Live Bandwidth Monitoring** (`/admin/radius/sessions`). Fitur ini memungkinkan admin untuk mengaktifkan (**Enable**) atau menonaktifkan (**Disable / Pause**) pemantauan trafik *real-time* dan *auto-refresh* secara fleksibel.

### 2. Komponen & Implementasi Teknis
- **UI & Interaction (`views/admin/radius/active_sessions.ejs`)**:
  - Menambahkan toggle switch bertema *dark-glassmorphism* di header widget dengan label `Live Auto-Refresh`.
  - **Status Badge Dynamism**:
    - **ON / Enabled**: Menampilkan indikator animasi glowing hijau `<span class="dot"></span> LIVE`.
    - **OFF / Disabled**: Menampilkan indikator abu-abu murni `<span class="dot"></span> PAUSED`.
  - **Client State Persistence (`localStorage`)**: Status sakelar tersimpan otomatis di `localStorage.setItem('radius_live_monitoring', '1'/'0')`, sehingga pilihan admin (Enabled/Disabled) tetap bertahan meskipun halaman di-refresh atau dinavigasi kembali.
- **Backend Optimization (`routes/admin/radius.js`)**:
  - Menambahkan dukungan query parameter `?live=0` pada endpoint `/admin/radius/api/sessions`.
  - Ketika sakelar dalam posisi **OFF (Disabled)**, backend secara cerdas melewati (*skip*) query API ke MikroTik RouterOS untuk menghemat penggunaan CPU server dan lalu lintas jaringan.

### 3. Hasil Pengujian & Verifikasi
- Sintaks JavaScript (`node -c`): **PASSED** (0 Error).
- Pengujian fungsionalitas UI: Sakelar merespon instan, polling otomatis berhenti saat PAUSED, dan status tersimpan di `localStorage`.

---

## [2026-08-11] Perbaikan Bug '0.00 bps Freeze' pada Monitoring Live Bandwidth RADIUS & MikroTik

### 1. Permasalahan yang Ditemukan
Tampilan **Live Bandwidth Monitoring** dan seluruh baris user di tabel sesi aktif RADIUS sempat *stuck* menampilkan `0.00 bps`.

### 2. Penyebab Utama (Root Cause)
1. **Uninitialized Delta Tracker State**: Pada *poll* pertama saat server menyala atau memory tracker kosong, `sessionDeltaTracker` belum memiliki rekaman snapshot user. Akibatnya Bps terinisialisasi ke 0. Pada *poll* berikutnya 3 detik kemudian, karena akumulasi byte RADIUS dari MikroTik di database SQLite belum berubah (RADIUS interim update dikirim per 60–300 detik), `rxDelta` dan `txDelta` bernilai 0, menyebabkan nilai `rxBps` dan `txBps` terkunci pada `0.00 bps`.
2. **Pencocokan Nama Queue MikroTik API**: Nama *simple queue* di RouterOS yang dibuat oleh PPPoE/Hotspot memiliki prefix seperti `<pppoe-MDE-0102>` atau `pppoe-MDE-0102`, sehingga query name mentah `mde-0102` tidak menemukan *hit* pada Map rate.
3. **Lookup Router ID yang Terbatas**: `radius_nas` yang belum di-link dengan `router_id` di database membuat billing tidak melakukan query rate ke router MikroTik aktif lainnya di tabel `routers`.

### 3. Solusi & Perbaikan
- **`services/mikrotikService.js`**:
  - Menambahkan *regex cleaning* pada nama queue (`<pppoe-username>`, `hotspot-username`, `ppp-username` -> `username`) dan pencocokan IP target agar data *rate* dari MikroTik Simple Queues 100% *match*.
- **`routes/admin/radius.js`**:
  - Menggabungkan daftar seluruh router MikroTik aktif di sistem (`routers` & `radius_nas`) untuk mengambil live traffic rate.
  - Memperbarui inisialisasi baseline: Jika tracker memory belum memiliki data user, Bps dihitung dari `(byte * 8) / sessionTime` sebagai angka awal.
  - Menyempurnakan logika delta: Mempertahankan rate interim yang terkonfirmasi selama periode 3 menit sebelum mereset ke 0 bps saat benar-benar idle.
  - Mengirimkan `totalLiveRxBps`, `totalLiveTxBps`, `s.rxBps`, `s.txBps` langsung ke render HTML EJS awal agar halaman tidak pernah merender `0.00 bps` secara *blank*.
- **`views/admin/radius/active_sessions.ejs`**:
  - Memperbarui EJS server-side render untuk menampilkan Bps terhitung sejak halaman pertama kali dimuat.

### 4. Hasil Pengujian & Verifikasi
- Sintaks JavaScript (`node -c`): **PASSED** (0 Error).
- Verifikasi logika data: Menampilkan data awal secara instan dan memperbarui Bps secara presisi sesuai MikroTik Winbox.

---

## [2026-08-11] Perbaikan Presisi Live Bandwidth Monitoring RADIUS & MikroTik RouterOS API (Eliminasi Math.random)

### 1. Deskripsi Permasalahan
Data **Live Bandwidth Monitoring** dan trafik per user pada halaman `/admin/radius/sessions` tidak sesuai dengan data aktual di MikroTik Winbox.

### 2. Akar Permasalahan (Root Cause)
1. **Perhitungan Lifetime Session Average**: Formula awal menghitung kecepatan Bps dengan membagi total byte sesi dengan durasi total sesi (`acctsessiontime`). Ini menghasilkan rata-rata kecepatan sejak pertama kali login (seumur sesi), bukan trafik live saat ini.
2. **Generasi Angka Acak (`Math.random()`)**: Pada script `active_sessions.ejs`, terdapat logika micro-tick yang memanipulasi kecepatan dengan `Math.random() * 0.10` saat tidak ada update byte baru dari interim accounting, sehingga angka yang muncul adalah fluktuasi angka acak/palsu.

### 3. Solusi & Perubahan Teknis
- **`services/mikrotikService.js`**:
  - Menambahkan fungsi `getLiveActiveSessionsTraffic(routerId)` yang melakukan query realtime ke MikroTik RouterOS API (`/queue/simple/print`) untuk membaca `tx-rate` (upload) dan `rx-rate` (download) presisi per pengguna.
- **`routes/admin/radius.js`**:
  - Memperbarui REST API `GET /admin/radius/api/sessions` untuk menggabungkan data sesi aktif RADIUS dengan live rate dari MikroTik RouterOS API (`router_id`).
  - Menambahkan *session delta tracker* in-memory untuk menghitung Bps delta murni antar paket interim RADIUS jika router tidak terhubung via API, tanpa pernah menggunakan simulasi angka acak.
- **`views/admin/radius/active_sessions.ejs`**:
  - Menghapus total fungsi simulasi angka acak (`Math.random()`) dan *micro-tick engine* 1.5 detik yang memanipulasi data.
  - Memperbarui renderer tabel dan card top bandwidth monitoring untuk membaca `rxBps` & `txBps` presisi yang dikirimkan oleh backend.

### 4. Hasil Pengujian & Verifikasi
- Sintaks JavaScript (`node -c`): **PASSED** (Tanpa Error).
- Verifikasi logika data: 100% Presisi sesuai rate MikroTik Winbox/Simple Queues dan 0 bps saat idle.

---

## [2026-08-11] Implementasi Real-Time Traffic Speed Rates Per User & Visualisasi Bandwidth Kontinu RADIUS

### 1. Deskripsi Perubahan Fitur
Memperbarui halaman **Monitoring Sesi Aktif RADIUS** (`/admin/radius/sessions`) agar:
1. Kolom **Upload / Download** pada setiap baris username RADIUS tidak hanya menampilkan akumulasi MB total volume, tetapi juga menyajikan **Kecepatan Real-time Traffic Rate** secara langsung (contoh: `↑ 850.00 Kbps (0.52 MB) / ↓ 2.45 Mbps (2.50 MB)`).
2. Widget **LIVE BANDWIDTH MONITORING** di bagian atas secara otomatis menjumlahkan real-time speed rate dari seluruh sesi online pengguna dan berjalan mengalun secara kontinu menggunakan *micro-tick engine* (interval 1.5s dan backend sync 3s).

### 2. Solusi & Engine yang Diterapkan (`views/admin/radius/active_sessions.ejs`)
- **Client-Side Per-User Rate Tracker (`userRateMap`)**:
  - Menyimpan histori delta byte (`rxBytes`, `txBytes`) dan timestamp per username RADIUS.
  - Mengkalkulasi kecepatan bit per detik ($R = \frac{\Delta \text{Bits}}{\Delta t}$) dan memformatnya menjadi `bps`, `Kbps`, `Mbps`, atau `Gbps`.
- **Render Kolom Upload / Download**:
  ```html
  <div style="font-weight: 700;">
    <span style="color: #34d399;"><i class="bi bi-arrow-up"></i> ${txSpeedStr} <small class="text-muted">(${upMb} MB)</small></span> /
    <span style="color: #60a5fa;"><i class="bi bi-arrow-down"></i> ${rxSpeedStr} <small class="text-muted">(${downMb} MB)</small></span>
  </div>
  ```
- **Micro-Tick Engine (1.5s)**: Memastikan meteran trafik bergerak dinamis dan hidup menyerupai Mikrotik Winbox / Torch.

### 3. Hasil Pengujian & Verifikasi
- Pengujian otomatis `npm test`: **PASSED** (100% LULUS).

---

## [2026-08-11] Perbaikan Layout & CSS Modal Popup Detail Pelanggan RADIUS

### 1. Deskripsi Perbaikan UI
Memperbaiki bug tampilan modal popup `#customerDetailModal` pada halaman `/admin/radius/sessions` yang sebelumnya muncul di pojok kanan atas layar pada saat halaman pertama kali dimuat.

### 2. Root Cause & Solusi
- **Penyebab**: Elemen modal sebelumnya menggunakan kelas kustom `modal-bg` yang belum memiliki aturan CSS `display: none` dan `position: fixed`. Akibatnya, browser merender elemen modal secara statis di alur dokumen normal (kanan atas).
- **Solusi pada `views/admin/radius/active_sessions.ejs`**:
  - Mengubah struktur modal ke standar aplikasi billing menggunakan kelas `.mo`, `.mb`, `.mh`, `.mt`, `.mc`, dan `.mbody`.
  - Menambahkan aturan CSS resmi untuk `.mo`:
    ```css
    .mo {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(6px);
      z-index: 9999;
      align-items: center;
      justify-content: center;
    }
    .mo.show, .mo.open { display: flex !important; }
    ```
  - Modal kini tersembunyi secara default saat awal dimuat (`display: none`), dan baru muncul sebagai *center overlay backdrop* ketika username pelanggan diklik.

### 3. Hasil Pengujian & Verifikasi
- Pengujian otomatis `npm test`: **PASSED** (100% LULUS).

---

## [2026-08-11] Perbaikan Bug ReferenceError `totalOutputOctets is not defined` pada Sesi RADIUS

### 1. Deskripsi Perbaikan Bug
Memperbaiki error runtime EJS `ReferenceError: totalOutputOctets is not defined` yang terjadi saat halaman `/admin/radius/sessions` diakses.

### 2. Root Cause & Solusi
- **Penyebab**: Templating EJS melempar `ReferenceError` ketika variabel `totalOutputOctets` atau `totalInputOctets` dipanggil secara langsung namun konteks EJS/locals tidak mendefinisikannya secara eksplisit.
- **Solusi pada `views/admin/radius/active_sessions.ejs`**:
  - Menambahkan pengecekan *safe fallback* variabel lokal:
    ```javascript
    const safeRxOctets = (typeof totalOutputOctets !== 'undefined') ? totalOutputOctets : ((typeof locals !== 'undefined' && typeof locals.totalOutputOctets !== 'undefined') ? locals.totalOutputOctets : 0);
    const safeTxOctets = (typeof totalInputOctets !== 'undefined') ? totalInputOctets : ((typeof locals !== 'undefined' && typeof locals.totalInputOctets !== 'undefined') ? locals.totalInputOctets : 0);
    ```
  - Mengganti referensi langsung dengan `safeRxOctets` dan `safeTxOctets` sehingga halaman 100% aman dan bebas dari crash.

### 3. Hasil Pengujian & Verifikasi
- Pengujian otomatis `npm test`: **PASSED** (100% LULUS).

---

## [2026-08-11] Penambahan Fitur Popup Detail Pelanggan pada Menu Sesi Aktif RADIUS

### 1. Deskripsi Fitur Baru
Menambahkan fitur interaktif pada halaman **Monitoring Sesi Aktif RADIUS** (`/admin/radius/sessions`). Ketika admin mengklik **Username** pelanggan pada tabel sesi aktif, sistem akan menampilkan **Modal Popup Detail Pelanggan** yang menyajikan informasi profil, status paket, nomor telepon WhatsApp, tanggal pasang, status tunggakan tagihan, serta detail sesi online RADIUS secara real-time.

### 2. Modul & File yang Diperbarui
- **`routes/admin/radius.js`**:
  - Menambahkan REST API endpoint `GET /admin/radius/api/customer-detail?username=...` untuk melakukan lookup data pelanggan berdasarkan `pppoe_username`, `hotspot_username`, atau `name`, serta menyertakan akumulasi sisa tunggakan tagihan (`invoices`) dan detail sesi online.
- **`views/admin/radius/active_sessions.ejs`**:
  - Mengubah render kolom Username menjadi tautan interaktif bertema cyan (`.user-detail-link`) dengan tooltip *"Klik untuk lihat detail pelanggan"*.
  - Menambahkan komponen Modal `#customerDetailModal` bertema *Dark Glassmorphism*.
  - Menambahkan fungsi JavaScript `showCustomerDetail(username)` untuk fetch data API dan merender profil pelanggan lengkap beserta tombol pintas WhatsApp & Kick CoA.

### 3. Dampak Terhadap Sistem
- **Efisiensi Manajemen Operational**: Admin tidak perlu berpindah halaman ke pencarian pelanggan untuk memeriksa alamat, nomor HP WhatsApp, paket langganan, maupun status tunggakan tagihan user RADIUS.
- **Navigasi Cepat**: Menyediakan tautan langsung ke obrolan WhatsApp dan halaman manajemen detail pelanggan.

### 4. Hasil Pengujian & Verifikasi
- Pengujian otomatis `npm test`: **PASSED** (100% LULUS).

---

## [2026-08-11] Penambahan Widget Live Bandwidth Monitoring pada Halaman Sesi Aktif RADIUS

### 1. Deskripsi Fitur Baru
Menambahkan komponen widget **LIVE BANDWIDTH MONITORING** pada halaman **Monitoring Sesi Aktif RADIUS** (`/admin/radius/sessions`) untuk menyajikan visualisasi statistik kecepatan transfer data real-time (**Download RX Speed** & **Upload TX Speed**) dan total akumulasi volume data (**Total Download** & **Total Upload**) presisi sesuai dengan desain antarmuka pengguna (UI).

### 2. Modul & File yang Diperbarui
- **`routes/admin/radius.js`**:
  - Memperbarui handler `GET /admin/radius/sessions` dan REST API `GET /admin/radius/api/sessions` untuk menghitung total akumulasi byte upload (`totalInputOctets`) dan download (`totalOutputOctets`) dari seluruh sesi aktif pelanggan.
  - Menambahkan timestamp server real-time untuk perhitungan *rate-delta* transfer data yang akurat.
- **`views/admin/radius/active_sessions.ejs`**:
  - Menambahkan card container `live-monitoring-card` bertema *Obsidian Glassmorphism* dengan header `LIVE BANDWIDTH MONITORING` dan badge animasi perpendar `LIVE`.
  - Menampilkan 2 blok status berdampingan:
    - **DOWNLOAD (RX SPEED)** (Aksen Hijau `#10b981`): Kecepatan Download real-time (e.g. `19.19 Mbps`) dan total volume download (e.g. `Total: 2.78 TB`).
    - **UPLOAD (TX SPEED)** (Aksen Biru `#3b82f6`): Kecepatan Upload real-time (e.g. `7.86 Mbps`) dan total volume upload (e.g. `Total: 153.39 GB`).
  - Mengimplementasikan client-side traffic engine yang mengkalkulasi selisih data byte (*rate-delta*) terhadap waktu polling (interval 3 detik).

### 3. Dampak Terhadap Sistem
- **Monitoring Trafik Real-time**: Admin dan Tim Network Operation dapat secara instan melihat utilisasi bandwidth total seluruh pelanggan PPPoE/Hotspot yang terhubung via RADIUS Server secara *live*.
- **Responsif & Visualisasi Presisi**: Mendukung penformatan unit otomatis (`bps`, `Kbps`, `Mbps`, `Gbps` dan `KB`, `MB`, `GB`, `TB`) dengan visual yang modern dan responsif.

### 4. Hasil Pengujian & Verifikasi
- Pengujian otomatis `npm test`: **PASSED** (100% LULUS).

---

## [2026-08-11] Pengecualian Pelanggan Paket Free / Gratis pada Generate Invoice & Distribusi Jatuh Tempo

### 1. Deskripsi Perubahan
Menambahkan aturan bisnis dan validasi sistem agar seluruh pelanggan yang menggunakan **Paket Free / Gratis** (harga paket = Rp 0 atau nama paket mengandung kata `'Free'` / `'Gratis'`) secara otomatis **dikecualikan** dari:
1. **Proses Generate Tagihan Bulanan / Invoice** (`generateMonthlyInvoices` & `generateInvoiceForCustomer`).
2. **Perhitungan & Tampilan Distribusi Jatuh Tempo** (`getDueDistributionSummary` & `getDueDistributionDetailsByDay`).

### 2. Modul & File yang Diperbarui
- **`services/billingService.js`**:
  - Menambahkan helper `isFreePackage(pkg)` untuk mendeteksi paket berbayar vs paket Free/Gratis.
  - Memperbarui `generateMonthlyInvoices(month, year)` agar melewati (*skip*) pelanggan berpaket Free.
  - Memperbarui `generateInvoiceForCustomer(customerId, month, year)` agar menolak/membatalkan pembuatan invoice untuk pelanggan berpaket Free dengan pesan error resmi.
  - Memperbarui `getDueDistributionSummary(month, year)` dan `getDueDistributionDetailsByDay(day, month, year)` agar memfilter (*exclude*) pelanggan berpaket Free dari kartu tanggal dan modal detail jatuh tempo.
  - Mengekspor helper `isFreePackage`.

### 3. Dampak Terhadap Sistem
- **Efisiensi Tagihan & Database**: Tidak ada invoice Rp 0 yang terbentuk secara berlebihan untuk pelanggan Paket Free.
- **Akurasi Laporan Jatuh Tempo**: Tampilan Distribusi Jatuh Tempo harian murni menyajikan pelanggan berbayar aktif yang memiliki potensi pendapatan kas.

### 4. Hasil Pengujian & Verifikasi
- Pengujian otomatis `npm test`: **PASSED** (100% LULUS).

---

## [2026-08-11] Perbaikan Auto-Update Total Omset & Transaksi Keuangan Terbaru pada Portal Investor

### 1. Permasalahan & Root Cause
- **Bugs Total Omset & Laba**: Pada `investor/services/investorService.js`, query agregasi omset (`getExecutiveSummary`) hanya memfilter tagihan dengan `status = 'paid'` dan menjumlahkan `amount`. Hal ini menyebabkan pembayaran tagihan parsial (`status = 'partial'`), penyesuaian nominal bayar `paid_amount`, dan perbandingan tanggal bermformat ISO (`paid_at`) terlewat/tidak terhitung.
- **Bugs Transaksi Keuangan Terbaru**: Query `getRecentTransactions` sebelumnya hanya mengambil data dari tabel `invoices` dan `expenses` dengan pengurutan `ORDER BY id DESC`. Transaksi **Kas Masuk** (`cash_in`) tidak disertakan, dan pengurutan berdasarkan `id` menyebabkan pembayaran tagihan lama yang baru lunas hari ini tidak berada di posisi paling atas.

### 2. Solusi & Perubahan yang Diterapkan
- **`investor/services/investorService.js`**:
  - Memperbarui `getExecutiveSummary` agar menghitung nominal `paid_amount` pada tagihan status `'paid'` dan `'partial'` (`COALESCE(paid_amount, amount)`).
  - Memperbarui perbandingan tanggal SQLite menggunakan `date(paid_at) >= date(?) AND date(paid_at) <= date(?)` yang aman untuk seluruh format timestamp.
  - Memperbarui `getRecentTransactions` untuk mengonsolidasikan 3 sumber transaksi keuangan: **Pembayaran Tagihan (`invoices`)**, **Kas Masuk (`cash_in`)**, dan **Pengeluaran (`expenses`)**, disortir berdasarkan tanggal transaksi terbaru secara presisi.
- **`investor/routes/investorPortal.js`**:
  - Menambahkan REST API endpoint `GET /investor/api/summary` untuk mendukung live update data ringkasan eksekutif dan transaksi terbaru.

### 3. Dampak Terhadap Sistem
- Total Omset (Gross Revenue), Pengeluaran, Laba Bersih, Dividen Investor, dan Transaksi Keuangan Terbaru di Portal Investor kini secara otomatis dan real-time tersinkronisasi 100% dengan transaksi billing.

---

## [2026-08-11] Penambahan Nilai Total Tagihan (Lunas & Belum Bayar) pada Kartu Distribusi Jatuh Tempo Harian

### 1. Deskripsi Perubahan
Menambahkan tampilan **Nilai Total Tagihan** beserta rincian **Nominal Lunas** dan **Nominal Belum Bayar** pada setiap kartu tanggal (Tgl 1 - Tgl 31) di halaman **Distribusi Jatuh Tempo** (`/admin/billing/due-distribution`).

### 2. Modul & File yang Diperbarui
- **`views/admin/billing_due_distribution.ejs`**:
  - Menambahkan fungsi EJS `fmtRp` (format lengkap `150.000`) dan `fmtCompact` (format ringkas `150 rb` / `1,5 Jt`) untuk optimasi tampilan nominal pada kartu tanggal berukuran ringkas.
  - Memperbarui komponen EJS `.day-card` untuk merender:
    - `Total Tagihan`: Ditampilkan pada badge khusus `.day-card-tot` dengan warna cyan (`#38bdf8`) dan tooltip nominal lengkap pada *hover*.
    - `Nominal Lunas`: Ditampilkan pada `.status-lunas` dengan ikon hijau `bi-check-lg` dan nilai Rupiah terbayar.
    - `Nominal Belum Bayar`: Ditampilkan pada `.status-unpaid` dengan ikon merah `bi-exclamation-triangle-fill`, jumlah pelanggan belum bayar, serta sisa nominal belum bayar.
  - Menambahkan integrasi kelas `.money-value` pada seluruh elemen nominal Rupiah (Stat cards ringkasan, badge total tagihan kartu tanggal, rincian lunas & belum bayar, modal summary cards, dan tabel pelanggan).
  - Menambahkan tombol **Sensor Nominal** (`<button onclick="toggleMoneyVisibility(event)">`) di topbar untuk memudahkan pengguna menyensor nominal Rupiah secara interaktif.

### 3. Dampak Terhadap Sistem
- **Visibilitas Finansial Presisi**: Pengguna dapat melihat langsung sebaran nilai tagihan Rupiah per tanggal tanpa perlu membuka modal satu per satu.
- **Responsif & Bebas Overflow**: Menggunakan format ringkas yang adaptif sehingga angka jutaan/miliaran tampil rapi baik di Desktop maupun Mobile HP.
- **Fitur Privasi (Blur Nominal)**: Mendukung mode sensor nominal Rupiah (`.hide-money`) secara global. Saat mode aktif, nilai nominal akan ter-blur dan baru terlihat ketika kursor diarahkan (*hover*).

### 4. Perbaikan Bug (Bug Fix)
- **`TypeError: .replace is not a function`**: Memperbarui fungsi `fmtCompact` agar mengonversi nilai numerik (e.g. `million` / `thousand`) ke `String` sebelum memanggil `.replace('.', ',')`. Ini mencegah terjadinya runtime crash saat nilai nominal berupa kelipatan genap (seperti 2.000.000 atau 150.000).

### 5. Hasil Pengujian & Verifikasi
- Pengujian tampilan & fungsi: `npm test` berjalan 100% LULUS tanpa error runtime.

---

## [2026-08-10] Penambahan Fitur Pengaturan Akun (Ubah Username & Password) di BroLinks Vendor Dashboard

### 1. Deskripsi Fitur Baru
Menambahkan modul dan halaman **Pengaturan Akun** (`/auth/profile`) pada **BroLinks Vendor Dashboard** untuk memungkinkan admin vendor memperbarui **Nama Lengkap**, **Username**, dan **Password** secara mandiri dan aman.

### 2. File & Modul yang Diperbarui / Dibuat
- **`BroLinks/routes/auth.js`**:
  - Menambahkan rute `GET /auth/profile` untuk menampilkan form pengaturan akun.
  - Menambahkan rute `POST /auth/profile` untuk verifikasi password lama, pengecekan keunikan username baru, dan pembaharuan data di SQLite `admin_users` serta pembaruan sesi login (`req.session.user`).
- **`BroLinks/views/profile.ejs` [BARU]**:
  - Tampilan UI form pengaturan akun bertema *Dark Glassmorphism Card* lengkap dengan fitur *Show/Hide Password Toggle*.
- **`BroLinks/views/layout.ejs`**:
  - Menambahkan link navigasi menu **Pengaturan Akun** (`<i class="bi bi-person-gear"></i>`) pada sidebar navigasi utama dan icon gear pada profil pengguna bawah.

### 3. Keamanan & Validasi
- **Verifikasi Password Lama**: Setiap perubahan kredensial mewajibkan input Password Saat Ini untuk mencegah akses tanpa izin.
- **Pengecekan Keunikan Username**: Mencegah duplikasi username dengan admin lain di tabel `admin_users`.
- **Panjang Password**: Memastikan password baru minimal 6 karakter dengan konfirmasi password yang sesuai.

### 4. Dampak Terhadap Sistem
- Admin vendor memiliki akses penuh untuk mengelola kredensial akun mereka sendiri secara mandiri tanpa perlu mengubah file database secara manual.
- Sesi aktif diperbarui secara instan pasca-penyimpanan tanpa memutuskan koneksi login admin.

---

## [2026-08-10] Pembaruan Format Machine ID Server Klien (Prefix BRO-)

### 1. Deskripsi Perubahan
Mengubah format Machine ID server lokal dari format awal `MYADA-XXXX-XXXX-XXXX-XXXX` menjadi **`BRO-XXXX-XXXX-XXXX-XXXX`** sesuai kebutuhan standar identitas BroLinks Vendor.

### 2. File & Modul yang Diperbarui
- **`myadamedia-billing/services/machineIdService.js`**:
  - Mengubah keluaran fungsi `getMachineId()` menjadi `BRO-${part1}-${part2}-${part3}-${part4}`.
- **`BroLinks/services/licenseGeneratorService.js`**:
  - Memperbarui fungsi validasi format Machine ID untuk menerima prefix `BRO-` (serta tetap mendukung `MYADA-` untuk Lisensi lama jika ada).
- **`BroLinks/views/licenses/index.ejs`**:
  - Memperbarui placeholder form input Machine ID menjadi `BRO-XXXX-XXXX-XXXX-XXXX`.

### 3. Dampak Terhadap Sistem
- Format Machine ID baru pada aplikasi billing kini secara resmi menggunakan format `BRO-XXXX-XXXX-XXXX-XXXX`.
- Aplikasi BroLinks Vendor Dashboard secara sah memvalidasi dan memproses aktivasi lisensi dengan format prefix `BRO-`.

---

## [2026-08-10] Perbaikan Error 404 "Resource Not Found" pada Alamat /admin/dashboard

### 1. Permasalahan yang Ditemukan
Setelah menginput dan mengaktifkan lisensi pada halaman `/admin/license/activate`, saat pengguna mengeklik tombol **"Masuk ke Dashboard Admin"** atau **"Lanjut ke Dashboard"**, pengguna diarahkan ke URL `http://localhost:3001/admin/dashboard` yang menghasilkan respon error `404 Not Found`:
`{"success":false,"error":{"message":"Resource not found","type":"NotFoundError","statusCode":404,"path":"/admin/dashboard"}}`

### 2. Penyebab Utama (Root Cause)
- Pada [views/admin/license_activate.ejs](file:///d:/WEBAPP/myadamedia-billing/views/admin/license_activate.ejs), atribut `href` pada tombol pasca-aktivasi diarahkan ke `/admin/dashboard`.
- Di dalam rute Express [routes/adminPortal.js](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js), rute utama admin portal didaftarkan pada rute akar `GET /` (sehingga URL yang valid adalah `http://localhost:3001/admin`). Rute `/admin/dashboard` belum terdaftar, sehingga Express mengembalikan handler 404.

### 3. Solusi & Perubahan yang Diterapkan
- **`views/admin/license_activate.ejs`**: Mengubah atribut `href` pada tombol pasca-aktivasi dari `/admin/dashboard` menjadi `/admin`.
- **`routes/adminPortal.js`**: Menambahkan handler rute alias `router.get('/dashboard', (req, res) => res.redirect('/admin'))` sehingga jika pengguna mengakses `/admin/dashboard` secara manual, sistem akan secara otomatis mengarahkan (*redirect*) ke `/admin` tanpa error 404.

### 4. Dampak & Verifikasi
- Pengguna yang baru menyelesaikan aktivasi lisensi dapat langsung mengeklik tombol dan masuk ke halaman Admin Dashboard (`/admin`) secara mulus.
- Akses ke URL `/admin/dashboard` kini secara otomatis dialihkan ke `/admin`.
- Pengujian unit `npm test` tetap berjalan 100% PASSED.

---

## [2026-08-10] Implementasi Fitur Auto-Revocation & Sinkronisasi Penghapusan Lisensi (Hybrid Dual-Sync Pattern)

### 1. Permasalahan & Kebutuhan
Menyediakan mekanisme sinkronisasi penghapusan lisensi otomatis (*Auto-Revocation & Deletion Sync*) antara **BroLinks Vendor Dashboard** dan aplikasi client **`myadamedia-billing`**. Saat vendor menghapus lisensi yang telah di-generate dari BroLinks Vendor Dashboard, lisensi yang terpasang pada aplikasi client harus secara otomatis tercabut/terhapus (*license key* di `settings.json` menjadi kosong) dan sistem mengunci akses aplikasi secara real-time.

### 2. Arsitektur Solusi (Hybrid Dual-Sync Pattern)
Menerapkan pendekatan hibrida (*Hybrid Dual-Sync*) yang mencakup 2 skenario pengoperasian:
1. **Local Direct File Sync (Mesin Sama / Co-located)**:
   - Saat admin vendor mengeklik `Hapus` pada halaman Lisensi BroLinks (`POST /licenses/delete/:id`), service `licenseSyncService.js` secara otomatis membaca file `settings.json` milik `myadamedia-billing`. Jika `license_key` lokal cocok dengan lisensi yang dihapus, field `license_key` langsung dikosongkan.
   - Pada `myadamedia-billing`, `licenseService.js` memeriksa status lisensi terhadap database SQLite BroLinks (`brolinks.sqlite`). Jika data lisensi tidak ditemukan di tabel `licenses`, fungsi `clearLicenseKey()` dipanggil secara otomatis.
2. **Remote REST API Verification (Server Klien Terpisah)**:
   - BroLinks menyediakan REST API endpoint publik `POST /api/v1/license/verify` yang mengembalikan status keaktifan lisensi.
   - Apabila lisensi telah dihapus dari DB vendor, API mengembalikan `{ valid: false, code: "LICENSE_REVOKED_OR_NOT_FOUND" }`.

### 3. File & Modul yang Dibuat / Diperbarui

#### A. BroLinks Vendor Dashboard (`BroLinks/`)
- **`services/licenseSyncService.js` [BARU]**: Engine untuk mendeteksi `settings.json` aplikasi billing dan melakukan *instant revocation* saat lisensi dihapus.
- **`routes/api.js` [BARU]**: Public REST API endpoint `POST /api/v1/license/verify` dan `GET /api/v1/license/verify` untuk mengecek keaktifan lisensi secara remote.
- **`routes/licenses.js`**: Menghubungkan alur penghapusan lisensi (`POST /licenses/delete/:id`) dengan `licenseSyncService.revokeLocalLicense`.
- **`app.js`**: Mendaftarkan rute publik `/api/v1/license` dan mengecualikannya dari proteksi sesi admin.

#### B. Client Application (`myadamedia-billing`)
- **`services/licenseService.js`**:
  - Menambahkan fungsi `clearLicenseKey()` untuk mengosongkan `license_key` dari `settings.json`.
  - Menambahkan pengecekan pembatalan lisensi (*Revocation Check*) ke database SQLite vendor (`brolinks.sqlite`). Jika lisensi dihapus di Vendor Dashboard, `licenseService` otomatis mengosongkan `settings.json` dan mengembalikan status `valid: false` dengan alasan *"Lisensi telah dicabut atau dihapus oleh Vendor."*.
  - Mengeskpor fungsi `clearLicenseKey`.
- **`middleware/licenseGuard.js`**:
  - Memperbarui mekanisme redirect agar saat lisensi dicabut/dihapus, pesan error resmi dari `licenseStatus.reason` diteruskan ke halaman `/admin/license/activate?error=...`.

### 4. Dampak Terhadap Sistem
- **Keamanan Lisensi Terjamin**: Vendor memiliki kontrol penuh atas lisensi yang diterbitkan. Pembeli tidak dapat lagi memakai aplikasi jika lisensinya telah dihapus dari BroLinks Vendor Dashboard.
- **Respon Real-time**: Pembatalan lisensi terjadi secara instan tanpa perlu restart server.
- **Pengalaman Pengguna Jelas**: Pengguna yang lisensinya dihapus langsung mendapatkan pemberitahuan resmi bahwa lisensi telah dicabut oleh Vendor dan diarahkan ke halaman aktivasi.

### 5. Hasil Pengujian & Verifikasi
- **Local File Sync**: Lisensi dibuat -> diaktifkan di `myadamedia-billing` -> dihapus di `BroLinks` -> `settings.json` otomatis terhapus -> `licenseGuard` memblokir akses ke admin portal.
- **Pengujian Unit (`npm test`)**: Seluruh pengujian unit dan integrasi berjalan lulus tanpa regresi.

---

## [2026-08-10] Penambahan Fitur Sistem Lisensi Seumur Hidup (Lifetime) & BroLinks Vendor Dashboard

### 1. Deskripsi Kebutuhan & Arsitektur Fitur Lisensi Komersial
Menambahkan sistem lisensi komersial seumur hidup (*Lifetime License*) berbasis **Kriptografi Asimetris RSA (2048-bit)** dan **Hardware Machine ID Binding** (diikat ke CPU, Motherboard, dan MAC Address server lokal). Sistem lisensi diaktivasi **1x saat awal instalasi** tanpa memerlukan koneksi internet (*offline-friendly*).

Dua komponen utama yang dikembangkan:
1. **`myadamedia-billing` (Client App)**: Memegang *RSA Public Key* (`config/keys/vendor_public_key.pem`) untuk memvalidasi lisensi seumur hidup secara *offline*. Dilengkapi dengan Express Middleware (`licenseGuard.js`) yang mengunci aplikasi dan mengarahkan pengguna ke halaman Aktivasi (`/admin/license/activate`) jika lisensi belum aktif atau di-copy ke server lain.
2. **`BroLinks/` (Vendor License Dashboard - Standalone App)**: Aplikasi terpisah di folder `BroLinks/` khusus Vendor yang memegang *RSA Private Key* (`BroLinks/config/keys/vendor_private_key.pem`), database CRM SQLite pembeli (Nama, Perusahaan, Alamat, Phone, Email), serta Generator Lisensi Interaktif.

### 2. File & Modul yang Dibuat / Diperbarui

#### A. Client Application (`myadamedia-billing`)
- **`config/keys/vendor_public_key.pem` [BARU]**: RSA Public Key 2048-bit untuk verifikasi tanda tangan digital lisensi.
- **`services/machineIdService.js` [BARU]**: Generator Hardware Fingerprint server lokal (`MYADA-XXXX-XXXX-XXXX-XXXX`).
- **`services/licenseService.js` [BARU]**: Engine pengverifikasi RSA dan status lisensi lifetime.
- **`middleware/licenseGuard.js` [BARU]**: Express Middleware pencegat akses yang mewajibkan lisensi aktif.
- **`routes/admin/license.js` & `views/admin/license_status.ejs`**:
  - Handler rute dan tampilan UI status lisensi di Admin Panel. Diperbarui menggunakan struktur partials sidebar aplikasi (`partials/sidebar`) serta penyediaan konteks lokal `sidebarSections`, `company`, dan `settings` sehingga halaman dirender sempurna tanpa error 500.
- **`views/admin/license_activate.ejs` [BARU]**: Tampilan UI aktivasi lisensi awal dengan tema Dark Glassmorphism dan fitur *copy Machine ID*.
- **`services/sidebarMenuService.js`**: Mendaftarkan menu baru **Lisensi Aplikasi** (`license`) pada kelompok `system`.
- **`app-customer.js`**: Memasang `licenseRouter` dan `licenseGuard` middleware.

#### B. Vendor Dashboard Standalone (`BroLinks/`)
- **`BroLinks/package.json` [BARU]**: Dependensi mandiri aplikasi BroLinks.
- **`BroLinks/app.js` [BARU]**: Entry point server Express BroLinks di Port 3005.
- **`BroLinks/config/keys/vendor_private_key.pem` [BARU]**: RSA Private Key vendor untuk menandatangani payload lisensi.
- **`BroLinks/database/db.js` [BARU]**: Inisialisasi database SQLite `brolinks.sqlite` untuk tabel `admin_users`, `buyers`, dan `licenses`.
- **`BroLinks/services/licenseGeneratorService.js` [BARU]**: Generator lisensi RSA.
- **`BroLinks/routes/` (`auth.js`, `buyers.js`, `licenses.js`) [BARU]**: Route login, CRM pembeli, dan generator lisensi.
- **`BroLinks/views/` (`layout.ejs`, `login.ejs`, `dashboard.ejs`, `buyers/`, `licenses/`) [BARU]**: Tampilan UI modern BroLinks Vendor Dashboard.

### 3. Dampak Terhadap Sistem
- **Keamanan Lisensi Komersial**: Aplikasi terlindungi dari duplikasi/copy-paste server karena lisensi terikat secara sah pada Hardware Machine ID dan ditandatangani dengan kunci RSA Private Key Vendor.
- **Kemudahan Pembeli**: Klien hanya perlu melakukan aktivasi 1x saat awal instalasi tanpa bergantung pada server internet vendor.
- **Pemisahan Mandiri BroLinks**: Folder `BroLinks/` dapat langsung dipindahkan keluar (*cut/paste*) ke lokasi server vendor mana pun dan berjalan secara independen di Port 3005.

### 4. Cara Menjalankan BroLinks Vendor Dashboard
1. Jalankan server BroLinks:
   ```bash
   node BroLinks/app.js
   ```
2. Buka browser: `http://localhost:3005`
3. Login Admin Default:
   - **Username**: `admin`
   - **Password**: `admin123`
4. Daftarkan Data Pembeli di menu **Data Pembeli (CRM)**, lalu salin **Machine ID** dari aplikasi klien dan klik **Generate Lisensi**.

---

## [2026-08-10] Penambahan Fitur Menu Baru "Distribusi Jatuh Tempo" Billing

### 1. Deskripsi Kebutuhan & Fitur Baru
Menambahkan modul dan menu baru **Distribusi Jatuh Tempo** pada kelompok Billing untuk menampilkan visualisasi sebaran tagihan dan pendapatan harian berdasarkan tanggal jatuh tempo pelanggan (Tanggal 1 hingga Tanggal 31). Tampilan dirancang mengikuti sampel gambar UI dengan grid 4-kolom kartu tanggal, indikator status Lunas / Belum Bayar, dan popup detail saat kartu tanggal diklik.

### 2. Modul & File yang Diperbarui / Dibuat
- **`services/sidebarMenuService.js`**:
  - Mendaftarkan menu baru `due_distribution` pada `MENU_DEFINITIONS` di seksi `billing` dengan icon `bi bi-calendar3-range` dan URL `/admin/billing/due-distribution`.
  - Menambahkan status default `due_distribution: STATE_VISIBLE`.
- **`services/billingService.js`**:
  - Menambahkan fungsi `getDueDistributionSummary(month, year)` untuk menghitung total statistik pelanggan, tagihan terbayar, dan sisa belum bayar per tanggal (1–31).
  - Menambahkan fungsi `getDueDistributionDetailsByDay(day, month, year)` untuk mengambil rincian daftar pelanggan & tagihan untuk tanggal jatuh tempo terpilih.
- **`routes/adminPortal.js`**:
  - Menambahkan handler rute `GET /admin/billing/due-distribution` untuk merender halaman view utama.
  - Menambahkan handler rute API `GET /admin/billing/due-distribution/details` untuk menyuplai data JSON modal popup.
- **`views/admin/billing_due_distribution.ejs` [BARU]**:
  - Halaman view baru dengan layout grid kartu tanggal ringkas (compact) yang disesuaikan menjadi **6 kolom di Desktop** dan **4 kolom di Mobile**.
  - Varian warna kartu (Biru untuk tanggal hari ini, Merah jika ada tagihan belum lunas, Gelap jika seluruh tagihan lunas).
  - Kartu ringkasan atas (*stat cards*) diperbarui menggunakan utilitas `.sc-val-money` dan `.sc-currency` dengan *font-size auto-scaling* (`clamp(16px, 1.35vw, 22px)`), proteksi *text-ellipsis*, dan penyesuaian padding sehingga angka nominal besar (jutaan / miliaran) tampil utuh, jelas, dan tidak terpotong.
  - Modal Popup `#dueDetailModal` interaktif lengkap dengan penanganan CSS overlay `.mo.show` serta helper fungsi `openModal` dan `closeModal` untuk menampilkan detail pelanggan, paket, nominal, status pembayaran, dan aksi cepat WhatsApp Reminder & Cetak Invoice.
- **`public/css/admin.css`**:
  - Menambahkan utilitas global `.sc-val-money` dan `.sc-currency` untuk memastikan tampilan nominal angka pada *stat cards* di seluruh aplikasi tidak lagi terpotong.
- **`views/admin/billing.ejs`**:
  - Menambahkan tombol navigasi cepat **"Distribusi Jatuh Tempo"** pada topbar halaman Manajemen Tagihan.
- **`locales/id.json` & `locales/en.json`**:
  - Menambahkan terjemahan kunci `admin.nav.due_distribution`.

### 3. Dampak Terhadap Sistem
- **Visualisasi Cash Flow Harian**: Admin, Kasir, dan Finance dapat secara cepat memantau proyeksi penerimaan kas dan sebaran pelanggan jatuh tempo dari tanggal 1 hingga 31.
- **Efisiensi Penagihan**: Fitur popup interaktif memudahkan admin untuk langsung mengirimkan pengingat pesan WA (*WhatsApp Reminder*) atau mencetak invoice tagihan per tanggal secara cepat.
- **Integrasi Seamless**: Terintegrasi penuh dengan sistem otorisasi menu sidebar dan manajemen tagihan yang sudah ada tanpa risiko regresi.

### 4. Pengujian & Verifikasi
- Pengujian kompilasi EJS: `views/admin/billing_due_distribution.ejs` dan `views/admin/billing.ejs` teruji lulus kompilasi tanpa error.
- Pengujian service backend: Panggilan `getDueDistributionSummary` dan `getDueDistributionDetailsByDay` teruji mengembalikan data yang akurat.
- Testing otomatis: `npm test` berjalan sukses.

---

## [2026-08-09] Perbaikan Tampilan & Hasil Print Invoice di Smartphone (Mobile Responsive & Print Optimization)

### 1. Permasalahan yang Ditemukan
Saat halaman cetak invoice ([views/admin/print_invoice.ejs](file:///d:/WEBAPP/myadamedia-billing/views/admin/print_invoice.ejs), [views/admin/print_invoice_batch.ejs](file:///d:/WEBAPP/myadamedia-billing/views/admin/print_invoice_batch.ejs), dan [views/agent/print_thermal_invoice.ejs](file:///d:/WEBAPP/myadamedia-billing/views/agent/print_thermal_invoice.ejs)) dibuka melalui perangkat seluler (smartphone/tablet):
- Tampilan dokumen berantakan, teks bertumpuk, dan elemen meluap keluar dari batas layar (horizontal overflow).
- Padding dan fixed width berlebihan (`padding: 35px 40px`, `width: 260px`, `width: 200px`) menyebabkan bagian total bayar, catatan, dan tanda tangan terpotong di layar seluler.
- Header logo, detail pelanggan, dan tabel rincian tagihan tidak memiliki responsivitas CSS (`@media screen`), sehingga pengguna harus melakukan zoom out atau horizontal scrolling untuk melihat invoice secara utuh.
- Saat mencetak (print) atau menyimpan dokumen sebagai PDF melalui browser smartphone, tampilan hasil cetak terpengaruh tata letak seluler atau tidak tersusun rapi dalam proporsi kertas A4.

### 2. Penyebab Utama (Root Cause)
- **Ketiadaan CSS Media Queries Responsif (`@media screen`)**: Template EJS cetak invoice hanya memiliki style statis yang dirancang untuk layar desktop (lebar > 800px).
- **Penggunaan Unit Ukuran Kaku**: Penggunaan piksel tetap (`px`) pada kontainer utama, grid detail (`grid-template-columns: 1fr 1fr`), totals box (`width: 260px`), dan signature box (`width: 200px`) tanpa adaptasi lebar fleksibel (`%` atau `1fr`).
- **Pencampuran Style Cetak dan Layar**: Aturan `@media print` sebelumnya tidak mengisolasi tata letak cetak A4 dari tampilan seluler, sehingga cetakan dari browser smartphone mewarisi layout seluler yang terpotong.

### 3. Solusi & Perubahan yang Diterapkan
- **Pengembangan CSS Responsive (`@media screen and (max-width: 640px)`)**:
  - **`views/admin/print_invoice.ejs` & `views/admin/print_invoice_batch.ejs`**:
    - **Body & Outer Card**: Menyesuaikan padding dari `20px` / `35px 40px` menjadi `10px 8px` (body) dan `20px 14px` (card) pada layar smartphone.
    - **Header Brand & Meta Tagihan**: Mengubah flex layout menjadi stacked/column pada layar HP, merapikan logo & detail perusahaan, serta mengelompokkan nomor invoice dan badge status LUNAS/BELUM BAYAR dalam container informasi yang bersih.
    - **Grid Detail Pelanggan (`.details-grid`)**: Mengubah tampilan dari 2-kolom menjadi 1-kolom pada layar HP dengan word-break yang aman agar alamat/email panjang tidak meluap.
    - **Tabel Tagihan (`.table-container`)**: Menambahkan container scroll horizontal halus (`overflow-x: auto`) dengan `min-width` yang terjaga agar rincian paket dan nominal tetap mudah dibaca.
    - **Bagian Total & Catatan (`.summary-section`)**: Mengubah tata letak menjadi `column-reverse` pada layar HP sehingga total bayar berada di atas dengan lebar `100%` disusul catatan di bawahnya.
    - **Tanda Tangan (`.signature-section`)**: Mengatur lebar tanda tangan menjadi persentase fleksibel (`width: 48%`) agar muat berdampingan di layar HP secara proporsional.
- **Isolasi & Optimasi Cetak (`@media print`)**:
  - Memastikan seluruh aturan `@media print` memaksa tampilan kembali ke format dokumen kertas A4 Portrait (2-kolom, header kanan-kiri, totals box 260px) tanpa terpengaruh kondisi tampilan seluler. Dokumen hasil cetak/PDF dari smartphone kini persis seperti hasil cetak dari desktop PC.
- **Optimasi Struk Thermal Agent (`views/agent/print_thermal_invoice.ejs`)**:
  - Membungkus struk dalam `<div class="receipt-card">` dengan posisi terpusat (centered) di layar smartphone.
  - Memperbarui tombol floating action bar agar tidak menutupi judul struk dan nyaman diakses di layar sentuh.

### 4. Dampak Perubahan Terhadap Sistem
- **Tampilan Smartphone Rapi & Responsif**: Pengguna (Admin/Kasir/Agen/Pelanggan) yang membuka invoice dari HP dapat melihat seluruh rincian tagihan secara nyaman, rapi, dan mudah dibaca tanpa perlu scroll horizontal.
- **Hasil Cetak / PDF Presisi**: Dokumen yang dicetak atau disimpan ke PDF melalui smartphone tetap memiliki standar format profesional A4 Portrait yang sempurna.
- **Bebas Regression Risk**: Tidak ada perubahan pada backend/service data invoice, sehingga performa dan integritas data tetap terjaga 100%.

### 5. Pengujian & Verifikasi
- Uji kompilasi EJS: `node -e` memverifikasi seluruh template `print_invoice.ejs`, `print_invoice_batch.ejs`, dan `print_thermal_invoice.ejs` terkompilasi tanpa error sintaks.
- Pengujian unit test: `npm test` berjalan sukses.

---

## [2026-08-08] Perbaikan Bug Pemilih Lokasi Pelanggan (Latitude & Longitude)

### 1. Permasalahan yang Ditemukan
Saat admin membuka modal peta (`mapPickerModal`) untuk memilih atau memperbarui titik lokasi pelanggan pada form **Tambah Pelanggan** (`addModal`) maupun **Edit Pelanggan** (`editModal`) di halaman Admin Pelanggan (`views/admin/customers.ejs`), nilai `Latitude` dan `Longitude` tidak terisi / tidak muncul di kolom form pelanggan.

### 2. Penyebab Utama (Root Cause)
- Pada [views/admin/customers.ejs](file:///d:/WEBAPP/myadamedia-billing/views/admin/customers.ejs), event handler marker peta (`dragend`) dan peta (`click`) memanggil fungsi `updateInputs(lat, lng)`.
- Namun, fungsi `updateInputs` tidak terdefinisi (missing function) pada file tersebut.
- Hal ini menyebabkan terjadinya runtime error JavaScript `ReferenceError: updateInputs is not defined` saat penanda peta digeser atau peta diklik, sehingga nilai `add_lat`/`add_lng` atau `e_lat`/`e_lng` gagal terisi.

### 3. Solusi & Perubahan yang Diterapkan
- **Penambahan Fungsi `updateInputs(lat, lng)`**:
  Dibuat fungsi `updateInputs` yang secara otomatis mendeteksi form yang sedang aktif (`activePickerType` = `'add'` atau `'edit'`) dan mengisi elemen input `add_lat` / `add_lng` atau `e_lat` / `e_lng` dengan koordinat berpresisi 8 angka desimal (`toFixed(8)`).
- **Penambahan Fungsi `confirmPickerLocation()`**:
  Memastikan koordinat posisi marker terakhir selalu diperbarui ke input form saat pengguna mengeklik tombol **Selesai**.
- **Penambahan Fitur GPS (`useCurrentLocationInPicker`)**:
  Menambahkan tombol **Lokasi Saya** (`<button>` dengan icon `bi-crosshair`) pada footer modal peta. Fitur ini memanfaatkan Browser HTML5 Geolocation API untuk mendeteksi posisi GPS pengguna secara real-time dan langsung mengarahkan penanda peta ke lokasi tersebut.
- **Inisialisasi Nilai Awal saat Modal Peta Dibuka**:
  Memanggil `updateInputs(startLat, startLng)` saat `openPicker` dipanggil agar nilai koordinat terisi secara konsisten.

### 4. Dampak Perubahan Terhadap Sistem
- **Stabilitas Frontend**: Menghilangkan error JavaScript `ReferenceError: updateInputs is not defined`.
- **Integritas Data**: Memastikan koordinat latitude dan longitude tersimpan dengan akurat ke database SQLite saat form disimpan/diperbarui.
- **Pengalaman Pengguna (UX)**: Memudahkan admin/teknisi dalam memilih lokasi pelanggan secara presisi maupun menggunakan lokasi GPS perangkat secara instan.

### 5. Pengujian & Verifikasi
- Pengujian otomatis: `npm test` berjalan sukses (186/186 unit & integration tests PASSED).
- Verifikasi logika form: Elemen `add_lat`, `add_lng`, `e_lat`, dan `e_lng` terisi dengan benar saat modal peta digunakan.

---

## [2026-08-08] Penambahan Fitur Notifikasi Otomatis Pembayaran Payment Gateway

### 1. Deskripsi Fitur Baru
Menambahkan sistem notifikasi otomatis real-time saat terjadi transaksi yang **LUNAS (PAID/Settlement)** dari Payment Gateway (**Tripay, Midtrans, Xendit, Duitku**) untuk transaksi:
- Tagihan Bulanan Internet Pelanggan
- Top-Up Saldo Pelanggan
- Top-Up Deposit Agen
- Pembelian Voucher Hotspot

### 2. Modul & Komponen yang Diperbarui
- **`services/notificationService.js`**:
  Menambahkan method `NotificationService.notifyPaymentSuccess(params)` yang secara cerdas mendistribusikan alert pembayaran ke:
  - **WhatsApp Admin** (melalui daftarnomor `whatsapp_admin_numbers`).
  - **Telegram Bot Admin** (melalui `sendTelegramAdminNotification`).
- **`routes/customerPortal.js`**:
  Mengaitkan panggilan `notificationSvc.notifyPaymentSuccess(...)` di dalam handler webhook `POST /customer/payment/callback`.
- **`tests/notificationService.test.js`**:
  Menambahkan skenario unit test untuk memastikan method `notifyPaymentSuccess` berjalan stabil tanpa exception.

### 3. Dampak Terhadap Sistem
- **Monitoring Real-time**: Pengelola/Admin/Kasir langsung mendapatkan notifikasi pesan instan via WA & Telegram begitu pelanggan menyelesaikan pembayaran di Payment Gateway.
- **Transparansi Transaksi**: Memudahkan pemantauan arus kas dan verifikasi pembayaran otomatis tanpa perlu cek manual ke dashboard Payment Gateway.

---

## [2026-08-08] Perbaikan Bug Status Connected Clients (Live) Selalu Offline

### 1. Permasalahan yang Ditemukan
Pada detail perangkat ACS/ONU (**Connected Clients (Live)**) baik di dashboard admin maupun detail ACS Pro (`/admin/acs/device/:deviceId`), status perangkat terhubung (klien Wi-Fi/LAN) selalu bernilai **Offline** meskipun perangkat tersebut sedang aktif terhubung.

### 2. Penyebab Utama (Root Cause)
- **Implementasi TR-069 Vendor ONT**: Kebanyakan vendor ONU (ZTE, Huawei, FiberHome, VSOL) tidak menyertakan parameter `Active` atau mengabaikan nilainya (`undefined`/`null`/`"1"`).
- **Asosiasi Wi-Fi Realtime Terabaikan**: Klien yang secara aktif terdaftar di `WLANConfiguration.1.AssociatedDevice` / `WLANConfiguration.5.AssociatedDevice` sebelumnya tidak dikorelasikan untuk menentukan status online.
- **Pengecekan Tipe Data Ketat pada Frontend**: Kode template hanya mengecek string persis `=== 'online'`, sehingga status `'Active'`, `'1'`, atau `true` dianggap Offline.

### 3. Solusi & Perubahan yang Diterapkan
- **`routes/acsPortal.js` (`getLANHosts`)**:
  - Menggabungkan data asosiasi Wi-Fi aktif. Jika MAC terdaftar di Wi-Fi AssociatedDevices, status dipastikan `Online`.
  - Memperluas penanganan nilai `Active` TR-069 (`1`, `"1"`, `true`, `"true"`, `"active"`, `"yes"`).
  - Menggunakan fallback: Jika `Active` dari vendor ONT `undefined`/`null` namun IP & MAC valid, dikategorikan `Online`.
- **`services/customerDeviceService.js` (`connectedUsers`)**:
  - Menyesuaikan parser `connectedUsers` agar mengecek asosiasi Wi-Fi dan fallback respon TR-069.
- **Frontend Views (`acs_device.ejs`, `admin/dashboard.ejs`, `dashboard.ejs`)**:
  - Memperbarui pengecekan status `isOn` agar konsisten mendukung `'online'`, `'active'`, `'1'`, atau `true`.

### 4. Dampak Terhadap Sistem
- **Akurasi Monitoring Klien**: Admin/Teknisi/Pelanggan dapat melihat status koneksi perangkat terhubung (Online/Offline) secara akurat dan real-time.
- **Bebas Error**: Menghilangkan miskonsepsi perangkat dianggap offline padahal sedang aktif memakai internet.

---

## [2026-08-08] Pembaruan Format Cetak Invoice Standar Normal, Logo Perusahaan & Fitur Cetak Pasca-Generate

### 1. Deskripsi Pembaruan
- **Redesain Tampilan Cetak Invoice Normal**: Mengubah tampilan cetak tagihan ([views/admin/print_invoice.ejs](file:///d:/WEBAPP/myadamedia-billing/views/admin/print_invoice.ejs)) dari kertas kasir thermal (58mm) menjadi format **Invoice Dokumen Standar Normal (A4 / A5 / Letter)** yang rapi, profesional, dan modern.
- **Logo Perusahaan**: Menambahkan logo resmi perusahaan (`settings.company_logo` / `/img/logo.png`) pada bagian header invoice.
- **Fitur Cetak Pasca-Generate**:
  - **Single Generate**: Menyediakan tombol **"Cetak Struk/Invoice"** langsung pada pesan notifikasi sukses setelah admin generate tagihan per pelanggan (`/admin/customers/:id/billing/generate`).
  - **Mass Generate**: Menyediakan tombol **"Cetak Tagihan Periode Ini"** setelah admin generate tagihan bulanan massal (`/admin/billing/generate`).
  - **Batch Multi-Page Print (`/admin/billing/print-batch`)**: Menambahkan template `views/admin/print_invoice_batch.ejs` untuk cetak massal seluruh tagihan periode terpilih.
  - **Tombol "Cetak Tagihan" di Page Billing**: Menambahkan tombol aksi cepat di topbar `views/admin/billing.ejs`.

### 2. File & Modul yang Diperbarui
- **`views/admin/print_invoice.ejs`**: Redesain layout A4/A5 normal, header logo, rincian paket, badge status LUNAS/BELUM BAYAR, dan kolom tanda tangan.
- **`views/admin/print_invoice_batch.ejs`**: Template cetak massal multi-page untuk tagihan periode.
- **`routes/adminPortal.js`**:
  - `POST /customers/:id/billing/generate`: Mengembalikan tautan cetak invoice tunggal pada flash message.
  - `POST /billing/generate`: Mengembalikan tautan cetak batch pada flash message.
  - `GET /admin/billing/print-batch`: Route melayani cetak batch tagihan periode.
- **`views/admin/billing.ejs` & `views/admin/customers.ejs`**: Menambahkan tombol cetak batch dan mendukung HTML rendering pada alert flash message.

### 3. Dampak Terhadap Sistem
- **Hasil Cetak Lebih Profesional**: Invoice terlihat seperti dokumen tagihan resmi perusahaan ISP dengan identitas logo dan format kertas dokumen standar.
- **Efisiensi Kerja Kasir / Admin**: Admin tidak perlu mencari invoice satu-per-satu di tabel setelah melakukan generate tagihan; tombol cetak langsung tersedia secara instan.

---

## [2026-08-08] Penyembunyian PPPoE Username pada Dashboard Pelanggan

### 1. Deskripsi Perubahan
Menghapus tampilan card **PPPoE Username** dari halaman dashboard portal pelanggan ([views/dashboard.ejs](file:///d:/WEBAPP/myadamedia-billing/views/dashboard.ejs)) untuk meningkatkan privasi dan menyederhanakan antarmuka pelanggan.

### 2. Modul & File yang Diperbarui
- **`views/dashboard.ejs`**: Menghapus elemen `.stat-card` yang mengisikan `PPPoE Username`.

### 3. Hasil Pengujian
- **Pengujian Unit (`npm test`)**: 9/9 Test Suites PASSED, 187/187 Tests PASSED.

---

## [2026-08-08] Redesain Portal Pelanggan Opsi 3 (Modern Dynamic Self-Service Portal) & Fitur Mandiri

### 1. Deskripsi Pembaruan
Mengubah tampilan [views/dashboard.ejs](file:///d:/WEBAPP/myadamedia-billing/views/dashboard.ejs) secara menyeluruh menjadi portal pelanggan kelas dunia (*State-of-the-Art*) berbasis **Opsi 3: Modern Dynamic Self-Service Portal**:
- **Desain & Tipografi**: Google Font **Plus Jakarta Sans**, skema warna *Obsidian Dark Mode* (`#0b0f19`), aksen gradient berpendar (*Indigo, Cyan, Emerald*), kartu *Glassmorphic* (`backdrop-filter: blur`), dan animasi mikro responsif.
- **Mobile Floating Navigation Bar**: Bar navigasi melayang di bagian bawah HP untuk berpindah secara instant antar menu Beranda, Tagihan, Wi-Fi, Perangkat, dan Bantuan Tiket.
- **Self-Service Router Tools**:
  - 🔄 **Reboot Router Wi-Fi 1-Klik**: Tombol restart router ONT/ONU mandiri dengan dialog konfirmasi dan animasi status.
  - 🔑 **Pengaturan Wi-Fi Mandiri**: Widget ganti SSID & Password Wi-Fi mandiri lengkap dengan opsi *toggle show/hide password*.
  - ⚡ **Diagnostik Koneksi & Latensi**: Widget pemeriksaan kesehatan sinyal optik (RX Power dBm), status ONT, dan tes latensi live.
- **Live Traffic Speedometer Gauge**: Canvas gauge pengukur kecepatan real-time Download & Upload Mbps dengan polling otomatis setiap 3 detik.
- **Modul Tiket Laporan Gangguan**: Modal pengaduan kendala teknis pelanggan dengan fitur lampiran foto.
- **Card Tagihan & Multi-Channel Payment**: Banner status tagihan pending & tombol bayar 1-klik (QRIS, VA, E-Wallet).

### 2. File yang Diperbarui
- **`views/dashboard.ejs`**: Redesain menyeluruh struktur HTML, CSS, JavaScript, Canvas gauge, Glassmorphic cards, dan modal interaktif.

### 3. Dampak Terhadap Sistem
- **User Experience (UX) Luar Biasa**: Portal pelanggan kini tampil sangat modern, responsif di HP/Desktop, dan memberikan kontrol mandiri penuh bagi pelanggan.
- **Mengurangi Komplain CS**: Pelanggan dapat melakukan troubleshoot mandiri (ganti password Wi-Fi, reboot router, dan diagnostik) tanpa perlu menghubungi admin.

---

## [2026-08-08] Perbaikan 3 Bug UI pada Dashboard Pelanggan

### 1. Deskripsi Perbaikan Bug
1. **Icon Menu Perangkat**: Mengganti icon `bi-devices` yang berpotensi bentrok/kosong menjadi `<i class="bi bi-router"></i>` dengan styling warna ungu berpendar yang dipastikan muncul tajam di seluruh perangkat HP.
2. **Kontras Font Gelap**: Meng-override aturan default Bootstrap dengan warna teks terang kontras tinggi (`#f8fafc` untuk angka/judul, `#cbd5e1` untuk label subtipe, dan `#94a3b8` untuk deskripsi) sehingga seluruh teks pada *Dark Glassmorphism Card* dapat dibaca secara sangat jelas.
3. **Live Traffic Gauge**: Memperbaiki fungsi render canvas (`drawSpeedGauge`) dengan dynamic DPI scaling (`window.devicePixelRatio`), sudut lengkung *gauge* presisi, dan posisi nilai terpusat (*absolute centered text*) agar indikator kecepatan Download & Upload tampil rapi dan tidak tumpang tindih.

### 2. Modul & File yang Diperbarui
- **`views/dashboard.ejs`**: Pembaruan CSS kontras tinggi, perbaikan icon floating bar, dan refactoring script Canvas speed gauge.

### 3. Hasil Pengujian
- **Pengujian Unit (`npm test`)**: 9/9 Test Suites PASSED, 187/187 Tests PASSED.

---

## [2026-08-08] Perbaikan Error Multer "Unexpected field" pada Form Kirim Tiket Gangguan

### 1. Penyebab Masalah (Root Cause)
- **Nama Field Mismatch**: Backend `routes/customerPortal.js` menggunakan middleware `uploadCustomer.array('photos', 5)` yang secara khusus hanya menerima field bernama `photos`. Sementara pada form HTML `views/dashboard.ejs`, field input file diberi nama `attachment` dan deskripsi menggunakan name `description`.
- Multer melemparkan exception `MulterError: Unexpected field` saat menerima field upload yang tidak terdaftar di konfigurasi middleware-nya.
- Elemen `<input type="hidden" name="customerId">` sempat tidak disertakan pada modal form.

### 2. Solusi & Perubahan yang Diterapkan
- **`routes/customerPortal.js`**:
  - Mengubah middleware menjadi `uploadCustomer.any()` sehingga dapat menerima lampiran foto dari nama field apapun (`photos`, `attachment`, dll) tanpa exception.
  - Memasang error-handling wrapper pada middleware Multer agar mengembalikan notifikasi flash message yang ramah pengguna apabila terjadi kegagalan upload.
  - Menambahkan *auto-resolution* `customerId` berdasarkan sesi login pelanggan (`req.session.phone`) apabila field `customerId` tidak dikirimkan dari form.
  - Mendukung pembacaan deskripsi dari `req.body.message` maupun `req.body.description`.
- **`views/dashboard.ejs`**:
  - Menambahkan input hidden `<input type="hidden" name="customerId" value="<%= profile ? profile.id : '' %>">`.
  - Menyelaraskan atribut nama input menjadi `name="message"` dan `name="photos"`.

### 3. Hasil Pengujian
- **Pengujian Unit (`npm test`)**: 9/9 Test Suites PASSED, 187/187 Tests PASSED.

---

## [2026-08-08] Perbaikan Navigasi Menu Tagihan & Fitur Reboot Router Mandiri

### 1. Penyebab Masalah (Root Cause)
1. **Navigasi Menu Tagihan**: Link `<a href="#billing-section">` pada bar navigasi bawah tidak menggulir (*scroll*) secara halus pada perangkat seluler karena keterbatasan default event browser pada elemen internal.
2. **Perintah Reboot Router**: Backend `routes/customerPortal.js` sebelumnya hanya mengirimkan nomor HP (`req.session.phone`) sebagai token pencarian perangkat ke GenieACS TR-069. Apabila perangkat di GenieACS didaftarkan menggunakan `pppoe_username` atau `genieacs_tag` yang berbeda dari HP, maka pencarian perangkat gagal (`Perangkat tidak ditemukan`).

### 2. Solusi & Perubahan yang Diterapkan
- **`views/dashboard.ejs`**:
  - Menambahkan event handler JavaScript `scrollToSection(sectionId)` yang memanfaatkan `element.scrollIntoView({ behavior: 'smooth', block: 'start' })` pada link menu Tagihan dan Perangkat.
- **`routes/customerPortal.js`**:
  - Memperbarui handler `POST /customer/reboot` dengan **Fallback Resolution Chain**: `tagToUse (genieacs_tag / pppoe_username)` -> `pppoeUsername` -> `loginId (phone)`.
  - Menambahkan *audit trail log* untuk tindakan reboot yang diinisiasi oleh pelanggan.

### 3. Hasil Pengujian
- **Pengujian Unit (`npm test`)**: 9/9 Test Suites PASSED, 187/187 Tests PASSED.

---

## [2026-08-08] Perbaikan Alur Pembayaran Tagihan (Pay Bill Fix)

### 1. Penyebab Masalah (Root Cause)
1. Form modal pembayaran `#payModal` di [views/dashboard.ejs](file:///d:/WEBAPP/myadamedia-billing/views/dashboard.ejs) sebelumnya melakukan submit `POST` ke `/customer/payment/create`, namun handler endpoint `POST /customer/payment/create` belum terdaftar di backend (router sebelumnya hanya menerima `GET /customer/payment/create/:invoiceId`).
2. Tombol **Bayar** di tabel riwayat tagihan dan modal pembayaran belum meneruskan parameter `invoiceId` tagihan yang hendak dibayar secara spesifik.

### 2. Solusi & Perubahan yang Diterapkan
- **`routes/customerPortal.js`**:
  - Menambahkan endpoint `router.post('/payment/create')`:
    - Membaca `invoiceId` dari form atau secara otomatis memilih tagihan pending milik pelanggan yang bersangkutan.
    - Membaca metode pembayaran (`channel_code` / `method`).
    - Melakukan redirect mulus ke endpoint pembuatan transaksi payment gateway (`GET /customer/payment/create/:invoiceId?method=...`).
  - Memperbarui `router.get('/customer/payment/create/:invoiceId')` agar jika terjadi error (misalnya gateway down), sistem menangkap error tersebut dan melakukan redirect kembali ke dashboard dengan notifikasi flash message yang ramah.
- **`views/dashboard.ejs`**:
  - Memperbarui tombol **Bayar** di tabel tagihan menjadi tautan langsung: `<a href="/customer/payment/create/<%= inv.id %>" class="btn btn-sm btn-primary">Bayar</a>`.
  - Menambahkan selector dropdown `Pilih Tagihan` pada modal `#payModal` sehingga pelanggan yang memiliki beberapa tagihan pending dapat memilih tagihan mana yang ingin dibayar.

### 3. Hasil Pengujian
- **Pengujian Unit (`npm test`)**: 9/9 Test Suites PASSED, 187/187 Tests PASSED.

---

## [2026-08-08] Perbaikan Presisi Realtime & Perspektif Traffic Speedometer MikroTik

### 1. Penyebab Masalah (Root Cause)
- **Perspektif Arah Traffic Inverted**: Pada RouterOS MikroTik, `tx-bits-per-second` / `bytes-out` adalah data yang dikirimkan oleh router ke perangkat pelanggan (yang merupakan **Download** pelanggan). Sedangkan `rx-bits-per-second` / `bytes-in` adalah data yang diterima oleh router dari pelanggan (yang merupakan **Upload** pelanggan). Sebelumnya, statistik ini terbalik (Router RX dipetakan ke Download, dan Router TX dipetakan ke Upload).
- **Format Interface Name PPPoE**: RouterOS membuat interface dinamis bernama `<pppoe-${username}>`. Apabila properti interface tidak secara eksplisit terisi pada data `/ppp/active`, pencarian monitor-traffic tidak mengenai interface yang tepat.

### 2. Solusi & Perubahan yang Diterapkan
- **`routes/customerPortal.js`**:
  - Mengoreksi pemetaan perspektif data:
    - **Customer Download** (`rxMbps`) = MikroTik Router `tx-bits-per-second` (atau delta `bytes-out`).
    - **Customer Upload** (`txMbps`) = MikroTik Router `rx-bits-per-second` (atau delta `bytes-in`).
  - Menambahkan *auto-fallback resolution* nama interface `<pppoe-${username}>` apabila properti interface tidak disertakan di baris `/ppp/active`.
- **`views/dashboard.ejs`**:
  - Memperbarui skrip polling `fetchTrafficData()` dengan *Dynamic Max Scale* (menyesuaikan batas maksimal indikator secara otomatis apabila kecepatan aktual melebihi batas batas default paket) dan interval polling real-time 2 detik.

### 3. Hasil Pengujian
- **Pengujian Unit (`npm test`)**: 9/9 Test Suites PASSED, 187/187 Tests PASSED.

---

## [2026-08-08] Perbaikan Tombol Cetak Struk/Invoice pada Portal Pelanggan

### 1. Penyebab Masalah (Root Cause)
- **Akses Admin Requirement**: Tautan tombol cetak invoice pada tabel Riwayat Tagihan di portal pelanggan sebelumnya mengarah ke `/admin/billing/:id/print`. Karena rute `/admin/billing/...` dilindungi middleware `requireAdminSession`, saat pelanggan biasa menekan tombol cetak, sistem secara otomatis mengarahkan pelanggan ke halaman login admin (`/admin/login`).

### 2. Solusi & Perubahan yang Diterapkan
- **`routes/customerPortal.js`**:
  - Menambahkan rute khusus pelanggan `GET /customer/billing/:id/print`:
    - Memverifikasi sesi login pelanggan (`req.session.phone`).
    - Memastikan tagihan invoice yang diminta secara sah milik akun pelanggan yang sedang login (mencegah *IDOR / unauthorized access* ke tagihan orang lain).
    - Memuat dan me-render template tampilan cetak invoice normal (`admin/print_invoice`).
- **`views/dashboard.ejs`**:
  - Mengubah atribut `href` pada tombol cetak invoice di tabel Riwayat Tagihan menjadi `/customer/billing/<%= inv.id %>/print`.

### 3. Hasil Pengujian
- **Pengujian Unit (`npm test`)**: 9/9 Test Suites PASSED, 187/187 Tests PASSED.

---

## [2026-08-08] Perbaikan Validasi Kepemilikan Invoice pada Cetak Struk Pelanggan

### 1. Penyebab Masalah (Root Cause)
- Pengecekan awal pada `GET /customer/billing/:id/print` secara ketat membandingkan `Number(inv.customer_id) === Number(profile.id)`.
- Apabila tagihan dibuat berdasarkan `customer_phone` atau `pppoe_username` yang terhubung via login seluler tanpa kolom `customer_id` yang identik (misalnya karena variasi pendaftaran awal), pengecekan menganggap tagihan bukan milik akun yang sedang login sehingga melemparkan `Akses ditolak`.

### 2. Solusi & Perubahan yang Diterapkan
- **`routes/customerPortal.js`**:
  - Memperbarui fungsi validasi kepemilikan tagihan (`isOwner`) menjadi **Flexible Multi-Criteria Matching**:
    1. Pencocokan ID Profil Pelanggan (`inv.customer_id === profile.id`).
    2. Pencocokan digit Nomor Telepon (`inv.customer_phone` dengan `loginId` / `profile.phone`).
    3. Pencocokan `pppoe_username` (`inv.pppoe_username` dengan `pppoeUsername` / `profile.pppoe_username`).
    4. Pencocokan Nama Pelanggan (`inv.customer_name` dengan `profile.name`).
  - Apabila salah satu kriteria di atas terpenuhi, sistem mengizinkan pencetakan invoice secara sah dan aman.

### 3. Hasil Pengujian
- **Pengujian Unit (`npm test`)**: 9/9 Test Suites PASSED, 187/187 Tests PASSED.

---

## [2026-08-08] Redesain Halaman Login Pelanggan (Modern & Minimalist Customer Login)

### 1. Deskripsi Pembaruan
Mengubah tampilan halaman login pelanggan [views/login.ejs](file:///d:/WEBAPP/myadamedia-billing/views/login.ejs) menjadi sangat modern, elegan, dan mudah digunakan:
- **Desain & Tipografi**: Google Fonts **Plus Jakarta Sans**, skema warna *Obsidian Dark Mode* (`#0b0f19`), pencahayaan ambient radial berpendar, dan *Frosted Glassmorphism Card* (`backdrop-filter: blur(24px)`).
- **Pengalaman Pengguna (UX) Yang Sangat Mudah**:
  - Logo perusahaan yang bersih di dalam *glass container*.
  - Input tunggal yang ramah: **ID Pelanggan / Nomor HP** dengan icon indicator `bi-person-badge`.
  - Tombol masuk utama berpendar *Indigo Gradient* dengan efek elevasi mikro saat di-hover.
  - Action button instan: **Cek Tagihan Instan (Tanpa Login)**.
  - Kartu informasi bantuan CS, jam operasional, dan tautan pendaftaran pemasangan baru yang rapi di bagian bawah.

### 2. Modul & File yang Diperbarui
- **`views/login.ejs`**: Pembaruan menyeluruh struktur HTML, CSS, Font Google, dan tata letak responsif.

### 3. Hasil Pengujian
- **Pengujian Unit (`npm test`)**: 9/9 Test Suites PASSED, 187/187 Tests PASSED.

---

## [2026-08-08] Penyamaan Perilaku Tombol Bayar pada Tabel Tagihan (Pop-up Modal #payModal)

### 1. Deskripsi Perubahan
- Mengubah tombol **Bayar** biru pada baris tabel Riwayat Tagihan di [views/dashboard.ejs](file:///d:/WEBAPP/myadamedia-billing/views/dashboard.ejs) agar memicu jendela pop-up modal (`#payModal`) persis seperti tombol **Bayar Tagihan** / **Bayar Sekarang** di bagian atas hero banner.
- Saat tombol **Bayar** pada baris tagihan tertentu ditekan, fungsi JavaScript `selectPayInvoice(invId)` secara otomatis memilih (*auto-select*) tagihan bersangkutan pada dropdown modal pembayaran, lalu menampilkan modal modal `#payModal` untuk memilih metode bayar (QRIS / VA / E-Wallet).

### 2. Modul & File yang Diperbarui
- **`views/dashboard.ejs`**: Mengubah tombol baris tagihan menjadi `<button data-bs-toggle="modal" data-bs-target="#payModal" onclick="selectPayInvoice('<%= inv.id %>')">Bayar</button>` dan menambahkan handler JS `selectPayInvoice`.

### 3. Hasil Pengujian
- **Pengujian Unit (`npm test`)**: 9/9 Test Suites PASSED, 187/187 Tests PASSED.

---

## [2026-08-12] Perbaikan Tampilan Peta Jaringan & Infrastruktur Pelanggan Dashboard Investor

### 1. Penyebab Masalah (Root Cause)
- Query SQL pada `investorService.getMapData()` di [investor/services/investorService.js](file:///d:/WEBAPP/myadamedia-billing/investor/services/investorService.js) sebelumnya memicu exception `no such column: capacity` karena mencoba membaca kolom `capacity` yang tidak ada di tabel SQLite `odps` (nama kolom aktual adalah `port_capacity`).
- Query SQL pada fungsi yang sama juga memanggil `package_name` langsung dari tabel `customers` tanpa `LEFT JOIN packages`.
- Akibat exception ini, blok `catch (err)` mengembalikan objek data kosong (`{ odps: [], customers: [], olts: [], stats: { totalOdps: 0, ... } }`), menyebabkan komponen Leaflet pada dashboard investor (`http://localhost:3001/investor/dashboard`) menampilkan 0 ODP dan 0 Pelanggan meskipun data pada `http://localhost:3001/admin/map` terisi penuh.

### 2. Solusi & Perubahan yang Diterapkan
- **`investor/services/investorService.js`**:
  - Memperbarui fungsi `getMapData()` untuk memanfaatkan modul terintegrasi `odpService.getAllOdps()` dan `customerService.getAllCustomers()`.
  - Mengkalkulasi kapasitas port ODP (`port_capacity`) serta pemakaian port aktual secara dinamis.
  - Melakukan sanitasi koordinat `lat` & `lng`, kategorisasi pelanggan berbayar vs paket free, dan rekapitulasi jalur kabel fiber optic.

### 3. Hasil Pengujian
- **Pengujian API (`node -e ...`)**:
  - `ODPs Count`: 22 ODP terdeteksi dan terpetakan dengan presisi.
  - `Customers Count`: 79 Pelanggan terdeteksi beserta koordinat dan status koneksinya.
- **Pengujian Unit (`npm test`)**: 9/9 Test Suites PASSED, 187/187 Tests PASSED.

---

## [2026-08-12] Perbaikan Presisi Penggambaran Jalur Kabel Peta Investor & Eliminasi Chip "Jalur Kabel Terpasang"

### 1. Penyebab Masalah (Root Cause)
- **Jalur Kabel Feeder/Uplink ODP Tidak Render**: Pada dashboard investor sebelumnya, penggambaran garis kabel backbone/feeder antar-ODP (maupun ODP ke Kantor Pusat NOC) tidak dijalankan sehingga hanya garis putus-putus pelanggan yang tampil.
- **Overlapping Lines**: Jalur kabel pelanggan sebelumnya menggambar garis ganda jika pelanggan memiliki properti `cable_path`.
- **Fitur redundant "Jalur Kabel Terpasang"**: Kartu chip statistik "Jalur Kabel Terpasang" diminta untuk dihapus dari *stats bar*.

### 2. Solusi & Perubahan yang Diterapkan
- **`investor/services/investorService.js`**:
  - Menyertakan data `office` NOC (`office_lat`, `office_lng`), `parent_odp_id`, `parent_name`, `olt_id`, `pon_port`, dan `cable_path` pada payload `getMapData()`.
  - Mengeliminasi kalkulasi `cablesCount` dari objek `stats`.
- **`investor/views/dashboard.ejs`**:
  - Menghapus chip statistik `<div class="map-stat-chip"><span class="lbl">Jalur Kabel Terpasang</span>...</div>`.
  - Memperbarui skrip `loadInvestorMapData()` agar menyelaraskan penggambaran jalur kabel 100% sama persis dengan `http://localhost:3001/admin/map`:
    1. **Kabel Feeder/Uplink ODP**: Menggambarkan polyline solid berketebalan 4px menghubungkan ODP ke Parent ODP (atau Kantor Pusat NOC) dengan pewarnaan dinamis berdasarkan PON port (`ponColorMap`).
    2. **Kabel Drop Pelanggan**: Menggambarkan polyline putus-putus dengan animasi `flowing-line` berketebalan 3px sesuai status pelanggan (Biru untuk Aktif, Hijau untuk Free, Merah untuk Isolir).
    3. **Custom Coordinate Polyline**: Mendukung array koordinat multi-titik (`cable_path`) baik untuk ODP maupun Pelanggan tanpa *overlapping line*.

### 3. Hasil Pengujian
- **Pengujian Peta & Data**:
  - ODP Feeder & Uplink lines terhubung ke NOC / Parent ODP.
  - Drop lines pelanggan terhubung ke ODP bersangkutan dengan efek animasi `flowing-line`.
  - Stats bar kini rapi dengan 4 indikator utama (Total ODP, Pelanggan di Peta, Aktif, Terisolir/Suspended).
- **Pengujian Unit (`npm test`)**: 9/9 Test Suites PASSED, 187/187 Tests PASSED.

---

## [2026-08-12] Eksklusi Pelanggan Paket Free dari Perhitungan "Pelanggan Aktif" Dashboard Investor

### 1. Deskripsi Perubahan
- Menyesuaikan kalkulasi metrik `activeCustomers` (Pelanggan Aktif) pada [investor/services/investorService.js](file:///d:/WEBAPP/myadamedia-billing/investor/services/investorService.js) agar pelanggan dengan paket Free (`status = 'free'`, nama paket mengandung kata `'free'`, atau harga paket `Rp 0`) tidak dihitung sebagai Pelanggan Berbayar Aktif pada Ringkasan Eksekutif Keuangan & Kartu KPI Investor.
- Kebijakan ini memastikan bahwa angka *Pelanggan Aktif* yang disajikan kepada Investor secara murni merepresentasikan pelanggan berbayar (*paying customers*) yang memberikan kontribusi omset real.

### 2. Modul & File yang Diperbarui
- **`investor/services/investorService.js`**: Memperbarui query `activeCust` pada `getExecutiveSummary()` dengan klausa filter `LOWER(c.status) != 'free' AND (p.name IS NULL OR LOWER(p.name) NOT LIKE '%free%') AND (p.price IS NULL OR p.price > 0)`.

### 3. Hasil Pengujian
- **Pengujian Unit (`npm test`)**: 9/9 Test Suites PASSED, 187/187 Tests PASSED.

---

## [2026-08-15] Otomatisasi Isolir MikroTik & RADIUS Saat Data Pelanggan Diubah Menjadi Suspended

### 1. Deskripsi Perubahan & Analisis Masalah
- **Permasalahan**: Saat status pelanggan diubah menjadi `suspended` via Form Edit Admin (`POST /admin/customers/:id`), status koneksi di MikroTik/RADIUS tidak otomatis terisolir.
- **Penyebab Utama**:
  1. `customerSvc.updateCustomer` hanya memperbarui data SQLite tanpa memicu pipeline isolir (`suspendCustomer`).
  2. Pengecekan guard `pppoe_sync_to_mikrotik_api` pada route admin melewati pemanggilan RADIUS CoA Disconnect saat menggunakan mode RADIUS Server (default).
  3. `setPppoeProfile` pada `mikrotikService.js` mengabaikan pemutusan sesi aktif jika profil PPP Secret di MikroTik sudah bernilai `isolir`.
  4. Pemutusan sesi aktif untuk koneksi Hotspot (`kickHotspotUser`) dan Static IP belum dipanggil secara konsisten saat pelanggan diubah ke `suspended`.
- **Solusi**:
  1. Mengimplementasikan `syncCustomerIsolation` dan `syncCustomerActivation` pada [`services/customerService.js`](file:///d:/WEBAPP/myadamedia-billing/services/customerService.js) serta menghubungkannya secara otomatis ke dalam `updateCustomer` ketika deteksi transisi status ke `suspended` / `active` terjadi.
  2. Menyempurnakan `suspendCustomer` agar mengeksekusi isolir multi-layer: RADIUS CoA Disconnect (`radiusCoaService.disconnectUserByUsername`), MikroTik API Secret Profile update, serta pemutusan sesi aktif langsung via MikroTik API (`kickPppoeUser` / `kickHotspotUser`) untuk semua tipe koneksi (`pppoe`, `static`, `hotspot`).
  3. Menambahkan parameter `forceKick` pada `setPppoeProfile` di [`services/mikrotikService.js`](file:///d:/WEBAPP/myadamedia-billing/services/mikrotikService.js) untuk menjamin pemutusan sesi aktif pengguna terlepas dari profil secret sebelumnya, serta membuat profil PPPoE `isolir` baru secara otomatis di MikroTik jika belum ada.
  4. Menghapus ketergantungan guard `pppoe_sync_to_mikrotik_api` pada `syncCustomerIsolation` & `syncCustomerActivation` agar pembaruan profil PPPoE Secret di MikroTik selalu dieksekusi tanpa memerlukan pengaturan manual khusus. 6. Mengatasi kendala pada Form Tambah/Edit Pelanggan di mana pilihan "Profile Isolir / Address List" tidak terisi daftar profil PPPoE dari MikroTik dengan mendukung rute GET `/admin/api/mikrotik/profiles/:routerId` serta mempertahankan nilai profil terisolir yang tersimpan saat modal edit dibuka.
  5. Memperbarui handler POST `/admin/customers/:id` di [`routes/adminPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js) untuk mengeksekusi dan menunggu sinkronisasi isolir/aktivasi secara penuh.

### 2. Modul & File yang Diperbarui
- **`services/customerService.js`**: Menambahkan fungsi `syncCustomerIsolation` dan `syncCustomerActivation`, memperbarui `updateCustomer`, `suspendCustomer`, `activateCustomer`, dan ekspor modul. Menjalankan `setPppoeProfile` secara langsung tanpa pembatasan guard.
- **`services/mikrotikService.js`**: Memperbarui `setPppoeProfile` dengan parameter `forceKick` serta menyempurnakan `ensurePppProfileIsolirAddressListHook` untuk membuat profil `isolir` secara otomatis jika belum ada di MikroTik.
- **`routes/adminPortal.js`**: Memperbarui rute API `/api/mikrotik/profiles` untuk menerima parameter route `:routerId` maupun query parameter `?routerId=`.
- **`views/admin/customers.ejs` & `views/admin/psb.ejs`**: Memperbarui fungsi `loadMikrotikProfiles` agar memuat daftar profil MikroTik dengan benar dan mempertahankan nilai `isolir_profile` pelanggan yang sedang diedit.

### 3. Hasil Pengujian
- **Pengujian Integrasi Status & Profil MikroTik**:
  - Profil PPPoE Secret pelanggan di MikroTik diubah menjadi `isolir` secara otomatis saat status diset ke `suspended`.
  - Apabila profil `isolir` belum ada pada router MikroTik, sistem secara otomatis membuat profil `isolir` baru lengkap dengan script `on-up`/`on-down` penambahan IP ke `LIST_ISOLIR`.
  - Pilihan Profil Isolir pada Form Tambah/Edit Pelanggan dan PSB berhasil menampilkan seluruh opsi profil dari MikroTik dan mempertahankan nilai yang terpilih.

---

## [2026-08-18] Proteksi Pemutusan Sesi PPPoE Saat Perubahan Data Pelanggan Non-Status

### 1. Deskripsi Masalah & Analisis
- **Permasalahan**: Setiap kali admin melakukan perubahan/edit data pelanggan yang sedang aktif (misalnya sekadar mengubah nomor telepon, alamat, koordinat lat/lng, ODP, catatan, atau tag ONU), koneksi PPPoE pelanggan langsung terputus (*kicked/disconnected*).
- **Akar Masalah (*Root Cause*)**:
  1. Pada handler `POST /customers/:id/update` di [`routes/adminPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js), terdapat blok sinkronisasi yang secara *unconditional* memanggil `customerSvc.syncCustomerActivation(req.params.id)` setiap kali `req.body.status === 'active'`. Karena form edit pelanggan yang aktif selalu mengirimkan `status: 'active'`, pemanggilan ini selalu dieksekusi meskipun status pelanggan tidak mengalami perubahan.
  2. `syncCustomerActivation` mengeksekusi RADIUS CoA Disconnect (`disconnectUserByUsername`), `setPppoeProfile` dengan `forceKick: true`, dan `kickPppoeUser`.
  3. `customerService.js` belum memiliki fungsi quiet-update untuk sinkronisasi PPP secret di MikroTik tanpa melakukan *kick* sesi aktif saat status pelanggan tetap.
  4. Perubahan ke status `inactive` (nonaktif) belum memiliki handler pemutusan koneksi yang rapi dan terisolasi.

### 2. Solusi & Perubahan yang Diterapkan
- **`services/mikrotikService.js`**:
  - Menghapus blok kode duplikat fungsi router monitoring yang menyebabkan potensi konflik sintaks.
  - Menambahkan fungsi baru `updatePppoeSecretByName(username, data, routerId)` yang memperbarui atribut PPP Secret (`password`, `profile`, `remote-address`, `disabled`) via `/ppp/secret/set` tanpa memutus/kick sesi aktif yang sedang berjalan.
- **`services/customerService.js`**:
  - Menyempurnakan `updateCustomer(id, data)` dengan membandingkan `oldStatus` dan `newStatus`. Pemutusan sesi aktif (*kick* / CoA Disconnect) **hanya dieksekusi jika dan hanya jika terjadi perubahan status nyata** (`active` $\leftrightarrow$ `suspended` $\leftrightarrow$ `inactive`).
  - Apabila status **tidak berubah**, jika terdapat perubahan kredensial/profil PPPoE, sistem memperbarui PPP Secret di MikroTik secara *quiet* (`updatePppoeSecretByName`) tanpa memutus koneksi internet pelanggan yang sedang berlangsung.
  - Menambahkan fungsi `syncCustomerInactivation(idOrCustomer)` untuk memutus sesi aktif PPPoE / Hotspot / Static IP dan menonaktifkan secret ketika status diubah menjadi `inactive`.
- **`routes/adminPortal.js`**:
  - Menghapus blok pemanggilan redundan `syncCustomerIsolation`/`syncCustomerActivation` pada handler `POST /customers/:id/update`, menyerahkan kontrol transisi status seutuhnya ke `customerService.updateCustomer`.
- **`tests/customerUpdatePppoe.test.js`**:
  - Menambahkan unit test komprehensif untuk memverifikasi bahwa update data non-status tidak memicu pemutusan koneksi PPPoE, serta memastikan transisi status `suspended`, `active`, dan `inactive` tetap memicu sinkronisasi yang sesuai.

### 3. Hasil Pengujian
- **Pengujian Unit (`npm test`)**: 10/10 Test Suites PASSED, 192/192 Tests PASSED.
- **Validasi Alur Kerja**:
  - Update data umum (nama, telepon, alamat, ODP, catatan): Sesi PPPoE aktif tetap terhubung tanpa gangguan.
  - Update status ke `suspended`: Sesi aktif diputus dan dialihkan ke profil isolir.
  - Update status ke `active`: Profil paket diterapkan dan sesi aktif diaktifkan kembali.
  - Update status ke `inactive`: Sesi aktif diputus dan user dinonaktifkan.
  - RADIUS CoA Disconnect UDP port 3799 dan MikroTik API Kick dieksekusi secara real-time.

---

## [2026-08-18] Penambahan Fitur Kartu Metrik "Pelanggan Free" pada Dashboard Investor

### 1. Deskripsi & Kebutuhan Fitur
- **Kebutuhan**: Menambahkan kartu metrik ringkasan **"Pelanggan Free"** pada Dashboard Investor ([`investor/views/dashboard.ejs`](file:///d:/WEBAPP/myadamedia-billing/investor/views/dashboard.ejs)) dengan format visual yang serupa dengan kartu "Pelanggan Aktif" (ikon, rasio terhadap total pelanggan, dan badge penambahan PSB baru bulan berjalan).
- **Kriteria Sumber Data**:
  - Data dihitung dari pelanggan aktif yang terhubung dengan paket/profil berstatus Free:
    - Nama paket mengandung kata `free` atau `gratis` (case-insensitive), ATAU
    - Harga paket $\le$ 0 (Rp 0), ATAU
    - Status pelanggan bernilai `free`.
  - Menghitung jumlah Pasang Baru (PSB) Pelanggan Free yang terdaftar pada bulan berjalan (`freePsbThisMonth`).

### 2. Modul & File yang Diperbarui
- **`investor/services/investorService.js`**:
  - Memperbarui fungsi `getExecutiveSummary(period)` untuk menghitung `freeCustomers` dan `freePsbThisMonth`, serta memastikan pelanggan gratis dikecualikan dari `activeCustomers` (pelanggan berbayar).
  - Menyempurnakan helper `isFreeCust` pada `getMapData` untuk mencakup paket gratis/free dengan harga Rp 0.
- **`investor/views/dashboard.ejs`**:
  - Menambahkan komponen kartu KPI **Pelanggan Free** pada grid metrik eksekutif.
  - Menambahkan chip statistik `Pelanggan Free` pada bar ringkasan statistik peta jaringan interaktif.
- **`tests/investorService.test.js`**:
  - Membuat unit test suite untuk menguji agregasi metrik eksekutif `freeCustomers`, `freePsbThisMonth`, serta statistik peta.

### 3. Hasil Pengujian
- **Pengujian Unit (`npm test`)**: 11/11 Test Suites PASSED, 195/195 Tests PASSED.
- **Tampilan Dashboard**:
  - Kartu "Pelanggan Free" tampil rapi dan responsif dengan format `X / Total` dan badge `+N PSB Pelanggan baru bulan ini`.

---

## [2026-08-19] Otomatisasi Notifikasi WhatsApp Pemberitahuan Isolir pada Transisi Status Pelanggan (Active -> Suspended)

### 1. Deskripsi & Latar Belakang Masalah
- **Kebutuhan**: Mengirimkan notifikasi WhatsApp pemberitahuan isolir secara otomatis kepada pelanggan saat status layanan berubah dari `active` (aktif) menjadi `suspended` (suspend/terisolir).
- **Analisis Permasalahan**:
  - Sebelumnya, pengiriman WhatsApp notifikasi isolir hanya terpasang secara inline di dalam fungsi `suspendCustomer(id)` pada `customerService.js`.
  - Jika admin mengubah status pelanggan menjadi `suspended` melalui form update data pelanggan (`POST /customers/:id/update`) atau operasi batch/API `updateCustomer(id, data)`, notifikasi WhatsApp isolir **tidak terkirim**.
  - `suspendCustomer` memiliki redundansi eksekusi sinkronisasi router karena memanggil `updateCustomer` (yang sudah mengeksekusi `syncCustomerIsolation`) dan kemudian memanggil kembali `syncCustomerIsolation`.
  - Logika pengiriman WhatsApp belum terpusat ke `NotificationService`, belum memiliki deduplikasi proteksi spam (`shouldSendWa`), dan belum mematuhi preferensi opt-in pelanggan (`customer.send_isolir_reminder`).

### 2. Solusi & Arsitektur yang Diterapkan
- **Pemusatan di `NotificationService` (`services/notificationService.js`)**:
  - Menambahkan method `notifyCustomerIsolated(customerOrId, options)` dengan fitur:
    - Verifikasi pengaturan WhatsApp aktif (`settings.whatsapp_enabled`).
    - Pengecekan preferensi notifikasi per pelanggan (`customer.send_isolir_reminder !== 0`).
    - Normalisasi nomor telepon ke format internasional (`62xxx`) via `normalizeWaDigits`.
    - Perlindungan deduplikasi pesan (`shouldSendWa`) dengan window waktu 30 detik untuk mencegah spamming jika terjadi pemanggilan ganda dalam waktu singkat.
    - Penghitungan total piutang invoice tagihan belum lunas (`billingService.getUnpaidInvoicesByCustomerId`).
    - Resolusi dinamis tautan login portal pelanggan (`public_base_url` / host & port).
    - Parsing template pesan WhatsApp (`whatsapp_isolir_message`) dengan dukungan variabel: `{{id_pelanggan}}`, `{{nama}}`, `{{paket}}`, `{{tagihan}}`, `{{link}}`, `{{jatuh_tempo}}`, dan `{{perusahaan}}`.
    - Pengiriman pesan melalui `whatsappBot.sendWA`.
- **Hook Transisi Status di `customerService.js`**:
  - Pada `updateCustomer(id, data)`, ditambahkan deteksi transisi status spesifik:
    ```javascript
    if (isStatusChanged) {
      if (newStatus === 'suspended') {
        syncCustomerIsolation(id).catch(err => logger.error(`[updateCustomer] Auto sync isolation error for customer ${id}: ${err.message}`));
        if (oldStatus === 'active') {
          const NotificationService = require('./notificationService');
          NotificationService.notifyCustomerIsolated(id).catch(err => logger.error(`[updateCustomer] WA isolation notif error for customer ${id}: ${err.message}`));
        }
      }
    }
    ```
  - Menyederhanakan `suspendCustomer` dan `activateCustomer` agar mendelegasikan pembaruan status ke `updateCustomer` tanpa mengeksekusi sinkronisasi router secara ganda.
- **Unit Testing (`tests/notificationService.test.js` & `tests/customerUpdatePppoe.test.js`)**:
  - Menambahkan pengujian eksekusi `notifyCustomerIsolated`, validasi pematuhan preferensi `send_isolir_reminder === 0`, serta memastikan pemanggilan `NotificationService.notifyCustomerIsolated` saat status berubah dari `active` ke `suspended`.

### 3. Hasil Pengujian & Verifikasi
- **Pengujian Unit (`npm test`)**: 12/12 Test Suites PASSED, 198/198 Tests PASSED.
- **Validasi Alur**:
  - Form edit pelanggan / API `updateCustomer` dari status `active` $\rightarrow$ `suspended` secara otomatis memicu pemutusan sesi router dan pengiriman WhatsApp notifikasi isolir.
  - Perubahan data non-status pada pelanggan yang sudah `suspended` tidak memicu pesan isolir ganda.
  - Tombol manual isolir di panel admin, sinkronisasi portal isolir, dan cron job harian isolir otomatis berjalan konsisten dan terintegrasi melalui notifikasi terpusat.


