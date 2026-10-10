/**
 * services/opticalPowerService.js
 * 
 * Modul Service untuk Kalkulator & Diagnosa Redaman Optik (Optical Link Budget)
 * Mengintegrasikan data topologi kabel (Feeder, Distribusi, Drop) dengan
 * pembacaan RX Optical Power aktual dari Dual-ACS (Built-in ACS & External GenieACS).
 * 
 * Arsitektur: Clean Architecture / SOLID
 */

const db = require('../config/database');
const { getSettings } = require('../config/settingsManager');

// ─── KONSTANTA & SPESIFIKASI STANDAR FTTH GPON ──────────────────────────────
const DEFAULT_ATTENUATION_PER_KM = 0.35; // dB/km single-mode fiber G.652.D @ 1490nm
const DEFAULT_TX_POWER_DBM = 3.50;      // dBm Transmit Power SFP OLT Class B+/C+
const DEFAULT_CONNECTOR_LOSS_DB = 1.50; // dB Total Loss sambungan adaptor & fusion splices
const DEFAULT_SAFETY_MARGIN_DB = 0.00;  // dB Margin keamanan opsional

// Insertion loss standar Optical Splitter (dB) berdasarkan rasio percabangan
const SPLITTER_INSERTION_LOSS = {
  '1:1': 0.0,
  'direct': 0.0,
  'none': 0.0,
  '1:2': 3.7,
  '1:4': 7.2,
  '1:8': 10.5,
  '1:16': 13.8,
  '1:32': 17.1,
  '1:64': 20.5
};

// Parameter TR-069 path untuk deteksi RX Optical Power
const RX_POWER_KEYS = [
  'VirtualParameters.RXPower',
  'VirtualParameters.redaman',
  'VirtualParameters.rx_power',
  'InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANOAM.RXPower',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_HW_OpticalSignal.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.RxPower',
  'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.RxPower',
  'InternetGatewayDevice.WANDevice.1.X_ZTE_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_ZTE_GponInterfaceConfig.RxPower',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ZTE_OpticalSignal.RXPower',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ZTE_OpticalSignal.RxPower',
  'InternetGatewayDevice.WANDevice.1.X_HW_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_HW_GponInterfaceConfig.RxPower',
  'InternetGatewayDevice.WANDevice.1.X_ZTE-COM_WANPONInterfaceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_FH_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_CMCC_EponInterfaceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_CMCC_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_CT-COM_EponInterfaceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_CT-COM_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_CU_WANEPONInterfaceConfig.OpticalTransceiver.RXPower',
  'Device.Optical.Interface.1.OpticalSignalLevel',
  'Device.XPON.Interface.1.Stats.RXPower'
];

/**
 * Normalisasi dan ekstraksi insertion loss dari rasio splitter
 * @param {string|number} ratio - Contoh: '1:4', '1:8', 8, 'direct'
 * @returns {number} Loss dalam dB
 */
function getSplitterLoss(ratio) {
  if (ratio === undefined || ratio === null || ratio === '') return 0.0;
  const key = String(ratio).toLowerCase().trim();
  if (SPLITTER_INSERTION_LOSS[key] !== undefined) {
    return SPLITTER_INSERTION_LOSS[key];
  }
  // Format numeric ratio (misal ratio = 8 atau '8')
  if (/^\d+$/.test(key)) {
    const formatted = `1:${key}`;
    if (SPLITTER_INSERTION_LOSS[formatted] !== undefined) {
      return SPLITTER_INSERTION_LOSS[formatted];
    }
    const n = parseInt(key, 10);
    if (n > 1) {
      return Math.round((10 * Math.log10(n) + 0.2 * Math.log2(n)) * 10) / 10;
    }
  }
  return 0.0;
}

/**
 * Menghitung jarak geodetik (Haversine) antara dua titik koordinat WGS84 dalam meter
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null ||
      lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return 0;
  }
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (!Number.isFinite(nLat1) || !Number.isFinite(nLon1) || !Number.isFinite(nLat2) || !Number.isFinite(nLon2)) {
    return 0;
  }

  if (nLat1 === nLat2 && nLon1 === nLon2) return 0;

  const R = 6371e3; // Radius bumi dalam meter
  const phi1 = (nLat1 * Math.PI) / 180;
  const phi2 = (nLat2 * Math.PI) / 180;
  const deltaPhi = ((nLat2 - nLat1) * Math.PI) / 180;
  const deltaLambda = ((nLon2 - nLon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Menghitung akumulasi panjang rute kabel dari array koordinat polyline
 * @param {Array} path - Array of [lat, lng] atau [{lat, lng}]
 * @returns {number} Panjang dalam meter
 */
