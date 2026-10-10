const db = require('../config/database');
const opticalPowerSvc = require('./opticalPowerService');
const { logger } = require('../config/logger');

/**
 * Service Domain: Mass Outage & Fiber Cut Auto-Detection
 * 
 * Prinsip Kerja:
 * 1. Mengagregasi status konektivitas perangkat pelanggan (Dual-ACS, RX Power, dan status pelanggan).
 * 2. Menganalisis korelasi topologi hierarkis GPON:
 *    - Level 0: OLT / NOC
 *    - Level 1: ODC (Cabinet Utama)
 *    - Level 2: ODP (Box Pembagi)
 *    - Level 3: Pelanggan (Drop Cable & ONT)
 * 3. Mengidentifikasi Root Cause:
 *    - Distribution Cable Cut: Mayoritas pelanggan pada satu ODP offline/LOS serentak.
 *    - Feeder Cable Cut: Mayoritas ODP di bawah satu ODC offline serentak (konsolidasi insiden).
 * 4. Menyediakan aksi cepat: Auto-generate tiket gangguan & notifikasi WhatsApp ke teknisi.
 */

// Ambang batas deteksi insiden (thresholds)
const THRESHOLDS = {
  MIN_CUSTOMERS_FOR_ODP_DETECTION: 2,   // Minimal pelanggan terpasang di ODP untuk deteksi
  MIN_OFFLINE_RATIO_DISTRIBUTION: 0.50, // Minimal 50% pelanggan offline di 1 ODP
  MIN_OFFLINE_COUNT_DISTRIBUTION: 2,    // Atau minimal 2 pelanggan offline di 1 ODP
  MIN_ODPS_FOR_ODC_DETECTION: 2,        // Minimal ODP anak di bawah ODC untuk deteksi Feeder
  MIN_OFFLINE_ODP_RATIO_FEEDER: 0.50,   // Minimal 50% ODP anak padam untuk vonis Feeder Cut
  OFFLINE_INFORM_WINDOW_MS: 20 * 60 * 1000 // 20 menit tanpa inform / LOS
};

/**
 * Menghitung koordinat centroid (tengah) dari array koordinat
 * @param {Array} pathCoords - Array of [lat, lng]
 * @returns {Array|null} [centerLat, centerLng]
 */
