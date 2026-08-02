# PROPOSAL PENAWARAN INVESTASI & KERJA SAMA STRATEGIS
## "MYADAMEDIA BILLING — ALL-IN-ONE ISP MANAGEMENT & AUTOMATION PLATFORM"

---

**Diajukan Oleh:** Management & Technical Team MyAdamedia  
**Peruntukan:** Calon Investor & Mitra Strategis  
**Tanggal:** 2 Agustus 2026  
**Status Dokumen:** Confidential & Proprietary  

---

## 1. RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)

**MyAdamedia Billing** adalah platform manajemen operasional dan otomatisasi penagihan terpadu (*All-in-One ISP Management & Automation Platform*) yang dirancang khusus untuk memenuhi kebutuhan Penyedia Jasa Internet (ISP lokal), Pengelola RTRW Net, dan Jaringan Komunitas. Platform ini mengintegrasikan seluruh lifecycle operasional ISP—mulai dari manajemen pelanggan, otomatisasi billing/QRIS, provisioning jaringan MikroTik & OLT PON via SNMP/Telnet, TR-069 GenieACS, pemetaan kabel GIS (Geographic Information System), hingga sistem multi-portal untuk Admin, Pelanggan, Teknisi Lapangan, Agen Voucher, dan Kolektor.

Saat ini, platform **MyAdamedia Billing** telah beroperasi secara aktif (*proven track record*) melayani **80 pelanggan terhubung**, dengan **Monthly Recurring Revenue (MRR)** eksisting sebesar **Rp 12.895.000 / bulan** (setara **Rp 154.740.000 / tahun** gross revenue).

Dalam rangka melakukan akselerasi ekspansi infrastruktur jaringan, peningkatan kualitas layanan, serta penetrasi pasar untuk melipatgandakan jumlah pelanggan hingga **180+ pelanggan aktif** pada Tahun 1, kami membuka peluang investasi strategis sebesar **Rp 20.000.000 (Dua Puluh Juta Rupiah)**. Dengan estimasi *Payback Period* yang sangat singkat yaitu **5 – 7 bulan** dan proyeksi **Return on Investment (ROI) hingga 207%** dalam 2 tahun, penawaran ini menghadirkan investasi berrisiko sangat rendah dengan fundamental arus kas kas yang kuat dan sudah teruji.

---

## 2. LATAR BELAKANG & PERMASALAHAN PASAR

### 2.1 Latar Belakang
Kebutuhan akses internet berkecepatan tinggi berbasis fiber optik di tingkat pemukiman dan daerah pelosok terus melonjak pesat. Ratusan ISP lokal dan pengelola jaringan RT/RW Net hadir untuk mengisi celah infrastruktur ini. Namun, mayoritas pengelola ISP lokal menghadapi tantangan besar dalam mengelola operasional sehari-hari karena keterbatasan alat bantu berbasis teknologi terintegrasi.

### 2.2 Permasalahan Utama (Market Pain Points)
1. **Otomatisasi Tagihan & Isolir Masih Manual:** Banyak pengelola masih menggunakan pencatatan tagihan di Excel atau pesan WhatsApp manual. Keterlambatan isolir pelanggan yang belum membayar mengakibatkan *revenue leakage* (kebocoran pendapatan) hingga 15–20%.
2. **Fragmentasi Manajemen Perangkat Jaringan:** Pengaturan Router MikroTik (PPPoE/Hotspot), OLT PON (ZTE/Huawei/VSOL), dan modem CPE/ONT pelanggan dilakukan secara terpisah-pisah, membutuhkan waktu lama dan keahlian teknis tinggi.
3. **Kendala Pemetaan & Pelacakan Gangguan Lapangan:** Ketidaktersediaan peta jalur kabel fiber optic dan ODP yang presisi membuat teknisi kesulitan melokalisir kabel putus atau merelokasi pelanggan baru.
4. **Tingginya Biaya Operasional (OPEX):** Tanpa portal mandiri untuk teknisi, agen voucher, dan pelanggan, pengelola harus menambah staf administrasi yang meningkatkan beban gaji bulanan.

---

## 3. SOLUSI & ARSITEKTUR PLATFORM MYADAMEDIA

MyAdamedia Billing menghadirkan solusi komprehensif dalam satu arsitektur perangkat lunak modern:

