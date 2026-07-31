# Rencana Kustomisasi GenieACS (Implementation Plan)

Dokumen ini berisi pemetaan struktur folder, rencana pengorganisasian kode untuk kustomisasi GenieACS v1.2.12, dan opsi kustomisasi yang siap diimplementasikan sesuai standar Senior Full-Stack Developer & Network Engineer (fokus pada Clean Code, Keamanan, Performa Tinggi, 100% Test Coverage, dan DRY).

---

## 📂 Peta Struktur Folder & File Saat Ini

Berikut adalah struktur folder dan komponen utama di dalam repositori `genieacs-main` beserta fungsinya:

```
genieacs-main/
├── db/                       # Dump database default (BSON)
│   ├── config.bson           # Konfigurasi parameter & sistem
│   ├── devices.bson          # Data perangkat (dibersihkan)
│   ├── presets.bson          # Pengaturan trigger/preset TR-069
│   ├── provisions.bson       # Script provisioning (JavaScript TR-069)
│   ├── users.bson            # User admin (alijayanet dihapus, admin dipromosikan)
│   └── virtualParameters.bson# Parameter virtual untuk mapping CPE
├── ext/                      # Script ekstensi eksternal GenieACS
│   └── telegram.js           # Ekstensi notifikasi status & redaman Rx Power ke Telegram
├── genieacs/                 # Source Code utama GenieACS v1.2.12
│   ├── bin/                  # Executable commands (cwmp, nbi, fs, ui)
│   ├── node_modules/         # Dependensi Node.js
│   ├── public/               # Asset statis untuk UI dashboard
│   └── package.json          # Manifest dependensi & script Node.js
├── clean_db.py               # Script pembersihan & manipulasi file BSON
├── test_bson_cleaner.py      # Unit test 100% coverage untuk clean_db.py
├── start-genieacs.bat        # Windows launcher (menjalankan 4 mikroservis secara bersamaan)
├── install.ps1               # Installer otomatis untuk lingkungan Windows (PowerShell)
├── install.sh / darkmode.sh  # Installer otomatis untuk lingkungan Linux / Armbian
└── menambahkan_wan.txt       # Catatan/referensi teknis konfigurasi WAN & Binding ONT
```

---

## 🛠️ Opsi Kustomisasi yang Tersedia

Sebagai Senior Network Engineer dan Full-Stack Developer, saya dapat membantu Anda mengkustomisasi GenieACS untuk kebutuhan produksi. Beberapa kustomisasi yang direkomendasikan dan siap diimplementasikan:

### Opsi A: Kustomisasi Provisioning Presets & WAN Configuration (Sesuai `menambahkan_wan.txt`)
Mengotomatiskan konfigurasi modem/ONT saat pertama kali terhubung (Bootstrap) atau saat ada perubahan.
- **Implementasi**: Membuat script provisi JavaScript di `db/provisions.bson` yang dikonfigurasi melalui GUI / BSON.
- **Target**: Konfigurasi otomatis PPPoE, Bridge, binding port LAN/WLAN (SSID 2.4G & 5G), dan konfigurasi spesifik ONT (seperti ZTE F670L atau FiberHome).
- **Fitur Performa**: Penggunaan eksekusi paralel pada TR-069 RPC commands untuk meminimalisir waktu koneksi CPE.

### Opsi B: Peningkatan Keamanan & Keandalan Notifikasi Telegram (`ext/telegram.js`)
Meningkatkan fungsionalitas monitoring status modem.
- **Implementasi**: Optimasi `ext/telegram.js`.
- **Fitur**:
  - Validasi input IP, PPPoE Username, dan Rx Power untuk menghindari injeksi data berbahaya (Security).
  - Skema rate limiting agar bot tidak terkena blokir Telegram API saat terjadi mati lampu massal (Performa & Resiliensi).
  - Integrasi logging audit ke MongoDB lokal untuk analisis pasca-kejadian.

### Opsi C: Kustomisasi UI Dashboard (Dark Mode / Custom Brand)
Mengubah antarmuka default GenieACS agar terlihat modern dan sesuai dengan branding ISP Anda.
- **Implementasi**: Modifikasi CSS/JS di folder `genieacs/public` atau integrasi stylesheet baru (`app-*.css`).
- **Fitur**: Peningkatan estetika visual, transisi halus, mode gelap yang dioptimalkan, dan penambahan logo kustom.

### Opsi D: Integrasi REST API (Northbound Interface - NBI)
Membuat API kustom atau mengintegrasikan GenieACS dengan sistem billing eksternal Anda.
- **Implementasi**: Script Node.js eksternal yang berkomunikasi dengan API Port 7557 (NBI).
- **Fitur**: Sinkronisasi data pelanggan dari billing ke database perangkat GenieACS secara real-time.

---

## 🧪 Rencana Pengujian (Verification Plan & 100% Coverage)

1. **Unit Testing**: Setiap kode kustomisasi logic (seperti validasi data di `ext/telegram.js` atau script integrasi billing) akan dilengkapi dengan file unit test menggunakan kerangka kerja pengujian yang sesuai (misal: Mocha/Jest untuk JS atau PyTest/Unittest untuk Python).
2. **Kepatuhan DRY & Clean Code**: Menghindari redundansi penulisan helper database client atau logger dengan cara membungkusnya ke modul utilitas bersama.
3. **Analisis Coverage**: Menjalankan analisis coverage untuk memastikan fungsi-fungsi pemrosesan data kritis terlindungi 100%.

---

## 💬 Pertanyaan untuk Pengguna

> [!IMPORTANT]
> Mohon pilih jenis kustomisasi mana yang ingin Anda terapkan dari opsi di atas (atau jelaskan jika Anda memiliki kebutuhan kustomisasi lain yang lebih spesifik). 
> Setelah Anda menentukan kebutuhan kustomisasi, saya akan memperbarui file rencana implementasi ini dengan detail file yang akan diubah/dibuat sebelum kita mulai menulis kode.