function calculateCentroid(pathCoords) {
  if (!Array.isArray(pathCoords) || pathCoords.length === 0) return null;
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;

  for (const pt of pathCoords) {
    if (Array.isArray(pt) && pt.length >= 2) {
      const lat = parseFloat(pt[0]);
      const lng = parseFloat(pt[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        sumLat += lat;
        sumLng += lng;
        count++;
      }
    }
  }

  if (count === 0) return null;
  return [Math.round((sumLat / count) * 1e6) / 1e6, Math.round((sumLng / count) * 1e6) / 1e6];
}

/**
 * Mendeteksi anomali putus kabel massal (Mass Outage / Fiber Cut)
 * @param {Object} options - Opsi analisis kustom (misal untuk testing)
 * @returns {Object} Hasil deteksi insiden putus kabel
 */
function detectFiberCuts(options = {}) {
  try {
    // 1. Ambil data topologi lengkap & status Dual-ACS dari opticalPowerService
    const topoData = opticalPowerSvc.getOpticalNetworkTopologyData();
    const customersMap = topoData.customers || {};

    // 2. Ambil data ODP dan ODC dari database
    const odps = db.prepare(`
      SELECT o.*, olt.name as olt_name
      FROM odps o
      LEFT JOIN olts olt ON o.olt_id = olt.id
    `).all();

    // Indexing ODP dan ODC
    const odpMap = new Map();
    const odcMap = new Map();
    const childrenOdpByParent = new Map(); // ODC ID -> Array of child ODPs

    for (const odp of odps) {
      odpMap.set(odp.id, odp);
      if (odp.type === 'ODC') {
        odcMap.set(odp.id, odp);
      }
      if (odp.parent_odp_id) {
        if (!childrenOdpByParent.has(odp.parent_odp_id)) {
          childrenOdpByParent.set(odp.parent_odp_id, []);
        }
        childrenOdpByParent.get(odp.parent_odp_id).push(odp);
      }
    }

    // 3. Kelompokkan pelanggan berdasarkan ODP ID dan evaluasi status konektivitas
    const customersByOdp = new Map(); // ODP ID -> Array of customer analysis objects

    for (const [custIdStr, custOpt] of Object.entries(customersMap)) {
      const custId = parseInt(custIdStr, 10);
      const odpId = custOpt.odpId;
      if (!odpId) continue;

      if (!customersByOdp.has(odpId)) {
        customersByOdp.set(odpId, []);
      }

      // Tentukan apakah pelanggan dianggap offline / LOS
      let isOffline = false;
      let offlineReason = '';

      if (custOpt.acs && custOpt.acs.isOnline === false) {
        isOffline = true;
        offlineReason = 'ONT Offline / Hilang Sinyal (No Inform)';
      } else if (custOpt.evaluation && custOpt.evaluation.statusKey === 'critical' && custOpt.evaluation.rxActualDbm !== null && custOpt.evaluation.rxActualDbm < -30.0) {
        isOffline = true;
        offlineReason = `Loss of Signal (Rx ${custOpt.evaluation.rxActualDbm} dBm)`;
      } else if (!custOpt.acs || custOpt.acs.rxPower === null) {
        // Fallback jika unmonitored di ACS tapi terdaftar
        isOffline = true;
        offlineReason = 'Perangkat Belum Tersambung ke ACS';
      }

      // Override jika opsi testing memaksakan status
      if (options.offlineCustomerIds && options.offlineCustomerIds.includes(custId)) {
        isOffline = true;
        offlineReason = 'Simulated Offline';
      } else if (options.onlineCustomerIds && options.onlineCustomerIds.includes(custId)) {
        isOffline = false;
        offlineReason = '';
      }

      customersByOdp.get(odpId).push({
        id: custId,
        name: custOpt.customerName,
        odpId,
        isOffline,
        offlineReason,
        rxActual: custOpt.acs?.rxPower || null,
        rxEstimated: custOpt.budget?.estimatedRxPowerDbm || null,
        delta: custOpt.evaluation?.deltaDbm || null
      });
    }

    // 4. Analisis Level ODP: Deteksi Potensi Putus Kabel Distribusi (Distribution Cut)
    const distributionCutIncidents = [];
    const affectedOdpIds = new Set();

    for (const odp of odps) {
      if (odp.type === 'ODC') continue; // ODC dievaluasi di level feeder

      const custs = customersByOdp.get(odp.id) || [];
      const totalCusts = custs.length;
      if (totalCusts === 0) continue;

      const offlineCusts = custs.filter(c => c.isOffline);
      const offlineCount = offlineCusts.length;
      const offlineRatio = offlineCount / totalCusts;

      // Evaluasi Kriteria Putus Kabel Distribusi
      const isThresholdMet = (
        totalCusts >= THRESHOLDS.MIN_CUSTOMERS_FOR_ODP_DETECTION &&
        (offlineRatio >= THRESHOLDS.MIN_OFFLINE_RATIO_DISTRIBUTION || offlineCount >= THRESHOLDS.MIN_OFFLINE_COUNT_DISTRIBUTION)
      );

      if (isThresholdMet) {
        affectedOdpIds.add(odp.id);

        let parentOdc = odp.parent_odp_id ? odpMap.get(odp.parent_odp_id) : null;
        let parentName = parentOdc ? parentOdc.name : 'NOC / OLT Pusat';
        let parentType = parentOdc ? (parentOdc.type || 'ODC') : 'NOC';

        // Parsing path kabel
        let cableCoords = [];
        if (odp.cable_path) {
          try {
            const p = JSON.parse(odp.cable_path);
            if (Array.isArray(p)) cableCoords = p;
          } catch (_) {}
        }
        if (cableCoords.length < 2 && odp.lat && odp.lng && parentOdc && parentOdc.lat && parentOdc.lng) {
          cableCoords = [
            [parseFloat(parentOdc.lat), parseFloat(parentOdc.lng)],
            [parseFloat(odp.lat), parseFloat(odp.lng)]
          ];
        }

        const centroid = calculateCentroid(cableCoords) || (odp.lat && odp.lng ? [parseFloat(odp.lat), parseFloat(odp.lng)] : null);

        const severity = offlineRatio >= 0.8 ? 'CRITICAL' : 'HIGH';

        distributionCutIncidents.push({
          incidentId: `DIST-CUT-${odp.id}`,
          type: 'DISTRIBUTION_CUT',
          level: 'Jalur Distribusi',
          title: `Indikasi Putus Kabel Distribusi (${parentName} ↔ ${odp.name})`,
          targetNodeId: odp.id,
          targetNodeName: odp.name,
          targetNodeType: 'ODP',
          parentNodeId: parentOdc ? parentOdc.id : null,
          parentNodeName: parentName,
          parentNodeType: parentType,
          oltName: odp.olt_name || '-',
          ponPort: odp.pon_port || '-',
          totalCustomers: totalCusts,
          offlineCount,
          offlineRatio: Math.round(offlineRatio * 100),
          severity,
          cableCoords,
          centroid,
          affectedCustomers: offlineCusts.map(c => ({
            id: c.id,
            name: c.name,
            reason: c.offlineReason
          })),
          detectedAt: new Date().toISOString()
        });
      }
    }

    // 5. Analisis Level ODC: Deteksi Potensi Putus Kabel Feeder (Feeder Cut)
    const feederCutIncidents = [];
    const consolidatedOdpIds = new Set(); // ODP yang sudah dicover oleh Feeder Cut

    for (const [odcId, childOdps] of childrenOdpByParent.entries()) {
      const odc = odpMap.get(odcId);
      if (!odc) continue;

      const totalChildOdps = childOdps.length;
      if (totalChildOdps < THRESHOLDS.MIN_ODPS_FOR_ODC_DETECTION) continue;

      // Hitung berapa ODP anak yang mengalami gangguan / mass offline
      const cutChildOdps = childOdps.filter(o => affectedOdpIds.has(o.id));
      const cutOdpRatio = cutChildOdps.length / totalChildOdps;

      if (cutOdpRatio >= THRESHOLDS.MIN_OFFLINE_ODP_RATIO_FEEDER) {
        // Feeder Cut Terdeteksi!
        cutChildOdps.forEach(o => consolidatedOdpIds.add(o.id));

        let cableCoords = [];
        if (odc.cable_path) {
          try {
            const p = JSON.parse(odc.cable_path);
            if (Array.isArray(p)) cableCoords = p;
          } catch (_) {}
        }
        if (cableCoords.length < 2 && odc.lat && odc.lng) {
          cableCoords = [
            [-6.200000, 106.816666], // Fallback NOC office coords
            [parseFloat(odc.lat), parseFloat(odc.lng)]
          ];
        }

        const centroid = calculateCentroid(cableCoords) || (odc.lat && odc.lng ? [parseFloat(odc.lat), parseFloat(odc.lng)] : null);

        // Agregasi seluruh pelanggan di bawah ODC ini yang offline
        let allAffectedCusts = [];
        for (const childOdp of childOdps) {
          const custs = customersByOdp.get(childOdp.id) || [];
          allAffectedCusts.push(...custs.filter(c => c.isOffline));
        }

        feederCutIncidents.push({
          incidentId: `FEEDER-CUT-${odc.id}`,
          type: 'FEEDER_CUT',
          level: 'Jalur Feeder Utama',
          title: `BAHAYA: Indikasi Putus Kabel Feeder Utama (NOC ↔ ${odc.name})`,
          targetNodeId: odc.id,
          targetNodeName: odc.name,
          targetNodeType: 'ODC',
          parentNodeId: null,
          parentNodeName: 'Kantor Pusat / NOC',
          parentNodeType: 'NOC',
          oltName: odc.olt_name || '-',
          ponPort: odc.pon_port || '-',
          totalChildOdps,
          offlineChildOdpCount: cutChildOdps.length,
          offlineChildOdpRatio: Math.round(cutOdpRatio * 100),
          totalCustomers: allAffectedCusts.length,
          offlineCount: allAffectedCusts.length,
          severity: 'DISASTER',
          cableCoords,
          centroid,
          affectedOdpNames: cutChildOdps.map(o => o.name),
          affectedCustomers: allAffectedCusts.map(c => ({
            id: c.id,
            name: c.name,
            reason: c.offlineReason
          })),
          detectedAt: new Date().toISOString()
        });
      }
    }

    // 6. Konsolidasi Insiden (Root-Cause Isolation)
    // Saring distribution cut yang sudah termasuk dalam cakupan Feeder Cut agar teknisi fokus ke titik asal
    const finalDistributionCuts = distributionCutIncidents.filter(
      d => !consolidatedOdpIds.has(d.targetNodeId)
    );

    const allIncidents = [...feederCutIncidents, ...finalDistributionCuts];
    const totalAffectedCustomers = allIncidents.reduce((sum, inc) => sum + (inc.offlineCount || 0), 0);

    return {
      ok: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalIncidents: allIncidents.length,
        feederCutsCount: feederCutIncidents.length,
        distributionCutsCount: finalDistributionCuts.length,
        totalAffectedCustomers,
        hasMassOutage: allIncidents.length > 0
      },
      incidents: allIncidents
    };
  } catch (err) {
    logger.error(`[FiberCutDetection] Error running detection: ${err.message}`);
    return {
      ok: false,
      error: err.message,
      summary: { totalIncidents: 0, hasMassOutage: false },
      incidents: []
    };
  }
}

