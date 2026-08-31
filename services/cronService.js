/**
 * Service: Penjadwalan Tugas Otomatis (Cron)
 */
const cron = require('node-cron');
const billingSvc = require('./billingService');
const { logger } = require('../config/logger');

const customerSvc = require('./customerService');
const mikrotikService = require('./mikrotikService');
const usageSvc = require('./usageService');
const { getSetting, getCurrentDateInTimezone, getNowLocal } = require('../config/settingsManager');
const db = require('../config/database');
const telegramBot = require('./telegramBot');
const oltService = require('./oltService');

// Helper: Random delay generator untuk smart rate limiting
function getRandomDelay(baseDelayMs, varianceMs = 3000) {
  const minDelay = Math.max(baseDelayMs - varianceMs, 2000);
  const maxDelay = baseDelayMs + varianceMs;
  return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
}

// Helper: Exponential backoff untuk error handling
function getBackoffDelay(attemptCount, baseDelayMs = 2000) {
  const maxDelay = 30000;
  const delay = Math.min(baseDelayMs * Math.pow(2, attemptCount), maxDelay);
  return delay + Math.floor(Math.random() * 1000);
}

// Helper: Cek apakah error adalah permanent (tidak perlu retry)
function isPermanentError(errorMessage) {
  const permanentErrorPatterns = [
    /invalid.*number/i,
    /number.*not.*found/i,
    /phone.*not.*exist/i,
    /blocked/i,
    /banned/i,
    /not.*registered/i,
    /user.*not.*found/i,
    /404/i,
    /400/i
  ];
  return permanentErrorPatterns.some(pattern => pattern.test(errorMessage));
}

// Helper: Message variation untuk menghindari spam detection
function addMessageVariation(message, index) {
  const variations = [
    '',
    '\n\n_',
    '\n\n•',
    '\n\n▪',
    '\n\n▫'
  ];
  const suffix = variations[index % variations.length];
  return message + suffix;
}