function calculatePathDistanceMeters(path) {
  if (!Array.isArray(path) || path.length < 2) return 0;
  let totalMeters = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    let lat1, lon1, lat2, lon2;

    if (Array.isArray(p1) && p1.length >= 2) {
      lat1 = parseFloat(p1[0]);
      lon1 = parseFloat(p1[1]);
    } else if (p1 && typeof p1 === 'object') {
      lat1 = parseFloat(p1.lat);
      lon1 = parseFloat(p1.lng);
    }

    if (Array.isArray(p2) && p2.length >= 2) {
      lat2 = parseFloat(p2[0]);
      lon2 = parseFloat(p2[1]);
    } else if (p2 && typeof p2 === 'object') {
      lat2 = parseFloat(p2.lat);
      lon2 = parseFloat(p2.lng);
    }

    if (Number.isFinite(lat1) && Number.isFinite(lon1) && Number.isFinite(lat2) && Number.isFinite(lon2)) {
      totalMeters += calculateHaversineDistance(lat1, lon1, lat2, lon2);
    }
  }

  return totalMeters;
}

/**
 * Kalkulasi Teoretis Link Budget Optik
 * 
 * Formula:
 * Loss Kabel = (Feeder + Distribusi + Drop) * (Attenuation / 1000)
 * Loss Splitters = Loss_ODC + Loss_ODP
 * Total Loss = Loss Kabel + Loss Splitters + Connector Loss + Safety Margin
 * RX Estimasi = TX Power OLT - Total Loss
 * 
 * @param {Object} options
 * @returns {Object} Rincian perhitungan lengkap
 */
function calculateTheoreticalLoss(options = {}) {
  const feederMeters = Math.max(0, parseFloat(options.feederDistanceMeters) || 0);
  const distMeters = Math.max(0, parseFloat(options.distributionDistanceMeters) || 0);
  const dropMeters = Math.max(0, parseFloat(options.dropDistanceMeters) || 0);

  const txPower = Number.isFinite(parseFloat(options.txPowerDbm))
    ? parseFloat(options.txPowerDbm)
    : DEFAULT_TX_POWER_DBM;

  const attenuationPerKm = Number.isFinite(parseFloat(options.attenuationPerKm))
    ? parseFloat(options.attenuationPerKm)
    : DEFAULT_ATTENUATION_PER_KM;

  const connectorLoss = Number.isFinite(parseFloat(options.connectorLossDbm))
    ? parseFloat(options.connectorLossDbm)
    : DEFAULT_CONNECTOR_LOSS_DB;

  const safetyMargin = Number.isFinite(parseFloat(options.safetyMarginDbm))
    ? parseFloat(options.safetyMarginDbm)
    : DEFAULT_SAFETY_MARGIN_DB;

  const odcLoss = getSplitterLoss(options.odcSplitRatio || '1:4');
  const odpLoss = getSplitterLoss(options.odpSplitRatio || '1:8');

  // Loss Kabel per Segmen
  const feederLoss = (feederMeters / 1000) * attenuationPerKm;
  const distLoss = (distMeters / 1000) * attenuationPerKm;
  const dropLoss = (dropMeters / 1000) * attenuationPerKm;
  const totalCableMeters = feederMeters + distMeters + dropMeters;
  const totalCableLoss = feederLoss + distLoss + dropLoss;

  const totalSplitterLoss = odcLoss + odpLoss;
  const totalLoss = totalCableLoss + totalSplitterLoss + connectorLoss + safetyMargin;
  const estimatedRxPower = txPower - totalLoss;

  return {
    txPowerDbm: Math.round(txPower * 100) / 100,
    feederDistanceMeters: Math.round(feederMeters),
    feederLossDbm: Math.round(feederLoss * 1000) / 1000,
    distributionDistanceMeters: Math.round(distMeters),
    distributionLossDbm: Math.round(distLoss * 1000) / 1000,
    dropDistanceMeters: Math.round(dropMeters),
    dropLossDbm: Math.round(dropLoss * 1000) / 1000,
    totalCableDistanceMeters: Math.round(totalCableMeters),
    totalCableLossDbm: Math.round(totalCableLoss * 100) / 100,
    odcSplitRatio: options.odcSplitRatio || '1:4',
    odcLossDbm: Math.round(odcLoss * 10) / 10,
    odpSplitRatio: options.odpSplitRatio || '1:8',
    odpLossDbm: Math.round(odpLoss * 10) / 10,
    totalSplitterLossDbm: Math.round(totalSplitterLoss * 10) / 10,
    connectorLossDbm: Math.round(connectorLoss * 100) / 100,
    safetyMarginDbm: Math.round(safetyMargin * 100) / 100,
    totalLossDbm: Math.round(totalLoss * 100) / 100,
    estimatedRxPowerDbm: Math.round(estimatedRxPower * 100) / 100
  };
}

