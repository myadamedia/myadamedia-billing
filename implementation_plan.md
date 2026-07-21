# Rencana Implementasi: Pengujian 100% Coverage, Perbaikan DRY, dan Dokumentasi Deployment

Rencana ini dibuat untuk meningkatkan kualitas kode, keamanan, dan keandalan sistem penagihan dengan menambahkan pengujian unit 100% coverage untuk modul kritis, melakukan refaktorisasi pada kode yang duplikat (prinsip DRY), serta memperbarui dokumentasi instalasi dan deployment pada `README.md`.

## Modul Kritis yang Diidentifikasi
Untuk pengujian dengan coverage 100%, kita memilih modul utility dan konfigurasi murni (pure logic/utility) yang tidak memiliki ketergantungan langsung ke hardware OLT, RouterOS, atau chat bot eksternal:
1. `utils/securityHelper.js` - Mengatur hashing password dan verifikasi scrypt.
2. `utils/mikhmonParser.js` - Mengurai on-login script hotspot MikroTik dengan regex kompleks.
3. `config/settingsEncryption.js` - Melakukan enkripsi/dekripsi field sensitif di `settings.json`.
4. `config/settingsValidator.js` - Memvalidasi seluruh field konfigurasi berdasarkan skema tipe, batas, regex, dan enum.
5. `config/settingsManager.js` - Mengelola pembacaan/penulisan file settings, cache, dan modul konversi zona waktu lokal.
6. `config/settingsAudit.js` - Mencatat log audit perubahan konfigurasi, mengekspor riwayat ke CSV/JSON, dan pembersihan retensi log.

---

## User Review Required

> [!IMPORTANT]
> **Pemasangan Library Pengujian (Jest)**
> Kami akan menginstal `jest` sebagai `devDependencies` di `package.json` untuk menjalankan unit test dan mengukur coverage secara otomatis. Hal ini memerlukan eksekusi perintah `npm install --save-dev jest` di terminal.
>
> **Pemisahan Pengujian & Lingkungan Riil**
> Semua test suite untuk `settingsManager` dan `settingsAudit` akan menggunakan mock file system (`fs`) agar pengujian tidak memodifikasi file konfigurasi riil (`settings.json`) atau file audit log riil milik pengguna.

---

## Open Questions
*Tidak ada pertanyaan terbuka saat ini.* Jika Anda menyetujui detail implementasi di bawah ini, silakan tekan tombol **Proceed** untuk mulai mengeksekusi rencana.

---

## Proposed Changes

### Konfigurasi & Dependensi

#### [MODIFY] [package.json](file:///d:/BILLING%20FIX/myadamedia-billing/package.json)
- Menambahkan `jest` ke dalam `devDependencies`.
- Menambahkan script `"test": "jest --coverage"` dan `"test:cov": "jest --coverage --coverageThreshold='{\\\"global\\\": {\\\"branches\\\": 100, \\\"functions\\\": 100, \\\"lines\\\": 100, \\\"statements\\\": 100}}'\"` untuk memastikan coverage selalu 100%.
- Menambahkan konfigurasi Jest di package.json untuk menentukan file mana saja yang dihitung coverage-nya (`collectCoverageFrom`).

### Refaktorisasi DRY & Penyesuaian Pengujian

#### [MODIFY] [database.js](file:///d:/BILLING%20FIX/myadamedia-billing/config/database.js)
- Menghapus duplikasi kode penentuan zona waktu dan format string tanggal dari fungsi SQLite `NOW_LOCAL`.
- Mengimpor fungsi `getNowLocal` secara langsung dari `./settingsManager.js` untuk menggantikan logika duplikat tersebut.

#### [MODIFY] [settingsManager.js](file:///d:/BILLING%20FIX/myadamedia-billing/config/settingsManager.js)
- Menambahkan fungsi `stopSettingsWatcher()` dan mengekspornya. Ini diperlukan agar thread file watcher (`fs.watch`) bisa dihentikan di akhir pengujian, sehingga pengujian Jest dapat keluar (exit) secara bersih tanpa menggantung (hanging processes).

### Unit Test Baru (100% Coverage Target)

#### [NEW] [securityHelper.test.js](file:///d:/BILLING%20FIX/myadamedia-billing/tests/securityHelper.test.js)
- Menguji `hashPassword` dengan string biasa dan password kosong.
- Menguji `verifyPassword` untuk kecocokan hash scrypt valid, format hash tidak valid, fallback plaintext, dan password kosong.
- Menguji fungsi check `isHash`.

