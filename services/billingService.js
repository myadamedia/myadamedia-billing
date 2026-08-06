/**
 * Service: Logika Billing & Tagihan
 */
const db = require('../config/database');
const auditTrail = require('./auditTrailService');
const { getCurrentDateInTimezone } = require('../config/settingsManager');

function daysInMonth(year, month1to12) {
  return new Date(year, month1to12, 0).getDate();
}

function parseInstallYMD(installDate) {
  if (!installDate || typeof installDate !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(installDate.trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function countInvoicesForCustomer(customerId) {
  const r = db.prepare('SELECT COUNT(*) as c FROM invoices WHERE customer_id=?').get(customerId);
  return r ? Number(r.c) || 0 : 0;
}

/**
 * Hitung nominal tagihan + catatan otomatis (promo siklus & prorata bulan pertama).
 * Promo: pakai promo_price untuk N invoice pertama per pelanggan (promo_cycles), lalu harga normal.
 * Prorata: jika paket mengaktifkan prorate_first_invoice, belum pernah ada invoice,
 *          tanggal pasang (install_date) di bulan/tahun tagihan yang sama → proporsi sisa hari bulan.
 */
function computeInvoiceAmountAndMeta(customer, pkg, periodMonth, periodYear) {
  const price = Number(pkg.price) || 0;
  const promoRaw = pkg.promo_price;
  const promoPrice = promoRaw != null && promoRaw !== '' ? Number(promoRaw) : null;
  const promoCycles = Math.max(0, parseInt(pkg.promo_cycles, 10) || 0);
  const promoUsed = Math.max(0, parseInt(customer.promo_cycles_used, 10) || 0);
  const prorateEnabled = !!pkg.prorate_first_invoice;

  const usePromo = promoPrice != null && Number.isFinite(promoPrice) && promoCycles > 0 && promoUsed < promoCycles;
  let amount = usePromo ? promoPrice : price;

  const priorCount = countInvoicesForCustomer(customer.id);
  const isFirstEverInvoice = priorCount === 0;
  let prorated = false;
  let billableDays = null;
  let dim = null;

  if (prorateEnabled && isFirstEverInvoice && customer.install_date) {
    const inst = parseInstallYMD(String(customer.install_date));
    if (inst && inst.y === periodYear && inst.m === periodMonth) {
      dim = daysInMonth(periodYear, periodMonth);
      billableDays = Math.min(dim, Math.max(1, dim - inst.d + 1));
      amount = Math.round(amount * (billableDays / dim));
      prorated = billableDays < dim;
    }
  }

  const baseAmount = amount;
  let taxAmount = 0;
  const metaParts = [];
  
  if (usePromo) {
    metaParts.push(`Promo siklus ${promoUsed + 1}/${promoCycles} @ Rp ${Number(promoPrice).toLocaleString('id-ID')}`);
  }
  if (prorated && billableDays != null && dim != null) {
    metaParts.push(`Prorata ${billableDays}/${dim} hari`);
  }

  // Installation Fee
  const installFee = Number(customer.installation_fee) || 0;
  let hasInstallFee = false;
  if (isFirstEverInvoice && installFee > 0) {
    hasInstallFee = true;
    metaParts.push(`Biaya Inst: Rp ${installFee.toLocaleString('id-ID')}`);
  }

  // PPN Calculation
  if (pkg.use_ppn === 1) {
    const ppnPct = Number(pkg.ppn_percentage) || 11.0;
    const ppnVal = Math.round(baseAmount * (ppnPct / 100));
    taxAmount += ppnVal;
    metaParts.push(`PPN ${ppnPct}% (Rp ${ppnVal.toLocaleString('id-ID')})`);
  }

  // USO Calculation
  if (pkg.use_uso === 1) {
    const usoPct = Number(pkg.uso_percentage) || 1.75;
    const usoVal = Math.round(baseAmount * (usoPct / 100));
    taxAmount += usoVal;
    metaParts.push(`USO ${usoPct}% (Rp ${usoVal.toLocaleString('id-ID')})`);
  }

  // Hitung Sisa Tagihan (Tunggakan) Bulan Lalu yang Belum Lunas
  let carriedBalance = 0;
  try {
    const arrearsRow = db.prepare(`
      SELECT SUM(CASE WHEN balance_due > 0 THEN balance_due ELSE (amount - COALESCE(paid_amount,0)) END) as total_arrears
      FROM invoices
      WHERE customer_id = ? AND status IN ('unpaid', 'partial')
        AND (period_year < ? OR (period_year = ? AND period_month < ?))
    `).get(customer.id, periodYear, periodYear, periodMonth);
    
    if (arrearsRow && arrearsRow.total_arrears > 0) {
      carriedBalance = Math.round(Number(arrearsRow.total_arrears));
      metaParts.push(`Sisa Tagihan Lalu: Rp ${carriedBalance.toLocaleString('id-ID')}`);
    }
  } catch (e) {
    console.error('[Billing] Gagal kalkulasi carried_balance:', e.message);
  }

  const packageTotal = baseAmount + taxAmount + (hasInstallFee ? installFee : 0);
  const notesAuto = metaParts.length ? `AUTO: ${metaParts.join(' | ')}` : '';

  return {
    amount: Math.max(0, Math.round(packageTotal)),
    packageTotal: Math.max(0, Math.round(packageTotal)),
    carriedBalance,
    bumpPromo: usePromo,
    notesAuto
  };
}

function generateMonthlyInvoices(month, year) {
  const customers = db.prepare("SELECT * FROM customers WHERE status IN ('active','suspended') AND package_id IS NOT NULL").all();
  const existing  = db.prepare('SELECT customer_id FROM invoices WHERE period_month=? AND period_year=?').all(month, year);
  const existingIds = new Set(existing.map(e => e.customer_id));
  const insert = db.prepare(`INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, carried_balance, notes) VALUES (?, ?, ?, ?, 0, ?, ?, ?)`);
  const bumpPromo = db.prepare('UPDATE customers SET promo_cycles_used = COALESCE(promo_cycles_used,0) + 1 WHERE id=?');
  let created = 0;
  const run = db.transaction(() => {
    for (const c of customers) {
      if (existingIds.has(c.id)) continue;
      const pkg = db.prepare('SELECT * FROM packages WHERE id=?').get(c.package_id);
      if (!pkg) continue;
      const { amount, carriedBalance, bumpPromo: bump, notesAuto } = computeInvoiceAmountAndMeta(c, pkg, month, year);
      insert.run(c.id, month, year, amount, amount, carriedBalance, notesAuto);
      if (bump) bumpPromo.run(c.id);
      created++;
    }
  });
  run();
  return created;
}

function generateInvoiceForCustomer(customerId, month, year) {
  const cid = Number(customerId);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isFinite(cid) || cid <= 0) throw new Error('Customer ID tidak valid');
  if (!Number.isFinite(m) || m < 1 || m > 12) throw new Error('Bulan tidak valid');
  if (!Number.isFinite(y) || y < 2000 || y > 3000) throw new Error('Tahun tidak valid');

  const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!customer) throw new Error('Pelanggan tidak ditemukan');
  if (!customer.package_id) throw new Error('Pelanggan belum memiliki paket');

  const exists = db.prepare('SELECT id FROM invoices WHERE customer_id=? AND period_month=? AND period_year=? LIMIT 1').get(cid, m, y);
  if (exists) {
    return { created: false, invoiceId: exists.id, customerName: customer.name };
  }

  const pkg = db.prepare('SELECT * FROM packages WHERE id=?').get(customer.package_id);
  if (!pkg) throw new Error('Paket pelanggan tidak ditemukan');

  const { amount, carriedBalance, bumpPromo: bump, notesAuto } = computeInvoiceAmountAndMeta(customer, pkg, m, y);
  const r = db.prepare('INSERT INTO invoices (customer_id, period_month, period_year, amount, paid_amount, balance_due, carried_balance, notes) VALUES (?, ?, ?, ?, 0, ?, ?, ?)').run(cid, m, y, amount, amount, carriedBalance, notesAuto);
  if (bump) {
    db.prepare('UPDATE customers SET promo_cycles_used = COALESCE(promo_cycles_used,0) + 1 WHERE id=?').run(cid);
  }
  return { created: true, invoiceId: r.lastInsertRowid, customerName: customer.name };
}

/**
  * Engine Pembayaran FIFO Waterfall
  * Melakukan alokasi pembayaran secara urut dari invoice terlama (period_year ASC, period_month ASC)
  */
function processCustomerPayment(customerId, amount, paidByName, notes, actor = null) {
  const cid = Number(customerId);
  let remainingPayment = Number(amount) || 0;
  if (!Number.isFinite(cid) || cid <= 0) throw new Error('Customer ID tidak valid');
  if (remainingPayment <= 0) throw new Error('Nominal pembayaran harus lebih besar dari 0');

  const customer = db.prepare('SELECT id, name, phone FROM customers WHERE id=?').get(cid);
  if (!customer) throw new Error('Pelanggan tidak ditemukan');

  const unpaidInvoices = db.prepare(`
    SELECT * FROM invoices
    WHERE customer_id = ? AND status IN ('unpaid', 'partial')
    ORDER BY period_year ASC, period_month ASC, id ASC
  `).all(cid);

  if (unpaidInvoices.length === 0) {
    throw new Error('Pelanggan tidak memiliki tagihan aktif yang belum dibayar');
  }

  const results = [];
  const run = db.transaction(() => {
    for (const inv of unpaidInvoices) {
      if (remainingPayment <= 0) break;

      const totalAmt = Number(inv.amount || 0);
      const currentPaid = Number(inv.paid_amount || 0);
      const currentDue = inv.balance_due > 0 ? Number(inv.balance_due) : Math.max(0, totalAmt - currentPaid);

      if (currentDue <= 0) continue;

      const alloc = Math.min(remainingPayment, currentDue);
      const newPaid = currentPaid + alloc;
      const newDue = Math.max(0, totalAmt - newPaid);
      const newStatus = newDue === 0 ? 'paid' : 'partial';

      const noteSuffix = `[Bayar Rp ${alloc.toLocaleString('id-ID')} via ${paidByName || 'Admin'}]`;
      const combinedNotes = notes
        ? (inv.notes ? `${inv.notes} | ${notes} ${noteSuffix}` : `${notes} ${noteSuffix}`)
        : (inv.notes ? `${inv.notes} | ${noteSuffix}` : noteSuffix);

      db.prepare(`
        UPDATE invoices
        SET paid_amount = ?,
            balance_due = ?,
            status = ?,
            paid_at = NOW_LOCAL(),
            paid_by_name = ?,
            notes = ?
        WHERE id = ?
      `).run(newPaid, newDue, newStatus, paidByName || 'Admin', combinedNotes, inv.id);

      remainingPayment -= alloc;

      results.push({
        invoiceId: inv.id,
        period: `${inv.period_month}/${inv.period_year}`,
        allocated: alloc,
        newPaid,
        newDue,
        newStatus
      });

      if (actor) {
        auditTrail.logAuditTrail({
          action: newStatus === 'paid' ? 'MARK_INVOICE_PAID' : 'RECORD_PARTIAL_PAYMENT',
          entity_type: 'invoice',
          entity_id: String(inv.id),
          actor_type: actor.type || 'unknown',
          actor_id: actor.id || null,
          actor_name: actor.name || null,
          details: {
            customer_id: cid,
            period: `${inv.period_month}/${inv.period_year}`,
            allocated: alloc,
            total_paid: newPaid,
            balance_due: newDue,
            status: newStatus,
            paid_by: paidByName || 'Admin'
          },
          ip_address: actor.ip || null,
          user_agent: actor.userAgent || null
        });
      }
    }
  });

  run();

  return {
    customerId: cid,
    customerName: customer.name,
    totalPaid: Number(amount) - remainingPayment,
    remainingPayment,
    processedInvoices: results
  };
}

function payInvoiceForCustomerPeriod(customerId, month, year, paidByName, notes) {
  const cid = Number(customerId);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isFinite(cid) || cid <= 0) throw new Error('Customer ID tidak valid');
  if (!Number.isFinite(m) || m < 1 || m > 12) throw new Error('Bulan tidak valid');
  if (!Number.isFinite(y) || y < 2000 || y > 3000) throw new Error('Tahun tidak valid');

  const customer = db.prepare('SELECT id, name FROM customers WHERE id=?').get(cid);
  if (!customer) throw new Error('Pelanggan tidak ditemukan');

  const inv = db.prepare('SELECT id, status FROM invoices WHERE customer_id=? AND period_month=? AND period_year=? LIMIT 1').get(cid, m, y);
  if (inv && inv.status === 'paid') {
    return { created: false, paid: false, alreadyPaid: true, invoiceId: inv.id, customerName: customer.name };
  }

  const ensure = generateInvoiceForCustomer(cid, m, y);
  markAsPaid(ensure.invoiceId, paidByName, notes);
  return { created: ensure.created, paid: true, alreadyPaid: false, invoiceId: ensure.invoiceId, customerName: ensure.customerName };
}

