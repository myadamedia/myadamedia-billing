const { logger } = require('../config/logger');
const { getSettings } = require('../config/settingsManager');
const techSvc = require('./techService');
const telegramBot = require('./telegramBot');

const waSendDedup = new Map();

/**
 * Normalisasi nomor HP/WhatsApp ke format 62xxx
 * @param {string} input 
 * @returns {string}
 */
function normalizeWaDigits(input) {
  let digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (digits.length < 8) return '';
  return digits;
}

/**
 * Mencegah duplikasi pengiriman pesan WA dalam window waktu singkat
 * @param {string} key 
 * @param {number} ttlMs 
 * @returns {boolean}
 */
function shouldSendWa(key, ttlMs = 15000) {
  const now = Date.now();
  const last = waSendDedup.get(key);
  if (last && (now - last) < ttlMs) return false;
  waSendDedup.set(key, now);

  if (waSendDedup.size > 5000) {
    for (const [k, t] of waSendDedup.entries()) {
      if ((now - t) > 10 * 60 * 1000) waSendDedup.delete(k);
    }
  }
  return true;
}

/**
 * Module Notification Service untuk mengelola pengiriman notifikasi multi-channel (WhatsApp & Telegram)
 */
class NotificationService {
  /**
   * Kirim notifikasi keluhan / tiket baru ke WhatsApp dan Telegram
   * @param {object} params 
   * @param {number|string} params.ticketId - ID Tiket
   * @param {string} params.customerName - Nama Pelanggan / Target
   * @param {string} params.customerPhone - Nomor Telepon Pelanggan
   * @param {string} params.customerAddress - Alamat Pelanggan
   * @param {string} params.subject - Subjek Keluhan
   * @param {string} params.message - Pesan Keluhan
   * @param {number} [params.photoCount=0] - Jumlah Foto Terlampir
   * @param {string} [params.category] - Kategori (Pelanggan / ODP / Umum)
   */
  static async notifyNewTicket(params) {
    const {
      ticketId,
      customerName = 'Unknown',
      customerPhone = '-',
      customerAddress = '-',
      subject = '-',
      message = '-',
      photoCount = 0,
      category = 'Pelanggan'
    } = params;

    const settings = getSettings();
    const photoText = photoCount > 0 ? `\n📸 *Foto Masalah:* ${photoCount} foto terlampir` : '';

    // ─── 1. NOTIFIKASI WHATSAPP ──────────────────────────────────────────────
    if (settings.whatsapp_enabled) {
      try {
        const { sendWA } = await import('./whatsappBot.mjs');

        const waMsg = `🎫 *TIKET KELUHAN BARU*\n\n` +
                      `🔢 *ID Tiket:* #${ticketId || '-'}\n` +
                      `👤 *Pelanggan:* ${customerName}\n` +
                      `📞 *WhatsApp:* ${customerPhone}\n` +
                      `📍 *Alamat:* ${customerAddress}\n` +
                      `🏷️ *Kategori:* ${category}\n` +
                      `📝 *Subjek:* ${subject}\n` +
                      `💬 *Pesan:* ${message}${photoText}\n\n` +
                      `Silakan cek di panel Admin/Teknisi untuk menindaklanjuti.`;

        const recipients = new Set();

        // Admin WhatsApp Numbers
        if (settings.whatsapp_admin_numbers && settings.whatsapp_admin_numbers.length > 0) {
          for (const adminPhone of settings.whatsapp_admin_numbers) {
            const digits = normalizeWaDigits(adminPhone);
            if (digits) recipients.add(digits);
          }
        }

        // Active Technicians
        const technicians = techSvc.getAllTechnicians().filter(t => t.is_active === 1);
        for (const tech of technicians) {
          const digits = normalizeWaDigits(tech.phone);
          if (digits) recipients.add(digits);
        }

        for (const digits of recipients) {
          const key = `ticket:new:${ticketId}:${digits}`;
          if (!shouldSendWa(key)) continue;
          await sendWA(digits, waMsg);
        }
      } catch (waErr) {
        logger.error(`[NotificationService] WA Notification Error: ${waErr.message}`);
      }
    }

    // ─── 2. NOTIFIKASI TELEGRAM ──────────────────────────────────────────────
    if (settings.telegram_enabled && settings.telegram_admin_id) {
      try {
        const tgMsg = `🎫 *TIKET KELUHAN BARU*\n\n` +
                      `🔢 *ID Tiket:* #${ticketId || '-'}\n` +
                      `👤 *Pelanggan:* ${customerName}\n` +
                      `📞 *WhatsApp:* ${customerPhone}\n` +
                      `📍 *Alamat:* ${customerAddress}\n` +
                      `🏷️ *Kategori:* ${category}\n` +
                      `📝 *Subjek:* ${subject}\n` +
                      `💬 *Pesan:* ${message}${photoText}\n\n` +
                      `_Silakan cek panel Admin/Teknisi untuk menindaklanjuti._`;

        await telegramBot.sendTelegramAdminNotification(tgMsg);
      } catch (tgErr) {
        logger.error(`[NotificationService] Telegram Notification Error: ${tgErr.message}`);
      }
    }
  }