/**
 * Normalisasi nilai RX Power dari TR-069
 * Menangani string dengan 'dBm', angka negatif, dan konversi nanowatt/micro-optical unit.
 * @param {*} rawVal
 * @returns {number|null} Nilai dBm numerik atau null
 */
function parseRxPowerValue(rawVal) {
  if (rawVal === undefined || rawVal === null || rawVal === '' || rawVal === '-' || rawVal === 'N/A') {
    return null;
  }

  let cleanStr = String(rawVal).trim().replace(/dBm|dB/gi, '').trim();
  const num = parseFloat(cleanStr);
  if (!Number.isFinite(num)) return null;

  // Jika sudah dalam format standar dBm negatif (misal -18.5)
  if (num < 0) {
    return Math.round(num * 100) / 100;
  }

  // Jika nilai berupa raw linear unit positif (TR-069 optical transceiver)
  if (num > 0) {
    // Formula standard TR-069: 30 + 10 * log10(val * 10^-7)
    const dbVal = 30 + (Math.log10(num * Math.pow(10, -7)) * 10);
    if (Number.isFinite(dbVal)) {
      return Math.round(dbVal * 100) / 100;
    }
  }

  return null;
}

/**
 * Evaluasi Kualitas Redaman Optik dan Diagnosa Deviasi
 * 
 * Standar Sensitivitas GPON ONT:
 * - Optimal: -15.00 dBm s/d -22.99 dBm
 * - Wajar / Normal: -23.00 dBm s/d -26.99 dBm
 * - Warning: -27.00 dBm s/d -28.99 dBm
 * - Kritis: < -29.00 dBm atau > -8.00 dBm (Overload)
 * 
 * @param {number|string|null} rxActualRaw - Pembacaan aktual dari Dual-ACS
 * @param {number|string} rxEstimatedRaw - Estimasi teoretis
 * @returns {Object} Diagnosa, rekomendasi, kelas warna visual
 */
