const express = require('express');
const router = express.Router();
const { getSetting, getSettings, formatDateLocal, getNowLocal } = require('../config/settingsManager');
const agentSvc = require('../services/agentService');
const billingSvc = require('../services/billingService');
const customerSvc = require('../services/customerService');
const paymentSvc = require('../services/paymentService');
const db = require('../config/database');

function isEnabledFlag(val) {
  if (val === true || val === 1) return true;
  const s = String(val || '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function isGatewayConfigured(settings, gateway) {
  const g = String(gateway || '').toLowerCase();
  if (!settings) return false;
  if (g === 'tripay') {
    return (
      isEnabledFlag(settings.tripay_enabled) &&
      String(settings.tripay_api_key || '').trim() &&
      String(settings.tripay_private_key || '').trim() &&
      String(settings.tripay_merchant_code || '').trim()
    );
  }
  if (g === 'midtrans') {
    return isEnabledFlag(settings.midtrans_enabled) && String(settings.midtrans_server_key || '').trim();
  }
  if (g === 'xendit') {
    return isEnabledFlag(settings.xendit_enabled) && String(settings.xendit_api_key || '').trim();
  }
  if (g === 'duitku') {
    return (
      isEnabledFlag(settings.duitku_enabled) &&
      String(settings.duitku_merchant_code || '').trim() &&
      String(settings.duitku_api_key || '').trim()
    );
  }
  return false;
}

function resolveConfiguredGateway(settings) {
  const def = String(settings?.default_gateway || 'tripay').toLowerCase();
  const order = ['tripay', 'midtrans', 'xendit', 'duitku'];
  if (isGatewayConfigured(settings, def)) return def;
  for (const g of order) {
    if (isGatewayConfigured(settings, g)) return g;
  }
  return null;
}

function tripayMethodCandidatesForAmount(tripayChannels, amount) {
  const amt = Number(amount || 0) || 0;
  const list = Array.isArray(tripayChannels) ? tripayChannels : [];

  const pickNum = (obj, keys) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v === undefined || v === null || v === '') continue;
      const n = Number(String(v).replace(/[^\d.]/g, ''));
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  };

  const candidates = [];
  for (const ch of list) {
    const code = String(ch?.code || '').toUpperCase();
    if (!code) continue;
    const minAmt = pickNum(ch, ['min_amount', 'minAmount', 'minimum_amount', 'minimumAmount', 'min', 'minimum']);
    const maxAmt = pickNum(ch, ['max_amount', 'maxAmount', 'maximum_amount', 'maximumAmount', 'max', 'maximum']);
    if (minAmt != null && amt < minAmt) continue;
    if (maxAmt != null && amt > maxAmt) continue;
    candidates.push(code);
  }
  return Array.from(new Set(candidates));
}

function requireAgentSession(req, res, next) {
  if (req.session && req.session.isAgent && req.session.agentId) return next();
  return res.redirect('/agent/login');
}

function flashMsg(req) {
  const m = req.session._msg;
  delete req.session._msg;
  return m || null;
}

function popReceipt(req) {
  const r = req.session._agentReceipt;
  delete req.session._agentReceipt;
  return r || null;
}

function company() {
  return getSetting('company_header', 'ISP App');
}

router.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.settings = getSettings();
  res.locals.formatDateLocal = formatDateLocal;
  res.locals.getNowLocal = getNowLocal;
  next();
});

router.get('/login', (req, res) => {
  if (req.session && req.session.isAgent) return res.redirect('/agent');
  res.render('agent/login', { title: 'Login Agent', company: company(), error: null });
});

router.post('/login', express.urlencoded({ extended: true }), (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const agent = agentSvc.authenticate(username, password);
  if (agent) {
    req.session.isAgent = true;
    req.session.agentId = agent.id;
    req.session.agentName = agent.name;
    return res.redirect('/agent');
  }
  return res.render('agent/login', { title: 'Login Agent', company: company(), error: 'Username atau password salah!' });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/agent/login');
});