  /**
   * Kirim notifikasi penugasan tiket ke teknisi spesifik (WA & Telegram)
   * @param {object} params 
   */
  static async notifyTechnicianAssignment(params) {
    const {
      ticketId,
      technicianPhone,
      technicianName,
      targetText,
      subject,
      message
    } = params;

    const settings = getSettings();

    // 1. WhatsApp to assigned tech
    if (settings.whatsapp_enabled && technicianPhone) {
      try {
        const { sendWA } = await import('./whatsappBot.mjs');
        const digits = normalizeWaDigits(technicianPhone);

        if (digits) {
          const waMessage = `🛠️ *PENUGASAN KELUHAN BARU*\n\n` +
                            `🎫 *ID Tiket:* #${ticketId}\n` +
                            `${targetText}\n` +
                            `📝 *Subjek:* ${subject}\n` +
                            `💬 *Pesan:* ${message}\n\n` +
                            `Silakan segera lakukan pengecekan dan perbaikan di lokasi.`;

          const key = `ticket:assign:${ticketId}:${digits}`;
          if (shouldSendWa(key)) {
            await sendWA(digits, waMessage);
          }
        }
      } catch (waErr) {
        logger.error(`[NotificationService] Tech WA Assignment Error: ${waErr.message}`);
      }
    }

    // 2. Telegram to Admin
    if (settings.telegram_enabled && settings.telegram_admin_id) {
      try {
        const tgMessage = `🛠️ *PENUGASAN KELUHAN BARU*\n\n` +
                          `🎫 *ID Tiket:* #${ticketId}\n` +
                          `👷 *Teknisi:* ${technicianName || '-'}\n` +
                          `${targetText}\n` +
                          `📝 *Subjek:* ${subject}\n` +
                          `💬 *Pesan:* ${message}`;

        await telegramBot.sendTelegramAdminNotification(tgMessage);
      } catch (tgErr) {
        logger.error(`[NotificationService] Tech TG Assignment Error: ${tgErr.message}`);
      }
    }
  }