```
                               ┌──────────────────────────────────────────────┐
                               │       MYADAMEDIA ALL-IN-ONE PLATFORM         │
                               └──────────────────────┬───────────────────────┘
                                                      │
         ┌────────────────┬───────────────────────────┼───────────────────────────┬────────────────┐
         │                │                           │                           │                │
┌────────▼───────┐┌───────▼───────────────┐┌──────────▼───────────────┐┌──────────▼────────┐┌────────▼───────┐
│ AUTOMATED NET  ││ BILLING & PAYMENT     ││ GIS MAP & NETWORK INFRA  ││ MULTI-ROLE PORTAL││ WHATSAPP/BOT   │
│ MikroTik ROS 7 ││ Auto QRIS Payment     ││ Leaflet Satellite Map    ││ Customer Portal  ││ Baileys WA Bot │
│ OLT ZTE/Huawei ││ Midtrans/Tripay/Xendit││ ODP & Fiber Path Polyline││ Tech & Collector ││ Billing Alert  │
│ TR-069 ACS CPE ││ Prorata & FUP Logic   ││ GPS Location Tracking    ││ Agent & Investor ││ NOC Alerts     │
└────────────────┘└───────────────────────┘└──────────────────────────┘└──────────────────┘└────────────────┘
```

### Keunggulan Fitur Teknis Utama:
- **Otomatisasi Billing & Pembayaran Instant (QRIS Webhook):** Tagihan terbit otomatis per tanggal 1. Pelanggan membayar via QRIS/Payment Gateway, webhook secara instan mengubah status invoice menjadi `PAID` dan membuka isolir MikroTik secara otomatis tanpa campur tangan manusia.
- **Provisioning Jaringan Multi-Vendor:** Dukungan langsung untuk MikroTik ROS v6 & v7 API, OLT ZTE C320/C300 via Telnet & SNMP, serta server TR-069 GenieACS bawaan untuk konfigurasi SSID/Password Wi-Fi remote.
- **Peta Jaringan GIS & Jalur Kabel:** Visualisasi Leaflet dengan basemap satelit hybrid untuk memetakan koordinat rumah pelanggan, titik ODP, serta polyline jalur kabel fiber optic.
- **Ekosistem 6 Portal Terintegrasi:**
  1. *Admin Portal:* Pusat kendali keuangan, jaringan, inventaris SN gudang, dan SDM/Payroll.
  2. *Customer Portal:* Self-service pembayaran, cek tagihan, ubah Wi-Fi, dan kirim tiket komplain.
  3. *Technician Portal:* Penanganan tiket gangguan dengan foto lokasi GPS & absensi staf.
  4. *Agent Portal:* Penjualan voucher hotspot & top-up saldo transaksi real-time.
  5. *Collector Portal:* Pengajuan pembayaran tunai lapangan dengan sistem approval.
  6. *Investor Portal:* Transparansi performa keuangan dan bagi hasil secara real-time.

---

## 4. ANATOMI DATA OPERASIONAL AKTUAL (TRACTION & REVENUE)

Berdasarkan audit data aktual pada database aplikasi saat ini, berikut adalah profil pendapatan eksisting:

### 4.1 Status & Jumlah Pelanggan Terhubung
- **Total Pelanggan Terdaftar:** 81 Pelanggan
- **Pelanggan Aktif Membayar:** 80 Pelanggan (98,7% Active Rate)
- **Pelanggan Non-Aktif:** 1 Pelanggan

### 4.2 Segmentasi Paket & Kontribusi Pendapatan Bulanan
| Nama Paket | Kecepatan / Tipe | Harga Paket / Bln | Jumlah Pelanggan | Pendapatan Bulanan (MRR) | Presentase |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **LITE** | Home Broadband | Rp 150.000 | 68 Pelanggan | **Rp 10.200.000** | 79,1% |
| **BASIC** | Premium Broadband | Rp 250.000 | 7 Pelanggan | **Rp 1.750.000** | 13,6% |
| **BASIC A** | Premium Dedicated | Rp 250.000 | 3 Pelanggan | **Rp 750.000** | 5,8% |
| **STARTER A** | Entry Level | Rp 115.000 | 2 Pelanggan | **Rp 230.000** | 1,8% |
| **STARTER B** | Entry Level | Rp 115.000 | 1 Pelanggan | **Rp 115.000** | 0,9% |
| **TOTAL** | — | — | **80 Pelanggan** | **Rp 12.895.000** | **100%** |

