const crypto = require('crypto');
const { getSetting, getSettings, saveSettings } = require('../config/settingsManager');
const { getAppSetting, saveAppSetting } = require('../config/database');

const SETTINGS_KEY = 'sidebar_menu_states';
const STATE_VISIBLE = 'visible';
const STATE_HIDDEN = 'hidden';
const STATE_LOCKED = 'locked';
const VALID_STATES = new Set([STATE_VISIBLE, STATE_HIDDEN, STATE_LOCKED]);

const MENU_DEFINITIONS = [
  { key: 'dashboard', section: 'main', href: '/admin', icon: 'bi bi-speedometer2', labelKey: 'admin.nav.dashboard', labelDefault: 'Dashboard', roles: ['superadmin', 'finance', 'teknisi', 'kolektor', 'noc'], bottomNav: true, activePages: ['dashboard'] },
  { key: 'mikrotik', section: 'main', href: '/admin/mikrotik', icon: 'bi bi-router', labelKey: 'admin.nav.mikrotik', labelDefault: 'MikroTik', roles: ['superadmin', 'teknisi', 'noc'], bottomNav: true, activePages: ['mikrotik'] },
  { key: 'radius_nas', section: 'main', href: '/admin/radius', icon: 'bi bi-shield-check', labelKey: 'admin.nav.radius_nas', labelDefault: 'RADIUS NAS', roles: ['superadmin', 'noc'], activePages: ['radius_nas'] },
  { key: 'radius_sessions', section: 'main', href: '/admin/radius/sessions', icon: 'bi bi-person-check-fill', labelKey: 'admin.nav.radius_sessions', labelDefault: 'Sesi RADIUS', roles: ['superadmin', 'noc'], activePages: ['radius_sessions'] },
  { key: 'map', section: 'main', href: '/admin/map', icon: 'bi bi-map', labelKey: 'admin.nav.network_map', labelDefault: 'Peta Jaringan', roles: ['superadmin', 'teknisi', 'noc'], activePages: ['map'] },
  { key: 'acs_pro', section: 'main', href: '/admin/acs', icon: 'bi bi-hdd-network', labelKey: 'admin.nav.acs_pro', labelDefault: 'GenieACS Pro', roles: ['superadmin', 'noc'], activePages: ['acs_pro'] },
  { key: 'onu_provision', section: 'main', href: '/admin/onu-provision', icon: 'bi bi-hdd-network-fill', labelKey: 'admin.nav.onu_provision', labelDefault: 'ONU Provision', roles: ['superadmin', 'teknisi', 'noc'], activePages: ['onu_provision'] },
  { key: 'olts', section: 'main', href: '/admin/olts', icon: 'bi bi-hdd-fill', labelKey: 'admin.nav.olt_management', labelDefault: 'Manajemen OLT', roles: ['superadmin', 'noc'], activePages: ['olts'] },
  { key: 'whatsapp', section: 'main', href: '/admin/whatsapp', icon: 'bi bi-whatsapp', labelKey: 'admin.nav.whatsapp', labelDefault: 'WhatsApp', roles: ['superadmin', 'noc'], activePages: ['whatsapp'] },
  { key: 'broadcast', section: 'main', href: '/admin/whatsapp/broadcast', icon: 'bi bi-megaphone', labelKey: 'admin.broadcast.title', labelDefault: 'Broadcast WhatsApp', roles: ['superadmin', 'finance'], activePages: ['broadcast'] },
  { key: 'whatsapp_monitoring', section: 'main', href: '/admin/whatsapp/monitoring', icon: 'bi bi-bell-fill', labelKey: 'admin.nav.whatsapp_monitoring', labelDefault: 'Alert Monitoring WA', roles: ['superadmin', 'noc'], activePages: ['whatsapp_monitoring'] },
  { key: 'isolated_portal', section: 'main', href: '/admin/isolated-portal', icon: 'bi bi-shield-slash-fill', labelKey: 'admin.nav.isolated_portal', labelDefault: 'Portal Isolir', roles: ['superadmin', 'teknisi', 'noc', 'finance'], activePages: ['isolated_portal'] },

  { key: 'psb', section: 'billing', href: '/admin/psb', icon: 'bi bi-person-plus', labelKey: 'admin.nav.psb', labelDefault: 'PSB', roles: ['superadmin', 'finance', 'teknisi', 'noc'], activePages: ['psb'] },
  { key: 'customers', section: 'billing', href: '/admin/customers', icon: 'bi bi-people', labelKey: 'admin.nav.customers', labelDefault: 'Pelanggan', roles: ['superadmin', 'finance', 'teknisi', 'kolektor', 'noc'], bottomNav: true, activePages: ['customers'] },
  { key: 'packages', section: 'billing', href: '/admin/packages', icon: 'bi bi-box-seam', labelKey: 'admin.nav.internet_packages', labelDefault: 'Paket Internet', roles: ['superadmin', 'finance'], activePages: ['packages'] },
  { key: 'voucher_packages', section: 'billing', href: '/admin/vouchers/packages', icon: 'bi bi-ticket-detailed', labelKey: 'admin.nav.voucher_packages', labelDefault: 'Paket Voucher', roles: ['superadmin', 'finance'], activePages: ['voucher_packages'] },
  { key: 'billing', section: 'billing', href: '/admin/billing', icon: 'bi bi-receipt', labelKey: 'admin.nav.invoices', labelDefault: 'Tagihan', roles: ['superadmin', 'finance', 'kolektor'], bottomNav: true, activePages: ['billing'] },
  { key: 'due_distribution', section: 'billing', href: '/admin/billing/due-distribution', icon: 'bi bi-calendar3-range', labelKey: 'admin.nav.due_distribution', labelDefault: 'Distribusi Jatuh Tempo', roles: ['superadmin', 'finance', 'kolektor'], activePages: ['due_distribution'] },
  { key: 'collector_payments', section: 'billing', href: '/admin/collector-payments', icon: 'bi bi-check2-square', labelKey: 'admin.nav.collector_payments', labelDefault: 'Approval Kolektor', roles: ['superadmin', 'finance'], activePages: ['collector_payments'] },

  { key: 'reports', section: 'finance', href: '/admin/reports', icon: 'bi bi-bar-chart-line', labelKey: 'admin.nav.finance_report', labelDefault: 'Laporan Keuangan', roles: ['superadmin', 'finance'], activePages: ['reports'] },
  { key: 'investors', section: 'finance', href: '/admin/investors', icon: 'bi bi-graph-up-arrow', labelKey: 'admin.nav.investors', labelDefault: 'Akun Investor', roles: ['superadmin', 'finance'], activePages: ['investors'] },
  { key: 'cashiers_reports', section: 'finance', href: '/admin/cashiers/reports', icon: 'bi bi-journal-text', labelKey: 'admin.nav.cashiers_reports', labelDefault: 'Laporan Kasir', roles: ['superadmin', 'finance'], activePages: ['cashiers_reports'] },
  { key: 'payroll', section: 'finance', href: '/admin/payroll', icon: 'bi bi-wallet2', labelKey: 'admin.nav.payroll', labelDefault: 'Gaji & Payroll', roles: ['superadmin', 'finance'], activePages: ['payroll'] },

  { key: 'tickets', section: 'service', href: '/admin/tickets', icon: 'bi bi-headset', labelKey: 'admin.nav.customer_tickets', labelDefault: 'Keluhan Pelanggan', roles: ['superadmin', 'teknisi', 'noc'], activePages: ['tickets'] },
  { key: 'inventory', section: 'service', href: '/admin/inventory', icon: 'bi bi-boxes', labelKey: 'admin.nav.inventory', labelDefault: 'Inventaris (Stok)', roles: ['superadmin', 'finance', 'teknisi', 'noc'], activePages: ['inventory'] },
  { key: 'attendance', section: 'service', href: '/admin/attendance', icon: 'bi bi-calendar-check', labelKey: 'admin.nav.attendance', labelDefault: 'Absensi Karyawan', roles: ['superadmin', 'finance'], activePages: ['attendance'] },

  { key: 'cash_in', section: 'finance', href: '/admin/finance/cash-in', icon: 'bi bi-cash-stack', labelKey: 'admin.nav.cash_in', labelDefault: 'Kas Masuk', roles: ['superadmin', 'finance', 'kolektor'], activePages: ['cash_in'] },
  { key: 'expenses', section: 'finance', href: '/admin/finance/expenses', icon: 'bi bi-wallet2', labelKey: 'admin.nav.expenses', labelDefault: 'Pengeluaran', roles: ['superadmin', 'finance'], activePages: ['expenses'] },
  { key: 'expense_categories', section: 'finance', href: '/admin/finance/expense-categories', icon: 'bi bi-tags', labelKey: 'admin.nav.expense_categories', labelDefault: 'Kategori Pengeluaran', roles: ['superadmin', 'finance'], activePages: ['expense_categories'] },

  { key: 'cashier_attendance', section: 'cashier', href: '/admin/cashiers/attendance', icon: 'bi bi-calendar-check', labelKey: 'admin.nav.cashier_attendance', labelDefault: 'Absensi Saya', roles: ['cashier', 'finance'], activePages: ['cashier_attendance'] },

  { key: 'staff', section: 'user_management', href: '/admin/staff', icon: 'bi bi-person-workspace', labelKey: 'admin.nav.staff', labelDefault: 'Staff / Karyawan', roles: ['superadmin', 'finance'], activePages: ['staff', 'technicians', 'cashiers', 'collectors'] },
  { key: 'technicians', section: 'user_management', parentKey: 'staff', href: '/admin/technicians', icon: 'bi bi-person-gear', labelKey: 'admin.nav.technicians', labelDefault: 'Teknisi', roles: ['superadmin'], activePages: ['technicians'] },
  { key: 'cashiers', section: 'user_management', parentKey: 'staff', href: '/admin/cashiers', icon: 'bi bi-person-vcard', labelKey: 'admin.nav.cashiers', labelDefault: 'Kasir', roles: ['superadmin', 'finance'], activePages: ['cashiers'] },
  { key: 'collectors', section: 'user_management', parentKey: 'staff', href: '/admin/collectors', icon: 'bi bi-person-badge', labelKey: 'admin.nav.collectors', labelDefault: 'Kolektor', roles: ['superadmin', 'finance'], activePages: ['collectors'] },
  { key: 'agents', section: 'user_management', href: '/admin/agents', icon: 'bi bi-person-badge-fill', labelKey: 'admin.nav.agents', labelDefault: 'Agent', roles: ['superadmin', 'finance'], activePages: ['agents', 'agents_reports'] },

  { key: 'update', section: 'system', href: '/admin/update', icon: 'bi bi-cloud-arrow-down', labelKey: 'admin.nav.update', labelDefault: 'Update GitHub', roles: ['superadmin'], activePages: ['update'] },
  { key: 'settings', section: 'system', href: '/admin/settings', icon: 'bi bi-gear', labelKey: 'admin.nav.settings', labelDefault: 'Pengaturan', roles: ['superadmin'], activePages: ['settings'] },
  { key: 'license', section: 'system', href: '/admin/license', icon: 'bi bi-shield-lock-fill', labelKey: 'admin.nav.license', labelDefault: 'Lisensi Aplikasi', roles: ['superadmin'], activePages: ['license'] },
  { key: 'ewallet_logs', section: 'system', href: '/admin/ewallet-logs', icon: 'bi bi-wallet2', labelKey: 'admin.settings.ewallet_logs.title', labelDefault: 'Log Notifikasi E-Wallet', roles: ['superadmin'], activePages: ['ewallet_logs'] },
  { key: 'backup', section: 'system', href: '/admin/backup', icon: 'bi bi-hdd-stack', labelKey: 'admin.nav.backup', labelDefault: 'Backup & Recovery', roles: ['superadmin'], activePages: ['backup'] },
  { key: 'monitoring', section: 'system', href: '/admin/monitoring', icon: 'bi bi-activity', labelKey: 'admin.nav.monitoring', labelDefault: 'Monitoring Sistem', roles: ['superadmin', 'noc'], activePages: ['monitoring'] },
  { key: 'audit_logs', section: 'system', href: '/admin/audit-logs', icon: 'bi bi-shield-lock', labelKey: 'admin.nav.audit_logs', labelDefault: 'Log Aktivitas', roles: ['superadmin'], activePages: ['audit_logs'] }
];

