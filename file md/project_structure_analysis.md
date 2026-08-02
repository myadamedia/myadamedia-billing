# Analisis Struktur Aplikasi MyAdamedia Billing

Aplikasi ini merupakan **Sistem Manajemen Billing, CRM, Ticketing, Monitoring, dan Provisioning OLT/MikroTik** terintegrasi yang dirancang khusus untuk penyedia layanan internet (ISP / RTRWnet). Sistem ini dibangun dengan teknologi **Node.js**, **Express**, **EJS (Embedded JavaScript Templates)**, dan database **SQLite** (`better-sqlite3`).

---

## 1. Struktur Direktori Utama

Berikut adalah gambaran umum direktori proyek dan fungsinya:

| Direktori/Berkas | Tipe | Deskripsi |
| :--- | :--- | :--- |
| [`app-customer.js`](file:///d:/BILLING%20FIX/myadamedia-billing/app-customer.js) | File | Entry point utama aplikasi Express. Menginisialisasi middleware, database, routes, cron jobs, serta bot WhatsApp & Telegram. |
| [`config/`](file:///d:/BILLING%20FIX/myadamedia-billing/config) | Folder | Konfigurasi inti seperti database (`database.js`), logger, enkripsi, translasi (`i18n.js`), dan pengaturan aplikasi. |
| [`routes/`](file:///d:/BILLING%20FIX/myadamedia-billing/routes) | Folder | Router Express yang mendefinisikan endpoint API dan navigasi untuk setiap portal pengguna. |
| [`services/`](file:///d:/BILLING%20FIX/myadamedia-billing/services) | Folder | Logika bisnis (business logic) dan integrasi eksternal (MikroTik, OLT SNMP/Telnet, TR-069 ACS, WhatsApp, dll.). |
| [`views/`](file:///d:/BILLING%20FIX/myadamedia-billing/views) | Folder | Template UI berbasis EJS untuk dirender ke sisi client. Diatur berdasarkan role portal. |
| [`public/`](file:///d:/BILLING%20FIX/myadamedia-billing/public) | Folder | Asset statis seperti gambar, file CSS client-side, JS client-side, dan icon PWA. |
| [`locales/`](file:///d:/BILLING%20FIX/myadamedia-billing/locales) | Folder | File translasi bahasa untuk i18n. |
| [`database.sqlite`](file:///d:/BILLING%20FIX/myadamedia-billing/database.sqlite) | File | File database SQLite (jika diletakkan di root, namun default diarahkan ke `database/billing.db`). |

---

## 2. Arsitektur Multi-Portal (Multi-Role Routing)

Aplikasi membagi hak akses ke beberapa portal terpisah yang dimuat di [`app-customer.js`](file:///d:/BILLING%20FIX/myadamedia-billing/app-customer.js#L828-L846):

1. **Customer Portal (`/customer`)** -> [`customerPortal.js`](file:///d:/BILLING%20FIX/myadamedia-billing/routes/customerPortal.js)
   * Digunakan oleh pelanggan untuk login (OTP/Password), melihat tagihan, melakukan pembayaran QRIS otomatis, dan membuat tiket bantuan (komplain).
2. **Admin Portal (`/admin`)** -> [`adminPortal.js`](file:///d:/BILLING%20FIX/myadamedia-billing/routes/adminPortal.js)
   * Dashboard kontrol pusat untuk manajemen pelanggan, paket internet, tagihan (invoices), manajemen OLT & Router MikroTik, broadcast pesan WhatsApp, absensi staf, dan pengaturan sistem.
3. **Technician Portal (`/tech`)** -> [`techPortal.js`](file:///d:/BILLING%20FIX/myadamedia-billing/routes/techPortal.js)
   * Portal untuk teknisi lapangan untuk mengelola tiket gangguan, mengunggah foto bukti perbaikan dengan metadata GPS/Timestamp, dan melakukan absensi kehadiran.
4. **Agent Portal (`/agent`)** -> [`agentPortal.js`](file:///d:/BILLING%20FIX/myadamedia-billing/routes/agentPortal.js)
   * Portal untuk agen/mitra penjualan untuk top-up saldo, penjualan voucher hotspot MikroTik secara real-time, dan pembayaran tagihan pelanggan.
5. **Collector Portal (`/collector`)** -> [`collectorPortal.js`](file:///d:/BILLING%20FIX/myadamedia-billing/routes/collectorPortal.js)
   * Portal bagi petugas penagih tagihan langsung ke rumah pelanggan dengan sistem persetujuan (approval) oleh admin/kasir.

---

## 3. Struktur Database (Schema & Fitur Unik)

Definisi tabel database berada di [`database.js`](file:///d:/BILLING%20FIX/myadamedia-billing/config/database.js). Fitur-fitur penting dalam skema database:
* **Fungsi Waktu Lokal (`NOW_LOCAL`)**: Menyesuaikan waktu SQLite secara dinamis berdasarkan timezone yang dipilih di pengaturan (default: `Asia/Jakarta`).
* **Force Unlock Core Menus**: Mekanisme [`forceUnlockCoreMenus()`](file:///d:/BILLING%20FIX/myadamedia-billing/config/database.js#L520-L564) untuk memaksa menu-menu penting seperti `mikrotik`, `whatsapp`, dan `settings` agar selalu aktif/visible di menu sidebar.
* **Tabel Penting**:
  * `customers`: Menyimpan info PPPoE/Hotspot, ODP, OLT, koordinat GPS, IP statis, dan status isolir.
  * `invoices`: Data tagihan bulanan pelanggan beserta kode unik QRIS untuk verifikasi pembayaran otomatis.
  * `public_voucher_orders` & `vouchers`: Pembelian voucher hotspot via QRIS secara publik mandiri.
  * `tickets`: Tiket keluhan gangguan pelanggan, menyimpan foto bukti dalam bentuk JSON Array.
  * `inventory_items` & `inventory_stock`: Sistem inventaris gudang (kabel, ONT, router) lengkap dengan pencatatan Serial Number (SN) barang.
  * `attendance`: Pencatatan absensi karyawan dengan foto selfie check-in/out dan titik koordinat GPS.
  * `payroll_settings` & `payroll`: Sistem penggajian staf berdasarkan kehadiran, tunjangan, dan kas bon.

---

## 4. Integrasi Layanan Utama

### A. MikroTik Integration ([`mikrotikService.js`](file:///d:/BILLING%20FIX/myadamedia-billing/services/mikrotikService.js))
* Menggunakan `routeros-client` untuk berkomunikasi dengan API RouterOS MikroTik.
* Melakukan sinkronisasi profil PPPoE, menambahkan/menghapus user hotspot, memantau traffic real-time, dan memindahkan pelanggan yang telat bayar ke profil isolir (`isolir_profile`).

### B. OLT & ONU Provisioning ([`oltService.js`](file:///d:/BILLING%20FIX/myadamedia-billing/services/oltService.js))
* Mendukung manajemen OLT dari berbagai brand (ZTE, Huawei, VSOL, dll.) menggunakan kombinasi **SNMP** dan **Telnet/SSH**.
* Mengotomatiskan proses deteksi ONU baru (Unconfigured ONU), provisioning ONT baru, membaca redaman (optical power), serta konfigurasi VLAN secara remote.

### C. CWMP / ACS Server TR-069 ([`acsServerService.js`](file:///d:/BILLING%20FIX/myadamedia-billing/services/acsServerService.js))
* Endpoint `/acs` di [`app-customer.js`](file:///d:/BILLING%20FIX/myadamedia-billing/app-customer.js#L825-L826) bertindak sebagai server ACS (Auto Configuration Server) mini.
* Memungkinkan router pelanggan (CPE) melakukan autoprovisioning via protokol standar TR-069 saat pertama kali dicolokkan ke jaringan.

### D. WhatsApp & Telegram Bots
* **WhatsApp Bot (`whatsappBot.mjs`)**: Menggunakan `@whiskeysockets/baileys` untuk menghubungkan nomor WA ISP. Digunakan untuk mengirim tagihan otomatis, notifikasi pembayaran sukses, pengiriman kode voucher hotspot, dan broadcast pengumuman.
* **Telegram Bot (`telegramBot.js`)**: Digunakan untuk monitoring notifikasi sistem ke admin/staf (misal: notifikasi pembayaran masuk, tiket gangguan baru, atau status router down).

### E. Webhook QRIS Otomatis ([`app-customer.js`](file:///d:/BILLING%20FIX/myadamedia-billing/app-customer.js#L483-L680))
* Endpoint `/api/webhook/v1/payment-notif` mendeteksi nominal unik pembayaran QRIS masuk.
* Jika nominal unik cocok dengan invoice pelanggan yang berstatus `unpaid`, sistem akan otomatis:
  1. Mengubah status invoice menjadi `paid` (Lunas).
  2. Mengaktifkan kembali koneksi internet pelanggan jika sebelumnya diisolir/suspend.
  3. Mengirimkan struk/notifikasi sukses pembayaran via WhatsApp.

---

## 5. Layanan Latar Belakang (Background Services)

* **Cron Jobs (`cronService.js`)**: Mengotomatiskan pembuatan tagihan baru di awal bulan, pemeriksaan status isolir pelanggan yang belum membayar, dan sinkronisasi berkala dengan router.
* **Auto Backup (`backupService.js`)**: Menjadwalkan backup database SQLite secara berkala untuk mencegah kehilangan data penting.
