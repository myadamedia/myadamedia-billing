# Implementation Plan: Preservasi Status Filter & Sort pada Halaman Tagihan (/admin/billing)

## 1. Analisis Masalah & Problem Statement
Administrator melaporkan bahwa saat menggunakan fitur filter (pencarian, bulan, tahun, status tagihan) dan/atau sort (pengurutan dropdown server-side maupun klik header kolom tabel client-side) di halaman Tagihan (`https://localhost:3001/admin/billing`), setiap kali administrator memilih atau mengeksekusi suatu aksi (misal: "Tandai Lunas", "Bayar Parsial", "Buat QRIS", "Kirim WA", "Isolir/Buka Isolir", "Hapus", "Bayar Massal", "Hapus Massal"), halaman me-refresh dan seluruh kondisi filter serta sorting kembali ke default.

### Akar Permasalahan Teknis (Root Causes):
1. **Helmet `Referrer-Policy: no-referrer`**:
   - `app-customer.js` menggunakan Helmet v8 dengan konfigurasi default yang menyetel header HTTP `Referrer-Policy: no-referrer`.
   - Akibatnya, saat form aksi melakukan POST ke server, browser **tidak menyertakan header `Referer`**.
2. **Ketergantungan Tunggal `safeRedirectBack`**:
   - Fungsi `safeRedirectBack` di `routes/adminPortal.js` membaca `req.get('referrer')`. Karena referer bernilai `undefined`, server selalu me-redirect ke fallback URL statis `/admin/billing` tanpa query parameter.
3. **Absennya `return_to` pada Seluruh Form Aksi**:
   - Tidak ada satu pun form aksi di `views/admin/billing.ejs` (`payForm`, `partialForm`, form inline tabel, `bulkDeleteForm`, dll.) yang mengirimkan state filter/sort atau query parameter aktif ke server.
4. **Hardcoded Fallback URL**:
   - Route `/customers/:id/isolate` dan `/unisolate` memiliki fallback URL ke `/admin/customers`, bukan `/admin/billing`.
   - Route `/billing/generate` me-redirect hanya dengan `month` dan `year`, membuang status, search, dan sort.
5. **Ketiadaan Persistence State (Session & Client-side Storage)**:
   - Server tidak menyimpan filter terakhir ke session pengguna (`req.session.billingFilter`).
   - Client-side header sort (`initTableSort`) hanya memanipulasi DOM sesaat tanpa menyimpan indeks kolom dan orientasi sort ke `localStorage` / `sessionStorage`.

---

## 2. Struktur Folder & Modul Terkait
```text
myadamedia-billing/
├── app-customer.js                       # [MODIFY] Konfigurasi Helmet: Referrer-Policy 'same-origin'
├── routes/
│   └── adminPortal.js                    # [MODIFY] Peningkatan safeRedirectBack (dukungan return_to), session memory filter pada /admin/billing
├── views/
│   └── admin/
│       └── billing.ejs                   # [MODIFY] Penambahan return_to pada semua form aksi, auto-submit month/year, & persistensi client-side sort
├── tests/
│   └── billingFilterSortPreserve.test.js # [NEW] Unit & integration test untuk verifikasi safeRedirectBack return_to & billing filter persistence
├── file md/
│   └── implementation_plan.md            # [MODIFY] Dokumen rencana implementasi ini
├── version.txt                           # [MODIFY] Bump versi ke 15.9.9
└── proses.md                             # [MODIFY] Dokumentasi riwayat perbaikan dan hasil pengujian
```

---

## 3. Desain Arsitektur & Logika Sistem

```text
+----------------------------------------------------------------------------------+
|                            Browser: /admin/billing                               |
|   (Filter aktif: ?status=unpaid&sort=amount_desc&month=11&year=2026&search=...)  |
+----------------------------------------------------------------------------------+
          |
          | 1. User melakukan aksi (Tandai Lunas / Parsial / QRIS / WA / Hapus / dll)
          |    Form aksi menyertakan:
          |    - input hidden: return_to = "/admin/billing?status=unpaid&sort=..."
          |    - HTTP Header Referer dikirim berkat Referrer-Policy: same-origin
          v
+----------------------------------------------------------------------------------+
|                      Server: Express POST Handler                                |
|   (routes/adminPortal.js: /admin/billing/:id/pay, pay-bulk, delete, etc.)       |
+----------------------------------------------------------------------------------+
          |
          | 2. Eksekusi logika bisnis pembayaran / manipulasi database
          | 3. Pemanggilan safeRedirectBack(req, res, '/admin/billing'):
          |    - Cek 1: req.body.return_to atau req.query.return_to (Prioritas Utama)
          |    - Cek 2: req.get('referrer') (Fallback Sekunder)
          |    - Cek 3: req.session.billingFilter (Fallback Tersimpan)
          |    - Cek 4: Fallback default URL
          v
+----------------------------------------------------------------------------------+
|                      Redirect ke URL Asli Bersama Query Params                    |
|   HTTP 302 Found -> /admin/billing?status=unpaid&sort=amount_desc&month=11...    |
+----------------------------------------------------------------------------------+
          |
          | 4. Halaman /admin/billing dimuat ulang:
          |    - Dropdown filter & server sort terisi sesuai query parameter
          |    - Jika ada client-side table sort di localStorage, urutkan ulang DOM
          v
+----------------------------------------------------------------------------------+
|             Hasil: Filter & Sort Tetap Berada di Posisi Terakhir!               |
+----------------------------------------------------------------------------------+
```

