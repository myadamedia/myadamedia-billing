const db = require('../config/database');

/**
 * TECHNICIANS
 */
function getAllTechnicians() {
  return db.prepare('SELECT * FROM technicians ORDER BY created_at DESC').all();
}

function createTechnician(data) {
  const { hashPassword, isHash } = require('../utils/securityHelper');
  const hashed = isHash(data.password) ? data.password : hashPassword(data.password);
  const stmt = db.prepare('INSERT INTO technicians (username, password, name, phone, area) VALUES (?, ?, ?, ?, ?)');
  return stmt.run(data.username, hashed, data.name, data.phone || '', data.area || '');
}

function updateTechnician(id, data) {
  const { hashPassword, isHash } = require('../utils/securityHelper');
  const hashed = isHash(data.password) ? data.password : hashPassword(data.password);
  const stmt = db.prepare('UPDATE technicians SET username = ?, password = ?, name = ?, phone = ?, area = ?, is_active = ? WHERE id = ?');
  return stmt.run(data.username, hashed, data.name, data.phone || '', data.area || '', data.is_active ? 1 : 0, id);
}

function deleteTechnician(id) {
  return db.prepare('DELETE FROM technicians WHERE id = ?').run(id);
}

/**
 * CASHIERS
 */
function getAllCashiers() {
  return db.prepare('SELECT * FROM cashiers ORDER BY created_at DESC').all();
}

function createCashier(data) {
  const { hashPassword, isHash } = require('../utils/securityHelper');
  const hashed = isHash(data.password) ? data.password : hashPassword(data.password);
  const stmt = db.prepare('INSERT INTO cashiers (username, password, name, phone) VALUES (?, ?, ?, ?)');
  return stmt.run(data.username, hashed, data.name, data.phone || '');
}

function updateCashier(id, data) {
  const { hashPassword, isHash } = require('../utils/securityHelper');
  const hashed = isHash(data.password) ? data.password : hashPassword(data.password);
  const stmt = db.prepare('UPDATE cashiers SET username = ?, password = ?, name = ?, phone = ?, is_active = ? WHERE id = ?');
  return stmt.run(data.username, hashed, data.name, data.phone || '', data.is_active ? 1 : 0, id);
}

function deleteCashier(id) {
  return db.prepare('DELETE FROM cashiers WHERE id = ?').run(id);
}

function authenticateCashier(username, password) {
  const cashier = db.prepare('SELECT * FROM cashiers WHERE username = ? AND is_active = 1').get(username);
  if (!cashier) return null;
  
  const { verifyPassword, hashPassword, isHash } = require('../utils/securityHelper');
  if (verifyPassword(password, cashier.password)) {
    if (!isHash(cashier.password)) {
      const newHash = hashPassword(password);
      db.prepare('UPDATE cashiers SET password = ? WHERE id = ?').run(newHash, cashier.id);
      cashier.password = newHash;
    }
    return cashier;
  }
  return null;
}

function getAllCollectors() {
  return db.prepare('SELECT * FROM collectors ORDER BY created_at DESC').all();
}

function createCollector(data) {
  const { hashPassword, isHash } = require('../utils/securityHelper');
  const hashed = isHash(data.password) ? data.password : hashPassword(data.password);
  return db
    .prepare(
      'INSERT INTO collectors (username, password, name, phone, is_active, auto_approve) VALUES (?, ?, ?, ?, 1, ?)'
    )
    .run(
      String(data.username || '').trim(),
      hashed,
      String(data.name || '').trim(),
      String(data.phone || '').trim(),
      data.auto_approve ? 1 : 0
    );
}

function updateCollector(id, data) {
  const { hashPassword, isHash } = require('../utils/securityHelper');
  const hashed = isHash(data.password) ? data.password : hashPassword(data.password);
  const stmt = db.prepare('UPDATE collectors SET username = ?, password = ?, name = ?, phone = ?, is_active = ?, auto_approve = ? WHERE id = ?');
  return stmt.run(data.username, hashed, data.name, data.phone || '', data.is_active ? 1 : 0, data.auto_approve ? 1 : 0, id);
}

function deleteCollector(id) {
  return db.prepare('DELETE FROM collectors WHERE id = ?').run(id);
}

function authenticateCollector(username, password) {
  const collector = db.prepare('SELECT * FROM collectors WHERE username = ? AND is_active = 1').get(username);
  if (!collector) return null;
  
  const { verifyPassword, hashPassword, isHash } = require('../utils/securityHelper');
  if (verifyPassword(password, collector.password)) {
    if (!isHash(collector.password)) {
      const newHash = hashPassword(password);
      db.prepare('UPDATE collectors SET password = ? WHERE id = ?').run(newHash, collector.id);
      collector.password = newHash;
    }
    return collector;
  }
  return null;
}

/**
 * ADMINS (Multi-Level)
 */
function getAllAdmins() {
  return db.prepare('SELECT * FROM admins ORDER BY created_at DESC').all();
}

function createAdmin(data) {
  const { hashPassword, isHash } = require('../utils/securityHelper');
  const hashed = isHash(data.password) ? data.password : hashPassword(data.password);
  const stmt = db.prepare('INSERT INTO admins (username, password, name, phone, role, is_active) VALUES (?, ?, ?, ?, ?, ?)');
  return stmt.run(
    String(data.username || '').trim(),
    hashed,
    String(data.name || '').trim(),
    String(data.phone || '').trim(),
    String(data.role || 'noc').trim(),
    data.hasOwnProperty('is_active') ? (data.is_active ? 1 : 0) : 1
  );
}

function updateAdmin(id, data) {
  const { hashPassword, isHash } = require('../utils/securityHelper');
  const hashed = isHash(data.password) ? data.password : hashPassword(data.password);
  const stmt = db.prepare('UPDATE admins SET username = ?, password = ?, name = ?, phone = ?, role = ?, is_active = ? WHERE id = ?');
  return stmt.run(
    String(data.username || '').trim(),
    hashed,
    String(data.name || '').trim(),
    String(data.phone || '').trim(),
    String(data.role || 'noc').trim(),
    data.is_active ? 1 : 0,
    id
  );
}

function deleteAdmin(id) {
  return db.prepare('DELETE FROM admins WHERE id = ?').run(id);
}

function authenticateAdmin(username, password) {
  const admin = db.prepare('SELECT * FROM admins WHERE username = ? AND is_active = 1').get(username);
  if (!admin) return null;
  
  const { verifyPassword, hashPassword, isHash } = require('../utils/securityHelper');
  if (verifyPassword(password, admin.password)) {
    if (!isHash(admin.password)) {
      const newHash = hashPassword(password);
      db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(newHash, admin.id);
      admin.password = newHash;
    }
    return admin;
  }
  return null;
}

module.exports = {
  getAllTechnicians,
  createTechnician,
  updateTechnician,
  deleteTechnician,
  getAllCashiers,
  createCashier,
  updateCashier,
  deleteCashier,
  authenticateCashier,
  getAllCollectors,
  createCollector,
  updateCollector,
  deleteCollector,
  authenticateCollector,
  getAllAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  authenticateAdmin
};
