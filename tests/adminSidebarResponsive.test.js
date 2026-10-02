const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

describe('Admin Dashboard Sidebar Minimizable & Responsive Tests', () => {
  const cssPath = path.join(__dirname, '..', 'public', 'css', 'admin.css');
  const sidebarEjsPath = path.join(__dirname, '..', 'views', 'admin', 'partials', 'sidebar.ejs');

  test('admin.css should define variables and responsive transitions for sidebar minimize', () => {
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // 1. Verify CSS variables in :root
    expect(cssContent).toContain('--sw-expanded: 240px');
    expect(cssContent).toContain('--sw-collapsed: 70px');
    expect(cssContent).toContain('--sw: var(--sw-expanded)');

    // 2. Verify html.sidebar-collapsed overrides --sw
    expect(cssContent).toContain('html.sidebar-collapsed');
    expect(cssContent).toContain('--sw: var(--sw-collapsed)');

    // 3. Verify .sidebar and .mw transitions
    expect(cssContent).toMatch(/\.sidebar\s*\{[^}]*transition:[^}]*width/);
    expect(cssContent).toMatch(/\.mw\s*\{[^}]*transition:[^}]*margin-left/);

    // 4. Verify hb-menu display
    expect(cssContent).toContain('.hb-menu');
    expect(cssContent).toContain('display:inline-flex');

    // 5. Verify mobile reset in @media(max-width:992px)
    expect(cssContent).toMatch(/@media\(max-width:\s*992px\)\s*\{[^}]*--sw:\s*0px/);
  });

  test('sidebar.ejs should contain zero-FOUC initialization and minimized UI elements', () => {
    const ejsContent = fs.readFileSync(sidebarEjsPath, 'utf8');

    // 1. Zero-FOUC init script
    expect(ejsContent).toContain('admin_sidebar_collapsed');
    expect(ejsContent).toContain("document.documentElement.classList.add('sidebar-collapsed')");

    // 2. Dual Brand Containers (expanded & collapsed)
    expect(ejsContent).toContain('sb-brand-expanded');
    expect(ejsContent).toContain('sb-brand-collapsed');

    // 3. Toggle buttons
    expect(ejsContent).toContain('sb-desktop-toggle');
    expect(ejsContent).toContain('sb-collapse-btn');
    expect(ejsContent).toContain('sbCollapseBtn');

    // 4. Global Floating Tooltip container
    expect(ejsContent).toContain('sbFloatingTooltip');

    // 5. Function toggleSidebar handles both desktop collapse and mobile drawer
    expect(ejsContent).toContain('function isDesktop()');
    expect(ejsContent).toContain('function toggleSidebar(');
    expect(ejsContent).toContain('updateCollapseButtonUI');
    expect(ejsContent).toContain('showFloatingTooltip');
  });

  test('sidebar.ejs should render without syntax or template errors with mock sections', () => {
    const ejsContent = fs.readFileSync(sidebarEjsPath, 'utf8');

    const mockLocals = {
      activePage: 'dashboard',
      company: 'MyAdamedia Testing',
      settings: {
        company_logo: '/img/logo.png',
        company_header: 'MYADAMEDIA NETWORK'
      },
      sidebarSections: [
        {
          key: 'main',
          labelDefault: 'Utama',
          labelKey: 'admin.nav.main',
          items: [
            {
              key: 'dashboard',
              icon: 'bi bi-grid-fill',
              labelDefault: 'Dashboard',
              labelKey: 'admin.nav.dashboard',
              hrefResolved: '/admin/dashboard',
              activePages: ['dashboard'],
              locked: false
            },
            {
              key: 'billing',
              icon: 'bi bi-receipt',
              labelDefault: 'Manajemen Tagihan',
              labelKey: 'admin.billing.manage_title',
              hrefResolved: '/admin/billing',
              activePages: ['billing'],
              locked: true,
              lockedMessage: 'Menu Tagihan terkunci sementara.'
            }
          ]
        }
      ],
      sidebarBottomNavItems: [
        {
          key: 'dashboard',
          icon: 'bi bi-grid-fill',
          labelDefault: 'Dashboard',
          labelKey: 'admin.nav.dashboard',
          hrefResolved: '/admin/dashboard',
          activePages: ['dashboard']
        }
      ],
      t: (key, fallback) => fallback
    };

    // Render EJS string
    let renderedHtml = '';
    expect(() => {
      renderedHtml = ejs.render(ejsContent, mockLocals, {
        filename: sidebarEjsPath
      });
    }).not.toThrow();

    // Verify rendered output has data-tooltip and title attributes
    expect(renderedHtml).toContain('data-tooltip="Dashboard"');
    expect(renderedHtml).toContain('title="Dashboard"');
    expect(renderedHtml).toContain('data-tooltip="Manajemen Tagihan"');
    expect(renderedHtml).toContain('id="sbCollapseBtn"');
    expect(renderedHtml).toContain('id="sbFloatingTooltip"');
  });
});
