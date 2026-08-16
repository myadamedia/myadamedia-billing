/**
 * Logika GenieACS yang dipakai portal web dan bot WhatsApp.
 * Updated to support multi-server GenieACS setup.
 */
const axios = require('axios');
const { getSettingsWithCache } = require('../config/settingsManager');
const auditTrail = require('./auditTrailService');
const { logger } = require('../config/logger');
const genieacsApi = require('../config/genieacs');

// Helper: Search device across all servers (always get full data)
async function searchDeviceAcrossServers(query, fullData = true) {
  try {
    const servers = genieacsApi.getAllACSServers();
    
    for (const server of servers) {
      try {
        const instance = genieacsApi.createAxiosInstance(server);
        const params = {
          query: JSON.stringify(query)
        };
        
        // Only add projection if explicitly requesting minimal data
        if (!fullData) {
          params.projection = '_id,_tags';
        }

        let response;
        try {
          response = await instance.get('/devices', {
            params,
            timeout: 15000
          });
        } catch (e) {
          response = await instance.get('/api/devices', {
            params,
            timeout: 15000
          });
        }
        
        if (response.data && response.data.length > 0) {
          const device = response.data[0];
          device._acs_server_id = server.id;
          device._acs_server_name = server.name;
          logger.debug(`[CustomerDevice] Device found on ${server.name}`);
          return device;
        }
      } catch (error) {
        logger.debug(`[CustomerDevice] Device not found on ${server.name}: ${error.message}`);
      }
    }
    
    return null;
  } catch (error) {
    logger.error(`[CustomerDevice] Error searching device: ${error.message}`);
    return null;
  }
}

async function findDeviceByTag(tag) {
  try {
    const query = { $or: [{ _id: tag }, { _tags: tag }] };
    // Get full data by default
    return await searchDeviceAcrossServers(query, true);
  } catch (e) {
    logger.error(`[CustomerDevice] Error finding device by tag: ${e.message}`);
    return null;
  }
}

async function findDeviceByPppoe(pppoeUser) {
  try {
    const query = {
      $or: [
        { "VirtualParameters.pppoeUsername": pppoeUser },
        { "VirtualParameters.pppUsername": pppoeUser },
        { "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username": pppoeUser },
        { "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username._value": pppoeUser },
        { "Device.PPP.Interface.1.Username": pppoeUser },
        { "Device.PPP.Interface.1.Username._value": pppoeUser }
      ]
    };
    // Get full data by default
    return await searchDeviceAcrossServers(query, true);
  } catch (e) {
    logger.error(`[CustomerDevice] Error finding device by PPPoE: ${e.message}`);
    return null;
  }
}

async function fetchFullDevice(tag) {
  try {
    const query = { $or: [{ _id: tag }, { _tags: tag }] };
    // Always get full data
    return await searchDeviceAcrossServers(query, true);
  } catch (e) {
    logger.error(`[CustomerDevice] Error fetching full device: ${e.message}`);
    return null;
  }
}

async function resolveDeviceToken(input) {
  const token = String(input ?? '').replace(/[\r\n\t]+/g, '').trim();
  if (!token) return null;

  const direct = await findDeviceByTag(token);
  if (direct && direct._id) return direct;

  const byPppoe = await findDeviceByPppoe(token);
  if (byPppoe && byPppoe._id) return byPppoe;

  const found = await findDeviceWithTagVariants(token);
  if (found && found.device && found.device._id) return found.device;

  // Fallback resolution via SQLite acs_devices & customers tables
  try {
    const db = require('../config/database');
    const tokenLower = token.toLowerCase();
    
    // 1. Direct match in acs_devices by id, serial_number, tags, or params
    const row = db.prepare(`
      SELECT * FROM acs_devices 
      WHERE LOWER(id) = ? 
         OR LOWER(serial_number) = ? 
         OR (tags IS NOT NULL AND LOWER(tags) LIKE ?) 
         OR (params IS NOT NULL AND LOWER(params) LIKE ?)
      ORDER BY last_inform DESC LIMIT 1
    `).get(tokenLower, tokenLower, `%${tokenLower}%`, `%${tokenLower}%`);

    if (row) {
      const dev = genieacsApi.builtinRowToDevice(row);
      if (dev && dev._id) return dev;
    }

    // 2. Search customers table to resolve phone / tag / pppoe_username to acs_devices
    const cust = db.prepare(`
      SELECT * FROM customers 
      WHERE LOWER(phone) = ? 
         OR LOWER(genieacs_tag) = ? 
         OR LOWER(pppoe_username) = ? 
         OR CAST(id AS TEXT) = ?
    `).get(tokenLower, tokenLower, tokenLower, tokenLower);

    if (cust) {
      const custTag = (cust.genieacs_tag || cust.phone || cust.pppoe_username || '').toLowerCase();
      const pppUser = (cust.pppoe_username || '').toLowerCase();
      
      const devRow = db.prepare(`
        SELECT * FROM acs_devices 
        WHERE LOWER(id) = ? 
           OR LOWER(serial_number) = ? 
           OR (tags IS NOT NULL AND LOWER(tags) LIKE ?) 
           OR (? != '' AND params IS NOT NULL AND LOWER(params) LIKE ?)
        ORDER BY last_inform DESC LIMIT 1
      `).get(custTag, custTag, `%${custTag}%`, pppUser, `%${pppUser}%`);

      if (devRow) {
        const dev = genieacsApi.builtinRowToDevice(devRow);
        if (dev && dev._id) return dev;
      }
    }
  } catch (err) {
    logger.debug(`[CustomerDevice] Builtin resolution fallback info: ${err.message}`);
  }

  return null;
}

const parameterPaths = {
  serialNumber: [
    'DeviceID.SerialNumber',
    'InternetGatewayDevice.DeviceInfo.SerialNumber',
    'Device.DeviceInfo.SerialNumber'
  ],
  model: [
    'DeviceID.ProductClass',
    'InternetGatewayDevice.DeviceInfo.ModelName',
    'Device.DeviceInfo.ModelName',
    'ModelName'
  ],
  softwareVersion: [
    'InternetGatewayDevice.DeviceInfo.SoftwareVersion',
    'Device.DeviceInfo.SoftwareVersion'
  ],
  ssid: [
    'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
    'InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.SSID',
    'InternetGatewayDevice.LANDevice.1.WLANConfiguration.3.SSID',
    'InternetGatewayDevice.LANDevice.1.WLANConfiguration.4.SSID',
    'InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID',
    'InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.SSID',
    'Device.WiFi.SSID.1.SSID',
    'Device.WiFi.SSID.2.SSID',
    'Device.WiFi.SSID.*.SSID',
    'VirtualParameters.SSID',
    'VirtualParameters.SSID2G',
    'VirtualParameters.SSID5G',
    'VirtualParameters.ssid'
  ],
  rxPower: [
    'VirtualParameters.RXPower',
    'VirtualParameters.redaman',
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
  ],
  pppoeIP: [
    'VirtualParameters.pppoeIP',
    'VirtualParameters.pppIP',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.ExternalIPAddress',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANIPConnection.1.ExternalIPAddress',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.3.WANPPPConnection.1.ExternalIPAddress',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.3.WANIPConnection.1.ExternalIPAddress',
    'Device.PPP.Interface.1.ExternalIPAddress',
    'Device.IP.Interface.1.IPv4Address.1.IPAddress'
  ],
  pppUsername: [
    'VirtualParameters.pppoeUsername',
    'VirtualParameters.pppUsername',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.2.Username',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.3.Username',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.Username',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.2.Username',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.3.WANPPPConnection.1.Username',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.3.WANPPPConnection.2.Username',
    'Device.PPP.Interface.1.Username',
    'Device.PPP.Interface.2.Username',
    'Device.PPP.Interface.3.Username'
  ],
  uptime: [
    'VirtualParameters.getdeviceuptime',
    'InternetGatewayDevice.DeviceInfo.UpTime',
    'Device.DeviceInfo.UpTime'
  ],
  userConnected: [
    'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TotalAssociations',
    'InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.TotalAssociations',
    'InternetGatewayDevice.LANDevice.1.Hosts.HostNumberOfEntries',
    'Device.WiFi.AccessPoint.1.AssociatedDeviceNumberOfEntries',
    'Device.WiFi.AccessPoint.2.AssociatedDeviceNumberOfEntries',
    'Device.Hosts.HostNumberOfEntries'
  ]
};

