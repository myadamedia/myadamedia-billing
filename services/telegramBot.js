let TelegramBot = require('node-telegram-bot-api');
if (TelegramBot && typeof TelegramBot !== 'function') {
  TelegramBot = TelegramBot.TelegramBot || TelegramBot.default;
}
const db = require('../config/database');
const { getSetting, getNowLocal, getCurrentTimeInfo } = require('../config/settingsManager');
const { logger } = require('../config/logger');
const customerSvc = require('./customerService');
const billingSvc = require('./billingService');
const mikrotikSvc = require('./mikrotikService');

let bot = null;
const userStates = {};

function initTelegram() {
  const enabled = getSetting('telegram_enabled', false);
  const token = getSetting('telegram_bot_token', '');

  if (!enabled || !token) {
    if (bot) {
      bot.stopPolling();
      bot = null;
      logger.info('Telegram Bot: Dihentikan (Nonaktif)');
    }
    return;
  }

  // Jika token berubah, kita harus stop bot lama dan buat baru
  if (bot && bot.token !== token) {
    bot.stopPolling();
    bot = null;
    logger.info('Telegram Bot: Token berubah, me-restart bot...');
  }

  if (bot) {
    logger.info('Telegram Bot: Sudah berjalan, melewati inisialisasi.');
    return; 
  }

  bot = new TelegramBot(token, { polling: true });
  
  // Clear webhook to ensure polling works (Sync)
  bot.deleteWebHook().then(() => {
    bot.getMe().then(me => {
      logger.info(`Telegram Bot: Terhubung sebagai @${me.username}`);
    }).catch(e => logger.error('Telegram Bot Error (getMe):', e.message));
  }).catch(e => logger.error('Telegram Bot Error (deleteWebHook):', e.message));

  // Middleware Admin Check (Fetch latest ID every time)
  const isAdmin = (msg) => {
    const currentAdminId = getSetting('telegram_admin_id', '').toString();
    return msg.from.id.toString() === currentAdminId;
  };

  // Helper Mikhmon Parser
  const parseMikhmon = (script) => {
    if (!script) return null;
    const s = String(script).trim();
    
    // Cari pattern :put (",rem, ... , ... , ...
    // Updated regex untuk support format: :put (",rem,4000,2d,5000,,Disable,");
    const putMatch = s.match(/:\s*put\s*\(\s*[",]rem[",]?\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)/i);
    if (putMatch) {
      const cost = String(putMatch[1] || '').trim();
      const validity = String(putMatch[2] || '').trim();
      const priceStr = String(putMatch[3] || '').trim();
      const price = Number(priceStr.replace(/[^\d]/g, '')) || 0;
      
      if (validity && price > 0) {
        return { validity, price, cost: Number(cost.replace(/[^\d]/g, '')) || 0 };
      }
    }
    
    // Fallback: split by comma
    const parts = s.split(',').map(p => String(p).trim());
    let remIdx = -1;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].includes('rem')) {
        remIdx = i;
        break;
      }
    }
    
    if (remIdx >= 0 && remIdx + 3 < parts.length) {
      const cost = String(parts[remIdx + 1] || '').trim();
      const validity = String(parts[remIdx + 2] || '').trim();
      const priceStr = String(parts[remIdx + 3] || '').trim();
      const price = Number(priceStr.replace(/[^\d]/g, '')) || 0;
      
      if (validity && price > 0) {
        return { validity, price, cost: Number(cost.replace(/[^\d]/g, '')) || 0 };
      }
    }
    
    return null;
  };

  const isTruthy = (value) => {
    if (value === true || value === 1) return true;
    const normalized = String(value == null ? '' : value).trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1' || normalized === 'on';
  };

  const formatGangguanCount = (scriptRow) => {
    const raw = scriptRow && scriptRow.source != null ? String(scriptRow.source) : '0';
    const count = parseInt(raw.replace(/[^\d-]/g, ''), 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
  };

  const loadPppoeSnapshot = async () => {
    const [secrets, active, scripts] = await Promise.all([
      mikrotikSvc.getPppoeSecrets(),
      mikrotikSvc.getPppoeActive(),
      mikrotikSvc.getSystemScripts()
    ]);
    const customers = customerSvc.getAllCustomers();

    const activeMap = new Map();
    (active || []).forEach((row) => {
      const name = String(row && row.name ? row.name : '').trim();
      if (name) activeMap.set(name, row);
    });

    const scriptMap = new Map();
    (scripts || []).forEach((row) => {
      const name = String(row && row.name ? row.name : '').trim();
      if (name) scriptMap.set(name, row);
    });

    const customerMap = new Map();
    (customers || []).forEach((row) => {
      const username = String(row && row.pppoe_username ? row.pppoe_username : '').trim();
      if (username) customerMap.set(username, row);
    });

    return {
      secrets: Array.isArray(secrets) ? secrets : [],
      active: Array.isArray(active) ? active : [],
      activeMap,
      scriptMap,
      customerMap
    };
  };

  const buildOfflineEntries = (snapshot) => {
    return snapshot.secrets
      .filter((secret) => {
        const username = String(secret && secret.name ? secret.name : '').trim();
        if (!username) return false;
        if (isTruthy(secret && secret.disabled)) return false;
        return !snapshot.activeMap.has(username);
      })
      .map((secret) => {
        const username = String(secret.name || '').trim();
        const customer = snapshot.customerMap.get(username) || null;
        const script = snapshot.scriptMap.get(username) || null;
        return {
          username,
          customerName: customer && customer.name ? customer.name : '-',
          phone: customer && customer.phone ? customer.phone : '-',
          profile: secret && secret.profile ? secret.profile : '-',
          service: secret && secret.service ? secret.service : '-',
          password: secret && secret.password ? secret.password : '-',
          failCount: formatGangguanCount(script)
        };
      })
      .sort((a, b) => {
        if (b.failCount !== a.failCount) return b.failCount - a.failCount;
        return a.username.localeCompare(b.username, 'id');
      });
  };

  const buildOfflineTelegramText = (snapshot) => {
    const now = getNowLocal();
    const offline = buildOfflineEntries(snapshot);
    const lines = [];
    lines.push('USER PPPoE OFFLINE');
    lines.push('============================');
    lines.push(`Waktu : ${now}`);
    lines.push('============================');
    lines.push('');
    lines.push('RINGKASAN');
    lines.push(`Total Secret : ${snapshot.secrets.length}`);
    lines.push(`Total Aktif  : ${snapshot.active.length}`);
    lines.push(`Total Offline: ${offline.length}`);
    lines.push('');
    lines.push('DAFTAR USER OFFLINE');

    if (offline.length === 0) {
      lines.push('Semua user sedang online.');
    } else {
      offline.slice(0, 20).forEach((row, index) => {
        lines.push(`${index + 1}. ${row.username}`);
        lines.push(`   Pelanggan : ${row.customerName}`);
        lines.push(`   WA        : ${row.phone}`);
        lines.push(`   Paket     : ${row.profile}`);
        lines.push(`   Gangguan  : ${row.failCount}x`);
      });
      if (offline.length > 20) {
        lines.push(`...dan ${offline.length - 20} user offline lainnya.`);
      }
    }

    lines.push('');
    lines.push('Cek detail 1 user: /cekpppoe username');
    lines.push('Contoh: /cekpppoe budi001');
    return lines.join('\n');
  };

  const buildPppoeUserDetailText = async (username) => {
    const target = String(username || '').trim();
    if (!target) throw new Error('Username PPPoE wajib diisi');

    const snapshot = await loadPppoeSnapshot();
    const secret = snapshot.secrets.find((row) => String(row && row.name ? row.name : '').trim() === target);
    if (!secret) {
      throw new Error(`PPPoE user "${target}" tidak ditemukan`);
    }

    const activeRow = snapshot.activeMap.get(target) || null;
    const customer = snapshot.customerMap.get(target) || null;
    const script = snapshot.scriptMap.get(target) || null;
    const offline = buildOfflineEntries(snapshot);

    const date = getNowLocal();
    const online = !!activeRow;
    const lines = [];
    lines.push('DETAIL CEK PPPoE');
    lines.push('============================');
    lines.push(`Waktu     : ${date}`);
    lines.push(`Status    : ${online ? 'ONLINE' : 'OFFLINE'}`);
    lines.push('============================');
    lines.push('INFO LAYANAN');
    lines.push(`Pelanggan : ${customer && customer.name ? customer.name : '-'}`);
    lines.push(`No. WA    : ${customer && customer.phone ? customer.phone : '-'}`);
    lines.push(`Username  : ${secret.name || '-'}`);
    lines.push(`Password  : ${secret.password || '-'}`);
    lines.push(`Service   : ${secret.service || '-'}`);
    lines.push(`Profile   : ${secret.profile || '-'}`);
    lines.push('');
    lines.push('INFO PERANGKAT');
    lines.push(`IP Aktif   : ${activeRow && activeRow.address ? activeRow.address : '-'}`);
    lines.push(`MAC/Caller : ${activeRow && (activeRow.callerId || activeRow['caller-id']) ? (activeRow.callerId || activeRow['caller-id']) : '-'}`);
    lines.push('');
    lines.push('STATUS GANGGUAN');
    lines.push(`Jumlah Gangguan : ${formatGangguanCount(script)}x Terputus`);
    lines.push(`Total Secret    : ${snapshot.secrets.length}`);
    lines.push(`Total Active    : ${snapshot.active.length}`);
    lines.push(`Total Offline   : ${offline.length}`);

    if (!online && offline.length) {
      lines.push('');
      lines.push('User Offline Lain');
      offline.slice(0, 10).forEach((row) => {
        lines.push(`- ${row.username} (${row.failCount}x)`);
      });
      if (offline.length > 10) lines.push(`...dan ${offline.length - 10} lainnya.`);
    }

    return lines.join('\n');
  };

  const parseNominal = (raw) => {
    if (!raw) return 0;
    let s = String(raw).trim().toLowerCase().replace(/rp\.?\s*/g, '');
    if (s.endsWith('k')) {
      const num = parseFloat(s.replace('k', '').replace(',', '.'));
      return Math.round(num * 1000);
    }
    if (s.endsWith('rb') || s.endsWith('ribu')) {
      const num = parseFloat(s.replace(/rb|ribu/g, '').replace(',', '.'));
      return Math.round(num * 1000);
    }
    if (s.endsWith('jt') || s.endsWith('juta')) {
      const num = parseFloat(s.replace(/jt|juta/g, '').replace(',', '.'));
      return Math.round(num * 1000000);
    }
    const cleaned = s.replace(/[^\d]/g, '');
    return parseInt(cleaned, 10) || 0;
  };

  const saveExpenseFromTelegram = (msg, inputStr, preselectedCategory = null) => {
    try {
      const trimmed = String(inputStr || '').trim();
      if (!trimmed) {
        return { ok: false, error: 'Nominal & keterangan wajib diisi. Contoh: `50000 Beli bensin` atau `50k Utilitas Bayar listrik`' };
      }

      const parts = trimmed.split(/\s+/);
      const nominalRaw = parts[0];
      const amount = parseNominal(nominalRaw);

      if (!amount || amount <= 0) {
        return { ok: false, error: 'Nominal pengeluaran tidak valid. Contoh: `50000` atau `50k`' };
      }

      let category = preselectedCategory;
      let description = '';

      const categoriesInDb = db.prepare('SELECT name FROM expense_categories WHERE is_active = 1').all();
      const catNames = categoriesInDb.map(c => c.name);

      if (preselectedCategory) {
        description = parts.slice(1).join(' ').trim();
        if (!description) {
          description = parts[0];
        }
      } else {
        const secondToken = parts[1] || '';
        const matchedCat = catNames.find(c => c.toLowerCase() === secondToken.toLowerCase());

        if (matchedCat) {
          category = matchedCat;
          description = parts.slice(2).join(' ').trim();
        } else {
          category = 'Operasional';
          description = parts.slice(1).join(' ').trim();
        }
      }

      if (!description) {
        description = `Pengeluaran ${category}`;
      }

      const info = getCurrentTimeInfo();
      const pad = (n) => String(n).padStart(2, '0');
      const dateStr = `${info.year}-${pad(info.month)}-${pad(info.day)}`;
      const recordedBy = msg.from ? (msg.from.first_name || msg.from.username || 'Admin') : 'Admin';
      const recordedByName = `Telegram (${recordedBy})`;

      const stmt = db.prepare(`
        INSERT INTO expenses (date, category, amount, description, payment_method, recorded_by_role, recorded_by_name)
        VALUES (?, ?, ?, ?, 'cash', 'telegram', ?)
      `);
      const result = stmt.run(dateStr, category, amount, description, recordedByName);

      const formattedAmount = amount.toLocaleString('id-ID');
      const displayDate = `${pad(info.day)}/${pad(info.month)}/${info.year}`;

      let text = `✅ *PENGELUARAN BERHASIL DICATAT*\n\n`;
      text += `🆔 ID Catatan : \`#${result.lastInsertRowid}\`\n`;
      text += `📅 Tanggal    : ${displayDate}\n`;
      text += `💰 Nominal    : *Rp ${formattedAmount}*\n`;
      text += `🏷️ Kategori   : ${category}\n`;
      text += `📝 Keterangan : ${description}\n`;
      text += `👤 Dicatat    : ${recordedByName}`;

      return { ok: true, message: text };
    } catch (e) {
      logger.error('Error saving expense from Telegram:', e.message);
      return { ok: false, error: 'Gagal menyimpan pengeluaran: ' + e.message };
    }
  };

  const buildExpenseSummaryText = () => {
    const info = getCurrentTimeInfo();
    const pad = (n) => String(n).padStart(2, '0');
    const monthStr = `${info.year}-${pad(info.month)}`;

    const totalRow = db.prepare('SELECT SUM(amount) as total, COUNT(*) as count FROM expenses WHERE date LIKE ?').get(`${monthStr}%`);
    const monthTotal = totalRow ? (Number(totalRow.total) || 0) : 0;
    const monthCount = totalRow ? (Number(totalRow.count) || 0) : 0;

    const catRows = db.prepare(`
      SELECT category, SUM(amount) as total, COUNT(*) as count 
      FROM expenses 
      WHERE date LIKE ? 
      GROUP BY category 
      ORDER BY total DESC
    `).all(`${monthStr}%`);

    let txt = `*💸 REKAP PENGELUARAN BULAN INI (${pad(info.month)}/${info.year})*\n`;
    txt += `============================\n`;
    txt += `💰 Total Pengeluaran : *Rp ${monthTotal.toLocaleString('id-ID')}*\n`;
    txt += `🧾 Total Transaksi   : ${monthCount} transaksi\n`;
    txt += `============================\n\n`;
    txt += `*RINCIAN PER KATEGORI:*\n`;

    if (catRows.length === 0) {
      txt += `_Belum ada pengeluaran dicatat bulan ini._\n`;
    } else {
      catRows.forEach(c => {
        const amt = Number(c.total || 0).toLocaleString('id-ID');
        txt += `• *${c.category}*: Rp ${amt} (${c.count}x)\n`;
      });
    }

    return txt;
  };

  const buildRecentExpensesText = (limit = 10) => {
    const rows = db.prepare(`
      SELECT * FROM expenses ORDER BY date DESC, id DESC LIMIT ?
    `).all(limit);

    if (rows.length === 0) {
      return `💸 *RIWAYAT PENGELUARAN*\n\nBelum ada pengeluaran dicatat.`;
    }

    let txt = `*📜 ${rows.length} PENGELUARAN TERAKHIR*\n\n`;
    rows.forEach(r => {
      const amt = Number(r.amount || 0).toLocaleString('id-ID');
      txt += `• *#${r.id}* [${r.date}] - *Rp ${amt}*\n`;
      txt += `  └ 🏷️ ${r.category} | 📝 ${r.description}\n`;
    });

    return txt;
  };

  // Main Menu (Inline Keyboard for better visibility)
  const mainMenu = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 Statistik', callback_data: 'menu_stats' }, { text: '👥 Pelanggan', callback_data: 'menu_cust' }],
        [{ text: '🎫 Voucher', callback_data: 'menu_vouch' }, { text: '💰 Tagihan', callback_data: 'menu_bill' }],
        [{ text: '💸 Pengeluaran', callback_data: 'menu_expense' }, { text: '⚙️ MikroTik Status', callback_data: 'menu_mt' }],
        [{ text: '🔄 Refresh', callback_data: 'menu_main' }]
      ]
    }
  };

  bot.onText(/\/start|\/menu/i, (msg) => {
    if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, `Maaf, Anda tidak memiliki akses admin.\nChat ID Anda: ${msg.from.id}`);
    bot.sendMessage(msg.chat.id, '🏠 *PANEL ADMIN RTRW-NET*\nSilakan pilih menu di bawah ini:', { parse_mode: 'Markdown', ...mainMenu });
  });

  bot.on('message', async (msg) => {
    if (!isAdmin(msg)) return;
    const text = msg.text ? msg.text.trim() : '';
    if (!text) return;
    if (text === '/start' || text === '/menu') return; // Handled by onText
    
    // Handle user state if waiting for expense input
    const chatId = msg.chat.id;
    if (userStates[chatId] && userStates[chatId].action === 'awaiting_expense_input') {
      if (text.toLowerCase() === '/batal' || text.toLowerCase() === '/cancel') {
        delete userStates[chatId];
        return bot.sendMessage(chatId, '❌ Pencatatan pengeluaran dibatalkan.');
      }

      const category = userStates[chatId].category;
      delete userStates[chatId];

      const result = saveExpenseFromTelegram(msg, text, category);
      if (result.ok) {
        return bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });
      } else {
        return bot.sendMessage(chatId, `❌ ${result.error}`, { parse_mode: 'Markdown' });
      }
    }
  });

  // Callback Query Handling
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    if (!isAdmin(query)) return bot.answerCallbackQuery(query.id, { text: 'Akses Ditolak' });

    if (data === 'menu_main') {
      bot.editMessageText('🏠 *PANEL ADMIN RTRW-NET*\nSilakan pilih menu di bawah ini:', {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        ...mainMenu
      });
    }

    else if (data === 'menu_stats') {
      const stats = customerSvc.getCustomerStats();
      const billing = billingSvc.getDashboardStats();
      let res = `*📊 STATISTIK SISTEM*\n\n`;
      res += `👥 Pelanggan: ${stats.total}\n`;
      res += `✅ Aktif: ${stats.active}\n`;
      res += `🚫 Terisolir: ${stats.suspended}\n\n`;
      res += `💰 Pendapatan Bulan Ini: Rp ${billing.thisMonth.toLocaleString('id-ID')}\n`;
      res += `⏳ Belum Dibayar: ${billing.unpaidCount} Tagihan`;
      
      bot.sendMessage(chatId, res, { 
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Kembali', callback_data: 'menu_main' }]] }
      });
    }

    else if (data === 'menu_cust') {
      bot.sendMessage(chatId, '👥 *MANAJEMEN PELANGGAN*\nPilih aksi:', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Cari Pelanggan', callback_data: 'cust_search' }],
            [{ text: '🚫 Daftar Terisolir', callback_data: 'cust_suspended' }],
            [{ text: '📡 List ONU (GenieACS)', callback_data: 'cust_listonu' }],
            [{ text: '⬅️ Kembali', callback_data: 'menu_main' }]
          ]
        }
      });
    }

    else if (data === 'menu_bill') {
      bot.sendMessage(chatId, '💰 *MANAJEMEN TAGIHAN*\nPilih aksi:', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏳ Tagihan Belum Bayar', callback_data: 'bill_unpaid' }],
            [{ text: '📈 Pendapatan Hari Ini', callback_data: 'bill_today' }],
            [{ text: '⬅️ Kembali', callback_data: 'menu_main' }]
          ]
        }
      });
    }

    else if (data === 'menu_vouch') {
      bot.sendMessage(chatId, '🎫 *MANAJEMEN VOUCHER*\nPilih aksi:', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Buat Voucher Baru', callback_data: 'vouch_create' }],
            [{ text: '📜 Daftar Hotspot Profile', callback_data: 'vouch_profiles' }],
            [{ text: '⬅️ Kembali', callback_data: 'menu_main' }]
          ]
        }
      });
    }
    
    else if (data === 'menu_mt') {
      bot.sendMessage(chatId, '⚙️ *STATUS MIKROTIK*\nPilih data:', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Resource System', callback_data: 'mt_resource' }],
            [{ text: '🟢 User Aktif (PPPoE/HS)', callback_data: 'mt_active' }],
            [{ text: '🔴 User Offline (PPPoE)', callback_data: 'mt_offline' }],
            [{ text: '🔑 List PPPoE Secrets', callback_data: 'mt_pppoe' }],
            [{ text: '⬅️ Kembali', callback_data: 'menu_main' }]
          ]
        }
      });
    }

    else if (data === 'mt_resource') {
      try {
        const res = await mikrotikSvc.getSystemResource();
        let txt = `*⚙️ MIKROTIK STATUS*\n\n`;
        txt += `Model: ${res.boardName || res['board-name'] || '-'}\n`;
        txt += `CPU: ${res.cpuLoad || res['cpu-load'] || '0'}%\n`;
        txt += `Uptime: ${res.uptime}\n`;
        txt += `Version: ${res.version}`;
        bot.sendMessage(chatId, txt, { parse_mode: 'Markdown' });
      } catch (e) {
        bot.sendMessage(chatId, 'Gagal mengambil data MikroTik: ' + e.message);
      }
    }

    else if (data === 'mt_active') {
      try {
        const pppoe = await mikrotikSvc.getPppoeActive();
        const hs = await mikrotikSvc.getHotspotActive();
        const scripts = await mikrotikSvc.getSystemScripts();
        
        let txt = `*🟢 USER AKTIF*\n\n`;
        txt += `🌐 *PPPoE (${pppoe.length}):*\n`;
        pppoe.slice(0, 15).forEach(a => {
          const s = scripts.find(sc => sc.name === a.name);
          const failCount = s ? (s.source || '0') : '0';
          txt += `• \`${a.name}\` (${a.address}) [⚡${failCount}]\n`;
        });
        
        txt += `\n📶 *Hotspot (${hs.length}):*\n`;
        hs.slice(0, 5).forEach(h => {
          txt += `• \`${h.user}\` (${h.address})\n`;
        });
        
        txt += `\n_⚡ = Jumlah Gangguan Terdeteksi_`;
        bot.sendMessage(chatId, txt, { parse_mode: 'Markdown' });
      } catch (e) {
        bot.sendMessage(chatId, 'Error: ' + e.message);
      }
    }

    else if (data === 'mt_offline') {
      try {
        const snapshot = await loadPppoeSnapshot();
        bot.sendMessage(chatId, buildOfflineTelegramText(snapshot));
      } catch (e) {
        bot.sendMessage(chatId, 'Error: ' + e.message);
      }
    }

    else if (data === 'mt_pppoe') {
      try {
        const secrets = await mikrotikSvc.getPppoeSecrets();
        let txt = `*🔑 PPPoE SECRETS (${secrets.length})*\n\n`;
        secrets.slice(0, 20).forEach(s => {
          txt += `• \`${s.name}\` (${s.profile})\n`;
        });
        if (secrets.length > 20) txt += `\n_Menampilkan 20 dari ${secrets.length}..._`;
        bot.sendMessage(chatId, txt, { parse_mode: 'Markdown' });
      } catch (e) {
        bot.sendMessage(chatId, 'Error: ' + e.message);
      }
    }

    else if (data === 'cust_search') {
      bot.sendMessage(chatId, '🔍 *CARI PELANGGAN*\nKetik perintah `/cari [nama/wa]`\n\nContoh: `/cari budi` atau `/cari 0812`', { parse_mode: 'Markdown' });
    }

    else if (data === 'cust_listonu') {
      const customerDevice = require('./customerDeviceService');
      let res = await customerDevice.listDevicesWithTags(30);
      
      // Jika kosong, coba ambil semua perangkat
      if (!res.ok || res.devices.length === 0) {
        res = await customerDevice.listAllDevices(30);
      }

      if (!res.ok || res.devices.length === 0) {
        return bot.sendMessage(chatId, '📭 Tidak ada perangkat ONU yang terdeteksi di GenieACS.');
      }

      let txt = `*📡 DAFTAR ONU (GenieACS)*\n\n`;
      res.devices.forEach(d => {
        const id = d._id || 'Unknown ID';
        const tags = Array.isArray(d._tags) ? d._tags.join(', ') : (d._tags || '-');
        txt += `• \`${id}\`\n  └ Tag: ${tags}\n`;
      });
      bot.sendMessage(chatId, txt, { parse_mode: 'Markdown' });
    }

    else if (data === 'cust_suspended') {
      const customers = customerSvc.getAllCustomers().filter(c => c.status === 'suspended');
      if (customers.length === 0) return bot.sendMessage(chatId, '✅ Tidak ada pelanggan yang terisolir.');
      let txt = `*🚫 PELANGGAN TERISOLIR (${customers.length})*\n\n`;
      customers.slice(0, 15).forEach(c => {
        txt += `• *${c.name}* (${c.phone})\n`;
      });
      if (customers.length > 15) txt += `\n_...dan ${customers.length - 15} lainnya._`;
      bot.sendMessage(chatId, txt, { parse_mode: 'Markdown' });
    }

    else if (data === 'bill_unpaid') {
      const invoices = billingSvc.getAllInvoices().filter(i => i.status === 'unpaid');
      if (invoices.length === 0) return bot.sendMessage(chatId, '✅ Semua tagihan sudah lunas!');
      let txt = `*⏳ TAGIHAN BELUM BAYAR (${invoices.length})*\n\n`;
      invoices.slice(0, 15).forEach(i => {
        const c = customerSvc.getCustomerById(i.customer_id);
        txt += `• ${c ? c.name : 'Unknown'} - Rp ${i.amount.toLocaleString('id-ID')}\n`;
      });
      if (invoices.length > 15) txt += `\n_...dan ${invoices.length - 15} lainnya._`;
      bot.sendMessage(chatId, txt, { parse_mode: 'Markdown' });
    }

    else if (data === 'bill_today') {
      try {
        const stats = billingSvc.getTodayRevenue();
        const total = stats.total || 0;
        const count = stats.count || 0;
        
        let txt = `*📈 PENDAPATAN HARI INI*\n\n`;
        txt += `💰 Total: *Rp ${total.toLocaleString('id-ID')}*\n`;
        txt += `🧾 Jumlah: ${count} Transaksi\n\n`;
        txt += `_Data berdasarkan pembayaran yang diverifikasi hari ini (Waktu Lokal)._`;
        bot.sendMessage(chatId, txt, { parse_mode: 'Markdown' });
      } catch (e) {
        bot.sendMessage(chatId, 'Error: ' + e.message);
      }
    }

    else if (data === 'vouch_profiles') {
      try {
        const profiles = await mikrotikSvc.getHotspotUserProfiles();
        const buttons = [];
        
        // Filter profiles that have Mikhmon Price
        const filtered = profiles.filter(p => parseMikhmon(p.onLogin));

        if (filtered.length === 0) {
          return bot.sendMessage(chatId, '⚠️ Tidak ditemukan paket yang memiliki harga jual (Format Mikhmon).');
        }

        filtered.forEach((p, index) => {
          const meta = parseMikhmon(p.onLogin);
          if (index % 2 === 0) buttons.push([]);
          buttons[buttons.length - 1].push({ text: `🎫 ${p.name} (Rp ${meta.price})`, callback_data: `vouch_gen:${p.name}` });
        });
        buttons.push([{ text: '⬅️ Kembali', callback_data: 'menu_vouch' }]);
        
        bot.sendMessage(chatId, '*📜 PILIH PAKET VOUCHER*\nSilakan klik paket untuk langsung membuat PIN:', { 
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons }
        });
      } catch (e) {
        bot.sendMessage(chatId, 'Error: ' + e.message);
      }
    }
    
    else if (data.startsWith('vouch_gen:')) {
      const profileName = data.split(':')[1];
      try {
        const profiles = await mikrotikSvc.getHotspotUserProfiles();
        const profile = profiles.find(p => p.name === profileName);
        if (!profile) throw new Error('Profil tidak ditemukan');

        const meta = parseMikhmon(profile.onLogin);
        if (!meta) throw new Error('Data harga/durasi profil tidak ditemukan (Format Mikhmon)');

        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        
        await mikrotikSvc.addHotspotUser({
          server: 'all',
          name: pin,
          password: pin,
          profile: profileName,
          'limit-uptime': meta.validity,
          comment: `vc-${pin}-${profileName}`
        });
        
        let res = `*🎫 VOUCHER BERHASIL (INSTAN)*\n\n`;
        res += `🎫 KODE VOUCHER: \`${pin}\`\n`;
        res += `💰 Harga: Rp ${meta.price}\n`;
        res += `⏳ Durasi: ${meta.validity}\n`;
        res += `📦 Paket: ${profileName}\n`;
        res += `\n_Silakan masukkan kode di atas pada halaman login hotspot._`;
        
        bot.sendMessage(chatId, res, { parse_mode: 'Markdown' });
      } catch (e) {
        bot.sendMessage(chatId, 'Gagal: ' + e.message);
      }
    }

    else if (data === 'menu_expense') {
      bot.sendMessage(chatId, '💸 *MANAJEMEN PENGELUARAN (CASH OUT)*\nPilih aksi di bawah ini:', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Catat Pengeluaran Baru', callback_data: 'exp_create' }],
            [{ text: '📊 Rekap Pengeluaran Bulan Ini', callback_data: 'exp_summary' }],
            [{ text: '📜 10 Pengeluaran Terakhir', callback_data: 'exp_recent' }],
            [{ text: '🏷️ Daftar Kategori', callback_data: 'exp_categories' }],
            [{ text: '⬅️ Kembali', callback_data: 'menu_main' }]
          ]
        }
      });
    }

    else if (data === 'exp_create') {
      const categories = db.prepare('SELECT name FROM expense_categories WHERE is_active = 1 ORDER BY name ASC').all();
      const buttons = [];
      categories.forEach((cat, idx) => {
        if (idx % 2 === 0) buttons.push([]);
        buttons[buttons.length - 1].push({ text: `🏷️ ${cat.name}`, callback_data: `exp_cat:${cat.name}` });
      });
      buttons.push([{ text: '⬅️ Batal', callback_data: 'menu_expense' }]);

      bot.sendMessage(chatId, '➕ *CATAT PENGELUARAN BARU*\n\nPilih kategori pengeluaran:', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      });
    }

    else if (data.startsWith('exp_cat:')) {
      const categoryName = data.split(':')[1];
      userStates[chatId] = { action: 'awaiting_expense_input', category: categoryName };

      bot.sendMessage(chatId, `🏷️ *KATEGORI: ${categoryName}*\n\nSilakan ketik *Nominal* dan *Keterangan* pengeluaran.\n\n*Format Contoh:*\n• \`50000 Beli bensin motor\`\n• \`150k Bayar listrik NOC\`\n• \`1.5jt Pembelian kabel LAN\`\n\n_Ketik /batal untuk membatalkan._`, {
        parse_mode: 'Markdown'
      });
    }

    else if (data === 'exp_summary') {
      try {
        const txt = buildExpenseSummaryText();
        bot.sendMessage(chatId, txt, { parse_mode: 'Markdown' });
      } catch (e) {
        bot.sendMessage(chatId, 'Error: ' + e.message);
      }
    }

    else if (data === 'exp_recent') {
      try {
        const txt = buildRecentExpensesText(10);
        bot.sendMessage(chatId, txt, { parse_mode: 'Markdown' });
      } catch (e) {
        bot.sendMessage(chatId, 'Error: ' + e.message);
      }
    }

    else if (data === 'exp_categories') {
      try {
        const categories = db.prepare('SELECT name, description FROM expense_categories WHERE is_active = 1 ORDER BY name ASC').all();
        let txt = `*🏷️ KATEGORI PENGELUARAN (${categories.length})*\n\n`;
        categories.forEach(c => {
          txt += `• *${c.name}*: ${c.description || '-'}\n`;
        });
        bot.sendMessage(chatId, txt, { parse_mode: 'Markdown' });
      } catch (e) {
        bot.sendMessage(chatId, 'Error: ' + e.message);
      }
    }
    
    bot.answerCallbackQuery(query.id);
  });

  // Custom Commands
  bot.onText(/\/(?:pengeluaran|keluar|catatkeluar)(?:\s+(.+))?/i, async (msg, match) => {
    if (!isAdmin(msg)) return;
    const input = match[1] ? match[1].trim() : '';

    if (!input) {
      const categories = db.prepare('SELECT name FROM expense_categories WHERE is_active = 1 ORDER BY name ASC').all();
      const buttons = [];
      categories.forEach((cat, idx) => {
        if (idx % 2 === 0) buttons.push([]);
        buttons[buttons.length - 1].push({ text: `🏷️ ${cat.name}`, callback_data: `exp_cat:${cat.name}` });
      });
      buttons.push([{ text: '⬅️ Kembali', callback_data: 'menu_main' }]);

      return bot.sendMessage(msg.chat.id, '➕ *CATAT PENGELUARAN BARU*\n\nPilih kategori pengeluaran:', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      });
    }

    const result = saveExpenseFromTelegram(msg, input);
    if (result.ok) {
      bot.sendMessage(msg.chat.id, result.message, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(msg.chat.id, `❌ ${result.error}`, { parse_mode: 'Markdown' });
    }
  });

  bot.onText(/\/(?:rekapkeluar|listpengeluaran)/i, async (msg) => {
    if (!isAdmin(msg)) return;
    try {
      const summary = buildExpenseSummaryText();
      const recent = buildRecentExpensesText(5);
      bot.sendMessage(msg.chat.id, `${summary}\n\n${recent}`, { parse_mode: 'Markdown' });
    } catch (e) {
      bot.sendMessage(msg.chat.id, 'Error: ' + e.message);
    }
  });

  bot.onText(/\/vouch (\S+) (\S+) (.+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;
    const [_, profile, limit, comment] = match;
    try {
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      await mikrotikSvc.addHotspotUser({
        server: 'all', name: pin, password: pin, profile, 'limit-uptime': limit, comment
      });
      bot.sendMessage(msg.chat.id, `*🎫 VOUCHER BERHASIL*\n\n🎫 KODE VOUCHER: \`${pin}\`\n📦 Paket: ${profile}\n⏳ Limit: ${limit}`, { parse_mode: 'Markdown' });
    } catch (e) {
      bot.sendMessage(msg.chat.id, 'Gagal: ' + e.message);
    }
  });

  bot.onText(/\/kick (\S+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;
    try {
      const user = match[1];
      await mikrotikSvc.kickPppoeUser(user);
      await mikrotikSvc.kickHotspotUser(user);
      bot.sendMessage(msg.chat.id, `✅ Session *${user}* berhasil diputus.`);
    } catch (e) {
      bot.sendMessage(msg.chat.id, 'Gagal: ' + e.message);
    }
  });

  bot.onText(/\/editpppoe (\S+) (\S+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;
    try {
      const [_, user, profile] = match;
      await mikrotikSvc.setPppoeProfile(user, profile);
      bot.sendMessage(msg.chat.id, `✅ Profile *${user}* diubah ke *${profile}*.`);
    } catch (e) {
      bot.sendMessage(msg.chat.id, 'Gagal: ' + e.message);
    }
  });

  bot.onText(/\/cekpppoe (\S+)/i, async (msg, match) => {
    if (!isAdmin(msg)) return;
    try {
      const username = match[1];
      const detail = await buildPppoeUserDetailText(username);
      bot.sendMessage(msg.chat.id, detail);
    } catch (e) {
      bot.sendMessage(msg.chat.id, 'Gagal cek PPPoE: ' + e.message);
    }
  });

  bot.onText(/\/cari (.+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;
    const query = match[1].toLowerCase();
    const customers = customerSvc.getAllCustomers().filter(c => 
      c.name.toLowerCase().includes(query) || c.phone.includes(query)
    );
    
    if (customers.length === 0) return bot.sendMessage(msg.chat.id, `❌ Pelanggan dengan keyword "${query}" tidak ditemukan.`);
    
    let res = `*🔍 HASIL PENCARIAN (${customers.length})*\n\n`;
    customers.slice(0, 10).forEach(c => {
      res += `👤 *${c.name}*\n📞 ${c.phone}\n🚦 Status: ${c.status === 'active' ? '✅ Aktif' : '🚫 Terisolir'}\n\n`;
    });
    if (customers.length > 10) res += `_...dan ${customers.length - 10} lainnya._`;
    bot.sendMessage(msg.chat.id, res, { parse_mode: 'Markdown' });
  });

  bot.on('polling_error', (error) => {
    logger.error('Telegram Polling Error:', error.message);
  });
}

