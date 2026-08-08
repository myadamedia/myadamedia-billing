# Catatan Proses Perubahan & Perbaikan Sistem (proses.md)

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