// PPPoE IP search keys matching user's template
const PPPOE_IP_KEYS = [
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.1.WANPPPConnection.2.ExternalIPAddress',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.ExternalIPAddress',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.2.ExternalIPAddress',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.3.WANPPPConnection.1.ExternalIPAddress',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.4.WANPPPConnection.1.ExternalIPAddress',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.5.WANPPPConnection.1.ExternalIPAddress',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.ExternalIPAddress',
  'Device.PPP.Interface.1.ExternalIPAddress',
  'Device.IP.Interface.1.IPv4Address.1.IPAddress'
];

// PPPoE Username search keys matching user's template
const PPPOE_USER_KEYS = [
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.1.WANPPPConnection.2.Username',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.Username',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.2.Username',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.3.WANPPPConnection.1.Username',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.3.WANPPPConnection.2.Username',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.4.WANPPPConnection.1.Username',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.4.WANPPPConnection.2.Username',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.5.WANPPPConnection.1.Username',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Username',
  'Device.PPP.Interface.1.Username',
  'Device.PPP.Interface.2.Username',
  'Device.PPP.Interface.3.Username'
];

function getNestedValue(obj, path) {
  try {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (!current) return null;
      current = current[part];
    }
    if (current && typeof current === 'object' && '_value' in current) {
      return current._value;
    }
    if (current && typeof current === 'object' && current.hasOwnProperty('_value')) {
      return current._value;
    }
    return current;
  } catch (e) {
    return null;
  }
}

function getWildcardMatches(device, path) {
  const parts = path.split('.');
  const results = [];

  function recurse(current, index, currentPathParts) {
    if (current === undefined || current === null) return;
    
    if (index === parts.length) {
      let val = current;
      if (typeof current === 'object' && '_value' in current) {
        val = current._value;
      }
      results.push({
        path: currentPathParts.join('.'),
        value: val
      });
      return;
    }

    const part = parts[index];
    if (part === '*') {
      if (typeof current === 'object') {
        for (const key of Object.keys(current)) {
          if (!key.startsWith('_')) {
            recurse(current[key], index + 1, [...currentPathParts, key]);
          }
        }
      }
    } else {
      if (typeof current === 'object') {
        const targetLower = part.toLowerCase();
        for (const key of Object.keys(current)) {
          if (key.toLowerCase() === targetLower) {
            recurse(current[key], index + 1, [...currentPathParts, key]);
          }
        }
      }
    }
  }

  recurse(device, 0, []);
  return results;
}

function getDeviceParameterValue(device, keys, filterFn) {
  for (const key of keys) {
    const matches = getWildcardMatches(device, key);
    for (const match of matches) {
      if (filterFn) {
        if (filterFn(match.path, match.value, device)) {
          return match.value;
        }
      } else if (match.value !== undefined && match.value !== null && match.value !== '') {
        return match.value;
      }
    }
  }
  return '';
}

function extractPppoeIp(d) {
  const ip = getDeviceParameterValue(d, PPPOE_IP_KEYS, (matchedPath, value, device) => {
    if (!value || value === '0.0.0.0' || value === '-') return false;
    
    if (matchedPath.includes('WANPPPConnection.')) {
      const connectionTypePath = matchedPath.replace('ExternalIPAddress', 'ConnectionType');
      const connTypeMatches = getWildcardMatches(device, connectionTypePath);
      if (connTypeMatches.length > 0 && connTypeMatches[0].value === 'bridge') {
        return false;
      }
    }
    return true;
  });
  
  if (ip) return ip;
  if (d._ip && d._ip !== '-' && d._ip !== '0.0.0.0') return d._ip;
  return 'N/A';
}

function extractPppoeUser(d) {
  const user = getDeviceParameterValue(d, PPPOE_USER_KEYS, (matchedPath, value, device) => {
    if (!value || value === '-') return false;
    
    if (matchedPath.includes('WANPPPConnection.')) {
      const connectionTypePath = matchedPath.replace('Username', 'ConnectionType');
      const connTypeMatches = getWildcardMatches(device, connectionTypePath);
      if (connTypeMatches.length > 0 && connTypeMatches[0].value === 'PPPoE_Bridged') {
        return false;
      }
    }
    return true;
  });
  
  return user || 'N/A';
}

function formatUptime(seconds) {
  if (!seconds || seconds === 'N/A' || seconds === '-') return seconds || 'N/A';
  if (typeof seconds === 'string' && (seconds.includes('d') || seconds.includes(':')) && isNaN(seconds)) {
    return seconds;
  }
  const totalSecs = parseInt(seconds, 10);
  if (isNaN(totalSecs)) return seconds || 'N/A';
  const days = Math.floor(totalSecs / 86400);
  const rem = totalSecs % 86400;
  let hrs = Math.floor(rem / 3600);
  if (hrs < 10) hrs = "0" + hrs;
  const rem2 = rem % 3600;
  let mins = Math.floor(rem2 / 60);
  if (mins < 10) mins = "0" + mins;
  let secs = rem2 % 60;
  if (secs < 10) secs = "0" + secs;
  return days + "d " + hrs + ":" + mins + ":" + secs;
}

const PPPOE_UPTIME_KEYS = [
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Uptime',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.1.WANPPPConnection.2.Uptime',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.Uptime',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.2.Uptime',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.3.WANPPPConnection.1.Uptime',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.4.WANPPPConnection.1.Uptime',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.5.WANPPPConnection.1.Uptime',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Uptime',
  'Device.PPP.Interface.1.UpTime'
];

