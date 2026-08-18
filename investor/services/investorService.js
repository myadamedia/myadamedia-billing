/**
 * investor/services/investorService.js
 * Service Engine Agregasi Keuangan & Perhitungan Dividen Investor (Standalone Module)
 */

const db = require('../../config/database');
const { verifyPassword } = require('../../utils/securityHelper');

/**
 * Memformat angka ke format Rupiah (IDR)
 */
function formatRp(val) {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
}

/**
 * Memperoleh rentang tanggal berdasarkan filter periode ('this_month', 'last_month', 'this_year', 'all')
 */
function getDateRange(period = 'this_month') {
  const now = new Date();
  let startDate = '';
  let endDate = '';

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');

  if (period === 'last_month') {
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const py = prevMonthDate.getFullYear();
    const pm = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(py, prevMonthDate.getMonth() + 1, 0).getDate();
    startDate = `${py}-${pm}-01`;
    endDate = `${py}-${pm}-${String(lastDay).padStart(2, '0')} 23:59:59`;
  } else if (period === 'this_year') {
    startDate = `${y}-01-01`;
    endDate = `${y}-12-31 23:59:59`;
  } else if (period === 'all') {
    startDate = '2000-01-01';
    endDate = '2099-12-31 23:59:59';
  } else {
    // Default: this_month
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    startDate = `${y}-${m}-01`;
    endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')} 23:59:59`;
  }

  return { startDate, endDate };
}

/**
 * Menghitung Agregasi Ringkasan Eksekutif Keuangan & Pelanggan
 * @param {string} period 
 * @returns {Object}
 */