const DEFAULT_MENU_STATES = {
  dashboard: STATE_VISIBLE,
  mikrotik: STATE_VISIBLE,
  map: STATE_VISIBLE,
  acs_pro: STATE_VISIBLE,
  onu_provision: STATE_VISIBLE,
  olts: STATE_VISIBLE,
  whatsapp: STATE_VISIBLE,
  broadcast: STATE_VISIBLE,
  whatsapp_monitoring: STATE_VISIBLE,
  isolated_portal: STATE_VISIBLE,
  psb: STATE_VISIBLE,
  customers: STATE_VISIBLE,
  packages: STATE_VISIBLE,
  voucher_packages: STATE_VISIBLE,
  billing: STATE_VISIBLE,
  due_distribution: STATE_VISIBLE,
  reports: STATE_VISIBLE,
  investors: STATE_VISIBLE,
  radius_nas: STATE_VISIBLE,
  radius_sessions: STATE_VISIBLE,
  cashiers_reports: STATE_VISIBLE,
  collector_payments: STATE_VISIBLE,
  tickets: STATE_VISIBLE,
  inventory: STATE_VISIBLE,
  attendance: STATE_VISIBLE,
  payroll: STATE_VISIBLE,
  cash_in: STATE_VISIBLE,
  expenses: STATE_VISIBLE,
  expense_categories: STATE_VISIBLE,
  cashier_attendance: STATE_VISIBLE,
  staff: STATE_VISIBLE,
  technicians: STATE_VISIBLE,
  cashiers: STATE_VISIBLE,
  collectors: STATE_VISIBLE,
  agents: STATE_VISIBLE,
  update: STATE_VISIBLE,
  settings: STATE_VISIBLE,
  ewallet_logs: STATE_VISIBLE,
  backup: STATE_VISIBLE,
  monitoring: STATE_VISIBLE,
  audit_logs: STATE_VISIBLE
};