function evaluateOpticalQuality(rxActualRaw, rxEstimatedRaw) {
  const rxEst = Number.isFinite(parseFloat(rxEstimatedRaw))
    ? parseFloat(rxEstimatedRaw)
    : null;
  const rxAct = parseRxPowerValue(rxActualRaw);

  if (rxAct === null) {
    return {
      hasActual: false,
      rxActualDbm: null,
      rxEstimatedDbm: rxEst,
      deltaDbm: null,
      statusKey: 'unmonitored',
      statusLabel: 'Belum Terdeteksi',
      color: '#94a3b8',       // Slate gray
      badgeClass: 'ct-status-unknown',
      severity: 'info',
      icon: 'bi-question-circle',
      diagnosis: 'Perangkat ONT belum tersinkronisasi atau dalam status offline.',
      recommendation: 'Pastikan modem ONT menyala dan terhubung ke Dual-ACS server.'
    };
  }

  const delta = rxEst !== null ? Math.round(Math.abs(rxAct - rxEst) * 100) / 100 : 0;

  // Analisa Kategori Level Sinyal ONT
  let statusKey = 'optimal';
  let statusLabel = 'Optimal / Prima';
  let color = '#10b981';      // Emerald green
  let badgeClass = 'ct-status-optimal';
  let severity = 'success';
  let icon = 'bi-check-circle-fill';
  let diagnosis = 'Redaman optik sangat ideal, transmisi GPON berkinerja prima.';
  let recommendation = 'Koneksi optik stabil. Tidak memerlukan tindakan pemeliharaan.';

  if (rxAct > -8.0) {
    statusKey = 'overload';
    statusLabel = 'Sinyal Overload';
    color = '#ec4899';      // Hot pink
    badgeClass = 'ct-status-critical';
    severity = 'danger';
    icon = 'bi-exclamation-octagon-fill';
    diagnosis = 'Daya sinyal terlalu kuat (di atas -8 dBm). Berisiko merusak receiver optik ONT.';
    recommendation = 'Gunakan optical attenuator (redaman tambahan) atau naikkan rasio splitter.';
  } else if (rxAct < -29.0) {
    statusKey = 'critical';
    statusLabel = 'Kritis / Redaman Tinggi';
    color = '#ef4444';      // Red
    badgeClass = 'ct-status-critical';
    severity = 'danger';
    icon = 'bi-slash-circle-fill';
    diagnosis = 'Sinyal di bawah sensitivitas minimum receiver ONT (-29 dBm). Rawan disconnect.';
    recommendation = 'Periksa tekukan kabel (macro-bending), bersihkan konektor ODP, atau uji OTDR.';
  } else if (rxAct < -27.0) {
    statusKey = 'warning';
    statusLabel = 'Peringatan / Rendah';
    color = '#f97316';      // Orange
    badgeClass = 'ct-status-warning';
    severity = 'warning';
    icon = 'bi-exclamation-triangle-fill';
    diagnosis = 'Sinyal mendekati ambang batas toleransi putus (-27 s/d -28.9 dBm).';
    recommendation = 'Lakukan inspeksi fisik pada jalur drop cable dan periksa konektor adapter.';
  } else if (rxAct < -23.0) {
    statusKey = 'normal';
    statusLabel = 'Standar / Wajar';
    color = '#f59e0b';      // Amber yellow
    badgeClass = 'ct-status-normal';
    severity = 'info';
    icon = 'bi-info-circle-fill';
    diagnosis = 'Kualitas sinyal dalam batas operasional wajar FTTH GPON.';
    recommendation = 'Link aman. Terus pantau saat cuaca buruk atau pemeliharaan berkala.';
  }

  // Analisa Deviasi terhadap Link Budget Teoretis
  let deviationAnalysis = 'Sesuai dengan estimasi rute kabel.';
  if (rxEst !== null && delta > 4.5) {
    deviationAnalysis = `Deviasi tinggi (${delta} dB lebih rendah dari estimasi). Indikasi kuat macro-bending tajam atau konektor kotor.`;
    if (statusKey === 'optimal' || statusKey === 'normal') {
      recommendation += ' Catatan: Ada potensi redaman ekstra yang tidak terduga pada sambungan.';
    }
  } else if (rxEst !== null && delta > 2.0) {
    deviationAnalysis = `Deviasi sedang (${delta} dB). Pemasangan kabel dalam batas toleransi wajar.`;
  }

  return {
    hasActual: true,
    rxActualDbm: rxAct,
    rxEstimatedDbm: rxEst,
    deltaDbm: delta,
    statusKey,
    statusLabel,
    color,
    badgeClass,
    severity,
    icon,
    diagnosis,
    deviationAnalysis,
    recommendation
  };
}

/**
 * Ekstraksi nilai RX Power dari string params JSON di tabel acs_devices
 * @param {string|Object} paramsInput
 * @returns {number|null}
 */
function extractRxFromAcsParams(paramsInput) {
  if (!paramsInput) return null;
  let paramsObj = paramsInput;

  if (typeof paramsInput === 'string') {
    try {
      paramsObj = JSON.parse(paramsInput);
    } catch (_) {
      return null;
    }
  }

  if (!paramsObj || typeof paramsObj !== 'object') return null;

  for (const key of RX_POWER_KEYS) {
    // 1. Direct flat key lookup
    if (paramsObj[key] !== undefined && paramsObj[key] !== null) {
      const val = typeof paramsObj[key] === 'object' && paramsObj[key]._value !== undefined
        ? paramsObj[key]._value
        : paramsObj[key];
      const parsed = parseRxPowerValue(val);
      if (parsed !== null) return parsed;
    }

    // 2. Nested key lookup
    const parts = key.split('.');
    let cur = paramsObj;
    let found = true;
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in cur) {
        cur = cur[p];
      } else {
        found = false;
        break;
      }
    }
    if (found && cur !== undefined && cur !== null) {
      const val = typeof cur === 'object' && cur._value !== undefined ? cur._value : cur;
      const parsed = parseRxPowerValue(val);
      if (parsed !== null) return parsed;
    }
  }

  return null;
}

