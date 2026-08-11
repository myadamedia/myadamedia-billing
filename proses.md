# Catatan Proses Perubahan & Perbaikan Sistem (proses.md)

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

