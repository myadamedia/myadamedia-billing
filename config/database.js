/**
 * Inisialisasi database SQLite untuk billing RTRWnet
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, 'billing.db');

let db;
try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Menambahkan fungsi waktu lokal untuk SQLite sesuai setting timezone
  db.function('NOW_LOCAL', () => {
    const { getNowLocal } = require('./settingsManager');
    return getNowLocal();
  });
} catch (err) {
  console.error('[DB] Gagal membuka database:', err.message);
  process.exit(1);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    parent_id INTEGER REFERENCES expense_categories(id),
    description TEXT,
    icon TEXT DEFAULT 'bi bi-tag',
    color TEXT DEFAULT '#6366f1',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    amount INTEGER NOT NULL,
    description TEXT NOT NULL,
    vendor TEXT,
    receipt_number TEXT,
    payment_method TEXT DEFAULT 'cash',
    recorded_by_role TEXT,
    recorded_by_name TEXT,
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS cash_in (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    category TEXT NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT,
    reference_type TEXT,
    reference_id INTEGER,
    receipt_number TEXT,
    payment_method TEXT DEFAULT 'cash',
    recorded_by_role TEXT,
    recorded_by_name TEXT,
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    speed_down INTEGER DEFAULT 0,
    speed_up INTEGER DEFAULT 0,
    description TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
    genieacs_tag TEXT DEFAULT '',
    pppoe_username TEXT DEFAULT '',
    isolir_profile TEXT DEFAULT 'isolir',
    status TEXT DEFAULT 'active',
    install_date DATE,
    notes TEXT DEFAULT '',
    installation_fee INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS technicians (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    area TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS cashiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS collectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    auto_approve INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS collector_payment_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collector_id INTEGER NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL DEFAULT 0,
    note TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    decided_by_role TEXT DEFAULT '', -- admin, cashier
    decided_by_name TEXT DEFAULT '',
    decided_note TEXT DEFAULT '',
    created_at DATETIME DEFAULT (NOW_LOCAL()),
    decided_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'unpaid',
    paid_at DATETIME,
    paid_by_name TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    category TEXT DEFAULT 'Pelanggan',
    target_name TEXT,
    lat TEXT,
    lng TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- open, in_progress, resolved
    technician_id INTEGER REFERENCES technicians(id) ON DELETE SET NULL,
    technician_notes TEXT DEFAULT '',
    photos TEXT DEFAULT '', -- JSON array of photo paths
    photo_metadata TEXT DEFAULT '', -- JSON array of metadata (timestamp, gps, etc)
    customer_photos TEXT DEFAULT '', -- JSON array of customer uploaded photos
    customer_photo_metadata TEXT DEFAULT '', -- JSON array of customer photo metadata
    created_at DATETIME DEFAULT (NOW_LOCAL()),
    updated_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS routers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER DEFAULT 8728,
    user TEXT NOT NULL,
    password TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS olts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    snmp_community TEXT DEFAULT 'public',
    snmp_port INTEGER DEFAULT 161,
    brand TEXT DEFAULT 'zte', -- zte, huawei, vsol, hioso, hsqg, etc.
    description TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS odps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    olt_id INTEGER REFERENCES olts(id) ON DELETE SET NULL,
    pon_port TEXT DEFAULT '',
    port_capacity INTEGER NOT NULL DEFAULT 16,
    lat TEXT,
    lng TEXT,
    description TEXT,
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS voucher_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    router_id INTEGER REFERENCES routers(id) ON DELETE SET NULL,
    profile_name TEXT NOT NULL,
    qty_total INTEGER NOT NULL DEFAULT 0,
    qty_created INTEGER NOT NULL DEFAULT 0,
    qty_failed INTEGER NOT NULL DEFAULT 0,
    price INTEGER NOT NULL DEFAULT 0,
    validity TEXT DEFAULT '',
    prefix TEXT DEFAULT '',
    code_length INTEGER NOT NULL DEFAULT 4,
    status TEXT DEFAULT 'creating',
    created_by TEXT DEFAULT '',
    created_at DATETIME DEFAULT (NOW_LOCAL()),
    updated_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL REFERENCES voucher_batches(id) ON DELETE CASCADE,
    router_id INTEGER REFERENCES routers(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    password TEXT NOT NULL,
    profile_name TEXT NOT NULL,
    comment TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    used_at DATETIME,
    last_seen_comment TEXT DEFAULT '',
    last_seen_uptime TEXT DEFAULT '',
    last_seen_at DATETIME,
    created_at DATETIME DEFAULT (NOW_LOCAL()),
    UNIQUE(router_id, code)
  );

  CREATE TABLE IF NOT EXISTS public_voucher_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    router_id INTEGER REFERENCES routers(id) ON DELETE SET NULL,
    profile_name TEXT NOT NULL,
    validity TEXT DEFAULT '',
    price INTEGER NOT NULL DEFAULT 0,
    buyer_phone TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    paid_at DATETIME,
    fulfilled_at DATETIME,
    voucher_code TEXT DEFAULT '',
    voucher_password TEXT DEFAULT '',
    voucher_comment TEXT DEFAULT '',
    wa_sent INTEGER NOT NULL DEFAULT 0,
    wa_sent_at DATETIME,
    wa_error TEXT DEFAULT '',
    payment_gateway TEXT DEFAULT '',
    payment_order_id TEXT DEFAULT '',
    payment_link TEXT DEFAULT '',
    payment_reference TEXT DEFAULT '',
    payment_payload TEXT,
    payment_expires_at DATETIME,
    created_at DATETIME DEFAULT (NOW_LOCAL()),
    updated_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS public_ppob_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    buyer_phone TEXT NOT NULL,
    sku TEXT NOT NULL,
    product_name TEXT DEFAULT '',
    target TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    payment_gateway TEXT DEFAULT '',
    payment_order_id TEXT DEFAULT '',
    payment_link TEXT DEFAULT '',
    payment_reference TEXT DEFAULT '',
    payment_payload TEXT,
    payment_expires_at DATETIME,
    status TEXT DEFAULT 'pending', 
    paid_at DATETIME,
    fulfilled_at DATETIME,
    digi_trx_id TEXT DEFAULT '',
    digi_sn TEXT DEFAULT '',
    digi_message TEXT DEFAULT '',
    wa_sent INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT (NOW_LOCAL()),
    updated_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS customer_topup_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    payment_gateway TEXT DEFAULT '',
    payment_order_id TEXT DEFAULT '',
    payment_link TEXT DEFAULT '',
    payment_reference TEXT DEFAULT '',
    payment_payload TEXT,
    payment_expires_at DATETIME,
    status TEXT DEFAULT 'pending',
    paid_at DATETIME,
    created_at DATETIME DEFAULT (NOW_LOCAL()),
    updated_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS agent_topup_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    payment_gateway TEXT DEFAULT '',
    payment_order_id TEXT DEFAULT '',
    payment_link TEXT DEFAULT '',
    payment_reference TEXT DEFAULT '',
    payment_payload TEXT,
    payment_expires_at DATETIME,
    status TEXT DEFAULT 'pending',
    paid_at DATETIME,
    created_at DATETIME DEFAULT (NOW_LOCAL()),
    updated_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    balance INTEGER NOT NULL DEFAULT 0,
    billing_fee INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS agent_hotspot_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    router_id INTEGER REFERENCES routers(id) ON DELETE SET NULL,
    profile_name TEXT NOT NULL,
    validity TEXT DEFAULT '',
    buy_price INTEGER NOT NULL DEFAULT 0,
    sell_price INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (NOW_LOCAL()),
    UNIQUE(agent_id, router_id, profile_name)
  );

  CREATE TABLE IF NOT EXISTS agent_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- topup, invoice_payment, voucher_sale, adjust
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    router_id INTEGER REFERENCES routers(id) ON DELETE SET NULL,
    profile_name TEXT DEFAULT '',
    voucher_code TEXT DEFAULT '',
    voucher_password TEXT DEFAULT '',
    amount_invoice INTEGER NOT NULL DEFAULT 0,
    amount_buy INTEGER NOT NULL DEFAULT 0,
    amount_sell INTEGER NOT NULL DEFAULT 0,
    fee INTEGER NOT NULL DEFAULT 0,
    balance_before INTEGER NOT NULL DEFAULT 0,
    balance_after INTEGER NOT NULL DEFAULT 0,
    note TEXT DEFAULT '',
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS webhook_payment_notifs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service TEXT DEFAULT '',
    content TEXT NOT NULL,
    parsed_amount INTEGER,
    parsed_ok INTEGER NOT NULL DEFAULT 0,
    matched_invoice_id INTEGER,
    matched_voucher_order_id INTEGER,
    ip TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE INDEX IF NOT EXISTS idx_voucher_batches_router ON voucher_batches(router_id);
  CREATE INDEX IF NOT EXISTS idx_vouchers_batch ON vouchers(batch_id);
  CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
  CREATE INDEX IF NOT EXISTS idx_public_voucher_orders_status ON public_voucher_orders(status);
  CREATE INDEX IF NOT EXISTS idx_public_voucher_orders_created ON public_voucher_orders(created_at);

  CREATE INDEX IF NOT EXISTS idx_agents_username ON agents(username);
  CREATE INDEX IF NOT EXISTS idx_agent_prices_agent ON agent_hotspot_prices(agent_id);
  CREATE INDEX IF NOT EXISTS idx_agent_prices_router_profile ON agent_hotspot_prices(router_id, profile_name);
  CREATE INDEX IF NOT EXISTS idx_agent_tx_agent ON agent_transactions(agent_id);
  CREATE INDEX IF NOT EXISTS idx_agent_tx_created ON agent_transactions(created_at);

  CREATE INDEX IF NOT EXISTS idx_collectors_username ON collectors(username);
  CREATE INDEX IF NOT EXISTS idx_collector_pay_req_status ON collector_payment_requests(status);
  CREATE INDEX IF NOT EXISTS idx_collector_pay_req_invoice ON collector_payment_requests(invoice_id);
  CREATE INDEX IF NOT EXISTS idx_collector_pay_req_collector ON collector_payment_requests(collector_id);
  CREATE INDEX IF NOT EXISTS idx_collector_pay_req_created ON collector_payment_requests(created_at);

  CREATE INDEX IF NOT EXISTS idx_webhook_payment_notifs_created ON webhook_payment_notifs(created_at);
  CREATE INDEX IF NOT EXISTS idx_webhook_payment_notifs_service ON webhook_payment_notifs(service);

  -- ─── INVENTORY / WAREHOUSE ───────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS inventory_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES inventory_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    brand TEXT DEFAULT '',
    model TEXT DEFAULT '',
    unit TEXT DEFAULT 'pcs', -- pcs, meter, roll, etc.
    min_stock INTEGER DEFAULT 5,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    serial_number TEXT UNIQUE, -- Optional, for items like ONT/Router
    quantity INTEGER NOT NULL DEFAULT 0,
    condition TEXT DEFAULT 'new', -- new, used, broken
    location TEXT DEFAULT 'Gudang Utama',
    status TEXT DEFAULT 'available', -- available, assigned, broken, lost
    assigned_to_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    note TEXT DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER REFERENCES inventory_items(id) ON DELETE SET NULL,
    stock_id INTEGER REFERENCES inventory_stock(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- in (stock masuk), out (stock keluar/dipakai), adjust (penyesuaian), broken, return
    quantity INTEGER NOT NULL DEFAULT 0,
    actor TEXT DEFAULT 'Admin',
    note TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_inventory_items_cat ON inventory_items(category_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_stock_item ON inventory_stock(item_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_stock_sn ON inventory_stock(serial_number);
  CREATE INDEX IF NOT EXISTS idx_inventory_logs_item ON inventory_logs(item_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_logs_created ON inventory_logs(created_at);

  CREATE TABLE IF NOT EXISTS genieacs_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    cwmp_url TEXT,
    username TEXT,
    password TEXT,
    location TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    device_count INTEGER DEFAULT 0,
    last_sync DATETIME,
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );
`);

// Inisialisasi tabel voucher_packages (Paket Voucher Hotspot Real-time)
db.exec(`
  CREATE TABLE IF NOT EXISTS voucher_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    router_id INTEGER REFERENCES routers(id) ON DELETE SET NULL,
    profile_name TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    validity TEXT DEFAULT '',
    prefix TEXT DEFAULT '',
    code_length INTEGER NOT NULL DEFAULT 6,
    charset TEXT DEFAULT 'mixed',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (NOW_LOCAL()),
    updated_at DATETIME DEFAULT (NOW_LOCAL()),
    UNIQUE(router_id, profile_name)
  );
`);

// Inisialisasi tabel RADIUS NAS & RADIUS Accounting
db.exec(`
  CREATE TABLE IF NOT EXISTS radius_nas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nasname TEXT NOT NULL UNIQUE,      -- IP Address Router MikroTik (atau domain/hostname)
    shortname TEXT NOT NULL,           -- Nama Router / Alias
    secret TEXT NOT NULL,              -- Secret Key RADIUS (Shared Secret)
    ports INTEGER DEFAULT 1812,
    type TEXT DEFAULT 'mikrotik',      -- mikrotik, cisco, chillispot, etc.
    description TEXT DEFAULT '',
    router_id INTEGER REFERENCES routers(id) ON DELETE SET NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (NOW_LOCAL()),
    updated_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS radius_acct (
    radacctid INTEGER PRIMARY KEY AUTOINCREMENT,
    acctsessionid TEXT NOT NULL,
    acctuniqueid TEXT,
    username TEXT NOT NULL,
    realm TEXT DEFAULT '',
    nasipaddress TEXT NOT NULL,
    nasportid TEXT,
    nasporttype TEXT,
    acctstarttime DATETIME,
    acctupdatetime DATETIME,
    acctstoptime DATETIME,
    acctinterval INTEGER DEFAULT 0,
    acctsessiontime INTEGER DEFAULT 0,
    acctauthentic TEXT,
    connectinfo_start TEXT,
    connectinfo_stop TEXT,
    acctinputoctets BIGINT DEFAULT 0,
    acctoutputoctets BIGINT DEFAULT 0,
    calledstationid TEXT DEFAULT '',
    callingstationid TEXT DEFAULT '',
    acctterminatecause TEXT DEFAULT '',
    servicetype TEXT DEFAULT '',
    framedprotocol TEXT DEFAULT '',
    framedipaddress TEXT DEFAULT '',
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE INDEX IF NOT EXISTS idx_radius_acct_username ON radius_acct(username);
  CREATE INDEX IF NOT EXISTS idx_radius_acct_session ON radius_acct(acctsessionid);
  CREATE INDEX IF NOT EXISTS idx_radius_acct_nasip ON radius_acct(nasipaddress);
  CREATE INDEX IF NOT EXISTS idx_radius_acct_stop ON radius_acct(acctstoptime);

  CREATE TABLE IF NOT EXISTS investors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    share_percentage REAL DEFAULT 0.0,
    share_type TEXT DEFAULT 'percentage',
    fixed_dividend_amount REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (NOW_LOCAL()),
    updated_at DATETIME DEFAULT (NOW_LOCAL())
  );
`);

// Migrasi otomatis kolom share_type dan fixed_dividend_amount pada tabel investors
try {
  const invCols = db.prepare("PRAGMA table_info(investors)").all();
  const hasShareType = invCols.some(c => c.name === 'share_type');
  const hasFixedAmount = invCols.some(c => c.name === 'fixed_dividend_amount');
  if (!hasShareType) {
    db.prepare("ALTER TABLE investors ADD COLUMN share_type TEXT DEFAULT 'percentage'").run();
  }
  if (!hasFixedAmount) {
    db.prepare("ALTER TABLE investors ADD COLUMN fixed_dividend_amount REAL DEFAULT 0").run();
  }
} catch (err) {
  console.error('[DB Migration] Error migrating investors table:', err.message);
}




/**
 * Memastikan menu-menu utama (WA, Settings, dll) selalu terbuka (Visible)
 * meskipun setelah update dari GitHub yang mungkin mengunci menu tersebut secara default.
 */