/**
 * Mengambil dan memetakan seluruh data RX Power dari Dual-ACS (Built-in acs_devices + External)
 * Mencocokkan ke database pelanggan berdasarkan:
 * 1. genieacs_tag
 * 2. pppoe_username
 * 3. phone
 * 
 * @returns {Map<number, Object>} Map dengan key customer.id -> data RX Power & ACS Info
 */
function getDualAcsRxPowerMap() {
  const customerRxMap = new Map();

  try {
    // 1. Ambil seluruh perangkat dari tabel Built-in acs_devices
    const acsDevices = db.prepare(`
      SELECT id, serial_number, manufacturer, product_class, tags, params, last_inform, updated_at
      FROM acs_devices
    `).all();

    // 2. Ambil seluruh pelanggan
    const customers = db.prepare(`
      SELECT id, name, phone, pppoe_username, genieacs_tag
      FROM customers
    `).all();

    // Indeks perangkat ACS berdasarkan serial_number, id, tags, dan pppoe user
    const snMap = new Map();
    const idMap = new Map();
    const tagToDevMap = new Map();
    const pppoeToDevMap = new Map();

    for (const dev of acsDevices) {
      const rxVal = extractRxFromAcsParams(dev.params);
      const isOnline = dev.last_inform
        ? (Date.now() - new Date(dev.last_inform).getTime() < 15 * 60 * 1000)
        : false;

      const devSummary = {
        deviceId: dev.id,
        serialNumber: dev.serial_number || dev.id,
        manufacturer: dev.manufacturer || '-',
        productClass: dev.product_class || '-',
        rxPower: rxVal,
        isOnline,
        lastInform: dev.last_inform || null,
        acsSource: 'Built-in ACS'
      };

      if (dev.serial_number) snMap.set(String(dev.serial_number).toLowerCase().trim(), devSummary);
      if (dev.id) idMap.set(String(dev.id).toLowerCase().trim(), devSummary);

      // Cek tags
      if (dev.tags) {
        try {
          const tagsArr = typeof dev.tags === 'string' ? JSON.parse(dev.tags) : dev.tags;
          if (Array.isArray(tagsArr)) {
            for (const t of tagsArr) {
              if (t) tagToDevMap.set(String(t).toLowerCase().trim(), devSummary);
            }
          }
        } catch (_) {}
      }

      // Cek parameter PPPoE Username di params
      if (dev.params) {
        try {
          const p = typeof dev.params === 'string' ? JSON.parse(dev.params) : dev.params;
          const pUser = p?.['VirtualParameters.pppoeUsername']?._value ||
            p?.['VirtualParameters.pppoeUsername'] ||
            p?.['VirtualParameters.pppUsername']?._value ||
            p?.['VirtualParameters.pppUsername'];
          if (pUser) {
            pppoeToDevMap.set(String(pUser).toLowerCase().trim(), devSummary);
          }
        } catch (_) {}
      }
    }

    // 3. Cocokkan setiap pelanggan ke perangkat ACS
    for (const cust of customers) {
      let matchedDev = null;

      // Prioritas 1: genieacs_tag
      if (cust.genieacs_tag) {
        const cleanTag = String(cust.genieacs_tag).toLowerCase().trim();
        matchedDev = tagToDevMap.get(cleanTag) || snMap.get(cleanTag) || idMap.get(cleanTag);
      }

      // Prioritas 2: pppoe_username
      if (!matchedDev && cust.pppoe_username) {
        const cleanPppoe = String(cust.pppoe_username).toLowerCase().trim();
        matchedDev = pppoeToDevMap.get(cleanPppoe) || tagToDevMap.get(cleanPppoe) || snMap.get(cleanPppoe);
      }

      // Prioritas 3: phone
      if (!matchedDev && cust.phone) {
        const cleanPhone = String(cust.phone).replace(/\D/g, '');
        if (cleanPhone) {
          matchedDev = tagToDevMap.get(cleanPhone);
          if (!matchedDev && cleanPhone.startsWith('62')) {
            matchedDev = tagToDevMap.get('0' + cleanPhone.slice(2));
          } else if (!matchedDev && cleanPhone.startsWith('0')) {
            matchedDev = tagToDevMap.get('62' + cleanPhone.slice(1));
          }
        }
      }

      if (matchedDev) {
        customerRxMap.set(cust.id, matchedDev);
      }
    }
  } catch (err) {
    console.error('[OpticalPowerService] Error indexing Dual-ACS RX Power:', err.message);
  }

  return customerRxMap;
}