const SECTION_DEFINITIONS = [
  { key: 'main', labelKey: 'admin.section.main', labelDefault: 'UTAMA' },
  { key: 'billing', labelKey: 'admin.section.billing', labelDefault: 'BILLING' },
  { key: 'finance', labelKey: 'admin.section.finance', labelDefault: 'KEUANGAN' },
  { key: 'service', labelKey: 'admin.section.service', labelDefault: 'LAYANAN' },
  { key: 'cashier', labelKey: 'admin.section.cashier', labelDefault: 'KASIR' },
  { key: 'user_management', labelKey: 'admin.section.user_management', labelDefault: 'MANAJEMEN USER' },
  { key: 'system', labelKey: 'admin.section.system', labelDefault: 'SISTEM' }
];

function sha256(input) {
  return crypto.createHash('sha256').update(String(input || '')).digest('hex');
}

function normalizeState(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_STATES.has(normalized) ? normalized : STATE_VISIBLE;
}

function getStoredMenuStates() {
  // Ambil dari Database
  let raw = getAppSetting(SETTINGS_KEY, null);

  // Fallback ke settings.json jika di DB masih kosong (Migration)
  if (raw === null) {
    raw = getSetting(SETTINGS_KEY, {});
    if (Object.keys(raw).length > 0) {
      saveAppSetting(SETTINGS_KEY, raw);
    }
  }

  const stateMap = {};

  for (const menu of MENU_DEFINITIONS) {
    const defaultState = DEFAULT_MENU_STATES[menu.key] || STATE_VISIBLE;
    let storedState = raw && raw[menu.key] ? raw[menu.key] : defaultState;
    stateMap[menu.key] = normalizeState(storedState);
  }
  return stateMap;
}

