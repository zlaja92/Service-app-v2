import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { featureGuard } from './feature.guard';
import { ConfigStore } from './config.store';
import { FeatureFlags, getDefaultConfig } from './config.model';

describe('featureGuard', () => {
  let store: InstanceType<typeof ConfigStore>;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ConfigStore],
    });

    store = TestBed.inject(ConfigStore);
    router = TestBed.inject(Router);
  });

  function executeGuard(featureName: keyof FeatureFlags): boolean | UrlTree {
    return TestBed.runInInjectionContext(() => {
      const guard = featureGuard(featureName);
      return guard({} as any, [] as any);
    }) as boolean | UrlTree;
  }

  it('should return true when feature is enabled', () => {
    store.setConfig(getDefaultConfig()); // deviceCatalog: true by default

    const result = executeGuard('deviceCatalog');
    expect(result).toBe(true);
  });

  it('should return UrlTree to /home when feature is disabled', () => {
    store.setConfig(getDefaultConfig()); // cart: false by default

    const result = executeGuard('cart');
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/home');
  });

  it('should return UrlTree for non-existent feature name (nullish coalescing)', () => {
    store.setConfig(getDefaultConfig());

    const result = executeGuard('nonExistent' as keyof FeatureFlags);
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/home');
  });

  it('should use default features when config is null', () => {
    // Config is null by default — deviceCatalog should be true from defaults
    expect(store.config()).toBeNull();

    const result = executeGuard('deviceCatalog');
    expect(result).toBe(true);
  });

  it('should redirect when config is null and feature default is false', () => {
    expect(store.config()).toBeNull();

    const result = executeGuard('cart');
    expect(result).toBeInstanceOf(UrlTree);
  });

  it('should use default features (not throw) when isLoaded is false and config is null', () => {
    // Simulate the state where loading is in progress — config not yet available
    store.setLoading(true);
    expect(store.isLoaded()).toBe(false);
    expect(store.config()).toBeNull();

    // Guard must still work using default features, not wait for load
    const resultEnabled = executeGuard('deviceCatalog'); // true by default
    expect(resultEnabled).toBe(true);

    const resultDisabled = executeGuard('cart'); // false by default
    expect(resultDisabled).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(resultDisabled as UrlTree)).toBe('/home');
  });

  it('should treat every feature as disabled when config has features all set to false', () => {
    const allDisabledConfig = {
      ...getDefaultConfig(),
      features: {
        cart: false,
        documentation: false,
        deviceCatalog: false,
        bugReport: false,
        pdfReports: false,
        emailOrders: false,
        partPhoto: false,
        cartNote: false,
        deviceManagement: false,
        interventionPhotos: false,
        signatureCapture: false,
      },
    };
    store.setConfig(allDisabledConfig);
    expect(store.isLoaded()).toBe(true);

    const resultDeviceCatalog = executeGuard('deviceCatalog');
    expect(resultDeviceCatalog).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(resultDeviceCatalog as UrlTree)).toBe('/home');

    const resultDeviceMgmt = executeGuard('deviceManagement');
    expect(resultDeviceMgmt).toBeInstanceOf(UrlTree);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: every feature flag × enabled + disabled + null config
  // ═══════════════════════════════════════════════════════════════════════════

  describe('featureGuard — exhaustive matrix: all 10 flags × 3 states', () => {
    const allFeatures: (keyof FeatureFlags)[] = [
      'cart', 'documentation', 'deviceCatalog', 'bugReport', 'pdfReports',
      'emailOrders', 'partPhoto', 'cartNote', 'deviceManagement', 'interventionPhotos',
    ];

    allFeatures.forEach(feature => {
      it(`should return true when "${feature}" is explicitly enabled`, () => {
        const cfg = getDefaultConfig();
        cfg.features[feature] = true;
        store.setConfig(cfg);
        const result = executeGuard(feature);
        expect(result).toBe(true);
      });

      it(`should return UrlTree to /home when "${feature}" is explicitly disabled`, () => {
        const cfg = getDefaultConfig();
        cfg.features[feature] = false;
        store.setConfig(cfg);
        const result = executeGuard(feature);
        expect(result).toBeInstanceOf(UrlTree);
        expect(router.serializeUrl(result as UrlTree)).toBe('/home');
      });
    });

    // null config — use defaults
    const defaultEnabledFeatures: (keyof FeatureFlags)[] = ['deviceCatalog', 'deviceManagement'];
    const defaultDisabledFeatures: (keyof FeatureFlags)[] = [
      'cart', 'documentation', 'bugReport', 'pdfReports',
      'emailOrders', 'partPhoto', 'cartNote', 'interventionPhotos',
    ];

    defaultEnabledFeatures.forEach(feature => {
      it(`null config — "${feature}" defaults to enabled (guard returns true)`, () => {
        expect(store.config()).toBeNull();
        const result = executeGuard(feature);
        expect(result).toBe(true);
      });
    });

    defaultDisabledFeatures.forEach(feature => {
      it(`null config — "${feature}" defaults to disabled (guard returns UrlTree)`, () => {
        expect(store.config()).toBeNull();
        const result = executeGuard(feature);
        expect(result).toBeInstanceOf(UrlTree);
        expect(router.serializeUrl(result as UrlTree)).toBe('/home');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: guard created via featureGuard() factory — is callable function
  // ═══════════════════════════════════════════════════════════════════════════

  describe('featureGuard factory', () => {
    it('should return a function from featureGuard()', () => {
      const guard = TestBed.runInInjectionContext(() => featureGuard('cart'));
      expect(typeof guard).toBe('function');
    });

    it('should be callable multiple times with same feature and return consistent result', () => {
      store.setConfig(getDefaultConfig());
      const result1 = executeGuard('deviceCatalog');
      const result2 = executeGuard('deviceCatalog');
      expect(result1).toBe(result2);
    });

    it('should produce independent guards for different features', () => {
      const cfg = getDefaultConfig();
      cfg.features.cart = true;
      cfg.features.documentation = false;
      store.setConfig(cfg);

      const cartResult = executeGuard('cart');
      const docsResult = executeGuard('documentation');

      expect(cartResult).toBe(true);
      expect(docsResult).toBeInstanceOf(UrlTree);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: guard behavior after setConfig → clear → setConfig
  // ═══════════════════════════════════════════════════════════════════════════

  describe('featureGuard — state transitions', () => {
    it('guard returns true → clear → guard returns false (cart)', () => {
      const cfg = getDefaultConfig();
      cfg.features.cart = true;
      store.setConfig(cfg);

      expect(executeGuard('cart')).toBe(true);

      store.clear();

      // After clear, config is null — defaults apply (cart: false)
      expect(executeGuard('cart')).toBeInstanceOf(UrlTree);
    });

    it('guard returns false → setConfig with enabled → returns true (bugReport)', () => {
      store.setConfig(getDefaultConfig()); // bugReport: false
      expect(executeGuard('bugReport')).toBeInstanceOf(UrlTree);

      const cfg2 = getDefaultConfig();
      cfg2.features.bugReport = true;
      store.setConfig(cfg2);

      expect(executeGuard('bugReport')).toBe(true);
    });

    it('guard returns UrlTree with serialized /home for all disabled features', () => {
      const allDisabled = getDefaultConfig();
      allDisabled.features = {
        cart: false, documentation: false, deviceCatalog: false, bugReport: false,
        pdfReports: false, emailOrders: false, partPhoto: false, cartNote: false,
        deviceManagement: false, interventionPhotos: false, signatureCapture: false,
      };
      store.setConfig(allDisabled);

      const allFeatureKeys: (keyof FeatureFlags)[] = [
        'cart', 'documentation', 'deviceCatalog', 'bugReport', 'pdfReports',
        'emailOrders', 'partPhoto', 'cartNote', 'deviceManagement', 'interventionPhotos',
      ];

      allFeatureKeys.forEach(feature => {
        const result = executeGuard(feature);
        expect(result).toBeInstanceOf(UrlTree);
        expect(router.serializeUrl(result as UrlTree)).toBe('/home');
      });
    });
  });
});