function extractPppoeUptime(d) {
  let uptimeVal = getDeviceParameterValue(d, PPPOE_UPTIME_KEYS, (matchedPath, value, device) => {
    if (value === undefined || value === null || value === '' || value === '-') return false;
    
    if (matchedPath.toLowerCase().includes('wanpppconnection')) {
      const connTypePath = matchedPath.substring(0, matchedPath.toLowerCase().lastIndexOf('.uptime')) + '.ConnectionType';
      const connTypeMatches = getWildcardMatches(device, connTypePath);
      if (connTypeMatches.length > 0 && connTypeMatches[0].value === 'PPPoE_Bridged') {
        return false;
      }
    }
    return true;
  });

  if (!uptimeVal || uptimeVal === '-') {
    const UPTIME_PATHS = [
      'VirtualParameters.getdeviceuptime',
      'InternetGatewayDevice.DeviceInfo.UpTime',
      'Device.DeviceInfo.UpTime'
    ];
    for (const path of UPTIME_PATHS) {
      const val = getNestedValue(d, path);
      if (val && val !== '-' && val !== '') {
        uptimeVal = val;
        break;
      }
    }
  }

  if (uptimeVal) {
    return formatUptime(uptimeVal);
  }
  return 'N/A';
}

function getParameterWithPaths(device, paths) {
  if (!device || typeof device !== 'object') return 'N/A';
  let values = [];

  for (const p of paths) {
    // 1. Try wildcard traverse on inflated device object
    const matches = getWildcardMatches(device, p);
    for (const m of matches) {
      const val = m.value;
      if (val !== undefined && val !== null && val !== '' && val !== 'N/A') {
        const isIpPath = p.toLowerCase().includes('ipaddress') || p.toLowerCase().includes('pppoeip') || p.toLowerCase().includes('pppip');
        if (isIpPath && String(val) === '0.0.0.0') continue;

        const isCountParam = p.includes('TotalAssociations') || 
                             p.includes('AssociatedDeviceNumberOfEntries') || 
                             p.includes('HostNumberOfEntries');
        if (isCountParam) {
          values.push(parseInt(val) || 0);
        } else {
          return String(val);
        }
      }
    }

    // 2. Try flat params direct lookup if device._flatParams is available
    if (device._flatParams && typeof device._flatParams === 'object') {
      const pLower = p.toLowerCase();
      for (const [fKey, fVal] of Object.entries(device._flatParams)) {
        if (fKey.toLowerCase() === pLower && fVal !== undefined && fVal !== null && fVal !== '' && fVal !== 'N/A') {
          const isIpPath = p.toLowerCase().includes('ipaddress') || p.toLowerCase().includes('pppoeip') || p.toLowerCase().includes('pppip');
          if (isIpPath && String(fVal) === '0.0.0.0') continue;

          const isCountParam = p.includes('TotalAssociations') || 
                               p.includes('AssociatedDeviceNumberOfEntries') || 
                               p.includes('HostNumberOfEntries');
          if (isCountParam) {
            values.push(parseInt(fVal) || 0);
          } else {
            return String(fVal);
          }
        }
      }
    }
  }

  if (values.length > 0) {
    return values.reduce((a, b) => a + b, 0);
  }

  return 'N/A';
}

function expandTagCandidates(input) {
  const t = String(input || '').trim();
  if (!t) return [];
  if (/^\d+$/.test(t)) {
    const d = t.replace(/\D/g, '');
    const set = new Set([d]);
    if (d.startsWith('62') && d.length > 2) set.add('0' + d.slice(2));
    if (d.startsWith('0')) set.add('62' + d.slice(1));
    return [...set];
  }
  return [t];
}

/** Coba beberapa varian tag (62/0 untuk nomor) sampai device ketemu */
async function findDeviceWithTagVariants(input) {
  for (const c of expandTagCandidates(input)) {
    const dev = await findDeviceByTag(c);
    if (dev) return { device: dev, canonicalTag: c };
  }
  return null;
}

/** Nomor dari JID WhatsApp @s.whatsapp.net */
function phoneFromPnJid(jid) {
  if (!jid || typeof jid !== 'string') return null;
  const [user, host] = jid.split('@');
  if (!user || host !== 's.whatsapp.net') return null;
  return user.replace(/\D/g, '') || null;
}