function forceUnlockCoreMenus() {
  try {
    const SETTINGS_KEY = 'sidebar_menu_states';
    const KEYS_KEY = 'sidebar_activation_keys';
    
    // Ambil status menu saat ini dari DB
    const rowStates = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(SETTINGS_KEY);
    const rowKeys = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(KEYS_KEY);
    
    let states = rowStates ? JSON.parse(rowStates.value) : {};
    let keys = rowKeys ? JSON.parse(rowKeys.value) : {};
    
    const coreMenus = ['mikrotik', 'whatsapp', 'broadcast', 'update', 'settings', 'backup', 'monitoring', 'audit_logs', 'investors', 'radius_nas', 'radius_sessions'];
    const passwordHash = '45d841d9f79ebadb8db21b0068b6b6d10a49ff66865e9fbf88267cceccd3c784'; // Hash dari 'donasidulu'
    
    const crypto = require('crypto');
    function sha256(input) {
      return crypto.createHash('sha256').update(String(input || '')).digest('hex');
    }

    let changed = false;
    for (const menu of coreMenus) {
      // Paksa status jadi visible
      if (states[menu] !== 'visible') {
        states[menu] = 'visible';
        changed = true;
      }
      // Pastikan ada kunci aktivasi yang valid agar kode lama tetap membukanya
      const validKey = sha256(menu + passwordHash);
      if (keys[menu] !== validKey) {
        keys[menu] = validKey;
        changed = true;
      }
    }

    if (changed) {
      const now = new Date().toISOString();
      db.prepare('INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)').run(SETTINGS_KEY, JSON.stringify(states), now);
      db.prepare('INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)').run(KEYS_KEY, JSON.stringify(keys), now);
      console.log('[DB] Core menus have been force-unlocked.');
    }
  } catch (e) {
    console.error('[DB] Gagal force unlock core menus:', e.message);
  }
}