function startCronJobs() {
  const acsDeviceStates = new Map();
  // 1. Generate Tagihan Otomatis setiap tanggal 1 jam 00:01
  cron.schedule('1 0 1 * *', () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    logger.info(`[CRON] Menjalankan generate tagihan otomatis untuk ${month}/${year}`);
    try {
      const count = billingSvc.generateMonthlyInvoices(month, year);
      logger.info(`[CRON] Berhasil generate ${count} tagihan otomatis.`);
    } catch (error) {
      logger.error(`[CRON] Gagal generate tagihan otomatis: ${error.message}`);
    }
  });

  // 2. Isolir Otomatis setiap hari jam 02:00
  cron.schedule('0 2 * * *', async () => {
    const today = new Date().getDate();
    // Kita cek semua pelanggan setiap hari untuk isolir otomatis
    logger.info(`[CRON] Menjalankan pengecekan isolir otomatis harian (Tanggal ${today})`);
    
    const customers = customerSvc.getAllCustomers();
    let isolatedCount = 0;

    for (const c of customers) {
      // Cek apakah isolir otomatis aktif untuk user ini dan hari ini adalah tanggal isolirnya
      const customerIsolirDay = c.isolate_day || 10;
      const isAutoIsolateEnabled = c.auto_isolate !== 0; // default aktif jika null/1

      if (isAutoIsolateEnabled && today >= customerIsolirDay) {
        // Jika pelanggan aktif tapi punya tagihan belum bayar
        if (c.status === 'active' && c.unpaid_count > 0) {
          try {
            logger.info(`[CRON] Isolir otomatis pelanggan: ${c.name} (${c.pppoe_username}) - Tanggal Tagihan: ${customerIsolirDay}`);
            
            // Gunakan fungsi terpusat untuk isolir
            await customerSvc.suspendCustomer(c.id);
            
            isolatedCount++;
          } catch (err) {
            logger.error(`[CRON] Gagal isolir ${c.name}: ${err.message}`);
          }
        }
      }
    }
    logger.info(`[CRON] Selesai pengecekan isolir. Total ${isolatedCount} pelanggan baru di-isolir.`);
  });

  cron.schedule('0 9 * * *', async () => {
    const enabled = getSetting('whatsapp_auto_billing_enabled', false);
    const waEnabled = getSetting('whatsapp_enabled', false);
    const billingEnabled = getSetting('whatsapp_billing_to_customer_enabled', true);
    if (!enabled || !waEnabled || !billingEnabled) return;

    let sendWA, whatsappStatus;
    try {
      const mod = await import('./whatsappBot.mjs');
      sendWA = mod.sendWA;
      whatsappStatus = mod.whatsappStatus;
    } catch (e) {
      logger.error(`[CRON] Gagal load WhatsApp bot: ${e.message || e}`);
      return;
    }

    if (!whatsappStatus || whatsappStatus.connection !== 'open') {
      logger.warn('[CRON] WhatsApp bot belum terhubung, pengingat tagihan otomatis dilewati.');
      return;
    }

    const resolveBaseUrl = () => {
      const explicit = String(getSetting('public_base_url', '') || '').trim();
      if (explicit) return explicit.replace(/\/+$/, '');

      const hostRaw = String(getSetting('server_host', 'localhost') || 'localhost').trim();
      const port = Number(getSetting('server_port', 3001) || 3001);
      const hasProto = /^https?:\/\//i.test(hostRaw);
      const proto = port === 443 ? 'https' : 'http';
      const host = hasProto ? hostRaw.replace(/\/+$/, '') : `${proto}://${hostRaw}`;
      const withPort = (port === 80 || port === 443) ? host : `${host}:${port}`;
      return withPort.replace(/\/+$/, '');
    };

    const loginLink = `${resolveBaseUrl()}/customer/login`;
    const baseDelayMs = (Number(getSetting('whatsapp_broadcast_delay', 5) || 5) * 1000); // Default 5 detik
    const batchSize = 15; // 15 pesan per batch (dari 20)
    const batchPauseMs = 120000; // Pause 2 menit setelah batch (dari 1 menit)

    function getDaysUntilIsolation(today, dueDay) {
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      let isolateDate = new Date(today.getFullYear(), today.getMonth(), dueDay, 0, 0, 0, 0);
      if (isolateDate < startOfToday) {
        isolateDate = new Date(today.getFullYear(), today.getMonth() + 1, dueDay, 0, 0, 0, 0);
      }
      const diffTime = isolateDate.getTime() - startOfToday.getTime();
      return Math.round(diffTime / (1000 * 60 * 60 * 24));
    }

    const today = getCurrentDateInTimezone();
    const activeDaysSetting = String(getSetting('whatsapp_auto_billing_days', '1') || '1');
    const activeDays = activeDaysSetting.split(',').map(s => parseInt(s.trim())).filter(Number.isFinite);

    const customers = customerSvc.getAllCustomers();
    let targetCount = 0;
    let sent = 0;
    let failed = 0;
    let batchCount = 0;

    const defaultTemplate =
      `Yth. Bpk/Ibu {{nama}},\n\n` +
      `Ini adalah pengingat sebelum tanggal jatuh tempo/isolir.\n\n` +
      `📦 *Paket:* {{paket}}\n` +
      `💰 *Total Tagihan:* Rp {{tagihan}}\n` +
      `📅 *Periode:* {{rincian}}\n` +
      `📅 *Jatuh Tempo:* {{jatuh_tempo}}\n\n` +
      `Mohon segera melakukan pembayaran melalui portal pelanggan: {{link}}\n\n` +
      `Terima kasih atas kerja samanya.\n` +
      `Salam,\nAdmin ${getSetting('company_header', 'ISP')}`;
    const template = String(db.getAppSetting('whatsapp_auto_billing_message', defaultTemplate) || defaultTemplate);

    // Filter pelanggan yang perlu diingatkan
    const targetCustomers = [];
    const seenPhones = new Set();
    for (const c of customers) {
      // Cek fitur opt-in / toggle pengingat tagihan per pelanggan
      if (c.send_billing_reminder === 0) continue;

      const phone = c.phone ? String(c.phone).trim() : '';
      if (!phone || phone.length < 9) continue;
      let digits = phone.replace(/\D/g, '');
      if (!digits) continue;
      if (digits.startsWith('0')) digits = '62' + digits.slice(1);
      if (seenPhones.has(digits)) continue;
      const unpaidCount = Number(c.unpaid_count || 0) || 0;
      if (unpaidCount <= 0) continue;

      const dueDay = Number(c.isolate_day || 0) || Number(getSetting('isolir_day', 10) || 10) || 10;
      const daysUntilIsolir = getDaysUntilIsolation(today, dueDay);
      const shouldSend = activeDays.includes(daysUntilIsolir);
      if (!shouldSend) continue;

      seenPhones.add(digits);
      targetCustomers.push(c);
    }

    if (targetCustomers.length === 0) {
      logger.info('[CRON] Tidak ada pelanggan yang perlu diingatkan hari ini.');
      return;
    }

    logger.info(`[CRON] Memulai pengingat tagihan otomatis untuk ${targetCustomers.length} pelanggan dengan smart rate limit.`);

    // Kirim pesan dengan smart rate limit
    for (let i = 0; i < targetCustomers.length; i++) {
      const c = targetCustomers[i];
      let attemptCount = 0;
      const maxAttempts = 3;

      while (attemptCount < maxAttempts) {
        try {
          // Smart Random Delay
          const randomDelay = getRandomDelay(baseDelayMs, 2000);
          await new Promise(r => setTimeout(r, randomDelay));

          const billingSummary = billingSvc.getCustomerBillingSummary(c.id);
          const totalTagihan = billingSummary.totalTagihan;
          const totalCarried = billingSummary.sisaLalu;
          const rincianBulan = billingSummary.rincianBulan;

          const now = new Date();
          const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
          const currentYear = now.getFullYear();
          const jatuhTempo = `${String(c.isolate_day || 10).padStart(2, '0')}/${currentMonth}/${currentYear}`;

          const rincianSisaText = totalCarried > 0 
            ? `📌 *Termasuk Sisa Tagihan Bulan Lalu:* Rp ${totalCarried.toLocaleString('id-ID')}\n`
            : '';

          // Format pesan dengan variation untuk anti-spam
          const customerFormattedId = 'MDE-' + String(c.id).padStart(4, '0');
          let formattedMsg = template
            .replace(/{{id_pelanggan}}/gi, customerFormattedId)
            .replace(/{{nama}}/gi, c.name || 'Pelanggan')
            .replace(/{{tagihan}}/gi, totalTagihan.toLocaleString('id-ID'))
            .replace(/{{sisa_lalu}}/gi, totalCarried.toLocaleString('id-ID'))
            .replace(/{{sisa_tagihan_bulan_lalu}}/gi, totalCarried.toLocaleString('id-ID'))
            .replace(/{{rincian_sisa}}/gi, rincianSisaText)
            .replace(/{{rincian}}/gi, rincianBulan || '-')
            .replace(/{{paket}}/gi, c.package_name || '-')
            .replace(/{{link}}/gi, loginLink)
            .replace(/{{jatuh_tempo}}/gi, jatuhTempo);

          if (!formattedMsg.includes(jatuhTempo)) {
            formattedMsg = formattedMsg.replace(/(Mohon segera|Terima kasih)/, `📅 *Jatuh Tempo:* ${jatuhTempo}\n\n$1`);
          }

          // Add subtle variation untuk menghindari spam detection
          formattedMsg = addMessageVariation(formattedMsg, i);

          const ok = await sendWA(c.phone, formattedMsg);
          if (ok) {
            sent++;
            targetCount++;
            batchCount++;
          } else {
            throw new Error('Gagal kirim pesan');
          }

          // Batch Processing: Pause setelah N pesan
          if (batchCount >= batchSize && i < targetCustomers.length - 1) {
            logger.info(`[CRON] Selesai batch ${Math.floor(i / batchSize) + 1} (${batchSize} pesan). Pause ${Math.floor(batchPauseMs / 1000)} detik...`);
            await new Promise(r => setTimeout(r, batchPauseMs));
            batchCount = 0;
          }

          break; // Sukses, keluar dari retry loop
        } catch (e) {
          attemptCount++;
          const errorMsg = e.message || e.toString();

          // Cek apakah error permanent (tidak perlu retry)
          if (isPermanentError(errorMsg)) {
            logger.warn(`[CRON] SKIP: Error permanent untuk ${c.phone} - ${errorMsg}`);
            failed++;
            break; // Skip retry langsung ke pelanggan berikutnya
          }

          // Error temporary, bisa retry
          logger.error(`[CRON] Gagal kirim ke ${c.phone} (attempt ${attemptCount}/${maxAttempts}): ${errorMsg}`);

          if (attemptCount >= maxAttempts) {
            logger.warn(`[CRON] Max attempts tercapai untuk ${c.phone}`);
            failed++;
          } else {
            // Exponential backoff untuk retry
            const backoffDelay = getBackoffDelay(attemptCount);
            logger.info(`[CRON] Retry ke ${c.phone} dalam ${Math.floor(backoffDelay / 1000)} detik...`);
            await new Promise(r => setTimeout(r, backoffDelay));
          }
        }
      }
    }

    logger.info(`[CRON] Pengingat tagihan otomatis selesai: target=${targetCount}, terkirim=${sent}, gagal=${failed}`);
  });

  // 3b. Pengingat Sebelum Isolir Harian - Jam 09:05
  cron.schedule('5 9 * * *', async () => {
    const enabled = getSetting('whatsapp_auto_isolir_enabled', false);
    const waEnabled = getSetting('whatsapp_enabled', false);
    const billingEnabled = getSetting('whatsapp_billing_to_customer_enabled', true);
    if (!enabled || !waEnabled || !billingEnabled) return;

    let sendWA, whatsappStatus;
    try {
      const mod = await import('./whatsappBot.mjs');
      sendWA = mod.sendWA;
      whatsappStatus = mod.whatsappStatus;
    } catch (e) {
      logger.error(`[CRON] Gagal load WhatsApp bot: ${e.message || e}`);
      return;
    }

    if (!whatsappStatus || whatsappStatus.connection !== 'open') {
      logger.warn('[CRON] WhatsApp bot belum terhubung, pengingat sebelum isolir otomatis dilewati.');
      return;
    }

    const resolveBaseUrl = () => {
      const explicit = String(getSetting('public_base_url', '') || '').trim();
      if (explicit) return explicit.replace(/\/+$/, '');

      const hostRaw = String(getSetting('server_host', 'localhost') || 'localhost').trim();
      const port = Number(getSetting('server_port', 3001) || 3001);
      const hasProto = /^https?:\/\//i.test(hostRaw);
      const proto = port === 443 ? 'https' : 'http';
      const host = hasProto ? hostRaw.replace(/\/+$/, '') : `${proto}://${hostRaw}`;
      const withPort = (port === 80 || port === 443) ? host : `${host}:${port}`;
      return withPort.replace(/\/+$/, '');
    };

    const loginLink = `${resolveBaseUrl()}/customer/login`;
    const baseDelayMs = (Number(getSetting('whatsapp_broadcast_delay', 5) || 5) * 1000);
    const batchSize = 15;
    const batchPauseMs = 120000;

    function getDaysUntilIsolation(today, dueDay) {
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      let isolateDate = new Date(today.getFullYear(), today.getMonth(), dueDay, 0, 0, 0, 0);
      if (isolateDate < startOfToday) {
        isolateDate = new Date(today.getFullYear(), today.getMonth() + 1, dueDay, 0, 0, 0, 0);
      }
      const diffTime = isolateDate.getTime() - startOfToday.getTime();
      return Math.round(diffTime / (1000 * 60 * 60 * 24));
    }

    const today = getCurrentDateInTimezone();
    const activeDaysSetting = String(getSetting('whatsapp_auto_isolir_days', '1') || '1');
    const activeDays = activeDaysSetting.split(',').map(s => parseInt(s.trim())).filter(Number.isFinite);

    const customers = customerSvc.getAllCustomers();
    let targetCount = 0;
    let sent = 0;
    let failed = 0;
    let batchCount = 0;

    const defaultTemplate =
      `Yth. Pelanggan {{nama}},\n\n` +
      `Ini adalah pengingat penting bahwa layanan internet Anda (Paket {{paket}}) akan terisolir otomatis dalam {{hari_h}} hari jika tidak ada pembayaran.\n\n` +
      `💰 *Total Tagihan:* Rp {{tagihan}}\n` +
      `📅 *Jatuh Tempo:* {{jatuh_tempo}}\n\n` +
      `Mohon lakukan pembayaran segera melalui portal pelanggan: {{link}} untuk menghindari pemutusan layanan.\n\n` +
      `Terima kasih.\n` +
      `Salam,\nAdmin ${getSetting('company_header', 'ISP')}`;
    const template = String(db.getAppSetting('whatsapp_auto_isolir_message', defaultTemplate) || defaultTemplate);

    const targetCustomers = [];
    const seenPhones = new Set();
    for (const c of customers) {
      // Cek fitur opt-in / toggle pengingat sebelum isolir per pelanggan
      if (c.send_isolir_reminder === 0) continue;

      const phone = c.phone ? String(c.phone).trim() : '';
      if (!phone || phone.length < 9) continue;
      let digits = phone.replace(/\D/g, '');
      if (!digits) continue;
      if (digits.startsWith('0')) digits = '62' + digits.slice(1);
      if (seenPhones.has(digits)) continue;
      const unpaidCount = Number(c.unpaid_count || 0) || 0;
      if (unpaidCount <= 0) continue;

      // HANYA kirim jika pelanggan berstatus ACTIVE (belum di-isolir)
      if (c.status !== 'active') continue;

      const dueDay = Number(c.isolate_day || 0) || Number(getSetting('isolir_day', 10) || 10) || 10;
      const daysUntilIsolir = getDaysUntilIsolation(today, dueDay);
      const shouldSend = activeDays.includes(daysUntilIsolir);
      if (!shouldSend) continue;

      seenPhones.add(digits);
      targetCustomers.push({ customer: c, daysLeft: daysUntilIsolir });
    }

    if (targetCustomers.length === 0) {
      logger.info('[CRON] Tidak ada pelanggan yang perlu diingatkan sebelum isolir hari ini.');
      return;
    }

    logger.info(`[CRON] Memulai pengingat sebelum isolir otomatis untuk ${targetCustomers.length} pelanggan dengan smart rate limit.`);

    for (let i = 0; i < targetCustomers.length; i++) {
      const item = targetCustomers[i];
      const c = item.customer;
      const daysLeft = item.daysLeft;
      let attemptCount = 0;
      const maxAttempts = 3;

      while (attemptCount < maxAttempts) {
        try {
          const randomDelay = getRandomDelay(baseDelayMs, 2000);
          await new Promise(r => setTimeout(r, randomDelay));

          const billingSummary = billingSvc.getCustomerBillingSummary(c.id);
          const totalTagihan = billingSummary.totalTagihan;
          const totalCarried = billingSummary.sisaLalu;
          const rincianBulan = billingSummary.rincianBulan;

          const now = new Date();
          const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
          const currentYear = now.getFullYear();
          const jatuhTempo = `${String(c.isolate_day || 10).padStart(2, '0')}/${currentMonth}/${currentYear}`;

          const rincianSisaText = totalCarried > 0 
            ? `📌 *Termasuk Sisa Tagihan Bulan Lalu:* Rp ${totalCarried.toLocaleString('id-ID')}\n`
            : '';

          const customerFormattedId = 'MDE-' + String(c.id).padStart(4, '0');
          let formattedMsg = template
            .replace(/{{id_pelanggan}}/gi, customerFormattedId)
            .replace(/{{nama}}/gi, c.name || 'Pelanggan')
            .replace(/{{tagihan}}/gi, totalTagihan.toLocaleString('id-ID'))
            .replace(/{{sisa_lalu}}/gi, totalCarried.toLocaleString('id-ID'))
            .replace(/{{sisa_tagihan_bulan_lalu}}/gi, totalCarried.toLocaleString('id-ID'))
            .replace(/{{rincian_sisa}}/gi, rincianSisaText)
            .replace(/{{rincian}}/gi, rincianBulan || '-')
            .replace(/{{paket}}/gi, c.package_name || '-')
            .replace(/{{link}}/gi, loginLink)
            .replace(/{{hari_h}}/gi, String(daysLeft))
            .replace(/{{jatuh_tempo}}/gi, jatuhTempo);

          if (!formattedMsg.includes(jatuhTempo)) {
            formattedMsg = formattedMsg.replace(/(Mohon lakukan|Terima kasih)/, `📅 *Jatuh Tempo:* ${jatuhTempo}\n\n$1`);
          }

          formattedMsg = addMessageVariation(formattedMsg, i);

          const ok = await sendWA(c.phone, formattedMsg);
          if (ok) {
            sent++;
            targetCount++;
            batchCount++;
          } else {
            throw new Error('Gagal kirim pesan');
          }

          if (batchCount >= batchSize && i < targetCustomers.length - 1) {
            logger.info(`[CRON] Selesai batch ${Math.floor(i / batchSize) + 1} (${batchSize} pesan). Pause ${Math.floor(batchPauseMs / 1000)} detik...`);
            await new Promise(r => setTimeout(r, batchPauseMs));
            batchCount = 0;
          }

          break;
        } catch (e) {
          attemptCount++;
          const errorMsg = e.message || e.toString();

          if (isPermanentError(errorMsg)) {
            logger.warn(`[CRON] SKIP: Error permanent untuk ${c.phone} - ${errorMsg}`);
            failed++;
            break;
          }

          logger.error(`[CRON] Gagal kirim ke ${c.phone} (attempt ${attemptCount}/${maxAttempts}): ${errorMsg}`);

          if (attemptCount >= maxAttempts) {
            logger.warn(`[CRON] Max attempts tercapai untuk ${c.phone}`);
            failed++;
          } else {
            const backoffDelay = getBackoffDelay(attemptCount);
            logger.info(`[CRON] Retry ke ${c.phone} dalam ${Math.floor(backoffDelay / 1000)} detik...`);
            await new Promise(r => setTimeout(r, backoffDelay));
          }
        }
      }
    }

    logger.info(`[CRON] Pengingat sebelum isolir otomatis selesai: target=${targetCount}, terkirim=${sent}, gagal=${failed}`);
  });

  // 4. Jam Kalong (Night Speed) Start - Jam 00:00
  cron.schedule('0 0 * * *', async () => {
    logger.info('[CRON] Memulai Jam Kalong (Night Speed) - Ganti Profile...');
    try {
      const customers = customerSvc.getAllCustomers();
      let count = 0;

      for (const c of customers) {
        if (!c.package_id || !c.pppoe_username) continue;
        
        const pkg = customerSvc.getPackageById(c.package_id);
        if (pkg && pkg.use_night_speed === 1 && pkg.night_profile_name) {
          try {
            logger.info(`[CRON] Switching ${c.name} to Night Profile: ${pkg.night_profile_name}`);
            await mikrotikService.setPppoeProfile(c.pppoe_username, pkg.night_profile_name, c.router_id);
            count++;
          } catch (err) {
            logger.error(`[CRON] Gagal switch Jam Kalong untuk ${c.name}: ${err.message}`);
          }
        }
      }
      logger.info(`[CRON] Jam Kalong aktif untuk ${count} pelanggan.`);
    } catch (e) {
      logger.error(`[CRON] Error Jam Kalong Start: ${e.message}`);
    }
  });

  // 5. Jam Kalong (Night Speed) End - Jam 06:00
  cron.schedule('0 6 * * *', async () => {
    logger.info('[CRON] Mengakhiri Jam Kalong (Night Speed) - Kembali ke Profile Normal...');
    try {
      const customers = customerSvc.getAllCustomers();
      let count = 0;

      for (const c of customers) {
        if (!c.package_id || !c.pppoe_username) continue;

        const pkg = customerSvc.getPackageById(c.package_id);
        if (pkg && pkg.use_night_speed === 1) {
          try {
            // Kembali ke profile asli (nama paket)
            const normalProfile = pkg.name;
            logger.info(`[CRON] Restoring ${c.name} to Normal Profile: ${normalProfile}`);
            await mikrotikService.setPppoeProfile(c.pppoe_username, normalProfile, c.router_id);
            count++;
          } catch (err) {
            logger.error(`[CRON] Gagal restore profil normal untuk ${c.name}: ${err.message}`);
          }
        }
      }
      logger.info(`[CRON] Profil normal dikembalikan untuk ${count} pelanggan.`);
    } catch (e) {
      logger.error(`[CRON] Error Jam Kalong End: ${e.message}`);
    }
  });

  // 6. Track Usage Pelanggan (Data Traffic) - Setiap 10 Menit
  cron.schedule('*/10 * * * *', async () => {
    const enabled = getSetting('usage_tracking_enabled', true);
    if (!enabled) return;

    try {
      const routers = mikrotikService.getAllRouters();
      const customers = customerSvc.getAllCustomers();
      const customerMap = new Map();
      customers.forEach(c => { if (c.pppoe_username) customerMap.set(c.pppoe_username, c); });

      for (const r of routers) {
        try {
          const actives = await mikrotikService.getPppoeActive(r.id);
          for (const s of actives) {
            const username = s.name;
            const cust = customerMap.get(username);
            if (!cust) continue;

            const totalIn = parseInt(s['bytes-in']) || 0;
            const totalOut = parseInt(s['bytes-out']) || 0;

            const now = new Date();
            const currentUsage = usageSvc.getUsage(cust.id, now.getMonth()+1, now.getFullYear());

            let deltaIn = 0;
            let deltaOut = 0;

            if (currentUsage) {
              // Jika total bytes saat ini lebih kecil dari sebelumnya, berarti user baru reconnect (counter reset di mikrotik)
              if (totalIn < currentUsage.last_total_bytes_in || totalOut < currentUsage.last_total_bytes_out) {
                deltaIn = totalIn;
                deltaOut = totalOut;
              } else {
                deltaIn = totalIn - currentUsage.last_total_bytes_in;
                deltaOut = totalOut - currentUsage.last_total_bytes_out;
              }
            } else {
              deltaIn = totalIn;
              deltaOut = totalOut;
            }

            if (deltaIn > 0 || deltaOut > 0) {
              usageSvc.updateUsage(cust.id, deltaIn, deltaOut, totalIn, totalOut);
            }
          }
        } catch (err) {
          logger.error(`[CRON] Gagal track usage di router ${r.name}: ${err.message}`);
        }
      }
    } catch (e) {
      logger.error(`[CRON] Error Usage Tracking: ${e.message}`);
    }
  });

  // 7. FUP (Fair Usage Policy) Check - Setiap Jam
  cron.schedule('0 * * * *', async () => {
    logger.info('[CRON] Mengecek FUP Pelanggan...');
    try {
      const customers = customerSvc.getAllCustomers();
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      for (const c of customers) {
        if (!c.package_id || !c.pppoe_username) continue;
        
        const pkg = customerSvc.getPackageById(c.package_id);
        if (!pkg || pkg.use_fup !== 1 || !pkg.fup_limit_gb || pkg.fup_limit_gb <= 0 || !pkg.fup_profile_name) continue;

        const usage = usageSvc.getUsage(c.id, month, year);
        if (!usage) continue;

        const totalGB = (usage.bytes_in + usage.bytes_out) / (1024 * 1024 * 1024);
        
        if (totalGB >= pkg.fup_limit_gb) {
          logger.warn(`[CRON] Pelanggan ${c.name} melewati FUP (${totalGB.toFixed(2)} GB / ${pkg.fup_limit_gb} GB). Menurunkan kecepatan (Ganti Profile)...`);
          
          try {
            // Ganti ke profile FUP yang sudah ditentukan di paket
            logger.info(`[CRON] Switching ${c.name} to FUP Profile: ${pkg.fup_profile_name}`);
            await mikrotikService.setPppoeProfile(c.pppoe_username, pkg.fup_profile_name, c.router_id);
          } catch (err) {
            logger.error(`[CRON] Gagal apply FUP untuk ${c.name}: ${err.message}`);
          }
        }
      }
    } catch (e) {
      logger.error(`[CRON] Error FUP Check: ${e.message}`);
    }
  });

  // 8. GenieACS Device Monitoring & Alerting - Setiap 5 Menit
  cron.schedule('*/5 * * * *', async () => {
    const enabled = getSetting('whatsapp_acs_monitoring_enabled', true);
    const waEnabled = getSetting('whatsapp_enabled', false);
    if (!enabled || !waEnabled) return;

    logger.info('[CRON] Menjalankan pemantauan perangkat GenieACS...');
    try {
      const customerDevice = require('./customerDeviceService');
      const diagnosticsSvc = require('./diagnosticsService');
      const res = await customerDevice.listAllDevices();
      if (!res || !res.ok || !Array.isArray(res.devices)) return;

      const adminPhones = getSetting('whatsapp_admin_numbers', []);
      if (!adminPhones || adminPhones.length === 0) return;

      // First run initialization
      if (acsDeviceStates.size === 0) {
        res.devices.forEach(d => {
          acsDeviceStates.set(d.id, d.isOnline ? 'online' : 'offline');
        });
        logger.info(`[CRON] Monitor GenieACS diinisialisasi dengan ${res.devices.length} perangkat.`);
        return;
      }

      const { sendWA } = await import('./whatsappBot.mjs');

      for (const d of res.devices) {
        const prevStatus = acsDeviceStates.get(d.id);
        const currentStatus = d.isOnline ? 'online' : 'offline';

        if (prevStatus === 'online' && currentStatus === 'offline') {
          // Device went offline (down)
          logger.warn(`[CRON] Perangkat ${d.id} (${d.customerName}) terdeteksi DOWN.`);
          acsDeviceStates.set(d.id, 'offline');

          // Run analysis
          const analysisRes = await diagnosticsSvc.analyzeAcsDeviceDown(d.id);
          let conclusion = 'Tidak merespons (Offline)';
          let details = 'Gagal melakukan analisa mendalam.';
          
          if (analysisRes && analysisRes.success) {
            conclusion = analysisRes.analysis.conclusion;
            details = analysisRes.analysis.diagnostics.map(diag => `• ${diag.message}`).join('\n');
          }

          const waMsg = `🚨 *ALERT: PERANGKAT DOWN (OFFLINE)*\n\n` +
                        `👤 *Pelanggan:* ${d.customerName}\n` +
                        `🎫 *PPPoE User:* ${d.pppoeUsername || '-'}\n` +
                        `📟 *Serial Number:* ${d.serialNumber}\n` +
                        `📋 *Hasil Analisa:* *${conclusion}*\n\n` +
                        `🔍 *Detail Pengecekan:* \n${details}\n\n` +
                        `📅 *Waktu Terakhir Aktif:* ${d.lastInform ? new Date(d.lastInform).toLocaleString('id-ID') : '-'}`;

          // Send WhatsApp notification to all admin numbers
          const seen = new Set();
          for (const adminPhone of adminPhones) {
            let digits = String(adminPhone || '').replace(/\D/g, '');
            if (!digits) continue;
            if (digits.startsWith('0')) digits = '62' + digits.slice(1);
            if (seen.has(digits)) continue;
            seen.add(digits);
            await sendWA(digits, waMsg);
          }
        } else if (prevStatus === 'offline' && currentStatus === 'online') {
          // Device recovered (back online)
          logger.info(`[CRON] Perangkat ${d.id} (${d.customerName}) terdeteksi UP (Kembali Online).`);
          acsDeviceStates.set(d.id, 'online');

          const waMsg = `✅ *RECOVERY: PERANGKAT UP (ONLINE)*\n\n` +
                        `👤 *Pelanggan:* ${d.customerName}\n` +
                        `🎫 *PPPoE User:* ${d.pppoeUsername || '-'}\n` +
                        `📟 *Serial Number:* ${d.serialNumber}\n` +
                        `🟢 Perangkat telah terhubung kembali ke server GenieACS.`;

          // Send WhatsApp notification to all admin numbers
          const seen = new Set();
          for (const adminPhone of adminPhones) {
            let digits = String(adminPhone || '').replace(/\D/g, '');
            if (!digits) continue;
            if (digits.startsWith('0')) digits = '62' + digits.slice(1);
            if (seen.has(digits)) continue;
            seen.add(digits);
            await sendWA(digits, waMsg);
          }
        } else {
          acsDeviceStates.set(d.id, currentStatus);
        }
      }
    } catch (err) {
      logger.error(`[CRON] Error GenieACS Monitoring: ${err.message}`);
    }
  });

  // 9. PPPoE Disconnected & Recovery Monitoring (Telegram Notification) - Setiap 2 Menit
  const pppoeUserStates = new Map();

  cron.schedule('*/2 * * * *', async () => {
    const notifyEnabled = getSetting('telegram_pppoe_notify_enabled', true);
    const tgEnabled = getSetting('telegram_enabled', false);
    if (!notifyEnabled || !tgEnabled) return;

    logger.info('[CRON] Menjalankan pemantauan status PPPoE untuk notifikasi Telegram...');
    try {
      let secrets, active;
      try {
        [secrets, active] = await Promise.all([
          mikrotikService.getPppoeSecrets(),
          mikrotikService.getPppoeActive()
        ]);
      } catch (err) {
        logger.warn(`[CRON] Gagal mengambil data PPPoE dari MikroTik (Skip Notifikasi Telegram): ${err.message}`);
        return;
      }

      if (!Array.isArray(secrets) || !Array.isArray(active)) {
        logger.warn('[CRON] Data PPPoE dari MikroTik tidak valid (Skip Notifikasi Telegram)');
        return;
      }

      const activeMap = new Map();
      active.forEach((row) => {
        const name = String(row && row.name ? row.name : '').trim();
        if (name) activeMap.set(name, row);
      });

      const customers = customerSvc.getAllCustomers();
      const customerMap = new Map();
      (customers || []).forEach((row) => {
        const username = String(row && row.pppoe_username ? row.pppoe_username : '').trim();
        if (username) customerMap.set(username, row);
      });

      // Pengecekan inisialisasi awal (boot pertama kali)
      if (pppoeUserStates.size === 0) {
        secrets.forEach((secret) => {
          const username = String(secret && secret.name ? secret.name : '').trim();
          if (!username) return;
          const isOnline = activeMap.has(username);
          const activeRow = activeMap.get(username);
          pppoeUserStates.set(username, {
            status: isOnline ? 'online' : 'offline',
            lastIp: activeRow ? (activeRow.address || '-') : '-'
          });
        });
        logger.info(`[CRON] State PPPoE Telegram diinisialisasi dengan ${pppoeUserStates.size} user.`);
        return;
      }

      // Loop semua secret aktif
      for (const secret of secrets) {
        const username = String(secret && secret.name ? secret.name : '').trim();
        if (!username) continue;

        // Skip jika secret di-disable oleh admin
        const disabled = secret.disabled === true || secret.disabled === 1 || String(secret.disabled).toLowerCase() === 'true';
        if (disabled) continue;

        const isOnline = activeMap.has(username);
        const activeRow = activeMap.get(username) || null;
        const currentStatus = isOnline ? 'online' : 'offline';

        const prevStateObj = pppoeUserStates.get(username);
        const prevStatus = prevStateObj ? prevStateObj.status : null;
        const lastIp = activeRow ? (activeRow.address || '-') : (prevStateObj ? prevStateObj.lastIp : '-');

        const customer = customerMap.get(username);
        const customerName = customer && customer.name ? customer.name : '-';
        const phone = customer && customer.phone ? customer.phone : '-';
        const profile = secret.profile || (customer && customer.package_name ? customer.package_name : '-');

        if (prevStatus === 'online' && currentStatus === 'offline') {
          logger.warn(`[CRON] PPPoE User ${username} (${customerName}) terdeteksi DISCONNECTED.`);
          pppoeUserStates.set(username, { status: 'offline', lastIp });

          let oltName = customer && customer.olt_name ? customer.olt_name : null;
          let ontStatus = null;
          let offlineReason = null;
          let rxPower = null;

          if (customer && customer.olt_id) {
            try {
              const oltStats = await oltService.getOltStats(customer.olt_id, true);
              if (oltStats) {
                oltName = oltStats.name || oltName;
                if (Array.isArray(oltStats.onus)) {
                  const snTarget = String(customer.genieacs_tag || '').toUpperCase().trim();
                  const userTarget = String(username).toLowerCase().trim();
                  const nameTarget = String(customer.name || '').toLowerCase().trim();

                  const matchedOnu = oltStats.onus.find(o => {
                    const oSn = String(o.sn || '').toUpperCase().trim();
                    const oName = String(o.name || '').toLowerCase().trim();
                    return (snTarget && oSn.length > 3 && oSn.includes(snTarget)) ||
                           (oName && (oName.includes(userTarget) || oName.includes(nameTarget)));
                  });

                  if (matchedOnu) {
                    ontStatus = matchedOnu.status || 'PwrDown / down';
                    offlineReason = matchedOnu.offline_reason || 'Dying_gasp / TIMEOUT / Other';
                    rxPower = matchedOnu.rx || null;
                  }
                }
              }
            } catch (err) {
              logger.warn(`[CRON] Gagal membaca status ONT OLT (${customer.olt_id}) untuk ${username}: ${err.message}`);
            }
          }

          await telegramBot.sendPppoeStatusNotification({
            username,
            customerName,
            phone,
            profile,
            ipAddress: lastIp,
            status: 'offline',
            oltName,
            ontStatus,
            offlineReason,
            rxPower,
            time: getNowLocal()
          });
        } else if (prevStatus === 'offline' && currentStatus === 'online') {
          logger.info(`[CRON] PPPoE User ${username} (${customerName}) terdeteksi RECOVERED (Online).`);
          pppoeUserStates.set(username, { status: 'online', lastIp });

          let oltName = customer && customer.olt_name ? customer.olt_name : null;
          let ontStatus = null;
          let rxPower = null;

          if (customer && customer.olt_id) {
            try {
              const oltStats = await oltService.getOltStats(customer.olt_id, true);
              if (oltStats) {
                oltName = oltStats.name || oltName;
                if (Array.isArray(oltStats.onus)) {
                  const snTarget = String(customer.genieacs_tag || '').toUpperCase().trim();
                  const userTarget = String(username).toLowerCase().trim();
                  const nameTarget = String(customer.name || '').toLowerCase().trim();

                  const matchedOnu = oltStats.onus.find(o => {
                    const oSn = String(o.sn || '').toUpperCase().trim();
                    const oName = String(o.name || '').toLowerCase().trim();
                    return (snTarget && oSn.length > 3 && oSn.includes(snTarget)) ||
                           (oName && (oName.includes(userTarget) || oName.includes(nameTarget)));
                  });

                  if (matchedOnu) {
                    ontStatus = matchedOnu.status || 'Online / UP';
                    rxPower = matchedOnu.rx || null;
                  }
                }
              }
            } catch (err) {
              logger.warn(`[CRON] Gagal membaca status ONT OLT (${customer.olt_id}) untuk ${username}: ${err.message}`);
            }
          }

          await telegramBot.sendPppoeStatusNotification({
            username,
            customerName,
            phone,
            profile,
            ipAddress: lastIp,
            status: 'online',
            oltName,
            ontStatus,
            rxPower,
            time: getNowLocal()
          });
        } else {
          pppoeUserStates.set(username, { status: currentStatus, lastIp });
        }
      }
    } catch (err) {
      logger.error(`[CRON] Error PPPoE Telegram Monitoring: ${err.message}`);
    }
  });

  logger.info('[CRON] Semua tugas penjadwalan telah aktif.');
}

module.exports = { startCronJobs };