/**
 * Kirim pesan Telegram ke chatId tertentu
 * @param {string|number} chatId - ID Chat Telegram / Group ID
 * @param {string} text - Isi pesan (Markdown formatted)
 * @param {object} options - Options tambahan
 * @returns {Promise<boolean>}
 */
async function sendTelegramMessage(chatId, text, options = {}) {
  const enabled = getSetting('telegram_enabled', false);
  const token = getSetting('telegram_bot_token', '');

  if (!enabled || !token || !chatId) {
    return false;
  }

  const payloadOptions = { parse_mode: 'Markdown', ...options };

  try {
    if (bot && typeof bot.sendMessage === 'function') {
      await bot.sendMessage(chatId, text, payloadOptions);
      return true;
    }

    // Fallback: Kirim langsung via Telegram HTTP REST API jika instance bot polling tidak aktif
    const axios = require('axios');
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text: text,
      ...payloadOptions
    }, { timeout: 5000 });
    return true;
  } catch (err) {
    logger.error(`[Telegram] Gagal mengirim pesan ke ${chatId}: ${err.message}`);
    return false;
  }
}

/**
 * Kirim pesan Telegram ke seluruh Admin / Group Telegram yang terkonfigurasi
 * @param {string} text - Isi pesan
 * @param {object} options - Options tambahan
 * @returns {Promise<boolean>}
 */