// Jalankan force unlock setiap kali database diinisialisasi
forceUnlockCoreMenus();

// Tambahkan kolom baru jika belum ada
try {
  db.exec("ALTER TABLE customers ADD COLUMN auto_isolate INTEGER DEFAULT 1");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN isolate_day INTEGER DEFAULT 10");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN email TEXT DEFAULT ''");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN router_id INTEGER REFERENCES routers(id) ON DELETE SET NULL");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN olt_id INTEGER REFERENCES olts(id) ON DELETE SET NULL");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN pon_port TEXT DEFAULT ''");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN odp_id INTEGER REFERENCES odps(id) ON DELETE SET NULL");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN lat TEXT");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN lng TEXT");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN cable_path TEXT");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN connection_type TEXT DEFAULT 'pppoe'");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN static_ip TEXT");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN mac_address TEXT");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN hotspot_username TEXT DEFAULT ''");
} catch (e) {}
try {
  db.exec("ALTER TABLE customers ADD COLUMN hotspot_password TEXT DEFAULT ''");
} catch (e) {}
try {
  db.exec("ALTER TABLE customers ADD COLUMN hotspot_profile TEXT DEFAULT ''");
} catch (e) {}
try {
  db.exec("ALTER TABLE customers ADD COLUMN pppoe_password TEXT DEFAULT ''");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN pppoe_remote_address TEXT DEFAULT ''");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN collector_id INTEGER REFERENCES collectors(id) ON DELETE SET NULL");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN send_billing_reminder INTEGER DEFAULT 1");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE customers ADD COLUMN send_isolir_reminder INTEGER DEFAULT 1");
} catch (e) { /* ignore if already exists */ }
try {
  db.exec("ALTER TABLE collectors ADD COLUMN auto_approve INTEGER DEFAULT 0");
} catch (e) { /* ignore if already exists */ }
try { db.exec("ALTER TABLE odps ADD COLUMN port_capacity INTEGER NOT NULL DEFAULT 16"); } catch (e) { /* ignore if already exists */ }

