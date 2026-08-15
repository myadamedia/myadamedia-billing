/**
 * Service: CRUD Pelanggan & Paket
 */
const db = require('../config/database');
const { logger } = require('../config/logger');
const { getCurrentDateInTimezone } = require('../config/settingsManager');

// ─── CUSTOMERS ───────────────────────────────────────────────
function getAllCustomers(search = '', sortBy = 'name_asc') {
  const now = getCurrentDateInTimezone();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const base = `
    SELECT c.*, p.name as package_name, p.price as package_price,
           p.promo_cycles as package_promo_cycles,
           p.prorate_first_invoice as package_prorate_first_invoice,
           p.speed_down, p.speed_up, p.fup_limit_gb, p.use_fup,
           r.name as router_name,
           o.name as olt_name,
           odp.name as odp_name,
           (SELECT COUNT(*) FROM invoices WHERE customer_id=c.id AND status='unpaid') as unpaid_count,
           u.bytes_in, u.bytes_out
    FROM customers c
    LEFT JOIN packages p ON c.package_id = p.id
    LEFT JOIN routers r ON c.router_id = r.id
    LEFT JOIN olts o ON c.olt_id = o.id
    LEFT JOIN odps odp ON c.odp_id = odp.id
    LEFT JOIN customer_usage u ON u.customer_id = c.id AND u.period_month = ${month} AND u.period_year = ${year}
  `;

  // Define allowed sorting mappings to prevent SQL Injection
  const sortingClauses = {
    'name_asc': 'c.name ASC',
    'name_desc': 'c.name DESC',
    'id_asc': 'c.id ASC',
    'id_desc': 'c.id DESC',
    'install_asc': 'c.install_date ASC',
    'install_desc': 'c.install_date DESC',
    'due_asc': 'COALESCE(c.isolate_day, 10) ASC, c.name ASC',
    'due_desc': 'COALESCE(c.isolate_day, 10) DESC, c.name ASC'
  };

  const orderClause = sortingClauses[sortBy] || 'c.name ASC';

  if (search) {
    const s = `%${search}%`;
    return db.prepare(base + ` WHERE ('MDE-' || printf('%04d', c.id)) LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR c.genieacs_tag LIKE ? OR c.address LIKE ? ORDER BY ${orderClause}`).all(s, s, s, s, s);
  }
  return db.prepare(base + ` ORDER BY ${orderClause}`).all();
}

function resetPromoCyclesUsed(customerId) {
  const id = Number(customerId);
  if (!Number.isFinite(id) || id <= 0) throw new Error('ID pelanggan tidak valid');
  return db.prepare('UPDATE customers SET promo_cycles_used = 0 WHERE id=?').run(id);
}

function getCustomerById(id) {
  return db.prepare(`
    SELECT c.*, p.name as package_name, p.price as package_price,
           p.promo_cycles as package_promo_cycles,
           p.prorate_first_invoice as package_prorate_first_invoice,
           r.name as router_name, o.name as olt_name, odp.name as odp_name
    FROM customers c 
    LEFT JOIN packages p ON c.package_id = p.id 
    LEFT JOIN routers r ON c.router_id = r.id
    LEFT JOIN olts o ON c.olt_id = o.id
    LEFT JOIN odps odp ON c.odp_id = odp.id
    WHERE c.id = ?
  `).get(id);
}