---

## 4. Langkah-Langkah Implementasi Lengkap

1. **Step 1: Konfigurasi Header Referrer-Policy di `app-customer.js`**:
   - Menambahkan opsi `referrerPolicy: { policy: 'same-origin' }` pada middleware `helmet()`.
2. **Step 2: Peningkatan Logika `safeRedirectBack` di `routes/adminPortal.js`**:
   - Mendukung parameter `return_to` dari `req.body` atau `req.query`.
   - Memvalidasi bahwa `return_to` aman (diawali dengan `/admin` dan tidak mengandung karakter injeksi external).
3. **Step 3: Manajemen Filter Session di `router.get('/billing', ...)`**:
   - Mendukung query parameter `reset=1` untuk menghapus filter session jika admin menekan tombol "Reset".
   - Menyimpan filter aktif (`month`, `year`, `status`, `sort`, `search`) ke `req.session.billingFilter`.
   - Mengisi filter dari `req.session.billingFilter` jika admin mengakses `/admin/billing` tanpa query params.
   - Mengirimkan `currentUrl` ke template `admin/billing`.
4. **Step 4: Integrasi Form Aksi di `views/admin/billing.ejs`**:
   - Menambahkan `<input type="hidden" name="return_to" class="return-to-input" value="<%= currentUrl %>">` pada:
     - Form `#payForm` (Tandai Lunas)
     - Form `#partialForm` (Bayar Parsial)
     - Form inline tabel: `qris-assign`, `qris-clear`, `unisolate`, `isolate`, `whatsapp`, `unpay`, `delete`
     - Form `#bulkDeleteForm` (Hapus Massal)
     - Form `#genModal` (Generate Tagihan)
   - Menambahkan script pelengkap dinamis agar saat form di-submit, nilai `return_to` selalu disinkronkan dengan `window.location.pathname + window.location.search`.
   - Menambahkan `onchange="this.form.submit()"` pada select `month` dan `year`.
   - Menyesuaikan tombol Reset menjadi `<a href="/admin/billing?reset=1" id="resetFilterBtn">`.
5. **Step 5: Persistensi Client-side Table Header Sort**:
   - Menyimpan `columnIndex` dan `isAsc` ke `localStorage.setItem('billing_table_sort', ...)` pada fungsi `initTableSort`.
   - Memulihkan dan mengaplikasikan sorting otomatis saat halaman dirender.
   - Menghapus `billing_table_sort` saat tombol Reset diklik.
6. **Step 6: Unit & Integration Testing**:
   - Membuat file pengujian baru `tests/billingFilterSortPreserve.test.js`.
   - Menguji sanitasi `safeRedirectBack`, preservasi filter, dan penanganan `reset=1`.

---

## 5. Rencana Pengujian (Test Plan)
1. **Unit Test Suite (`tests/billingFilterSortPreserve.test.js`)**:
   - Test 1: `safeRedirectBack` memprioritaskan `return_to` yang valid di atas referer.
   - Test 2: `safeRedirectBack` menolak `return_to` berbahaya (external protocol/domain) dan jatuh ke referer/fallback yang aman.
   - Test 3: Filter aktif tersimpan di `req.session.billingFilter`.
   - Test 4: Query parameter `reset=1` membersihkan `req.session.billingFilter`.
2. **Integration Verification**:
   - Jalankan `node ./node_modules/jest/bin/jest.js tests/billingFilterSortPreserve.test.js`.
   - Jalankan test suite anti-false alert yang sudah ada untuk memastikan tidak ada regresi sistem.
3. **Audit & Dokumentasi**:
   - Catat seluruh rincian perbaikan di `proses.md` sesuai SOP.
   - Perbarui versi sistem di `version.txt` menjadi `15.9.9`.
