# Implementation Plan: Kalkulator Redaman Optik di Peta (Link Budget & Dual-ACS Integration)

## 1. Analisis Kebutuhan & Problem Statement
Pada Peta Jaringan (`http://localhost:3001/admin/map` dan `http://localhost:3001/tech/map`):
Pengguna telah memiliki visualisasi kabel jaringan (feeder dari NOC ke ODC/ODP, kabel distribusi antar ODC-ODP, dan drop cable ke pelanggan) beserta kalkulasi jarak geodetik yang baru dibuat.
Pengguna membutuhkan **Kalkulator Redaman Optik Interaktif di Peta** yang:
1. **Menghitung Link Budget Optik Teoretis** berdasarkan akumulasi jarak kabel aktual (Feeder + Distribusi + Drop Cable) dikalikan koefisien redaman fiber optik ($\alpha \approx 0.35\text{ dB/km}$ pada panjang gelombang downstream 1490nm), redaman percabangan splitter (ODC Level-1 dan ODP Level-2), serta loss sambungan konektor/splicing ($\approx 1.5\text{ dB}$).
2. **Mengintegrasikan RX Optical Power Aktual dari Dual-ACS** (Built-in ACS `acs_devices` dan External GenieACS) yang dilaporkan secara langsung oleh modem ONT pelanggan.
3. **Mendiagnosa Deviasi & Kualitas Fisik Kabel Serat Optik**:
   - Menghitung $\Delta = |\text{RX Aktual} - \text{RX Estimasi}|$.
   - Mengkategorikan status: *Optimal* ($-15$ s/d $-22.99\text{ dBm}$), *Wajar* ($-23$ s/d $-26.99\text{ dBm}$), *Warning* ($-27$ s/d $-28.99\text{ dBm}$), dan *Kritis* ($< -29\text{ dBm}$ atau Overload $> -8\text{ dBm}$).
   - Menganalisis potensi gangguan: *Macro-bending* (kabel tertekuk), sambungan redam, konektor kotor/rusak, atau kabel terjepit.
4. **Penyajian Visual Kaya & Interaktif**:
   - **Bagian Redaman Optik pada Tooltip Kabel Hover**: Ringkasan RX Teoretis, RX Aktual, Deviasi $\Delta$, dan status mutu sinyal.
   - **Modal Interaktif "Kalkulator & Diagnosa Redaman Optik"**: Diagram topologi end-to-end dengan live simulation slider (TX Power OLT, koefisien kabel, rasio splitter, connector margin) dan rekomendasi teknisi.
   - **Toggle Layer "Mode Redaman Optik"**: Mengubah warna polyline kabel drop dan pin pelanggan menjadi heatmap indikator kualitas sinyal optik (Neon Green, Gold Yellow, Orange, Red, Slate Gray) beserta Optical Legend Card.
   - **REST API Live Refresh**: Endpoint `GET /admin/api/optical-budget/live` dan `GET /tech/api/optical-budget/live`.

---

## 2. Struktur Folder & File Terkait
```text
myadamedia-billing/
├── services/
│   └── opticalPowerService.js     # [NEW] Service kalkulasi link budget, ekstraksi RX Dual-ACS, evaluasi diagnosa
├── routes/
│   ├── admin/
│   │   └── maps.js                # [MODIFY] Integrasi optical budget data & API live endpoint di admin map
│   ├── adminPortal.js             # [MODIFY] Suntikkan optical map data & rute live di portal admin
│   └── techPortal.js              # [MODIFY] Suntikkan optical map data & rute live di portal teknisi
├── views/
│   ├── admin/
│   │   └── map.ejs                # [MODIFY] Tooltip kabel optik, modal kalkulator simulator, toggle layer heatmap
│   └── tech/
│   │   └── map.ejs                # [MODIFY] Tooltip kabel optik teknisi, visualisasi status redaman, modal ringkas
├── tests/
│   └── opticalPowerBudget.test.js # [NEW] Test suite kalkulasi matematika, ekstraksi RX Dual-ACS, evaluasi deviasi & EJS
├── file md/
│   └── implementation_plan.md     # [MODIFY] Dokumen arsitektur rencana kerja
├── version.txt                    # [MODIFY] Bump versi ke 15.6.0
└── proses.md                      # [MODIFY] Dokumentasi lengkap perubahan sistem & pengujian
```

---

## 3. Desain Arsitektur & Formula Link Budget Optik

```text
               +-------------------------------------------------------------+
               |                  KANTOR PUSAT / NOC / OLT                   |
               |                Tx Power SFP OLT: +3.50 dBm                  |
               +------------------------------+------------------------------+
                                              |
                          Kabel Feeder (Jarak: D_feeder km * 0.35 dB/km)
                                              |
                                              v
                              +-------------------------------+
                              |          ODC (Cabinet)        |
                              |   Splitter Level 1: 1:4 (7.2 dB)
                              +---------------+---------------+
                                              |
                       Kabel Distribusi (Jarak: D_dist km * 0.35 dB/km)
                                              |
                                              v
                              +-------------------------------+
                              |          ODP (Box)            |
                              |   Splitter Level 2: 1:8 (10.5 dB)
                              +---------------+---------------+
                                              |
                         Drop Cable (Jarak: D_drop km * 0.35 dB/km)
                                              |
                                              v
               +-------------------------------------------------------------+
               |                  PELANGGAN / ONT (MODEM)                    |
               |  Estimasi Rx: Tx - (L_kabel + L_splitter + L_konektor)      |
               |  Aktual Rx: Diambil Realtime via Dual-ACS (Built-in / Genie)|
               |  Delta Deviasi = |Rx_Aktual - Rx_Estimasi|                  |
               +-------------------------------------------------------------+
```

