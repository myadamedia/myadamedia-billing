# Implementation Plan: Integrasi RADIUS Server (PPPoE & Hotspot)

Integrasi **RADIUS Server (Remote Authentication Dial-In User Service)** terpusat di dalam aplikasi **MyAdamedia Billing** untuk menangani autentikasi, autorisasi, dan pencatatan penggunaan (*AAA*) pengguna **PPPoE** dan **Hotspot** secara *real-time* via UDP (Auth: 1812, Acct: 1813, CoA/DM: 3799).

---

## User Review Required

> [!IMPORTANT]
> **Port UDP (1812, 1813, 3799)** harus diizinkan pada Firewall/Security Group server tempat `myadamedia-billing` berjalan.
> MikroTik RouterOS perlu ditambahkan sebagai **NAS (Network Access Server)** dengan IP Address & Shared Secret yang sama dengan yang didaftarkan pada Admin Portal.

> [!NOTE]
> Sistem RADIUS ini berjalan secara **Hybrid** dengan fitur yang sudah ada. Pengguna PPPoE & Hotspot yang sudah tersimpan di database SQLite (`customers` & `vouchers`) secara otomatis dapat langsung diautentikasi oleh RADIUS Server tanpa harus migrasi data manual.

---

## Open Questions

1. **Shared Secret Default NAS**: Apakah Anda ingin menentukan *Secret Key* default untuk komunikasi RADIUS antara MikroTik dan Billing Server (contoh: `adamedia-secret-2026`), atau seluruhnya diisi manual via Admin Portal?
2. **Interim Update Interval**: Berapa interval update statistik penggunaan kuota/traffic yang disarankan dari MikroTik ke Billing Server (default yang disarankan: 5 menit atau 300 detik)?

---

## Proposed Changes

### Core Database & Configuration

#### [MODIFY] [database.js](file:///d:/WEBAPP/myadamedia-billing/config/database.js)
- Menambahkan skema tabel `radius_nas` untuk menyimpan daftar router MikroTik terotorisasi (IP NAS, Secret Key, Shortname).
- Menambahkan skema tabel `radius_acct` untuk menyimpan riwayat sesi aktif, durasi koneksi, serta upload/download octets.
- Menambahkan kolom pendukung RADIUS di tabel `packages` (`mikrotik_rate_limit`) dan tabel `customers` / `vouchers`.

#### [MODIFY] [package.json](file:///d:/WEBAPP/myadamedia-billing/package.json)
- Menambahkan dependensi `radius` untuk encoding/decoding paket RADIUS RFC 2865 & RFC 2866 secara native dan presisi.

---

### RADIUS Service Core

#### [NEW] [radiusService.js](file:///d:/WEBAPP/myadamedia-billing/services/radiusService.js)
- Membuka socket UDP di port `1812` (Authentication) & `1813` (Accounting).
- Mengolah paket `Access-Request` untuk user PPPoE (`customers`) & Hotspot (`vouchers`).
- Mengembalikan `Access-Accept` dengan Vendor-Specific Attributes (VSA) MikroTik (`Mikrotik-Rate-Limit`, `Framed-IP-Address`) jika user aktif, atau `Access-Reject` jika terisolir / kredit habis.
- Mengolah paket `Accounting-Request` (`Start`, `Interim-Update`, `Stop`) untuk memperbarui penggunaan data pelanggan.

#### [NEW] [radiusCoaService.js](file:///d:/WEBAPP/myadamedia-billing/services/radiusCoaService.js)
- Menyediakan modul pengirim paket **Disconnect-Request (PoD/CoA)** via UDP port `3799` ke MikroTik.
- Memungkinkan pemutusan koneksi seketika (*instant isolation*) saat status invoice berubah menjadi *unpaid/isolated* atau voucher kadaluarsa.

#### [NEW] [radiusDictionary.js](file:///d:/WEBAPP/myadamedia-billing/services/radiusDictionary.js)
- Kamus atribut khusus RFC RADIUS & MikroTik VSA (Vendor ID: 14988) seperti `Mikrotik-Rate-Limit`, `Mikrotik-Group`, `Mikrotik-Realm`, dll.

---

### Backend API & Service Integration

#### [MODIFY] [mikrotikService.js](file:///d:/WEBAPP/myadamedia-billing/services/mikrotikService.js)
- Menambahkan helper fungsi untuk mengkonfigurasi script `RADIUS Client` secara otomatis di MikroTik via API (`/radius/add`, `/ppp/aaa/set`, `/ip/hotspot/profile/set`).

#### [NEW] [radius.js](file:///d:/WEBAPP/myadamedia-billing/routes/admin/radius.js)
- Controller & Router Admin Portal untuk:
  - CRUD NAS Router RADIUS.
  - Monitoring Active Sessions (Live Accounting Sessions).
  - Manual Disconnect User (Kick session).
  - Log Uji Coba Autentikasi RADIUS.

#### [MODIFY] [app-customer.js](file:///d:/WEBAPP/myadamedia-billing/app-customer.js)
- Menginisialisasi `radiusService` saat aplikasi Express di-booting.
- Menambahkan route `/admin/radius` ke dalam Admin Portal Router.

---

### User Interface (Admin Portal)

#### [NEW] [nas_management.ejs](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/nas_management.ejs)
- Halaman UI untuk mendaftarkan Router MikroTik ke RADIUS Server, melihat status konektivitas UDP, serta tombol 1-Click Auto-Setup RADIUS di RouterOS.

#### [NEW] [active_sessions.ejs](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/active_sessions.ejs)
- Dashboard sesi aktif pelanggan PPPoE & Hotspot yang terhubung via RADIUS beserta detail IP, MAC address, durasi, dan total pemakaian data.

---

## Verification Plan

### Automated Tests
- Menjalankan unit test Jest untuk validasi parsing paket RADIUS Auth & Accounting:
  ```bash
  npm test
  ```

### Manual Verification
1. **Uji Coba RADIUS Auth (PPPoE & Hotspot)**:
   - Menjalankan simulasi request RADIUS Access-Request menggunakan tool `radtest` / script uji UDP.
   - Memastikan `Access-Accept` diterima dengan atribut `Mikrotik-Rate-Limit` yang sesuai dengan paket internet.
2. **Uji Coba Multi-NAS (MikroTik)**:
   - Menghubungkan Router MikroTik sungguhan / CHR ke RADIUS server.
   - Melakukan login PPPoE / Hotspot voucher dan menyimak pencatatan sesi di tabel `radius_acct`.
3. **Uji Coba CoA Instant Kick / Disconnect**:
   - Mengubah status pelanggan menjadi *isolated* dari Admin Portal, dan memastikan `radiusCoaService` memutus koneksi di MikroTik dalam kurun waktu < 1 detik.
