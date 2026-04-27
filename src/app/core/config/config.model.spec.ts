import { getDefaultConfig, getDefaultFeatures, getDefaultTheme } from './config.model';

describe('getDefaultFeatures()', () => {
  it('should return an object with exactly 17 keys', () => {
    const result = getDefaultFeatures();
    expect(Object.keys(result).length).toBe(17);
  });

  it('should return correct default values for all 17 feature flags', () => {
    const result = getDefaultFeatures();

    // TRUE by default (2)
    expect(result.deviceManagement).toBe(true);
    expect(result.deviceCatalog).toBe(true);

    // FALSE by default (7)
    expect(result.cart).toBe(false);
    expect(result.documentation).toBe(false);
    expect(result.bugReport).toBe(false);
    expect(result.pdfReports).toBe(false);
    expect(result.emailOrders).toBe(false);
    expect(result.partPhoto).toBe(false);
    expect(result.cartNote).toBe(false);
  });

  it('should return a new object on every call (referential independence)', () => {
    const first = getDefaultFeatures();
    const second = getDefaultFeatures();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);

    first.cart = true;
    expect(second.cart).toBe(false);
  });
});

describe('getDefaultTheme()', () => {
  it('should return expected colors, appTitle, and menuHeaderBackground', () => {
    const result = getDefaultTheme();

    expect(result.primaryColor).toBe('#B71C1C');
    expect(result.secondaryColor).toBe('#1565C0');
    expect(result.accentColor).toBe('#FFC107');
    expect(result.appTitle).toBe('Ariston Service');
    expect(result.menuHeaderBackground).toBe('#B71C1C');
  });

  it('should return logoUrl as an empty string', () => {
    const result = getDefaultTheme();
    expect(result.logoUrl).toBe('');
  });

  it('should return a new object on every call (referential independence)', () => {
    const first = getDefaultTheme();
    const second = getDefaultTheme();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});

describe('getDefaultConfig()', () => {
  it('should return version equal to 0', () => {
    const result = getDefaultConfig();
    expect(result.version).toBe(0);
    expect(typeof result.version).toBe('number');
  });

  it('should contain features, theme, localization, and business sections', () => {
    const result = getDefaultConfig();

    expect(result.features).toBeDefined();
    expect(result.theme).toBeDefined();
    expect(result.localization).toBeDefined();
    expect(result.business).toBeDefined();

    expect(result.features).toEqual(getDefaultFeatures());
    expect(result.theme).toEqual(getDefaultTheme());
  });

  it('should return correct localization defaults', () => {
    const result = getDefaultConfig();

    expect(result.localization.defaultLanguage).toBe('sr');
    expect(result.localization.supportedLanguages).toEqual(['sr', 'en', 'mk']);
  });

  it('should return correct business defaults', () => {
    const result = getDefaultConfig();

    expect(result.business.maxPartsPerIntervention).toBe(4);
    expect(result.business.currency).toBe('EUR');
    expect(result.business.partNote).toBe('');
    expect(result.business.partPhotoFolder).toBe('');
    expect(result.business.snModelStart).toBe(0);
    expect(result.business.snModelLength).toBe(7);
  });

  it('should return a new object on every call (referential independence)', () => {
    const first = getDefaultConfig();
    const second = getDefaultConfig();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