  /**
   * Kirim notifikasi pembayaran Payment Gateway (WA Pelanggan, WA Admin & Telegram Admin)
   * @param {object} params
   * @param {number|string} [params.invoiceId] - ID Invoice Tagihan
   * @param {string} [params.customerName] - Nama Pelanggan
   * @param {string} [params.customerPhone] - Nomor WhatsApp Pelanggan
   * @param {number} params.amount - Nominal Pembayaran
   * @param {string} [params.period] - Periode Tagihan
   * @param {string} [params.gateway] - Nama Payment Gateway
   * @param {string} [params.paymentOrderNo] - Reference / Order ID dari Gateway
   * @param {string} [params.paymentType] - Jenis Pembayaran ('tagihan', 'topup_customer', 'topup_agent', 'voucher')
   */
  static async notifyPaymentSuccess(params) {
    const {
      invoiceId = null,
      customerName = 'Pelanggan',
      customerPhone = '',
      amount = 0,
      period = '-',
      gateway = 'Payment Gateway',
      paymentOrderNo = '-',
      paymentType = 'tagihan'
    } = params;

    const settings = getSettings();
    const formattedAmount = Number(amount || 0).toLocaleString('id-ID');
    const paymentLabel = paymentType === 'topup_customer'
      ? 'Top-Up Saldo Pelanggan'
      : paymentType === 'topup_agent'
      ? 'Top-Up Deposit Agen'
      : paymentType === 'voucher'
      ? 'Pembelian Voucher Hotspot'
      : `Tagihan Internet (Periode ${period})`;

    // ─── 1. NOTIFIKASI WHATSAPP KE PELANGGAN & ADMIN ─────────────────────────────
    if (settings.whatsapp_enabled) {
      try {
        const { sendWA } = await import('./whatsappBot.mjs');

        // A. Kirim ke Pelanggan (jika nomor HP tersedia)
        const custDigits = normalizeWaDigits(customerPhone);
        if (custDigits) {
          const custKey = `payment:cust:${invoiceId || paymentOrderNo}:${custDigits}`;
          if (shouldSendWa(custKey)) {
            let custMsg = '';
            if (paymentType === 'tagihan') {
              custMsg = `✅ *PEMBAYARAN TAGIHAN BERHASIL (LUNAS)*\n\n` +
                        `Yth. *${customerName}*,\n` +
                        `Pembayaran tagihan internet Anda telah berhasil diterima.\n\n` +
                        `📄 *ID Invoice:* #${invoiceId || paymentOrderNo}\n` +
                        `📅 *Periode:* ${period}\n` +
                        `💰 *Total Bayar:* Rp ${formattedAmount}\n` +
                        `💳 *Metode:* ${gateway}\n` +
                        `⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n` +
                        `Layanan internet Anda aktif. Terima kasih atas kerja samanya.`;
            } else if (paymentType === 'topup_customer') {
              custMsg = `✅ *TOP-UP SALDO BERHASIL*\n\n` +
                        `Yth. *${customerName}*,\n` +
                        `Top-up saldo sebesar *Rp ${formattedAmount}* via *${gateway}* telah berhasil.\n` +
                        `Saldo sudah bertambah dan siap digunakan. Terima kasih!`;
            } else if (paymentType === 'topup_agent') {
              custMsg = `✅ *TOP-UP DEPOSIT AGEN BERHASIL*\n\n` +
                        `Yth. *${customerName}*,\n` +
                        `Deposit sebesar *Rp ${formattedAmount}* via *${gateway}* telah berhasil ditambahkan.\n` +
                        `Terima kasih atas kerja samanya!`;
            }

            if (custMsg) {
              await sendWA(custDigits, custMsg);
            }
          }
        }

        // B. Kirim Alert ke Admin
        const adminWaMsg = `💸 *PEMBAYARAN GATEWAY DITERIMA*\n\n` +
                           `👤 *Pelanggan/User:* ${customerName}\n` +
                           `📞 *No. HP:* ${customerPhone || '-'}\n` +
                           `📦 *Transaksi:* ${paymentLabel}\n` +
                           `📄 *ID / Order Ref:* #${invoiceId || paymentOrderNo}\n` +
                           `💰 *Nominal:* Rp ${formattedAmount}\n` +
                           `💳 *Via Gateway:* ${gateway}\n` +
                           `⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n` +
                           `✅ Status transaksi telah berhasil diproses secara otomatis.`;

        const recipients = new Set();
        if (Array.isArray(settings.whatsapp_admin_numbers)) {
          for (const adminPhone of settings.whatsapp_admin_numbers) {
            const digits = normalizeWaDigits(adminPhone);
            if (digits) recipients.add(digits);
          }
        }

        for (const digits of recipients) {
          const key = `payment:admin:${invoiceId || paymentOrderNo}:${digits}`;
          if (!shouldSendWa(key)) continue;
          await sendWA(digits, adminWaMsg);
        }
      } catch (waErr) {
        logger.error(`[NotificationService] WA Payment Notif Error: ${waErr.message}`);
      }
    }

    // ─── 2. NOTIFIKASI TELEGRAM BOT KE ADMIN ────────────────────────────────────
    if (settings.telegram_enabled && settings.telegram_admin_id) {
      try {
        const tgMsg = `💸 *PEMBAYARAN GATEWAY DITERIMA*\n\n` +
                      `👤 *Pelanggan/User:* ${customerName}\n` +
                      `📞 *No. HP:* ${customerPhone || '-'}\n` +
                      `📦 *Transaksi:* ${paymentLabel}\n` +
                      `📄 *Ref/Order:* #${invoiceId || paymentOrderNo}\n` +
                      `💰 *Nominal:* Rp ${formattedAmount}\n` +
                      `💳 *Via Gateway:* ${gateway}\n` +
                      `⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n` +
                      `_Status transaksi telah berhasil diproses secara otomatis._`;

        await telegramBot.sendTelegramAdminNotification(tgMsg);
      } catch (tgErr) {
        logger.error(`[NotificationService] Telegram Payment Notif Error: ${tgErr.message}`);
      }
    }
  }