function payInvoicesForCustomerMonths(customerId, year, months, paidByName, notes) {
  const cid = Number(customerId);
  const y = Number(year);
  if (!Number.isFinite(cid) || cid <= 0) throw new Error('Customer ID tidak valid');
  if (!Number.isFinite(y) || y < 2000 || y > 3000) throw new Error('Tahun tidak valid');

  const rawMonths = Array.isArray(months) ? months : (months == null ? [] : [months]);
  const selectedMonths = [...new Set(rawMonths.map(m => parseInt(m)).filter(m => Number.isFinite(m) && m >= 1 && m <= 12))].sort((a, b) => a - b);
  if (selectedMonths.length === 0) throw new Error('Pilih minimal 1 bulan');

  const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!customer) throw new Error('Pelanggan tidak ditemukan');
  if (!customer.package_id) throw new Error('Pelanggan belum memiliki paket');

  const pkg = db.prepare('SELECT * FROM packages WHERE id=?').get(customer.package_id);
  if (!pkg) throw new Error('Paket pelanggan tidak ditemukan');

  const selectInv = db.prepare('SELECT id, status, amount FROM invoices WHERE customer_id=? AND period_month=? AND period_year=? LIMIT 1');
  const insertInv = db.prepare('INSERT INTO invoices (customer_id, period_month, period_year, amount, notes) VALUES (?, ?, ?, ?, ?)');
  const bumpPromo = db.prepare('UPDATE customers SET promo_cycles_used = COALESCE(promo_cycles_used,0) + 1 WHERE id=?');
  const payInv = db.prepare(`UPDATE invoices SET status='paid', paid_at=NOW_LOCAL(), paid_by_name=?, notes=? WHERE id=?`);

  const summary = { customerName: customer.name, year: y, paidMonths: [], alreadyPaidMonths: [], createdMonths: [], totalAmount: 0, totalMonths: 0 };
  const run = db.transaction(() => {
    for (const m of selectedMonths) {
      const inv = selectInv.get(cid, m, y);
      if (inv && inv.status === 'paid') {
        summary.alreadyPaidMonths.push(m);
        continue;
      }
      let invoiceId = inv ? inv.id : null;
      let amount = inv ? Number(inv.amount) : 0;
      if (!invoiceId) {
        const { amount: computed, bumpPromo: bump, notesAuto } = computeInvoiceAmountAndMeta(customer, pkg, m, y);
        const r = insertInv.run(cid, m, y, computed, notesAuto);
        invoiceId = r.lastInsertRowid;
        summary.createdMonths.push(m);
        amount = computed;
        if (bump) bumpPromo.run(cid);
      }
      payInv.run(paidByName || 'Admin', notes || '', invoiceId);
      summary.paidMonths.push(m);
      summary.totalAmount += (Number.isFinite(amount) ? amount : 0);
      summary.totalMonths += 1;
    }
  });
  run();

  return summary;
}