router.get('/', requireAgentSession, async (req, res) => {
  const agentId = req.session.agentId;
  const agent = agentSvc.getAgentById(agentId);
  const q = String(req.query.q || '').trim();

  const invoices = q ? billingSvc.getInvoicesByAny(q) : [];
  const visibleInvoices = Array.isArray(invoices) ? invoices : [];

  const prices = agentSvc
    .getAgentPrices(agentId)
    .filter(p => p && p.is_active)
    .sort((a, b) => {
      const as = Number(a.sell_price || 0);
      const bs = Number(b.sell_price || 0);
      if (as !== bs) return as - bs;
      const ab = Number(a.buy_price || 0);
      const bb = Number(b.buy_price || 0);
      if (ab !== bb) return ab - bb;
      const ap = String(a.profile_name || '');
      const bp = String(b.profile_name || '');
      return ap.localeCompare(bp);
    });
  const txs = agentSvc.listAgentTransactions({ agentId, limit: 40 });



  // Fetch payment channels
  let paymentChannels = [];
  try {
    const settings = getSettings();
    const gateway = resolveConfiguredGateway(settings);
    if (!gateway) {
      paymentChannels = [];
    } else if (gateway === 'tripay') {
      paymentChannels = await paymentSvc.getTripayChannels();
    } else if (gateway === 'midtrans') {
      paymentChannels = [
        { code: 'SNAP', name: 'Semua Metode (Snap)', group: 'E-Wallet', active: true },
        { code: 'QRIS', name: 'QRIS', group: 'E-Wallet', active: true },
        { code: 'BCAVA', name: 'BCA Virtual Account', group: 'Virtual Account', active: true },
        { code: 'BNIVA', name: 'BNI Virtual Account', group: 'Virtual Account', active: true },
        { code: 'BRIVA', name: 'BRI Virtual Account', group: 'Virtual Account', active: true },
        { code: 'PERMATAVA', name: 'Permata Virtual Account', group: 'Virtual Account', active: true },
        { code: 'MANDIRIVA', name: 'Mandiri Virtual Account', group: 'Virtual Account', active: true }
      ];
    } else if (gateway === 'xendit') {
      paymentChannels = [
        { code: 'XENDIT', name: 'Semua Metode', group: 'E-Wallet', active: true },
        { code: 'QRIS', name: 'QRIS', group: 'E-Wallet', active: true },
        { code: 'BCAVA', name: 'BCA Virtual Account', group: 'Virtual Account', active: true },
        { code: 'BNIVA', name: 'BNI Virtual Account', group: 'Virtual Account', active: true },
        { code: 'BRIVA', name: 'BRI Virtual Account', group: 'Virtual Account', active: true },
        { code: 'PERMATAVA', name: 'Permata Virtual Account', group: 'Virtual Account', active: true },
        { code: 'MANDIRIVA', name: 'Mandiri Virtual Account', group: 'Virtual Account', active: true }
      ];
    } else if (gateway === 'duitku') {
      paymentChannels = [
        { code: 'DUITKU', name: 'Semua Metode', group: 'E-Wallet', active: true },
        { code: 'QRIS', name: 'QRIS', group: 'E-Wallet', active: true },
        { code: 'BCAVA', name: 'BCA Virtual Account', group: 'Virtual Account', active: true },
        { code: 'BNIVA', name: 'BNI Virtual Account', group: 'Virtual Account', active: true },
        { code: 'BRIVA', name: 'BRI Virtual Account', group: 'Virtual Account', active: true },
        { code: 'PERMATAVA', name: 'Permata Virtual Account', group: 'Virtual Account', active: true },
        { code: 'MANDIRIVA', name: 'Mandiri Virtual Account', group: 'Virtual Account', active: true }
      ];
    }
  } catch(e) {
    paymentChannels = [];
  }

  res.render('agent/dashboard', {
    title: 'Dashboard Agent',
    company: company(),
    agent,
    q,
    invoices: visibleInvoices,
    prices,
    txs,

    paymentChannels,
    msg: flashMsg(req),
    receipt: popReceipt(req)
  });
});

