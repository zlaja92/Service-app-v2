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
        userSearchPageSize: 20,
        userSearchMinLength: 2,
        interventionCollections: { default: 'interventions' },
      },
      interventionFaultOptions: {},
      interventionErrorOptions: {},
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
});