  /**
   * Kirim notifikasi pemberitahuan isolir ke pelanggan via WhatsApp
   * @param {number|string|object} customerOrId - Objek pelanggan atau ID pelanggan
   * @param {object} [options]
   * @param {boolean} [options.force=false] - Paksa kirim meskipun send_isolir_reminder === 0
   * @returns {Promise<boolean>}
   */
  static async notifyCustomerIsolated(customerOrId, options = {}) {
    const { force = false } = options;
    const settings = getSettings();

    if (!settings.whatsapp_enabled) {
      return false;
    }

    try {
      const db = require('../config/database');
      let customer = (typeof customerOrId === 'object' && customerOrId !== null)
        ? customerOrId
        : null;

      if (!customer && customerOrId) {
        const customerSvc = require('./customerService');
        customer = customerSvc.getCustomerById(customerOrId);
      }

      if (!customer) {
        logger.warn(`[NotificationService] notifyCustomerIsolated: Data pelanggan tidak ditemukan (${JSON.stringify(customerOrId)})`);
        return false;
      }

      // Cek preferensi opt-in pelanggan kecuali force = true
      if (!force && customer.send_isolir_reminder === 0) {
        logger.info(`[NotificationService] Dilewati: Pelanggan ${customer.name} (ID: ${customer.id}) menonaktifkan pengingat isolir WA.`);
        return false;
      }

      const digits = normalizeWaDigits(customer.phone);
      if (!digits) {
        logger.warn(`[NotificationService] notifyCustomerIsolated: Nomor HP tidak valid/kosong untuk pelanggan ${customer.name} (ID: ${customer.id})`);
        return false;
      }

      // Deduplikasi pencegahan spam (window 30 detik)
      const dedupKey = `customer:isolir:${customer.id}:${digits}`;
      if (!shouldSendWa(dedupKey, 30000)) {
        logger.info(`[NotificationService] notifyCustomerIsolated: Pengiriman diabaikan karena duplikasi window waktu untuk ${digits}`);
        return false;
      }

      const { sendWA } = await import('./whatsappBot.mjs');

      // Ambil tagihan yang belum lunas & hitung totalnya
      const billingSvc = require('./billingService');
      const billingSummary = (billingSvc && typeof billingSvc.getCustomerBillingSummary === 'function')
        ? billingSvc.getCustomerBillingSummary(customer.id)
        : (billingSvc && typeof billingSvc.getUnpaidInvoicesByCustomerId === 'function')
          ? { totalTagihan: billingSvc.getUnpaidInvoicesByCustomerId(customer.id).reduce((s, i) => s + (i.balance_due > 0 ? i.balance_due : i.amount), 0) }
          : { totalTagihan: 0 };
      const totalTagihan = Number(billingSummary.totalTagihan) || 0;
      const invoiceAmountToDisplay = totalTagihan > 0
        ? totalTagihan
        : (Number(customer.package_price) || 0);

      // Resolusi Link Portal Pelanggan
      const explicitBaseUrl = String(settings.public_base_url || '').trim();
      let baseUrl = explicitBaseUrl.replace(/\/+$/, '');
      if (!baseUrl) {
        const hostRaw = String(settings.server_host || 'localhost').trim();
        const port = Number(settings.server_port || 3001);
        const proto = port === 443 ? 'https' : 'http';
        const host = /^https?:\/\//i.test(hostRaw) ? hostRaw.replace(/\/+$/, '') : `${proto}://${hostRaw}`;
        baseUrl = (port === 80 || port === 443) ? host : `${host}:${port}`;
      }
      const loginLink = `${baseUrl}/customer/login`;
      const customerFormattedId = 'MDE-' + String(customer.id).padStart(4, '0');
      const companyHeader = String(settings.company_header || 'ISP Provider');
      const packageName = customer.package_name || (customer.package_id ? (require('./customerService').getPackageById(customer.package_id)?.name || '-') : '-');
      const isolateDay = customer.isolate_day || settings.isolir_day || 10;

      const defaultIsolir = `Yth. Pelanggan {{nama}} ({{id_pelanggan}}),\n\nLayanan internet Anda (Paket {{paket}}) saat ini ditangguhkan (Terisolir) karena belum melunasi tagihan sebesar *Rp {{tagihan}}*.\n\nSilakan lakukan pembayaran segera melalui portal pelanggan: {{link}}\n\nTerima kasih.`;
      const template = (db && typeof db.getAppSetting === 'function')
        ? String(db.getAppSetting('whatsapp_isolir_message', defaultIsolir) || defaultIsolir)
        : defaultIsolir;

      const formattedMsg = template
        .replace(/{{id_pelanggan}}/gi, customerFormattedId)
        .replace(/{{nama}}/gi, customer.name || 'Pelanggan')
        .replace(/{{paket}}/gi, packageName)
        .replace(/{{tagihan}}/gi, invoiceAmountToDisplay.toLocaleString('id-ID'))
        .replace(/{{link}}/gi, loginLink)
        .replace(/{{jatuh_tempo}}/gi, String(isolateDay))
        .replace(/{{perusahaan}}|{{company}}/gi, companyHeader);

      const sendResult = await sendWA(digits, formattedMsg);
      if (sendResult) {
        logger.info(`[NotificationService] Notifikasi isolir berhasil dikirim ke pelanggan ${customer.name} (${digits})`);
      }
      return Boolean(sendResult);
    } catch (err) {
      logger.error(`[NotificationService] notifyCustomerIsolated Error: ${err.message}`);
      return false;
    }
  }
}

module.exports = NotificationService;