function saveMenuStates(stateMap) {
  // Simpan ke Database (Utama)
  saveAppSetting(SETTINGS_KEY, sanitizeMenuStates(stateMap));
  return true;
}

function sanitizeMenuStates(input) {
  const clean = {};
  for (const menu of MENU_DEFINITIONS) {
    const defaultState = DEFAULT_MENU_STATES[menu.key] || STATE_VISIBLE;
    let state = input && input[menu.key] ? input[menu.key] : defaultState;
    
    clean[menu.key] = normalizeState(state);
  }
  return clean;
}

function isMenuAllowedForSession(menu, session) {
  if (!session) return false;
  const roles = Array.isArray(menu.roles) ? menu.roles : ['superadmin'];

  // Jika session adalah Cashier lama
  if (session.isCashier && !session.isAdmin) {
    return roles.includes('cashier') || roles.includes(session.adminRole || 'finance');
  }

  // Jika session adalah Admin (dengan role spesifik atau default superadmin)
  if (session.isAdmin) {
    // Menu absensi kasir pribadi hanya untuk kasir (memiliki cashierId)
    if (menu.key === 'cashier_attendance') {
      return false;
    }

    const adminRole = session.adminRole || 'superadmin';
    if (adminRole === 'superadmin') return true; // Super Admin memiliki hak akses penuh ke semua menu
    return roles.includes(adminRole);
  }

  return false;
}