function getExecutiveSummary(period = 'this_month') {
  try {
    const { startDate, endDate } = getDateRange(period);
    const startD = startDate.substring(0, 10);
    const endD = endDate.substring(0, 10);

    // 1. Total Pendapatan (Revenue) dari Invoices Tagihan Lunas / Parsial
    const payRow = db.prepare(`
      SELECT COALESCE(SUM(
        CASE 
          WHEN status = 'paid' THEN COALESCE(paid_amount, amount)
          WHEN status = 'partial' THEN COALESCE(paid_amount, 0)
          ELSE 0
        END
      ), 0) as total_payments
      FROM invoices
      WHERE paid_at IS NOT NULL 
        AND date(paid_at) >= date(?) 
        AND date(paid_at) <= date(?)
    `).get(startD, endD);

    // 2. Total Pendapatan dari Cash In Tambahan (non-tagihan)
    const cashInRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_cashin
      FROM cash_in
      WHERE date(date) >= date(?) AND date(date) <= date(?)
    `).get(startD, endD);

    const grossRevenue = (payRow ? payRow.total_payments : 0) + (cashInRow ? cashInRow.total_cashin : 0);

    // 3. Total Pengeluaran (Expenses)
    const expRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses
      WHERE date(date) >= date(?) AND date(date) <= date(?)
    `).get(startD, endD);

    const totalExpenses = expRow ? expRow.total_expenses : 0;

    // 4. Net Profit (Laba Bersih) & Profit Margin %
    const netProfit = grossRevenue - totalExpenses;
    const profitMargin = grossRevenue > 0 ? ((netProfit / grossRevenue) * 100).toFixed(1) : 0;

    // 5. Monthly Recurring Revenue (MRR) - Proyeksi tagihan bulanan dari paket aktif (Memperhitungkan Harga Promo)
    const mrrRow = db.prepare(`
      SELECT COALESCE(SUM(
        CASE
          WHEN p.promo_price IS NOT NULL 
           AND p.promo_price != '' 
           AND CAST(p.promo_cycles AS INTEGER) > 0 
           AND COALESCE(c.promo_cycles_used, 0) < CAST(p.promo_cycles AS INTEGER) 
          THEN CAST(p.promo_price AS INTEGER)
          ELSE p.price
        END
      ), 0) as mrr
      FROM customers c
      JOIN packages p ON c.package_id = p.id
      WHERE c.status = 'active'
    `).get();
    const mrr = mrrRow ? mrrRow.mrr : 0;

    // 6. Demografi & Status Pelanggan (Pelanggan Berbayar Aktif & Pelanggan Free)
    const totalCust = db.prepare(`SELECT COUNT(*) as total FROM customers`).get().total;
    const activeCustRow = db.prepare(`
      SELECT COUNT(c.id) as total 
      FROM customers c
      LEFT JOIN packages p ON c.package_id = p.id
      WHERE c.status = 'active'
        AND LOWER(c.status) != 'free'
        AND (p.name IS NULL OR (LOWER(p.name) NOT LIKE '%free%' AND LOWER(p.name) NOT LIKE '%gratis%'))
        AND (p.price IS NULL OR p.price > 0)
    `).get();
    const activeCust = activeCustRow ? activeCustRow.total : 0;
    const isolatedCust = db.prepare(`SELECT COUNT(*) as total FROM customers WHERE status IN ('isolated', 'suspended')`).get().total;

    // Pelanggan Free (Paket Free / Gratis / Harga Rp 0 / Status Free)
    const freeCustRow = db.prepare(`
      SELECT COUNT(c.id) as total 
      FROM customers c
      LEFT JOIN packages p ON c.package_id = p.id
      WHERE (c.status = 'active' OR LOWER(c.status) = 'free')
        AND (
          LOWER(c.status) = 'free'
          OR LOWER(COALESCE(p.name, '')) LIKE '%free%'
          OR LOWER(COALESCE(p.name, '')) LIKE '%gratis%'
          OR (p.price IS NOT NULL AND p.price <= 0)
        )
    `).get();
    const freeCust = freeCustRow ? freeCustRow.total : 0;
    
    // Pasang Baru (PSB) Bulan Ini (Total & Free)
    const nowY = new Date().getFullYear();
    const nowM = String(new Date().getMonth() + 1).padStart(2, '0');
    const psbThisMonth = db.prepare(`
      SELECT COUNT(*) as total FROM customers 
      WHERE strftime('%Y-%m', created_at) = ?
    `).get(`${nowY}-${nowM}`).total;

    const freePsbThisMonth = db.prepare(`
      SELECT COUNT(c.id) as total FROM customers c
      LEFT JOIN packages p ON c.package_id = p.id
      WHERE strftime('%Y-%m', c.created_at) = ?
        AND (
          LOWER(c.status) = 'free'
          OR LOWER(COALESCE(p.name, '')) LIKE '%free%'
          OR LOWER(COALESCE(p.name, '')) LIKE '%gratis%'
          OR (p.price IS NOT NULL AND p.price <= 0)
        )
    `).get(`${nowY}-${nowM}`).total;

    // 7. Average Revenue Per User (ARPU)
    const arpu = activeCust > 0 ? Math.round(mrr / activeCust) : 0;

    return {
      period,
      grossRevenue,
      totalExpenses,
      netProfit,
      profitMargin: Number(profitMargin),
      mrr,
      arpu,
      totalCustomers: totalCust,
      activeCustomers: activeCust,
      freeCustomers: freeCust,
      isolatedCustomers: isolatedCust,
      psbThisMonth,
      freePsbThisMonth,
      formattedRevenue: formatRp(grossRevenue),
      formattedExpenses: formatRp(totalExpenses),
      formattedNetProfit: formatRp(netProfit),
      formattedMrr: formatRp(mrr),
      formattedArpu: formatRp(arpu)
    };
  } catch (err) {
    console.error('[InvestorService] Error getExecutiveSummary:', err.message);
    throw err;
  }
}

