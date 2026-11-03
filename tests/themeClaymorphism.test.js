const fs = require('fs');
const path = require('path');

describe('Theme Claymorphism 3D Specification & Integration Tests', () => {
  const cssPath = path.join(__dirname, '..', 'public', 'css', 'admin.css');
  const sidebarPath = path.join(__dirname, '..', 'views', 'admin', 'partials', 'sidebar.ejs');

  test('admin.css harus mendefinisikan ruleset .theme-clay dengan token lengkap', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    // 1. Root variables for .theme-clay
    expect(css).toContain('.theme-clay');
    expect(css).toContain('--bg:       #0e1626');
    expect(css).toContain('--bg2:      #182236');
    expect(css).toContain('--clay-card-shadow:');
    expect(css).toContain('--clay-card-hover-shadow:');
    expect(css).toContain('--clay-input-shadow:');

    // 2. Dual inset & outset shadow checks for Claymorphism
    expect(css).toMatch(/inset 2px 2px 4px rgba\(255, 255, 255,/);
    expect(css).toMatch(/inset -3px -3px 6px rgba\(0, 0, 0,/);

    // 3. Components styled under .theme-clay
    expect(css).toContain('.theme-clay .card');
    expect(css).toContain('.theme-clay .sc');
    expect(css).toContain('.theme-clay .filter-bar');
    expect(css).toContain('.theme-clay .btn-p');
    expect(css).toContain('.theme-clay .btn-s');
    expect(css).toContain('.theme-clay .btn-d');
    expect(css).toContain('.theme-clay .btn-w');
    expect(css).toContain('.theme-clay .btn-g');
    expect(css).toContain('.theme-clay .badge');
    expect(css).toContain('.theme-clay .mo .mb');
    expect(css).toContain('.theme-clay .sidebar');
    expect(css).toContain('.theme-clay .topbar');
  });

  test('sidebar.ejs harus memuat opsi Claymorphism 3D pada theme dropdown', () => {
    const ejs = fs.readFileSync(sidebarPath, 'utf8');

    // Check menu options
    expect(ejs).toContain("setTheme('clay')");
    expect(ejs).toContain('Claymorphism 3D');

    // Check setTheme cleanup removes 'theme-clay'
    expect(ejs).toContain("'theme-clay'");
    expect(ejs).toMatch(/classList\.remove\([^)]*'theme-clay'[^)]*\)/);
  });
});

