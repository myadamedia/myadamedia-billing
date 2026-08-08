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

