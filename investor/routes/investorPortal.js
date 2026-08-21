/**
 * investor/routes/investorPortal.js
 * Express Router khusus Standalone Portal Investor (/investor/*)
 */

const express = require('express');
const router = express.Router();
const investorService = require('../services/investorService');
const { getSetting } = require('../../config/settingsManager');

function company() {
  return getSetting('company_header', 'Billing System');
}

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
  res.render('../investor/views/login', { error: null, company: company() });
});

/**
 * POST /investor/login - Proses Otentikasi Login Investor
 */
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.render('../investor/views/login', { error: 'Username dan Password wajib diisi.', company: company() });
    }

    const investor = investorService.authenticateInvestor(username, password);
    if (!investor) {
      return res.render('../investor/views/login', { error: 'Username atau Password salah / akun non-aktif.', company: company() });
    }

    // Set Session Investor
    req.session.investor = investor;
    return res.redirect('/investor/dashboard');
  } catch (err) {
    console.error('[Investor Router] Login error:', err.message);
    return res.render('../investor/views/login', { error: 'Terjadi kesalahan sistem saat login.', company: company() });
  }
});

const db = require('../../config/database');

/**
 * GET /investor/dashboard - Main Executive Dashboard Investor
 */
router.get('/dashboard', requireInvestor, (req, res) => {
  try {
    const period = req.query.period || 'this_month';
    const sessionInv = req.session.investor;

    // Ambil data investor TERBARU dari database
    const currentInvestor = db.prepare(`SELECT * FROM investors WHERE id = ? AND is_active = 1`).get(sessionInv.id);
    if (!currentInvestor) {
      delete req.session.investor;
      return res.redirect('/investor/login');
    }
    req.session.investor = currentInvestor; // Sync session

    // Agregasi Data
    const summary = investorService.getExecutiveSummary(period);
    const dividendInfo = investorService.getDividendBreakdown(currentInvestor.id, period);
    const pkgDist = investorService.getPackageDistribution();
    const expBreakdown = investorService.getExpenseBreakdown(period);
    const recentTx = investorService.getRecentTransactions(8);

    res.render('../investor/views/dashboard', {
      investor: currentInvestor,
      company: company(),
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
 * GET /investor/api/summary - REST API Real-time Executive Summary & Recent Transactions
 */
router.get('/api/summary', requireInvestor, (req, res) => {
  try {
    const period = req.query.period || 'this_month';
    const currentInvestor = req.session.investor;

    const summary = investorService.getExecutiveSummary(period);
    const dividendInfo = investorService.getDividendBreakdown(currentInvestor.id, period);
    const recentTx = investorService.getRecentTransactions(8);

    res.json({
      success: true,
      summary,
      dividendInfo,
      recentTx
    });
  } catch (err) {
    console.error('[Investor Router] API Summary error:', err.message);
    res.status(500).json({ success: false, error: err.message });
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
 * GET /investor/api/map-data - REST API Read-Only Data Peta Jaringan (ODPs, Pelanggan, Jalur Kabel & Stats)
 */
router.get('/api/map-data', requireInvestor, (req, res) => {
  try {
    const mapData = investorService.getMapData();
    res.json({
      success: true,
      ...mapData
    });
  } catch (err) {
    console.error('[Investor Router] API Map Data error:', err.message);
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