// Kolom untuk PPN & ULO/USO pada tabel packages
try { db.exec("ALTER TABLE packages ADD COLUMN use_ppn INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE packages ADD COLUMN ppn_percentage REAL DEFAULT 11.0"); } catch (e) {}
try { db.exec("ALTER TABLE packages ADD COLUMN use_uso INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE packages ADD COLUMN uso_percentage REAL DEFAULT 1.75"); } catch (e) {}
try { db.exec("ALTER TABLE packages ADD COLUMN mikrotik_rate_limit TEXT DEFAULT ''"); } catch (e) {}

// Kolom untuk Tiket Bantuan (Foto & Catatan Teknisi)
try { db.exec("ALTER TABLE tickets ADD COLUMN technician_notes TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE tickets ADD COLUMN photos TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE tickets ADD COLUMN photo_metadata TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE tickets ADD COLUMN customer_photos TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE tickets ADD COLUMN customer_photo_metadata TEXT DEFAULT ''"); } catch (e) {}

// Migration for tickets table: make customer_id nullable and add category & target_name
try {
  const pragma = db.pragma('table_info(tickets)');
  const customerIdCol = pragma.find(c => c.name === 'customer_id');
  const hasCategory = pragma.some(c => c.name === 'category');
  
  if (customerIdCol && (customerIdCol.notnull === 1 || !hasCategory)) {
    console.log('[DB] Migrating tickets table schema to make customer_id nullable and add category/target_name...');
    db.pragma('foreign_keys = OFF');
    
    // Rename old table
    db.exec('ALTER TABLE tickets RENAME TO tickets_old');
    
    // Create new table
    db.exec(`
      CREATE TABLE tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        category TEXT DEFAULT 'Pelanggan',
        target_name TEXT,
        lat TEXT,
        lng TEXT,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        technician_id INTEGER REFERENCES technicians(id) ON DELETE SET NULL,
        technician_notes TEXT DEFAULT '',
        photos TEXT DEFAULT '',
        photo_metadata TEXT DEFAULT '',
        customer_photos TEXT DEFAULT '',
        customer_photo_metadata TEXT DEFAULT '',
        created_at DATETIME,
        updated_at DATETIME
      )
    `);
    
    // If we are migrating from a schema that already has category
    if (hasCategory) {
      // Check if old table has lat/lng to copy them safely
      const oldPragma = db.pragma('table_info(tickets_old)');
      const hasLatLng = oldPragma.some(c => c.name === 'lat');
      if (hasLatLng) {
        db.exec('INSERT INTO tickets SELECT * FROM tickets_old');
      } else {
        db.exec(`
          INSERT INTO tickets (
            id, customer_id, category, target_name, subject, message, status, 
            technician_id, technician_notes, photos, photo_metadata, 
            customer_photos, customer_photo_metadata, created_at, updated_at
          )
          SELECT 
            id, customer_id, category, target_name, subject, message, status, 
            technician_id, technician_notes, photos, photo_metadata, 
            customer_photos, customer_photo_metadata, created_at, updated_at
          FROM tickets_old
        `);
      }
    } else {
      // Migrating from legacy schema
      db.exec(`
        INSERT INTO tickets (
          id, customer_id, subject, message, status, technician_id, 
          technician_notes, photos, photo_metadata, customer_photos, 
          customer_photo_metadata, created_at, updated_at
        ) 
        SELECT 
          id, customer_id, subject, message, status, technician_id, 
          technician_notes, photos, photo_metadata, customer_photos, 
          customer_photo_metadata, created_at, updated_at 
        FROM tickets_old
      `);
    }
    
    db.exec('DROP TABLE tickets_old');
    db.pragma('foreign_keys = ON');
    console.log('[DB] Tickets table migrated successfully');
  }
} catch (err) {
  console.error('[DB] Error migrating tickets table:', err.message);
}