function getPaidMonthsForCustomerYear(customerId, year) {
  const cid = Number(customerId);
  const y = Number(year);
  if (!Number.isFinite(cid) || cid <= 0) throw new Error('Customer ID tidak valid');
  if (!Number.isFinite(y) || y < 2000 || y > 3000) throw new Error('Tahun tidak valid');
  const rows = db.prepare(`
    SELECT period_month
    FROM invoices
    WHERE customer_id=? AND period_year=? AND status='paid'
    ORDER BY period_month ASC
  `).all(cid, y);
  return rows.map(r => r.period_month);
}

function getCustomerBillingYearSummary(customerId, year) {
  const cid = Number(customerId);
  const y = Number(year);
  if (!Number.isFinite(cid) || cid <= 0) throw new Error('Customer ID tidak valid');
  if (!Number.isFinite(y) || y < 2000 || y > 3000) throw new Error('Tahun tidak valid');

  const customer = db.prepare(`
    SELECT c.id, c.name, p.price as package_price
    FROM customers c
    LEFT JOIN packages p ON c.package_id = p.id
    WHERE c.id=?
  `).get(cid);
  if (!customer) throw new Error('Pelanggan tidak ditemukan');

  const invoices = db.prepare(`
    SELECT period_month as month, status, amount
    FROM invoices
    WHERE customer_id=? AND period_year=?
    ORDER BY period_month ASC
  `).all(cid, y);

  return {
    customerId: customer.id,
    customerName: customer.name,
    year: y,
    packagePrice: customer.package_price || 0,
    invoices
  };
}

