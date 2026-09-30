/**
 * mikrotikTerminalService.js
 * Service pengelola sesi SSH PTY interaktif dan jembatan WebSocket untuk MikroTik Web Terminal
 * Mendukung RouterOS v6 dan v7 dengan auto-resize, reconnection, dan proteksi kebocoran koneksi.
 */

const { Client } = require('ssh2');
const { WebSocketServer } = require('ws');
const { URL } = require('url');
const { logger } = require('../config/logger');
const mikrotikService = require('./mikrotikService');

/**
 * Inisialisasi WebSocket Server untuk Web Terminal MikroTik
 * @param {import('http').Server} server Instance HTTP server Node.js
 * @param {Function} sessionMiddleware Express session middleware untuk validasi autentikasi
 */
function setupMikrotikTerminalWs(server, sessionMiddleware) {
  const wss = new WebSocketServer({ noServer: true });

  // Tangani event HTTP Upgrade
  server.on('upgrade', (request, socket, head) => {
    try {
      const parsedUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const pathname = parsedUrl.pathname;

      // Format URL: /admin/ws/routers/:id/terminal
      const match = pathname.match(/^\/admin\/ws\/routers\/(\d+)\/terminal\/?$/);
      if (!match) {
        // Bukan route terminal, abaikan agar tidak mengganggu upgrade handler lain
        return;
      }

      const routerId = parseInt(match[1], 10);
      if (isNaN(routerId) || routerId <= 0) {
        socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }

      // Validasi sesi Express Admin
      sessionMiddleware(request, {}, () => {
        const session = request.session;
        if (!session || !session.admin) {
          logger.warn(`[WS Terminal] Percobaan akses tanpa autentikasi admin ke router #${routerId} dari ${request.socket.remoteAddress}`);
          socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
          socket.destroy();
          return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request, routerId);
        });
      });
    } catch (err) {
      logger.error('[WS Terminal] Error saat HTTP upgrade:', err.message);
      socket.write('HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n');
      socket.destroy();
    }
  });

  // Tangani koneksi WebSocket yang telah terautentikasi
  wss.on('connection', (ws, req, routerId) => {
    handleTerminalSession(ws, req, routerId);
  });

  logger.info('[WS Terminal] MikroTik Web Terminal WebSocket Server siap pada /admin/ws/routers/:id/terminal');
  return wss;
}

/**
 * Mengelola sesi terminal dua arah antara WebSocket (Xterm.js) dan SSH Client (MikroTik RouterOS)
 * @param {import('ws').WebSocket} ws
 * @param {import('http').IncomingMessage} req
 * @param {number} routerId
 */
