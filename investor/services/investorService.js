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

    // 1. Total Pendapatan (Revenue) dari Invoices Tagihan Lunas
    const payRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_payments
      FROM invoices
      WHERE status = 'paid' AND paid_at >= ? AND paid_at <= ?
    `).get(startDate, endDate);

    // 2. Total Pendapatan dari Cash In Tambahan (non-tagihan)
    const cashInRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_cashin
      FROM cash_in
      WHERE date >= ? AND date <= ?
    `).get(startDate.substring(0, 10), endDate.substring(0, 10));

    const grossRevenue = (payRow ? payRow.total_payments : 0) + (cashInRow ? cashInRow.total_cashin : 0);

    // 3. Total Pengeluaran (Expenses)
    const expRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses
      WHERE date >= ? AND date <= ?
    `).get(startDate.substring(0, 10), endDate.substring(0, 10));

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

    // 6. Demografi & Status Pelanggan
    const totalCust = db.prepare(`SELECT COUNT(*) as total FROM customers`).get().total;
    const activeCust = db.prepare(`SELECT COUNT(*) as total FROM customers WHERE status = 'active'`).get().total;
    const isolatedCust = db.prepare(`SELECT COUNT(*) as total FROM customers WHERE status IN ('isolated', 'suspended')`).get().total;
    
    // Pasang Baru (PSB) Bulan Ini
    const nowY = new Date().getFullYear();
    const nowM = String(new Date().getMonth() + 1).padStart(2, '0');
    const psbThisMonth = db.prepare(`
      SELECT COUNT(*) as total FROM customers 
      WHERE strftime('%Y-%m', created_at) = ?
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
      isolatedCustomers: isolatedCust,
      psbThisMonth,
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

/**
 * Menhitung Bagi Hasil / Dividen Khusus Investor berdasarkan persentase saham
 */
function getDividendBreakdown(investorId, period = 'this_month') {
  try {
    const investor = db.prepare(`SELECT * FROM investors WHERE id = ? AND is_active = 1`).get(investorId);
    if (!investor) return null;

    const summary = getExecutiveSummary(period);
    const sharePercent = Number(investor.share_percentage) || 0;
    
    // Profit Bagi Hasil (hanya jika net profit positif)
    const totalNetProfit = summary.netProfit > 0 ? summary.netProfit : 0;
    const dividendAmount = Math.round(totalNetProfit * (sharePercent / 100));

    return {
      investorId: investor.id,
      investorName: investor.name,
      sharePercentage: sharePercent,
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

      // Revenue dari Tagihan Lunas
      const pay = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM invoices
        WHERE status = 'paid' AND strftime('%Y-%m', paid_at) = ?
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
    const payments = db.prepare(`
      SELECT ('Pembayaran Tagihan - ' || c.name) as title, i.amount, i.paid_at as date, 'IN' as type
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.status = 'paid' AND i.paid_at IS NOT NULL
      ORDER BY i.id DESC LIMIT ?
    `).all(limit);

    const expenses = db.prepare(`
      SELECT description as title, amount, date || ' 12:00:00' as date, 'OUT' as type
      FROM expenses ORDER BY id DESC LIMIT ?
    `).all(limit);

    const merged = [...payments, ...expenses]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
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

module.exports = {
  formatRp,
  getExecutiveSummary,
  getDividendBreakdown,
  getFinancialTrends,
  getPackageDistribution,
  getExpenseBreakdown,
  getRecentTransactions,
  authenticateInvestor
};