### 4.3 Summary Keuangan Eksisting (Tanpa Tambahan Modal)
- **Monthly Recurring Revenue (MRR):** **Rp 12.895.000 / bulan**
- **Annualized Recurring Revenue (ARR):** **Rp 154.740.000 / tahun**
- **Kolektibilitas Pembayaran:** High (59 dari 64 Invoice terbit lunas tepat waktu via sistem otomatis).

---

## 5. ANALISIS PASAR & KEUNGGULAN KOMPETITIF

### 5.1 Potensi Pasar (Market Potential)
- **TAM (Total Addressable Market):** 12.000+ Pengelola RTRW Net & ISP Lokal skala kecil-menengah di Indonesia.
- **SAM (Serviceable Addressable Market):** 3.500+ ISP/RTRW Net di wilayah Pulau Jawa & Sumatera.
- **SOM (Serviceable Obtainable Market):** 250+ ISP/Jaringan Lokal dalam kurun 24 bulan ke depan.

### 5.2 Analisis SWOT
- **Strength (Kekuatan):** Produk sudah berjalan 100% (*proven product*), MRR positif Rp 12.895.000/bln, otomasi teknis lengkap (MikroTik + OLT + WA + QRIS).
- **Weakness (Kelemahan):** Kapasitas server & jangkauan pemasaran masih terbatas pada modal swadaya.
- **Opportunity (Peluang):** Permintaan jaringan internet daerah belum tergarap sepenuhnya; potensi monetisasi tambahan dari penjualan voucher hotspot publik.
- **Threat (Ancaman):** Penetrasi provider telekomunikasi nasional skala besar di jalur utama (dapat dimitigasi dengan fokus pada penetrasi pemukiman padat lokal).

---

## 6. SKEMA INVESTASI & ALOKASI PENGGUNAAN DANA

### 6.1 Kebutuhan Pendanaan
- **Total Investasi yang Dibutuhkan:** **Rp 20.000.000 (Dua Puluh Juta Rupiah)**

### 6.2 Rencana Alokasi Penggunaan Dana (Use of Funds)
```
                                 PENGGUNAAN DANA INVESTASI (RP 20 JUTA)
┌───────────────────────────────────────────────────────────┬──────────────────┬──────────────┐
│ Kategori Alokasi                                          │ Persentase (%)   │ Nominal (Rp) │
├───────────────────────────────────────────────────────────┼──────────────────┼──────────────┤
│ 1. Ekspansi Jaringan & Hardware (OLT Splitter, Fiber Optic│ 45%              │ Rp  9.000.000│
│    Core, Enclosure, Node ODP Baru)                        │                  │              │
│ 2. Pemasaran & Penetrasi Pasar (Ads, Banner, Spanduk, WA) │ 30%              │ Rp  6.000.000│
│ 3. Server High-Availability, Security SSL & Cadangan OPEX │ 25%              │ Rp  5.000.000│
├───────────────────────────────────────────────────────────┼──────────────────┼──────────────┤
│ TOTAL ALOKASI DANA                                        │ 100%             │ Rp 20.000.000│
└───────────────────────────────────────────────────────────┴──────────────────┴──────────────┘
```

---

## 7. PROYEKSI KEUANGAN 3 TAHUN (FINANCIAL PROJECTIONS)

Dengan suntikan modal sebesar **Rp 20.000.000**, bisnis diproyeksikan tumbuh pesat melalui penambahan kapasitas ODP baru dan pemasaran intensif:

