const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

describe('SSO Portal Gateway Logo & Company Name Rendering', () => {
  const templatePath = path.join(__dirname, '../views/sso.ejs');
  let templateContent = '';

  beforeAll(() => {
    templateContent = fs.readFileSync(templatePath, 'utf8');
  });

  test('should render logo container with uploaded company logo when companyLogo is provided', () => {
    const renderedHtml = ejs.render(templateContent, {
      title: 'Portal Single Sign-On',
      company: 'PT. Solusi Maju Jaya',
      companyLogo: '/uploads/logo/custom-logo.png',
      settings: { company_logo: '/uploads/logo/custom-logo.png' },
      version: '1.0.0',
      lang: 'id'
    });

    expect(renderedHtml).toContain('class="logo-container"');
    expect(renderedHtml).toContain('src="/uploads/logo/custom-logo.png"');
    expect(renderedHtml).toContain('alt="PT. Solusi Maju Jaya"');
    expect(renderedHtml).toContain('PT. Solusi Maju Jaya');
  });

  test('should NOT render logo container and ONLY display company name text when companyLogo is empty', () => {
    const renderedHtml = ejs.render(templateContent, {
      title: 'Portal Single Sign-On',
      company: 'PT.XYZ',
      companyLogo: '',
      settings: { company_logo: '' },
      version: '1.0.0',
      lang: 'id'
    });

    expect(renderedHtml).not.toContain('class="logo-container"');
    expect(renderedHtml).toContain('<h1 class="company-title">PT.XYZ</h1>');
    expect(renderedHtml).toContain('Single Sign-On (SSO) Portal Gateway');
  });

  test('should fallback to settings.company_logo if companyLogo variable is undefined', () => {
    const renderedHtml = ejs.render(templateContent, {
      title: 'Portal Single Sign-On',
      company: 'MyAdamedia Digital',
      companyLogo: undefined,
      settings: { company_logo: '/uploads/logo/from-settings.png' },
      version: '1.0.0',
      lang: 'id'
    });

    expect(renderedHtml).toContain('class="logo-container"');
    expect(renderedHtml).toContain('src="/uploads/logo/from-settings.png"');
    expect(renderedHtml).toContain('<h1 class="company-title">MyAdamedia Digital</h1>');
  });

  test('should NOT render logo container when both companyLogo and settings.company_logo are null or undefined', () => {
    const renderedHtml = ejs.render(templateContent, {
      title: 'Portal Single Sign-On',
      company: 'PT. ISP Nusantara',
      companyLogo: undefined,
      settings: {},
      version: '1.0.0',
      lang: 'id'
    });

    expect(renderedHtml).not.toContain('class="logo-container"');
    expect(renderedHtml).toContain('<h1 class="company-title">PT. ISP Nusantara</h1>');
  });
});
