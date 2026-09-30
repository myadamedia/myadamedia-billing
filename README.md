# MyAdaMedia Billing & ISP Customer Portal

Aplikasi manajemen billing ISP, portal pelanggan, otomatisasi isolir tagihan, integrasi GenieACS TR-069, embedded RADIUS server, WhatsApp bot notifikasi, dan pengelolaan multi-router MikroTik dengan Web CLI Terminal interaktif langsung dari browser.

---

## 🚀 Fitur Utama

- **Multi-Router MikroTik**:
  - Manajemen multi-router MikroTik terpusat (Host, API Port 8728, SSH Port 22).
  - **MikroTik Web Terminal / CLI**: Terminal interaktif berbasis Xterm.js + WebSocket + SSH2 langsung dari browser tanpa perlu membuka Winbox atau PuTTY (mendukung auto-complete `[TAB]`, warna ANSI, riwayat perintah `↑`/`↓`, dan tombol pintas `Ctrl+C`).
  - Monitoring trafik interface secara real-time dan generator script isolir firewall otomatis.
- **Billing & Tagihan Otomatis**:
  - Auto-generate invoice bulanan dan cron job isolir pelanggan jatuh tempo yang presisi.
  - Multi-Payment Gateway (Tripay, Midtrans, Xendit, Duitku, dll) dan QRIS otomatis.
- **Embedded RADIUS Server**:
  - Server RADIUS mandiri bawaan (Port UDP 1812 Authentication & 1813 Accounting) untuk autentikasi PPPoE dan Hotspot.
- **GenieACS TR-069 Integration**:
  - Monitoring ONT / modem pelanggan, signal optik (Rx/Tx), restart CPE, dan konfigurasi WiFi jarak jauh.
- **WhatsApp Notification Bot**:
  - Notifikasi tagihan, konfirmasi pembayaran, dan informasi isolir otomatis via WhatsApp Baileys / WAHA.

---

## 🛠️ Persyaratan Sistem

- **Node.js**: Versi `>= 20.0.0`
- **NPM**: Versi `>= 9.0.0`
- **Database**: SQLite (dikelola otomatis via `better-sqlite3`, tidak membutuhkan instalasi server SQL terpisah)
- **Sistem Operasi**: Linux (Ubuntu 20.04/22.04/24.04 disarankan untuk server produksi) atau Windows 10/11.

---

## 📦 Panduan Instalasi & Menjalankan

### 1. Kloning Repositori & Instal Dependensi
```bash
git clone <URL_REPOSITORI>
cd myadamedia-billing
npm install
```

### 2. Konfigurasi Lingkungan (`.env`)
Salin file `env-example.txt` menjadi `.env` jika belum ada:
```bash
cp env-example.txt .env
```
Isi konfigurasi standar pada `.env`:
```env
PORT=3001
NODE_ENV=production
```

### 3. Konfigurasi Pengaturan (`settings.json`)
Pengaturan aplikasi (nama ISP, gateway pembayaran, format pesan WA, tanggal isolir) dikonfigurasi melalui menu **Pengaturan** di panel Admin atau langsung pada file `settings.json`.

### 4. Menjalankan Aplikasi

**Mode Pengembangan (Development):**
```bash
npm run dev
```

**Mode Produksi (Production dengan PM2):**
```bash
npm install -g pm2
pm2 start app-customer.js --name "myadamedia-billing"
pm2 save
pm2 startup
```

Aplikasi default berjalan pada: `http://localhost:3001`  
Panel Admin: `http://localhost:3001/admin`

---

## 💻 Panduan Penggunaan MikroTik Web Terminal

1. Buka menu **MikroTik → Router** pada URL `http://localhost:3001/admin/routers`.
2. Pada tabel router, temukan router yang ingin dikelola.
3. Di **Kolom Aksi**, klik tombol **Terminal** berikon hitam (`bi-terminal`).
4. Modal konsol terminal interaktif akan terbuka dan langsung terhubung via SSH:
   - Tekan tombol **`[TAB]`** untuk melengkapi perintah RouterOS secara otomatis.
   - Gunakan panah **`[↑]`** dan **`[↓]`** untuk melihat riwayat perintah yang pernah diketik.
   - Tekan **`Ctrl + C`** untuk menghentikan perintah streaming (seperti `/ping 8.8.8.8` atau `/tool torch`).
   - Gunakan tombol **Clear** untuk membersihkan layar console (`Ctrl + L`).
   - Gunakan tombol **Layar Penuh (Fullscreen)** di pojok kanan atas modal untuk memperluas tampilan console ke seluruh layar monitor.
   - Gunakan tombol **Test SSH** untuk menguji apakah port SSH MikroTik (default 22) aktif dan dapat dijangkau dari server billing.

> **Catatan Konfigurasi MikroTik:**  
> Pastikan service SSH telah aktif pada router MikroTik Anda:  
> `/ip service enable ssh`  
> Pastikan juga firewall MikroTik mengizinkan koneksi SSH dari IP server billing.

---

## 🧪 Menjalankan Pengujian (Testing)

Jalankan automated test suite Jest:
```bash
npm test
```
Untuk menjalankan pengujian spesifik fitur terminal:
```bash
node ./node_modules/jest/bin/jest.js tests/mikrotikTerminalService.test.js --runInBand --forceExit --coverage=false
```

---

## 📄 Catatan Pembaruan & Riwayat Perubahan

Seluruh dokumentasi teknis, perbaikan bug, dan pembaruan arsitektur tercatat secara berkala pada file [`proses.md`](file:///d:/WEBAPP/MyAdamedia%20ALL/myadamedia-billing/proses.md).
