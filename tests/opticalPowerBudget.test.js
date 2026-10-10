const opticalPowerSvc = require('../services/opticalPowerService');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

describe('Optical Power Budget & Dual-ACS Map Service', () => {
  describe('Geodesic & Mathematical Distance Calculations', () => {
    test('calculateHaversineDistance should compute accurate distance between coordinates', () => {
      // Jakarta Monas to Bundaran HI (~2.4 km)
      const monasLat = -6.175392;
      const monasLng = 106.827153;
      const hiLat = -6.195027;
      const hiLng = 106.823030;

      const distance = opticalPowerSvc.calculateHaversineDistance(monasLat, monasLng, hiLat, hiLng);
      expect(distance).toBeGreaterThan(2000);
      expect(distance).toBeLessThan(2600);
    });

    test('calculateHaversineDistance should return 0 for identical coordinates or invalid inputs', () => {
      expect(opticalPowerSvc.calculateHaversineDistance(-6.2, 106.8, -6.2, 106.8)).toBe(0);
      expect(opticalPowerSvc.calculateHaversineDistance(null, 106.8, -6.2, 106.8)).toBe(0);
      expect(opticalPowerSvc.calculateHaversineDistance('abc', 106.8, -6.2, 106.8)).toBe(0);
    });

    test('calculatePathDistanceMeters should sum all segments of polyline', () => {
      const pathCoords = [
        [-6.175392, 106.827153],
        [-6.185000, 106.825000],
        [-6.195027, 106.823030]
      ];
      const totalDist = opticalPowerSvc.calculatePathDistanceMeters(pathCoords);
      expect(totalDist).toBeGreaterThan(2000);
      expect(opticalPowerSvc.calculatePathDistanceMeters([])).toBe(0);
      expect(opticalPowerSvc.calculatePathDistanceMeters(null)).toBe(0);
    });
  });

  describe('Splitter Loss & Theoretical Link Budget', () => {
    test('getSplitterLoss should return standard insertion loss for optical splitters', () => {
      expect(opticalPowerSvc.getSplitterLoss('1:2')).toBe(3.7);
      expect(opticalPowerSvc.getSplitterLoss('1:4')).toBe(7.2);
      expect(opticalPowerSvc.getSplitterLoss('1:8')).toBe(10.5);
      expect(opticalPowerSvc.getSplitterLoss('1:16')).toBe(13.8);
      expect(opticalPowerSvc.getSplitterLoss('1:32')).toBe(17.1);
      expect(opticalPowerSvc.getSplitterLoss('1:64')).toBe(20.5);
      expect(opticalPowerSvc.getSplitterLoss('none')).toBe(0.0);
      expect(opticalPowerSvc.getSplitterLoss('direct')).toBe(0.0);
      expect(opticalPowerSvc.getSplitterLoss('invalid')).toBe(0.0);
    });

    test('calculateTheoreticalLoss should accurately compute link budget loss & estimated Rx', () => {
      const result = opticalPowerSvc.calculateTheoreticalLoss({
        feederDistanceMeters: 1000,      // 1.0 km -> 0.35 dB
        distributionDistanceMeters: 500,  // 0.5 km -> 0.175 dB
        dropDistanceMeters: 150,          // 0.15 km -> 0.0525 dB
        odcSplitRatio: '1:4',             // 7.2 dB
        odpSplitRatio: '1:8',             // 10.5 dB
        txPowerDbm: 3.5,                  // +3.5 dBm
        fiberAttenuationPerKm: 0.35,
        connectorAndSpliceLoss: 1.5       // 1.5 dB
      });

      // Total distance = 1650m = 1.65 km
      expect(result.totalCableDistanceMeters).toBe(1650);
      // Total cable loss = 1.65 * 0.35 = 0.5775 ~ 0.58 dB
      expect(result.totalCableLossDbm).toBeCloseTo(0.58, 1);
      // Splitter loss = 7.2 + 10.5 = 17.7 dB
      expect(result.totalSplitterLossDbm).toBe(17.7);
      // Total loss = 0.5775 + 17.7 + 1.5 = 19.7775 ~ 19.78 dB
      expect(result.totalLossDbm).toBeCloseTo(19.78, 1);
      // Estimated Rx = 3.5 - 19.78 = -16.28 dBm
      expect(result.estimatedRxPowerDbm).toBeCloseTo(-16.28, 1);
    });
  });

  describe('TR-069 Optical Power Parsing', () => {
    test('parseRxPowerValue should handle negative dBm floats', () => {
      expect(opticalPowerSvc.parseRxPowerValue(-19.45)).toBe(-19.45);
      expect(opticalPowerSvc.parseRxPowerValue('-21.30')).toBe(-21.3);
      expect(opticalPowerSvc.parseRxPowerValue('-23.5 dBm')).toBe(-23.5);
    });

    test('parseRxPowerValue should convert linear 0.1 uW / nanowatt integer to dBm', () => {
      const rawVal = 14125;
      const converted = opticalPowerSvc.parseRxPowerValue(rawVal);
      expect(typeof converted).toBe('number');
      expect(Number.isFinite(converted)).toBe(true);
    });

    test('parseRxPowerValue should return null for empty, 0, or non-numeric values', () => {
      expect(opticalPowerSvc.parseRxPowerValue(null)).toBeNull();
      expect(opticalPowerSvc.parseRxPowerValue(undefined)).toBeNull();
      expect(opticalPowerSvc.parseRxPowerValue('')).toBeNull();
      expect(opticalPowerSvc.parseRxPowerValue('N/A')).toBeNull();
      expect(opticalPowerSvc.parseRxPowerValue(0)).toBeNull();
      expect(opticalPowerSvc.parseRxPowerValue('0')).toBeNull();
    });
  });

  describe('Optical Quality Evaluation & Deviation Diagnosis', () => {
    test('evaluateOpticalQuality should classify optimal signal (-14 to -23 dBm)', () => {
      const evalOptimal = opticalPowerSvc.evaluateOpticalQuality(-18.5, -17.0);
      expect(evalOptimal.statusKey).toBe('optimal');
      expect(evalOptimal.color).toBe('#10b981');
      expect(evalOptimal.badgeClass).toBe('ct-status-optimal');
      expect(evalOptimal.deltaDbm).toBe(1.5);
    });

    test('evaluateOpticalQuality should classify normal signal (-23.01 to -26 dBm)', () => {
      const evalNormal = opticalPowerSvc.evaluateOpticalQuality(-24.5, -23.0);
      expect(evalNormal.statusKey).toBe('normal');
      expect(evalNormal.color).toBe('#f59e0b');
      expect(evalNormal.badgeClass).toBe('ct-status-normal');
    });

    test('evaluateOpticalQuality should classify warning signal (-27.01 to -28.99 dBm)', () => {
      const evalWarning = opticalPowerSvc.evaluateOpticalQuality(-27.8, -22.0);
      expect(evalWarning.statusKey).toBe('warning');
      expect(evalWarning.color).toBe('#f97316');
      expect(evalWarning.badgeClass).toBe('ct-status-warning');
    });

    test('evaluateOpticalQuality should classify critical signal (< -29 dBm)', () => {
      const evalCritical = opticalPowerSvc.evaluateOpticalQuality(-29.5, -20.0);
      expect(evalCritical.statusKey).toBe('critical');
      expect(evalCritical.color).toBe('#ef4444');
      expect(evalCritical.badgeClass).toBe('ct-status-critical');
      expect(evalCritical.recommendation).toContain('Periksa tekukan kabel');
    });

    test('evaluateOpticalQuality should detect signal overload (> -8 dBm)', () => {
      const evalOverload = opticalPowerSvc.evaluateOpticalQuality(-6.5, -16.0);
      expect(evalOverload.statusKey).toBe('overload');
      expect(evalOverload.statusLabel).toBe('Sinyal Overload');
      expect(evalOverload.recommendation).toContain('attenuator');
    });

    test('evaluateOpticalQuality should handle unmonitored / offline state', () => {
      const evalUnknown = opticalPowerSvc.evaluateOpticalQuality(null, -18.0);
      expect(evalUnknown.statusKey).toBe('unmonitored');
      expect(evalUnknown.color).toBe('#94a3b8');
      expect(evalUnknown.deltaDbm).toBeNull();
    });
  });

  describe('Topology Extraction', () => {
    test('getOpticalNetworkTopologyData should return complete network topology', () => {
      const data = opticalPowerSvc.getOpticalNetworkTopologyData();
      expect(data).toBeDefined();
      expect(data.summary).toBeDefined();
      expect(typeof data.summary.totalCustomers).toBe('number');
      expect(data.customers).toBeDefined();
    });
  });

  describe('EJS View Templates Compilation Integrity', () => {
    test('views/admin/map.ejs should compile with opticalData without syntax errors', () => {
      const templatePath = path.join(__dirname, '../views/admin/map.ejs');
      const templateContent = fs.readFileSync(templatePath, 'utf8');

      // Compile template
      const compiled = ejs.compile(templateContent, {
        filename: templatePath,
        client: false
      });
      expect(typeof compiled).toBe('function');

      // Mock data rendering
      const dummyHtml = compiled({
        lang: 'id',
        title: 'Peta Jaringan',
        company: { name: 'MyAdamedia' },
        activePage: 'map',
        sidebarSections: [],
        sidebarBottomNavItems: [],
        customers: [
          { id: 1, name: 'Budi Santoso', lat: -6.2, lng: 106.8, status: 'active', odp_id: 1, package_name: '20 Mbps' }
        ],
        odps: [
          { id: 1, name: 'ODP-A-01', lat: -6.201, lng: 106.801, type: 'ODP', olt_name: 'ZTE-C320', pon_port: '0/1' }
        ],
        olts: [{ id: 1, name: 'ZTE-C320' }],
        opticalData: opticalPowerSvc.getOpticalNetworkTopologyData(),
        msg: null,
        settings: {},
        t: (key, fallback) => fallback || key
      });

      expect(dummyHtml).toContain('opticalCalculatorModal');
      expect(dummyHtml).toContain('Mode Redaman Optik');
      expect(dummyHtml).toContain('opticalLegendCard');
    });

    test('views/tech/map.ejs should compile with opticalData without syntax errors', () => {
      const templatePath = path.join(__dirname, '../views/tech/map.ejs');
      const templateContent = fs.readFileSync(templatePath, 'utf8');

      const compiled = ejs.compile(templateContent, {
        filename: templatePath,
        client: false
      });
      expect(typeof compiled).toBe('function');

      const dummyHtml = compiled({
        lang: 'id',
        title: 'Peta Jaringan Teknisi',
        company: 'MyAdamedia',
        activePage: 'map',
        odps: [
          { id: 1, name: 'ODP-A-01', lat: -6.201, lng: 106.801, type: 'ODP', olt_name: 'ZTE-C320', pon_port: '0/1' }
        ],
        customers: [
          { id: 1, name: 'Budi Santoso', lat: -6.2, lng: 106.8, status: 'active', odp_id: 1, package_name: '20 Mbps' }
        ],
        tickets: [],
        settings: {},
        opticalData: opticalPowerSvc.getOpticalNetworkTopologyData(),
        user: { name: 'Teknisi 1' },
        t: (key, fallback) => fallback || key
      });

      expect(dummyHtml).toContain('opticalCalculatorModal');
      expect(dummyHtml).toContain('toggleOpticalMode');
      expect(dummyHtml).toContain('opticalLegendCard');
    });
  });
});
