const backupSvc = require('../services/backupService');
const fs = require('fs');
const path = require('path');

describe('Backup & Recovery Service Unit Test', () => {
  test('should export listBackups, saveUploadedDatabase, getBackupFilePath', () => {
    expect(typeof backupSvc.listBackups).toBe('function');
    expect(typeof backupSvc.saveUploadedDatabase).toBe('function');
    expect(typeof backupSvc.getBackupFilePath).toBe('function');
  });

  test('should create a database backup successfully', () => {
    const res = backupSvc.backupDatabase();
    expect(res.success).toBe(true);
    expect(res.fileName).toMatch(/^billing_db_\d{8}_\d{6}\.db$/);
    expect(res.size).toBeGreaterThan(0);

    // Clean up created file
    const filePath = backupSvc.getBackupFilePath(res.fileName);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  test('should reject upload with invalid extension', () => {
    const dummyBuffer = Buffer.from('invalid content');
    const res = backupSvc.saveUploadedDatabase(dummyBuffer, 'malicious_script.exe');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Ekstensi file/i);
  });

  test('should save valid uploaded .db file to backups folder', () => {
    const dummyBuffer = Buffer.from('SQLite format 3\0test-database-content');
    const res = backupSvc.saveUploadedDatabase(dummyBuffer, 'my_external_backup.db');
    expect(res.success).toBe(true);
    expect(res.type).toBe('database');
    expect(res.fileName).toMatch(/^billing_db_uploaded_\d{8}_\d{6}\.db$/);

    const filePath = backupSvc.getBackupFilePath(res.fileName);
    expect(filePath).not.toBeNull();
    expect(fs.existsSync(filePath)).toBe(true);

    // Clean up
    fs.unlinkSync(filePath);
  });

  test('should prevent path traversal in getBackupFilePath', () => {
    const dangerousPath = '../../config/database.js';
    const filePath = backupSvc.getBackupFilePath(dangerousPath);
    expect(filePath).toBeNull();
  });
});