/**
 * Otomatis membuat tiket gangguan massal di tabel tickets
 * @param {string} incidentId - ID Insiden (misal: 'DIST-CUT-5' atau 'FEEDER-CUT-2')
 * @param {Object} actor - Data admin/teknisi yang memicu pembuatan tiket
 * @returns {Object} Tiket yang dibuat
 */
function createMassOutageTicket(incidentId, actor = {}) {
  const detectionResult = detectFiberCuts();
  const incident = detectionResult.incidents.find(i => i.incidentId === incidentId);

  if (!incident) {
    throw new Error(`Insiden dengan ID "${incidentId}" tidak ditemukan atau sudah pulih.`);
  }

  // Cek apakah tiket serupa yang masih berstatus open/in_progress sudah ada
  const existingTicket = db.prepare(`
    SELECT id, subject, status 
    FROM tickets 
    WHERE subject LIKE ? AND status IN ('open', 'in_progress')
    LIMIT 1
  `).get(`%${incident.targetNodeName}%`);

  if (existingTicket) {
    return {
      created: false,
      alreadyExists: true,
      ticketId: existingTicket.id,
      message: `Tiket gangguan untuk ${incident.targetNodeName} sudah aktif (#${existingTicket.id}).`
    };
  }

  const subject = `[MASS OUTAGE] ${incident.title}`;
  const actorName = actor.name || actor.username || 'System Auto-Detector';
  const lat = incident.centroid ? String(incident.centroid[0]) : null;
  const lng = incident.centroid ? String(incident.centroid[1]) : null;

  const affectedNamesStr = incident.affectedCustomers.slice(0, 8).map(c => `- ${c.name}`).join('\n') +
    (incident.affectedCustomers.length > 8 ? `\n... dan ${incident.affectedCustomers.length - 8} pelanggan lainnya.` : '');

  const message = `Peringatan Gangguan Massal / Fiber Cut:\n` +
    `• Tipe Jalur: ${incident.level}\n` +
    `• Node Target: ${incident.targetNodeName} (${incident.targetNodeType})\n` +
    `• Node Induk: ${incident.parentNodeName}\n` +
    `• OLT / PON: ${incident.oltName} (Port: ${incident.ponPort})\n` +
    `• Tingkat Keparahan: ${incident.severity}\n` +
    `• Pelanggan Terdampak: ${incident.offlineCount} pelanggan (${incident.offlineRatio || incident.offlineChildOdpRatio}%)\n\n` +
    `Daftar Pelanggan Terputus:\n${affectedNamesStr}\n\n` +
    `Instruksi Teknisi:\n` +
    `Segera lakukan pengecekan fisik jalur kabel antara ${incident.parentNodeName} dan ${incident.targetNodeName}. Uji redaman dengan OTDR/OPM. Dibuat oleh ${actorName}.`;

  const info = db.prepare(`
    INSERT INTO tickets (category, target_name, lat, lng, subject, message, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'open', (NOW_LOCAL()), (NOW_LOCAL()))
  `).run(
    'Fiber Cut / Mass Outage',
    incident.targetNodeName,
    lat,
    lng,
    subject,
    message
  );

  const ticketResult = {
    created: true,
    alreadyExists: false,
    ticketId: info.lastInsertRowid,
    subject,
    targetNodeName: incident.targetNodeName,
    message: `Tiket gangguan massal #${info.lastInsertRowid} berhasil dibuat!`
  };

  // Notifikasi asinkron ke Admin & Teknisi
  try {
    const NotificationService = require('./notificationService');
    NotificationService.notifyNewTicket({
      ticketId: info.lastInsertRowid,
      customerName: `Gangguan Massal (${incident.targetNodeName})`,
      customerPhone: '-',
      customerAddress: `Jalur ${incident.parentNodeName} ↔ ${incident.targetNodeName}`,
      subject,
      message,
      category: 'Fiber Cut / Mass Outage'
    }).catch(err => logger.error(`[FiberCutDetection] Notification error: ${err.message}`));
  } catch (notifErr) {
    logger.warn(`[FiberCutDetection] Failed to trigger notification: ${notifErr.message}`);
  }

  return ticketResult;
}

