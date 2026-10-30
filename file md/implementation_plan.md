# Implementation Plan: Anti-False Alert PPPoE Disconnected & Multi-Router Monitoring Engine

## 1. Analisis Masalah & Problem Statement
Pengguna melaporkan kendala di mana bot Telegram sering kali memicu notifikasi:
```text
🚨 ALERT: USER PPPoE DISCONNECTED
```
Namun saat dicek langsung oleh administrator di router MikroTik dan perangkat OLT, perangkat fisik pelanggan (ONT) dan sesi PPPoE berstatus **ONLINE dan normal**.

### Akar Permasalahan Teknis (Root Causes):
1. **Multi-Router Disconnect (Salah Router Target)**:
   - Task #9 pada `services/cronService.js` memanggil `mikrotikService.getPppoeSecrets()` dan `mikrotikService.getPppoeActive()` tanpa argumen (`routerId = null`).
   - `routerId = null` mengarahkan koneksi ke router default di `settings.json` (`172.99.12.2:8778`), yang statusnya saat ini offline / tidak bisa diakses (`ECONNREFUSED`).
   - Sedangkan router operasional sesungguhnya adalah **Router ID 1** (`10.10.10.1:8778`) yang tercatat di tabel `routers` dengan 85 secrets dan 84 sesi aktif.
   - Sebanyak 49 dari 62 pelanggan yang ada di Router 1 memiliki kolom `router_id = NULL` di database `customers`.
2. **Silent Failure & Cache Eviction pada `getPppoeActive()`**:
   - Fungsi `getPppoeActive()` di `services/mikrotikService.js` menangkap error koneksi/timeout dan mengembalikan array kosong `[]` jika stale cache kedaluwarsa (> 2 detik).
   - `cronService.js` menganggap array `[]` adalah respons valid dan membuat `activeMap` kosong (`size = 0`).
   - Akibatnya, seluruh user yang sebelumnya online langsung dianggap terputus massal (`DISCONNECTED`).
3. **Ketiadaan Flap Damping / Multi-Strike Confirmation (1-Strike Rule)**:
   - Jika ONT mengalami re-negosiasi PPP singkat (2–5 detik) akibat LCP timeout atau lease renewal, link optik OLT tetap **Online / UP** (-19 dBm).
   - Namun karena cron 2-menitan berjalan tepat di jeda tersebut, cron langsung mengirim alert offline tanpa verifikasi ulang (*debounce*).
4. **Strict Case-Sensitive Matching**:
   - `activeMap.set(name, row)` dan `activeMap.has(username)` bersifat case-sensitive, sehingga perbedaan kapitalisasi nama antara secret dan sesi aktif memicu false alert.

---

## 2. Struktur Folder & Modul Terkait
```text
myadamedia-billing/
├── config/
│   └── database.js                       # [REFERENCE] Koneksi database SQLite billing.db
├── services/
│   ├── cronService.js                    # [MODIFY] Refactoring Task 9: Multi-router aggregation, Circuit Breaker, 2-Strike Debounce, Case-insensitive matching
│   ├── mikrotikService.js                # [MODIFY] Perbaikan error handling getPppoeActive & getPppoeSecrets (bedakan query error vs 0 active sessions)
│   └── telegramBot.js                    # [MODIFY] Format pesan alert yang lebih informatif jika terjadi flapping / ONT UP
├── tests/
│   └── telegramPppoeAntiFalseAlert.test.js # [NEW] Test suite pengujian multi-router, circuit breaker API, 2-strike debounce, & case-insensitivity
├── file md/
│   └── implementation_plan.md            # [MODIFY] Dokumen rencana implementasi ini
├── version.txt                           # [MODIFY] Bump versi rilis (15.9.8)
└── proses.md                             # [MODIFY] Riwayat dokumentasi perbaikan dan hasil pengujian
```

---

## 3. Desain Arsitektur & Logika Sistem

