# Implementation Plan: Visualisasi Jarak Kabel Interaktif (ODP/ODC ke Pelanggan & ODC ke ODP)

## 1. Analisis Kebutuhan
Pada halaman Peta Jaringan (`http://localhost:3001/admin/map` dan `http://localhost:3001/tech/map`):
Saat kursor/mouse diarahkan (*hover*) ke kabel/jalur fiber optik:
- **Jalur Pelanggan (Drop Cable)**: Menampilkan jarak presisi dari ODP atau ODC ke koordinat rumah pelanggan.
- **Jalur Distribusi & Feeder (ODC ke ODP / Feeder NOC ke ODC/ODP)**: Menampilkan jarak presisi dari ODC ke ODP atau dari Kantor Pusat/NOC ke ODC/ODP.
- **Interaktivitas Visual**: Garis kabel menebal saat di-hover, memunculkan tooltip dark glassmorphic yang sticky mengikuti posisi kursor secara real-time.
- **Kalkulator Jarak pada Modal Gambar Jalur**: Menampilkan indikator estimasi panjang kabel secara dinamis saat admin/teknisi menggeser titik lekukan kabel.

---

## 2. Struktur Folder & File Terkait
```text
myadamedia-billing/
├── views/
│   ├── admin/
│   │   └── map.ejs                # [MODIFY] Peta Jaringan Admin (CSS Tooltip, Kalkulasi Jarak, Hover Effects)
│   └── tech/
│       └── map.ejs                # [MODIFY] Peta Jaringan Teknisi (Sinkronisasi Fitur Jarak Kabel)
├── tests/
│   └── mapCableDistance.test.js   # [NEW] Unit & Integration Tests kalkulasi jarak & render view
├── file md/
│   └── implementation_plan.md     # [NEW] Dokumentasi rencana implementasi
└── proses.md                      # [MODIFY] Dokumentasi logbook perubahan sistem
```

---

## 3. Desain Arsitektur & Perhitungan Jarak (Geodesic WGS84)
1. **Perhitungan Jarak Geodesik Akurat**:
   - Leaflet `L.latLng(p1).distanceTo(L.latLng(p2))` menghitung jarak kelengkungan bumi (geodesic distance) dalam meter.
   - Fungsi `calculateCableDistance(path)` mengiterasi seluruh segmen pada `pathCoords` baik 2 titik langsung maupun *multi-waypoint polyline*.
2. **Formatting Distance Utility**:
   - Jika $< 1000$ m: format `145 meter`.
   - Jika $\ge 1000$ m: format `1,25 km (1.250 m)`.
3. **Penyusunan Tooltip Card**:
   - Opsi Leaflet: `{ sticky: true, className: 'custom-cable-tooltip', offset: [0, -10] }`.
   - Menyajikan informasi komprehensif: Tipe jalur, Node Asal, Node Tujuan, Panjang Kabel, dan metadata pendukung (PON, Paket, Status).
4. **Sanitasi XSS**:
   - Menggunakan fungsi `escapeHtml()` sebelum menyisipkan string nama pelanggan atau nama ODP ke dalam HTML tooltip.

---

## 4. Rencana Pengujian
1. Membuat test suite Jest `tests/mapCableDistance.test.js`:
   - Validasi algoritma kalkulasi jarak garis lurus dan multi-segment.
   - Validasi formatting meter dan kilometer.
   - Validasi handling edge case (titik koordinat tidak lengkap, string non-numerik, array kosong).
   - Validasi kompilasi template EJS `views/admin/map.ejs` dan `views/tech/map.ejs`.
2. Validasi eksekusi Jest dengan hasil 100% PASSED.
3. Dokumentasi lengkap pada `proses.md`.