function parseCleanNumber(val) {
  if (val === undefined || val === null || val === '') return 0;
  let str = String(val).trim();
  if ((str.match(/\./g) || []).length > 1) {
    str = str.replace(/\./g, '');
  }
  str = str.replace(/[^0-9.-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Menhitung Bagi Hasil / Dividen Khusus Investor berdasarkan persentase saham atau nominal fix
 */
function getDividendBreakdown(investorId, period = 'this_month') {
  try {
    const investor = db.prepare(`SELECT * FROM investors WHERE id = ? AND is_active = 1`).get(investorId);
    if (!investor) return null;

    const summary = getExecutiveSummary(period);
    const sharePercent = parseCleanNumber(investor.share_percentage);
    const shareType = String(investor.share_type || '').toLowerCase().trim() === 'fixed' ? 'fixed' : 'percentage';
    const fixedAmount = parseCleanNumber(investor.fixed_dividend_amount);
    
    let dividendAmount = 0;
    if (shareType === 'fixed') {
      dividendAmount = fixedAmount;
    } else {
      // Profit Bagi Hasil (hanya jika net profit positif)
      const totalNetProfit = summary.netProfit > 0 ? summary.netProfit : 0;
      dividendAmount = Math.round(totalNetProfit * (sharePercent / 100));
    }

    return {
      investorId: investor.id,
      investorName: investor.name,
      shareType,
      sharePercentage: sharePercent,
      fixedDividendAmount: fixedAmount,
      formattedFixedAmount: formatRp(fixedAmount),
      netProfit: summary.netProfit,
      dividendAmount,
      formattedDividend: formatRp(dividendAmount),
      summary
    };
  } catch (err) {
    console.error('[InvestorService] Error getDividendBreakdown:', err.message);
    throw err;
  }
}



/**
 * Mengambil Data Tren Historis Bulanan (6/12 bulan terakhir) untuk Grafik Chart.js
 */
function getFinancialTrends(monthsCount = 6) {
  try {
    const trends = [];
    const now = new Date();

    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const monthKey = `${y}-${m}`;

      // Label Bulan Bahasa Indonesia (misal: "Jan 2026")
      const monthLabel = d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });

      // Revenue dari Tagihan Lunas / Parsial & Kas Masuk
      const pay = db.prepare(`
        SELECT COALESCE(SUM(
          CASE 
            WHEN status = 'paid' THEN COALESCE(paid_amount, amount)
            WHEN status = 'partial' THEN COALESCE(paid_amount, 0)
            ELSE 0
          END
        ), 0) as total FROM invoices
        WHERE paid_at IS NOT NULL AND strftime('%Y-%m', paid_at) = ?
      `).get(monthKey).total;

      const cashIn = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM cash_in
        WHERE strftime('%Y-%m', date) = ?
      `).get(monthKey).total;

      const revenue = pay + cashIn;

      // Expenses
      const expense = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM expenses
        WHERE strftime('%Y-%m', date) = ?
      `).get(monthKey).total;

      const netProfit = revenue - expense;

      trends.push({
        monthKey,
        label: monthLabel,
        revenue,
        expense,
        netProfit
      });
    }

    return trends;
  } catch (err) {
    console.error('[InvestorService] Error getFinancialTrends:', err.message);
    return [];
  }
}

/**
 * Mengambil Distribusi Kontribusi Paket Internet
 */
function getPackageDistribution() {
  try {
    const rows = db.prepare(`
      SELECT p.name as package_name, p.price, COUNT(c.id) as customer_count,
             COALESCE(SUM(
               CASE
                 WHEN p.promo_price IS NOT NULL 
                  AND p.promo_price != '' 
                  AND CAST(p.promo_cycles AS INTEGER) > 0 
                  AND COALESCE(c.promo_cycles_used, 0) < CAST(p.promo_cycles AS INTEGER) 
                 THEN CAST(p.promo_price AS INTEGER)
                 ELSE p.price
               END
             ), 0) as total_potential
      FROM packages p
      LEFT JOIN customers c ON c.package_id = p.id AND c.status = 'active'
      GROUP BY p.id
      ORDER BY total_potential DESC
    `).all();

    return rows.map(r => ({
      package_name: r.package_name,
      price: r.price,
      customer_count: r.customer_count,
      total_potential: r.total_potential,
      formatted_total: formatRp(r.total_potential)
    }));
  } catch (err) {
    console.error('[InvestorService] Error getPackageDistribution:', err.message);
    return [];
  }
}