function mapDeviceData(device, tag) {
  if (!device) return null;

  let ssid = getParameterWithPaths(device, parameterPaths.ssid);
  if (!ssid || ssid === 'N/A' || ssid === '-') {
    const wlanObj = device?.InternetGatewayDevice?.LANDevice?.['1']?.WLANConfiguration || device?.Device?.WiFi?.SSID || device?.Device?.WiFi?.AccessPoint;
    if (wlanObj && typeof wlanObj === 'object') {
      for (const wKey in wlanObj) {
        const item = wlanObj[wKey];
        const sVal = item?.SSID?._value || item?.SSID;
        if (sVal && typeof sVal === 'string' && sVal.trim() && sVal !== 'N/A' && sVal !== '0') {
          ssid = sVal.trim();
          break;
        }
      }
    }
  }
  const ssidDisplay = (ssid && ssid !== 'N/A' && ssid !== '0') ? ssid : '-';

  const lastInformRaw =
    device?._lastInform
      || device?.Events?.Inform
      || device?.InternetGatewayDevice?.DeviceInfo?.['1']?.LastInform?._value
      || device?.InternetGatewayDevice?.DeviceInfo?.LastInform?._value
      || device?.Device?.DeviceInfo?.LastInform?._value;

  const lastInformDate = lastInformRaw ? new Date(lastInformRaw) : null;
  const lastInform = (lastInformDate && !isNaN(lastInformDate.getTime()))
    ? lastInformDate.toLocaleString('id-ID')
    : '-';

  let status = 'Offline';
  if (lastInformDate && !isNaN(lastInformDate.getTime())) {
    const diffMs = Date.now() - lastInformDate.getTime();
    status = diffMs < 15 * 60 * 1000 ? 'Online' : 'Offline';
  }

  if (status === 'Offline' || status === 'Unknown') {
    const pppIp = extractPppoeIp(device);
    const rx = extractRxPower(device);
    if ((pppIp && pppIp !== 'N/A' && pppIp !== '-') || (rx && rx !== 'N/A' && rx !== '-')) {
      status = 'Online';
    }
  }

  let connectedUsers = [];
  try {
    const hosts = device?.InternetGatewayDevice?.LANDevice?.['1']?.Hosts?.Host || device?.Device?.Hosts?.Host;
    
    // Collect Wi-Fi associated MACs & info if present
    const wifiAssocMacs = new Set();
    const wifiAssocMap = new Map();
    const wlanObj = device?.InternetGatewayDevice?.LANDevice?.['1']?.WLANConfiguration || device?.Device?.WiFi?.AccessPoint;
    if (wlanObj && typeof wlanObj === 'object') {
      for (const wKey in wlanObj) {
        const wlan = wlanObj[wKey];
        const assoc = wlan?.AssociatedDevice;
        if (assoc && typeof assoc === 'object') {
          const assocArr = Array.isArray(assoc) ? assoc : Object.values(assoc).filter(v => v && typeof v === 'object');
          assocArr.forEach(item => {
            const m = item?.AssociatedDeviceMACAddress?._value || item?.MACAddress?._value || item?.AssociatedDeviceMACAddress || item?.MACAddress;
            const ipVal = item?.AssociatedDeviceIPAddress?._value || item?.IPAddress?._value || item?.AssociatedDeviceIPAddress || item?.IPAddress || '-';
            if (m && typeof m === 'string') {
              const macClean = m.toLowerCase().trim();
              wifiAssocMacs.add(macClean);
              wifiAssocMap.set(macClean, {
                mac: m.trim(),
                ip: ipVal,
                iface: 'Wi-Fi (WLAN)'
              });
            }
          });
        }
      }
    }

    if (hosts && typeof hosts === 'object') {
      let hostEntries = [];
      if (Array.isArray(hosts)) {
        hostEntries = hosts;
      } else {
        hostEntries = Object.values(hosts).filter(v => v && typeof v === 'object');
      }

      for (const entry of hostEntries) {
        const hostname = (typeof entry?.HostName === 'object' ? entry?.HostName?._value : entry?.HostName) || 'Unknown';
        const ip = (typeof entry?.IPAddress === 'object' ? entry?.IPAddress?._value : entry?.IPAddress) || '-';
        const mac = (typeof entry?.MACAddress === 'object' ? entry?.MACAddress?._value : entry?.MACAddress) || '-';
        const iface = (typeof entry?.InterfaceType === 'object' ? entry?.InterfaceType?._value : entry?.InterfaceType || entry?.Interface) || '-';

        const rawActive = typeof entry?.Active === 'object' ? entry?.Active?._value : entry?.Active;
        const activeStr = String(rawActive ?? '').toLowerCase().trim();
        const isExplicitlyInactive = activeStr === 'false' || activeStr === '0' || activeStr === 'inactive' || activeStr === 'no';
        const macLower = String(mac || '').toLowerCase().trim();

        let isOnline = false;
        if (wifiAssocMacs.has(macLower)) {
          isOnline = true;
        } else if (rawActive === true || rawActive === 1 || activeStr === 'true' || activeStr === '1' || activeStr === 'active' || activeStr === 'online' || activeStr === 'yes') {
          isOnline = true;
        } else if ((rawActive === undefined || rawActive === null || activeStr === '') && !isExplicitlyInactive && mac !== '-' && ip !== '-' && ip !== '0.0.0.0') {
          isOnline = true;
        }

        connectedUsers.push({
          hostname,
          ip,
          mac,
          iface: wifiAssocMacs.has(macLower) ? 'Wi-Fi (WLAN)' : iface,
          status: isOnline ? 'Online' : 'Offline'
        });
      }
    }

    // Fallback: If Hosts.Host tree was empty/missing, add Wi-Fi associated devices directly
    if (connectedUsers.length === 0 && wifiAssocMap.size > 0) {
      for (const [macKey, info] of wifiAssocMap) {
        connectedUsers.push({
          hostname: 'Wi-Fi Client',
          ip: info.ip,
          mac: info.mac,
          iface: info.iface,
          status: 'Online'
        });
      }
    }
  } catch (e) {}

  let rxPower = getParameterWithPaths(device, parameterPaths.rxPower);
  if (rxPower !== 'N/A' && rxPower !== '-' && rxPower !== '') {
    const num = parseFloat(rxPower);
    if (!isNaN(num) && num > 0) {
      const dbVal = 30 + (Math.log10(num * Math.pow(10, -7)) * 10);
      rxPower = (Math.ceil(dbVal * 100) / 100).toFixed(2);
    }
  }
  const pppoeIP = extractPppoeIp(device);
  const pppoeUsername = extractPppoeUser(device);
  const uptimeRaw = getParameterWithPaths(device, parameterPaths.uptime);
  let totalAssociations = getParameterWithPaths(device, parameterPaths.userConnected);

  // Fallback: If N/A or 0, count from connectedUsers list (LAN + WLAN)
  if ((totalAssociations === 'N/A' || totalAssociations === 0 || totalAssociations === '0') && connectedUsers.length > 0) {
    totalAssociations = connectedUsers.filter(u => u.status === 'Online').length;
  }

  function formatUptime(seconds) {
    if (!seconds || seconds === 'N/A' || seconds === '-') return seconds || 'N/A';
    if (typeof seconds === 'string' && (seconds.includes('d') || seconds.includes(':')) && isNaN(seconds)) {
      return seconds;
    }
    const totalSecs = parseInt(seconds, 10);
    if (isNaN(totalSecs)) return seconds || 'N/A';
    const days = Math.floor(totalSecs / 86400);
    const rem = totalSecs % 86400;
    
    let hrs = Math.floor(rem / 3600);
    if (hrs < 10) hrs = "0" + hrs;
    
    const rem2 = rem % 3600;
    let mins = Math.floor(rem2 / 60);
    if (mins < 10) mins = "0" + mins;
    
    let secs = rem2 % 60;
    if (secs < 10) secs = "0" + secs;
    
    return days + "d " + hrs + ":" + mins + ":" + secs;
  }
  const uptime = formatUptime(uptimeRaw);
  const pppoeUptime = extractPppoeUptime(device);

  const serialNumber = getParameterWithPaths(device, parameterPaths.serialNumber);
  const productClass = getParameterWithPaths(device, parameterPaths.model);
  const softwareVersion = getParameterWithPaths(device, parameterPaths.softwareVersion);
  const model = productClass;

  let lokasi = device?._tags || '-';
  if (Array.isArray(lokasi)) lokasi = lokasi.join(', ');

  const db = require('../config/database');
  let dbCustomer = null;
  const pppoeClean = (pppoeUsername && pppoeUsername !== 'N/A') ? pppoeUsername.toLowerCase().trim() : '';
  const tagClean = tag ? String(tag).toLowerCase().trim() : '';
  const snClean = (serialNumber && serialNumber !== 'N/A') ? String(serialNumber).toLowerCase().trim() : '';
  const devIdClean = device?._id ? String(device._id).toLowerCase().trim() : '';

  if (pppoeClean) {
    dbCustomer = db.prepare('SELECT id, name, phone, genieacs_tag, pppoe_username FROM customers WHERE LOWER(pppoe_username) = ?').get(pppoeClean);
  }
  if (!dbCustomer && tagClean) {
    dbCustomer = db.prepare('SELECT id, name, phone, genieacs_tag, pppoe_username FROM customers WHERE LOWER(genieacs_tag) = ? OR LOWER(phone) = ?').get(tagClean, tagClean);
  }
  if (!dbCustomer && snClean) {
    dbCustomer = db.prepare('SELECT id, name, phone, genieacs_tag, pppoe_username FROM customers WHERE LOWER(genieacs_tag) = ? OR LOWER(phone) = ?').get(snClean, snClean);
  }
  if (!dbCustomer && devIdClean) {
    dbCustomer = db.prepare('SELECT id, name, phone, genieacs_tag, pppoe_username FROM customers WHERE LOWER(genieacs_tag) = ?').get(devIdClean);
  }

  const customerName = dbCustomer ? dbCustomer.name : '-';
  const customerPhone = dbCustomer ? dbCustomer.phone : '';
  const customerTag = dbCustomer ? (dbCustomer.genieacs_tag || dbCustomer.phone || dbCustomer.pppoe_username) : '';

  // Auto-sync tags in SQLite if empty for Built-in ACS
  if (genieacsApi.isBuiltinAcsEnabled() && device?._id && customerTag) {
    try {
      db.prepare("UPDATE acs_devices SET tags = ? WHERE id = ? AND (tags IS NULL OR tags = '[]' OR tags = '')")
        .run(JSON.stringify([customerTag]), device._id);
    } catch (_) {}
  }

  return {
    phone: tagClean !== devIdClean ? tag : (customerTag || tag || '-'),
    customerName: customerName,
    customerPhone: customerPhone,
    customerTag: customerTag,
    ssid: ssidDisplay,
    status,
    lastInform,
    connectedUsers,
    rxPower: rxPower === 'N/A' ? '-' : rxPower,
    pppoeIP: pppoeIP === 'N/A' ? '-' : pppoeIP,
    pppoeUsername: pppoeUsername === 'N/A' ? '-' : pppoeUsername,
    pppoeUptime: pppoeUptime === 'N/A' ? '-' : pppoeUptime,
    serialNumber: serialNumber === 'N/A' ? '-' : serialNumber,
    productClass: productClass === 'N/A' ? '-' : productClass,
    lokasi,
    softwareVersion: softwareVersion === 'N/A' ? '-' : softwareVersion,
    model: model === 'N/A' ? '-' : model,
    uptime: uptime === 'N/A' ? '-' : uptime,
    totalAssociations
  };
}