function enrichMenu(menu, states) {
  const state = states[menu.key] || DEFAULT_MENU_STATES[menu.key] || STATE_VISIBLE;
  const locked = state === STATE_LOCKED;
  const hidden = state === STATE_HIDDEN;
  return {
    ...menu,
    state,
    locked,
    hidden,
    hrefResolved: menu.href,
    lockedMessage: locked ? `Menu "${menu.labelDefault}" terkunci.` : ''
  };
}

function getSidebarSections(session) {
  const states = getStoredMenuStates();
  return SECTION_DEFINITIONS.map((section) => {
    const rawItems = MENU_DEFINITIONS
      .filter((menu) => menu.section === section.key)
      .filter((menu) => isMenuAllowedForSession(menu, session))
      .map((menu) => enrichMenu(menu, states))
      .filter((menu) => !menu.hidden);

    const items = [];
    const itemMap = {};

    rawItems.forEach((item) => {
      itemMap[item.key] = { ...item, subItems: [] };
    });

    rawItems.forEach((item) => {
      if (item.parentKey && itemMap[item.parentKey]) {
        itemMap[item.parentKey].subItems.push(itemMap[item.key]);
      } else if (!item.parentKey) {
        items.push(itemMap[item.key]);
      }
    });

    return {
      ...section,
      items
    };
  }).filter((section) => section.items.length > 0);
}

function getBottomNavItems(session) {
  const states = getStoredMenuStates();
  return MENU_DEFINITIONS
    .filter((menu) => menu.bottomNav)
    .filter((menu) => isMenuAllowedForSession(menu, session))
    .map((menu) => enrichMenu(menu, states))
    .filter((menu) => !menu.hidden);
}

function getConfigMenus() {
  const states = getStoredMenuStates();
  return MENU_DEFINITIONS.map((menu) => {
    const section = SECTION_DEFINITIONS.find((s) => s.key === menu.section);
    return {
      ...menu,
      state: states[menu.key] || DEFAULT_MENU_STATES[menu.key] || STATE_VISIBLE,
      roleLabel: menu.roles.includes('admin') && menu.roles.includes('cashier')
        ? 'Admin & Kasir'
        : menu.roles.includes('cashier')
          ? 'Kasir'
          : 'Admin',
      sectionLabel: section?.labelDefault || menu.section,
      sectionLabelKey: section?.labelKey || ''
    };
  });
}

function getMenuDefinition(key) {
  return MENU_DEFINITIONS.find((menu) => menu.key === key) || null;
}

function evaluateMenuAccess(menuKey, session) {
  const menu = getMenuDefinition(menuKey);
  if (!menu) {
    return { allowed: true, state: STATE_VISIBLE, menu: null };
  }

  if (!isMenuAllowedForSession(menu, session)) {
    return { allowed: false, state: 'forbidden', menu, reason: 'forbidden' };
  }

  const states = getStoredMenuStates();
  const state = states[menu.key] || DEFAULT_MENU_STATES[menu.key] || STATE_VISIBLE;
  if (state === STATE_HIDDEN) {
    return { allowed: false, state, menu, reason: 'hidden' };
  }
  if (state === STATE_LOCKED) {
    return { allowed: false, state, menu, reason: 'locked' };
  }
  return { allowed: true, state, menu, reason: null };
}

module.exports = {
  STATE_VISIBLE,
  STATE_HIDDEN,
  STATE_LOCKED,
  MENU_DEFINITIONS,
  getSidebarSections,
  getBottomNavItems,
  getConfigMenus,
  getMenuDefinition,
  getStoredMenuStates,
  sanitizeMenuStates,
  saveMenuStates,
  evaluateMenuAccess,
};
