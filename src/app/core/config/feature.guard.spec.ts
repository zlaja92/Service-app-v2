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
});
