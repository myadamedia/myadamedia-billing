/**
 * investor/routes/investorPortal.js
 * Express Router khusus Standalone Portal Investor (/investor/*)
 */

const express = require('express');
const router = express.Router();
const investorService = require('../services/investorService');

/**
 * Middleware untuk memastikan user sudah terotentikasi sebagai Investor
 */
function requireInvestor(req, res, next) {
  if (req.session && req.session.investor) {
    return next();
  }
  return res.redirect('/investor/login');
}

/**
 * GET /investor/login - Halaman Login Standalone Investor
 */
router.get('/login', (req, res) => {
  if (req.session && req.session.investor) {
    return res.redirect('/investor/dashboard');
  }
  res.render('../investor/views/login', { error: null });
});

/**
 * POST /investor/login - Proses Otentikasi Login Investor
 */
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.render('../investor/views/login', { error: 'Username dan Password wajib diisi.' });
    }

    const investor = investorService.authenticateInvestor(username, password);
    if (!investor) {
      return res.render('../investor/views/login', { error: 'Username atau Password salah / akun non-aktif.' });
    }

    // Set Session Investor
    req.session.investor = investor;
    return res.redirect('/investor/dashboard');
  } catch (err) {
    console.error('[Investor Router] Login error:', err.message);
    return res.render('../investor/views/login', { error: 'Terjadi kesalahan sistem saat login.' });
  }
});

/**
 * GET /investor/dashboard - Main Executive Dashboard Investor
 */
router.get('/dashboard', requireInvestor, (req, res) => {
  try {
    const period = req.query.period || 'this_month';
    const investorSession = req.session.investor;

    // Agregasi Data
    const summary = investorService.getExecutiveSummary(period);
    const dividendInfo = investorService.getDividendBreakdown(investorSession.id, period);
    const pkgDist = investorService.getPackageDistribution();
    const expBreakdown = investorService.getExpenseBreakdown(period);
    const recentTx = investorService.getRecentTransactions(8);

    res.render('../investor/views/dashboard', {
      investor: investorSession,
      summary,
      dividendInfo,
      pkgDist,
      expBreakdown,
      recentTx,
      period
    });
  } catch (err) {
    console.error('[Investor Router] Dashboard error:', err.message);
    res.status(500).send('Terjadi kesalahan saat memuat Dashboard Investor.');
  }
});

/**
 * GET /investor/api/chart-data - REST API Data Grafik Keuangan & Tren
 */
router.get('/api/chart-data', requireInvestor, (req, res) => {
  try {
    const months = Number(req.query.months) || 6;
    const trends = investorService.getFinancialTrends(months);
    const pkgDist = investorService.getPackageDistribution();

    res.json({
      success: true,
      trends,
      packages: pkgDist
    });
  } catch (err) {
    console.error('[Investor Router] API Chart Data error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /investor/logout - Logout Session Investor
 */
router.get('/logout', (req, res) => {
  if (req.session) {
    delete req.session.investor;
  }
  res.redirect('/investor/login');
});

module.exports = router;
