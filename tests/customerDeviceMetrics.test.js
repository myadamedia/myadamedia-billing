/**
 * tests/customerDeviceMetrics.test.js
 * 
 * Unit & Integration tests for Customer Dashboard Device Metrics:
 * - Optical Signal (RX Power) parsing & Link Budget Fallback
 * - Connected Devices (Hosts & Wi-Fi Associations) parsing
 * - GenieACS Built-in helper exports
 * - Dashboard EJS compilation & presentation integrity
 */

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const genieacsApi = require('../config/genieacs');
const customerDevice = require('../services/customerDeviceService');
const opticalPowerService = require('../services/opticalPowerService');

describe('Customer Device Metrics & Dashboard Features', () => {
  describe('GenieACS Module Exports', () => {
    test('should export builtinRowToDevice and inflateParams functions', () => {
      expect(typeof genieacsApi.builtinRowToDevice).toBe('function');
      expect(typeof genieacsApi.inflateParams).toBe('function');
      expect(typeof genieacsApi.matchesQuery).toBe('function');
      expect(typeof genieacsApi.createBuiltinAxiosProxy).toBe('function');
    });

    test('builtinRowToDevice should properly inflate parameters', () => {
      const mockRow = {
        id: 'HWTC12345678',
        serial_number: 'HWTC12345678',
        tags: JSON.stringify(['08123456789']),
        params: JSON.stringify({
          'InternetGatewayDevice.DeviceInfo.ModelName': 'EchoLife HG8245H5',
          'InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.RXPower': '98',
          'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TotalAssociations': '2'
        })
      };

      const dev = genieacsApi.builtinRowToDevice(mockRow);
      expect(dev._id).toBe('HWTC12345678');
      expect(dev._tags).toContain('08123456789');
      expect(dev._flatParams).toBeDefined();
      expect(dev.InternetGatewayDevice.DeviceInfo.ModelName._value).toBe('EchoLife HG8245H5');
    });
  });

  describe('Device Data Mapping (Optical Power & Connected Users)', () => {
    test('should correctly parse linear RX optical power and total associations', () => {
      const mockRow = {
        id: 'ZTEG98765432',
        serial_number: 'ZTEG98765432',
        tags: '[]',
        params: JSON.stringify({
          'InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.RXPower': '98',
          'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TotalAssociations': '3',
          'InternetGatewayDevice.LANDevice.1.Hosts.Host.1.HostName': 'Galaxy-S23',
          'InternetGatewayDevice.LANDevice.1.Hosts.Host.1.IPAddress': '192.168.1.10',
          'InternetGatewayDevice.LANDevice.1.Hosts.Host.1.MACAddress': '11:22:33:44:55:66',
          'InternetGatewayDevice.LANDevice.1.Hosts.Host.1.Active': '1'
        })
      };

      const dev = genieacsApi.builtinRowToDevice(mockRow);
      const mapped = customerDevice.mapDeviceData(dev, 'ZTEG98765432');

      expect(mapped.rxPower).toBe('-20.09');
      expect(mapped.isEstimatedRx).toBe(false);
      expect(mapped.opticalQuality).toBeDefined();
      expect(mapped.opticalQuality.statusKey).toBe('optimal');
      expect(mapped.totalAssociations).toBe(3);
      expect(mapped.connectedUsers.length).toBe(1);
      expect(mapped.connectedUsers[0].hostname).toBe('Galaxy-S23');
    });

    test('should parse negative dBm string directly', () => {
      const mockRow = {
        id: 'FH123456',
        params: JSON.stringify({
          'InternetGatewayDevice.WANDevice.1.X_FH_GponInterfaceConfig.RXPower': '-18.50 dBm'
        })
      };

      const dev = genieacsApi.builtinRowToDevice(mockRow);
      const mapped = customerDevice.mapDeviceData(dev, 'FH123456');
      expect(mapped.rxPower).toBe('-18.50');
      expect(mapped.isEstimatedRx).toBe(false);
    });

    test('should fallback to Wi-Fi associated device when Hosts.Host is empty', () => {
      const mockRow = {
        id: 'ONT-NO-HOST-TABLE',
        params: JSON.stringify({
          'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TotalAssociations': '1',
          'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.AssociatedDevice.1.AssociatedDeviceMACAddress': 'AA:BB:CC:DD:EE:FF',
          'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.AssociatedDevice.1.AssociatedDeviceIPAddress': '192.168.1.100'
        })
      };

      const dev = genieacsApi.builtinRowToDevice(mockRow);
      const mapped = customerDevice.mapDeviceData(dev, 'ONT-NO-HOST-TABLE');
      expect(mapped.connectedUsers.length).toBe(1);
      expect(mapped.connectedUsers[0].mac).toBe('AA:BB:CC:DD:EE:FF');
      expect(mapped.connectedUsers[0].ip).toBe('192.168.1.100');
      expect(mapped.totalAssociations).toBe(1);
    });
  });

  describe('views/dashboard.ejs Compilation & Rendering Integrity', () => {
    const templatePath = path.join(__dirname, '../views/dashboard.ejs');
    const template = fs.readFileSync(templatePath, 'utf8');

    test('should render accurately with live optical power and connected clients', () => {
      const data = {
        customer: {
          rxPower: '-19.25',
          isEstimatedRx: false,
          opticalQuality: { statusLabel: 'Optimal / Prima', color: '#10b981' },
          totalAssociations: 2,
          ssid: 'MyHomeWiFi'
        },
        profile: { id: 1, name: 'Budi Santoso', phone: '08123456789' },
        invoices: [],
        tickets: [],
        settings: {},
        paymentChannels: [],
        trafficMaxDownMbps: 10,
        trafficMaxUpMbps: 10,
        connectedUsers: [
          { hostname: 'Laptop-Budi', ip: '192.168.1.20', mac: 'AA:BB:CC:DD:EE:11', iface: 'Wi-Fi (WLAN)', status: 'Online' },
          { hostname: 'HP-Budi', ip: '192.168.1.21', mac: 'AA:BB:CC:DD:EE:22', iface: 'Wi-Fi (WLAN)', status: 'Online' }
        ],
        customerBalance: 0,
        isLoggedIn: true,
        showPPOB: false,
        notif: null,
        promoBanners: []
      };

      const html = ejs.render(template, data, { views: [path.join(__dirname, '../views')] });
      expect(html).toContain('-19.25 dBm');
      expect(html).toContain('Optimal / Prima');
      expect(html).toContain('2 Active');
      expect(html).toContain('Laptop-Budi');
      expect(html).not.toContain('- dBm');
    });

    test('should never display broken "- dBm" when optical data is missing or empty', () => {
      const data = {
        customer: {
          rxPower: '-',
          isEstimatedRx: false,
          opticalQuality: null,
          totalAssociations: 0,
          ssid: '-'
        },
        profile: { id: 1, name: 'Budi Santoso', phone: '08123456789' },
        invoices: [],
        tickets: [],
        settings: {},
        paymentChannels: [],
        trafficMaxDownMbps: 10,
        trafficMaxUpMbps: 10,
        connectedUsers: [],
        customerBalance: 0,
        isLoggedIn: true,
        showPPOB: false,
        notif: null,
        promoBanners: []
      };

      const html = ejs.render(template, data, { views: [path.join(__dirname, '../views')] });
      expect(html).not.toContain('- dBm');
      expect(html).toContain('Belum Terdeteksi');
      expect(html).toContain('id="liveConnectedCount">0</span> Perangkat');
      expect(html).toContain('0 Active');
    });

    test('should display active device count even if host list is empty but totalAssociations > 0', () => {
      const data = {
        customer: {
          rxPower: '-21.50',
          isEstimatedRx: true,
          opticalQuality: { statusLabel: 'Estimasi' },
          totalAssociations: 3,
          ssid: 'ZTE-WiFi'
        },
        profile: { id: 1, name: 'Budi Santoso', phone: '08123456789' },
        invoices: [],
        tickets: [],
        settings: {},
        paymentChannels: [],
        trafficMaxDownMbps: 10,
        trafficMaxUpMbps: 10,
        connectedUsers: [],
        customerBalance: 0,
        isLoggedIn: true,
        showPPOB: false,
        notif: null,
        promoBanners: []
      };

      const html = ejs.render(template, data, { views: [path.join(__dirname, '../views')] });
      expect(html).toContain('id="liveConnectedCount">3</span> Perangkat');
      expect(html).toContain('3 Active');
      expect(html).toContain('Estimasi');
      expect(html).toContain('3 Perangkat Terhubung Aktif');
    });

    test('should format traffic units as "Mbps" and not force uppercase "MBPS"', () => {
      const data = {
        customer: { rxPower: '-20.00', totalAssociations: 1, ssid: 'Test' },
        profile: { id: 1, name: 'User' },
        invoices: [],
        tickets: [],
        settings: {},
        paymentChannels: [],
        trafficMaxDownMbps: 10,
        trafficMaxUpMbps: 10,
        connectedUsers: [],
        customerBalance: 0,
        isLoggedIn: true,
        showPPOB: false,
        notif: null,
        promoBanners: []
      };

      const html = ejs.render(template, data, { views: [path.join(__dirname, '../views')] });
      expect(html).toContain('id="pppoe_rx_unit">Mbps</div>');
      expect(html).toContain('id="pppoe_tx_unit">Mbps</div>');
      expect(template).toContain('.gauge-unit-label {');
      expect(template).toContain('text-transform: none;');
      expect(template).not.toMatch(/\.gauge-unit-label\s*\{[^}]*text-transform:\s*uppercase/i);
    });
  });
});