router.post('/topup/create', requireAgentSession, express.urlencoded({ extended: true }), async (req, res) => {
  const settings = getSettings();
  const agentId = req.session.agentId;
  const agent = agentSvc.getAgentById(agentId);
  if (!agent) return res.redirect('/agent/login');

  const amount = parseInt(req.body.amount || '0');
  let method = String(req.body.method || 'QRIS').toUpperCase();
  if (!amount || amount < 10000) {
    req.session._msg = { type: 'error', text: 'Minimal top-up Rp 10.000' };
    return res.redirect('/agent');
  }

  try {
    const ins = db.prepare(`INSERT INTO agent_topup_requests (agent_id, amount, status) VALUES (?, ?, 'pending')`).run(agentId, amount);
    const reqId = Number(ins.lastInsertRowid);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const appUrl = settings.app_url || `${protocol}://${req.get('host')}`;
    const gateway = resolveConfiguredGateway(settings);
    if (!gateway) throw new Error('Payment gateway belum dikonfigurasi');
    let tripayChannels = null;
    let tripayCandidates = null;
    if (gateway === 'tripay') {
      try {
        tripayChannels = await paymentSvc.getTripayChannels();
        const allowedList = (tripayChannels || []).map(c => String(c?.code || '').toUpperCase()).filter(Boolean);
        tripayCandidates = tripayMethodCandidatesForAmount(tripayChannels, amount);
        if (!tripayCandidates || tripayCandidates.length === 0) tripayCandidates = allowedList;
        const allowed = new Set(tripayCandidates);
        if (!allowed.has(method)) method = tripayCandidates[0] || 'QRIS';
      } catch {
        method = 'QRIS';
      }
    }

    const invoiceLike = { id: `AGTOP${reqId}`, amount, item_name: `Top-Up Deposit Agent ${agent.name}`, sku: `AGTOP-${reqId}` };
    const buyer = { name: agent.name, phone: agent.phone || '', email: '' };
    const returnPath = `/agent?info=topup_pending`;

    let result;
    if (gateway === 'midtrans') result = await paymentSvc.createMidtransTransaction(invoiceLike, buyer, method === 'SNAP' ? 'snap' : method, appUrl, { returnPath, orderPrefix: 'AGTOP', itemName: invoiceLike.item_name });
    else if (gateway === 'xendit') result = await paymentSvc.createXenditTransaction(invoiceLike, buyer, method === 'XENDIT' ? 'xendit' : method, appUrl, { returnPath, orderPrefix: 'AGTOP', description: invoiceLike.item_name });
    else if (gateway === 'duitku') result = await paymentSvc.createDuitkuTransaction(invoiceLike, buyer, method === 'DUITKU' ? 'duitku' : method, appUrl, { returnPath, orderPrefix: 'AGTOP', itemName: invoiceLike.item_name });
    else {
      try {
        result = await paymentSvc.createTripayTransaction(invoiceLike, buyer, method, appUrl, { returnPath, orderPrefix: 'AGTOP', itemName: invoiceLike.item_name, sku: invoiceLike.sku, callbackPath: '/customer/payment/callback' });
      } catch (e) {
        const msg = String(e?.message || e || '');
        const canRetry =
          (msg.includes('Payment channel is not enabled') || msg.includes('Minimum payment amount')) &&
          Array.isArray(tripayChannels) &&
          tripayChannels.length > 0;
        if (!canRetry) throw e;

        const pool = (tripayCandidates && tripayCandidates.length > 0)
          ? tripayCandidates
          : tripayMethodCandidatesForAmount(tripayChannels, amount);
        const fallback = (pool || []).filter(code => code && code !== method)[0];
        if (!fallback) throw e;

        method = fallback;
        result = await paymentSvc.createTripayTransaction(invoiceLike, buyer, method, appUrl, { returnPath, orderPrefix: 'AGTOP', itemName: invoiceLike.item_name, sku: invoiceLike.sku, callbackPath: '/customer/payment/callback' });
      }
    }

    if (!result.success) throw new Error(result.message || 'Gagal membuat transaksi');

    db.prepare(`UPDATE agent_topup_requests SET payment_gateway=?, payment_order_id=?, payment_link=?, payment_reference=?, payment_payload=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(gateway, result.order_id || '', result.link || '', result.reference || '', result.payload ? JSON.stringify(result.payload) : null, reqId);

    return res.redirect(result.link);
  } catch (e) {
    req.session._msg = { type: 'error', text: 'Gagal: ' + e.message };
    return res.redirect('/agent');
  }
});

router.post('/pay-invoice', requireAgentSession, express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const invoiceId = Number(req.body.invoice_id || 0);
    if (!invoiceId) throw new Error('Invoice ID tidak valid');
    const note = String(req.body.note || '').trim();
    const result = await agentSvc.payInvoiceAsAgent(req.session.agentId, invoiceId, note);

    const customer = customerSvc.getCustomerById(result.invoice.customer_id);
    const settings = { whatsapp_enabled: getSetting('whatsapp_enabled', false) };

    let waSent = false;
    if (settings.whatsapp_enabled && customer && customer.phone) {
      try {
        const { sendWA, whatsappStatus } = await import('../services/whatsappBot.mjs');
        if (whatsappStatus.connection === 'open') {
          const msg =
            `✅ *PEMBAYARAN BERHASIL*\n\n` +
            `👤 *Pelanggan:* ${customer.name}\n` +
            `🧾 *Invoice:* #${result.invoice.id}\n` +
            `📅 *Periode:* ${result.invoice.period_month}/${result.invoice.period_year}\n` +
            `💰 *Nominal Tagihan:* Rp ${Number(result.invoice.amount || 0).toLocaleString('id-ID')}\n` +
            `🏷️ *Dibayar Via:* Agent ${result.agent.name}\n\n` +
            `Terima kasih.`;
          await sendWA(customer.phone, msg);
          waSent = true;
        }
      } catch (e) {}
    }

    req.session._agentReceipt = {
      type: 'invoice',
      tx_id: Number(result.tx?.id || 0),
      created_at: new Date().toISOString(),
      invoice_id: result.invoice.id,
      customer_name: customer?.name || '',
      customer_phone: customer?.phone || '',
      period: `${result.invoice.period_month}/${result.invoice.period_year}`,
      amount: Number(result.invoice.amount || 0),
      cost: Number(result.tx.cost || 0),
      fee: Number(result.tx.fee || 0),
      waSent
    };

    req.session._msg = { type: 'success', text: 'Pembayaran berhasil diproses.' };
  } catch (e) {
    req.session._msg = { type: 'error', text: 'Gagal: ' + e.message };
  }
  res.redirect('/agent');
});