```text
                  +----------------------------------------------+
                  |  CRON Task #9: PPPoE Monitoring (Setiap 2m)   |
                  +----------------------+-----------------------+
                                         |
             +---------------------------v---------------------------+
             |         Multi-Router Aggregator: Ambil Router         |
             |       (mikrotikService.getAllRouters() + default)     |
             +---------------------------+---------------------------+
                                         |
                       Iterasi Tiap Router Aktif
                                         |
     +-----------------------------------+-----------------------------------+
     |                                                                       |
     v                                                                       v
+-----------------------------+                         +-----------------------------+
| Router 1 (10.10.10.1:8778)  |                         | Router Default (172.99...)  |
| getPppoeSecrets(1)          |                         | getPppoeSecrets(null)       |
| getPppoeActive(1)           |                         | getPppoeActive(null)        |
+--------------+--------------+                         +--------------+--------------+
               |                                                       |
               v                                                       v
       [STATUS: OK / ERROR]                                    [STATUS: OK / ERROR]
               |                                                       |
               +---------------------------+---------------------------+
                                           |
                                           v
                       +---------------------------------------+
                       |   CIRCUIT BREAKER & INTEGRITY CHECK   |
                       +---------------------------------------+
                       | 1. Jika query router gagal -> SKIP   |
                       |    (Jangan anggap user offline!)      |
                       | 2. Jika active drop drastis (>60%)    |
                       |    dengan secrets tetap banyak,       |
                       |    deteksi sebagai API Timeout Lag    |
                       +-------------------+-------------------+
                                           | Data Terverifikasi Valid
                                           v
                       +---------------------------------------+
                       |    2-STRIKE DEBOUNCE & VERIFIKASI     |
                       +---------------------------------------+
                       | User hilang dari activeMap?           |
                       | -> Strike 1: Catat & Re-check instan  |
                       | -> Strike 2: Konfirmasi offline       |
                       | -> Cek OLT: Jika ONT OLT 'Online/UP', |
                       |    labeli 'PPPoE Reconnecting'        |
                       +-------------------+-------------------+
                                           |
                                           v
                       +---------------------------------------+
                       |     Kirim Notifikasi Telegram Bot     |
                       |    (Hanya untuk Gangguan Riil)        |
                       +---------------------------------------+
```

---

## 4. Alur Kerja Fitur (Detailed Workflow)

1. **Step 1: Multi-Router Aggregator**:
   - Mengambil seluruh router aktif dari `mikrotikService.getAllRouters()`.
   - Mengambil secrets dan active sessions untuk setiap router.
   - Memetakan username dalam format normalisasi `username.toLowerCase().trim()`.
   - Menyimpan router origin untuk setiap secret dan session aktif: `routerMap.set(key, { routerId, secret, active })`.
2. **Step 2: Circuit Breaker & Safe Fallback**:
   - Jika sebuah router mengalami kegagalan koneksi API, log error dibuat tetapi state pelanggan di router tersebut **dipertahankan (tidak diubah menjadi offline)**.
   - Mencegah false alarm massal saat jaringan MikroTik sibuk atau sedang reboot.
3. **Step 3: 2-Strike Confirmation & Immediate Retest**:
   - Jika user sebelumnya online dan tiba-tiba tidak ada di `activeMap`:
     - Sistem melakukan re-test individual instan (`mikrotikService.getPppoeActiveUser(username, routerId)`) setelah jeda 3 detik.
     - Jika pada re-test user ternyata ada, batalkan transisi offline (flapping teratasi).
     - Jika tetap tidak ada, naikkan `strikeCount`. Notifikasi `ALERT DISCONNECTED` hanya dikirimkan jika terkonfirmasi.
4. **Step 4: OLT Cross-Validation Intelligence**:
   - Sebelum mengirim pesan Telegram:
     - Jika ONT di OLT berstatus `PwrDown` atau `LOS` atau `Dying_gasp`: **Kategori: Pemadaman Listrik / Kabel Putus Fisik (Kritis)**.
     - Jika ONT di OLT berstatus `Online / UP` dengan redaman optik bagus: **Kategori: Sesi PPP Terputus Sementara (ONT Normal di OLT)**.
5. **Step 5: Logging & Audit Trail**:
   - Setiap deteksi dicatat ke logger dengan label jelas untuk mempermudah pemantauan teknisi.

---

## 5. Rencana Pengujian (Test Plan)
1. **Unit Testing (`tests/telegramPppoeAntiFalseAlert.test.js`)**:
   - Test 1: Aggregator membaca sesi dari Router ID 1 dan router default secara bersamaan.
   - Test 2: Circuit breaker mencegah false alarm ketika salah satu router gagal dihubungi (API failure).
   - Test 3: Normalisasi username case-insensitive (`User123` vs `user123`) berhasil mencocokkan sesi.
   - Test 4: Mekanisme 2-strike debounce menyaring fluktuasi/flapping sesaat.
   - Test 5: Format pesan notifikasi menyertakan status OLT yang akurat dan jelas.
2. **Integration Verification**:
   - Eksekusi `npm test` atau `npx jest tests/telegramPppoeAntiFalseAlert.test.js`.
   - Uji koneksi router langsung via skrip mandiri untuk memastikan Router 1 (`10.10.10.1:8778`) terintegrasi penuh.
3. **Dokumentasi**:
   - Mencatat seluruh riwayat perubahan di `proses.md` sesuai SOP.
   - Memperbarui versi pada `version.txt`.
