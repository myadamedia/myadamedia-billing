const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { logger } = require('../config/logger');

// Project root directory
const projectRoot = path.join(__dirname, '..');

// Gateway Directories & Entrypoints
const wahaDir = path.join(projectRoot, 'waha');
const wahaEntryPoint = path.join(wahaDir, 'dist', 'main.js');

const evolutionApiDir = path.join(projectRoot, 'evolution-api');
const evolutionEntryPoint = path.join(evolutionApiDir, 'dist', 'src', 'main.js');

// Global tracking variables (share same variable for running process)
global.evolutionApiProcess = global.evolutionApiProcess || null;
let isExitRegistered = false;

/**
 * WhatsApp Gateway Runner
 * Manages the lifecycle of a self-hosted WAHA or Evolution API instance running as a background child process.
 */
class WhatsAppGatewayRunner {
  /**
   * Determine the active gateway type based on directory presence
   * @returns {string|null} 'waha', 'evolution', or null
   */
  static getActiveGatewayType() {
    if (fs.existsSync(wahaDir)) {
      return 'waha';
    }
    if (fs.existsSync(evolutionApiDir)) {
      return 'evolution';
    }
    return null;
  }

  /**
   * Check if any supported gateway is installed
   * @returns {boolean} true if folder exists
   */
  static isInstalled() {
    return this.getActiveGatewayType() !== null;
  }

  /**
   * Check if the active gateway is compiled
   * @returns {boolean} true if entrypoint file exists
   */
  static isCompiled() {
    const type = this.getActiveGatewayType();
    if (type === 'waha') {
      return fs.existsSync(wahaEntryPoint);
    }
    if (type === 'evolution') {
      return fs.existsSync(evolutionEntryPoint);
    }
    return false;
  }

  /**
   * Start the active WhatsApp Gateway child process
   * @param {object} gatewayConfig - Configuration { url, apiKey }
   * @returns {boolean} success status of spawning
   */
  static start(gatewayConfig) {
    const type = this.getActiveGatewayType();

    if (!type) {
      logger.info('[WA Runner] Folder waha atau evolution-api tidak ditemukan di root proyek. Lewati auto-start.');
      return false;
    }

    if (!this.isCompiled()) {
      if (type === 'waha') {
        logger.warn('[WA Runner] Folder waha ditemukan, tetapi berkas dist/main.js tidak ditemukan.');
        logger.warn('[WA Runner] Silakan jalankan "npm run build" di dalam folder waha terlebih dahulu.');
      } else {
        logger.warn('[WA Runner] Folder evolution-api ditemukan, tetapi berkas dist/src/main.js tidak ditemukan.');
        logger.warn('[WA Runner] Silakan jalankan "npm run build" di dalam folder evolution-api terlebih dahulu.');
      }
      return false;
    }

    if (global.evolutionApiProcess) {
      logger.info('[WA Runner] Proses WhatsApp Gateway sudah berjalan. Mengabaikan perintah start.');
      return true;
    }

    try {
      // Parse Port from URL, default based on type
      let defaultPort = type === 'waha' ? 3000 : 8080;
      let port = defaultPort;
      if (gatewayConfig.url) {
        const match = gatewayConfig.url.match(/:(\d+)/);
        if (match && match[1]) {
          port = parseInt(match[1], 10);
        }
      }

      // Configure environment variables based on active gateway
      let env = { ...process.env };
      let workingDir = '';
      let entryPoint = '';
      let displayName = '';

      if (type === 'waha') {
        workingDir = wahaDir;
        entryPoint = wahaEntryPoint;
        displayName = 'WAHA (WEBJS)';
        env = {
          ...env,
          PORT: String(port),
          WHATSAPP_API_KEY: gatewayConfig.apiKey || '',
          WAHA_API_KEY: gatewayConfig.apiKey || '',
          WAHA_SECURITY_API_KEY: gatewayConfig.apiKey || '',
          WHATSAPP_DEFAULT_ENGINE: 'WEBJS' // Anti-ban browser-based engine!
        };
      } else {
        workingDir = evolutionApiDir;
        entryPoint = evolutionEntryPoint;
        displayName = 'Evolution API';
        env = {
          ...env,
          PORT: String(port),
          SERVER_PORT: String(port),
          SERVER_URL: gatewayConfig.url || `http://localhost:${port}`,
          AUTH_API_KEY: gatewayConfig.apiKey || '',
          AUTHENTICATION_API_KEY: gatewayConfig.apiKey || '',
          DATABASE_ENABLED: 'true'
        };
      }

      logger.info(`[WA Runner] Memulai ${displayName} pada port ${port}...`);

      // Spawn Node.js child process
      const child = spawn('node', [entryPoint], {
        cwd: workingDir,
        env,
        shell: true // Important for running shell execution properly on Windows
      });

      global.evolutionApiProcess = child;

      // Pipe stdout logs
      child.stdout.on('data', (data) => {
        const text = String(data).trim();
        if (text) {
          logger.info(`[${displayName}] ${text}`);
        }
      });

      // Pipe stderr logs
      child.stderr.on('data', (data) => {
        const text = String(data).trim();
        if (text) {
          logger.error(`[${displayName} Error] ${text}`);
        }
      });

      // Handle unexpected child process termination
      child.on('close', (code) => {
        logger.warn(`[WA Runner] Proses ${displayName} berhenti dengan kode keluar ${code}`);
        global.evolutionApiProcess = null;
      });

      child.on('error', (err) => {
        logger.error(`[WA Runner] Gagal memulai proses ${displayName}: ${err.message}`);
        global.evolutionApiProcess = null;
      });

      // Register exit handlers to prevent zombie processes
      this.registerExitHandlers();

      return true;
    } catch (error) {
      logger.error(`[WA Runner] Exception saat men-spawn WhatsApp Gateway: ${error.message}`);
      global.evolutionApiProcess = null;
      return false;
    }
  }

