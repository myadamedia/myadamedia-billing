# Walkthrough: Integrasi RADIUS Server (PPPoE & Hotspot)

Implementasi fitur **Embedded RADIUS Server (UDP Port 1812 Authentication, Port 1813 Accounting, dan Port 3799 Disconnect/CoA)** pada aplikasi **MyAdamedia Billing** telah selesai dikerjakan secara utuh, modular, dan siap digunakan di lingkungan produksi (*production-ready*).

---

## Ringkasan Perubahan Kode

```
myadamedia-billing/
├── config/
│   └── database.js               # [MODIFY] Tambah skema radius_nas, radius_acct, mikrotik_rate_limit
├── services/
│   ├── radiusCodec.js            # [NEW] Codec RADIUS RFC 2865 / 2866 / 3576 native (Zero-dependency)
│   ├── radiusDictionary.js       # [NEW] Kamus Vendor-Specific Attributes (VSA) MikroTik (Vendor ID: 14988)
│   ├── radiusCoaService.js       # [NEW] Service Disconnect-Request (PoD/CoA UDP 3799)
│   ├── radiusService.js          # [NEW] UDP Server Auth (1812) & Accounting (1813)
│   └── sidebarMenuService.js     # [MODIFY] Menu RADIUS NAS & Sesi RADIUS di Admin Portal
├── routes/
│   └── admin/
│       └── radius.js             # [NEW] Controller CRUD NAS Router & Monitoring Active Sessions
├── views/
│   └── admin/
│       └── radius/
│           ├── nas_management.ejs # [NEW] UI Manajemen Router NAS & Auto-Setup Terminal Script
│           └── active_sessions.ejs# [NEW] UI Real-time Active Sessions & Disconnect Kick (CoA)
├── app-customer.js               # [MODIFY] Mounting endpoint /admin/radius
└── proses.md                     # [MODIFY] Dokumentasi lengkap catatan proses perubahan
```

---

## Fitur Utama Terimplementasi

### 1. Embedded UDP RADIUS Server (Auth 1812 & Accounting 1813)
- Membuka socket UDP port **1812** untuk **Access-Request** pelanggan PPPoE (`customers`) dan Hotspot (`vouchers`).
- Mengembalikan atribut `Mikrotik-Rate-Limit` secara otomatis sesuai paket internet pelanggan.
- Jika pelanggan berstatus `isolated` / `suspended`, RADIUS mengembalikan `Mikrotik-Address-List = LIST_ISOLIR` dan `Mikrotik-Rate-Limit = 512k/512k`.
- Membuka socket UDP port **1813** untuk **Accounting-Request** (`Start`, `Interim-Update`, `Stop`) guna mencatat sesi aktif dan penggunaan kuota data (upload/download octets) di tabel `radius_acct`.

### 2. Disconnect-Request / CoA Instant Isolation (Port 3799)
- Modul `radiusCoaService` memungkinkan pemutusan koneksi seketika (*< 1 detik*) dari Admin Portal atau sistem isolir tanpa perlu bergantung pada socket MikroTik API.

### 3. Dashboard UI Admin & Auto Setup RouterOS
- **Halaman RADIUS NAS** (`/admin/radius`): Menampilkan daftar NAS Router terdaftar, Shared Secret, serta tombol **Script Terminal RouterOS** untuk mengonfigurasi RADIUS Client di MikroTik secara 1-Click.
- **Halaman Active Sessions** (`/admin/radius/sessions`): Menampilkan daftar pengguna yang sedang online, durasi, pemakaian data MB, IP address, MAC address, serta tombol **Kick (CoA)**.

---

## Cara Menjalankan & Menguji Aplikasi

### 1. Jalankan Aplikasi
```bash
npm run dev
# atau
node app-customer.js
```
Aplikasi akan secara otomatis menyalakan **UDP RADIUS Server** di port `1812` dan `1813`.

### 2. Buka Admin Portal
Akses melalui peramban: `http://localhost:3000/admin/radius`

### 3. Konfigurasi MikroTik RouterOS
1. Daftarkan IP MikroTik Anda di menu **RADIUS NAS** (misal: IP `192.168.88.1`, Secret `sandi-radius-anda`).
2. Salin skrip terminal dari tombol **Script** di UI Admin, lalu tempelkan di Winbox Terminal MikroTik:
   ```routeros
   /radius add service=ppp,hotspot address=IP_SERVER_BILLING secret="sandi-radius-anda" authentication-port=1812 accounting-port=1813 timeout=3s;
   /ppp aaa set use-radius=yes;
   /ip hotspot profile set [find] use-radius=yes;
   ```
