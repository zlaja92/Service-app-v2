import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeatureFlagDirective } from './feature-flag.directive';
import { ConfigStore } from '../../core/config/config.store';
import { createMockConfigStore } from '../../testing/mock-factories';
import { FeatureFlags, getDefaultConfig } from '../../core/config/config.model';

// ─── Host components ──────────────────────────────────────────────────────────

@Component({
  template: `<div *appFeatureFlag="'cart'">Cart Content</div>`,
  imports: [FeatureFlagDirective],
  standalone: true,
})
class SingleFlagHostComponent {}

@Component({
  template: `
    <div *appFeatureFlag="'cart'">Cart Content</div>
    <div *appFeatureFlag="'documentation'">Docs Content</div>
  `,
  imports: [FeatureFlagDirective],
  standalone: true,
})
class MultiFlagHostComponent {}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a spy callFake that reads features from the mockConfigStore.config signal.
 * This ensures Angular effect() can track config signal changes and re-run
 * when the signal mutates.
 */
function makeReactiveCallFake(
  mockConfigStore: ReturnType<typeof createMockConfigStore>
) {
  return (featureName: keyof FeatureFlags) => {
    const features = mockConfigStore.config()?.features;
    return features?.[featureName] ?? false;
  };
}

// ─── Spec ─────────────────────────────────────────────────────────────────────