/**
 * Mengambil Rincian Pengeluaran Terbesar Berdasarkan Kategori
 */
function getExpenseBreakdown(period = 'this_month') {
  try {
    const { startDate, endDate } = getDateRange(period);
    const rows = db.prepare(`
      SELECT category, SUM(amount) as total_amount, COUNT(*) as tx_count
      FROM expenses
      WHERE date >= ? AND date <= ?
      GROUP BY category
      ORDER BY total_amount DESC
    `).all(startDate.substring(0, 10), endDate.substring(0, 10));

    return rows.map(r => ({
      category: r.category,
      amount: r.total_amount,
      txCount: r.tx_count,
      formattedAmount: formatRp(r.total_amount)
    }));
  } catch (err) {
    console.error('[InvestorService] Error getExpenseBreakdown:', err.message);
    return [];
  }
}

/**
 * Mengambil Daftar Transaksi Terbaru (Ringkasan Kas Masuk & Keluar)
 */
function getRecentTransactions(limit = 8) {
  try {
    // 1. Pembayaran Tagihan (Invoices)
    const payments = db.prepare(`
      SELECT ('Pembayaran Tagihan - ' || c.name) as title, 
             COALESCE(i.paid_amount, i.amount) as amount, 
             i.paid_at as date, 
             'IN' as type
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.paid_at IS NOT NULL 
        AND (i.status = 'paid' OR (i.status = 'partial' AND i.paid_amount > 0))
      ORDER BY i.paid_at DESC LIMIT ?
    `).all(limit);

    // 2. Kas Masuk (Cash In Non-Tagihan)
    const cashIns = db.prepare(`
      SELECT ('Kas Masuk - ' || category || COALESCE(' (' || description || ')', '')) as title,
             amount,
             (date || ' 12:00:00') as date,
             'IN' as type
      FROM cash_in
      ORDER BY id DESC LIMIT ?
    `).all(limit);

    // 3. Pengeluaran (Expenses)
    const expenses = db.prepare(`
      SELECT (description || ' (' || category || ')') as title,
             amount,
             (date || ' 12:00:00') as date,
             'OUT' as type
      FROM expenses
      ORDER BY id DESC LIMIT ?
    `).all(limit);

    const merged = [...payments, ...cashIns, ...expenses]
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, limit);

    return merged.map(tx => ({
      ...tx,
      formattedAmount: formatRp(tx.amount)
    }));
  } catch (err) {
    console.error('[InvestorService] Error getRecentTransactions:', err.message);
    return [];
  }
}

/**
 * Otentikasi Login Akun Investor
 */
function authenticateInvestor(username, password) {
  try {
    const investor = db.prepare(`SELECT * FROM investors WHERE username = ? AND is_active = 1`).get(username.trim());
    if (!investor) return null;

    // Uji kecocokan password menggunakan securityHelper (scrypt & plaintext fallback)
    const match = verifyPassword(password, investor.password);
    if (!match) return null;

    // Retorn safe user object (tanpa hash password)
    const { password: _, ...safeInvestor } = investor;
    return safeInvestor;
  } catch (err) {
    console.error('[InvestorService] Error authenticateInvestor:', err.message);
    return null;
  }
}

/**
 * Memperoleh Data Peta Jaringan khusus Tampilan Investor (Read-Only)
 * Menggunakan data terpadu dari odpService & customerService agar presisi 100% dengan /admin/map
 * @returns {Object} { odps, customers, olts, office, stats }
 */