### Formula Matematis:
1. **Total Redaman Kabel Fiber Optik ($L_{cable}$)**:
   $$L_{cable} = (D_{feeder} + D_{distribusi} + D_{drop}) \times \frac{\alpha_{fiber}}{1000}$$
   dengan $\alpha_{fiber} = 0.35\text{ dB/km}$ (@ 1490nm single-mode).
2. **Total Redaman Splitter ($L_{splitters}$)**:
   $$L_{splitters} = L_{split\_odc} + L_{split\_odp}$$
   - Rasio 1:2: $3.7\text{ dB}$
   - Rasio 1:4: $7.2\text{ dB}$
   - Rasio 1:8: $10.5\text{ dB}$
   - Rasio 1:16: $13.8\text{ dB}$
   - Rasio 1:32: $17.1\text{ dB}$
   - Direct/None: $0.0\text{ dB}$
3. **Total Insertion Loss Konektor & Sambungan Splicing ($L_{conn}$)**:
   $$L_{conn} = 1.50\text{ dB}\quad (\text{Adaptor ODF, ODC, ODP, Roset + Fusion Splices})$$
4. **Estimasi RX Power Teoretis ($P_{rx\_est}$)**:
   $$P_{rx\_est} = P_{tx\_olt} - (L_{cable} + L_{splitters} + L_{conn} + M_{safety})$$
5. **Delta Deviasi ($\Delta$)**:
   $$\Delta = |P_{rx\_act} - P_{rx\_est}|$$
   - $\Delta \le 2.0\text{ dB}$: Normal / Optimal (Pemasangan presisi).
   - $2.0 < \Delta \le 4.5\text{ dB}$: Toleransi Sedang (Potensi lekukan ringan / debu pada konektor).
   - $\Delta > 4.5\text{ dB}$: Deviasi Tinggi (Macro-bending parah, kabel terjepit, atau konektor rusak).

---

## 4. Rencana Implementasi Bertahap

### Tahap 1: Pembuatan `services/opticalPowerService.js`
- `calculateTheoreticalLoss(params)`: Fungsi murni kalkulasi link budget.
- `evaluateOpticalQuality(rxActual, rxEstimated)`: Evaluasi status mutu dan analisa diagnosa.
- `extractRxFromParams(paramsJson)`: Helper ekstraksi dan konversi unit raw nanowatts ke dBm.
- `getDualAcsRxPowerMap()`: Mengagregasi data RX power terkini dari tabel `acs_devices` dan mencocokkan ke database pelanggan.
- `getOpticalNetworkTopologyData()`: Mengombinasikan data geografis ODP, ODC, pelanggan, jarak rute kabel, dan RX power untuk disuntikkan ke tampilan peta.

### Tahap 2: Integrasi Rute Backend (`routes/admin/maps.js`, `routes/adminPortal.js`, `routes/techPortal.js`)
- Menyuntikkan `opticalData` pada `res.render('admin/map')` dan `res.render('tech/map')` via `<script id="optical-data">`.
- Menyediakan endpoint REST API:
  - `GET /admin/api/optical-budget/live`
  - `GET /tech/api/optical-budget/live`

### Tahap 3: Pembaruan Tampilan Frontend Peta (`views/admin/map.ejs` & `views/tech/map.ejs`)
- Desain CSS Card Redaman Optik pada Tooltip Kabel Hover (panjang kabel, loss kabel, RX estimasi, RX aktual, deviasi, status badge).
- Modal Interaktif "Kalkulator & Diagnosa Redaman Optik":
  - Simulator interaktif dengan slider TX Power, koefisien redaman, dropdown rasio splitter.
  - Diagram visual segmen jalur optik.
  - Rekomendasi aksi teknisi lapangan.
- Kontrol Layer "Mode Redaman Optik":
  - Checkbox toggle filter layer.
  - Pewarnaan dinamis kabel drop & pin pelanggan berdasarkan kualitas redaman.
  - Floating Optical Legend Card.

### Tahap 4: Pengujian Komprehensif (`tests/opticalPowerBudget.test.js`)
- Uji perhitungan matematika link budget optik dengan berbagai parameter.
- Uji ekstraksi RX power dari format TR-069 dan konversi raw optical units.
- Uji evaluasi kualitas sinyal optik dan diagnosa deviasi.
- Uji endpoint API dan integritas template EJS.

### Tahap 5: Dokumentasi & Version Bump
- Update `version.txt` ke `15.6.0`.
- Tulis laporan implementasi di `proses.md`.