async function getCustomerDeviceData(tag) {
  const base = await resolveDeviceToken(tag);
  if (!base || !base._id) {
    try {
      const db = require('../config/database');
      const tagClean = String(tag || '').toLowerCase().trim();
      const cleanNum = tagClean.replace(/\D/g, '');

      const profile = db.prepare(`
        SELECT * FROM customers 
        WHERE LOWER(phone) = ? 
           OR LOWER(genieacs_tag) = ? 
           OR LOWER(pppoe_username) = ? 
           OR CAST(id AS TEXT) = ?
           OR (? != '' AND (REPLACE(phone, '+', '') LIKE ? OR phone LIKE ?))
      `).get(tagClean, tagClean, tagClean, tagClean, cleanNum, `%${cleanNum}%`, `%${cleanNum}%`);

      if (profile) {
        let activeIp = '-';
        let activeStatus = 'Offline';
        try {
          const radSession = db.prepare(`
            SELECT framedipaddress FROM radacct 
            WHERE LOWER(username) = LOWER(?) AND acctstoptime IS NULL 
            ORDER BY acctstarttime DESC LIMIT 1
          `).get(profile.pppoe_username || profile.phone);
          if (radSession && radSession.framedipaddress) {
            activeIp = radSession.framedipaddress;
            activeStatus = 'Online';
          }
        } catch (_) {}

        return {
          phone: profile.phone || tag,
          customerName: profile.name || '-',
          customerPhone: profile.phone || '-',
          customerTag: profile.genieacs_tag || profile.pppoe_username || profile.phone || tag,
          ssid: profile.wifi_ssid || '-',
          status: activeStatus,
          lastInform: '-',
          connectedUsers: [],
          rxPower: '-',
          pppoeIP: activeIp,
          pppoeUsername: profile.pppoe_username || '-',
          pppoeUptime: '-',
          serialNumber: profile.genieacs_tag || '-',
          productClass: profile.router_model || '-',
          lokasi: profile.address || '-',
          softwareVersion: '-',
          model: profile.router_model || '-',
          uptime: '-',
          totalAssociations: 0
        };
      }
    } catch (e) {
      logger.debug(`[CustomerDevice] Profile fallback info: ${e.message}`);
    }
    return null;
  }
  
  if (genieacsApi.isBuiltinAcsEnabled() && base._acs_server_id === 'builtin') {
    try {
      const acsService = require('./acsServerService');
      acsService.queueHostRefresh(base._id);
    } catch (_) {}
  }

  const device = await fetchFullDevice(base._id);
  return mapDeviceData(device || base, tag);
}

function fallbackCustomer(tag) {
  return {
    phone: tag,
    customerName: '-',
    ssid: '-',
    status: 'Tidak ditemukan',
    lastInform: '-',
    connectedUsers: [],
    rxPower: '-',
    pppoeIP: '-',
    pppoeUsername: '-',
    pppoeUptime: '-',
    serialNumber: '-',
    productClass: '-',
    lokasi: '-',
    softwareVersion: '-',
    model: '-',
    uptime: '-',
    totalAssociations: '-'
  };
}

