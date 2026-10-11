const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const ejs = require('ejs');

// Mock dependencies jika diperlukan
jest.mock('axios');

const gdriveSvc = require('../services/googleDriveBackupService');
const backupSvc = require('../services/backupService');
const { getSetting, saveSettings } = require('../config/settingsManager');

describe('Multi-Cloud Automated Backup (Google Drive & Telegram) Test Suite', () => {
  let rsaPrivateKey;
  let rsaPublicKey;
  let dummyServiceAccount;

  beforeAll(() => {
    // Generate valid RSA keypair untuk pengujian RS256 JWT
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    rsaPrivateKey = keyPair.privateKey;
    rsaPublicKey = keyPair.publicKey;

    dummyServiceAccount = {
      type: 'service_account',
      project_id: 'test-project-multi-cloud',
      private_key_id: 'dummy-key-id-12345',
      private_key: rsaPrivateKey,
      client_email: 'backup-agent@test-project-multi-cloud.iam.gserviceaccount.com',
      client_id: '987654321'
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    gdriveSvc.resetTokenCache();
  });

  describe('1. Google Drive Service: Credential & Auth Logic', () => {
    test('parseServiceAccountKey should validate and parse valid JSON credentials', () => {
      const jsonStr = JSON.stringify(dummyServiceAccount);
      const parsed = gdriveSvc.parseServiceAccountKey(jsonStr);
      expect(parsed).not.toBeNull();
      expect(parsed.client_email).toBe(dummyServiceAccount.client_email);
      expect(parsed.private_key).toBe(dummyServiceAccount.private_key);

      // Objek langsung
      const objParsed = gdriveSvc.parseServiceAccountKey(dummyServiceAccount);
      expect(objParsed).toEqual(dummyServiceAccount);
    });

    test('parseServiceAccountKey should safely reject invalid or incomplete input', () => {
      expect(gdriveSvc.parseServiceAccountKey(null)).toBeNull();
      expect(gdriveSvc.parseServiceAccountKey('')).toBeNull();
      expect(gdriveSvc.parseServiceAccountKey('{ invalid json')).toBeNull();
      expect(gdriveSvc.parseServiceAccountKey('{"type":"service_account"}')).toBeNull(); // kurang private_key & email
    });

    test('createServiceAccountJwt should generate a 3-part RS256 JWT and verify with public key', () => {
      const jwt = gdriveSvc.createServiceAccountJwt(dummyServiceAccount);
      expect(typeof jwt).toBe('string');
      const parts = jwt.split('.');
      expect(parts.length).toBe(3);

      // Verifikasi signature JWT dengan Public Key RSA
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(`${parts[0]}.${parts[1]}`);
      const isValid = verifier.verify(rsaPublicKey, parts[2], 'base64url');
      expect(isValid).toBe(true);
    });

    test('getAccessToken should exchange RS256 assertion for access_token with caching', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          access_token: 'ya29.dummy_mock_access_token_123',
          expires_in: 3600,
          token_type: 'Bearer'
        }
      });

      const token1 = await gdriveSvc.getAccessToken({
        authType: 'service_account',
        serviceAccountJson: dummyServiceAccount
      });

      expect(token1).toBe('ya29.dummy_mock_access_token_123');
      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
    });

    test('getAccessToken should support OAuth2 refresh token exchange', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          access_token: 'ya29.oauth_token_refreshed_456',
          expires_in: 3600
        }
      });

      const token = await gdriveSvc.getAccessToken({
        authType: 'oauth',
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        refreshToken: 'test-refresh-token'
      });

      expect(token).toBe('ya29.oauth_token_refreshed_456');
      expect(axios.post).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.stringContaining('grant_type=refresh_token'),
        expect.any(Object)
      );
    });
  });

  describe('2. Google Drive Service: Operations & Mock API Calls', () => {
    test('testConnection should return account info and storage quota accurately', async () => {
      // Mock token call
      axios.post.mockResolvedValueOnce({
        data: { access_token: 'ya29.mock_token', expires_in: 3600 }
      });

      // Mock drive about call
      axios.get.mockResolvedValueOnce({
        data: {
          user: { displayName: 'Admin Backup Cloud', emailAddress: 'admin@myadamedia.web.id' },
          storageQuota: {
            limit: (15 * 1024 * 1024 * 1024).toString(), // 15 GB
            usage: (3 * 1024 * 1024 * 1024).toString()  // 3 GB
          }
        }
      });

      const res = await gdriveSvc.testConnection({
        authType: 'service_account',
        serviceAccountJson: dummyServiceAccount
      });

      expect(res.ok).toBe(true);
      expect(res.user).toBe('Admin Backup Cloud');
      expect(res.email).toBe('admin@myadamedia.web.id');
      expect(parseFloat(res.storage.usageMB)).toBeGreaterThan(0);
      expect(res.storage.percent).toBe(20);
    });

    test('uploadFile should multipart upload file to Google Drive v3', async () => {
      // Mock token call
      axios.post.mockResolvedValueOnce({
        data: { access_token: 'ya29.mock_token', expires_in: 3600 }
      });

      // Mock drive upload multipart call
      axios.post.mockResolvedValueOnce({
        data: {
          id: 'gdrive_file_id_999888',
          name: 'test_backup_sample.db',
          size: '1024',
          webViewLink: 'https://drive.google.com/file/d/gdrive_file_id_999888/view',
          createdTime: new Date().toISOString()
        }
      });

      // Create temporary dummy file for upload
      const tmpFile = path.join(__dirname, 'temp_test_backup.db');
      fs.writeFileSync(tmpFile, 'SQLite format 3\0mock-db-binary');

      const uploadResult = await gdriveSvc.uploadFile(tmpFile, {
        fileName: 'test_backup_sample.db',
        folderId: 'custom_folder_123',
        customConfig: {
          authType: 'service_account',
          serviceAccountJson: dummyServiceAccount
        }
      });

      // Cleanup
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.fileId).toBe('gdrive_file_id_999888');
      expect(uploadResult.name).toBe('test_backup_sample.db');
      expect(uploadResult.webViewLink).toContain('drive.google.com');
    });

    test('cleanupOldCloudBackups should delete files older than retention days', async () => {
      // Mock token call
      axios.post.mockResolvedValueOnce({
        data: { access_token: 'ya29.mock_token', expires_in: 3600 }
      });

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 hari lalu (harus dihapus)

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5); // 5 hari lalu (dipertahankan)

      // Mock list files
      axios.get.mockResolvedValueOnce({
        data: {
          files: [
            { id: 'file_old_1', name: 'billing_db_old.db', createdTime: oldDate.toISOString() },
            { id: 'file_new_2', name: 'billing_db_new.db', createdTime: recentDate.toISOString() }
          ]
        }
      });

      // Mock delete call
      axios.delete.mockResolvedValueOnce({ data: {} });

      const cleanupRes = await gdriveSvc.cleanupOldCloudBackups(30, {
        customConfig: {
          authType: 'service_account',
          serviceAccountJson: dummyServiceAccount
        }
      });
      expect(cleanupRes.success).toBe(true);
      expect(cleanupRes.deletedCount).toBe(1);
      expect(axios.delete).toHaveBeenCalledWith(
        expect.stringContaining('/files/file_old_1'),
        expect.any(Object)
      );
    });
  });

  describe('3. Multi-Cloud Orchestration: backupService.uploadBackupToCloud', () => {
    test('uploadBackupToCloud should handle Telegram and Google Drive simultaneously', async () => {
      // Mock token and upload for drive
      axios.post
        .mockResolvedValueOnce({ data: { access_token: 'ya29.token', expires_in: 3600 } })
        .mockResolvedValueOnce({
          data: {
            id: 'cloud_id_777',
            name: 'test_orchestrator.db',
            webViewLink: 'https://drive.google.com/file/d/cloud_id_777/view'
          }
        });

      // Create a temporary backup file
      const testDbPath = path.join(__dirname, '..', 'backups', 'test_cloud_orchestrator.db');
      fs.writeFileSync(testDbPath, 'dummy sqlite database contents');

      const res = await backupSvc.uploadBackupToCloud(testDbPath, 'both', {
        operator: 'Jest Test Runner',
        skipConfigCheck: true,
        customConfig: {
          authType: 'service_account',
          serviceAccountJson: dummyServiceAccount
        }
      });

      // Cleanup
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

      expect(res.fileName).toBe('test_cloud_orchestrator.db');
      expect(res.gdrive.attempted).toBe(true);
      expect(res.gdrive.success).toBe(true);
      expect(res.gdrive.fileId).toBe('cloud_id_777');
      expect(res.telegram.attempted).toBe(true);
    });
  });

  describe('4. Admin Portal Routes & Views Integration', () => {
    const ejsPath = path.join(__dirname, '..', 'views', 'admin', 'backup.ejs');
    const routesPath = path.join(__dirname, '..', 'routes', 'adminPortal.js');

    test('routes/adminPortal.js should register Multi-Cloud endpoints', () => {
      const routesContent = fs.readFileSync(routesPath, 'utf8');

      expect(routesContent).toContain("router.post('/backup/send-gdrive'");
      expect(routesContent).toContain("router.post('/backup/test-gdrive'");
      expect(routesContent).toContain("router.post('/backup/save-gdrive-settings'");
      expect(routesContent).toContain('googleDriveBackupService');
      expect(routesContent).toContain('isGoogleDriveConfigured');
      expect(routesContent).toContain('send_cloud');
    });

    test('views/admin/backup.ejs should render Multi-Cloud elements correctly', () => {
      const ejsContent = fs.readFileSync(ejsPath, 'utf8');

      // 1. Google Drive status card & modal button
      expect(ejsContent).toContain('Google Drive Cloud Backup:');
      expect(ejsContent).toContain('Konfigurasi Multi-Cloud');
      expect(ejsContent).toContain('cloudSettingsModal');

      // 2. Action buttons
      expect(ejsContent).toContain('action="/admin/backup/send-gdrive"');
      expect(ejsContent).toContain('title="Kirim file backup ini ke Google Drive"');
      expect(ejsContent).toContain('confirmSendGdrive');

      // 3. Test connection scripts
      expect(ejsContent).toContain('testGdriveFromModal');
      expect(ejsContent).toContain('testGdriveConnection');
      expect(ejsContent).toContain('/admin/backup/test-gdrive');

      // 4. Modal inputs
      expect(ejsContent).toContain('name="gdrive_service_account_json"');
      expect(ejsContent).toContain('name="backup_cloud_destination"');
      expect(ejsContent).toContain('name="gdrive_retention_days"');
    });

    test('views/admin/backup.ejs should compile with EJS template engine without syntax errors', () => {
      const template = fs.readFileSync(ejsPath, 'utf8');
      expect(() => {
        ejs.compile(template, { filename: ejsPath });
      }).not.toThrow();
    });
  });
});
