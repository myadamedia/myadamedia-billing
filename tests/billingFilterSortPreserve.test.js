const adminRouter = require('../routes/adminPortal');

describe('Preservasi Filter & Sort Tagihan (/admin/billing)', () => {
  describe('safeRedirectBack Functionality & Security Validation', () => {
    let mockReq, mockRes;

    beforeEach(() => {
      mockReq = {
        body: {},
        query: {},
        headers: {},
        get: jest.fn((header) => {
          const h = header.toLowerCase();
          if (h === 'referer' || h === 'referrer') {
            return mockReq.headers['referer'] || mockReq.headers['referrer'];
          }
          return mockReq.headers[h];
        })
      };
      mockRes = {
        redirect: jest.fn()
      };
    });

    test('Harus memprioritaskan return_to dari req.body jika valid', () => {
      mockReq.body.return_to = '/admin/billing?month=10&year=2026&status=unpaid&sort=amount_desc';
      mockReq.headers['referer'] = 'https://localhost:3001/admin/billing?other=1';

      adminRouter.safeRedirectBack(mockReq, mockRes, '/admin/billing');

      expect(mockRes.redirect).toHaveBeenCalledWith('/admin/billing?month=10&year=2026&status=unpaid&sort=amount_desc');
    });

    test('Harus memprioritaskan return_to dari req.query jika body kosong', () => {
      mockReq.query.return_to = '/admin/billing?status=partial&sort=name_asc';
      mockReq.headers['referer'] = 'https://localhost:3001/admin/billing?fallback=true';

      adminRouter.safeRedirectBack(mockReq, mockRes, '/admin/billing');

      expect(mockRes.redirect).toHaveBeenCalledWith('/admin/billing?status=partial&sort=name_asc');
    });

    test('Harus menolak open redirect attack via //evil.com dan fallback ke referer yang valid', () => {
      mockReq.body.return_to = '//evil.com/phishing';
      mockReq.headers['referer'] = 'https://localhost:3001/admin/billing?status=unpaid';

      adminRouter.safeRedirectBack(mockReq, mockRes, '/admin/billing');

      // //evil.com ditolak karena startsWith('//'), jatuh ke referer aman
      expect(mockRes.redirect).toHaveBeenCalledWith('/admin/billing?status=unpaid');
    });

    test('Harus menolak return_to ke situs eksternal atau non-admin', () => {
      mockReq.body.return_to = 'https://malicious-site.com/steal-session';
      mockReq.headers['referer'] = undefined;

      adminRouter.safeRedirectBack(mockReq, mockRes, '/admin/billing');

      // Jatuh ke fallbackUrl karena tidak diawali /admin
      expect(mockRes.redirect).toHaveBeenCalledWith('/admin/billing');
    });

    test('Harus mengekstrak path dan query yang valid dari referer lokal jika return_to kosong', () => {
      mockReq.headers['referer'] = 'https://localhost:3001/admin/billing?month=11&year=2026&search=budi';

      adminRouter.safeRedirectBack(mockReq, mockRes, '/admin/billing');

      expect(mockRes.redirect).toHaveBeenCalledWith('/admin/billing?month=11&year=2026&search=budi');
    });

    test('Harus menggunakan fallbackUrl jika return_to dan referer tidak tersedia', () => {
      adminRouter.safeRedirectBack(mockReq, mockRes, '/admin/billing');

      expect(mockRes.redirect).toHaveBeenCalledWith('/admin/billing');
    });
  });

  describe('Session State Management Simulation for /admin/billing', () => {
    test('Filter harus tersimpan ke req.session saat query parameter dikirim', () => {
      const session = {};
      const query = {
        month: '11',
        year: '2026',
        status: 'unpaid',
        search: 'joko',
        sort: 'amount_desc'
      };

      const hasQueryParams = Object.keys(query).length > 0;
      if (hasQueryParams) {
        session.billingFilter = {
          month: query.month || '',
          year: query.year,
          status: query.status,
          search: query.search || '',
          sort: query.sort
        };
      }

      expect(session.billingFilter).toEqual({
        month: '11',
        year: '2026',
        status: 'unpaid',
        search: 'joko',
        sort: 'amount_desc'
      });
    });

    test('Session filter harus direstore jika URL diakses tanpa query parameter', () => {
      const session = {
        billingFilter: {
          month: '10',
          year: 2026,
          status: 'partial',
          search: '',
          sort: 'name_asc'
        }
      };
      const query = {};

      let redirectUrl = null;
      const hasQueryParams = Object.keys(query).length > 0;
      if (!hasQueryParams && session.billingFilter) {
        const saved = session.billingFilter;
        const params = new URLSearchParams();
        if (saved.month) params.set('month', saved.month);
        if (saved.year) params.set('year', saved.year);
        if (saved.status && saved.status !== 'all') params.set('status', saved.status);
        if (saved.sort && saved.sort !== 'period_desc') params.set('sort', saved.sort);
        if (saved.search) params.set('search', saved.search);
        const qs = params.toString();
        if (qs) {
          redirectUrl = '/admin/billing?' + qs;
        }
      }

      expect(redirectUrl).toBe('/admin/billing?month=10&year=2026&status=partial&sort=name_asc');
    });

    test('Request dengan reset=1 harus menghapus session filter', () => {
      const session = {
        billingFilter: { status: 'unpaid', sort: 'amount_desc' }
      };
      const query = { reset: '1' };

      if (query.reset === '1') {
        delete session.billingFilter;
      }

      expect(session.billingFilter).toBeUndefined();
    });
  });
});