function handleTerminalSession(ws, req, routerId) {
  let router = null;
  try {
    router = mikrotikService.getRouterById(routerId);
  } catch (e) {
    logger.error(`[WS Terminal] Gagal membaca data router #${routerId}: ${e.message}`);
  }

  if (!router) {
    if (ws.readyState === ws.OPEN) {
      ws.send(`\r\n\x1b[31;1m[Error] Router dengan ID #${routerId} tidak ditemukan di database.\x1b[0m\r\n`);
      ws.close();
    }
    return;
  }

  const sshPort = parseInt(router.ssh_port, 10) || 22;
  const adminUser = req.session && req.session.admin ? req.session.admin.username : 'admin';

  logger.info(`[WS Terminal] Admin "${adminUser}" membuka terminal ke MikroTik "${router.name}" (${router.host}:${sshPort})`);

  // Banner pembuka pada console terminal
  ws.send(
    `\r\n\x1b[36m==============================================================\x1b[0m\r\n` +
    `\x1b[1;32m [MyAdaMedia Web Terminal]\x1b[0m Menghubungkan ke MikroTik \x1b[1;37m${router.name}\x1b[0m\r\n` +
    ` Host: \x1b[33m${router.host}\x1b[0m | Port SSH: \x1b[33m${sshPort}\x1b[0m | User: \x1b[33m${router.user}\x1b[0m\r\n` +
    `\x1b[36m==============================================================\x1b[0m\r\n` +
    `\x1b[90mMemulai negosiasi sesi SSH interaktif (PTY)...\x1b[0m\r\n\r\n`
  );

  const sshClient = new Client();
  let sshStream = null;
  let isCleanedUp = false;

  // Pembersih sumber daya deterministik untuk mencegah zombie connection
  function cleanup() {
    if (isCleanedUp) return;
    isCleanedUp = true;

    if (sshStream) {
      try {
        sshStream.end();
      } catch (e) {}
      sshStream = null;
    }

    try {
      sshClient.end();
    } catch (e) {}
    try {
      sshClient.destroy();
    } catch (e) {}

    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
      try {
        ws.close();
      } catch (e) {}
    }

    logger.info(`[WS Terminal] Sesi terminal ke MikroTik "${router.name}" (#${routerId}) ditutup.`);
  }

  // Event SSH siap
  sshClient.on('ready', () => {
    // Request shell interaktif PTY dengan terminal type xterm-256color
    sshClient.shell(
      {
        term: 'xterm-256color',
        cols: 100,
        rows: 30
      },
      (err, stream) => {
        if (err) {
          logger.error(`[WS Terminal] Gagal membuka shell PTY di MikroTik #${routerId}: ${err.message}`);
          if (ws.readyState === ws.OPEN) {
            ws.send(`\r\n\x1b[31;1m[Error Shell] Gagal mengalokasikan interactive PTY: ${err.message}\x1b[0m\r\n`);
          }
          cleanup();
          return;
        }

        sshStream = stream;

        // MikroTik Output -> Browser Terminal (Xterm.js)
        stream.on('data', (data) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(data.toString('utf-8'));
          }
        });

        stream.stderr.on('data', (data) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(data.toString('utf-8'));
          }
        });

        stream.on('close', () => {
          if (ws.readyState === ws.OPEN) {
            ws.send(`\r\n\x1b[33m[Koneksi SSH ditutup oleh Router MikroTik]\x1b[0m\r\n`);
          }
          cleanup();
        });

        // Browser Terminal (Keystrokes / Resize) -> MikroTik Input
        ws.on('message', (msg) => {
          if (!sshStream || !sshStream.writable) return;

          // Periksa apakah pesan berupa kontrol JSON (misal event window resize)
          if (typeof msg === 'string' || Buffer.isBuffer(msg)) {
            const rawStr = msg.toString('utf-8');
            if (rawStr.startsWith('{') && rawStr.endsWith('}')) {
              try {
                const parsed = JSON.parse(rawStr);
                if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
                  if (sshStream.setWindow) {
                    sshStream.setWindow(parsed.rows, parsed.cols, 0, 0);
                  }
                  return;
                }
                if (parsed.type === 'ping') {
                  if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({ type: 'pong' }));
                  }
                  return;
                }
              } catch (e) {
                // Bukan JSON terstruktur, teruskan sebagai input raw
              }
            }

            // Teruskan keystroke pengguna langsung ke SSH stream
            sshStream.write(msg);
          }
        });
      }
    );
  });

  // Tangani keyboard-interactive authentication jika diminta oleh RouterOS
  sshClient.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
    finish([router.password]);
  });

  // Tangani error koneksi SSH
  sshClient.on('error', (err) => {
    logger.error(`[WS Terminal] Error koneksi SSH ke router #${routerId} (${router.host}:${sshPort}): ${err.message}`);
    if (ws.readyState === ws.OPEN) {
      ws.send(
        `\r\n\x1b[31;1m[Koneksi SSH Gagal]\x1b[0m ${err.message}\r\n` +
        `\x1b[33mSolusi & Pemeriksaan:\x1b[0m\r\n` +
        ` 1. Pastikan service SSH di MikroTik aktif (\x1b[36m/ip service enable ssh\x1b[0m di Winbox/Console).\r\n` +
        ` 2. Pastikan IP Host (\x1b[36m${router.host}\x1b[0m) dan Port SSH (\x1b[36m${sshPort}\x1b[0m) sesuai serta firewall tidak memblokir.\r\n` +
        ` 3. Pastikan username (\x1b[36m${router.user}\x1b[0m) dan password sesuai.\r\n\r\n`
      );
    }
    cleanup();
  });

  sshClient.on('close', () => {
    cleanup();
  });

  // Tangani pemutusan WebSocket dari sisi browser
  ws.on('close', () => {
    cleanup();
  });

  ws.on('error', (err) => {
    logger.warn(`[WS Terminal] WebSocket error pada router #${routerId}: ${err.message}`);
    cleanup();
  });

  // Lakukan inisialisasi koneksi SSH dengan konfigurasi cipher luas (RouterOS v6 & v7)
  try {
    sshClient.connect({
      host: router.host,
      port: sshPort,
      username: router.user,
      password: router.password,
      readyTimeout: 15000,
      keepaliveInterval: 10000,
      tryKeyboard: true,
      algorithms: {
        serverHostKey: [
          'ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384',
          'ecdsa-sha2-nistp521', 'rsa-sha2-512', 'rsa-sha2-256', 'ssh-ed25519'
        ],
        kex: [
          'diffie-hellman-group1-sha1', 'diffie-hellman-group14-sha1',
          'diffie-hellman-group-exchange-sha1', 'diffie-hellman-group-exchange-sha256',
          'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521',
          'curve25519-sha256', 'curve25519-sha256@libssh.org'
        ],
        cipher: [
          'aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-gcm', 'aes128-gcm@openssh.com',
          'aes256-gcm', 'aes256-gcm@openssh.com', 'aes256-cbc', 'aes192-cbc', 'aes128-cbc',
          '3des-cbc'
        ]
      },
      hostVerifier: () => true
    });
  } catch (err) {
    logger.error(`[WS Terminal] Exception saat sshClient.connect ke router #${routerId}: ${err.message}`);
    if (ws.readyState === ws.OPEN) {
      ws.send(`\r\n\x1b[31;1m[Inisialisasi Gagal] ${err.message}\x1b[0m\r\n`);
    }
    cleanup();
  }
}

module.exports = {
  setupMikrotikTerminalWs,
  handleTerminalSession
};