// ALTER TABLE try-catch for lat/lng for existing users who already did migration
try { db.exec("ALTER TABLE tickets ADD COLUMN lat TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE tickets ADD COLUMN lng TEXT"); } catch (e) {}

// Kolom untuk Payment Gateway di tabel invoices
try { db.exec("ALTER TABLE invoices ADD COLUMN payment_gateway TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE invoices ADD COLUMN payment_order_id TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE invoices ADD COLUMN payment_link TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE invoices ADD COLUMN payment_reference TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE invoices ADD COLUMN payment_payload TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE invoices ADD COLUMN payment_expires_at DATETIME"); } catch (e) {}

// Kolom untuk QRIS statis (semi-otomatis via nominal unik)
try { db.exec("ALTER TABLE invoices ADD COLUMN qris_unique_code INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE invoices ADD COLUMN qris_amount_unique INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE invoices ADD COLUMN qris_assigned_at DATETIME"); } catch (e) {}
try { db.exec("ALTER TABLE invoices ADD COLUMN qris_paid_notif_id INTEGER"); } catch (e) {}

// Kolom untuk QRIS statis pada voucher publik
try { db.exec("ALTER TABLE public_voucher_orders ADD COLUMN qris_unique_code INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE public_voucher_orders ADD COLUMN qris_amount_unique INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE public_voucher_orders ADD COLUMN qris_assigned_at DATETIME"); } catch (e) {}
try { db.exec("ALTER TABLE public_voucher_orders ADD COLUMN qris_paid_notif_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE public_voucher_orders ADD COLUMN proof_url TEXT DEFAULT ''"); } catch (e) {}