/**
 * Mengompilasi seluruh topologi data redaman optik jaringan untuk tampilan Peta
 * Menghitung rute:
 * Kantor Pusat (NOC) -> Feeder -> ODC -> Distribusi -> ODP -> Drop Cable -> Pelanggan
 * 
 * @returns {Object} Data topologi dan link budget per-pelanggan & per-ODP
 */
function getOpticalNetworkTopologyData() {
  const settings = getSettings();
  const officeLat = parseFloat(settings.office_lat) || -6.200000;
  const officeLng = parseFloat(settings.office_lng) || 106.816666;

  const odps = db.prepare(`
    SELECT o.*, 
      p.name as parent_name, 
      p.type as parent_type, 
      p.lat as parent_lat, 
      p.lng as parent_lng,
      olt.name as olt_name
    FROM odps o
    LEFT JOIN odps p ON o.parent_odp_id = p.id
    LEFT JOIN olts olt ON o.olt_id = olt.id
  `).all();

  const customers = db.prepare(`
    SELECT c.*, o.name as odp_name, o.type as odp_type, o.lat as odp_lat, o.lng as odp_lng
    FROM customers c
    LEFT JOIN odps o ON c.odp_id = o.id
  `).all();

  const dualAcsMap = getDualAcsRxPowerMap();

  // Buat ODP index
  const odpMap = new Map();
  for (const odp of odps) {
    odpMap.set(odp.id, odp);
  }

  // Hitung jarak segmen ODP ke parent / NOC
  const odpSegmentDistances = new Map();
  for (const odp of odps) {
    let distanceMeters = 0;
    if (odp.cable_path) {
      try {
        const parsed = JSON.parse(odp.cable_path);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          distanceMeters = calculatePathDistanceMeters(parsed);
        }
      } catch (_) {}
    }

    if (distanceMeters === 0 && odp.lat && odp.lng) {
      const oLat = parseFloat(odp.lat);
      const oLng = parseFloat(odp.lng);
      if (odp.parent_odp_id && odpMap.has(odp.parent_odp_id)) {
        const parent = odpMap.get(odp.parent_odp_id);
        if (parent.lat && parent.lng) {
          distanceMeters = calculateHaversineDistance(oLat, oLng, parseFloat(parent.lat), parseFloat(parent.lng)) * 1.25;
        }
      } else {
        // Direct to Office/NOC
        distanceMeters = calculateHaversineDistance(oLat, oLng, officeLat, officeLng) * 1.25;
      }
    }

    odpSegmentDistances.set(odp.id, distanceMeters);
  }

  // Hitung Link Budget per Pelanggan
  const customersOptical = {};
  let totalMonitored = 0;
  let totalOptimal = 0;
  let totalNormal = 0;
  let totalWarning = 0;
  let totalCritical = 0;

  for (const cust of customers) {
    if (!cust.lat || !cust.lng) continue;

    const custLat = parseFloat(cust.lat);
    const custLng = parseFloat(cust.lng);

    // 1. Hitung Drop Cable Distance
    let dropMeters = 0;
    if (cust.cable_path) {
      try {
        const parsed = JSON.parse(cust.cable_path);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          dropMeters = calculatePathDistanceMeters(parsed);
        }
      } catch (_) {}
    }

    const targetOdp = cust.odp_id ? odpMap.get(cust.odp_id) : null;
    if (dropMeters === 0 && targetOdp && targetOdp.lat && targetOdp.lng) {
      dropMeters = calculateHaversineDistance(custLat, custLng, parseFloat(targetOdp.lat), parseFloat(targetOdp.lng)) * 1.25;
    }

    // 2. Hitung Distribusi & Feeder Distance dari ODP ke NOC
    let distMeters = 0;
    let feederMeters = 0;
    let odcRatio = '1:4';
    let odpRatio = '1:8';

    if (targetOdp) {
      const isTargetOdc = targetOdp.type === 'ODC';
      if (isTargetOdc) {
        // Pelanggan langsung connect ke ODC
        odcRatio = '1:4';
        odpRatio = '1:1'; // Tidak ada splitter ODP bertingkat
        feederMeters = odpSegmentDistances.get(targetOdp.id) || 0;
      } else {
        // Pelanggan connect ke ODP
        odpRatio = targetOdp.port_capacity ? `1:${targetOdp.port_capacity}` : '1:8';
        if (targetOdp.parent_odp_id && odpMap.has(targetOdp.parent_odp_id)) {
          const parentOdc = odpMap.get(targetOdp.parent_odp_id);
          odcRatio = parentOdc.port_capacity ? `1:${parentOdc.port_capacity}` : '1:4';
          distMeters = odpSegmentDistances.get(targetOdp.id) || 0;
          feederMeters = odpSegmentDistances.get(parentOdc.id) || 0;
        } else {
          // ODP langsung tersambung ke NOC (Feeder direct)
          odcRatio = '1:1';
          feederMeters = odpSegmentDistances.get(targetOdp.id) || 0;
        }
      }
    }

    // 3. Kalkulasi Link Budget Teoretis
    const budget = calculateTheoreticalLoss({
      feederDistanceMeters: feederMeters,
      distributionDistanceMeters: distMeters,
      dropDistanceMeters: dropMeters,
      odcSplitRatio: odcRatio,
      odpSplitRatio: odpRatio,
      txPowerDbm: DEFAULT_TX_POWER_DBM,
      attenuationPerKm: DEFAULT_ATTENUATION_PER_KM,
      connectorLossDbm: DEFAULT_CONNECTOR_LOSS_DB
    });

    // 4. Pembacaan Aktual dari Dual-ACS
    const acsData = dualAcsMap.get(cust.id) || null;
    const rxActual = acsData ? acsData.rxPower : null;

    // 5. Evaluasi Kualitas & Diagnosa
    const evaluation = evaluateOpticalQuality(rxActual, budget.estimatedRxPowerDbm);

    if (evaluation.hasActual) {
      totalMonitored++;
      if (evaluation.statusKey === 'optimal') totalOptimal++;
      else if (evaluation.statusKey === 'normal') totalNormal++;
      else if (evaluation.statusKey === 'warning') totalWarning++;
      else if (evaluation.statusKey === 'critical' || evaluation.statusKey === 'overload') totalCritical++;
    }

    customersOptical[cust.id] = {
      customerId: cust.id,
      customerName: cust.name,
      odpId: cust.odp_id,
      odpName: targetOdp ? targetOdp.name : (cust.odp_name || '-'),
      budget,
      acs: acsData,
      evaluation
    };
  }

  return {
    summary: {
      totalCustomers: customers.length,
      totalMonitored,
      totalOptimal,
      totalNormal,
      totalWarning,
      totalCritical,
      defaultTxPowerDbm: DEFAULT_TX_POWER_DBM,
      defaultAttenuationPerKm: DEFAULT_ATTENUATION_PER_KM,
      defaultConnectorLossDb: DEFAULT_CONNECTOR_LOSS_DB
    },
    customers: customersOptical
  };
}

module.exports = {
  DEFAULT_ATTENUATION_PER_KM,
  DEFAULT_TX_POWER_DBM,
  DEFAULT_CONNECTOR_LOSS_DB,
  DEFAULT_SAFETY_MARGIN_DB,
  SPLITTER_INSERTION_LOSS,
  getSplitterLoss,
  calculateHaversineDistance,
  calculatePathDistanceMeters,
  calculateTheoreticalLoss,
  parseRxPowerValue,
  evaluateOpticalQuality,
  extractRxFromAcsParams,
  getDualAcsRxPowerMap,
  getOpticalNetworkTopologyData
};
