const { formatCustomerId, getSettings, saveSettings } = require('../config/settingsManager');
const customerSvc = require('../services/customerService');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

describe('Custom ID Pelanggan Feature Tests', () => {
  let originalSettings;

  beforeAll(() => {
    originalSettings = { ...getSettings() };
  });

  afterAll(() => {
    saveSettings(originalSettings);
  });

  describe('1. formatCustomerId Unit Formatting', () => {
    test('should format correctly with default settings (MDE-XXXX)', () => {
      const formatted = formatCustomerId(1, {
        customer_id_prefix: 'MDE',
        customer_id_separator: '-',
        customer_id_padding: 4
      });
      expect(formatted).toBe('MDE-0001');

      expect(formatCustomerId(42, {
        customer_id_prefix: 'MDE',
        customer_id_separator: '-',
        customer_id_padding: 4
      })).toBe('MDE-0042');

      expect(formatCustomerId(9999, {
        customer_id_prefix: 'MDE',
        customer_id_separator: '-',
        customer_id_padding: 4
      })).toBe('MDE-9999');
    });

    test('should format with custom prefix, separator, and padding', () => {
      // Slash separator & 5 digits padding
      expect(formatCustomerId(7, {
        customer_id_prefix: 'PLG',
        customer_id_separator: '/',
        customer_id_padding: 5
      })).toBe('PLG/00007');

      // Underscore separator & 3 digits padding
      expect(formatCustomerId(15, {
        customer_id_prefix: 'CUST',
        customer_id_separator: '_',
        customer_id_padding: 3
      })).toBe('CUST_015');

      // Dot separator
      expect(formatCustomerId(88, {
        customer_id_prefix: 'NET',
        customer_id_separator: '.',
        customer_id_padding: 4
      })).toBe('NET.0088');

      // Empty separator (no separator)
      expect(formatCustomerId(250, {
        customer_id_prefix: 'ID',
        customer_id_separator: '',
        customer_id_padding: 6
      })).toBe('ID000250');
    });

    test('should avoid duplicate separators if prefix already has trailing separator', () => {
      expect(formatCustomerId(1, {
        customer_id_prefix: 'MDE-',
        customer_id_separator: '-',
        customer_id_padding: 4
      })).toBe('MDE-0001');

      expect(formatCustomerId(1, {
        customer_id_prefix: 'CUST/',
        customer_id_separator: '/',
        customer_id_padding: 4
      })).toBe('CUST/0001');
    });

    test('should return only padded numbers when prefix is empty', () => {
      expect(formatCustomerId(5, {
        customer_id_prefix: '',
        customer_id_separator: '-',
        customer_id_padding: 4
      })).toBe('0005');
    });

    test('should handle edge cases (null, empty, non-numeric)', () => {
      expect(formatCustomerId(null)).toBe('');
      expect(formatCustomerId(undefined)).toBe('');
      expect(formatCustomerId('')).toBe('');
      expect(formatCustomerId('ABC')).toBe('ABC');
    });
  });

  describe('2. Customer Search with Custom ID', () => {
    test('getAllCustomers should match custom formatted ID, legacy ID, and raw ID', () => {
      // Save custom settings
      saveSettings({
        customer_id_prefix: 'TEST',
        customer_id_separator: '-',
        customer_id_padding: 4
      });

      const all = customerSvc.getAllCustomers();
      if (all.length > 0) {
        const first = all[0];
        const formattedId = `TEST-${String(first.id).padStart(4, '0')}`;
        const legacyId = `MDE-${String(first.id).padStart(4, '0')}`;

        // Search by new custom ID
        const resCustom = customerSvc.getAllCustomers(formattedId);
        expect(resCustom.some(c => c.id === first.id)).toBe(true);

        // Search by legacy MDE-ID (backward compatibility)
        const resLegacy = customerSvc.getAllCustomers(legacyId);
        expect(resLegacy.some(c => c.id === first.id)).toBe(true);

        // Search by numeric ID
        const resRaw = customerSvc.getAllCustomers(String(first.id));
        expect(resRaw.some(c => c.id === first.id)).toBe(true);
      }
    });

    test('findCustomerByAny should resolve formatted ID', () => {
      const all = customerSvc.getAllCustomers();
      if (all.length > 0) {
        const first = all[0];
        const foundLegacy = customerSvc.findCustomerByAny(`MDE-${String(first.id).padStart(4, '0')}`);
        expect(foundLegacy).not.toBeNull();
        expect(foundLegacy.id).toBe(first.id);

        const foundCustom = customerSvc.findCustomerByAny(`TEST-${String(first.id).padStart(4, '0')}`);
        expect(foundCustom).not.toBeNull();
        expect(foundCustom.id).toBe(first.id);
      }
    });
  });

  describe('3. View Rendering Tests', () => {
    test('views/admin/settings.ejs should render Custom ID Pelanggan section', () => {
      const settingsPath = path.join(__dirname, '../views/admin/settings.ejs');
      const template = fs.readFileSync(settingsPath, 'utf8');

      const dummySettings = {
        company_header: 'My ISP',
        customer_id_prefix: 'WIFI',
        customer_id_separator: '/',
        customer_id_padding: 5
      };

      const html = ejs.render(template, {
        settings: dummySettings,
        company: 'My ISP',
        title: 'Pengaturan',
        activePage: 'settings',
        sidebarSections: [],
        sidebarBottomNavItems: [],
        paymentWebhookUrl: 'http://localhost:3001/customer/payment/callback',
        msg: null,
        t: (k, fb) => fb || k,
        lang: 'id',
        version: '13.0.12'
      }, { filename: settingsPath });

      expect(html).toContain('Format Custom ID Pelanggan');
      expect(html).toContain('name="customer_id_prefix"');
      expect(html).toContain('name="customer_id_separator"');
      expect(html).toContain('name="customer_id_padding"');
      expect(html).toContain('WIFI');
      expect(html).toContain('updateCustomerIdPreview');
    });

    test('views/admin/customers.ejs should render formatted customer IDs', () => {
      const customersPath = path.join(__dirname, '../views/admin/customers.ejs');
      const template = fs.readFileSync(customersPath, 'utf8');

      const dummyCustomers = [
        {
          id: 1,
          name: 'Pelanggan Uji Coba',
          phone: '08123456789',
          genieacs_tag: 'TAG-1',
          package_name: 'Fast 20M',
          speed_down: 20000,
          speed_up: 20000,
          package_price: 200000,
          status: 'active',
          address: 'Jl. Uji No. 1',
          isolate_day: 10,
          unpaid_count: 0,
          unpaid_total: 0
        }
      ];

      const html = ejs.render(template, {
        customers: dummyCustomers,
        stats: { total: 1, active: 1, isolated: 0, inactive: 0 },
        packages: [],
        routers: [],
        olts: [],
        odps: [],
        collectors: [],
        sidebarSections: [],
        sidebarBottomNavItems: [],
        search: '',
        filterStatus: '',
        sort: 'name_asc',
        msg: null,
        company: 'My ISP',
        title: 'Data Pelanggan',
        activePage: 'customers',
        settings: {
          customer_id_prefix: 'NET',
          customer_id_separator: '-',
          customer_id_padding: 4
        },
        formatCustomerId: (id) => `NET-${String(id).padStart(4, '0')}`,
        t: (k, fb) => fb || k,
        lang: 'id',
        version: '13.0.12'
      }, { filename: customersPath });

      expect(html).toContain('NET-0001');
      expect(html).toContain('Pelanggan Uji Coba');
    });
  });
});
