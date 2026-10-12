const customerDeviceService = require('../services/customerDeviceService');
const oltService = require('../services/oltService');
const opticalPowerService = require('../services/opticalPowerService');

describe('OLT and ACS Optical Signal Integration Tests', () => {
  describe('lookupOnuFromOltSync', () => {
    let originalGetOltStatsSync;

    beforeAll(() => {
      originalGetOltStatsSync = oltService.getOltStatsSync;
    });

    afterAll(() => {
      oltService.getOltStatsSync = originalGetOltStatsSync;
    });

    test('should match ONU by PPPoE username and parse OLT RX Power accurately', () => {
      const mockOltStats = {
        id: 3,
        name: 'OLT-HIOSO-MY',
        brand: 'hioso',
        status: 'Online',
        onus: [
          {
            index: '1/1/1',
            id: '1',
            name: 'MDE0059_Gopur',
            sn: 'VSOL12345678',
            status: 'Online',
            tx: '2.1 dBm',
            rx: '-21.40 dBm',
            uptime: '5d 08:30:15',
            distance: '450.2 m'
          }
        ]
      };

      oltService.getOltStatsSync = jest.fn().mockReturnValue(mockOltStats);

      const customer = {
        id: 86,
        name: 'ZULMI',
        phone: '085894943519',
        pppoe_username: 'MDE0059_Gopur',
        genieacs_tag: 'MDE0048_Zul',
        olt_id: 3
      };

      const matched = customerDeviceService.lookupOnuFromOltSync(customer);
      expect(matched).not.toBeNull();
      expect(matched.parsedRx).toBe(-21.40);
      expect(matched.rx).toBe('-21.40');
      expect(matched.status).toBe('Online');
      expect(matched.sn).toBe('VSOL12345678');
      expect(matched.name).toBe('MDE0059_Gopur');
      expect(matched.distance).toBe('450.2 m');
    });

    test('should match ONU by Serial Number when PPPoE differs', () => {
      const mockOltStats = {
        id: 3,
        name: 'OLT-HIOSO-MY',
        brand: 'hioso',
        status: 'Online',
        onus: [
          {
            index: '1/1/2',
            id: '2',
            name: 'PORT1_ONU2',
            sn: 'ZTEGC1234567',
            status: 'Online',
            tx: '2.5 dBm',
            rx: '-19.80 dBm',
            uptime: '1d 02:10:00',
            distance: '210.0 m'
          }
        ]
      };

      oltService.getOltStatsSync = jest.fn().mockReturnValue(mockOltStats);

      const customer = {
        id: 87,
        name: 'Pelanggan Baru',
        phone: '081234567890',
        pppoe_username: 'user_unknown',
        genieacs_tag: 'ZTEGC1234567',
        olt_id: 3
      };

      const matched = customerDeviceService.lookupOnuFromOltSync(customer);
      expect(matched).not.toBeNull();
      expect(matched.parsedRx).toBe(-19.80);
      expect(matched.sn).toBe('ZTEGC1234567');
    });

    test('should parse negative OLT rx string (e.g. -21.40 dBm -> -21.40 dBm)', () => {
      const mockOltStats = {
        id: 3,
        name: 'OLT-HIOSO-MY',
        brand: 'hioso',
        status: 'Online',
        onus: [
          {
            index: '1/1/3',
            id: '3',
            name: 'MDE0046',
            sn: 'HSGQ87654321',
            status: 'Online',
            tx: '2.0 dBm',
            rx: '-21.40 dBm', // Formatted by oltService computeRxDbm
            uptime: '2d 04:00:00'
          }
        ]
      };

      oltService.getOltStatsSync = jest.fn().mockReturnValue(mockOltStats);

      const customer = {
        id: 8,
        name: 'ALI',
        phone: '085218021579',
        pppoe_username: 'MDE0046',
        olt_id: 3
      };

      const matched = customerDeviceService.lookupOnuFromOltSync(customer);
      expect(matched).not.toBeNull();
      expect(matched.parsedRx).toBe(-21.40);
      expect(matched.rx).toBe('-21.40');
    });
  });

  describe('ACS CT-COM TR-069 Linear Formula and Quality Evaluation', () => {
    test('CT-COM raw linear optical transceiver values convert accurately', () => {
      // 177 -> -17.52 dBm
      const rx177 = opticalPowerService.parseRxPowerValue(177);
      expect(rx177).toBe(-17.52);

      // 85 -> -20.71 dBm
      const rx85 = opticalPowerService.parseRxPowerValue(85);
      expect(rx85).toBe(-20.71);

      // 98 -> -20.09 dBm
      const rx98 = opticalPowerService.parseRxPowerValue(98);
      expect(rx98).toBe(-20.09);
    });

    test('evaluateOpticalQuality correctly categorizes signal quality', () => {
      const qualOptimal = opticalPowerService.evaluateOpticalQuality(-17.52, -19.00);
      expect(qualOptimal.hasActual).toBe(true);
      expect(qualOptimal.statusKey).toBe('optimal');
      expect(qualOptimal.statusLabel).toBe('Optimal / Prima');
      expect(qualOptimal.color).toBe('#10b981');

      const qualWarning = opticalPowerService.evaluateOpticalQuality(-27.50, -19.00);
      expect(qualWarning.statusKey).toBe('warning');
      expect(qualWarning.statusLabel).toBe('Peringatan / Rendah');

      const qualCritical = opticalPowerService.evaluateOpticalQuality(-29.80, -19.00);
      expect(qualCritical.statusKey).toBe('critical');
      expect(qualCritical.statusLabel).toBe('Kritis / Redaman Tinggi');
    });
  });
});
