# Implementation Plan: Dual-ACS Hybrid Mode (Built-in ACS & External GenieACS Concurrent Execution)

## 1. Analisis Kebutuhan
Pada halaman Pengaturan Sistem (`http://localhost:3001/admin/settings`) dan Portal Manajemen ACS (`http://localhost:3001/admin/acs` serta `/tech/monitoring`):
Pengguna menginginkan agar **Built-in ACS (TR-069 port 3001 `/acs`)** dan **External GenieACS Server (REST API port 7557 / CWMP port 7547)** dapat berjalan bersamaan secara *concurrent* (Mode Hybrid), tanpa saling menonaktifkan atau menyembunyikan konfigurasi satu sama lain.

### Kondisi Sebelumnya:
1. `views/admin/settings.ejs`: Checkbox `use_builtin_acs` memicu `toggleAcsFields()` yang menyembunyikan form input GenieACS eksternal (`style.display = 'none'`), menciptakan kesan eksklusivitas mutual.
2. `config/genieacs.js`: `getAllACSServers()` memiliki percabangan *early-return*:
   ```javascript
   if (isBuiltinAcsEnabled()) {
       return [{ id: 'builtin', name: 'Built-in ACS', url: 'local', status: 'active' }];
   }
   ```
   Hal ini menyebabkan server GenieACS eksternal tidak pernah dimasukkan ke dalam daftar server saat Built-in aktif, meskipun URL dan kredensial eksternal sudah diset.
3. `routes/acsPortal.js`: `getACSServers(id)` juga mengabaikan `legacyServer` dan database `genieacs_servers` saat `isBuiltinAcsEnabled()` bernilai `true`.

### Target Solusi:
1. **Aggregasi Multi-Server**: Menggabungkan `builtin` server, `legacy` external server, dan entri multi-ACS database ke dalam satu array aktif yang dapat diakses secara agregat atau difilter per-server.
2. **Form Pengaturan Terbuka & Bersahabat**: Menampilkan opsi Built-in ACS dan External GenieACS secara berdampingan dengan badge informasi mode Hybrid.
3. **Penyelarasan Handler Operasi & Monitoring**: Operasi diagnostik, reboot, factory reset, dan monitoring berkala (RX power & offline alerts) dapat menjangkau perangkat di kedua ACS secara transparan.

---

## 2. Struktur Folder & File Terkait
```text
myadamedia-billing/
├── config/
│   └── genieacs.js                # [MODIFY] getAllACSServers(), getACSServer(), getDeviceInfo() pendukung mode hybrid
├── routes/
│   ├── acsPortal.js               # [MODIFY] getACSServers() agregasi builtin + external + DB, axios proxy
│   └── techPortal.js              # [MODIFY] getACSServers() sinkronisasi builtin + legacy di teknisi
├── views/
│   ├── admin/
│   │   ├── settings.ejs           # [MODIFY] Form API eksternal: Built-in & GenieACS eksternal aktif simultan
│   │   └── acs.ejs                # [MODIFY] Tabel server proteksi builtin dan navigasi pengaturan
├── tests/
│   └── dualAcsHybrid.test.js      # [NEW] Test suite validasi concurrent ACS & template rendering
├── file md/
│   └── implementation_plan.md     # [MODIFY] Dokumentasi rencana implementasi dual-ACS
├── version.txt                    # [MODIFY] Bump versi ke 15.5.2
└── proses.md                      # [MODIFY] Logbook dokumentasi perubahan sistem
```

---

## 3. Desain Arsitektur & Logika Eksekusi Concurrent
```
                           +---------------------------+
                           |   MyAdamedia Billing      |
                           +-------------+-------------+
                                         |
               +-------------------------+-------------------------+
               |                                                   |
      [Mode Built-in ACS]                                 [External GenieACS]
    Port 3001: POST /acs                                Port 7557: REST API
               |                                                   |
     CPE Modem Mengarah ke                              CPE Modem Mengarah ke
   http://billing-ip:3001/acs                         http://genieacs-ip:7547
               |                                                   |
      SQLite: acs_devices                               MongoDB / GenieACS Server
               |                                                   |
      createBuiltinAxiosProxy()                           axios (HTTP/REST)
               \                                                   /
                +------------------------+------------------------+
                                         |
                              getAllACSServers()
                                         |
                   +---------------------+---------------------+
                   |                                           |
             [Admin Portal]                             [Teknisi Portal]
             /admin/acs                                 /tech/monitoring
         - Tab Semua Server                          - Monitoring ONU Bersama
         - Filter per-ACS Server                     - WhatsApp Bot Interaktif
```

1. **`getAllACSServers()` Flow**:
   - Langkah 1: Cek apakah `isBuiltinAcsEnabled()` aktif. Jika ya, tambahkan `{ id: 'builtin', name: 'Built-in ACS', url: 'local', status: 'active' }`.
   - Langkah 2: Ambil `legacyUrl`. Jika terkonfigurasi, tambahkan `{ id: 'legacy', name: 'Default ACS', url: legacyUrl, username, password, status: 'active' }`.
   - Langkah 3: Ambil daftar server aktif dari tabel `genieacs_servers` di database SQLite.
   - Langkah 4: Return seluruh array servers gabungan.
2. **`createAxiosInstance(server)` Router**:
   - Jika `server.id === 'builtin'` atau `server.url === 'local'`: gunakan `createBuiltinAxiosProxy()` (mengakses langsung tabel `acs_devices` dan `acs_tasks` di SQLite).
   - Jika server eksternal: gunakan instance HTTP Axios terautentikasi ke REST API GenieACS port 7557.
3. **Device Operations Routing (`reboot`, `factoryReset`, `setParameterValues`)**:
   - Menggunakan `_acs_server_id` yang tersimpan pada objek perangkat. Jika tidak diberikan, mendeteksi ketersediaan ID perangkat di seluruh server yang terdaftar.

---

## 4. Rencana Pengujian
1. Menulis automated test `tests/dualAcsHybrid.test.js`:
   - Validasi `getAllACSServers()` saat mode hybrid (kedua server aktif).
   - Validasi saat hanya built-in aktif.
   - Validasi saat hanya external aktif.
   - Validasi saat kedua-duanya nonaktif.
   - Validasi `getACSServer` untuk ID spesifik (`builtin`, `legacy`).
   - Validasi adapter proxy axios vs axios HTTP instance.
   - Validasi kompilasi template EJS `views/admin/settings.ejs` dan `views/admin/acs.ejs`.
2. Eksekusi pengujian via Jest CLI:
   `node ./node_modules/jest/bin/jest.js tests/dualAcsHybrid.test.js --coverage=false --forceExit`
3. Memastikan seluruh 7/7 atau lebih pengujian berstatus PASSED.
4. Memperbarui `version.txt` (15.5.2) dan mendokumentasikan hasil pengujian di `proses.md`.