function getMapData() {
  try {
    const odpSvc = require('../../services/odpService');
    const customerSvc = require('../../services/customerService');
    const { getSetting } = require('../../config/settingsManager');

    const officeLat = parseFloat(getSetting('office_lat', '-6.200000')) || -6.200000;
    const officeLng = parseFloat(getSetting('office_lng', '106.816666')) || 106.816666;

    // 1. Ambil seluruh ODP
    const rawOdps = odpSvc.getAllOdps() || [];
    const odps = rawOdps.map(o => {
      const lat = parseFloat(o.lat);
      const lng = parseFloat(o.lng);
      const usage = odpSvc.getOdpPortUsage(o.id);
      return {
        id: o.id,
        name: o.name,
        lat: isNaN(lat) ? 0 : lat,
        lng: isNaN(lng) ? 0 : lng,
        capacity: Number(o.port_capacity || 16) || 16,
        used_ports: usage ? usage.usedCount : 0,
        description: o.description || '',
        olt_name: o.olt_name || '',
        parent_odp_id: o.parent_odp_id || null,
        parent_name: o.parent_name || '',
        olt_id: o.olt_id || null,
        pon_port: o.pon_port || '',
        cable_path: o.cable_path || ''
      };
    });

    // 2. Ambil seluruh Pelanggan
    const rawCustomers = customerSvc.getAllCustomers() || [];
    const customers = rawCustomers.map(c => {
      const lat = parseFloat(c.lat);
      const lng = parseFloat(c.lng);
      return {
        id: c.id,
        name: c.name,
        lat: isNaN(lat) ? 0 : lat,
        lng: isNaN(lng) ? 0 : lng,
        status: c.status || 'active',
        address: c.address || '',
        pppoe_username: c.pppoe_username || '',
        package_name: c.package_name || '-',
        package_price: c.package_price !== undefined ? c.package_price : 0,
        odp_id: c.odp_id || null,
        cable_path: c.cable_path || ''
      };
    });

    // 3. Ambil OLTs
    const olts = db.prepare(`SELECT id, name FROM olts`).all();

    // 4. Hitung Statistik Ringkasan Peta
    const validOdps = odps.filter(o => o.lat !== 0 && o.lng !== 0);
    const validCustomers = customers.filter(c => c.lat !== 0 && c.lng !== 0);

    const isFreeCust = (c) => (c.status && String(c.status).toLowerCase() === 'free') || 
                             (c.package_name && String(c.package_name).toLowerCase().includes('free')) || 
                             (c.package_name && String(c.package_name).toLowerCase().includes('gratis')) || 
                             (c.package_price !== undefined && Number(c.package_price) <= 0 && c.package_name);

    const totalOdps = validOdps.length;
    const totalMappedCustomers = validCustomers.length;
    const freeCustomers = validCustomers.filter(isFreeCust).length;
    const activeCustomers = validCustomers.filter(c => String(c.status).toLowerCase() === 'active' && !isFreeCust(c)).length;
    const suspendedCustomers = validCustomers.filter(c => String(c.status).toLowerCase() !== 'active' && !isFreeCust(c)).length;

    return {
      odps: validOdps,
      customers: validCustomers,
      olts,
      office: { lat: officeLat, lng: officeLng },
      stats: {
        totalOdps,
        totalMappedCustomers,
        activeCustomers,
        freeCustomers,
        suspendedCustomers
      }
    };
  } catch (err) {
    console.error('[InvestorService] Error getMapData:', err.message);
    return {
      odps: [],
      customers: [],
      olts: [],
      office: { lat: -6.200000, lng: 106.816666 },
      stats: { totalOdps: 0, totalMappedCustomers: 0, activeCustomers: 0, freeCustomers: 0, suspendedCustomers: 0 }
    };
  }
}

module.exports = {
  formatRp,
  getExecutiveSummary,
  getDividendBreakdown,
  getFinancialTrends,
  getPackageDistribution,
  getExpenseBreakdown,
  getRecentTransactions,
  authenticateInvestor,
  getMapData
};

