const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const fiberCutSvc = require('../services/fiberCutDetectionService');

describe('Fiber Cut & Mass Outage Auto-Detection Engine Suite', () => {

  test('1. calculateCentroid should accurately calculate mid-point coordinate', () => {
    const coords = [
      [-6.200000, 106.816666],
      [-6.210000, 106.826666]
    ];
    const centroid = fiberCutSvc.calculateCentroid(coords);
    expect(centroid).toBeDefined();
    expect(Array.isArray(centroid)).toBe(true);
    expect(centroid[0]).toBeCloseTo(-6.205, 3);
    expect(centroid[1]).toBeCloseTo(106.821666, 3);

    // Empty coordinates fallback
    expect(fiberCutSvc.calculateCentroid([])).toBeNull();
    expect(fiberCutSvc.calculateCentroid(null)).toBeNull();
  });

  test('2. detectFiberCuts should return standard structure with summary and incidents array', () => {
    const result = fiberCutSvc.detectFiberCuts();
    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
    expect(result.summary).toBeDefined();
    expect(typeof result.summary.totalIncidents).toBe('number');
    expect(typeof result.summary.hasMassOutage).toBe('boolean');
    expect(Array.isArray(result.incidents)).toBe(true);
  });

  test('3. Simulated offline customers should trigger Distribution Cut incident', () => {
    // Ambil topologi saat ini
    const opticalPowerSvc = require('../services/opticalPowerService');
    const topo = opticalPowerSvc.getOpticalNetworkTopologyData();
    const custEntries = Object.entries(topo.customers || {});

    if (custEntries.length >= 2) {
      // Kelompokkan 2 pelanggan dari 1 ODP yang sama
      const firstCust = custEntries[0][1];
      const sameOdpCusts = custEntries.filter(([id, c]) => c.odpId === firstCust.odpId);

      if (sameOdpCusts.length >= 2) {
        const offlineIds = sameOdpCusts.map(([id]) => parseInt(id, 10));
        const res = fiberCutSvc.detectFiberCuts({ offlineCustomerIds: offlineIds });
        
        expect(res.ok).toBe(true);
        const match = res.incidents.find(i => i.targetNodeId === firstCust.odpId);
        expect(match).toBeDefined();
        expect(match.type).toBe('DISTRIBUTION_CUT');
        expect(match.offlineCount).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test('4. createMassOutageTicket should create a ticket or detect duplicate active tickets', () => {
    // Jalankan deteksi
    const det = fiberCutSvc.detectFiberCuts();
    if (det.incidents.length > 0) {
      const inc = det.incidents[0];
      const res = fiberCutSvc.createMassOutageTicket(inc.incidentId, { username: 'JestTester' });
      expect(res).toBeDefined();
      expect(res.ticketId).toBeDefined();
      expect(typeof res.ticketId).toBe('number');

      // Panggilan kedua untuk target yang sama harus mendeteksi existing ticket
      const dup = fiberCutSvc.createMassOutageTicket(inc.incidentId, { username: 'JestTester' });
      expect(dup.alreadyExists).toBe(true);
      expect(dup.created).toBe(false);
    } else {
      // Jika tidak ada insiden aktif di database real, pastikan exception dilempar untuk invalid id
      expect(() => {
        fiberCutSvc.createMassOutageTicket('NON-EXISTENT-INCIDENT-999');
      }).toThrow();
    }
  });

  test('5. views/admin/map.ejs should compile with Fiber Cut elements without syntax errors', () => {
    const templatePath = path.join(__dirname, '../views/admin/map.ejs');
    const templateContent = fs.readFileSync(templatePath, 'utf8');

    // Cek keberadaan elemen kunci di HTML/CSS/JS
    expect(templateContent).toContain('toggle-fiber-cut');
    expect(templateContent).toContain('massOutageBanner');
    expect(templateContent).toContain('massOutageModal');
    expect(templateContent).toContain('pollFiberCutDetection');
    expect(templateContent).toContain('cable-fiber-cut');

    // Kompilasi EJS dengan mock view data
    const mockData = {
      title: 'Peta Jaringan',
      company: 'Test ISP',
      activePage: 'map',
      lang: 'id',
      t: (key, def) => def || key,
      sidebarSections: [],
      sidebarBottomNavItems: [],
      customers: [
        { id: 1, name: 'Budi Test', status: 'active', odp_id: 1, odp_name: 'ODP-01', lat: '-6.201', lng: '106.816' }
      ],
      odps: [
        { id: 1, name: 'ODP-01', type: 'ODP', lat: '-6.200', lng: '106.815', port_count: 8, used_ports: 1 }
      ],
      olts: [
        { id: 1, name: 'OLT-01' }
      ],
      opticalData: {
        summary: { totalMonitored: 1, optimalCount: 1 },
        customers: {}
      },
      msg: null,
      settings: {}
    };

    const compiledFn = ejs.compile(templateContent, { filename: templatePath });
    const renderedHtml = compiledFn(mockData);
    expect(renderedHtml).toContain('id="massOutageBanner"');
    expect(renderedHtml).toContain('id="massOutageModal"');
    expect(renderedHtml).toContain('toggle-fiber-cut');
  });

  test('6. views/tech/map.ejs should compile with Fiber Cut elements without syntax errors', () => {
    const templatePath = path.join(__dirname, '../views/tech/map.ejs');
    const templateContent = fs.readFileSync(templatePath, 'utf8');

    expect(templateContent).toContain('toggle-fiber-cut');
    expect(templateContent).toContain('massOutageBanner');
    expect(templateContent).toContain('massOutageModal');
    expect(templateContent).toContain('pollFiberCutDetection');

    const mockData = {
      title: 'Peta Jaringan Teknisi',
      company: 'Test ISP',
      activePage: 'map',
      lang: 'id',
      t: (key, def) => def || key,
      customers: [
        { id: 1, name: 'Budi Test', status: 'active', odp_id: 1, odp_name: 'ODP-01', lat: '-6.201', lng: '106.816' }
      ],
      odps: [
        { id: 1, name: 'ODP-01', type: 'ODP', lat: '-6.200', lng: '106.815', port_count: 8, used_ports: 1 }
      ],
      tickets: [],
      opticalData: {
        summary: { totalMonitored: 1, optimalCount: 1 },
        customers: {}
      },
      msg: null,
      settings: { office_lat: '-6.2', office_lng: '106.8' }
    };

    const compiledFn = ejs.compile(templateContent, { filename: templatePath });
    const renderedHtml = compiledFn(mockData);
    expect(renderedHtml).toContain('id="massOutageBanner"');
    expect(renderedHtml).toContain('id="massOutageModal"');
  });

});
