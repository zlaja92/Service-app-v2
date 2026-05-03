import { TestBed } from '@angular/core/testing';
import { ConfigStore } from './config.store';
import {
  AppConfig,
  FeatureFlags,
  getDefaultConfig,
  getDefaultFeatures,
  getDefaultTheme,
} from './config.model';

describe('ConfigStore', () => {
  let store: InstanceType<typeof ConfigStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ConfigStore],
    });
    store = TestBed.inject(ConfigStore);
  });

  function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
    return {
      version: 5,
      features: { ...getDefaultFeatures(), cart: true },
      theme: { ...getDefaultTheme(), appTitle: 'Test App', primaryColor: '#00FF00' },
      localization: { defaultLanguage: 'en', supportedLanguages: ['en', 'de'] },
      business: {
        maxPartsPerIntervention: 8,
        currency: 'RSD',
        partNote: 'note',
        partPhotoFolder: 'photos',
        snModelStart: 2,
        snModelLength: 10,
        snMfgDateStart: 9,
        snMfgDateLength: 5,
        snMinLength: 21,
        snMaxLength: 21,
        userSearchPageSize: 20,
        userSearchMinLength: 2,
        interventionCollections: { default: 'interventions' },
        photoQuality: 70,
        photoMaxWidth: 1280,
        orderEmailRecipients: {},
      },
      interventionFaultOptions: {},
      interventionErrorOptions: {},
      interventionPhotoConfig: {},
      ...overrides,
    };
  }

  describe('initial state', () => {
    it('should have null config, isLoaded false, isLoading false, error null, logoDataUrl null', () => {
      expect(store.config()).toBeNull();
      expect(store.isLoaded()).toBe(false);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
      expect(store.logoDataUrl()).toBeNull();
    });
  });

  describe('setConfig()', () => {
    it('should set config, mark isLoaded true, isLoading false, error null', () => {
      const testConfig = createTestConfig();
      store.setConfig(testConfig);

      expect(store.config()).toBe(testConfig);
      expect(store.isLoaded()).toBe(true);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
    });

    it('should clear previous error when setConfig is called', () => {
      store.setError('previous error');
      expect(store.error()).toBe('previous error');

      store.setConfig(createTestConfig());
      expect(store.error()).toBeNull();
    });
  });

  describe('loadDefaults()', () => {
    it('should set config to getDefaultConfig() and isLoaded to true', () => {
      store.loadDefaults();

      expect(store.config()).toEqual(getDefaultConfig());
      expect(store.isLoaded()).toBe(true);
    });

    it('should NOT reset isLoading (leaves it unchanged)', () => {
      store.setLoading(true);
      store.loadDefaults();

      expect(store.isLoading()).toBe(true);
    });
  });

  describe('setLoading()', () => {
    it('should set isLoading to true', () => {
      store.setLoading(true);
      expect(store.isLoading()).toBe(true);
    });

    it('should set isLoading to false', () => {
      store.setLoading(true);
      store.setLoading(false);
      expect(store.isLoading()).toBe(false);
    });

    it('should not affect other state properties', () => {
      store.setLoading(true);

      expect(store.config()).toBeNull();
      expect(store.isLoaded()).toBe(false);
      expect(store.error()).toBeNull();
    });
  });

  describe('setError()', () => {
    it('should set error message and reset isLoading to false', () => {
      store.setLoading(true);
      store.setError('Failed to load config');

      expect(store.error()).toBe('Failed to load config');
      expect(store.isLoading()).toBe(false);
    });
  });

  describe('clear()', () => {
    it('should reset all state to initial values', () => {
      store.setConfig(createTestConfig());
      store.setLogoDataUrl('data:image/png;base64,abc');

      store.clear();

      expect(store.config()).toBeNull();
      expect(store.logoDataUrl()).toBeNull();
      expect(store.isLoaded()).toBe(false);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
    });
  });

  describe('setLogoDataUrl()', () => {
    it('should set and then clear logoDataUrl', () => {
      store.setLogoDataUrl('data:image/png;base64,iVBOR');
      expect(store.logoDataUrl()).toBe('data:image/png;base64,iVBOR');

      store.setLogoDataUrl(null);
      expect(store.logoDataUrl()).toBeNull();
    });
  });

  describe('computed features', () => {
    it('should return getDefaultFeatures() when config is null', () => {
      expect(store.config()).toBeNull();
      expect(store.features()).toEqual(getDefaultFeatures());
    });

    it('should return config.features when config is set', () => {
      const testConfig = createTestConfig();
      store.setConfig(testConfig);

      expect(store.features()).toBe(testConfig.features);
      expect(store.features().cart).toBe(true);
    });
  });

  describe('computed theme', () => {
    it('should return getDefaultTheme() when config is null', () => {
      expect(store.theme()).toEqual(getDefaultTheme());
    });

    it('should return config.theme when config is set', () => {
      const testConfig = createTestConfig();
      store.setConfig(testConfig);

      expect(store.theme()).toBe(testConfig.theme);
      expect(store.theme().primaryColor).toBe('#00FF00');
    });
  });

  describe('computed localization', () => {
    it('should return undefined when config is null (no fallback)', () => {
      expect(store.config()).toBeNull();
      expect(store.localization()).toBeUndefined();
    });

    it('should return config.localization when config is set', () => {
      const testConfig = createTestConfig();
      store.setConfig(testConfig);

      expect(store.localization()).toBeDefined();
      expect(store.localization()!.defaultLanguage).toBe('en');
      expect(store.localization()!.supportedLanguages).toEqual(['en', 'de']);
    });
  });

  describe('computed business', () => {
    it('should return undefined when config is null (no fallback)', () => {
      expect(store.config()).toBeNull();
      expect(store.business()).toBeUndefined();
    });

    it('should return config.business when config is set', () => {
      const testConfig = createTestConfig();
      store.setConfig(testConfig);

      expect(store.business()).toBeDefined();
      expect(store.business()!.maxPartsPerIntervention).toBe(8);
      expect(store.business()!.currency).toBe('RSD');
    });
  });

  describe('computed appTitle', () => {
    it('should return "Ariston Service" when config is null', () => {
      expect(store.appTitle()).toBe('Ariston Service');
    });

    it('should return config theme appTitle when config is set', () => {
      store.setConfig(createTestConfig());
      expect(store.appTitle()).toBe('Test App');
    });
  });

  describe('isFeatureEnabled()', () => {
    it('should return true for enabled feature (deviceCatalog)', () => {
      store.setConfig(getDefaultConfig());
      expect(store.isFeatureEnabled('deviceCatalog')).toBe(true);
    });

    it('should return false for disabled feature (cart)', () => {
      store.setConfig(getDefaultConfig());
      expect(store.isFeatureEnabled('cart')).toBe(false);
    });

    it('should return false for non-existent feature name (nullish coalescing)', () => {
      store.setConfig(getDefaultConfig());
      expect(store.isFeatureEnabled('nonExistent' as keyof FeatureFlags)).toBe(false);
    });

    it('should use default features when config is null', () => {
      expect(store.config()).toBeNull();
      expect(store.isFeatureEnabled('deviceManagement')).toBe(true);
      expect(store.isFeatureEnabled('cart')).toBe(false);
    });
  });

  describe('setConfig() with interventionPhotoConfig', () => {
    it('should propagate interventionPhotoConfig signal correctly after setConfig', () => {
      const photoConfig = {
        gasBoiler: {
          before: { maxPhotos: 3, requiredPhotos: 1, requireSparePartPhotos: false, description: 'Before' },
        },
      };
      const testConfig = createTestConfig({ interventionPhotoConfig: photoConfig });
      store.setConfig(testConfig);

      expect(store.config()).toBeDefined();
      expect(store.config()!.interventionPhotoConfig).toBe(photoConfig);
      expect(store.config()!.interventionPhotoConfig['gasBoiler']['before'].maxPhotos).toBe(3);
    });

    it('should propagate interventionFaultOptions signal correctly after setConfig', () => {
      const faultOptions = { gasBoiler: ['E01', 'E02', 'E03'] };
      const testConfig = createTestConfig({ interventionFaultOptions: faultOptions });
      store.setConfig(testConfig);

      expect(store.config()!.interventionFaultOptions).toBe(faultOptions);
      expect(store.config()!.interventionFaultOptions['gasBoiler']).toEqual(['E01', 'E02', 'E03']);
    });

    it('should propagate interventionErrorOptions signal correctly after setConfig', () => {
      const errorOptions = { heatPump: ['F10', 'F11'] };
      const testConfig = createTestConfig({ interventionErrorOptions: errorOptions });
      store.setConfig(testConfig);

      expect(store.config()!.interventionErrorOptions).toBe(errorOptions);
      expect(store.config()!.interventionErrorOptions['heatPump']).toEqual(['F10', 'F11']);
    });
  });

  describe('computed business — extended fields', () => {
    it('should expose photoQuality via business() computed signal', () => {
      const testConfig = createTestConfig();
      store.setConfig(testConfig);

      expect(store.business()).toBeDefined();
      expect(store.business()!.photoQuality).toBe(70);
    });

    it('should expose photoMaxWidth via business() computed signal', () => {
      const testConfig = createTestConfig();
      store.setConfig(testConfig);

      expect(store.business()!.photoMaxWidth).toBe(1280);
    });

    it('should expose orderEmailRecipients via business() computed signal', () => {
      const recipients = { primary: 'service@example.com' };
      const testConfig = createTestConfig({
        business: {
          ...createTestConfig().business,
          orderEmailRecipients: recipients,
        },
      });
      store.setConfig(testConfig);

      expect(store.business()!.orderEmailRecipients).toEqual(recipients);
    });
  });

  describe('state transitions', () => {
    it('should recover state after clear() followed by setConfig()', () => {
      store.setConfig(createTestConfig());
      store.clear();
      expect(store.config()).toBeNull();

      const newConfig = createTestConfig({ version: 10 });
      store.setConfig(newConfig);

      expect(store.config()!.version).toBe(10);
      expect(store.isLoaded()).toBe(true);
      expect(store.error()).toBeNull();
    });

    it('should use default features after setConfig then clear then isFeatureEnabled', () => {
      store.setConfig(createTestConfig()); // cart: true
      expect(store.isFeatureEnabled('cart')).toBe(true);

      store.clear();

      expect(store.isFeatureEnabled('cart')).toBe(false);
      expect(store.isFeatureEnabled('deviceManagement')).toBe(true);
      expect(store.isFeatureEnabled('deviceCatalog')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: isFeatureEnabled — all 10 feature flags × enabled + disabled
  // ═══════════════════════════════════════════════════════════════════════════

  describe('isFeatureEnabled() — exhaustive matrix for all 10 flags × enabled/disabled', () => {
    const allFeatures: (keyof FeatureFlags)[] = [
      'cart', 'documentation', 'deviceCatalog', 'bugReport', 'pdfReports',
      'emailOrders', 'partPhoto', 'cartNote', 'deviceManagement', 'interventionPhotos',
    ];

    allFeatures.forEach(feature => {
      it(`should return true for ${feature} when explicitly set to true`, () => {
        const cfg = getDefaultConfig();
        cfg.features[feature] = true;
        store.setConfig(cfg);
        expect(store.isFeatureEnabled(feature)).toBe(true);
      });

      it(`should return false for ${feature} when explicitly set to false`, () => {
        const cfg = getDefaultConfig();
        cfg.features[feature] = false;
        store.setConfig(cfg);
        expect(store.isFeatureEnabled(feature)).toBe(false);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: isFeatureEnabled — 20 random multi-flag combination tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('isFeatureEnabled() — 20 multi-flag combination scenarios', () => {
    const scenarios: Array<{ name: string; features: Partial<FeatureFlags>; check: keyof FeatureFlags; expected: boolean }> = [
      { name: 'all disabled', features: { cart: false, documentation: false, deviceCatalog: false, bugReport: false, pdfReports: false, emailOrders: false, partPhoto: false, cartNote: false, deviceManagement: false, interventionPhotos: false }, check: 'cart', expected: false },
      { name: 'all enabled', features: { cart: true, documentation: true, deviceCatalog: true, bugReport: true, pdfReports: true, emailOrders: true, partPhoto: true, cartNote: true, deviceManagement: true, interventionPhotos: true }, check: 'bugReport', expected: true },
      { name: 'cart+pdfReports+emailOrders', features: { cart: true, pdfReports: true, emailOrders: true }, check: 'pdfReports', expected: true },
      { name: 'deviceCatalog disabled', features: { deviceCatalog: false }, check: 'deviceCatalog', expected: false },
      { name: 'deviceManagement disabled', features: { deviceManagement: false }, check: 'deviceManagement', expected: false },
      { name: 'partPhoto only', features: { partPhoto: true }, check: 'partPhoto', expected: true },
      { name: 'cartNote only', features: { cartNote: true }, check: 'cartNote', expected: true },
      { name: 'interventionPhotos only', features: { interventionPhotos: true }, check: 'interventionPhotos', expected: true },
      { name: 'documentation only', features: { documentation: true }, check: 'documentation', expected: true },
      { name: 'emailOrders only', features: { emailOrders: true }, check: 'emailOrders', expected: true },
      { name: 'bugReport only', features: { bugReport: true }, check: 'bugReport', expected: true },
      { name: 'cart+cartNote', features: { cart: true, cartNote: true }, check: 'cartNote', expected: true },
      { name: 'cart+cartNote check cart', features: { cart: true, cartNote: true }, check: 'cart', expected: true },
      { name: 'partPhoto+pdfReports', features: { partPhoto: true, pdfReports: true }, check: 'partPhoto', expected: true },
      { name: 'deviceCatalog+deviceManagement both enabled', features: { deviceCatalog: true, deviceManagement: true }, check: 'deviceCatalog', expected: true },
      { name: 'deviceCatalog+deviceManagement check dm', features: { deviceCatalog: true, deviceManagement: true }, check: 'deviceManagement', expected: true },
      { name: 'interventionPhotos+partPhoto', features: { interventionPhotos: true, partPhoto: true }, check: 'interventionPhotos', expected: true },
      { name: 'emailOrders+cart disabled', features: { emailOrders: false, cart: false }, check: 'emailOrders', expected: false },
      { name: 'cart enabled docs disabled', features: { cart: true, documentation: false }, check: 'documentation', expected: false },
      { name: 'bugReport+emailOrders enabled', features: { bugReport: true, emailOrders: true }, check: 'bugReport', expected: true },
    ];

    scenarios.forEach(({ name, features, check, expected }) => {
      it(`scenario "${name}" — isFeatureEnabled("${check}") should be ${expected}`, () => {
        const cfg = getDefaultConfig();
        cfg.features = { ...getDefaultFeatures(), ...features };
        store.setConfig(cfg);
        expect(store.isFeatureEnabled(check)).toBe(expected);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: setConfig multiple times — last write wins
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setConfig() — multiple sequential calls (last write wins)', () => {
    it('should reflect version from last setConfig call', () => {
      store.setConfig(createTestConfig({ version: 1 }));
      store.setConfig(createTestConfig({ version: 2 }));
      store.setConfig(createTestConfig({ version: 3 }));
      expect(store.config()!.version).toBe(3);
    });

    it('should reflect appTitle from last setConfig call', () => {
      store.setConfig(createTestConfig({ theme: { ...getDefaultTheme(), appTitle: 'First' } }));
      store.setConfig(createTestConfig({ theme: { ...getDefaultTheme(), appTitle: 'Second' } }));
      expect(store.appTitle()).toBe('Second');
    });

    it('should maintain isLoaded true after 5 sequential setConfig calls', () => {
      for (let i = 0; i < 5; i++) {
        store.setConfig(createTestConfig({ version: i }));
      }
      expect(store.isLoaded()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: setError messages variety
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setError() — various error message types', () => {
    const errorMessages = [
      'Network error',
      'Firestore unavailable',
      'Permission denied',
      'Config document not found',
      '',
      'Very long error message: ' + 'x'.repeat(500),
      'Error with special chars: <>&"\'',
    ];

    errorMessages.forEach(msg => {
      it(`should store error message: "${msg.slice(0, 50)}..."`, () => {
        store.setError(msg);
        expect(store.error()).toBe(msg);
        expect(store.isLoading()).toBe(false);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: logoDataUrl various values
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setLogoDataUrl() — various URL types', () => {
    const logoUrls = [
      'data:image/png;base64,abc123',
      'data:image/jpeg;base64,xyz789',
      'data:image/svg+xml;base64,svgdata',
      'https://example.com/logo.png',
      '',
      null,
    ];

    logoUrls.forEach(url => {
      it(`should store logoDataUrl = "${url}"`, () => {
        store.setLogoDataUrl(url as string | null);
        expect(store.logoDataUrl()).toBe(url);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: state cycle tests (loading → loaded → error → clear)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('state lifecycle cycles', () => {
    it('should handle setLoading → setError → setConfig cycle', () => {
      store.setLoading(true);
      expect(store.isLoading()).toBe(true);

      store.setError('Failed');
      expect(store.error()).toBe('Failed');
      expect(store.isLoading()).toBe(false);

      store.setConfig(createTestConfig());
      expect(store.isLoaded()).toBe(true);
      expect(store.error()).toBeNull();
    });

    it('should handle setConfig → clear → loadDefaults cycle', () => {
      store.setConfig(createTestConfig({ version: 10 }));
      expect(store.config()!.version).toBe(10);

      store.clear();
      expect(store.config()).toBeNull();
      expect(store.isLoaded()).toBe(false);

      store.loadDefaults();
      expect(store.isLoaded()).toBe(true);
      expect(store.config()).toEqual(getDefaultConfig());
    });

    it('should handle 3 complete cycles of setConfig → clear', () => {
      for (let i = 0; i < 3; i++) {
        store.setConfig(createTestConfig({ version: i + 1 }));
        expect(store.isLoaded()).toBe(true);
        store.clear();
        expect(store.isLoaded()).toBe(false);
        expect(store.config()).toBeNull();
      }
    });

    it('should handle setLoading → loadDefaults (isLoading stays true after loadDefaults)', () => {
      store.setLoading(true);
      store.loadDefaults();
      // loadDefaults does NOT reset isLoading
      expect(store.isLoading()).toBe(true);
      expect(store.isLoaded()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: computed signals update reactively
  // ═══════════════════════════════════════════════════════════════════════════

  describe('computed signals — reactive update on setConfig', () => {
    it('features() updates after setConfig with new features', () => {
      const cfg1 = getDefaultConfig();
      cfg1.features.cart = false;
      store.setConfig(cfg1);
      expect(store.isFeatureEnabled('cart')).toBe(false);

      const cfg2 = getDefaultConfig();
      cfg2.features.cart = true;
      store.setConfig(cfg2);
      expect(store.isFeatureEnabled('cart')).toBe(true);
    });

    it('appTitle() updates reactively when config changes', () => {
      store.setConfig(createTestConfig({ theme: { ...getDefaultTheme(), appTitle: 'First' } }));
      expect(store.appTitle()).toBe('First');

      store.setConfig(createTestConfig({ theme: { ...getDefaultTheme(), appTitle: 'Second' } }));
      expect(store.appTitle()).toBe('Second');
    });

    it('features() reverts to defaults after clear()', () => {
      const cfg = getDefaultConfig();
      cfg.features.cart = true;
      cfg.features.bugReport = true;
      store.setConfig(cfg);

      expect(store.isFeatureEnabled('cart')).toBe(true);
      expect(store.isFeatureEnabled('bugReport')).toBe(true);

      store.clear();

      expect(store.isFeatureEnabled('cart')).toBe(false);
      expect(store.isFeatureEnabled('bugReport')).toBe(false);
      expect(store.isFeatureEnabled('deviceCatalog')).toBe(true); // default true
    });
  });
});
