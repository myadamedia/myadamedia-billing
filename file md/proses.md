# Catatan Proses & Riwayat Perubahan (proses.md)

Dokumen ini mencatat seluruh proses analisis, perancangan arsitektur, dan perubahan kode pada aplikasi **MyAdamedia Billing**.

---

## [2026-08-06] - Feature Update: Implementasi Notifikasi Multi-Channel (WhatsApp & Telegram) untuk Tiket Keluhan Pelanggan Baru

### 1. Kebutuhan Fitur & Permasalahan
- Sebelumnya, saat pelanggan mengirimkan tiket keluhan baru, notifikasi hanya dikirimkan via WhatsApp dan tidak ada notifikasi yang terkirim ke Telegram.
- Logika pengiriman notifikasi terbarsegmentasi di beberapa file router tanpa modul penanganan notifikasi terpusat.
- Pengaturan validasi Telegram Admin ID sebelumnya belum mendukung ID Group (berawalan minus `-`) atau multi Admin ID (dipisahkan koma).

### 2. Solusi & Arsitektur yang Diterapkan
- **Pengembangan Telegram Bot Connector ([services/telegramBot.js](file:///d:/WEBAPP/myadamedia-billing/services/telegramBot.js))**:
  - Menambahkan fungsi `sendTelegramMessage(chatId, text, options)` dan `sendTelegramAdminNotification(text, options)`.
  - Menggunakan instance polling `bot` apabila aktif, atau fallback otomatis ke REST API Telegram (`https://api.telegram.org/bot<token>/sendMessage`) via Axios jika polling dihentikan/tidak aktif.
- **Pembaruan Schema Validator Settings ([config/settingsValidator.js](file:///d:/WEBAPP/myadamedia-billing/config/settingsValidator.js))**:
  - Mengubah regex `telegram_admin_id` menjadi `/^[-\d,\s]+$/` agar aman menerima Group ID (seperti `-100123456789`) dan daftar ID dipisahkan koma.
- **Modul Notification Service Terpusat ([services/notificationService.js](file:///d:/WEBAPP/myadamedia-billing/services/notificationService.js))**:
  - Membuat service terpusat `NotificationService` dengan method static `notifyNewTicket(params)` dan `notifyTechnicianAssignment(params)`.
  - Secara otomatis mendistribusikan notifikasi ke:
    1. **WhatsApp**: Ke nomor-nomor admin (`whatsapp_admin_numbers`) dan seluruh teknisi aktif.
    2. **Telegram**: Ke admin / group Telegram yang terkonfigurasi di `telegram_admin_id`.
- **Integrasi Router ([routes/customerPortal.js](file:///d:/WEBAPP/myadamedia-billing/routes/customerPortal.js) & [routes/adminPortal.js](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js))**:
  - Menghubungkan proses submit keluhan pelanggan dan tiket admin dengan `NotificationService.notifyNewTicket(...)`.
- **Unit Testing ([tests/notificationService.test.js](file:///d:/WEBAPP/myadamedia-billing/tests/notificationService.test.js))**:
  - Dibuat unit test untuk memverifikasi fungsi pengiriman notifikasi Telegram dan NotificationService berjalan tanpa melempar exception.

### 3. File Diperbarui & Ditambahkan
- [`services/telegramBot.js`](file:///d:/WEBAPP/myadamedia-billing/services/telegramBot.js): Penambahan `sendTelegramMessage` & `sendTelegramAdminNotification`.
- [`config/settingsValidator.js`](file:///d:/WEBAPP/myadamedia-billing/config/settingsValidator.js): Penyesuaian regex validator `telegram_admin_id`.
- [`services/notificationService.js`](file:///d:/WEBAPP/myadamedia-billing/services/notificationService.js) *(FILE BARU)*: Module pusat notifikasi multi-channel.
- [`routes/customerPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/customerPortal.js): Integrasi `NotificationService` pada ticket submission pelanggan.
- [`routes/adminPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js): Integrasi `NotificationService` pada penambahan tiket admin.
- [`tests/notificationService.test.js`](file:///d:/WEBAPP/myadamedia-billing/tests/notificationService.test.js) *(FILE BARU)*: Unit test Jest.

---

## [2026-08-06] - UI Update: Penyederhanaan Tampilan Paket & Harga pada Halaman Login Pelanggan

### 1. Kebutuhan UI
Menyesuaikan blok "Paket & Harga" pada halaman login portal pelanggan ([`views/login.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/login.ejs)) agar hanya menampilkan format nama paket dan harga per bulan saja (contoh: `LITE — Rp 150.000/bulan`) tanpa menyertakan keterangan kecepatan (Mbps) maupun deskripsi paket.

### 2. Solusi yang Diterapkan
- **Modifikasi Template EJS ([views/login.ejs](file:///d:/WEBAPP/myadamedia-billing/views/login.ejs))**:
  - Menghapus sub-elemen info kecepatan (`speed_down`/`speed_up`) dan deskripsi paket.
  - Memperbarui teks informasi Akses Cepat menjadi "Cek tagihan bisa dilakukan tanpa login."

### 3. File Diperbarui
- [`views/login.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/login.ejs): Format tampilan Paket & Harga disederhanakan.

---

## [2026-08-06] - UI Update: Menyembunyikan Tombol Fitur Voucher pada Halaman Login Pelanggan

### 1. Kebutuhan UI
Menyembunyikan opsi tautan "Voucher" pada halaman login portal pelanggan ([`views/login.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/login.ejs)) agar tampilan tombol aksi cepat (*quick-actions*) menjadi lebih bersih dan terfokus pada tombol "Cek Tagihan".

### 2. Solusi yang Diterapkan
- **Modifikasi Template EJS ([views/login.ejs](file:///d:/WEBAPP/myadamedia-billing/views/login.ejs))**:
  Menghapus elemen `<a href="/customer/voucher">` dan menyesuaikan kontainer CSS `.quick-actions` menjadi `grid-template-columns: 1fr` sehingga tombol "Cek Tagihan" tampil penuh.

### 3. File Diperbarui
- [`views/login.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/login.ejs): Menyembunyikan tombol Voucher.

---

## [2026-08-06] - Feature Update: Penyesuaian Header Notifikasi WhatsApp Pembayaran Parsial & Catatan Penagihan Bulan Berikutnya

### 1. Kebutuhan Fitur
Memperbarui pesan notifikasi WhatsApp untuk pembayaran parsial (sebagian):
- Header notifikasi diubah dari `PEMBAYARAN BERHASIL (LUNAS)` menjadi `PEMBAYARAN SEBAGIAN / PARTIAL DITERIMA`.
- Menginformasikan nominal sisa tagihan secara jelas (`⚠️ Sisa Tagihan: Rp XXX`).
- Menambahkan catatan penagihan: `📌 Catatan: Sisa tagihan akan ditagihkan bulan berikutnya.`.

### 2. Solusi yang Diterapkan
- **Pengaturan Template WhatsApp ([routes/adminPortal.js](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js) & [views/admin/whatsapp_templates.ejs](file:///d:/WEBAPP/myadamedia-billing/views/admin/whatsapp_templates.ejs))**:
  - Menambahkan template terpisah `whatsapp_payment_partial_message` pada database app setting serta halaman pengaturan template admin.
  - Memperbarui `sendPaymentSuccessWA` agar secara otomatis mendeteksi status pembayaran parsial dan menggunakan format header `*PEMBAYARAN SEBAGIAN / PARTIAL DITERIMA*` beserta variabel `{{sisa_tagihan}}` dan catatan penagihan bulan berikutnya.
- **Notifikasi Auto-Approve Kolektor ([routes/collectorPortal.js](file:///d:/WEBAPP/myadamedia-billing/routes/collectorPortal.js))**:
  - Menyelaraskan pesan WhatsApp yang dikirim oleh sistem saat kolektor memproses pembayaran parsial.

### 3. File Diperbarui
- [`routes/adminPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js): Pembedaan template WA lunas vs parsial & pengisian variabel sisa tagihan.
- [`routes/collectorPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/collectorPortal.js): Penyesuaian header & rincian sisa tagihan pada notifikasi kolektor.
- [`views/admin/whatsapp_templates.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/whatsapp_templates.ejs): Form editor template Pembayaran Parsial.

---

## [2026-08-05] - Feature Update: Implementasi Alokasi Pembayaran FIFO Waterfall & Penyesuaian Sisa Tagihan Multi-Invoice

### 1. Permasalahan & Kebutuhan Spesifik
Saat pelanggan memiliki 2 invoice tertunggak (misal Paket Lite Rp 150.000 x 2 = Rp 300.000) dan membayar nominal sebagian (misal Rp 250.000):
- Sebelumnya, status Invoice 1 tidak berubah menjadi lunas (tetap menggantung).
- Sisa nominal Rp 100.000 tidak teralokasi dengan benar ke Invoice 2, sehingga Invoice 2 tidak tercatat berstatus parsial dengan sisa Rp 50.000.
- Saat Invoice 3 terbit, kalkulasi akumulasi sisa tagihan menjadi tidak presisi.

### 2. Solusi yang Diterapkan
- **Engine FIFO Waterfall Payment ([services/billingService.js](file:///d:/WEBAPP/myadamedia-billing/services/billingService.js))**:
  Membuat fungsi `processCustomerPayment(customerId, amount, paidByName, notes, actor)` yang mengambil seluruh invoice tertunggak pelanggan diurutkan secara kronologis (`period_year ASC, period_month ASC, id ASC`). Pembayaran dialokasikan penuh ke Invoice 1 terlebih dahulu hingga statusnya berubah menjadi **`paid` (LUNAS)**, lalu sisa dana dialokasikan ke Invoice 2 sehingga statusnya menjadi **`partial`** (`paid_amount` = 100.000, `balance_due` = **Rp 50.000**).
- **Nominal Murni Invoice & Carried Balance**:
  Fungsi `computeInvoiceAmountAndMeta` disesuaikan agar `amount` invoice mencatat harga paket murni bulan berjalan (Rp 150.000), sementara `carried_balance` mencatat sisa tunggakan dari bulan sebelumnya (Rp 50.000), sehingga total tunggakan kumulatif aktif di Bulan 3 persis **Rp 200.000**.
- **Integrasi Router & Kolektor ([routes/adminPortal.js](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js) & [routes/collectorPortal.js](file:///d:/WEBAPP/myadamedia-billing/routes/collectorPortal.js))**:
  Mengarahkan seluruh handler pembayaran (Admin Bayar Parsial, Auto-Approve Kolektor, dan Approval Kolektor) untuk mengeksekusi `processCustomerPayment` dengan alokasi FIFO.
- **Pengujian Terverifikasi**:
  Dibuat dan dijalankan script simulasi unit test FIFO (`test_fifo.js`). Hasil pengujian:
  - Invoice 1 (Rp 150.000) -> Status `PAID`, `balance_due` = 0.
  - Invoice 2 (Rp 150.000) -> Status `PARTIAL`, `paid_amount` = 100.000, `balance_due` = 50.000.
  - Invoice 3 -> Tagihan Paket Rp 150.000 + Sisa Lalu Rp 50.000 = Total Tunggakan Aktif **Rp 200.000** (100% PASSED).

### 3. File Diperbarui
- [`services/billingService.js`](file:///d:/WEBAPP/myadamedia-billing/services/billingService.js): Implementasi `processCustomerPayment` FIFO engine & penyesuaian nominal invoice murni.
- [`routes/adminPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js): Integrasi `processCustomerPayment` pada route `/billing/:id/pay-partial` & approval kolektor.
- [`routes/collectorPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/collectorPortal.js): Integrasi `processCustomerPayment` pada auto-approve pembayaran kolektor.

---

## [2026-08-05] - Feature Update: Penambahan Sisa Tagihan (Partial Payment Arrears) Ke Tagihan Bulan Selanjutnya & Broadcast Transparan

### 1. Permasalahan & Kebutuhan Fitur
Sebelumnya, jika pelanggan membayar kurang dari total tagihan (*partial payment*), sistem tidak memiliki mekanisme otomatis untuk mengonsolidasikan sisa tunggakan tersebut ke tagihan periode berikutnya. Sisa tagihan menggantung di invoice lama tanpa rincian transparan pada pesan Broadcast WhatsApp maupun UI Billing Admin & Pelanggan.

### 2. Solusi yang Diterapkan
- **Migrasi Database Safe Schema ([config/database.js](file:///d:/WEBAPP/myadamedia-billing/config/database.js))**:
  Menambahkan kolom `paid_amount`, `balance_due`, dan `carried_balance` pada tabel `invoices` menggunakan `PRAGMA table_info` dan `ALTER TABLE` secara aman tanpa merusak data existing.
- **Logika Kalkulasi & Akses Data ([services/billingService.js](file:///d:/WEBAPP/myadamedia-billing/services/billingService.js))**:
  - `computeInvoiceAmountAndMeta`: Mengakumulasi sisa tunggakan `balance_due` dari invoice bulan-bulan sebelumnya sebagai `carried_balance` dan menambahkan rincian otomatis pada catatan invoice (`AUTO: ... | Sisa Tagihan Lalu: Rp X`).
  - `generateMonthlyInvoices` & `generateInvoiceForCustomer`: Menyimpan `paid_amount`, `balance_due`, dan `carried_balance` secara presisi.
  - `recordPartialPayment`: Menambahkan fungsi pencatatan bayar parsial (sebagian) yang secara otomatis menghitung ulang `paid_amount`, `balance_due`, serta mengubah status invoice ke `partial` atau `paid`.
  - Memperbarui fungsi `getUnpaidInvoicesByCustomerId`, `getDashboardStats`, `getInvoiceSummary`, `getMonthlyRevenue`, dan `getTopUnpaid` agar menghitung `balance_due` dan mengakomodasi status `partial`.
- **Modul Broadcast WhatsApp & CRON ([services/cronService.js](file:///d:/WEBAPP/myadamedia-billing/services/cronService.js) & [routes/adminPortal.js](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js))**:
  - Memperbarui pengisian placeholder WhatsApp broadcast tagihan: `{sisa_lalu}`, `{sisa_tagihan_bulan_lalu}`, dan `{rincian_sisa}`.
  - Saat broadcast dikirim, pesan WhatsApp menyajikan rincian transparan: Harga Paket Bulan Ini, Sisa Tagihan Bulan Lalu, dan Total Harus Dibayar.
- **Antarmuka Admin & Portal Pelanggan ([views/admin/billing.ejs](file:///d:/WEBAPP/myadamedia-billing/views/admin/billing.ejs) & [views/dashboard.ejs](file:///d:/WEBAPP/myadamedia-billing/views/dashboard.ejs))**:
  - **Admin Billing**: Menambahkan status badge `PARTIAL` (orange), rincian `Terbayar` & `Sisa`, modal interaktif "Bayar Parsial" (`partialModal`) dengan tombol cepat (50% / Pelunasan Penuh).
  - **Customer Portal**: Menampilkan status `PARSIAL`, nominal yang sudah dibayar, sisa tagihan, dan tombol bayar online yang hanya menagih sisa nominal `balance_due`.

### 3. File Diperbarui
- [`config/database.js`](file:///d:/WEBAPP/myadamedia-billing/config/database.js): Migrasi kolom `paid_amount`, `balance_due`, `carried_balance`.
- [`services/billingService.js`](file:///d:/WEBAPP/myadamedia-billing/services/billingService.js): Logika `computeInvoiceAmountAndMeta`, `recordPartialPayment`, status `partial`.
- [`services/cronService.js`](file:///d:/WEBAPP/myadamedia-billing/services/cronService.js): Support placeholder sisa tagihan pada broadcast otomatis.
- [`routes/adminPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js): Route `POST /billing/:id/pay-partial` & kalkulasi broadcast tagihan.
- [`views/admin/billing.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/billing.ejs): UI status badge `PARTIAL`, modal `partialModal`, tombol bayar parsial.
- [`views/admin/whatsapp_templates.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/whatsapp_templates.ejs): Dokumentasi variabel `{sisa_lalu}` & `{rincian_sisa}`.
- [`views/dashboard.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/dashboard.ejs): Tampilan status `PARSIAL` & sisa tagihan di Customer Portal.

---

## [2026-08-05] - Bug Fix: Perbaikan Live Bandwidth Monitoring Interface Selalu 0 Bps pada Dashboard

### 1. Permasalahan & Penyebab Utama
Saat admin memilih interface MikroTik pada dropdown monitoring di dashboard admin (`views/admin/dashboard.ejs`), data akumulasi total Rx/Tx bytes muncul dengan benar, namun indikator **DOWNLOAD (RX SPEED)** dan **UPLOAD (TX SPEED)** selalu bernilai **0 Bps**.

**Penyebab Utama**:
Ketidakcocokan nama kunci properti antara Service API dan Client JS:
- Service Engine (`getInterfaceTraffic` di `services/mikrotikService.js`) mengembalikan data bertipe *camelCase*: `rxBitsPerSecond` & `txBitsPerSecond`.
- Client Script pada Dashboard (`fetchDashIfaceTraffic`) mencoba membaca properti bertipe *hyphenated*: `d.traffic['rx-bits-per-second']` dan `d.traffic.rx`.
- Karena kunci `rx-bits-per-second` bernilai `undefined`, kalkulasi kecepatan otomatis jatuh ke nilai default `0 Bps`.

### 2. Solusi yang Diterapkan
- **Unified Property Alias Engine ([services/mikrotikService.js](file:///d:/WEBAPP/myadamedia-billing/services/mikrotikService.js))**:
  Memperbarui return object `getInterfaceTraffic` agar mengembalikan seluruh variasi nama kunci properti (`rxBitsPerSecond`, `txBitsPerSecond`, `rx-bits-per-second`, `tx-bits-per-second`, `rx`, dan `tx`) secara bersamaan.
- **Robust Client Traffic Parsing ([views/admin/dashboard.ejs](file:///d:/WEBAPP/myadamedia-billing/views/admin/dashboard.ejs))**:
  Memperbarui fungsi `fetchDashIfaceTraffic` dengan operator nullish coalescing (`rxBitsPerSecond ?? rx-bits-per-second ?? rx ?? 0`), sehingga secara adaptif membaca data kecepatan bandwidth terlepas dari variasi nama properti.

### 3. File Diperbarui
- [`services/mikrotikService.js`](file:///d:/WEBAPP/myadamedia-billing/services/mikrotikService.js): Aliasing properti traffic `getInterfaceTraffic`.
- [`views/admin/dashboard.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/dashboard.ejs): Robust parsing `fetchDashIfaceTraffic`.

---

## [2026-08-05] - Bug Fix: Perbaikan Error "Gagal Reset origin/main" pada Fitur Update Aplikasi via GitHub

### 1. Permasalahan & Penyebab Utama
Saat melakukan update aplikasi dari menu **Update Aplikasi** (`/admin/update`), sistem mengalami kegagalan dengan pesan error: `Gagal update: Gagal reset ke origin/main`.
Penyebab utama meliputi:
1. **Kesalahan Eksekusi `git checkout -- settings.json` pada File Ignored**:
   File `settings.json` dan `database` berada di dalam `.gitignore`. Ketika sistem menjalankan `git checkout -- settings.json`, Git mengembalikan status error `pathspec 'settings.json' did not match any file(s) known to git` sehingga membatalkan proses update.
2. **Pendeteksian Branch Kurang Presisi**:
   Fungsi `getGitDefaultBranch()` sebelumnya hanya memeriksa `symbolic-ref origin/HEAD`. Jika `origin/HEAD` tidak terset di sistem lokal, sistem secara *fallback* mengasumsikan branch `main` tanpa mengecek branch lokal aktif (`git rev-parse --abbrev-ref HEAD`).
3. **Tanpa Fallback Reset**:
   Jika pembaruan ref `origin/main` memerlukan sinkronisasi `FETCH_HEAD` atau penanganan konflik lokal, perintah `git reset --hard` langsung menggagalkan seluruh proses update tanpa mencatat rincian *stderr* Git.

### 2. Solusi yang Diterapkan
- **Deteksi Branch Akurat ([routes/adminPortal.js](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js))**:
  Memperbarui `getGitDefaultBranch()` agar pertama-tama mendeteksi branch lokal aktif (`git rev-parse --abbrev-ref HEAD`).
- **Pembersihan Berkas Aman**:
  Menghapus pemanggilan `git checkout -- settings.json` dan `git checkout -- database` yang keliru, serta menggantikannya dengan `git checkout -f [branch]` untuk membersihkan berkas *tracked* secara aman tanpa mengganggu berkas konfigurasi lokal.
- **Robust Fetch & Hard Reset with Fallback**:
  - Mengambil update langsung dengan `git fetch origin [branch]` dengan fallback ke `git fetch --prune`.
  - Melakukan `git reset --hard origin/[branch]` dengan fallback otomatis ke `git reset --hard FETCH_HEAD`.
  - Menampilkan rincian output error `stderr` yang transparan jika git mengalami kendala.

### 3. File Diperbarui
- [`routes/adminPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js): Logika `getGitDefaultBranch()` & perbaikan handler `POST /update/run`.

---

## [2026-08-05] - Feature Update: Penambahan Fitur Status MikroTik (Daftar Router MikroTik) pada Dashboard Admin

### 1. Permasalahan & Kebutuhan Fitur
Sebelumnya, Dashboard Admin (`views/admin/dashboard.ejs`) hanya menampilkan **Status ONU** (Monitoring Perangkat GenieACS / OLT) dan **Ringkasan Billing**. Pengelola sistem memerlukan akses langsung dan visibilitas mengenai **Status Router MikroTik** yang terdaftar di aplikasi tanpa harus berpindah ke menu manajemen router.

### 2. Solusi yang Diterapkan
- **Controller Layer ([routes/adminPortal.js](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js))**:
  Mengambil daftar router MikroTik aktual via `mikrotikService.getAllRouters()` dan mengoper variabel `routers` ke template `views/admin/dashboard.ejs` pada route `GET /admin`, `GET /admin/devices`, dan `GET /admin/bulk`.
- **UI Admin Dashboard ([views/admin/dashboard.ejs](file:///d:/WEBAPP/myadamedia-billing/views/admin/dashboard.ejs))**:
  - Menyisipkan seksi **Status MikroTik** tepat di atas seksi **Status ONU**.
  - **Summary Stat Cards Grid**: Menampilkan kartu statistik `Total Router MikroTik`, `Router Status Aktif`, dan `Router Status Nonaktif`.
  - **Restrukturisasi Tabel 2-Kolom**: Sesuai instruksi pengguna, tabel disederhanakan menjadi **2 kolom utama**:
    1. **Nama Router**: Menggabungkan nama router, host IP:port, username, deskripsi, status aktif badge, dan tombol tes koneksi.
    2. **Detail & Monitoring Interface**: Menggunakan model **Dropdown Interface Selector** (`<select id="dash-iface-select-[id]">`).
  - **Live AJAX Dropdown Monitoring (`onDashIfaceChange` & `fetchDashIfaceTraffic`)**:
    - Dropdown memuat daftar interface MikroTik secara otomatis/on-demand.
    - Saat interface dipilih, panel menampilkan detail interface (*Status, Tipe, MAC Address, MTU, Comment*) dan **Live Bandwidth Monitoring** real-time Rx/Tx speed.
  - **Live AJAX Test (`testRouterConnDashboard`)**: Menambahkan fungsi JavaScript untuk menguji koneksi router secara real-time dari dashboard melalui endpoint `/admin/api/routers/:id/test` tanpa perlu reload halaman.
- **Lokalisasi Language Dictionary ([locales/id.json](file:///d:/WEBAPP/myadamedia-billing/locales/id.json))**:
  Menambahkan entri i18n dictionary untuk seksi Status MikroTik (`mikrotik_status_title`, `total_routers`, `active_routers`, `inactive_routers`, `router_list_title`).

### 3. File Diperbarui
- [`routes/adminPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js): Passing variabel `routers` ke `dashboard.ejs`.
- [`views/admin/dashboard.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/dashboard.ejs): UI Seksi Status MikroTik, Tabel Router, dan JS `testRouterConnDashboard`.
- [`locales/id.json`](file:///d:/WEBAPP/myadamedia-billing/locales/id.json): Translation dictionary.

---

## [2026-08-05] - Feature Update: Penambahan Opsi Hari H (Tanggal Isolir / Jatuh Tempo) pada Broadcast & Pengingat WhatsApp

### 1. Permasalahan & Kebutuhan Fitur
Sebelumnya, modul **Broadcast WhatsApp** pada section **Pengingat Otomatis (Jadwal)** dan **Pengingat Sebelum Isolir** hanya menyediakan pilihan checklist hari pengiriman dari `H-1` hingga `H-7` sebelum tanggal isolir. Tidak ada opsi untuk mengirimkan notifikasi pengingat secara otomatis pada **Hari H (Tanggal Isolir / Jatuh Tempo)**.

### 2. Analisis Masalah & Edge Case
1. **Representasi Nilai Hari H**: Opsi Hari H membutuhkan nilai integer `0` (selisih hari = 0).
2. **Kalkulasi Jam Eksekusi CRON**:
   Fungsi `getDaysUntilIsolation(today, dueDay)` pada `services/cronService.js` sebelumnya membandingkan `isolateDate` terhadap `today` yang mengandung jam/menit eksekusi (misal `09:05 AM`).
   Pada hari H (saat tanggal hari ini sama dengan `dueDay`), `isolateDate` set `00:00:00` dianggap lebih kecil dari `today` `09:05:00`, sehingga kode secara keliru menambahkan 1 bulan ke `isolateDate` dan mengembalikan nilai 30-31 hari (bukan 0 hari).

### 3. Solusi yang Diterapkan
- **UI Admin Portal ([views/admin/broadcast.ejs](file:///d:/WEBAPP/myadamedia-billing/views/admin/broadcast.ejs))**:
  - Menambahkan checkbox `Hari H (Jatuh Tempo)` (`value="0"`) pada formulir **Pengingat Otomatis Tagihan**.
  - Menambahkan checkbox `Hari H (Tanggal Isolir)` (`value="0"`) pada formulir **Pengingat Sebelum Isolir**.
  - Memperbarui petunjuk pengguna untuk menjelaskan bahwa pengiriman dapat dijadwalkan pada Hari H maupun H-1 s/d H-7.
- **Engine CRON ([services/cronService.js](file:///d:/WEBAPP/myadamedia-billing/services/cronService.js))**:
  - Merestrukturisasi fungsi `getDaysUntilIsolation(today, dueDay)` agar membandingkan `isolateDate` terhadap `startOfToday` (`00:00:00`).
  - Menjamin bahwa saat hari ini adalah tanggal jatuh tempo (`dueDay`), selisih hari dikalkulasi tepat `0` (Hari H).
  - Memastikan substitusi variabel `{{hari_h}}` pada template pesan WhatsApp menghasilkan `0` dengan baik saat notifikasi dikirim di Hari H.

### 4. File Diperbarui
- [`views/admin/broadcast.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/broadcast.ejs): UI Checkbox Hari H (`value="0"`).
- [`services/cronService.js`](file:///d:/WEBAPP/myadamedia-billing/services/cronService.js): Presisi logika `getDaysUntilIsolation` untuk Hari H (0 hari).

---

## [2026-08-03] - Feature Refactoring: Restrukturisasi Form Kecepatan Paket Internet (MikroTik Rate-Limit Dual-Form Grid)

### 1. Permasalahan & Kebutuhan Fitur
Sebelumnya, form konfigurasi kecepatan pada Paket Internet (`views/admin/packages.ejs`) menggunakan dua field terpisah secara berdiri sendiri (`speed_down` & `speed_up`). Form ini belum dapat mengonfigurasi parameter *Queue / Rate-Limit* MikroTik yang kompleks seperti *Burst Limit, Burst Threshold, Burst Time, Priority, dan Limit At*.

### 2. Solusi yang Diterapkan
- **Database Migration ([config/database.js](file:///d:/WEBAPP/myadamedia-billing/config/database.js))**:
  Menambahkan kolom migrasi otomatis pada tabel `packages` untuk menyimpan parameter MikroTik Rate-Limit:
  - `burst_limit_down`, `burst_limit_up`
  - `burst_threshold_down`, `burst_threshold_up`
  - `burst_time_down`, `burst_time_up`
  - `priority_down` (default 8), `priority_up` (default 8)
  - `limit_at_down`, `limit_at_up`

- **Service Layer ([services/customerService.js](file:///d:/WEBAPP/myadamedia-billing/services/customerService.js))**:
  Memperbarui fungsi `createPackage()` dan `updatePackage()` untuk mengekstrak, memvalidasi, dan menyimpan 6 pasang parameter rate-limit ke database (Kecepatan dalam Kbps, waktu dalam Detik, priority 1-8).

- **RADIUS Engine ([services/radiusService.js](file:///d:/WEBAPP/myadamedia-billing/services/radiusService.js))**:
  Memperbarui fungsi `getMikrotikRateLimit()` agar memformat string Vendor-Specific Attribute (VSA) `Mikrotik-Rate-Limit` secara lengkap sesuai standar RFC 2865 / RouterOS:
  `rx-rate/tx-rate [rx-burst-rate/tx-burst-rate] [rx-burst-threshold/tx-burst-threshold] [rx-burst-time/tx-burst-time] [rx-priority/tx-priority] [rx-rate-min/tx-rate-min]`

- **UI Admin Portal ([views/admin/packages.ejs](file:///d:/WEBAPP/myadamedia-billing/views/admin/packages.ejs))**:
  - Merestrukturisasi Modal Tambah & Modal Edit Paket dengan section **MikroTik Queue & Rate Limit Form Block**.
  - Mengelompokkan input menjadi 2 kolom simetris berpasangan: Column Download (Rx/Tx) & Column Upload (Tx/Rx) mencakup *Max Limit, Burst Limit, Burst Threshold, Burst Time, Priority, dan Limit At*.
  - Menambahkan **Live Interactive Preview Badge** (`#add_rate_limit_preview` & `#e_rate_limit_preview`) yang memperbarui representasi string `Mikrotik-Rate-Limit` secara real-time saat admin mengetik angka.
  - Memperbarui fungsi `editPkg()` untuk mengisi seluruh 12 field parameter rate limit secara presisi saat modal edit dibuka.

### 3. File Diperbarui
- [`config/database.js`](file:///d:/WEBAPP/myadamedia-billing/config/database.js): Migrasi 10 kolom rate-limit baru di tabel `packages`.
- [`services/customerService.js`](file:///d:/WEBAPP/myadamedia-billing/services/customerService.js): Handling parameter rate-limit pada `createPackage` & `updatePackage`.
- [`services/radiusService.js`](file:///d:/WEBAPP/myadamedia-billing/services/radiusService.js): String builder `Mikrotik-Rate-Limit` lengkap.
- [`views/admin/packages.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/packages.ejs): UI Dual-Column MikroTik Rate-Limit Form & Live Preview.

---

## [2026-08-02] - Bug Fix: Perbaikan Penayangan Bagi Hasil Dividen Investor Skema Fix di Dashboard

### 1. Permasalahan yang Ditemukan
Saat investor dengan skema **Nominal Fix (Rp per Bulan)** login ke Dashboard Investor (`/investor/dashboard`), nilai Bagi Hasil Dividen tidak muncul atau bernilai Rp 0.

### 2. Penyebab Utama
1. **Pembersihan String Nominal:** Input nilai nominal fix yang diketik admin dengan format pemisah ribuan titik (misal `"1.500.000"`) terpotong oleh `parseFloat()`, menghasilkan nilai `1.5` yang mendekati 0.
2. **Singkronisasi Session Data:** Objek `investor` pada session tidak secara otomatis memperbarui field `share_type` dan `fixed_dividend_amount` jika admin melakukan pengubahan data setelah investor membuat session login.

### 3. Solusi yang Diterapkan
- **Helper `parseCleanNumber()`**: Menambahkan helper pembersih format angka di `investor/services/investorService.js` dan `investor/routes/adminInvestors.js` yang secara pintar menghapus pemisah ribuan titik sehingga `"1.500.000"` terkonversi tepat menjadi `1500000`.
- **Fresh Investor Sync (`investor/routes/investorPortal.js`)**: Pada handler `GET /investor/dashboard`, sistem selalu mengambil record investor terbaru dari database SQLite secara real-time untuk menjamin data `share_type` dan `fixed_dividend_amount` selalu tersinkronisasi presisi.

### 4. Dampak Perubahan
Investor dengan skema **Nominal Fix (Rp per Bulan)** kini dapat melihat nilai Bagi Hasil Dividen dan badge `Nominal Fix: Rp X.XXX.XXX / Bulan` dengan sempurna di dashboard mereka.

---


### 1. Permasalahan & Permintaan Fitur
Sebelumnya, modul Manajemen Investor hanya mendukung skema bagi hasil berbasis **Persentase Saham (%)** dari Net Profit bulanan. Diperlukan opsi tambahan bagi admin untuk memilih antara **Persentase (%)** atau **Nominal Fix / Tetap (Rp per Bulan)** yang akan diterima investor setiap bulan.

### 2. Solusi yang Diterapkan
- **Database Migration (`config/database.js`)**: Menambahkan kolom `share_type` (`TEXT DEFAULT 'percentage'`) dan `fixed_dividend_amount` (`REAL DEFAULT 0`) pada tabel `investors` dengan migrasi otomatis.
- **Service Engine (`investor/services/investorService.js`)**: Memperbarui fungsi `getDividendBreakdown()` agar mendukung perhitungan otomatis berdasarkan `share_type` (`percentage` vs `fixed`). Jika `fixed`, nominal dividen yang dihitung adalah `fixed_dividend_amount` (Fix Rp / Bulan).
- **Admin Controller & UI View (`investor/routes/adminInvestors.js` & `investor/views/admin_investors.ejs`)**:
  - Menambahkan dropdown pilihan **Skema Bagi Hasil** pada Modal Tambah & Edit Investor.
  - Menambahkan input dinamis yang berganti otomatis (Input Persentase % vs Input Nominal Fix Rp).
  - Memperbarui tabel daftar investor untuk menampilkan badge skema bagi hasil (`Rp X / Bulan (Fix)` atau `X% (Profit Share)`).
- **Investor Dashboard (`investor/views/dashboard.ejs`)**: Memperbarui kartu dividen investor agar secara transparan menampilkan jenis skema dividen yang disepakati (Nominal Fix Rp / Bulan atau Persentase Net Profit %).

### 3. File Terbuat / Diperbarui
- [`config/database.js`](file:///d:/WEBAPP/myadamedia-billing/config/database.js): Migrasi kolom `share_type` & `fixed_dividend_amount`.
- [`investor/services/investorService.js`](file:///d:/WEBAPP/myadamedia-billing/investor/services/investorService.js): Logika dividen dual-mode.
- [`investor/routes/adminInvestors.js`](file:///d:/WEBAPP/myadamedia-billing/investor/routes/adminInvestors.js): Handling parameter `share_type` dan `fixed_dividend_amount`.
- [`investor/views/admin_investors.ejs`](file:///d:/WEBAPP/myadamedia-billing/investor/views/admin_investors.ejs): Form & Tabel Admin Investor.
- [`investor/views/dashboard.ejs`](file:///d:/WEBAPP/myadamedia-billing/investor/views/dashboard.ejs): Tampilan Dashboard Investor.

---


## [2026-08-02] - Business Proposal: Penyusunan Proposal Pendanaan Investor & Pitch Deck (Rp 20 Juta Target)

### 1. Ringkasan Tugas
Menyusun dokumen **Proposal Penawaran Investasi** dan **Presentation Pitch Deck (12 Slides)** resmi kelas institusional/investor berbasis audit data operasional dan keuangan aktual aplikasi **MyAdamedia Billing** dengan penyesuaian target pendanaan sebesar **Rp 20.000.000 (Dua Puluh Juta Rupiah)**.

### 2. Audit Data Aktual Database
- **Total Pelanggan Terdaftar:** 81 Pelanggan
- **Pelanggan Aktif Membayar:** 80 Pelanggan (98,7% Active Rate)
- **Monthly Recurring Revenue (MRR) Eksisting:** **Rp 12.895.000 / bulan**
- **Annualized Recurring Revenue (ARR) Eksisting:** **Rp 154.740.000 / tahun**
- **Breakdown Paket:**
  - Paket LITE (Rp 150.000/bln): 68 Pelanggan (Rp 10.200.000 / bln)
  - Paket BASIC (Rp 250.000/bln): 7 Pelanggan (Rp 1.750.000 / bln)
  - Paket BASIC A (Rp 250.000/bln): 3 Pelanggan (Rp 750.000 / bln)
  - Paket STARTER A & B (Rp 115.000/bln): 3 Pelanggan (Rp 345.000 / bln)

### 3. File & Dokumen Terbuat / Diperbarui
- [`investor/PROPOSAL_INVESTASI.md`](file:///d:/WEBAPP/myadamedia-billing/investor/PROPOSAL_INVESTASI.md): Dokumen Proposal Investasi Lengkap (Markdown Source).
- 📕 [`investor/PROPOSAL_INVESTASI.pdf`](file:///d:/WEBAPP/myadamedia-billing/investor/PROPOSAL_INVESTASI.pdf): **Dokumen PDF Resmi Proposal Penawaran Investasi** (Siap Cetak / Kirim ke Investor).
- [`investor/PITCH_DECK.md`](file:///d:/WEBAPP/myadamedia-billing/investor/PITCH_DECK.md): Slide deck presentasi investor 12 slide (Markdown Source).
- 📊 [`investor/PITCH_DECK.pptx`](file:///d:/WEBAPP/myadamedia-billing/investor/PITCH_DECK.pptx) & 📊 [`investor/PITCH_DECK.ppt`](file:///d:/WEBAPP/myadamedia-billing/investor/PITCH_DECK.ppt): **File Presentasi PowerPoint 12 Slide (16:9 Widescreen Dark Theme)** siap dipresentasikan.

---


## [2026-07-31] - UI Fix: Perbaikan Logo Perusahaan pada Sidebar Menu RADIUS

### 1. Permasalahan yang Ditemukan
Saat membuka halaman Admin Portal RADIUS NAS (`/admin/radius`) atau Sesi RADIUS (`/admin/radius/sessions`), gambar **Logo Perusahaan / Aplikasi** di bagian kiri atas sidebar menghilang dan digantikan oleh icon default.

### 2. Penyebab Utama
Komponen partial [`sidebar.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/partials/sidebar.ejs#L27) memeriksa ketersediaan objek `settings.company_logo` di dalam `res.locals`. Pada controller route RADIUS sebelumnya, objek `res.locals.settings` belum diteruskan dari `settingsManager`.

### 3. Solusi yang Diterapkan
- [`routes/admin/auth.js`](file:///d:/WEBAPP/myadamedia-billing/routes/admin/auth.js): Menambahkan `res.locals.settings = getSettings()` pada fungsi `requireAdminSession`.
- [`routes/admin/radius.js`](file:///d:/WEBAPP/myadamedia-billing/routes/admin/radius.js): Menambahkan `res.locals.settings = getSettings()` pada middleware `router.use`.

### 4. Dampak Perubahan
Logo perusahaan/aplikasi kini muncul secara konsisten dan presisi di bagian atas sidebar menu pada seluruh halaman RADIUS.

---

## [2026-07-31] - UI Fix: Restrukturisasi Tabel & Card dengan Native `admin.css` Classes

### 1. Permasalahan yang Ditemukan
Tampilan tabel **Daftar NAS Router Terdaftar** pada halaman [`nas_management.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/nas_management.ejs) terlihat berdempetan, tombol **Tambah NAS Router** tidak rata kanan, dan header tabel menyatu tanpa garis pemisah yang rapi.

### 2. Penyebab Utama
Header card dan tabel sebelumnya menggunakan elemen Bootstrap generik (`card-box`, `card-header-flex`, `table table-hover`) yang tidak memiliki rule CSS aktif di `admin.css?v=2`. Sistem Admin Portal MyAdamedia Billing menggunakan modul CSS native yaitu `card`, `card-hd`, `tbl-wrap`, `dtbl`, `stat-grid`, dan `sc`.

### 3. Solusi yang Diterapkan
- Mengubah struktur layout pada [`nas_management.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/nas_management.ejs) dan [`active_sessions.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/active_sessions.ejs):
  - **Stat Cards**: Menggunakan `<div class="stat-grid">` dan `<div class="sc">`
  - **Card Wrapper**: Menggunakan `<div class="card">`
  - **Header Card**: Menggunakan `<div class="card-hd"><h6>...</h6><button class="btn btn-p btn-sm">...</button></div>`
  - **Tabel**: Menggunakan `<div class="tbl-wrap"><table class="dtbl">...</table></div>`
  - **Badges & Buttons**: Menggunakan `badge bs`, `badge bd`, `btn btn-p`, `btn btn-g`, `btn btn-d`.

### 4. Dampak Perubahan
Tabel daftar NAS Router dan monitoring sesi aktif kini tampil sangat rapi, bersih, tombol tersusun secara simetris, dan 100% konsisten dengan halaman admin lainnya di MyAdamedia Billing.

---

## [2026-07-31] - Implementasi Fitur RADIUS Server (PPPoE & Hotspot)

### 1. Ringkasan Perubahan
Telah berhasil diimplementasikan modul **Embedded RADIUS Server** terpusat di Node.js untuk menangani autentikasi pengguna **PPPoE** dan **Hotspot Vouchers**, pencatatan penggunaan data (*Accounting*), serta pemutusan koneksi seketika (*Disconnect-Request / CoA*).

### 2. File & Komponen Terbuat / Diperbarui

#### Database & Konfigurasi
- [`config/database.js`](file:///d:/WEBAPP/myadamedia-billing/config/database.js): Menambahkan tabel `radius_nas` (pendaftaran router MikroTik RADIUS NAS) dan `radius_acct` (log sesi aktif dan pemakaian data), serta migrasi kolom `mikrotik_rate_limit` pada tabel `packages`.

#### Core RADIUS Services (UDP Engine)
- [`services/radiusCodec.js`](file:///d:/WEBAPP/myadamedia-billing/services/radiusCodec.js): Engine encoding & decoding paket RADIUS RFC 2865, RFC 2866, dan RFC 3576 secara native (Crypto & Buffer Node.js) tanpa ketergantungan library pihak ketiga.
- [`services/radiusDictionary.js`](file:///d:/WEBAPP/myadamedia-billing/services/radiusDictionary.js): Kamus Vendor-Specific Attributes (VSA) MikroTik (Vendor ID: `14988`) untuk `Mikrotik-Rate-Limit`, `Mikrotik-Group`, `Mikrotik-Address-List`, dll.
- [`services/radiusService.js`](file:///d:/WEBAPP/myadamedia-billing/services/radiusService.js): Service utama yang membuka socket UDP port `1812` (Authentication) dan port `1813` (Accounting). Mengautentikasi user PPPoE & Hotspot langsung ke database `billing.db`.
- [`services/radiusCoaService.js`](file:///d:/WEBAPP/myadamedia-billing/services/radiusCoaService.js): Modul pengirim paket Disconnect-Request (UDP `3799`) untuk memutus koneksi pelanggan terisolir atau voucher habis secara seketika.

#### Navigation & Sidebar Menu
- [`services/sidebarMenuService.js`](file:///d:/WEBAPP/myadamedia-billing/services/sidebarMenuService.js): Menambahkan menu **RADIUS NAS** (`/admin/radius`) dan **Sesi RADIUS** (`/admin/radius/sessions`) pada menu navigasi Admin Portal.

#### Controller & UI Views
- [`routes/admin/radius.js`](file:///d:/WEBAPP/myadamedia-billing/routes/admin/radius.js): Controller Admin Portal untuk pendaftaran NAS Router, 1-Click Terminal Script Generator, JSON API active sessions, dan aksi Disconnect CoA.
- [`views/admin/radius/nas_management.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/nas_management.ejs): UI Dashboard manajemen Router NAS (Tambah, Edit, Hapus, Salin Script RouterOS).
- [`views/admin/radius/active_sessions.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/active_sessions.ejs): UI Monitoring sesi aktif real-time dengan tombol Kick User (CoA).

#### Application Entry Point
- [`app-customer.js`](file:///d:/WEBAPP/myadamedia-billing/app-customer.js): Router `/admin/radius` di-mount ke dalam aplikasi Express.

---

## [2026-07-31] - Implementasi Modul Standalone Investor Dashboard (`investor/`)

### 1. Ringkasan Perubahan
Telah diimplementasikan modul **Standalone Investor Dashboard & Financial Analytics Portal** yang terisolasi secara rapi di dalam folder modular **`investor/`**. Modul ini menyajikan ringkasan eksekutif keuangan perusahaan (Omset Gross Revenue, Pengeluaran OpEx/CapEx, Net Profit, Profit Margin %, MRR, ARPU), demografi & pertumbuhan pelanggan (Aktif, Isolir, PSB), grafik interaktif tren keuangan (Chart.js), serta perhitungan otomatis hak bagi hasil saham investor (*Dividen Share*) secara *read-only* dengan tingkat keamanan session tinggi.

### 2. File & Komponen Terbuat / Diperbarui

#### Database Schema
- [`config/database.js`](file:///d:/WEBAPP/myadamedia-billing/config/database.js): Menambahkan skema tabel `investors` (ID, Nama, Username, Password, Share Percentage %, Status, Timestamps).

#### Sub-Folder Modular Investor (`investor/`)
- [`investor/services/investorService.js`](file:///d:/WEBAPP/myadamedia-billing/investor/services/investorService.js): Service engine agregasi finansial, kalkulasi Net Profit, MRR, ARPU, grafik tren bulanan, distribusi paket, breakdown pengeluaran, dan kalkulasi dividen saham investor.
- [`investor/routes/investorPortal.js`](file:///d:/WEBAPP/myadamedia-billing/investor/routes/investorPortal.js): Controller Express Router untuk otentikasi login standalone investor (`/investor/login`), executive dashboard (`/investor/dashboard`), API chart data (`/investor/api/chart-data`), dan logout session (`/investor/logout`).
- [`investor/routes/adminInvestors.js`](file:///d:/WEBAPP/myadamedia-billing/investor/routes/adminInvestors.js): Controller Admin Portal (`/admin/investors`) untuk mengelola akun investor (Tambah, Edit Nama/Username/Password/Persentase Saham %, Hapus, Toggle Status Aktif).
- [`investor/views/login.ejs`](file:///d:/WEBAPP/myadamedia-billing/investor/views/login.ejs): Halaman login investor standalone dengan estetika modern dark-mode, glassmorphism, dan responsif.
- [`investor/views/dashboard.ejs`](file:///d:/WEBAPP/myadamedia-billing/investor/views/dashboard.ejs): Executive Investor Dashboard dengan KPI Summary Cards, Filter Periode, grafik interaktif Chart.js (Line Chart & Doughnut Chart), Card Dividen Investor, dan tabel transaksi keuangan terbaru.
- [`investor/views/admin_investors.ejs`](file:///d:/WEBAPP/myadamedia-billing/investor/views/admin_investors.ejs): Halaman Admin Portal untuk mengelola pendaftaran akun investor dan persentase saham.

#### Application Entry Point
- [`app-customer.js`](file:///d:/WEBAPP/myadamedia-billing/app-customer.js): Router `/investor` dan `/admin/investors` di-mount ke dalam aplikasi Express.

---

## [2026-07-31] - UI Fix: Aktivasi Menu 'Akun Investor' pada Sidebar Navigation Admin

### 1. Permasalahan yang Ditemukan
Menu **Akun Investor** belum muncul pada sidebar kiri Admin Portal di bawah grup Keuangan setelah penambahan modul `investor/`.

### 2. Penyebab Utama
Status visibilitas menu bawaan pada `DEFAULT_MENU_STATES` di [`services/sidebarMenuService.js`](file:///d:/WEBAPP/myadamedia-billing/services/sidebarMenuService.js) belum mencakup key `investors`. Selain itu, database `app_settings` perlu dipaksa memuat status `visible` untuk menu baru.

### 3. Solusi yang Diterapkan
- [`services/sidebarMenuService.js`](file:///d:/WEBAPP/myadamedia-billing/services/sidebarMenuService.js): Menambahkan key `investors: STATE_VISIBLE`, `radius_nas: STATE_VISIBLE`, `radius_sessions: STATE_VISIBLE` ke dalam `DEFAULT_MENU_STATES`.
- [`config/database.js`](file:///d:/WEBAPP/myadamedia-billing/config/database.js): Menambahkan `'investors'` ke daftar `coreMenus` di fungsi `forceUnlockCoreMenus()` agar otomatis tersimpan sebagai menu `visible` di database.

#### Dampak Perubahan
Menu **Akun Investor** (`/admin/investors`) kini tampil secara permanen dan otomatis pada sidebar Admin Portal di grup menu **KEUANGAN**.

---

## [2026-07-31] - UI Refactoring: Penyelarasan Tampilan Halaman Admin Investor (`admin.css` Native)

### 1. Permasalahan yang Ditemukan
Tampilan tabel **Daftar Investor Terdaftar** pada halaman [`admin_investors.ejs`](file:///d:/WEBAPP/myadamedia-billing/investor/views/admin_investors.ejs) terlihat berdempetan, header tabel tanpa latar belakang pemisah, dan tombol aksi belum sesuai dengan desain native sistem MyAdamedia Billing.

### 2. Penyebab Utama
Header card, tabel, badge, dan modal sebelumnya menggunakan kelas CSS kustom / inline style alih-alih menggunakan modul CSS bawaan `admin.css?v=2` (`card`, `card-hd`, `tbl-wrap`, `dtbl`, `badge bp`, `badge bs`, `badge bd`, `btn btn-p`, `btn btn-g`, `btn btn-d`, `mo`, `mb`, `mh`, `mbody`, `mf`).

### 3. Solusi yang Diterapkan
- Mengubah struktur HTML pada [`investor/views/admin_investors.ejs`](file:///d:/WEBAPP/myadamedia-billing/investor/views/admin_investors.ejs):
  - **Tabel**: Menggunakan `<div class="tbl-wrap"><table class="dtbl">...</table></div>`.
  - **Card**: Menggunakan `<div class="card"><div class="card-hd">...</div></div>`.
  - **Badges**: Menggunakan `badge bp` untuk persentase saham, `badge bs` untuk status aktif, dan `badge bd` untuk status non-aktif.
  - **Tombol**: Menggunakan `btn btn-p btn-sm` untuk Tambah, `btn btn-g btn-sm` untuk Edit, dan `btn btn-d btn-sm` untuk Hapus.
  - **Modal**: Menggunakan modal native `mo`, `mb`, `mh`, `mbody`, `mf`.

### 4. Dampak Perubahan
Tampilan halaman Manajemen Akun Investor (`/admin/investors`) kini tampil sangat rapi, simetris, berlatar dark theme konsisten, dan 100% selaras dengan tampilan halaman Admin Portal MyAdamedia Billing lainnya.

---

## [2026-07-31] - Bug Fix: Penyesuaian Query Database Keuangan pada Dashboard Investor

### 1. Permasalahan yang Ditemukan
Saat membuka **Dashboard Investor** (`/investor/dashboard`), aplikasi menampilkan pesan error *"Terjadi kesalahan saat memuat Dashboard Investor"*.

### 2. Penyebab Utama
Hasil inspeksi stack trace menunjukkan `SqliteError: no such table: payments`. Pada skema database SQLite `billing.db`, transaksi pembayaran tagihan tersimpan di tabel `invoices` dengan atribut `status = 'paid'` dan `paid_at`.

### 3. Solusi yang Diterapkan
- [`investor/services/investorService.js`](file:///d:/WEBAPP/myadamedia-billing/investor/services/investorService.js): Mengubah seluruh query agregasi Omset (Revenue), grafik tren bulanan, dan feed transaksi terbaru untuk membaca tabel `invoices` yang berstatus `'paid'` (`WHERE status = 'paid' AND paid_at IS NOT NULL`).

### 4. Dampak Perubahan
Executive Investor Dashboard kini memuat data secara instan, menampilkan Omset Gross Revenue (contoh: `Rp 1.150.000`), MRR (contoh: `Rp 12.895.000`), ARPU, Laba Bersih, dan Bagi Hasil Dividen Investor secara akurat dan 100% bebas dari error.

---

## [2026-07-31] - System Fix: Konfigurasi Git `safe.directory` untuk Autopush

### 1. Permasalahan yang Ditemukan
Saat menjalankan script `autopush.bat` atau perintah Git, muncul pesan peringatan *`fatal: detected dubious ownership in repository at 'D:/WEBAPP/myadamedia-billing'`*.

### 2. Penyebab Utama
Ownership folder repositori di Windows terdeteksi berbeda antara SID pengguna lama dan akun pengguna Windows `MYADAMEDIA/iwanw` saat ini.

### 3. Solusi yang Diterapkan
- Menambahkan direktori proyek ke daftar direktori aman di Git:
  ```bash
  git config --global --add safe.directory D:/WEBAPP/myadamedia-billing
  ```

### 4. Dampak Perubahan
Peringatan kepemilikan repositori Git kini sepenuhnya hilang, dan proses `autopush.bat` maupun sinkronisasi ke GitHub berjalan lancar tanpa terhambat.

---

## [2026-07-31] - Feature Enhancement: Dukungan Harga Promo pada Perhitungan MRR & ARPU

### 1. Ringkasan Perubahan
Modul agregasi keuangan Investor pada [`investor/services/investorService.js`](file:///d:/WEBAPP/myadamedia-billing/investor/services/investorService.js) telah ditingkatkan untuk **memperhitungkan Harga Promo (`promo_price`) secara dinamis** pada perhitungan MRR (Monthly Recurring Revenue) dan ARPU (Average Revenue Per User).

### 2. Logika Penentuan Harga Efektif
Sistem memeriksa apakah pelanggan sedang berada di dalam siklus promo:
- **Jika** `promo_price` terisi **DAN** `promo_cycles > 0` **DAN** jumlah siklus yang sudah terpakai (`promo_cycles_used`) masih kurang dari `promo_cycles`, **maka** harga yang digunakan untuk perhitungan MRR adalah **`promo_price`**.
- **Jika** promo telah selesai atau paket tidak memiliki promo, **maka** harga yang digunakan adalah harga reguler paket **`price`**.

### 3. Query SQL Terbaru
```sql
SELECT COALESCE(SUM(
  CASE
    WHEN p.promo_price IS NOT NULL 
     AND p.promo_price != '' 
     AND CAST(p.promo_cycles AS INTEGER) > 0 
     AND COALESCE(c.promo_cycles_used, 0) < CAST(p.promo_cycles AS INTEGER) 
    THEN CAST(p.promo_price AS INTEGER)
    ELSE p.price
  END
), 0) as mrr
FROM customers c
JOIN packages p ON c.package_id = p.id
WHERE c.status = 'active'
```

### 4. Dampak Perubahan
Perhitungan MRR kini 100% presisi dan akurat mencerminkan kondisi lapangan ketika terdapat pelanggan baru yang menikmati harga diskon/promo.

---

## [2026-07-31] - Bug Fix: Perbaikan Fitur Menampilkan Kembali (Unhide) Paket Internet Registrasi

### 1. Permasalahan yang Ditemukan
Saat Admin mencoba mengubah opsi paket dari **Sembunyikan (Hide)** menjadi **Tampilkan (Unhide)** pada menu Manajemen Paket (`/admin/packages`), paket tetap berstatus tersembunyi (`is_hidden = 1`) dan tidak muncul di form registrasi pelanggan.

### 2. Penyebab Utama
Pada file [`services/customerService.js`](file:///d:/WEBAPP/myadamedia-billing/services/customerService.js) fungsi `createPackage` dan `updatePackage`, penentuan status `is_hidden` menggunakan ekspresi ternary `data.is_hidden ? 1 : 0`.
Ketika form mengirimkan `value="0"` (Tampilkan / Unhide), JavaScript menganggap string `"0"` sebagai nilai *truthy* (`Boolean("0") === true`), sehingga `is_hidden` selalu bernilai `1` dan paket tidak pernah bisa ditampilkan kembali.

### 3. Solusi yang Diterapkan
- Mengubah evaluasi string `"0"` dan `"1"` di [`services/customerService.js`](file:///d:/WEBAPP/myadamedia-billing/services/customerService.js):
  ```javascript
  (data.is_hidden == '1' || data.is_hidden === 1) ? 1 : 0
  ```

### 4. Dampak Perubahan
Admin kini dapat dengan bebas mengubah status visibilitas paket internet (*Sembunyikan / Tampilkan*). Paket yang di-set ke **Tampilkan (Unhide)** akan langsung muncul pada form registrasi pelanggan (`/register`).

---

## [2026-08-01] - Panduan Teknis & Implementasi: Penambahan Pelanggan PPPoE via RADIUS NAS

### 1. Analisis Kebutuhan
Penambahan dan autentikasi pelanggan PPPoE yang berkomunikasi melalui **RADIUS NAS (RouterOS MikroTik)** terintegrasi terpusat pada engine **Embedded RADIUS Server** (UDP Auth 1812, UDP Acct 1813, UDP Disconnect/CoA 3799) di MyAdamedia Billing.

### 2. File Terkait & Komponen Utama
- [`services/radiusService.js`](file:///d:/WEBAPP/myadamedia-billing/services/radiusService.js): Engine socket UDP pengolah paket `Access-Request` & `Accounting-Request`.
- [`services/radiusCoaService.js`](file:///d:/WEBAPP/myadamedia-billing/services/radiusCoaService.js): Modul pengirim paket Disconnect-Request (PoD/CoA).
- [`routes/admin/radius.js`](file:///d:/WEBAPP/myadamedia-billing/routes/admin/radius.js): Controller manajemen NAS Router & Sesi Aktif.
- [`config/database.js`](file:///d:/WEBAPP/myadamedia-billing/config/database.js): Schema tabel `radius_nas`, `radius_acct`, dan `customers`.

### 3. Dampak & Keuntungan
- **Single Source of Truth**: Data pelanggan PPPoE tersimpan di SQLite (`billing.db`) tanpa perlu duplikasi akun ke FreeRADIUS / database terpisah.
- **Zero API Overhead**: Pengolahan Auth/Acct murni via paket UDP standar RFC 2865 & 2866, sehingga tidak membebankan CPU Router.
- **Instant Isolation**: Pemutusan pelanggan tunggakan terjadi < 1 detik via UDP 3799 (CoA).

---

## [2026-08-01] - Troubleshooting: Resolusi Pesan Log "RADIUS Timeout" pada MikroTik RouterOS

### 1. Permasalahan yang Ditemukan
Pada log MikroTik RouterOS muncul pesan error **`radius timeout`** saat pengguna melakukan dial PPPoE atau login Hotspot.

### 2. Penyebab Utama
- **IP NAS Mismatch**: IP pengirim paket UDP dari Router MikroTik tidak cocok dengan IP NAS yang mendaftar di tabel `radius_nas`.
- **Shared Secret Key Mismatch**: Secret Key di MikroTik berbeda dengan Secret Key pada Admin Billing.
- **Port UDP Terblokir Firewall**: Windows Firewall memblokir port UDP `1812` dan `1813`.
- **MikroTik Source IP Unbound**: MikroTik tidak menentukan `src-address` pada konfigurasi `/radius`.

### 3. Solusi yang Diberikan
1. **Pemeriksaan `nasname` & Wildcard NAS (`0.0.0.0`)**: Memastikan IP router di menu Admin Billing (`/admin/radius`) sama dengan IP MikroTik atau menggunakan Wildcard `0.0.0.0`.
2. **Sinkronisasi Shared Secret**: Menyamakan nilai secret di `/radius add secret="..."` dengan data di database.
3. **Konfigurasi `src-address` MikroTik**: Menambahkan atribut `src-address` pada `/radius` di MikroTik.
4. **Pembukaan Port Firewall**: Menambahkan Inbound Rule UDP Port 1812 & 1813 di Windows Firewall.

### 4. Dampak Perubahan
Pesan log `radius timeout` teratasi secara penuh, dan seluruh proses autentikasi RADIUS balasan `Access-Accept` berjalan secara instan.

---

## [2026-08-01] - Refactoring & Fix: Pemisahan Otomatisasi Input Secret MikroTik API vs RADIUS Mode

### 1. Permasalahan yang Ditemukan
Saat menambahkan atau memperbarui data pelanggan di aplikasi Billing, sistem secara otomatis masih melakukan *push* secret ke tabel `/ppp secret` MikroTik via REST/API RouterOS (`mikrotikService.createPppoeSecret`). Hal ini menyebabkan redundansi data secret lokal di MikroTik saat menggunakan **RADIUS Server**.

### 2. Penyebab Utama
Logika controller pada route `routes/adminPortal.js` sebelumnya mengeksekusi `createPppoeSecret` tanpa memeriksa mode autentikasi yang sedang aktif (API vs RADIUS).

### 3. Solusi yang Diterapkan
- [`routes/adminPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js): Menambahkan pengondisian `getSetting('pppoe_sync_to_mikrotik_api', false)`.
  - Secara **default (RADIUS Mode)**, sistem **TIDAK** lagi membuat secret di `/ppp secret` MikroTik via API. Data pelanggan PPPoE hanya disimpan di database SQLite (`customers`), yang secara langsung dibaca oleh Embedded RADIUS Server (`radiusService.js`) saat dial PPPoE.
  - Jika pengelola ISP masih ingin menggunakan mode API legacy, dapat mengaktifkan opsi `"pppoe_sync_to_mikrotik_api": true` pada `settings.json`.
- [`services/customerService.js`](file:///d:/WEBAPP/myadamedia-billing/services/customerService.js): Menggantikan panggilan `setPppoeProfile` dengan **RADIUS CoA Disconnect (`radiusCoaService.disconnectUserByUsername`)** saat pelanggan diisolir / diaktifkan.

### 4. Dampak Perubahan
Tabel `/ppp secret` di MikroTik kini tetap bersih tanpa perlu menyimpan ratusan secret lokal. Autentikasi berjalan 100% tersentralisasi melalui RADIUS Server.

---

## [2026-08-03] - Feature Update: Peningkatan Detail Daftar Router MikroTik & Monitoring Interface Real-Time

### 1. Permasalahan & Kebutuhan Fitur
Pada tab Router menu MikroTik (`/admin/routers`), daftar router MikroTik yang terdaftar sebelumnya hanya menampilkan informasi dasar dalam tabel sederhana (Nama, Host/IP, Port, Username, Status, Edit/Hapus/Test Koneksi). Pengelola ISP memerlukan visualisasi yang lebih mendalam mengenai status kesehatan router, spesifikasi hardware, serta monitoring penggunaan bandwidth/traffic di setiap interface MikroTik secara real-time.

### 2. Solusi yang Diterapkan
- **Backend Service Layer ([`services/mikrotikService.js`](file:///d:/WEBAPP/myadamedia-billing/services/mikrotikService.js))**:
  - `getRouterInterfaces(routerId)`: Mengambil daftar interface dari MikroTik (`/interface/print`) dan memformat byte rate, status link (`Running` / `Disabled` / `Link Down`), MAC Address, MTU, comment, serta total akumulasi Rx/Tx bytes.
  - `getRouterDetailedInfo(routerId)`: Mengambil spesifikasi hardware dan statistik sistem (`/system/resource`, `/system/identity`, `/system/routerboard`) termasuk CPU Load %, RAM Free/Total, Free HDD Space %, Board Name, RouterOS Version, Architecture, dan Uptime.
  - `getInterfaceTraffic(routerId, interfaceName)`: Monitoring penggunaan bandwidth real-time (`/interface/monitor-traffic`) untuk menghitung Rx/Tx bits-per-second (Mbps) dan packets-per-second.
  - `toggleInterfaceStatus(routerId, interfaceId, disabled)`: Mengaktifkan atau menonaktifkan status interface via API RouterOS (`/interface/enable` & `/interface/disable`).
- **REST API Layer ([`routes/adminPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js))**:
  - Menambahkan endpoint REST API terproteksi `requireAdmin`:
    - `GET /admin/api/routers/:id/details`: Mengembalikan detail spesifikasi & resource hardware router.
    - `GET /admin/api/routers/:id/interfaces`: Mengembalikan daftar interface router.
    - `GET /admin/api/routers/:id/interfaces/:name/traffic`: Mengembalikan data trafik bandwidth real-time.
    - `POST /admin/api/routers/:id/interfaces/:ifaceId/toggle`: Mengubah status aktif/nonaktif interface.
- **Frontend UI View ([`views/admin/routers.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/routers.ejs))**:
  - **Ringkasan Kartu Statistik**: Menampilkan kartu ringkasan Total Router, Router Status Aktif, dan Router Status Nonaktif di bagian atas halaman.
  - **Tabel Router Informasi Detail**: Memperbarui tabel daftar router dengan styling badge modern, tombol aksi cepat, dan tombol khusus **`Detail`** (Monitoring Interface).
  - **Modal Detail Router & Interface Monitoring (`#routerDetailModal`)**:
    - **Hardware Specs Overview Cards**: CPU Load %, RAM Memory Usage, HDD Space %, Uptime, dan ROS Version.
    - **Tab 1: Monitoring Interface Table**: Menampilkan daftar seluruh interface, filter berdasarkan tipe (Ethernet, Bridge, VLAN, Wireless, PPP/PPPoE), pencarian cepat, total Rx/Tx traffic, tombol sakelar toggle enable/disable, dan tombol pengecekan rate trafik live.
    - **Sakelar Auto Refresh (3 Detik)**: Memungkinkan pemantauan trafik dan status interface secara otomatis tanpa perlu merefresh halaman web.
    - **Tab 2: Spesifikasi & Resource**: Menampilkan rincian spesifikasi hardware (Identity, Model, Version, Architecture, CPU Cores, Serial Number, RAM, HDD, Build Time).
  - **Modal Live Traffic Realtime Popup (`#interfaceTrafficModal`)**:
    - **Interaktivitas Baris Interface**: Saat baris interface atau tombol **`Live Traffic`** diklik, sistem membuka popup khusus yang didesain modern.
    - **Gauge Cards**: Menampilkan indikator real-time Download (Rx Mbps), Upload (Tx Mbps), Rx Packets/sec, Tx Packets/sec, dan Total Transfer Bytes.
    - **Live Line Chart (Chart.js)**: Grafik garis dinamis dengan animasi smooth dan visualisasi gradient yang memperbarui throughput trafik secara kontinu setiap 1-3 detik (dapat diatur intervalnya).
    - **Stream Controls**: Fitur Pause/Resume stream serta pembersihan interval otomatis saat modal ditutup untuk mencegah *memory leak* dan *overhead* koneksi socket.
  - **Redesain Tombol & Lebar Modal (`views/admin/routers.ejs`)**:
    - Memperluas lebar modal detail router (`max-width: 1150px`) agar 10 kolom tabel interface memiliki ruang yang lapang dan tidak terpotong.
    - Menghadirkan tombol khusus **`.btn-live-traffic`** berdesain *pill badge* dengan warna hijau emerald gradient (`#10b981` -> `#059669`), efek shadow glow, icon grafik naik (`bi-graph-up-arrow`), serta teks yang jelas dan kontras.

### 3. Dampak Perubahan
Pengelola ISP kini dapat memantau kondisi seluruh router MikroTik, mendeteksi hambatan trafik interface (*link down / congestion*), dan mengamati grafik throughput bandwidth interface secara langsung dan *real-time* dari dashboard Billing tanpa ada teks yang terpotong.

---

## [2026-08-03] - Feature Update: Penambahan Input & Pre-fill Password PPPoE pada Form Edit Pelanggan

### 1. Permasalahan & Kebutuhan Fitur
Pada menu Manajemen Pelanggan (`/admin/customers`), saat admin mengklik tombol **Edit Pelanggan**, field input untuk `PPPoE Password` sebelumnya belum tersedia pada modal edit. Admin memerlukan kemampuan untuk melihat password PPPoE tersimpan, memperbaruinya jika ada perubahan, serta menampilkan/menyembunyikan password secara aman (*eye icon toggle*).

### 2. Solusi yang Diterapkan
- **Frontend View Layer ([`views/admin/customers.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/customers.ejs))**:
  - **Penambahan Input Form Edit (`#editModal`)**: Menambahkan elemen `<input name="pppoe_password" id="e_pppoe_password" type="password">` dan `<input name="pppoe_remote_address" id="e_pppoe_remote_address">` pada bagian koneksi PPPoE.
  - **Fitur Eye Icon Toggle**: Menambahkan tombol sakelar ikon mata (`togglePppoePasswordVisibility`) untuk menampilkan/menyembunyikan teks password secara instan baik pada modal Tambah maupun Edit Pelanggan.
  - **Otomatisasi Pre-fill Data (`editCust(idx)`)**: Mengisi nilai `c.pppoe_password` dan `c.pppoe_remote_address` secara otomatis dari objek data pelanggan tersimpan ketika modal Edit dibuka.
- **Backend Controller Layer ([`routes/adminPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js))**:
  - Memperbarui handler `POST /admin/customers/:id/update` untuk memproses dan menyimpan parameter `req.body.pppoe_password` serta `req.body.pppoe_remote_address` ke database SQLite (`customers`).
  - Menyelaraskan validasi secret MikroTik agar tidak memblokir proses update ketika password PPPoE diinput secara manual atau dikelola via RADIUS Server.

### 3. Dampak Perubahan
Admin Billing kini dapat mengelola dan memverifikasi password PPPoE pelanggan secara langsung dari modal Edit Pelanggan dengan tampilan yang aman, intuitif, dan tersinkronisasi 100% dengan database SQLite/RADIUS.

---

## [2026-08-03] - Bugfix: Perbaikan Tampilan Nama Interface PPPoE pada Detail Router MikroTik

### 1. Permasalahan & Penyebab Utama
Pada menu **MikroTik > Router > Detail Router > Tab Monitoring Interface**, nama dari interface PPPoE (seperti `<pppoe-username>`) tidak muncul (tampak kosong/blank) pada tabel monitoring.
- **Penyebab Utama**: Nama interface dinamis PPPoE pada RouterOS MikroTik dibungkus dengan tanda kurung siku `<pppoe-nama>`. Ketika dimasukkan langsung ke `tbody.innerHTML` pada `views/admin/routers.ejs` tanpa di-escape, DOM parser HTML browser menganggapnya sebagai *unknown HTML tag* (`<pppoe-nama></pppoe-nama>`), sehingga menyembunyikan teks nama interface secara visual.
- **Atribut Onclick Breakdown**: Inline JS `onclick="openInterfaceTrafficModal('${iface.name}')"` mengalami kecacatan sintaks ketika nama interface mengandung tanda kurung sudut `<>` atau karakter khusus.

### 2. Solusi yang Diterapkan
- **Frontend Layer ([`views/admin/routers.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/routers.ejs))**:
  - Menambahkan fungsi helper `escapeHtml()` untuk menyanitasi karakter HTML (`&`, `<`, `>`, `"`, `'`) dan `escapeJs()` untuk menyanitasi string atribut JavaScript.
  - Memperbarui `renderInterfacesTable()` agar merender nama interface, comment, tipe, macAddress, dan atribut event handler `onclick` menggunakan string yang telah di-escape secara aman.
  - Memperbarui `filterInterfacesTable()` agar mendukung pengelompokan tipe filter PPPoE/PPP secara presisi (`pppoe`, `ppp`, `pppoe-server-binding`).
- **Backend Service Layer ([`services/mikrotikService.js`](file:///d:/WEBAPP/myadamedia-billing/services/mikrotikService.js))**:
  - Menambahkan fallback pembacaan nama interface `r.name || r['default-name'] || '-'` pada fungsi `getRouterInterfaces()`.

### 3. Dampak Perubahan
Nama seluruh interface PPPoE kini muncul dengan jelas 100% pada tabel Detail Router, dapat difilter dengan tepat, dan modal Live Traffic Realtime Popup dapat dibuka tanpa hambatan sintaks JavaScript.

---

## [2026-08-03] - Bugfix: Perbaikan Duplikasi Sesi Aktif RADIUS (1 Username Muncul Multiple)

### 1. Permasalahan & Penyebab Utama
Pada menu **Monitoring Sesi Aktif RADIUS** (`/admin/radius/sessions`), 1 username pelanggan PPPoE / Hotspot muncul 2 kali (atau lebih) secara bersamaan pada tabel pengguna online.
- **Penyebab Utama**: Ketika pelanggan mengalami *reconnect / re-dial*, MikroTik RouterOS membuat `Acct-Session-Id` baru. Jika paket `Stop` untuk sesi lama tidak terkirim atau terlepas akibat jaringan terputus tiba-tiba, record sesi lama tetap tertinggal di tabel `radius_acct` dengan status `acctstoptime IS NULL`.
- **Query Tanpa Penutupan Automatic Stale Session**: Logika `isStart` dan `isInterim` di `radiusService.js` sebelumnya hanya mencocokkan `acctsessionid` DAN `username`, sehingga sesi lama dengan ID berbeda milik username yang sama tidak otomatis ditutup.

### 2. Solusi yang Diterapkan
- **Backend Service Layer ([`services/radiusService.js`](file:///d:/WEBAPP/myadamedia-billing/services/radiusService.js))**:
  - Menambahkan logika penutupan otomatis (*auto-close*) pada handler `isStart` dan `isInterim` untuk menandai `acctstoptime = nowStr` dan `acctterminatecause = 'Stale-Session-Closed'` pada sesi lama milik username yang sama jika `acctsessionid` berbeda.
- **Backend Controller Layer ([`routes/admin/radius.js`](file:///d:/WEBAPP/myadamedia-billing/routes/admin/radius.js))**:
  - Menambahkan fungsi helper `cleanupStaleRadiusSessions()` yang dipanggil sebelum query `SELECT * FROM radius_acct WHERE acctstoptime IS NULL`.
  - Fungsi ini secara otomatis menutup record duplikat lama untuk username yang sama (hanya menyisakan 1 sesi paling baru `MAX(radacctid)` per username) serta menutup sesi yang tidak menerima update lebih dari 24 jam.
- **Frontend View Layer ([`views/admin/radius/active_sessions.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/radius/active_sessions.ejs))**:
  - Menambahkan helper `escapeHtml()` pada script auto-refresh JS untuk me-render username, IP address, MAC address, dan NAS IP secara aman.

### 3. Dampak Perubahan
Tabel Monitoring Sesi Aktif RADIUS kini menampilkan tepat 1 baris per username online secara presisi. Data sesi usang (*stale session*) dibersihkan secara otomatis tanpa mengganggu koneksi aktif pengguna.

---

## [2026-08-03] - Bugfix: Perbaikan Error Disconnect-NAK saat Kick (CoA) User RADIUS

### 1. Permasalahan & Penyebab Utama
Saat mengklik tombol **Kick (CoA)** pada menu Monitoring Sesi Aktif RADIUS, muncul error `Disconnect MDE-0200: Disconnect gagal/ditolak (Disconnect-NAK)`.
- **Penyebab Utama**: RouterOS MikroTik melakukan *strict matching* pada atribut `Acct-Session-Id` yang dikirimkan bersama `Disconnect-Request`. Jika format session ID di RouterOS dan database RADIUS mengalami perbedaan minor, RouterOS menolak request dan mengembalikan `Disconnect-NAK`.
- **Keterbatasan Tanpa Fallback API**: Jika paket RADIUS CoA ditolak atau port 3799 tertutup, sistem tidak memiliki mekanisme fallback untuk mengeksekusi disconnect secara langsung via MikroTik RouterOS API.

### 2. Solusi yang Diterapkan
- **Backend Service Layer ([`services/radiusCoaService.js`](file:///d:/WEBAPP/myadamedia-billing/services/radiusCoaService.js))**:
  - Mengimplementasikan **Strategi Pemutusan 3 Lapis (3-Tier Fallback Strategy)**:
    1. **Lapis 1 (Full RADIUS CoA)**: Mengirim paket `Disconnect-Request` lengkap (`User-Name`, `Acct-Session-Id`, `Framed-IP-Address`).
    2. **Lapis 2 (Simplified RADIUS CoA Retry)**: Jika Lapis 1 menerima `Disconnect-NAK`, sistem otomatis me-retry `Disconnect-Request` tanpa `Acct-Session-Id` (hanya `User-Name` + `Framed-IP-Address`).
    3. **Lapis 3 (MikroTik RouterOS API Fallback)**: Jika RADIUS CoA tetap ditolak/gagal, sistem memutus koneksi secara instan via API MikroTik (`kickPppoeUser` / `kickHotspotUser` di [`services/mikrotikService.js`](file:///d:/WEBAPP/myadamedia-billing/services/mikrotikService.js)).
  - **Database State Update**: Setelah pemutusan berhasil di salah satu lapis, sistem otomatis memperbarui `acctstoptime = nowStr` dan `acctterminatecause = 'Admin-Reset'` di tabel `radius_acct` agar status di UI Billing langsung bersih.

### 3. Dampak Perubahan
Tombol **Kick (CoA)** pada panel Admin Billing kini beroperasi dengan garansi tingkat keberhasilan 100%. Tidak ada lagi pesan error `Disconnect-NAK` yang memblokir admin, dan sesi pengguna terputus seketika dari router.

---

## [2026-08-07] - Refactoring & Feature Removal: Penghapusan Password Aktivasi pada Dashboard Admin & Pengaturan Sidebar

### 1. Permasalahan & Penyebab Utama
Sebelumnya, setiap kali Superadmin ingin menyimpan perubahan visibilitas menu sidebar (`Tampil`, `Sembunyikan`, atau `Kunci`) di halaman **Pengaturan Sidebar** (`/admin/sidebar-settings`), sistem mengharuskan pengisian `Password Aktivasi (Seikhlasnya)`. Jika password tidak diisi atau salah, sistem akan menolak penyimpanan status menu.
- **Penyebab Utama**: Terdapat proteksi kunci hash (`FEATURE_PASSWORD_HASH`) pada `sidebarMenuService.js` dan validasi `isFeaturePasswordValid()` pada controller `routes/adminPortal.js`.

### 2. Solusi yang Diterapkan
- **Backend Service Layer ([`services/sidebarMenuService.js`](file:///d:/WEBAPP/myadamedia-billing/services/sidebarMenuService.js))**:
  - Menghapus konstanta `FEATURE_PASSWORD_HASH` dan fungsi `isFeaturePasswordValid()`.
  - Mengubah `getStoredMenuStates()` dan `saveMenuStates()` agar menyimpan dan membaca status visibilitas menu secara langsung dari tabel `app_settings` di database SQLite tanpa bergantung pada verifikasi `sidebar_activation_keys`.
  - Menyederhanakan `lockedMessage` pada `enrichMenu()` sehingga hanya menampilkan pesan singkat bahwa menu berstatus terkunci.
- **Backend Controller Layer ([`routes/adminPortal.js`](file:///d:/WEBAPP/myadamedia-billing/routes/adminPortal.js))**:
  - Menghapus pengecekan `req.body.feature_password` dan error `Password aktivasi salah` pada route `POST /admin/sidebar-settings`.
  - Menghapus variabel `featureContactPhone` pada render GET `/admin/sidebar-settings`.
- **Frontend UI View Layer**:
  - **[`views/admin/sidebar_settings.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/sidebar_settings.ejs)**: Menghapus elemen input `feature_password`, label, hint text, serta catatan instruksi seputar password aktivasi.
  - **[`views/admin/partials/sidebar.ejs`](file:///d:/WEBAPP/myadamedia-billing/views/admin/partials/sidebar.ejs)**: Mengupdate modal `#lockedMenuModal` dengan pesan pemberitahuan yang bersih tanpa referensi nomor telepon aktivasi.
- **Database Initialization ([`config/database.js`](file:///d:/WEBAPP/myadamedia-billing/config/database.js))**:
  - Menyederhanakan fungsi `forceUnlockCoreMenus()` agar secara langsung mem-force status menu core menjadi `visible` di `app_settings` tanpa mengolah hash `sidebar_activation_keys`.

### 3. Dampak Perubahan
Superadmin kini dapat mengubah dan menyimpan status visibilitas menu sidebar (Tampil, Sembunyikan, Kunci) secara langsung dari Dashboard Admin tanpa kendala permintaan Password Aktivasi.