async function updateSSID(tag, newSSID, actor = null) {
  try {
    const device = await resolveDeviceToken(tag);
    if (!device) return false;
    const deviceId = encodeURIComponent(device._id);
    
    // Gunakan server yang sesuai
    const server = device._acs_server_id ? genieacsApi.getACSServer(device._acs_server_id) : genieacsApi.getACSServer('legacy');
    if (!server) return false;
    
    const instance = genieacsApi.createAxiosInstance(server);
    const tasksUrl = `/devices/${deviceId}/tasks`;

    const parameterValues = [];
    
    // Check supported paths in DB
    const db = require('../config/database');
    const row = db.prepare('SELECT params FROM acs_devices WHERE id = ?').get(device._id);
    const flatParams = row && row.params ? JSON.parse(row.params) : null;
    
    if (flatParams) {
      // SSID 2.4G paths
      const paths24G = [
        'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
        'Device.WiFi.SSID.1.SSID'
      ];
      paths24G.forEach(p => {
        if (flatParams[p] !== undefined) {
          parameterValues.push([p, newSSID, 'xsd:string']);
        }
      });
      
      // SSID 5G paths
      const paths5G = [
        'Device.WiFi.SSID.2.SSID'
      ];
      for (const idx of [5, 6, 7, 8]) {
        paths5G.push(`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${idx}.SSID`);
      }
      paths5G.forEach(p => {
        if (flatParams[p] !== undefined) {
          parameterValues.push([p, `${newSSID}-5G`, 'xsd:string']);
        }
      });
    }
    
    // Fallback if no parameters match or device not bootstrapped yet
    if (parameterValues.length === 0) {
      parameterValues.push(
        ['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID', newSSID, 'xsd:string'],
        ['Device.WiFi.SSID.1.SSID', newSSID, 'xsd:string']
      );
    }

    let ok = false;
    try {
      await instance.post(tasksUrl, {
        name: 'setParameterValues',
        parameterValues: parameterValues
      }, { timeout: 20000 });
      ok = true;
    } catch (e) {
      logger.error(`[updateSSID] Failed to set SSID: ${e.message}`);
    }

    try {
      await instance.post(tasksUrl, { name: 'refreshObject', objectName: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration' }, { timeout: 15000 });
    } catch (e) {}
    try {
      await instance.post(tasksUrl, { name: 'refreshObject', objectName: 'Device.WiFi.SSID' }, { timeout: 15000 });
    } catch (e) {}

    // Catat audit trail jika berhasil
    if (ok && actor) {
      auditTrail.logAuditTrail({
        action: 'UPDATE_SSID',
        entity_type: 'device',
        entity_id: tag,
        actor_type: actor.type || 'unknown',
        actor_id: actor.id || null,
        actor_name: actor.name || null,
        details: {
          oldSSID: device._id || 'unknown',
          newSSID: newSSID
        },
        ip_address: actor.ip || null,
        user_agent: actor.userAgent || null
      });
    }

    return ok;
  } catch (e) {
    return false;
  }
}

async function updatePassword(tag, newPassword, actor = null) {
  try {
    const pwRaw = String(newPassword ?? '');
    const pw = pwRaw.replace(/[\r\n\t]+/g, '').trim();
    if (pw.length < 8) {
      logger.warn(`[updatePassword] Password too short for tag ${tag}`);
      return false;
    }
    const device = await resolveDeviceToken(tag);
    if (!device) {
      logger.warn(`[updatePassword] Device not found for tag ${tag}`);
      return false;
    }
    const deviceId = encodeURIComponent(device._id);
    
    // Gunakan server yang sesuai
    const server = device._acs_server_id ? genieacsApi.getACSServer(device._acs_server_id) : genieacsApi.getACSServer('legacy');
    if (!server) return false;
    
    const instance = genieacsApi.createAxiosInstance(server);
    const tasksUrl = `/devices/${deviceId}/tasks`;

    logger.info(`[updatePassword] Setting password for device ${deviceId}, tag ${tag}`);

    const parameterValues = [];
    
    // Check supported paths in DB
    const db = require('../config/database');
    const row = db.prepare('SELECT params FROM acs_devices WHERE id = ?').get(device._id);
    const flatParams = row && row.params ? JSON.parse(row.params) : null;
    
    if (flatParams) {
      // 2.4G password paths
      const paths24G = [
        'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase',
        'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase',
        'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey',
        'Device.WiFi.AccessPoint.1.Security.KeyPassphrase',
        'Device.WiFi.AccessPoint.1.Security.PreSharedKey'
      ];
      paths24G.forEach(p => {
        if (flatParams[p] !== undefined) {
          parameterValues.push([p, pw, 'xsd:string']);
        }
      });
      
      // 5G password paths
      const paths5G = [
        'Device.WiFi.AccessPoint.2.Security.KeyPassphrase',
        'Device.WiFi.AccessPoint.2.Security.PreSharedKey'
      ];
      for (const idx of [5, 6, 7, 8]) {
        paths5G.push(
          `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${idx}.KeyPassphrase`,
          `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${idx}.PreSharedKey.1.KeyPassphrase`,
          `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${idx}.PreSharedKey.1.PreSharedKey`
        );
      }
      paths5G.forEach(p => {
        if (flatParams[p] !== undefined) {
          parameterValues.push([p, pw, 'xsd:string']);
        }
      });
    }
    
    // Fallback if no parameters match or device not bootstrapped yet
    if (parameterValues.length === 0) {
      parameterValues.push(
        ['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase', pw, 'xsd:string'],
        ['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase', pw, 'xsd:string'],
        ['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey', pw, 'xsd:string'],
        ['Device.WiFi.AccessPoint.1.Security.KeyPassphrase', pw, 'xsd:string']
      );
    }

    let ok = false;
    try {
      await instance.post(tasksUrl, {
        name: 'setParameterValues',
        parameterValues: parameterValues
      }, { timeout: 20000 });
      ok = true;
    } catch (e) {
      logger.error(`[updatePassword] Failed to set password: ${e.message}`);
    }

    // Refresh object
    try {
      await instance.post(tasksUrl, { name: 'refreshObject', objectName: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration' }, { timeout: 15000 });
    } catch (e) {}
    try {
      await instance.post(tasksUrl, { name: 'refreshObject', objectName: 'Device.WiFi.AccessPoint' }, { timeout: 15000 });
    } catch (e) {}

    // Catat audit trail jika berhasil
    if (ok && actor) {
      auditTrail.logAuditTrail({
        action: 'UPDATE_PASSWORD',
        entity_type: 'device',
        entity_id: tag,
        actor_type: actor.type || 'unknown',
        actor_id: actor.id || null,
        actor_name: actor.name || null,
        details: {
          device_id: deviceId
        },
        ip_address: actor.ip || null,
        user_agent: actor.userAgent || null
      });
    }

    return ok;
  } catch (e) {
    logger.error(`[updatePassword] Error: ${e.message}`, e.response?.data || '');
    return false;
  }
}

async function requestReboot(tag, actor = null) {
  const device = await resolveDeviceToken(tag);
  if (!device || !device._id) return { ok: false, message: 'Perangkat tidak ditemukan.' };
  
  const server = device._acs_server_id ? genieacsApi.getACSServer(device._acs_server_id) : genieacsApi.getACSServer('legacy');
  if (!server) return { ok: false, message: 'Server ACS tidak ditemukan.' };
  
  const instance = genieacsApi.createAxiosInstance(server);
  
  try {
    await instance.post(
      `/devices/${encodeURIComponent(device._id)}/tasks`,
      { name: 'reboot', timestamp: new Date().toISOString() }
    );

    // Catat audit trail jika berhasil
    if (actor) {
      auditTrail.logAuditTrail({
        action: 'REBOOT_DEVICE',
        entity_type: 'device',
        entity_id: tag,
        actor_type: actor.type || 'unknown',
        actor_id: actor.id || null,
        actor_name: actor.name || null,
        details: {
          device_id: device._id
        },
        ip_address: actor.ip || null,
        user_agent: actor.userAgent || null
      });
    }

    return { ok: true, message: 'Perintah reboot terkirim. Tunggu beberapa menit hingga ONU online.' };
  } catch (e) {
    return { ok: false, message: 'Gagal mengirim reboot ke GenieACS.' };
  }
}

/** Daftar perangkat yang punya minimal satu tag (untuk admin WA). */
async function listDevicesWithTags(limit = 250) {
  const servers = genieacsApi.getAllACSServers();
  const queries = [
    { _tags: { $exists: true, $ne: [] } },
    { _tags: { $exists: true, $not: { $size: 0 } } },
    { '_tags.0': { $exists: true } }
  ];
  const projection = [
    '_id',
    '_tags',
    '_lastInform',
    'DeviceID.SerialNumber',
    'VirtualParameters.pppoeUsername',
    'VirtualParameters.pppUsername',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username._value'
  ].join(',');

  let allDevices = [];
  const maxLimit = Math.max(1, Math.min(parseInt(limit, 10) || 250, 500));

  for (const server of servers) {
    let found = false;
    for (const query of queries) {
      try {
        const instance = genieacsApi.createAxiosInstance(server);
        let response;
        try {
          response = await instance.get(`/devices`, {
            params: {
              query: JSON.stringify(query),
              limit: maxLimit,
              projection
            },
            timeout: 45000
          });
        } catch (e) {
          response = await instance.get(`/api/devices`, {
            params: {
              query: JSON.stringify(query),
              limit: maxLimit,
              projection
            },
            timeout: 45000
          });
        }
        const rows = Array.isArray(response.data) ? response.data : [];
        if (rows.length > 0) {
          rows.forEach(d => {
            d._acs_server_id = server.id;
            d._acs_server_name = server.name;
          });
          allDevices.push(...rows);
          found = true;
          break;
        }
      } catch (e) {
        /* coba query alternatif */
      }
    }
  }
  
  if (allDevices.length > 0) {
    return { ok: true, devices: allDevices.slice(0, limit) };
  }
  
  return { ok: false, devices: [], message: 'Gagal mengambil daftar dari GenieACS.' };
}

/** Mengambil semua perangkat tanpa melihat tag. */
async function listAllDevices(limit = 999999, acsId = null) {
  let servers = genieacsApi.getAllACSServers();
  if (acsId && acsId !== 'all') {
    servers = servers.filter(s => String(s.id) === String(acsId));
  }
  
  let allDevices = [];
  let lastError = null;

  // Query servers in parallel using Promise.allSettled
  const promises = servers.map(async (server) => {
    try {
      const instance = genieacsApi.createAxiosInstance(server);
      const params = {
        limit,
        projection: '_id,_tags,_lastInform,DeviceID.SerialNumber,VirtualParameters,InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username,InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.2.Username,InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress,Device.PPP.Interface.1.Username,Device.PPP.Interface.1.ExternalIPAddress,InternetGatewayDevice.DeviceInfo.ModelName,InternetGatewayDevice.DeviceInfo.SoftwareVersion,InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID,InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TotalAssociations,InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.TotalAssociations,InternetGatewayDevice.LANDevice.1.Hosts.HostNumberOfEntries,Device.WiFi.AccessPoint.1.AssociatedDeviceNumberOfEntries,Device.Hosts.HostNumberOfEntries,InternetGatewayDevice.LANDevice.1.Hosts.Host,Device.Hosts.Host'
      };
      let response;
      try {
        response = await instance.get(`/devices`, { params, timeout: 8000 });
      } catch (e) {
        response = await instance.get(`/api/devices`, { params, timeout: 8000 });
      }
      const rows = Array.isArray(response.data) ? response.data : [];
      rows.forEach(d => {
        d._acs_server_id = server.id;
        d._acs_server_name = server.name;
      });
      return rows;
    } catch (e) {
      logger.error(`[CustomerDevice] Error listing devices on ${server.name}: ${e.message}`);
      throw e;
    }
  });

  const results = await Promise.allSettled(promises);
  results.forEach((r) => {
    if (r.status === 'fulfilled') {
      allDevices.push(...r.value);
    } else {
      lastError = r.reason;
    }
  });
  
  if (allDevices.length === 0) {
    try {
      const db = require('../config/database');
      const rows = db.prepare('SELECT * FROM acs_devices ORDER BY last_inform DESC LIMIT ?').all(limit);
      if (rows && rows.length > 0) {
        allDevices = rows.map(r => genieacsApi.builtinRowToDevice(r));
      }
    } catch (_) {}
  }
  
  return { ok: true, devices: allDevices.slice(0, limit) };
}

async function updateCustomerTag(oldTag, newTag) {
  const device = await findDeviceByTag(oldTag);
  if (!device || !device._id) return { ok: false, message: 'Perangkat tidak ditemukan.' };
  
  const server = device._acs_server_id ? genieacsApi.getACSServer(device._acs_server_id) : genieacsApi.getACSServer('legacy');
  if (!server) return { ok: false, message: 'Server ACS tidak ditemukan.' };
  
  const instance = genieacsApi.createAxiosInstance(server);
  
  try {
    const tags = Array.isArray(device._tags) ? device._tags.filter((t) => t !== oldTag) : [];
    tags.push(newTag);
    await instance.put(
      `/devices/${encodeURIComponent(device._id)}`,
      { _id: device._id, _tags: tags }
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, message: 'Gagal mengubah tag.' };
  }
}

async function deleteConnectedClient(tag, clientMac, clientIp, actor = null) {
  try {
    const macClean = String(clientMac || '').toLowerCase().trim();
    const ipClean = String(clientIp || '').trim();
    if (!macClean && !ipClean) {
      return { ok: false, message: 'MAC Address atau IP Address perangkat harus diisi.' };
    }

    const device = await resolveDeviceToken(tag);
    if (!device || !device._id) return { ok: false, message: 'Perangkat ONT/ONU tidak ditemukan.' };

    const db = require('../config/database');
    const row = db.prepare('SELECT params, tags FROM acs_devices WHERE id = ?').get(device._id);
    let params = {};
    if (row && row.params) {
      try { params = JSON.parse(row.params); } catch (_) {}
    }

    let removedKeysCount = 0;
    const instancesToRemove = new Set();

    for (const [key, val] of Object.entries(params)) {
      const keyLower = key.toLowerCase();
      const valStr = String(val?._value ?? val ?? '').toLowerCase().trim();

      if (keyLower.includes('.hosts.host.') || keyLower.includes('.associateddevice.')) {
        if ((macClean && valStr === macClean) || (ipClean && valStr === ipClean)) {
          const lastDotIdx = key.lastIndexOf('.');
          if (lastDotIdx > 0) {
            const instancePath = key.substring(0, lastDotIdx + 1);
            instancesToRemove.add(instancePath);
          }
        }
      }
    }

    if (instancesToRemove.size > 0) {
      for (const [key] of Object.entries(params)) {
        for (const inst of instancesToRemove) {
          if (key.startsWith(inst)) {
            delete params[key];
            removedKeysCount++;
          }
        }
      }
    }

    if (row && removedKeysCount > 0) {
      const now = new Date().toISOString();
      db.prepare('UPDATE acs_devices SET params = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(params), now, device._id);
    }

    if (genieacsApi.isBuiltinAcsEnabled()) {
      try {
        const server = genieacsApi.getACSServer('builtin');
        const instance = genieacsApi.createAxiosInstance(server);
        const tasksUrl = `/devices/${encodeURIComponent(device._id)}/tasks`;

        for (const instPath of instancesToRemove) {
          const cleanObj = instPath.endsWith('.') ? instPath.slice(0, -1) : instPath;
          try {
            await instance.post(tasksUrl, { name: 'deleteObject', objectName: cleanObj }, { timeout: 15000 });
          } catch (_) {}
        }
        
        try {
          await instance.post(tasksUrl, { name: 'refreshObject', objectName: 'InternetGatewayDevice.LANDevice.1.Hosts.Host' }, { timeout: 15000 });
        } catch (_) {}
        try {
          await instance.post(tasksUrl, { name: 'refreshObject', objectName: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.AssociatedDevice' }, { timeout: 15000 });
        } catch (_) {}
      } catch (err) {
        logger.error(`[deleteConnectedClient] Failed to send task: ${err.message}`);
      }
    }

    if (actor) {
      auditTrail.logAuditTrail({
        action: 'DELETE_CONNECTED_CLIENT',
        entity_type: 'device',
        entity_id: tag,
        actor_type: actor.type || 'unknown',
        actor_id: actor.id || null,
        actor_name: actor.name || null,
        details: {
          device_id: device._id,
          mac: clientMac,
          ip: clientIp,
          removedInstances: [...instancesToRemove]
        },
        ip_address: actor.ip || null,
        user_agent: actor.userAgent || null
      });
    }

    return { ok: true, message: `Perangkat terhubung (${clientMac || clientIp}) berhasil dihapus.` };
  } catch (e) {
    logger.error(`[deleteConnectedClient] Error: ${e.message}`);
    return { ok: false, message: 'Gagal menghapus perangkat terhubung: ' + e.message };
  }
}

async function enableRemoteWebAccess(tag) {
  try {
    const device = await resolveDeviceToken(tag);
    if (!device || !device._id) return { ok: false, message: 'Perangkat ONT/ONU tidak ditemukan.' };

    if (!genieacsApi.isBuiltinAcsEnabled()) {
      return { ok: false, message: 'Mode Built-in ACS tidak aktif.' };
    }

    const server = genieacsApi.getACSServer('builtin');
    const instance = genieacsApi.createAxiosInstance(server);
    const tasksUrl = `/devices/${encodeURIComponent(device._id)}/tasks`;

    const parameterValues = [
      ['InternetGatewayDevice.UserInterface.RemoteAccess.Enable', true, 'xsd:boolean'],
      ['InternetGatewayDevice.UserInterface.RemoteAccess.Port', 8080, 'xsd:unsignedInt'],
      ['Device.UserInterface.RemoteAccess.Enable', true, 'xsd:boolean']
    ];

    try {
      await instance.post(tasksUrl, { name: 'setParameterValues', parameterValues }, { timeout: 15000 });
    } catch (_) {}

    try {
      const acsSvc = require('./acsServerService');
      acsSvc.triggerConnectionRequest(device._id).catch(() => {});
    } catch (_) {}

    return { ok: true, message: 'Perintah pengaktifan Remote Web Access via TR-069 berhasil dikirim ke ONT.' };
  } catch (e) {
    return { ok: false, message: 'Gagal mengaktifkan Remote Web Access: ' + e.message };
  }
}

async function proxyOntWebRequest(tag, baseProxyUrl, req, res) {
  try {
    const data = await getCustomerDeviceData(tag);
    const targetIp = (data && data.pppoeIP && data.pppoeIP !== '-') ? data.pppoeIP : null;

    if (!targetIp) {
      res.status(404).send(`
        <!doctype html>
        <html lang="id">
        <head><meta charset="utf-8"><title>IP ONT Tidak Ditemukan</title>
        <style>body{font-family:system-ui;background:#0f172a;color:#f8fafc;padding:40px;text-align:center} .card{max-width:480px;margin:0 auto;background:#1e293b;padding:24px;border-radius:12px;border:1px solid #334155} h1{font-size:20px;color:#f43f5e}</style>
        </head>
        <body>
          <div class="card">
            <h1>IP ONT/ONU Tidak Terdeteksi</h1>
            <p>Perangkat dengan tag <strong>${tag}</strong> sedang offline atau belum memiliki IP PPPoE/RADIUS aktif.</p>
            <p style="font-size:13px;color:#94a3b8">Pastikan ONT dalam keadaan menyala dan terhubung ke server ACS.</p>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const http = require('http');
    const https = require('https');

    const subPath = req.params[0] ? '/' + req.params[0] : '';
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    
    const targetUrlString = `http://${targetIp}${subPath}${queryString}`;
    const targetUrl = new URL(targetUrlString);

    const clientReqModule = targetUrl.protocol === 'https:' ? https : http;

    const proxyHeaders = { ...req.headers };
    delete proxyHeaders.host;
    delete proxyHeaders.connection;
    delete proxyHeaders['accept-encoding'];

    proxyHeaders['host'] = targetUrl.host;

    const proxyReq = clientReqModule.request({
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: proxyHeaders,
      timeout: 10000,
      rejectUnauthorized: false
    }, (proxyRes) => {
      if (proxyRes.headers.location) {
        let loc = proxyRes.headers.location;
        if (loc.startsWith('/')) {
          loc = baseProxyUrl + loc.substring(1);
        } else if (loc.includes(targetIp)) {
          loc = loc.replace(new RegExp(`https?://${targetIp}(:\\d+)?`, 'g'), baseProxyUrl);
        }
        proxyRes.headers.location = loc;
      }

      const contentType = String(proxyRes.headers['content-type'] || '').toLowerCase();
      const isHtml = contentType.includes('text/html');

      if (isHtml) {
        let responseBody = '';
        proxyRes.setEncoding('utf8');
        proxyRes.on('data', chunk => { responseBody += chunk; });
        proxyRes.on('end', () => {
          const prefix = baseProxyUrl.endsWith('/') ? baseProxyUrl : baseProxyUrl + '/';
          let modifiedBody = responseBody;
          if (modifiedBody.includes('<head>')) {
            modifiedBody = modifiedBody.replace('<head>', `<head><base href="${prefix}">`);
          } else if (modifiedBody.includes('<HEAD>')) {
            modifiedBody = modifiedBody.replace('<HEAD>', `<HEAD><base href="${prefix}">`);
          }

          delete proxyRes.headers['content-length'];
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          res.end(modifiedBody);
        });
      } else {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      }
    });

    proxyReq.on('error', (err) => {
      logger.error(`[proxyOntWebRequest] Error proxying to ${targetIp}: ${err.message}`);
      res.status(502).send(`
        <!doctype html>
        <html lang="id">
        <head><meta charset="utf-8"><title>Gagal Terhubung ke Web ONT</title>
        <style>body{font-family:system-ui;background:#0f172a;color:#f8fafc;padding:40px;text-align:center} .card{max-width:520px;margin:0 auto;background:#1e293b;padding:24px;border-radius:12px;border:1px solid #334155} h1{font-size:20px;color:#f43f5e} code{background:#0f172a;padding:2px 6px;border-radius:4px;color:#38bdf8}</style>
        </head>
        <body>
          <div class="card">
            <h1>Gagal Membuka Web GUI ONT (${targetIp})</h1>
            <p>Server billing tidak dapat membuka port HTTP pada IP <code>${targetIp}</code>.</p>
            <p style="font-size:13px;color:#94a3b8">Penyebab umum: Port Remote WAN Web ONT (Port 80/8080) belum diaktifkan atau diblokir oleh router/ONT.</p>
            <p style="font-size:13px;color:#cbd5e1">Solusi: Gunakan fitur <strong>Aktifkan Remote Web via TR-069</strong> di dashboard atau periksa aturan NAT/Proxy-ARP MikroTik.</p>
          </div>
        </body>
        </html>
      `);
    });

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  } catch (e) {
    logger.error(`[proxyOntWebRequest] Exception: ${e.message}`);
    res.status(500).send('Internal Proxy Error: ' + e.message);
  }
}

module.exports = {
  findDeviceByTag,
  findDeviceByPppoe,
  fetchFullDevice,
  resolveDeviceToken,
  mapDeviceData,
  getCustomerDeviceData,
  fallbackCustomer,
  updateSSID,
  updatePassword,
  requestReboot,
  updateCustomerTag,
  listDevicesWithTags,
  listAllDevices,
  expandTagCandidates,
  findDeviceWithTagVariants,
  phoneFromPnJid,
  deleteConnectedClient,
  enableRemoteWebAccess,
  proxyOntWebRequest
};