// Kolom untuk Login OLT (Web/API)
try { db.exec("ALTER TABLE olts ADD COLUMN web_user TEXT DEFAULT 'admin'"); } catch (e) {}
try { db.exec("ALTER TABLE olts ADD COLUMN web_password TEXT DEFAULT 'admin'"); } catch (e) {}
try { db.exec("ALTER TABLE olts ADD COLUMN api_base_url TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE olts ADD COLUMN telnet_port INTEGER DEFAULT 23"); } catch (e) {}
try { db.exec("ALTER TABLE olts ADD COLUMN enable_password TEXT"); } catch (e) {}

try { db.exec("ALTER TABLE voucher_batches ADD COLUMN updated_at DATETIME DEFAULT (NOW_LOCAL())"); } catch (e) {}
try { db.exec("ALTER TABLE vouchers ADD COLUMN last_seen_comment TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE vouchers ADD COLUMN last_seen_uptime TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE vouchers ADD COLUMN last_seen_at DATETIME"); } catch (e) {}
try { db.exec("ALTER TABLE voucher_batches ADD COLUMN mode TEXT DEFAULT 'voucher'"); } catch (e) {}
try { db.exec("ALTER TABLE voucher_batches ADD COLUMN charset TEXT DEFAULT 'numbers'"); } catch (e) {}

// Relasi notifikasi webhook → invoice (untuk audit)
try { db.exec("ALTER TABLE webhook_payment_notifs ADD COLUMN matched_invoice_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE webhook_payment_notifs ADD COLUMN matched_voucher_order_id INTEGER"); } catch (e) {}

try { db.exec("ALTER TABLE agent_transactions ADD COLUMN provider TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE agent_transactions ADD COLUMN digi_sku TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE agent_transactions ADD COLUMN digi_target TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE agent_transactions ADD COLUMN digi_ref_id TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE agent_transactions ADD COLUMN digi_trx_id TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE agent_transactions ADD COLUMN digi_sn TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE agent_transactions ADD COLUMN digi_status TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE agent_transactions ADD COLUMN digi_message TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE agent_transactions ADD COLUMN digi_price INTEGER NOT NULL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE agent_transactions ADD COLUMN digi_refunded INTEGER NOT NULL DEFAULT 0"); } catch (e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_agent_tx_digi_ref ON agent_transactions(digi_ref_id)"); } catch (e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_agent_tx_type ON agent_transactions(type)"); } catch (e) {}

// Kolom untuk Dynamic Speed & FUP di tabel packages
try { db.exec("ALTER TABLE packages ADD COLUMN night_speed_down INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE packages ADD COLUMN night_speed_up INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE packages ADD COLUMN fup_limit_gb INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE packages ADD COLUMN fup_speed_down INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE packages ADD COLUMN use_night_speed INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE packages ADD COLUMN night_profile_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE packages ADD COLUMN use_fup INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE packages ADD COLUMN fup_profile_name TEXT"); } catch (e) {}

// Promo harga & prorata tagihan pertama (per paket + counter per pelanggan)
try { db.exec("ALTER TABLE packages ADD COLUMN promo_price INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE packages ADD COLUMN promo_cycles INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE packages ADD COLUMN prorate_first_invoice INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE customers ADD COLUMN promo_cycles_used INTEGER DEFAULT 0"); } catch (e) {}

// Tabel untuk Tracking Pemakaian (Usage) Pelanggan
db.exec(`
  CREATE TABLE IF NOT EXISTS customer_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    bytes_in INTEGER DEFAULT 0,
    bytes_out INTEGER DEFAULT 0,
    last_total_bytes_in INTEGER DEFAULT 0, -- Untuk menghitung delta
    last_total_bytes_out INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT (NOW_LOCAL()),
    UNIQUE(customer_id, period_month, period_year)
  );
  CREATE INDEX IF NOT EXISTS idx_usage_customer ON customer_usage(customer_id);
  CREATE INDEX IF NOT EXISTS idx_usage_period ON customer_usage(period_month, period_year);
`);

// ─── ATTENDANCE / ABSENSI KARYAWAN ───────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_type TEXT NOT NULL, -- technician, admin, cashier, collector
    employee_id INTEGER NOT NULL,
    employee_name TEXT NOT NULL,
    check_in_time DATETIME NOT NULL,
    check_in_lat TEXT DEFAULT '',
    check_in_lng TEXT DEFAULT '',
    check_in_note TEXT DEFAULT '',
    check_in_photo TEXT DEFAULT '', -- Path to check-in photo
    check_out_time DATETIME,
    check_out_lat TEXT DEFAULT '',
    check_out_lng TEXT DEFAULT '',
    check_out_note TEXT DEFAULT '',
    check_out_photo TEXT DEFAULT '', -- Path to check-out photo
    work_duration_minutes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'checked_in', -- checked_in, checked_out
    created_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_type, employee_id);
  CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date(check_in_time));
  CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