  /**
   * Stop the running WhatsApp Gateway child process
   * @returns {boolean} true if killed
   */
  static stop() {
    if (!global.evolutionApiProcess) {
      return false;
    }

    try {
      logger.info('[WA Runner] Menghentikan proses WhatsApp Gateway latar belakang...');
      
      // Terminate process tree cleanly
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', global.evolutionApiProcess.pid, '/f', '/t']);
      } else {
        global.evolutionApiProcess.kill('SIGTERM');
      }

      global.evolutionApiProcess = null;
      return true;
    } catch (e) {
      logger.error(`[WA Runner] Gagal menghentikan proses WhatsApp Gateway: ${e.message}`);
      return false;
    }
  }

  /**
   * Register signal and exit handlers on the main process to terminate the child process
   */
  static registerExitHandlers() {
    if (isExitRegistered) return;
    isExitRegistered = true;

    const killSubprocess = () => {
      if (global.evolutionApiProcess) {
        try {
          // Sync kill to guarantee execution before parent exits
          if (process.platform === 'win32') {
            const { execSync } = require('child_process');
            execSync(`taskkill /pid ${global.evolutionApiProcess.pid} /f /t`, { stdio: 'ignore' });
          } else {
            global.evolutionApiProcess.kill('SIGKILL');
          }
        } catch (e) {
          // Suppress error as parent process is shutting down anyway
        }
        global.evolutionApiProcess = null;
      }
    };

    // Main process exit events
    process.on('exit', killSubprocess);
    process.on('SIGINT', () => {
      killSubprocess();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      killSubprocess();
      process.exit(0);
    });
    process.on('uncaughtException', (err) => {
      logger.error(`[Fatal Exception] Aplikasi crash: ${err.message}`);
      killSubprocess();
      process.exit(1);
    });
  }
}

module.exports = WhatsAppGatewayRunner;