describe('FeatureFlagDirective', () => {
  let fixture: ComponentFixture<SingleFlagHostComponent>;
  let mockConfigStore: ReturnType<typeof createMockConfigStore>;

  beforeEach(() => {
    mockConfigStore = createMockConfigStore();

    TestBed.configureTestingModule({
      imports: [SingleFlagHostComponent],
      providers: [{ provide: ConfigStore, useValue: mockConfigStore }],
    });
  });

  // ─── TC-01: Renders content when feature is enabled ────────────────────────

  it('should render content when feature is enabled', () => {
    // Set config with cart: true — isFeatureEnabled will read from this signal
    const cfg = getDefaultConfig();
    cfg.features.cart = true;
    mockConfigStore.config.set(cfg);
    mockConfigStore.isFeatureEnabled.and.callFake(makeReactiveCallFake(mockConfigStore));

    fixture = TestBed.createComponent(SingleFlagHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cart Content');
  });

  // ─── TC-02: Does NOT render content when feature is disabled ──────────────

  it('should NOT render content when feature is disabled', () => {
    // Default config has cart: false
    const cfg = getDefaultConfig();
    cfg.features.cart = false;
    mockConfigStore.config.set(cfg);
    mockConfigStore.isFeatureEnabled.and.callFake(makeReactiveCallFake(mockConfigStore));

    fixture = TestBed.createComponent(SingleFlagHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Cart Content');
  });

  // ─── TC-03: Re-renders when feature flag changes from disabled to enabled ──

  it('should render content after feature flag changes from disabled to enabled', () => {
    // Configure reactive spy so Angular effect tracks config signal
    mockConfigStore.isFeatureEnabled.and.callFake(makeReactiveCallFake(mockConfigStore));

    // Start with cart disabled
    const disabledCfg = getDefaultConfig();
    disabledCfg.features.cart = false;
    mockConfigStore.config.set(disabledCfg);

    fixture = TestBed.createComponent(SingleFlagHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Cart Content');

    // Now enable cart — mutate config signal so effect re-runs
    const enabledCfg = getDefaultConfig();
    enabledCfg.features.cart = true;
    mockConfigStore.config.set(enabledCfg);

    // flushEffects() internally calls ApplicationRef.tick() which updates the DOM;
    // do NOT call fixture.detectChanges() afterwards — that causes recursive tick (NG0101)
    TestBed.flushEffects();

    expect(fixture.nativeElement.textContent).toContain('Cart Content');
  });

  // ─── TC-04: Removes content when feature flag changes from enabled to disabled

  it('should remove content after feature flag changes from enabled to disabled', () => {
    // Configure reactive spy
    mockConfigStore.isFeatureEnabled.and.callFake(makeReactiveCallFake(mockConfigStore));

    // Start with cart enabled
    const enabledCfg = getDefaultConfig();
    enabledCfg.features.cart = true;
    mockConfigStore.config.set(enabledCfg);

    fixture = TestBed.createComponent(SingleFlagHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cart Content');

    // Now disable cart — mutate config signal so effect re-runs
    const disabledCfg = getDefaultConfig();
    disabledCfg.features.cart = false;
    mockConfigStore.config.set(disabledCfg);

    // flushEffects() internally calls ApplicationRef.tick() which updates the DOM;
    // do NOT call fixture.detectChanges() afterwards — that causes recursive tick (NG0101)
    TestBed.flushEffects();

    expect(fixture.nativeElement.textContent).not.toContain('Cart Content');
  });

  // ─── TC-05: Non-existent feature key — should not render (default false) ──

  it('should NOT render content for non-existent feature key (default false)', () => {
    // isFeatureEnabled falls back to false for unknown keys
    mockConfigStore.isFeatureEnabled.and.callFake(
      (featureName: string) => {
        const features = mockConfigStore.config()?.features as Record<string, boolean> | undefined;
        return features?.[featureName] ?? false;
      }
    );
    // config has no entry for 'nonExistentKey'
    mockConfigStore.config.set(getDefaultConfig());

    @Component({
      template: `<div *appFeatureFlag="nonExistentKey">Non Existent Content</div>`,
      imports: [FeatureFlagDirective],
      standalone: true,
    })
    class NonExistentKeyHostComponent {
      // Cast via any to simulate missing key edge case
      nonExistentKey = 'nonExistentKey' as any;
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NonExistentKeyHostComponent],
      providers: [{ provide: ConfigStore, useValue: mockConfigStore }],
    });

    const nonExistentFixture = TestBed.createComponent(NonExistentKeyHostComponent);
    nonExistentFixture.detectChanges();

    expect(nonExistentFixture.nativeElement.textContent).not.toContain('Non Existent Content');
  });

  // ─── TC-06: Empty string as feature key — should not render ───────────────

  it('should NOT render content when empty string is used as feature key', () => {
    mockConfigStore.isFeatureEnabled.and.callFake(
      (featureName: string) => {
        const features = mockConfigStore.config()?.features as Record<string, boolean> | undefined;
        return features?.[featureName] ?? false;
      }
    );
    mockConfigStore.config.set(getDefaultConfig());

    @Component({
      template: `<div *appFeatureFlag="emptyKey">Empty Key Content</div>`,
      imports: [FeatureFlagDirective],
      standalone: true,
    })
    class EmptyKeyHostComponent {
      emptyKey = '' as any;
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [EmptyKeyHostComponent],
      providers: [{ provide: ConfigStore, useValue: mockConfigStore }],
    });

    const emptyKeyFixture = TestBed.createComponent(EmptyKeyHostComponent);
    emptyKeyFixture.detectChanges();

    expect(emptyKeyFixture.nativeElement.textContent).not.toContain('Empty Key Content');
  });

  // ─── TC-07: Effect re-runs on signal change ────────────────────────────────

  it('should call isFeatureEnabled again when config signal changes', () => {
    // Use reactive callFake so Angular effect tracks the config signal
    mockConfigStore.isFeatureEnabled.and.callFake(makeReactiveCallFake(mockConfigStore));

    const disabledCfg = getDefaultConfig();
    disabledCfg.features.cart = false;
    mockConfigStore.config.set(disabledCfg);

    fixture = TestBed.createComponent(SingleFlagHostComponent);
    fixture.detectChanges();

    const callCountAfterInit = mockConfigStore.isFeatureEnabled.calls.count();

    // Mutate signal — effect must re-run and call isFeatureEnabled again
    const enabledCfg = getDefaultConfig();
    enabledCfg.features.cart = true;
    mockConfigStore.config.set(enabledCfg);

    // flushEffects() internally calls ApplicationRef.tick() which updates the DOM;
    // do NOT call fixture.detectChanges() afterwards — that causes recursive tick (NG0101)
    TestBed.flushEffects();

    expect(mockConfigStore.isFeatureEnabled.calls.count()).toBeGreaterThan(callCountAfterInit);
    // DOM updated by flushEffects tick — no additional detectChanges needed
    expect(fixture.nativeElement.textContent).toContain('Cart Content');
  });

  // ─── TC-08: Directive destroy — component destruction does not throw ───────

  it('should destroy without errors when host component is destroyed', () => {
    mockConfigStore.isFeatureEnabled.and.callFake(makeReactiveCallFake(mockConfigStore));
    const cfg = getDefaultConfig();
    cfg.features.cart = true;
    mockConfigStore.config.set(cfg);

    fixture = TestBed.createComponent(SingleFlagHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cart Content');

    // Destroying the fixture must not throw — effect cleanup happens automatically
    expect(() => fixture.destroy()).not.toThrow();
  });

  // ─── TC-09: Multiple directive instances on same template work independently

  it('should handle multiple directive instances independently', () => {
    // cart enabled, documentation disabled
    mockConfigStore.isFeatureEnabled.and.callFake(
      (featureName: keyof FeatureFlags) => featureName === 'cart'
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MultiFlagHostComponent],
      providers: [{ provide: ConfigStore, useValue: mockConfigStore }],
    });

    const multiFixture = TestBed.createComponent(MultiFlagHostComponent);
    multiFixture.detectChanges();

    expect(multiFixture.nativeElement.textContent).toContain('Cart Content');
    expect(multiFixture.nativeElement.textContent).not.toContain('Docs Content');
  });

  // ─── TC-10: Directive does not create embedded view when feature is disabled

  it('should not create a DOM element when feature is disabled', () => {
    mockConfigStore.isFeatureEnabled.and.callFake(makeReactiveCallFake(mockConfigStore));
    const cfg = getDefaultConfig();
    cfg.features.cart = false;
    mockConfigStore.config.set(cfg);

    fixture = TestBed.createComponent(SingleFlagHostComponent);
    fixture.detectChanges();

    // No div element should exist in the DOM — structural directive creates nothing
    const contentElement = fixture.nativeElement.querySelector('div');
    expect(contentElement).toBeNull();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: all 10 features × enabled/disabled — individual host components
  // ═══════════════════════════════════════════════════════════════════════════

  describe('FeatureFlagDirective — all 10 features × enabled', () => {
    const allFeatures: (keyof FeatureFlags)[] = [
      'cart', 'documentation', 'deviceCatalog', 'bugReport', 'pdfReports',
      'emailOrders', 'partPhoto', 'cartNote', 'deviceManagement', 'interventionPhotos',
    ];

    allFeatures.forEach(feature => {
      it(`renders content when "${feature}" is enabled`, () => {
        const mockStore = createMockConfigStore();
        const cfg = getDefaultConfig();
        cfg.features[feature] = true;
        mockStore.config.set(cfg);
        mockStore.isFeatureEnabled.and.callFake((f: keyof FeatureFlags) => {
          return mockStore.config()?.features[f] ?? false;
        });

        @Component({
          template: `<span *appFeatureFlag="feature">Feature Content</span>`,
          imports: [FeatureFlagDirective],
          standalone: true,
        })
        class DynamicHostComponent {
          feature = feature;
        }

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
          imports: [DynamicHostComponent],
          providers: [{ provide: ConfigStore, useValue: mockStore }],
        });

        const f = TestBed.createComponent(DynamicHostComponent);
        f.detectChanges();
        expect(f.nativeElement.textContent).toContain('Feature Content');
      });

      it(`does NOT render content when "${feature}" is disabled`, () => {
        const mockStore = createMockConfigStore();
        const cfg = getDefaultConfig();
        cfg.features[feature] = false;
        mockStore.config.set(cfg);
        mockStore.isFeatureEnabled.and.callFake((f: keyof FeatureFlags) => {
          return mockStore.config()?.features[f] ?? false;
        });

        @Component({
          template: `<span *appFeatureFlag="feature">Feature Content</span>`,
          imports: [FeatureFlagDirective],
          standalone: true,
        })
        class DynamicDisabledHostComponent {
          feature = feature;
        }

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
          imports: [DynamicDisabledHostComponent],
          providers: [{ provide: ConfigStore, useValue: mockStore }],
        });

        const f = TestBed.createComponent(DynamicDisabledHostComponent);
        f.detectChanges();
        expect(f.nativeElement.textContent).not.toContain('Feature Content');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: multiple feature flag instances on same component
  // ═══════════════════════════════════════════════════════════════════════════

  describe('FeatureFlagDirective — multiple instances with mixed states', () => {
    it('cart enabled + documentation disabled → only cart renders', () => {
      mockConfigStore.isFeatureEnabled.and.callFake(
        (feature: keyof FeatureFlags) => feature === 'cart'
      );

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [MultiFlagHostComponent],
        providers: [{ provide: ConfigStore, useValue: mockConfigStore }],
      });

      const mf = TestBed.createComponent(MultiFlagHostComponent);
      mf.detectChanges();

      expect(mf.nativeElement.textContent).toContain('Cart Content');
      expect(mf.nativeElement.textContent).not.toContain('Docs Content');
    });

    it('cart disabled + documentation enabled → only docs renders', () => {
      mockConfigStore.isFeatureEnabled.and.callFake(
        (feature: keyof FeatureFlags) => feature === 'documentation'
      );

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [MultiFlagHostComponent],
        providers: [{ provide: ConfigStore, useValue: mockConfigStore }],
      });

      const mf = TestBed.createComponent(MultiFlagHostComponent);
      mf.detectChanges();

      expect(mf.nativeElement.textContent).not.toContain('Cart Content');
      expect(mf.nativeElement.textContent).toContain('Docs Content');
    });

    it('cart disabled + documentation disabled → neither renders', () => {
      mockConfigStore.isFeatureEnabled.and.returnValue(false);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [MultiFlagHostComponent],
        providers: [{ provide: ConfigStore, useValue: mockConfigStore }],
      });

      const mf = TestBed.createComponent(MultiFlagHostComponent);
      mf.detectChanges();

      expect(mf.nativeElement.textContent).not.toContain('Cart Content');
      expect(mf.nativeElement.textContent).not.toContain('Docs Content');
    });

    it('both cart and documentation enabled → both render', () => {
      mockConfigStore.isFeatureEnabled.and.returnValue(true);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [MultiFlagHostComponent],
        providers: [{ provide: ConfigStore, useValue: mockConfigStore }],
      });

      const mf = TestBed.createComponent(MultiFlagHostComponent);
      mf.detectChanges();

      expect(mf.nativeElement.textContent).toContain('Cart Content');
      expect(mf.nativeElement.textContent).toContain('Docs Content');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: isFeatureEnabled called at least once on init
  // ═══════════════════════════════════════════════════════════════════════════

  describe('FeatureFlagDirective — isFeatureEnabled call count', () => {
    it('should call isFeatureEnabled at least once after component creation', () => {
      mockConfigStore.isFeatureEnabled.and.callFake(makeReactiveCallFake(mockConfigStore));
      const cfg = getDefaultConfig();
      cfg.features.cart = true;
      mockConfigStore.config.set(cfg);

      fixture = TestBed.createComponent(SingleFlagHostComponent);
      fixture.detectChanges();

      expect(mockConfigStore.isFeatureEnabled.calls.count()).toBeGreaterThanOrEqual(1);
    });

    it('isFeatureEnabled should be called with "cart" as the argument', () => {
      mockConfigStore.isFeatureEnabled.and.callFake(makeReactiveCallFake(mockConfigStore));
      const cfg = getDefaultConfig();
      cfg.features.cart = false;
      mockConfigStore.config.set(cfg);

      fixture = TestBed.createComponent(SingleFlagHostComponent);
      fixture.detectChanges();

      const allArgs = mockConfigStore.isFeatureEnabled.calls.allArgs();
      const calledWithCart = allArgs.some(args => args[0] === 'cart');
      expect(calledWithCart).toBeTrue();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: reactive config changes — 3 flags toggled sequentially
  // ═══════════════════════════════════════════════════════════════════════════

  describe('FeatureFlagDirective — reactive toggle: enabled → disabled → enabled', () => {
    it('cart: enabled → disabled → enabled — DOM updates correctly', () => {
      mockConfigStore.isFeatureEnabled.and.callFake(makeReactiveCallFake(mockConfigStore));

      const cfg1 = getDefaultConfig();
      cfg1.features.cart = true;
      mockConfigStore.config.set(cfg1);

      fixture = TestBed.createComponent(SingleFlagHostComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Cart Content');

      const cfg2 = getDefaultConfig();
      cfg2.features.cart = false;
      mockConfigStore.config.set(cfg2);
      TestBed.flushEffects();
      expect(fixture.nativeElement.textContent).not.toContain('Cart Content');

      const cfg3 = getDefaultConfig();
      cfg3.features.cart = true;
      mockConfigStore.config.set(cfg3);
      TestBed.flushEffects();
      expect(fixture.nativeElement.textContent).toContain('Cart Content');
    });
  });
});