```
                            PROYEKSI PERTUMBUHAN KEUANGAN (3 TAHUN)
┌───────────────────────────────┬───────────────────┬───────────────────┬───────────────────┐
│ Metrik Utama                  │ Tahun 1 (Target)  │ Tahun 2 (Target)  │ Tahun 3 (Target)  │
├───────────────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Pelanggan Aktif               │ 180 Pelanggan     │ 380 Pelanggan     │ 750 Pelanggan     │
│ Average Revenue Per User (ARPU│ Rp 160.000        │ Rp 160.000        │ Rp 165.000        │
│ Gross Revenue per Bulan (MRR) │ Rp 28.800.000     │ Rp 60.800.000     │ Rp 123.750.000    │
│ Gross Revenue per Tahun (ARR) │ Rp 345.600.000    │ Rp 729.600.000    │ Rp 1.485.000.000  │
│ Estimated OPEX & Bandwidth    │ Rp 172.800.000    │ Rp 350.208.000    │ Rp  668.250.000   │
│ NET PROFIT / TAHUN            │ Rp 172.800.000    │ Rp 379.392.000    │ Rp  816.750.000   │
│ Net Profit Margin             │ 50,0%             │ 52,0%             │ 55,0%             │
└───────────────────────────────┴───────────────────┴───────────────────┴───────────────────┘
```

---

## 8. NIKMATI POTENSI HASIL (SIMULASI RETURN ON INVESTMENT / ROI)

### 8.1 Skema Bagi Hasil (Revenue Sharing / Profit Sharing Option)
- **Porsi Bagi Hasil Investor:** 12% dari Net Profit bulanan sampai masa pengembalian selesai, atau skema kepemilikan dividen tetap.
- **Estimasi Profit Bersih Bulanan (Tahun 1 Rata-rata):** ~Rp 14.400.000 / bulan.
- **Bagian Investor (12% Net Profit):** ~Rp 1.728.000 / bulan.

### 8.2 Summary Pengembalian Investasi (Payback & ROI)
- **Payback Period (Impas Modal):** **± 5 Hingga 7 Bulan**
- **Total Pengembalian dalam 24 Bulan:** **Rp 41.472.000**
- **Net ROI:** **207%** dari total investasi awal Rp 20.000.000.

---

## 9. ANALISIS RISIKO & STRATEGI MITIGASI

| Identifikasi Risiko | Tingkat Risiko | Strategi Mitigasi |
| :--- | :--- | :--- |
| **Putus Kabel Fiber Optic (Vandalisme / Cuaca)** | Sedang | Penyediaan cadangan core kabel & tim teknisi respons cepat < 2 jam (terintegrasi *Ticket & GPS App*). |
| **Server Down / Database Corrupt** | Rendah | Auto-backup terenkripsi terjadwal harian ke cloud terpisah via `backupService.js`. |
| **Gagal Bayar Pelanggan (Default)** | Rendah | Fitur *Auto-Isolir MikroTik* pada H+1 tanggal jatuh tempo mencegah pemakaian tanpa bayar. |
| **Persaingan Harga Provider Lain** | Sedang | Menjaga kualitas SLA tinggi, promo prorata, serta bundling jaringan hotspot publik bagi warga sekitar. |

---

## 10. TIMELINE IMPLEMENTASI & MILESTONE (ROADMAP)

```
[Bulan 1] ───► Deployment Server High Performance & Pembelian Fiber Core / OLT Expansion
[Bulan 2] ───► Pemasangan 10 ODP Baru & Peluncuran Kampanye Pemasaran Lokal (Target: +40 Pelanggan)
[Bulan 3-5] ──► Akselerasi Penjualan & Pencapaian Target 140 Pelanggan (Payback Point Terlampaui)
[Bulan 6-12] ─► Ekspansi Fitur SaaS untuk Mitra ISP Sekitar & Target 180+ Pelanggan
```

---

## 11. PENUTUP & PROSEDUR KERJA SAMA

Aplikasi **MyAdamedia Billing** telah membuktikan kinerjanya secara operasional dan finansial dengan **80 pelanggan aktif** dan arus kas berjalan **Rp 12.895.000/bulan**. Investasi senilai **Rp 20.000.000** akan menjadi katalis utama untuk melipatgandakan kapasitas jaringan dan keuntungan bisnis secara terukur dan berkelanjutan.

Kami mengundang Anda untuk bergabung sebagai mitra strategis dalam peluang pertumbuhan ini.

**Langkah Selanjutnya:**
1. Pertemuan Diskusi & Demo Langsung Platform Admin/System.
2. Penandatanganan MoU / Perjanjian Investasi & Bagi Hasil.
3. Penyerahan Modal Kerja & Pelaksanaan Roadmap Ekspansi.

---

*Hormat Kami,*  
**Management & Engineering Team MyAdamedia**  
Contact: `admin@myadamedia.com` | Portal: `https://myadamedia.com`  