#### [NEW] [mikhmonParser.test.js](file:///d:/BILLING%20FIX/myadamedia-billing/tests/mikhmonParser.test.js)
- Menguji Format 1 (Mikhmon :put standar) dengan berbagai variasi format spasi, tanda petik, dan format ROS6/ROS7.
- Menguji Format 2 (Shorthand `$HARGA^VALIDITAS`).
- Menguji Format 3 (Bare `HARGA^VALIDITAS` tanpa dollar).
- Menguji Format 4 (Comma-split fallback untuk script lama).
- Menguji kasus input kosong (`null`, `undefined`, string kosong) dan input tanpa kecocokan format.

#### [NEW] [settingsEncryption.test.js](file:///d:/BILLING%20FIX/myadamedia-billing/tests/settingsEncryption.test.js)
- Menguji enkripsi dan dekripsi nilai tunggal menggunakan `MASTER_KEY` kustom maupun default.
- Menguji skenario kegagalan dekripsi dengan format yang salah.
- Menguji penanganan fallback ketika `MASTER_KEY` berubah, memastikan ia mencoba mendekripsi dengan key default lama.
- Menguji fungsi `encryptSettings`, `decryptSettings`, `maskValue`, `getMaskedSettings`, dan pengecekan `isSensitiveField`.

#### [NEW] [settingsValidator.test.js](file:///d:/BILLING%20FIX/myadamedia-billing/tests/settingsValidator.test.js)
- Menguji validasi masing-masing tipe data: `number`, `string`, `boolean`.
- Menguji validasi batas nilai (`min`/`max` untuk number, `minLength`/`maxLength` untuk string).
- Menguji kecocokan regex (`pattern`) untuk IP, email, phone, public URL, office coordinates, dan Telegram admin ID.
- Menguji validasi enum (contoh: `tripay_mode`, `default_gateway`, `midtrans_mode`).
- Menguji validasi required field kosong vs opsional field kosong.
- Memastikan `validateSettings` mengembalikan objek status valid beserta daftar error yang tepat.

#### [NEW] [settingsManager.test.js](file:///d:/BILLING%20FIX/myadamedia-billing/tests/settingsManager.test.js)
- Melakukan mock penuh terhadap library `fs` untuk menguji:
  - Pembacaan konfigurasi dengan cache dan fallback session secret.
  - Penyimpanan konfigurasi baru.
  - Penanganan timezone tidak valid atau kosong (kembali ke `Asia/Jakarta`).
  - Fungsi utility tanggal lokal: `getNowLocal`, `getCurrentDateInTimezone`, `getCurrentTimeInfo`, `getNowLocalISO`, `parseDateInTimezone`, dan `formatDateLocal`.
  - Inisialisasi watcher dan penutupan watcher via `stopSettingsWatcher()`.

#### [NEW] [settingsAudit.test.js](file:///d:/BILLING%20FIX/myadamedia-billing/tests/settingsAudit.test.js)
- Menguji logging perubahan settings dengan masking otomatis untuk field sensitif.
- Menguji filter pencarian riwayat berdasarkan actor, field, dan range tanggal.
- Menguji ekspor riwayat perubahan ke format JSON maupun CSV.
- Menguji kebijakan retensi log via `clearOldLogs`.
- Menguji agregasi statistik log audit via `getAuditStats`.

### Dokumentasi

#### [MODIFY] [README.md](file:///d:/BILLING%20FIX/myadamedia-billing/README.md)
- Melengkapi panduan instalasi dengan detail dependency untuk pengujian.
- Menjelaskan cara menjalankan unit test dan mengecek coverage.
- Memberikan panduan deployment terperinci menggunakan PM2 di Linux (Ubuntu/Armbian), optimasi produksi, pembuatan systemd service untuk PM2, auto-restart on boot, konfigurasi SSL dengan Nginx reverse proxy, dan penjadwalan backup database secara otomatis.

---

## Verification Plan

### Automated Tests
- Menjalankan testing dengan command:
  ```bash
  npm run test:cov
  ```
  Perintah ini akan menjalankan Jest dengan pengaturan strict coverage threshold 100% untuk semua file kritis yang disebutkan. Jika ada line, branch, function, atau statement yang terlewat, test runner akan memunculkan error dan gagal.

### Manual Verification
- Menjalankan server menggunakan `npm start` atau `npm run dev` untuk memastikan bahwa refaktorisasi timezone di `config/database.js` tidak merusak inisialisasi SQLite dan aplikasi dapat berjalan dengan normal.