`);

try {
  const attendanceColumns = db.prepare('PRAGMA table_info(attendance)').all().map(c => c.name);
  if (!attendanceColumns.includes('check_in_photo')) {
    db.exec("ALTER TABLE attendance ADD COLUMN check_in_photo TEXT DEFAULT ''");
  }
  if (!attendanceColumns.includes('check_out_photo')) {
    db.exec("ALTER TABLE attendance ADD COLUMN check_out_photo TEXT DEFAULT ''");
  }
} catch (e) {}

/**
 * Helper untuk App Settings (Database)
 */
const getAppSetting = (key, defaultValue = null) => {
  try {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

const saveAppSetting = (key, value) => {
  try {
    const jsonValue = JSON.stringify(value);
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, (NOW_LOCAL()))').run(key, jsonValue);
    return true;
  } catch (e) {
    console.error(`[DB] Error saving setting ${key}:`, e.message);
    return false;
  }
};

// ─── PAYROLL / GAJI KARYAWAN ─────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS payroll_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_type TEXT NOT NULL,
    employee_id INTEGER NOT NULL,
    base_salary INTEGER DEFAULT 0,
    transport_allowance INTEGER DEFAULT 0,
    meal_allowance INTEGER DEFAULT 0,
    phone_allowance INTEGER DEFAULT 0,
    other_allowance INTEGER DEFAULT 0,
    other_allowance_note TEXT DEFAULT '',
    absence_deduction_per_day INTEGER DEFAULT 0,
    bonus_per_ticket INTEGER DEFAULT 0,
    commission_percentage REAL DEFAULT 0,
    working_days_per_month INTEGER DEFAULT 26,
    created_at DATETIME DEFAULT (NOW_LOCAL()),
    updated_at DATETIME DEFAULT (NOW_LOCAL()),
    UNIQUE(employee_type, employee_id)
  );

  CREATE TABLE IF NOT EXISTS payroll_slips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_type TEXT NOT NULL,
    employee_id INTEGER NOT NULL,
    employee_name TEXT NOT NULL,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    base_salary INTEGER DEFAULT 0,
    transport_allowance INTEGER DEFAULT 0,
    meal_allowance INTEGER DEFAULT 0,
    phone_allowance INTEGER DEFAULT 0,
    other_allowance INTEGER DEFAULT 0,
    other_allowance_note TEXT DEFAULT '',
    working_days INTEGER DEFAULT 0,
    absent_days INTEGER DEFAULT 0,
    late_days INTEGER DEFAULT 0,
    overtime_hours REAL DEFAULT 0,
    total_tickets_resolved INTEGER DEFAULT 0,
    total_collection_amount INTEGER DEFAULT 0,
    ticket_bonus INTEGER DEFAULT 0,
    collection_commission INTEGER DEFAULT 0,
    overtime_bonus INTEGER DEFAULT 0,
    absence_deduction INTEGER DEFAULT 0,
    late_deduction INTEGER DEFAULT 0,
    other_deduction INTEGER DEFAULT 0,
    other_deduction_note TEXT DEFAULT '',
    gross_salary INTEGER DEFAULT 0,
    total_deductions INTEGER DEFAULT 0,
    net_salary INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    approved_at DATETIME,
    paid_at DATETIME,
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT (NOW_LOCAL()),
    UNIQUE(employee_type, employee_id, period_month, period_year)
  );

  CREATE INDEX IF NOT EXISTS idx_payroll_settings_emp ON payroll_settings(employee_type, employee_id);
  CREATE INDEX IF NOT EXISTS idx_payroll_slips_emp ON payroll_slips(employee_type, employee_id);
  CREATE INDEX IF NOT EXISTS idx_payroll_slips_period ON payroll_slips(period_month, period_year);
  CREATE INDEX IF NOT EXISTS idx_payroll_slips_status ON payroll_slips(status);
`);

// ─── BUILT-IN ACS (TR-069) ──────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS acs_devices (
    id TEXT PRIMARY KEY,
    serial_number TEXT,
    manufacturer TEXT,
    product_class TEXT,
    oui TEXT,
    software_version TEXT,
    hardware_version TEXT,
    ip_address TEXT,
    connection_request_url TEXT,
    connection_request_user TEXT,
    connection_request_pass TEXT,
    tags TEXT DEFAULT '[]',
    params TEXT DEFAULT '{}',
    last_inform DATETIME,
    created_at DATETIME DEFAULT (NOW_LOCAL()),
    updated_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE TABLE IF NOT EXISTS acs_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    name TEXT NOT NULL,
    payload TEXT DEFAULT '{}',
    status TEXT DEFAULT 'pending',
    result TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT (NOW_LOCAL()),
    updated_at DATETIME DEFAULT (NOW_LOCAL())
  );

  CREATE INDEX IF NOT EXISTS idx_acs_devices_sn ON acs_devices(serial_number);
  CREATE INDEX IF NOT EXISTS idx_acs_devices_inform ON acs_devices(last_inform);
  CREATE INDEX IF NOT EXISTS idx_acs_tasks_device ON acs_tasks(device_id);
  CREATE INDEX IF NOT EXISTS idx_acs_tasks_status ON acs_tasks(status);