async function sendTelegramAdminNotification(text, options = {}) {
  const adminIdsRaw = getSetting('telegram_admin_id', '');
  if (!adminIdsRaw) return false;

  const adminIds = String(adminIdsRaw)
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  let sent = false;
  for (const adminId of adminIds) {
    const success = await sendTelegramMessage(adminId, text, options);
    if (success) sent = true;
  }
  return sent;
}

/**
 * Kirim notifikasi Telegram untuk status PPPoE (Offline / Disconnected atau Recovery / Online)
 * @param {object} pppoeData - Data rincian user PPPoE
 * @param {string} pppoeData.username - PPPoE Username
 * @param {string} [pppoeData.customerName] - Nama Pelanggan
 * @param {string} [pppoeData.phone] - No Telepon / WA Pelanggan
 * @param {string} [pppoeData.profile] - Profile PPPoE (Paket)
 * @param {string} [pppoeData.ipAddress] - IP Address Terakhir / Aktif
 * @param {'offline'|'online'} pppoeData.status - Status baru
 * @param {string} [pppoeData.time] - Timestamp waktu kejadian
 * @returns {Promise<boolean>}
 */
async function sendPppoeStatusNotification(pppoeData) {
  if (!pppoeData || !pppoeData.username) return false;

  const enabled = getSetting('telegram_pppoe_notify_enabled', true);
  if (!enabled) return false;

  const status = pppoeData.status || 'offline';
  const isOffline = status === 'offline';

  if (!isOffline) {
    const recoveryEnabled = getSetting('telegram_pppoe_notify_recovery', true);
    if (!recoveryEnabled) return false;
  }

  const username = String(pppoeData.username).trim();
  const customerName = pppoeData.customerName || '-';
  const phone = pppoeData.phone || '-';
  const profile = pppoeData.profile || '-';
  const ipAddress = pppoeData.ipAddress || '-';
  const time = pppoeData.time || getNowLocal();

  const oltName = pppoeData.oltName || null;
  const ontStatus = pppoeData.ontStatus || (isOffline ? 'PwrDown / down' : 'Online / UP');
  const offlineReason = pppoeData.offlineReason || (isOffline ? 'Dying_gasp / TIMEOUT / Other' : null);
  const rxPower = pppoeData.rxPower || null;

  let message = '';
  if (isOffline) {
    message =
      `🚨 *ALERT: USER PPPoE DISCONNECTED*\n` +
      `============================\n` +
      `👤 *Pelanggan:* ${customerName}\n` +
      `🔑 *Username:* \`${username}\`\n` +
      `📞 *No. WA:* ${phone}\n` +
      `📦 *Paket/Profile:* ${profile}\n` +
      `🌐 *IP Terakhir:* ${ipAddress}\n`;

    if (oltName || ontStatus || offlineReason || rxPower) {
      message += `----------------------------\n`;
      if (oltName) message += `📡 *OLT:* ${oltName}\n`;
      message += `⚡ *Status ONT OLT:* \`${ontStatus}\`\n`;
      if (offlineReason) message += `🔍 *OfflineReason:* \`${offlineReason}\`\n`;
      if (rxPower) message += `📊 *Redaman (RX):* ${rxPower}\n`;
    }

    message +=
      `============================\n` +
      `📅 *Waktu Putus:* ${time}\n` +
      `_Status: Terputus dari Router & OLT_`;
  } else {
    message =
      `✅ *RECOVERY: USER PPPoE CONNECTED*\n` +
      `============================\n` +
      `👤 *Pelanggan:* ${customerName}\n` +
      `🔑 *Username:* \`${username}\`\n` +
      `📞 *No. WA:* ${phone}\n` +
      `📦 *Paket/Profile:* ${profile}\n` +
      `🌐 *IP Aktif:* ${ipAddress}\n`;

    if (oltName || ontStatus || rxPower) {
      message += `----------------------------\n`;
      if (oltName) message += `📡 *OLT:* ${oltName}\n`;
      message += `⚡ *Status ONT OLT:* \`${ontStatus}\`\n`;
      if (rxPower) message += `📊 *Redaman (RX):* ${rxPower}\n`;
    }

    message +=
      `============================\n` +
      `📅 *Waktu Terhubung:* ${time}\n` +
      `_Status: Kembali Online di Router & OLT_`;
  }

  return await sendTelegramAdminNotification(message);
}

// Export for manual re-init from settings and sending notifications
module.exports = {
  initTelegram,
  sendTelegramMessage,
  sendTelegramAdminNotification,
  sendPppoeStatusNotification
};