function createCustomer(data) {
  return db.prepare(`
    INSERT INTO customers (name, phone, email, address, package_id, router_id, olt_id, odp_id, pon_port, lat, lng, genieacs_tag, pppoe_username, pppoe_password, pppoe_remote_address, isolir_profile, status, install_date, notes, auto_isolate, isolate_day, connection_type, static_ip, mac_address, hotspot_username, hotspot_password, hotspot_profile, collector_id, installation_fee, send_billing_reminder, send_isolir_reminder)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.name, data.phone || '', data.email || '', data.address || '',
    data.package_id ? parseInt(data.package_id) : null,
    data.router_id ? parseInt(data.router_id) : null,
    data.olt_id ? parseInt(data.olt_id) : null,
    data.odp_id ? parseInt(data.odp_id) : null,
    data.pon_port || '',
    data.lat || '',
    data.lng || '',
    data.genieacs_tag || '', data.pppoe_username || '',
    data.pppoe_password || '',
    data.pppoe_remote_address || '',
    data.isolir_profile || 'isolir',
    data.status || 'active',
    data.install_date || null, data.notes || '',
    data.auto_isolate !== undefined ? parseInt(data.auto_isolate) : 1,
    data.isolate_day !== undefined ? parseInt(data.isolate_day) : 10,
    data.connection_type || 'pppoe',
    data.static_ip || '',
    data.mac_address || '',
    data.hotspot_username || '',
    data.hotspot_password || '',
    data.hotspot_profile || '',
    data.collector_id ? parseInt(data.collector_id) : null,
    data.installation_fee !== undefined ? parseInt(data.installation_fee) : 0,
    data.send_billing_reminder !== undefined ? parseInt(data.send_billing_reminder) : 1,
    data.send_isolir_reminder !== undefined ? parseInt(data.send_isolir_reminder) : 1
  );
}

function updateCustomer(id, data) {
  const prev = db.prepare('SELECT status, package_id, pppoe_username, router_id, static_ip, isolir_profile, connection_type, hotspot_username FROM customers WHERE id=?').get(id);
  const oldStatus = prev ? prev.status : null;
  const newStatus = data.status !== undefined ? data.status : (prev ? prev.status : 'active');
  const newPkgId = data.package_id ? parseInt(data.package_id, 10) : null;
  const pkgChanged = prev && Number(prev.package_id || 0) !== Number(newPkgId || 0);

  const result = db.prepare(`
    UPDATE customers SET name=?, phone=?, email=?, address=?, package_id=?, router_id=?, olt_id=?, odp_id=?, pon_port=?, lat=?, lng=?, genieacs_tag=?, pppoe_username=?, pppoe_password=?, pppoe_remote_address=?, isolir_profile=?, status=?, install_date=?, notes=?, auto_isolate=?, isolate_day=?, cable_path=?, connection_type=?, static_ip=?, mac_address=?, hotspot_username=?, hotspot_password=?, hotspot_profile=?, collector_id=?, installation_fee=?, send_billing_reminder=?, send_isolir_reminder=?
    WHERE id=?
  `).run(
    data.name, data.phone || '', data.email || '', data.address || '',
    data.package_id ? parseInt(data.package_id) : null,
    data.router_id ? parseInt(data.router_id) : null,
    data.olt_id ? parseInt(data.olt_id) : null,
    data.odp_id ? parseInt(data.odp_id) : null,
    data.pon_port || '',
    data.lat || '',
    data.lng || '',
    data.genieacs_tag || '', data.pppoe_username || '',
    data.pppoe_password || '',
    data.pppoe_remote_address || '',
    data.isolir_profile || 'isolir',
    newStatus,
    data.install_date || null, data.notes || '',
    data.auto_isolate !== undefined ? parseInt(data.auto_isolate) : 1,
    data.isolate_day !== undefined ? parseInt(data.isolate_day) : 10,
    data.cable_path || null,
    data.connection_type || 'pppoe',
    data.static_ip || '',
    data.mac_address || '',
    data.hotspot_username || '',
    data.hotspot_password || '',
    data.hotspot_profile || '',
    data.collector_id ? parseInt(data.collector_id) : null,
    data.installation_fee !== undefined ? parseInt(data.installation_fee) : 0,
    data.send_billing_reminder !== undefined ? parseInt(data.send_billing_reminder) : 1,
    data.send_isolir_reminder !== undefined ? parseInt(data.send_isolir_reminder) : 1,
    id
  );

  if (pkgChanged) {
    db.prepare('UPDATE customers SET promo_cycles_used = 0 WHERE id=?').run(id);
  }

  // Trigger MikroTik / RADIUS sync jika terjadi perubahan status atau perubahan data pelanggan terisolir
  if (oldStatus !== 'suspended' && newStatus === 'suspended') {
    syncCustomerIsolation(id).catch(err => logger.error(`[updateCustomer] Auto sync isolation error for customer ${id}: ${err.message}`));
  } else if (oldStatus === 'suspended' && newStatus === 'active') {
    syncCustomerActivation(id).catch(err => logger.error(`[updateCustomer] Auto sync activation error for customer ${id}: ${err.message}`));
  } else if (newStatus === 'suspended') {
    if (prev && (prev.pppoe_username !== (data.pppoe_username || '') || prev.router_id !== (data.router_id ? parseInt(data.router_id) : null) || prev.static_ip !== (data.static_ip || '') || prev.isolir_profile !== (data.isolir_profile || 'isolir'))) {
      syncCustomerIsolation(id).catch(err => logger.error(`[updateCustomer] Re-sync isolation error for customer ${id}: ${err.message}`));
    }
  }

  return result;
}

function updateCustomerCablePath(id, path) {
  return db.prepare('UPDATE customers SET cable_path = ? WHERE id = ?').run(path, id);
}

async function deleteCustomer(id) {
  const customer = getCustomerById(id);
  const mikrotikSvc = require('./mikrotikService');
  
  // Remove static IP if connection type is static
  if (customer && customer.connection_type === 'static' && customer.static_ip) {
    try {
      await mikrotikSvc.removeStaticIp(customer.static_ip, customer.router_id);
    } catch (e) {
      console.error('Failed to remove static IP from MikroTik during customer deletion:', e);
    }
  }
  
  // Remove PPPoE secret if connection type is pppoe and username exists
  if (customer && customer.connection_type === 'pppoe' && customer.pppoe_username) {
    try {
      console.log(`[DELETE] Attempting to remove PPPoE secret: ${customer.pppoe_username} from router ${customer.router_id}`);
      
      // Get PPPoE secrets to find the ID
      const secrets = await mikrotikSvc.getPppoeSecrets(customer.router_id);
      console.log(`[DELETE] Found ${secrets.length} PPPoE secrets in MikroTik`);
      
      // Try to find by exact name match
      let secret = secrets.find(s => s.name === customer.pppoe_username);
      
      // If not found, try case-insensitive match
      if (!secret) {
        const username = String(customer.pppoe_username || '').toLowerCase();
        secret = secrets.find(s => String(s.name || '').toLowerCase() === username);
      }
      
      if (secret) {
        // Check both .id and id fields
        const secretId = secret['.id'] || secret.id;
        console.log(`[DELETE] Found secret with ID: ${secretId}, name: ${secret.name}`);
        
        if (secretId) {
          await mikrotikSvc.deletePppoeSecret(secretId, customer.router_id);
          console.log(`[DELETE] Successfully removed PPPoE secret for ${customer.pppoe_username} from MikroTik`);
        } else {
          console.warn(`[DELETE] Secret found but no ID available for ${customer.pppoe_username}`);
        }
      } else {
        console.warn(`[DELETE] PPPoE secret for ${customer.pppoe_username} not found in MikroTik`);
        console.log(`[DELETE] Available usernames: ${secrets.map(s => s.name).join(', ')}`);
      }
    } catch (e) {
      console.error('[DELETE] Failed to remove PPPoE secret from MikroTik during customer deletion:', e);
    }
  }
  
  // Remove Hotspot user if connection type is hotspot and username exists
  if (customer && customer.connection_type === 'hotspot' && customer.hotspot_username) {
    try {
      // Get hotspot user to find the ID
      const hotspotUser = await mikrotikSvc.getHotspotUserByName(customer.hotspot_username, customer.router_id);
      
      if (hotspotUser && hotspotUser.id) {
        await mikrotikSvc.deleteHotspotUser(hotspotUser.id, customer.router_id);
        console.log(`Successfully removed Hotspot user ${customer.hotspot_username} from MikroTik`);
      } else {
        console.warn(`Hotspot user ${customer.hotspot_username} not found in MikroTik`);
      }
    } catch (e) {
      console.error('Failed to remove Hotspot user from MikroTik during customer deletion:', e);
    }
  }
  
  return db.prepare('DELETE FROM customers WHERE id=?').run(id);
}

function getCustomerStats() {
  return {
    total:     db.prepare('SELECT COUNT(*) as c FROM customers').get().c,
    active:    db.prepare("SELECT COUNT(*) as c FROM customers WHERE status='active'").get().c,
    suspended: db.prepare("SELECT COUNT(*) as c FROM customers WHERE status='suspended'").get().c,
    inactive:  db.prepare("SELECT COUNT(*) as c FROM customers WHERE status='inactive'").get().c,
  };
}

// ─── PACKAGES ────────────────────────────────────────────────
function getAllPackages() {
  return db.prepare(`
    SELECT p.*, COUNT(c.id) as customer_count
    FROM packages p LEFT JOIN customers c ON c.package_id = p.id
    GROUP BY p.id ORDER BY p.price ASC
  `).all();
}

function getPackageById(id) {
  return db.prepare('SELECT * FROM packages WHERE id=?').get(id);
}

function createPackage(data) {
  const down = Math.round(parseFloat(data.speed_down || 0) * 1000);
  const up = Math.round(parseFloat(data.speed_up || 0) * 1000);
  const b_limit_down = Math.round(parseFloat(data.burst_limit_down || 0) * 1000);
  const b_limit_up = Math.round(parseFloat(data.burst_limit_up || 0) * 1000);
  const b_thresh_down = Math.round(parseFloat(data.burst_threshold_down || 0) * 1000);
  const b_thresh_up = Math.round(parseFloat(data.burst_threshold_up || 0) * 1000);
  const b_time_down = Math.max(0, parseInt(data.burst_time_down || 0, 10) || 0);
  const b_time_up = Math.max(0, parseInt(data.burst_time_up || 0, 10) || 0);
  const prio_down = Math.min(8, Math.max(1, parseInt(data.priority_down || 8, 10) || 8));
  const prio_up = Math.min(8, Math.max(1, parseInt(data.priority_up || 8, 10) || 8));
  const lim_at_down = Math.round(parseFloat(data.limit_at_down || 0) * 1000);
  const lim_at_up = Math.round(parseFloat(data.limit_at_up || 0) * 1000);

  const n_down = Math.round(parseFloat(data.night_speed_down || 0) * 1000);
  const n_up = Math.round(parseFloat(data.night_speed_up || 0) * 1000);
  const f_down = Math.round(parseFloat(data.fup_speed_down || 0) * 1000);
  const f_limit = parseFloat(data.fup_limit_gb || 0);

  const promoPrice = parsePromoPrice(data.promo_price);
  const promoCycles = Math.max(0, parseInt(data.promo_cycles, 10) || 0);
  const prorateFirst = data.prorate_first_invoice ? 1 : 0;
  const usePpn = data.use_ppn ? 1 : 0;
  const ppnPercentage = parseFloat(data.ppn_percentage || 11.0);
  const useUso = data.use_uso ? 1 : 0;
  const usoPercentage = parseFloat(data.uso_percentage || 1.75);

  return db.prepare(`
    INSERT INTO packages (
      name, price, promo_price, promo_cycles, prorate_first_invoice,
      speed_down, speed_up, 
      burst_limit_down, burst_limit_up, burst_threshold_down, burst_threshold_up,
      burst_time_down, burst_time_up, priority_down, priority_up, limit_at_down, limit_at_up,
      use_night_speed, night_profile_name, night_speed_down, night_speed_up, 
      use_fup, fup_profile_name, fup_limit_gb, fup_speed_down, 
      description,
      use_ppn, ppn_percentage, use_uso, uso_percentage, is_hidden
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.name, parseInt(data.price) || 0, promoPrice, promoCycles, prorateFirst,
    down, up,
    b_limit_down, b_limit_up, b_thresh_down, b_thresh_up,
    b_time_down, b_time_up, prio_down, prio_up, lim_at_down, lim_at_up,
    data.use_night_speed ? 1 : 0, data.night_profile_name || null, n_down, n_up,
    data.use_fup ? 1 : 0, data.fup_profile_name || null, f_limit, f_down,
    data.description || '',
    usePpn, ppnPercentage, useUso, usoPercentage,
    (data.is_hidden == '1' || data.is_hidden === 1) ? 1 : 0
  );
}

function parsePromoPrice(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function updatePackage(id, data) {
  const down = Math.round(parseFloat(data.speed_down || 0) * 1000);
  const up = Math.round(parseFloat(data.speed_up || 0) * 1000);
  const b_limit_down = Math.round(parseFloat(data.burst_limit_down || 0) * 1000);
  const b_limit_up = Math.round(parseFloat(data.burst_limit_up || 0) * 1000);
  const b_thresh_down = Math.round(parseFloat(data.burst_threshold_down || 0) * 1000);
  const b_thresh_up = Math.round(parseFloat(data.burst_threshold_up || 0) * 1000);
  const b_time_down = Math.max(0, parseInt(data.burst_time_down || 0, 10) || 0);
  const b_time_up = Math.max(0, parseInt(data.burst_time_up || 0, 10) || 0);
  const prio_down = Math.min(8, Math.max(1, parseInt(data.priority_down || 8, 10) || 8));
  const prio_up = Math.min(8, Math.max(1, parseInt(data.priority_up || 8, 10) || 8));
  const lim_at_down = Math.round(parseFloat(data.limit_at_down || 0) * 1000);
  const lim_at_up = Math.round(parseFloat(data.limit_at_up || 0) * 1000);

  const n_down = Math.round(parseFloat(data.night_speed_down || 0) * 1000);
  const n_up = Math.round(parseFloat(data.night_speed_up || 0) * 1000);
  const f_down = Math.round(parseFloat(data.fup_speed_down || 0) * 1000);
  const f_limit = parseFloat(data.fup_limit_gb || 0);
  const promoPrice = parsePromoPrice(data.promo_price);
  const promoCycles = Math.max(0, parseInt(data.promo_cycles, 10) || 0);
  const prorateFirst = data.prorate_first_invoice ? 1 : 0;
  const usePpn = data.use_ppn ? 1 : 0;
  const ppnPercentage = parseFloat(data.ppn_percentage || 11.0);
  const useUso = data.use_uso ? 1 : 0;
  const usoPercentage = parseFloat(data.uso_percentage || 1.75);

  return db.prepare(`
    UPDATE packages 
    SET name=?, price=?, promo_price=?, promo_cycles=?, prorate_first_invoice=?,
        speed_down=?, speed_up=?, 
        burst_limit_down=?, burst_limit_up=?, burst_threshold_down=?, burst_threshold_up=?,
        burst_time_down=?, burst_time_up=?, priority_down=?, priority_up=?, limit_at_down=?, limit_at_up=?,
        use_night_speed=?, night_profile_name=?, night_speed_down=?, night_speed_up=?, 
        use_fup=?, fup_profile_name=?, fup_limit_gb=?, fup_speed_down=?, 
        description=?, is_active=?,
        use_ppn=?, ppn_percentage=?, use_uso=?, uso_percentage=?, is_hidden=?
    WHERE id=?
  `).run(
    data.name, parseInt(data.price) || 0, promoPrice, promoCycles, prorateFirst,
    down, up,
    b_limit_down, b_limit_up, b_thresh_down, b_thresh_up,
    b_time_down, b_time_up, prio_down, prio_up, lim_at_down, lim_at_up,
    data.use_night_speed ? 1 : 0, data.night_profile_name || null, n_down, n_up,
    data.use_fup ? 1 : 0, data.fup_profile_name || null, f_limit, f_down,
    data.description || '', data.is_active == '1' ? 1 : 0,
    usePpn, ppnPercentage, useUso, usoPercentage,
    (data.is_hidden == '1' || data.is_hidden === 1) ? 1 : 0,
    id
  );
}

function deletePackage(id) {
  return db.prepare('DELETE FROM packages WHERE id=?').run(id);
}

function findCustomerByAny(val) {
  if (!val) return null;
  const cleanVal = val.toString().trim();
  
  // 1. Try Phone (Priority for Login)
  const phoneDigits = cleanVal.replace(/\D/g, '');
  if (phoneDigits.length >= 8) {
    // Cari yang 8-10 digit terakhirnya sama (lebih akurat untuk 08 vs 62)
    const suffix = phoneDigits.slice(-9);
    const p1 = db.prepare('SELECT id FROM customers WHERE phone LIKE ?').get(`%${suffix}`);
    if (p1) return getCustomerById(p1.id);
  }

  // 2. Try GenieACS Tag (Exact Match)
  const byTag = db.prepare('SELECT id FROM customers WHERE genieacs_tag = ?').get(cleanVal);
  if (byTag) return getCustomerById(byTag.id);

  // 3. Try PPPoE Username (Exact Match)
  const byPppoe = db.prepare('SELECT id FROM customers WHERE pppoe_username = ?').get(cleanVal);
  if (byPppoe) return getCustomerById(byPppoe.id);

  // 4. Try MAC Address (Exact Match or Partial Match for ONU MAC format)
  // Handle ONU MAC format like: F4B5AA-ZXHN%20F477-01FFFFFFFF011FFF23F4B5AA7D806FBA
  const byMac = db.prepare('SELECT id FROM customers WHERE mac_address = ?').get(cleanVal);
  if (byMac) return getCustomerById(byMac.id);
  
  // Try partial MAC match (first part before dash for ONU format)
  if (cleanVal.includes('-')) {
    const macPrefix = cleanVal.split('-')[0];
    if (macPrefix.length >= 6) {
      const byMacPrefix = db.prepare('SELECT id FROM customers WHERE mac_address LIKE ?').get(`${macPrefix}%`);
      if (byMacPrefix) return getCustomerById(byMacPrefix.id);
    }
  }

  // 5. Try ID if numeric
  if (/^\d+$/.test(cleanVal) && cleanVal.length < 8) {
    const c = getCustomerById(parseInt(cleanVal));
    if (c) return c;
  }
  
  return null;
}

async function syncCustomerIsolation(idOrCustomer) {
  const customer = (typeof idOrCustomer === 'object' && idOrCustomer !== null)
    ? idOrCustomer
    : getCustomerById(idOrCustomer);

  if (!customer) return false;

  const mikrotikSvc = require('./mikrotikService');
  const { getSetting } = require('../config/settingsManager');

  if (customer.connection_type === 'static' && customer.static_ip) {
    const pkg = getPackageById(customer.package_id);
    let limit = '5M/5M';
    if (pkg) {
      const up = Number(pkg.speed_up || 0) || 0;
      const down = Number(pkg.speed_down || 0) || 0;
      const upMbps = up > 0 ? Math.max(1, Math.round(up / 1000)) : 5;
      const downMbps = down > 0 ? Math.max(1, Math.round(down / 1000)) : 5;
      limit = `${upMbps}M/${downMbps}M`;
    }
    await mikrotikSvc.manageStaticIp({
      ip: customer.static_ip,
      name: customer.name,
      limit: limit,
      isolate: true
    }, customer.router_id);
  } else if (customer.pppoe_username) {
    // 1. Send RADIUS CoA Disconnect to NAS
    try {
      const radiusCoaService = require('./radiusCoaService');
      await radiusCoaService.disconnectUserByUsername(customer.pppoe_username);
    } catch (cErr) {
      logger.warn(`[syncCustomerIsolation] RADIUS CoA Disconnect user ${customer.pppoe_username}: ${cErr.message}`);
    }

    // 2. MikroTik API Profile update & Hook ensure
    const isolirProfile = customer.isolir_profile || 'isolir';
    if (customer.router_id) {
      try {
        await mikrotikSvc.ensurePppProfileIsolirAddressListHook(isolirProfile, customer.router_id);
      } catch (e) {
        logger.warn(`[syncCustomerIsolation] Hook profil isolir "${isolirProfile}" di router ${customer.router_id}: ${e.message}`);
      }
    }
    try {
      await mikrotikSvc.setPppoeProfile(customer.pppoe_username, isolirProfile, customer.router_id, true);
    } catch (pErr) {
      logger.warn(`[syncCustomerIsolation] setPppoeProfile error: ${pErr.message}`);
    }

    // 3. Fallback direct API kick active session to guarantee immediate disconnect on MikroTik
    try {
      await mikrotikSvc.kickPppoeUser(customer.pppoe_username, customer.router_id);
    } catch (kErr) {
      logger.warn(`[syncCustomerIsolation] kickPppoeUser fallback error: ${kErr.message}`);
    }
  } else if (customer.connection_type === 'hotspot' && customer.hotspot_username) {
    try {
      await mikrotikSvc.setHotspotUserDisabled(customer.hotspot_username, true, customer.router_id);
      await mikrotikSvc.kickHotspotUser(customer.hotspot_username, customer.router_id);
    } catch (hErr) {
      logger.warn(`[syncCustomerIsolation] Hotspot isolation error: ${hErr.message}`);
    }
  }

  return true;
}

async function syncCustomerActivation(idOrCustomer) {
  const customer = (typeof idOrCustomer === 'object' && idOrCustomer !== null)
    ? idOrCustomer
    : getCustomerById(idOrCustomer);

  if (!customer) return false;

  const mikrotikSvc = require('./mikrotikService');
  const { getSetting } = require('../config/settingsManager');

  if (customer.connection_type === 'static' && customer.static_ip) {
    const pkg = getPackageById(customer.package_id);
    let limit = '5M/5M';
    if (pkg) {
      const up = Number(pkg.speed_up || 0) || 0;
      const down = Number(pkg.speed_down || 0) || 0;
      const upMbps = up > 0 ? Math.max(1, Math.round(up / 1000)) : 5;
      const downMbps = down > 0 ? Math.max(1, Math.round(down / 1000)) : 5;
      limit = `${upMbps}M/${downMbps}M`;
    }
    await mikrotikSvc.manageStaticIp({
      ip: customer.static_ip,
      name: customer.name,
      limit: limit,
      isolate: false
    }, customer.router_id);
  } else if (customer.pppoe_username) {
    try {
      const radiusCoaService = require('./radiusCoaService');
      await radiusCoaService.disconnectUserByUsername(customer.pppoe_username);
    } catch (cErr) {
      logger.warn(`[syncCustomerActivation] RADIUS CoA Disconnect user ${customer.pppoe_username}: ${cErr.message}`);
    }

    const pkg = getPackageById(customer.package_id);
    const targetProfile = pkg ? pkg.name : 'default';
    try {
      await mikrotikSvc.setPppoeProfile(customer.pppoe_username, targetProfile, customer.router_id, true);
    } catch (pErr) {
      logger.warn(`[syncCustomerActivation] setPppoeProfile error: ${pErr.message}`);
    }

    try {
      await mikrotikSvc.kickPppoeUser(customer.pppoe_username, customer.router_id);
    } catch (kErr) {
      logger.warn(`[syncCustomerActivation] kickPppoeUser error: ${kErr.message}`);
    }
  } else if (customer.connection_type === 'hotspot' && customer.hotspot_username) {
    const pkg = getPackageById(customer.package_id);
    const targetProfile = String(customer.hotspot_profile || '').trim() || (pkg ? pkg.name : '');
    try {
      await mikrotikSvc.upsertHotspotUser({
        username: String(customer.hotspot_username || '').trim(),
        password: String(customer.hotspot_password || '').trim(),
        profile: targetProfile,
        macAddress: String(customer.mac_address || '').trim(),
        disabled: false
      }, customer.router_id);
      await mikrotikSvc.kickHotspotUser(customer.hotspot_username, customer.router_id);
    } catch (hErr) {
      logger.warn(`[syncCustomerActivation] Hotspot activation error: ${hErr.message}`);
    }
  }

  return true;
}

async function suspendCustomer(id) {
  const customer = getCustomerById(id);
  if (!customer) throw new Error('Pelanggan tidak ditemukan');
  
  updateCustomer(id, { ...customer, status: 'suspended' });
  await syncCustomerIsolation(customer);

  // WhatsApp Notification
  if (customer.phone) {
    try {
      const { getSetting } = require('../config/settingsManager');
      if (getSetting('whatsapp_enabled', false)) {
        const { sendWA, whatsappStatus } = await import('./whatsappBot.mjs');
        if (whatsappStatus && whatsappStatus.connection === 'open') {
          const defaultIsolir = `Yth. Pelanggan {{nama}},\n\nLayanan internet Anda (Paket {{paket}}) saat ini ditangguhkan (Terisolir) karena belum melunasi tagihan sebesar *Rp {{tagihan}}*.\n\nSilakan lakukan pembayaran segera melalui portal pelanggan: {{link}}\n\nTerima kasih.`;
          const template = db.getAppSetting('whatsapp_isolir_message', defaultIsolir);

          // Get unpaid invoices & calculate total amount
          const billingSvc = require('./billingService');
          const unpaidInvoices = billingSvc.getUnpaidInvoicesByCustomerId(customer.id);
          const totalTagihan = unpaidInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);

          // Generate Login Link
          const explicitBaseUrl = String(getSetting('public_base_url', '') || '').trim();
          let baseUrl = explicitBaseUrl.replace(/\/+$/, '');
          if (!baseUrl) {
            const hostRaw = String(getSetting('server_host', 'localhost') || 'localhost').trim();
            const port = Number(getSetting('server_port', 3001) || 3001);
            const proto = port === 443 ? 'https' : 'http';
            const host = /^https?:\/\//i.test(hostRaw) ? hostRaw.replace(/\/+$/, '') : `${proto}://${hostRaw}`;
            baseUrl = (port === 80 || port === 443) ? host : `${host}:${port}`;
          }
          const loginLink = `${baseUrl}/customer/login`;
          const customerFormattedId = 'MDE-' + String(customer.id).padStart(4, '0');

          const formattedMsg = template
            .replace(/{{id_pelanggan}}/gi, customerFormattedId)
            .replace(/{{nama}}/gi, customer.name || 'Pelanggan')
            .replace(/{{paket}}/gi, customer.package_name || '-')
            .replace(/{{tagihan}}/gi, totalTagihan.toLocaleString('id-ID'))
            .replace(/{{link}}/gi, loginLink);

          await sendWA(customer.phone, formattedMsg);
        }
      }
    } catch (waErr) {
      logger.error(`[suspendCustomer] Gagal kirim notif WhatsApp isolir: ${waErr.message}`);
    }
  }

  return true;
}

async function activateCustomer(id) {
  const customer = getCustomerById(id);
  if (!customer) throw new Error('Pelanggan tidak ditemukan');
  
  updateCustomer(id, { ...customer, status: 'active' });
  await syncCustomerActivation(customer);
  return true;
}

module.exports = {
  getAllCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer, getCustomerStats,
  getAllPackages, getPackageById, createPackage, updatePackage, deletePackage,
  suspendCustomer, activateCustomer, findCustomerByAny, updateCustomerCablePath,
  resetPromoCyclesUsed, syncCustomerIsolation, syncCustomerActivation
};