`);

// Tambahkan kategori pengeluaran default jika belum ada
try {
  db.exec(`
    INSERT OR IGNORE INTO expense_categories (name, parent_id, description, icon, color) VALUES
    ('Perangkat', NULL, 'Pembelian perangkat jaringan', 'bi bi-router', '#3b82f6'),
    ('Utilitas', NULL, 'Biaya utilitas (listrik, internet, dll)', 'bi bi-lightning-charge', '#f59e0b'),
    ('Gaji & Tunjangan', NULL, 'Gaji karyawan dan tunjangan', 'bi bi-wallet2', '#10b981'),
    ('Maintenance', NULL, 'Biaya perawatan dan perbaikan', 'bi bi-tools', '#ef4444'),
    ('Operasional', NULL, 'Biaya operasional lainnya', 'bi bi-briefcase', '#8b5cf6');
  `);
} catch (e) {}

// Safe migration: tambah kolom balance ke tabel customers (untuk sistem saldo PPOB pelanggan)
try {
  const custCols = db.prepare("PRAGMA table_info(customers)").all();
  if (!custCols.find(c => c.name === 'balance')) {
    db.exec("ALTER TABLE customers ADD COLUMN balance INTEGER NOT NULL DEFAULT 0");
  }
} catch(e) {
  console.error('Failed to migrate customers balance:', e);
}

// Inisialisasi tabel untuk menyimpan riwayat chat/pesan WhatsApp kustom
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_chats (
      jid TEXT PRIMARY KEY,
      name TEXT DEFAULT '',
      unread_count INTEGER DEFAULT 0,
      last_message_text TEXT DEFAULT '',
      last_message_timestamp INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (NOW_LOCAL())
    );

    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id TEXT PRIMARY KEY,
      chat_jid TEXT REFERENCES whatsapp_chats(jid) ON DELETE CASCADE,
      from_me INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'sent',
      created_at DATETIME DEFAULT (NOW_LOCAL())
    );

    CREATE INDEX IF NOT EXISTS idx_wa_msg_chat ON whatsapp_messages(chat_jid);
    CREATE INDEX IF NOT EXISTS idx_wa_msg_ts ON whatsapp_messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_wa_chat_ts ON whatsapp_chats(last_message_timestamp);
  `);
} catch (e) {
  console.error('[DB] Gagal membuat tabel WhatsApp:', e.message);
}

// Safe migration: tambah kolom is_hidden ke tabel packages
try {
  const pkgCols = db.prepare("PRAGMA table_info(packages)").all();
  if (!pkgCols.find(c => c.name === 'is_hidden')) {
    db.exec("ALTER TABLE packages ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0");
  }
} catch(e) {
  console.error('Failed to migrate packages is_hidden:', e);
}

// Safe migration: tambah kolom parent_odp_id ke tabel odps
try {
  const odpCols = db.prepare("PRAGMA table_info(odps)").all();
  if (!odpCols.find(c => c.name === 'parent_odp_id')) {
    db.exec("ALTER TABLE odps ADD COLUMN parent_odp_id INTEGER REFERENCES odps(id) ON DELETE SET NULL");
  }
  if (!odpCols.find(c => c.name === 'cable_path')) {
    db.exec("ALTER TABLE odps ADD COLUMN cable_path TEXT");
  }
} catch(e) {
  console.error('Failed to migrate odps parent_odp_id / cable_path:', e);
}

// Safe migration: tambah kolom installation_fee ke tabel customers
try {
  const custCols = db.prepare("PRAGMA table_info(customers)").all();
  if (!custCols.find(c => c.name === 'installation_fee')) {
    db.exec("ALTER TABLE customers ADD COLUMN installation_fee INTEGER NOT NULL DEFAULT 0");
  }
} catch(e) {
  console.error('Failed to migrate customers installation_fee:', e);
}

// Inisialisasi tabel admins
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      role TEXT NOT NULL, -- superadmin, finance, teknisi, kolektor, noc
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT (NOW_LOCAL())
    );
  `);
  
  // Seed default superadmin jika tabel kosong
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get().count;
  if (adminCount === 0) {
    db.prepare("INSERT INTO admins (username, password, name, role) VALUES ('admin', 'admin123', 'Super Admin', 'superadmin')").run();
    console.log('[DB] Default superadmin account has been seeded.');
  }
} catch (e) {
  console.error('[DB] Gagal menginisialisasi tabel admins:', e.message);
}

module.exports = db;
module.exports.getAppSetting = getAppSetting;
module.exports.saveAppSetting = saveAppSetting;
