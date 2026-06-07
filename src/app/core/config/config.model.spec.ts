import { getDefaultConfig, getDefaultFeatures, getDefaultTheme, FeatureFlags } from './config.model';

describe('getDefaultFeatures()', () => {
  it('should return an object with exactly 11 keys', () => {
    const result = getDefaultFeatures();
    expect(Object.keys(result).length).toBe(11);
  });

  it('should return correct default values for all 11 feature flags', () => {
    const result = getDefaultFeatures();

    // TRUE by default (2)
    expect(result.deviceManagement).toBe(true);
    expect(result.deviceCatalog).toBe(true);

    // FALSE by default (9)
    expect(result.cart).toBe(false);
    expect(result.documentation).toBe(false);
    expect(result.bugReport).toBe(false);
    expect(result.pdfReports).toBe(false);
    expect(result.emailOrders).toBe(false);
    expect(result.partPhoto).toBe(false);
    expect(result.cartNote).toBe(false);
    expect(result.interventionPhotos).toBe(false);
    expect(result.signatureCapture).toBe(false);
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

  it('should return business.photoQuality equal to 70', () => {
    const result = getDefaultConfig();
    expect(result.business.photoQuality).toBe(70);
  });

  it('should return business.photoMaxWidth equal to 1280', () => {
    const result = getDefaultConfig();
    expect(result.business.photoMaxWidth).toBe(1280);
  });

  it('should return correct SN serial number defaults: snMfgDateStart=9, snMfgDateLength=5, snMinLength=21, snMaxLength=21', () => {
    const result = getDefaultConfig();
    expect(result.business.snMfgDateStart).toBe(9);
    expect(result.business.snMfgDateLength).toBe(5);
    expect(result.business.snMinLength).toBe(21);
    expect(result.business.snMaxLength).toBe(21);
  });

  it('should return interventionPhotoConfig equal to empty object', () => {
    const result = getDefaultConfig();
    expect(result.interventionPhotoConfig).toBeDefined();
    expect(result.interventionPhotoConfig).toEqual({});
  });

  it('should return interventionFaultOptions equal to empty object', () => {
    const result = getDefaultConfig();
    expect(result.interventionFaultOptions).toBeDefined();
    expect(result.interventionFaultOptions).toEqual({});
  });

  it('should return interventionErrorOptions equal to empty object', () => {
    const result = getDefaultConfig();
    expect(result.interventionErrorOptions).toBeDefined();
    expect(result.interventionErrorOptions).toEqual({});
  });

  it('should return business.orderEmailRecipients equal to empty object', () => {
    const result = getDefaultConfig();
    expect(result.business.orderEmailRecipients).toBeDefined();
    expect(result.business.orderEmailRecipients).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPANSION: Referential independence — deep mutation independence
// ═══════════════════════════════════════════════════════════════════════════

describe('getDefaultFeatures() — deep mutation independence (all 10 flags)', () => {
  const allFeatureKeys: (keyof FeatureFlags)[] = [
    'cart', 'documentation', 'deviceCatalog', 'bugReport', 'pdfReports',
    'emailOrders', 'partPhoto', 'cartNote', 'deviceManagement', 'interventionPhotos',
  ];

  allFeatureKeys.forEach(key => {
    it(`mutating first.${key} does not affect second instance`, () => {
      const first = getDefaultFeatures();
      const second = getDefaultFeatures();
      const originalValue = first[key];

      first[key] = !originalValue as any;

      expect(second[key]).toBe(originalValue);
    });
  });

  it('all 10 calls produce equal but independent objects', () => {
    const instances = Array.from({ length: 10 }, () => getDefaultFeatures());
    for (let i = 1; i < instances.length; i++) {
      expect(instances[i]).toEqual(instances[0]);
      expect(instances[i]).not.toBe(instances[0]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPANSION: getDefaultFeatures() — each flag correct type
// ═══════════════════════════════════════════════════════════════════════════

describe('getDefaultFeatures() — each flag is boolean type', () => {
  const allFeatureKeys: (keyof FeatureFlags)[] = [
    'cart', 'documentation', 'deviceCatalog', 'bugReport', 'pdfReports',
    'emailOrders', 'partPhoto', 'cartNote', 'deviceManagement', 'interventionPhotos',
  ];

  allFeatureKeys.forEach(key => {
    it(`${key} is typeof boolean`, () => {
      expect(typeof getDefaultFeatures()[key]).toBe('boolean');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPANSION: getDefaultConfig — multiple call determinism
// ═══════════════════════════════════════════════════════════════════════════

describe('getDefaultConfig() — multiple calls produce equal structures', () => {
  it('20 calls all produce deeply equal objects', () => {
    const configs = Array.from({ length: 20 }, () => getDefaultConfig());
    for (let i = 1; i < configs.length; i++) {
      expect(configs[i]).toEqual(configs[0]);
    }
  });

  it('mutating one instance does not affect another', () => {
    const first = getDefaultConfig();
    const second = getDefaultConfig();

    first.version = 999;
    first.features.cart = true;
    first.theme.primaryColor = '#AABBCC';
    first.localization.defaultLanguage = 'en';
    first.business.currency = 'USD';

    expect(second.version).toBe(0);
    expect(second.features.cart).toBe(false);
    expect(second.theme.primaryColor).toBe('#B71C1C');
    expect(second.localization.defaultLanguage).toBe('sr');
    expect(second.business.currency).toBe('EUR');
  });

  it('localization.supportedLanguages mutation does not affect next call', () => {
    const first = getDefaultConfig();
    first.localization.supportedLanguages.push('fr');

    const second = getDefaultConfig();
    expect(second.localization.supportedLanguages).toEqual(['sr', 'en', 'mk']);
    expect(second.localization.supportedLanguages.length).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPANSION: getDefaultTheme — field type checks
// ═══════════════════════════════════════════════════════════════════════════

describe('getDefaultTheme() — all fields are strings', () => {
  const fieldNames = ['primaryColor', 'secondaryColor', 'accentColor', 'logoUrl', 'appTitle', 'menuHeaderBackground'];

  fieldNames.forEach(field => {
    it(`${field} is typeof string`, () => {
      const theme = getDefaultTheme() as any;
      expect(typeof theme[field]).toBe('string');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPANSION: getDefaultConfig — business field types
// ═══════════════════════════════════════════════════════════════════════════

describe('getDefaultConfig() — business field types', () => {
  const numericFields = [
    'maxPartsPerIntervention', 'snModelStart', 'snModelLength', 'snMfgDateStart',
    'snMfgDateLength', 'snMinLength', 'snMaxLength', 'photoQuality', 'photoMaxWidth',
  ];

  numericFields.forEach(field => {
    it(`business.${field} is typeof number`, () => {
      const config = getDefaultConfig();
      expect(typeof (config.business as any)[field]).toBe('number');
    });
  });

  const stringFields = ['currency', 'partNote', 'partPhotoFolder'];
  stringFields.forEach(field => {
    it(`business.${field} is typeof string`, () => {
      const config = getDefaultConfig();
      expect(typeof (config.business as any)[field]).toBe('string');
    });
  });

  it('business.interventionCollections is an object', () => {
    const config = getDefaultConfig();
    expect(typeof config.business.interventionCollections).toBe('object');
    expect(config.business.interventionCollections['default']).toBe('interventions');
  });

  it('business.orderEmailRecipients is an object', () => {
    const config = getDefaultConfig();
    expect(typeof config.business.orderEmailRecipients).toBe('object');
  });
});
