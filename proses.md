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