router.post('/sell-voucher', requireAgentSession, express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const priceId = Number(req.body.price_id || 0);
    if (!priceId) throw new Error('Harga voucher tidak valid');
    const buyerPhone = String(req.body.buyer_phone || '').trim();
    const result = await agentSvc.sellVoucherAsAgent(req.session.agentId, priceId, {});

    let waSent = false;
    if (getSetting('whatsapp_enabled', false) && buyerPhone) {
      try {
        const { sendWA, whatsappStatus } = await import('../services/whatsappBot.mjs');
        if (whatsappStatus.connection === 'open') {
          const msg =
            `🎫 *VOUCHER HOTSPOT*\n\n` +
            `📦 *Paket:* ${result.receipt.profile}\n` +
            `${result.receipt.validity ? `⏱️ *Masa Aktif:* ${result.receipt.validity}\n` : ''}` +
            `👤 *User:* ${result.receipt.code}\n` +
            `🔑 *Pass:* ${result.receipt.password}\n` +
            `💰 *Harga:* Rp ${Number(result.receipt.sell_price || 0).toLocaleString('id-ID')}\n\n` +
            `Simpan voucher ini.`;
          await sendWA(buyerPhone, msg);
          waSent = true;
        }
      } catch (e) {}
    }

    req.session._agentReceipt = {
      type: 'voucher',
      tx_id: Number(result.tx?.id || 0),
      created_at: new Date().toISOString(),
      profile: result.receipt.profile,
      validity: result.receipt.validity,
      code: result.receipt.code,
      password: result.receipt.password,
      sell_price: Number(result.receipt.sell_price || 0),
      buy_price: Number(result.price.buy_price || 0),
      waSent,
      buyer_phone: buyerPhone
    };

    req.session._msg = { type: 'success', text: 'Voucher berhasil dibuat.' };
  } catch (e) {
    req.session._msg = { type: 'error', text: 'Gagal: ' + e.message };
  }
  res.redirect('/agent');
});



router.post('/receipt/clear', requireAgentSession, (req, res) => {
  try {
    delete req.session._agentReceipt;
  } catch {}
  res.redirect('/agent');
});

router.get('/print/tx/:id', requireAgentSession, (req, res) => {
  try {
    const txId = Number(req.params.id || 0);
    if (!txId) return res.status(400).send('ID transaksi tidak valid');

    const tx = agentSvc.getAgentTransactionById(req.session.agentId, txId);
    if (!tx) return res.status(404).send('Transaksi tidak ditemukan');

    if (tx.type === 'voucher_sale') {
      const settings = {
        company_address: getSetting('company_address', ''),
        company_phone: getSetting('company_phone', ''),
        whatsapp_admin_numbers: getSetting('whatsapp_admin_numbers', [])
      };
      return res.render('agent/print_thermal_voucher', {
        company: company(),
        settings,
        tx
      });
    }

    if (tx.type === 'invoice_payment') {
      const invoice = billingSvc.getInvoiceById(tx.invoice_id);
      const customer = customerSvc.getCustomerById(tx.customer_id);
      const settings = {
        company_address: getSetting('company_address', ''),
        company_phone: getSetting('company_phone', ''),
        whatsapp_admin_numbers: getSetting('whatsapp_admin_numbers', [])
      };
      return res.render('agent/print_thermal_invoice', {
        company: company(),
        settings,
        tx,
        invoice,
        customer
      });
    }

    return res.status(400).send('Jenis transaksi belum didukung untuk print');
  } catch (e) {
    return res.status(500).send('Gagal print: ' + e.message);
  }
});

module.exports = router;
