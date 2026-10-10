const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const activeDbPath = path.join(__dirname, '../database/billing.db');
const backupSourcePath = path.join(__dirname, '../backups/billing_db_20260913_014759.db');
const safetyBackupPath = path.join(__dirname, '../backups/billing_db_pre_restore_20261011.db');

console.log('1. Membuat backup pengaman dari database aktif saat ini...');
fs.copyFileSync(activeDbPath, safetyBackupPath);
console.log('Backup pengaman berhasil dibuat di:', safetyBackupPath);

const activeDb = new Database(activeDbPath);
const backupDb = new Database(backupSourcePath);

// Enable foreign keys off during batch restore
activeDb.pragma('foreign_keys = OFF');

const tablesToRestore = [
  'packages',
  'routers',
  'olts',
  'odps',
  'customers',
  'technicians',
  'invoices',
  'vouchers',
  'voucher_batches',
  'voucher_packages',
  'agents',
  'public_voucher_orders',
  'payroll_settings',
  'genieacs_servers',
  'acs_devices'
];

console.log('2. Memulai proses restore data...');

const restoreTransaction = activeDb.transaction(() => {
  for (const tableName of tablesToRestore) {
    const backupRows = backupDb.prepare(`SELECT * FROM ${tableName}`).all();
    console.log(`\nMemproses tabel: ${tableName} (${backupRows.length} baris dari backup)...`);

    if (backupRows.length === 0) {
      console.log(`  Skip: tabel ${tableName} kosong di backup.`);
      continue;
    }

    // Ambil kolom di active DB
    const activeCols = activeDb.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
    // Ambil kolom di backup DB
    const backupCols = Object.keys(backupRows[0]);
    // Kolom bersama
    const sharedCols = backupCols.filter(c => activeCols.includes(c));

    // Bersihkan tabel active sebelum restore untuk tabel-tabel ini
    activeDb.prepare(`DELETE FROM ${tableName}`).run();

    const placeholders = sharedCols.map(() => '?').join(', ');
    const colList = sharedCols.map(c => `"${c}"`).join(', ');
    const insertStmt = activeDb.prepare(`INSERT INTO ${tableName} (${colList}) VALUES (${placeholders})`);

    let insertedCount = 0;
    for (const row of backupRows) {
      const values = sharedCols.map(col => row[col]);
      insertStmt.run(values);
      insertedCount++;
    }

    console.log(`  Berhasil memulihkan ${insertedCount} baris ke tabel ${tableName}.`);
  }
});

restoreTransaction();

activeDb.pragma('foreign_keys = ON');

console.log('\n3. Verifikasi Jumlah Data Pasca-Restore:');
tablesToRestore.forEach(t => {
  const count = activeDb.prepare(`SELECT count(*) as c FROM ${t}`).get().c;
  console.log(`- ${t.padEnd(20)}: ${count} baris`);
});

const custWithCoords = activeDb.prepare("SELECT count(*) as c FROM customers WHERE lat IS NOT NULL AND lat != '' AND lng IS NOT NULL AND lng != ''").get().c;
const odpWithCoords = activeDb.prepare("SELECT count(*) as c FROM odps WHERE lat IS NOT NULL AND lat != '' AND lng IS NOT NULL AND lng != ''").get().c;
console.log(`- Pelanggan berkoordinat: ${custWithCoords} / 81`);
console.log(`- ODP berkoordinat      : ${odpWithCoords} / 22`);

activeDb.close();
backupDb.close();
console.log('\nRestore data selesai dengan SUKSES!');