function getAllInvoices({ month, year, status, search, sortBy = 'period_desc', limit = 300 } = {}) {
  let q = `
    SELECT i.*, c.name as customer_name, c.phone as customer_phone, c.genieacs_tag, c.isolate_day, p.name as package_name
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN packages p ON c.package_id = p.id
    WHERE 1=1
  `;
  const params = [];
  if (month)  { q += ' AND i.period_month=?'; params.push(parseInt(month)); }
  if (year)   { q += ' AND i.period_year=?';  params.push(parseInt(year)); }
  if (status && status !== 'all') { q += ' AND i.status=?'; params.push(status); }
  if (search) {
    q += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.genieacs_tag LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  // Safe mapping for invoice sorting options to prevent SQL injection
  const sortingClauses = {
    'period_desc': 'i.period_year DESC, i.period_month DESC, c.name ASC',
    'period_asc': 'i.period_year ASC, i.period_month ASC, c.name ASC',
    'name_asc': 'c.name ASC, i.period_year DESC, i.period_month DESC',
    'name_desc': 'c.name DESC, i.period_year DESC, i.period_month DESC',
    'amount_desc': 'i.amount DESC, c.name ASC',
    'amount_asc': 'i.amount ASC, c.name ASC',
    'cust_id_desc': 'i.customer_id DESC, i.period_year DESC',
    'cust_id_asc': 'i.customer_id ASC, i.period_year DESC'
  };

  const orderClause = sortingClauses[sortBy] || 'i.period_year DESC, i.period_month DESC, c.name ASC';

  q += ` ORDER BY ${orderClause} LIMIT ${parseInt(limit)}`;
  return db.prepare(q).all(...params);
}

function getInvoiceById(id) {
  return db.prepare(`
    SELECT i.*, c.name as customer_name, c.phone as customer_phone, c.address, c.genieacs_tag, c.isolate_day,
           p.name as package_name
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN packages p ON c.package_id = p.id
    WHERE i.id = ?
  `).get(id);
}
function recordPartialPayment(invoiceId, paidAmount, paidByName, notes, actor = null) {
  const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(invoiceId);
  if (!inv) throw new Error('Invoice tidak ditemukan');
  if (inv.status === 'paid') throw new Error('Invoice ini sudah lunas');

  const payment = Number(paidAmount) || 0;
  if (payment <= 0) throw new Error('Nominal pembayaran harus lebih besar dari 0');

  const currentPaid = Number(inv.paid_amount || 0);
  const totalAmount = Number(inv.amount || 0);
  const newPaid = Math.min(totalAmount, currentPaid + payment);
  const newDue = Math.max(0, totalAmount - newPaid);
  const newStatus = newDue === 0 ? 'paid' : 'partial';

  const noteSuffix = `[Bayar Parsial Rp ${payment.toLocaleString('id-ID')} via ${paidByName || 'Admin'}]`;
  const combinedNotes = notes 
    ? (inv.notes ? `${inv.notes} | ${notes} ${noteSuffix}` : `${notes} ${noteSuffix}`)
    : (inv.notes ? `${inv.notes} | ${noteSuffix}` : noteSuffix);

  const result = db.prepare(`
    UPDATE invoices 
    SET paid_amount = ?,
        balance_due = ?,
        status = ?,
        paid_at = NOW_LOCAL(),
        paid_by_name = ?,
        notes = ?
    WHERE id = ?
  `).run(newPaid, newDue, newStatus, paidByName || 'Admin', combinedNotes, invoiceId);

  if (result.changes > 0 && actor) {
    auditTrail.logAuditTrail({
      action: newStatus === 'paid' ? 'MARK_INVOICE_PAID' : 'RECORD_PARTIAL_PAYMENT',
      entity_type: 'invoice',
      entity_id: String(invoiceId),
      actor_type: actor.type || 'unknown',
      actor_id: actor.id || null,
      actor_name: actor.name || null,
      details: {
        customer_id: inv.customer_id,
        period: `${inv.period_month}/${inv.period_year}`,
        amount_paid_now: payment,
        total_paid: newPaid,
        balance_due: newDue,
        status: newStatus,
        paid_by: paidByName || 'Admin',
        notes: notes || ''
      },
      ip_address: actor.ip || null,
      user_agent: actor.userAgent || null
    });
  }

  return { success: true, newStatus, newPaid, newDue };
}

function markAsPaid(invoiceId, paidByName, notes, actor = null) {
  const inv = db.prepare('SELECT amount FROM invoices WHERE id=?').get(invoiceId);
  const totalAmount = inv ? Number(inv.amount || 0) : 0;

  const result = db.prepare(`
    UPDATE invoices SET status='paid', paid_amount=?, balance_due=0, paid_at=NOW_LOCAL(), paid_by_name=?, notes=? WHERE id=?
  `).run(totalAmount, paidByName || 'Admin', notes || '', invoiceId);

  // Catat audit trail jika berhasil
  if (result.changes > 0 && actor) {
    const invoice = db.prepare('SELECT id, customer_id, period_month, period_year, amount FROM invoices WHERE id=?').get(invoiceId);
    if (invoice) {
      auditTrail.logAuditTrail({
        action: 'MARK_INVOICE_PAID',
        entity_type: 'invoice',
        entity_id: String(invoiceId),
        actor_type: actor.type || 'unknown',
        actor_id: actor.id || null,
        actor_name: actor.name || null,
        details: {
          customer_id: invoice.customer_id,
          period: `${invoice.period_month}/${invoice.period_year}`,
          amount: invoice.amount,
          paid_by: paidByName || 'Admin',
          notes: notes || ''
        },
        ip_address: actor.ip || null,
        user_agent: actor.userAgent || null
      });
    }
  }

  return result;
}

function markAsUnpaid(invoiceId) {
  const inv = db.prepare('SELECT amount FROM invoices WHERE id=?').get(invoiceId);
  const totalAmount = inv ? Number(inv.amount || 0) : 0;
  return db.prepare(`UPDATE invoices SET status='unpaid', paid_amount=0, balance_due=?, paid_at=NULL, paid_by_name='', notes='' WHERE id=?`).run(totalAmount, invoiceId);
}

function deleteInvoice(id, actor = null) {
  const invoice = db.prepare('SELECT id, customer_id, period_month, period_year, amount FROM invoices WHERE id=?').get(id);
  const result = db.prepare('DELETE FROM invoices WHERE id=?').run(id);

  // Catat audit trail jika berhasil
  if (result.changes > 0 && actor && invoice) {
    auditTrail.logAuditTrail({
      action: 'DELETE_INVOICE',
      entity_type: 'invoice',
      entity_id: String(id),
      actor_type: actor.type || 'unknown',
      actor_id: actor.id || null,
      actor_name: actor.name || null,
      details: {
        customer_id: invoice.customer_id,
        period: `${invoice.period_month}/${invoice.period_year}`,
        amount: invoice.amount
      },
      ip_address: actor.ip || null,
      user_agent: actor.userAgent || null
    });
  }

  return result;
}

function getInvoiceSummary(month, year) {
  const total  = db.prepare('SELECT COUNT(*) as count, SUM(amount) as total FROM invoices WHERE period_month=? AND period_year=?').get(month, year);
  const paid   = db.prepare("SELECT COUNT(*) as count, SUM(COALESCE(paid_amount, amount)) as total FROM invoices WHERE period_month=? AND period_year=? AND status='paid'").get(month, year);
  const unpaid = db.prepare("SELECT COUNT(*) as count, SUM(CASE WHEN balance_due > 0 THEN balance_due ELSE amount END) as total FROM invoices WHERE period_month=? AND period_year=? AND status IN ('unpaid', 'partial')").get(month, year);
  return { total, paid, unpaid };
}

function getMonthlyRevenue(year) {
  return db.prepare(`
    SELECT period_month as month,
           SUM(CASE WHEN status='paid' THEN amount ELSE COALESCE(paid_amount,0) END) as revenue,
           COUNT(*) as total_invoices,
           SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid_count,
           SUM(CASE WHEN status IN ('unpaid', 'partial') THEN 1 ELSE 0 END) as unpaid_count
    FROM invoices WHERE period_year=?
    GROUP BY period_month ORDER BY period_month
  `).all(year);
}

function getDashboardStats() {
  const now = getCurrentDateInTimezone();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  const totalRevenue  = db.prepare("SELECT SUM(COALESCE(paid_amount, CASE WHEN status='paid' THEN amount ELSE 0 END)) as t FROM invoices").get();
  const thisMonth     = db.prepare("SELECT SUM(COALESCE(paid_amount, CASE WHEN status='paid' THEN amount ELSE 0 END)) as t FROM invoices WHERE period_month=? AND period_year=?").get(m, y);
  const pendingAmount = db.prepare("SELECT SUM(CASE WHEN balance_due > 0 THEN balance_due ELSE (CASE WHEN status != 'paid' THEN amount ELSE 0 END) END) as t FROM invoices WHERE status IN ('unpaid', 'partial')").get();
  const unpaidCount   = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE status IN ('unpaid', 'partial')").get();
  return {
    totalRevenue:  totalRevenue.t  || 0,
    thisMonth:     thisMonth.t     || 0,
    pendingAmount: pendingAmount.t || 0,
    unpaidCount:   unpaidCount.c   || 0,
  };
}

function getRecentPayments(limit = 8) {
  return db.prepare(`
    SELECT i.*, c.name as customer_name FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.status IN ('paid', 'partial') AND COALESCE(i.paid_amount, 0) > 0 ORDER BY i.paid_at DESC LIMIT ?
  `).all(limit);
}

function getTopUnpaid(limit = 5) {
  return db.prepare(`
    SELECT c.name, c.phone, COUNT(*) as unpaid_count, SUM(CASE WHEN i.balance_due > 0 THEN i.balance_due ELSE i.amount END) as total_unpaid
    FROM invoices i JOIN customers c ON i.customer_id = c.id
    WHERE i.status IN ('unpaid', 'partial')
    GROUP BY c.id ORDER BY total_unpaid DESC LIMIT ?
  `).all(limit);
}

function getInvoicesByAny(val) {
  if (!val) return [];
  const raw = String(val || '').trim();
  const cleanVal = raw.replace(/\D/g, '');
  
  // Find customer ID first using phone, pppoe, or genieacs_tag
  let customer = null;
  
  if (cleanVal.length >= 8) {
    customer = db.prepare(`SELECT id FROM customers WHERE phone LIKE ?`).get(`%${cleanVal}%`);
  }
  
  if (!customer) {
    const mdeMatch = raw.match(/^MDE-(\d+)$/i);
    const searchId = mdeMatch ? parseInt(mdeMatch[1]) : (/^\d+$/.test(raw) && raw.length < 8 ? parseInt(raw) : null);
    if (searchId !== null) {
      customer = db.prepare(`SELECT id FROM customers WHERE id = ?`).get(searchId);
    }
  }
  if (!customer) {
    customer = db.prepare(`SELECT id FROM customers WHERE pppoe_username = ? OR genieacs_tag = ?`).get(raw, raw);
  }

  if (customer) {
    return db.prepare(`
      SELECT i.*,
             c.name as customer_name,
             c.phone as customer_phone,
             c.address as customer_address,
             c.pppoe_username,
             c.genieacs_tag,
             c.connection_type,
             c.static_ip,
             c.status as customer_status,
             c.router_id,
             c.install_date,
             c.isolate_day,
             c.isolir_profile,
             p.name as package_name,
             p.price as package_price,
             r.name as router_name
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN packages p ON c.package_id = p.id
      LEFT JOIN routers r ON c.router_id = r.id
      WHERE i.customer_id = ?
      ORDER BY i.period_year DESC, i.period_month DESC
    `).all(customer.id);
  }

  const keyword = raw.toLowerCase();
  if (keyword.length < 3) return [];
  
  return db.prepare(`
    SELECT i.*,
           c.name as customer_name,
           c.phone as customer_phone,
           c.address as customer_address,
           c.pppoe_username,
           c.genieacs_tag,
           c.connection_type,
           c.static_ip,
           c.mac_address,
           c.status as customer_status,
           c.router_id,
           c.install_date,
           c.isolate_day,
           c.isolir_profile,
           p.name as package_name,
           p.price as package_price,
           r.name as router_name
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN packages p ON c.package_id = p.id
    LEFT JOIN routers r ON c.router_id = r.id
    WHERE lower(c.name) LIKE ?
       OR lower(c.phone) LIKE ?
       OR lower(c.genieacs_tag) LIKE ?
       OR lower(c.pppoe_username) LIKE ?
       OR lower(c.mac_address) LIKE ?
       OR ('MDE-' || printf('%04d', c.id)) LIKE ?
    ORDER BY i.period_year DESC, i.period_month DESC
    LIMIT 300
  `).all(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
}

function getUnpaidInvoicesByCustomerId(customerId) {
  return db.prepare(`
    SELECT i.*, p.name as package_name
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN packages p ON c.package_id = p.id
    WHERE i.customer_id = ? AND i.status = 'unpaid'
    ORDER BY i.period_year ASC, i.period_month ASC
  `).all(customerId);
}

function getTodayRevenue() {
  return db.prepare(`
    SELECT SUM(amount) as total, COUNT(*) as count 
    FROM invoices 
    WHERE status='paid' AND date(paid_at) = date(NOW_LOCAL())
  `).get();
}

/**
 * Buat tagihan susulan untuk bulan kalender **tanggal pasang** (prorata sisa hari),
 * hanya jika belum ada invoice periode itu. Dasar nominal: **harga reguler** paket (bukan harga promo).
 */
function createInstallProrataCatchUpInvoice(customerId) {
  const cid = Number(customerId);
  if (!Number.isFinite(cid) || cid <= 0) throw new Error('ID pelanggan tidak valid');

  const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!customer) throw new Error('Pelanggan tidak ditemukan');
  if (!customer.package_id) throw new Error('Pelanggan belum memiliki paket');
  if (!customer.install_date) throw new Error('Isi tanggal pasang (install_date) di data pelanggan');

  const inst = parseInstallYMD(String(customer.install_date));
  if (!inst) throw new Error('Format tanggal pasang tidak valid (gunakan YYYY-MM-DD)');

  const pkg = db.prepare('SELECT * FROM packages WHERE id=?').get(customer.package_id);
  if (!pkg) throw new Error('Paket tidak ditemukan');
  if (!pkg.prorate_first_invoice) throw new Error('Paket ini belum mengaktifkan opsi prorata tagihan pertama');

  const periodMonth = inst.m;
  const periodYear = inst.y;

  const exists = db.prepare('SELECT id FROM invoices WHERE customer_id=? AND period_month=? AND period_year=? LIMIT 1').get(cid, periodMonth, periodYear);
  if (exists) {
    throw new Error(`Sudah ada tagihan untuk periode pasang ${String(periodMonth).padStart(2, '0')}/${periodYear}`);
  }

  const dim = daysInMonth(periodYear, periodMonth);
  const billableDays = Math.min(dim, Math.max(1, dim - inst.d + 1));
  const basePrice = Number(pkg.price) || 0;
  const baseAmount = Math.max(0, Math.round(basePrice * (billableDays / dim)));
  
  let taxAmount = 0;
  const metaParts = [`Susulan prorata bulan pasang (${billableDays}/${dim} hari, dasar harga reguler Rp ${basePrice.toLocaleString('id-ID')})`];

  // PPN
  if (pkg.use_ppn === 1) {
    const ppnPct = Number(pkg.ppn_percentage) || 11.0;
    const ppnVal = Math.round(baseAmount * (ppnPct / 100));
    taxAmount += ppnVal;
    metaParts.push(`PPN ${ppnPct}% (Rp ${ppnVal.toLocaleString('id-ID')})`);
  }

  // USO
  if (pkg.use_uso === 1) {
    const usoPct = Number(pkg.uso_percentage) || 1.75;
    const usoVal = Math.round(baseAmount * (usoPct / 100));
    taxAmount += usoVal;
    metaParts.push(`USO ${usoPct}% (Rp ${usoVal.toLocaleString('id-ID')})`);
  }

  const finalAmount = baseAmount + taxAmount;
  const notesAuto = `AUTO: ${metaParts.join(' | ')}`;

  const r = db.prepare('INSERT INTO invoices (customer_id, period_month, period_year, amount, notes) VALUES (?, ?, ?, ?, ?)').run(
    cid, periodMonth, periodYear, finalAmount, notesAuto
  );

  return {
    invoiceId: r.lastInsertRowid,
    amount,
    periodMonth,
    periodYear,
    customerName: customer.name,
    billableDays,
    daysInMonth: dim
  };
}

function updatePaymentInfo(invoiceId, data) {
  const { 
    gateway, order_id, link, reference, payload, expires_at 
  } = data;
  
  return db.prepare(`
    UPDATE invoices SET 
      payment_gateway = ?,
      payment_order_id = ?,
      payment_link = ?,
      payment_reference = ?,
      payment_payload = ?,
      payment_expires_at = ?
    WHERE id = ?
  `).run(gateway, order_id, link, reference, payload ? JSON.stringify(payload) : null, expires_at, invoiceId);
}

module.exports = {
  getInvoicesByAny,
  getUnpaidInvoicesByCustomerId,
  generateMonthlyInvoices, generateInvoiceForCustomer, createInstallProrataCatchUpInvoice, payInvoiceForCustomerPeriod, payInvoicesForCustomerMonths, getPaidMonthsForCustomerYear, getCustomerBillingYearSummary, getAllInvoices, getInvoiceById,
  markAsPaid, recordPartialPayment, processCustomerPayment, markAsUnpaid, deleteInvoice,
  getInvoiceSummary, getMonthlyRevenue,
  getDashboardStats, getRecentPayments, getTopUnpaid,
  getTodayRevenue,
  updatePaymentInfo
};
