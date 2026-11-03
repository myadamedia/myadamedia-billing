# Implementation Plan: Implementasi Tema Claymorphism 3D (Theme Selector Opsi 1)

## 1. Analisis Kebutuhan & Problem Statement
Pengguna menyetujui **Opsi 1**, yaitu menghadirkan tema **Claymorphism 3D** yang terintegrasi secara dinamis ke dalam sistem *theme switcher* aplikasi MyAdamedia Billing.
Dengan opsi ini:
- Administrator dan staf dapat beralih antara tema default (*Modern Glass Dark*), *Light Mode*, *Ocean Mode*, *Forest Mode*, dan **Claymorphism 3D** secara instan kapan saja melalui tombol palet di sidebar.
- Preferensi tema disimpan di `localStorage` dan cookie `app-theme`, sehingga otomatis aktif di seluruh halaman panel admin dan tidak berkedip saat halaman dimuat ulang (*Zero-FOUC*).

---

## 2. Struktur Folder & Modul Terkait
```text
myadamedia-billing/
├── public/
│   └── css/
│       └── admin.css                    # [MODIFY] Penambahan token CSS & styling lengkap .theme-clay
├── views/
│   └── admin/
│       └── partials/
│           └── sidebar.ejs              # [MODIFY] Integrasi opsi Claymorphism 3D ke themeMenu & pembersihan class di setTheme()
├── tests/
│   └── themeClaymorphism.test.js        # [NEW] Test suite verifikasi CSS variables, dual shadow, class tokens, & UI integration
├── file md/
│   └── implementation_plan.md           # [MODIFY] Rencana implementasi fitur tema Claymorphism
├── version.txt                          # [MODIFY] Bump versi ke 15.9.10
└── proses.md                            # [MODIFY] Dokumentasi riwayat perbaikan dan hasil implementasi
```

---

## 3. Desain Arsitektur & Spesifikasi Claymorphism 3D

```text
+------------------------------------------------------------------------------------+
|                               <html> Element                                       |
|                  class="theme-clay" (atau 'dark' / 'light' / etc)                  |
+------------------------------------------------------------------------------------+
       |
       +---> [Design Tokens & Variables: .theme-clay]
       |     --bg: #0e1626 (Atmospheric Deep Clay Canvas)
       |     --bg2: #182236 (Clay Puffy Surface)
       |     --bg3: #222f46 (Subtle Clay Layer)
       |     --border: rgba(255, 255, 255, 0.08)
       |     --clay-shadow-card: 0 14px 28px rgba(0,0,0,0.45), inset 2px 2px 4px rgba(255,255,255,0.12), inset -3px -3px 6px rgba(0,0,0,0.5)
       |     --clay-shadow-btn: 0 8px 18px rgba(0,0,0,0.3), inset 2px 2px 4px rgba(255,255,255,0.35), inset -2px -2px 4px rgba(0,0,0,0.4)
       |
       +---> [Komponen Visual Claymorphism]
       |     ├── Kartu & Stat Widgets (.card, .sc) -> Tebal, mengembang (border-radius: 24px)
       |     ├── Tombol Taktil (.btn-p, .btn-s, etc.) -> 3D pillowy dengan active pressed state
       |     ├── Filter Bar & Inputs (.filter-bar, .fc, .fs) -> Kontur cekung-cembung halus
       |     ├── Badges (.badge, .bs, .bd, etc.) -> Rounded capsule 3D
       |     └── Modal Dialog (.mo .mb) -> Elevasi tinggi (0 25px 60px) + volume lembut
```

---

## 4. Langkah-Langkah Implementasi Lengkap

1. **Step 1: Spesifikasi CSS Claymorphism di `public/css/admin.css`**:
   - Menambahkan ruleset `.theme-clay` yang mendefinisikan palet warna, dual-shadow (outset elevation + double inset highlight/depth), dan border-radius melengkung tebal.
   - Mengatur styling khusus untuk `.card`, `.sc` (Stat Cards), `.btn` (semua varian warna), `.badge`, `.sidebar`, `.topbar`, `.filter-bar`, input `.fc`, select `.fs`, dan modal dialog `.mo .mb`.
   - Mengoptimalkan performa rendering dengan hardware acceleration (`transform: translateZ(0)`).
2. **Step 2: Integrasi Theme Switcher di `views/admin/partials/sidebar.ejs`**:
   - Menambahkan opsi menu `<button onclick="setTheme('clay')">` pada kedua dropdown `#themeMenu` (mode sidebar lebar dan minimized).
   - Memperbarui fungsi `setTheme(theme)` agar menghapus class `theme-clay` saat beralih ke tema lain.
3. **Step 3: Unit & Integration Testing**:
   - Membuat file test baru `tests/themeClaymorphism.test.js`.
   - Menguji kelengkapan token CSS, format dual shadow, kelengkapan dropdown menu di template sidebar, dan logika penyimpanan storage.
4. **Step 4: Dokumentasi & Versi**:
   - Mencatat seluruh riwayat penambahan fitur di `proses.md`.
   - Menaikkan versi sistem di `version.txt` menjadi `15.9.10`.