/**
 * Mengirim broadcast peringatan darurat Mass Outage / Fiber Cut langsung ke WA Admin & Teknisi Lapangan
 * @param {string} incidentId - ID Insiden
 * @param {Object} actor - Pemicu broadcast (Admin / Teknisi)
 * @returns {Promise<Object>}
 */
async function broadcastMassOutageAlert(incidentId, actor = {}) {
  const detectionResult = detectFiberCuts();
  const incident = detectionResult.incidents.find(i => i.incidentId === incidentId);

  if (!incident) {
    throw new Error(`Insiden "${incidentId}" tidak ditemukan atau sudah terselesaikan.`);
  }

  const { getSettings } = require('../config/settingsManager');
  const techSvc = require('./techService');
  const settings = getSettings();
  const actorName = actor.name || actor.username || 'NOC / Admin';

  const mapsLink = incident.centroid 
    ? `https://maps.google.com/?q=${incident.centroid[0]},${incident.centroid[1]}` 
    : '-';

  const alertMsg = `🚨 *PERINGATAN DARURAT: PUTUS KABEL MASSAL (FIBER CUT)* 🚨\n\n` +
    `⚠️ *Tingkat Bahaya:* ${incident.severity}\n` +
    `📍 *Segmen Jalur:* ${incident.level} (${incident.parentNodeName} ↔ ${incident.targetNodeName})\n` +
    `🏢 *Target Node:* ${incident.targetNodeName} (${incident.targetNodeType})\n` +
    `⚡ *OLT / PON:* ${incident.oltName} (Port: ${incident.ponPort})\n` +
    `👥 *Pelanggan Terdampak:* ${incident.offlineCount} Pelanggan (${incident.offlineRatio || incident.offlineChildOdpRatio}% padam)\n` +
    `🗺️ *Lokasi Segmen:* ${mapsLink}\n\n` +
    `🛠️ *Tindakan Cepat Teknisi:*\n` +
    `1. Siapkan Fusion Splicer & OTDR / VFL.\n` +
    `2. Telusuri jalur fisik dari ${incident.parentNodeName} menuju ${incident.targetNodeName}.\n` +
    `3. Koordinasi dengan tim NOC setelah penyambungan core selesai.\n\n` +
    `_Peringatan dipicu oleh: ${actorName} pada ${new Date().toLocaleString('id-ID')}_`;

  let sentCount = 0;

  if (settings.whatsapp_enabled) {
    try {
      const { sendWA } = await import('./whatsappBot.mjs');
      const recipients = new Set();

      // Admin WA
      if (Array.isArray(settings.whatsapp_admin_numbers)) {
        for (const phone of settings.whatsapp_admin_numbers) {
          const digits = String(phone).replace(/\D/g, '');
          if (digits) recipients.add(digits);
        }
      }

      // Seluruh teknisi aktif
      try {
        const technicians = techSvc.getAllTechnicians().filter(t => t.is_active === 1);
        for (const tech of technicians) {
          const digits = String(tech.phone || '').replace(/\D/g, '');
          if (digits) recipients.add(digits);
        }
      } catch (_) {}

      for (const phone of recipients) {
        try {
          await sendWA(phone, alertMsg);
          sentCount++;
        } catch (e) {
          logger.error(`[FiberCutDetection] Broadcast WA error to ${phone}: ${e.message}`);
        }
      }
    } catch (e) {
      logger.error(`[FiberCutDetection] Broadcast init error: ${e.message}`);
    }
  }

  return {
    ok: true,
    incidentId,
    targetNodeName: incident.targetNodeName,
    recipientsSent: sentCount,
    message: `Peringatan darurat berhasil disiarkan ke ${sentCount} nomor WhatsApp teknisi & admin!`
  };
}

module.exports = {
  THRESHOLDS,
  calculateCentroid,
  detectFiberCuts,
  createMassOutageTicket,
  broadcastMassOutageAlert
};

