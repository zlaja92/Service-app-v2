import { TestBed } from '@angular/core/testing';
import { SessionService } from './session.service';
import { TenantService } from '../tenant/tenant.service';
import { TenantStore } from '../tenant/tenant.store';
import { ConfigService } from '../config/config.service';
import { ConfigStore } from '../config/config.store';
import { ThemeService } from '../theme/theme.service';
import { LogoCacheService } from '../theme/logo-cache.service';
import { TranslationService } from '../i18n/translation.service';
import { LoggerService } from '../logger/logger.service';
import { CLEARABLE_SERVICES } from './clearable';
import { getDefaultConfig, getDefaultTheme } from '../config/config.model';

// Helper: build a fresh module with a custom clearables array
function buildTestBed(
  clearablesValue: Array<{ clear: jasmine.Spy }>,
  overrides: {
    mockTenantService: jasmine.SpyObj<TenantService>;
    mockTenantStore: jasmine.SpyObj<InstanceType<typeof TenantStore>>;
    mockConfigService: jasmine.SpyObj<ConfigService>;
    mockThemeService: jasmine.SpyObj<ThemeService>;
    mockLogoCacheService: jasmine.SpyObj<LogoCacheService>;
    mockTranslationService: jasmine.SpyObj<TranslationService>;
    mockLogger: jasmine.SpyObj<LoggerService>;
  },
): void {
  TestBed.configureTestingModule({
    providers: [
      SessionService,
      ConfigStore,
      { provide: TenantService, useValue: overrides.mockTenantService },
      { provide: TenantStore, useValue: overrides.mockTenantStore },
      { provide: ConfigService, useValue: overrides.mockConfigService },
      { provide: ThemeService, useValue: overrides.mockThemeService },
      { provide: LogoCacheService, useValue: overrides.mockLogoCacheService },
      { provide: TranslationService, useValue: overrides.mockTranslationService },
      { provide: LoggerService, useValue: overrides.mockLogger },
      { provide: CLEARABLE_SERVICES, useValue: clearablesValue },
    ],
  });
}

describe('SessionService', () => {
  let service: SessionService;
  let mockTenantService: jasmine.SpyObj<TenantService>;
  let mockTenantStore: jasmine.SpyObj<InstanceType<typeof TenantStore>>;
  let mockConfigService: jasmine.SpyObj<ConfigService>;
  let configStore: InstanceType<typeof ConfigStore>;
  let mockThemeService: jasmine.SpyObj<ThemeService>;
  let mockLogoCacheService: jasmine.SpyObj<LogoCacheService>;
  let mockTranslationService: jasmine.SpyObj<TranslationService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockClearable: jasmine.SpyObj<{ clear(): void }>;

  const testConfig = {
    ...getDefaultConfig(),
    version: 5,
    theme: { ...getDefaultTheme(), logoUrl: 'https://example.com/logo.png' },
  };

  beforeEach(() => {
    mockTenantService = jasmine.createSpyObj('TenantService', ['resolveFromAuthToken', 'getCurrentTenantId']);
    mockTenantStore = jasmine.createSpyObj('TenantStore', ['clear']);
    mockConfigService = jasmine.createSpyObj('ConfigService', ['loadConfig']);
    mockThemeService = jasmine.createSpyObj('ThemeService', ['applyTheme']);
    mockLogoCacheService = jasmine.createSpyObj('LogoCacheService', ['getLogoDataUrl']);
    mockTranslationService = jasmine.createSpyObj('TranslationService', ['sync']);
    mockLogger = jasmine.createSpyObj('LoggerService', ['debug', 'info', 'warn', 'error']);
    mockClearable = jasmine.createSpyObj('ClearableService', ['clear']);

    mockTenantService.resolveFromAuthToken.and.resolveTo();
    mockTenantService.getCurrentTenantId.and.returnValue('tenant-abc');
    mockConfigService.loadConfig.and.resolveTo(testConfig);
    mockTranslationService.sync.and.resolveTo();
    mockLogoCacheService.getLogoDataUrl.and.resolveTo('data:image/png;base64,abc');

    TestBed.configureTestingModule({
      providers: [
        SessionService,
        ConfigStore,
        { provide: TenantService, useValue: mockTenantService },
        { provide: TenantStore, useValue: mockTenantStore },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: LogoCacheService, useValue: mockLogoCacheService },
        { provide: TranslationService, useValue: mockTranslationService },
        { provide: LoggerService, useValue: mockLogger },
        { provide: CLEARABLE_SERVICES, useValue: [mockClearable] },
      ],
    });

    service = TestBed.inject(SessionService);
    configStore = TestBed.inject(ConfigStore);
  });

  describe('bootstrap()', () => {
    it('should resolve tenant, load config, sync translations, apply theme', async () => {
      await service.bootstrap();

      expect(mockTenantService.resolveFromAuthToken).toHaveBeenCalled();
      expect(mockConfigService.loadConfig).toHaveBeenCalled();
      expect(configStore.config()).toEqual(testConfig);
      expect(mockTranslationService.sync).toHaveBeenCalled();
      expect(mockThemeService.applyTheme).toHaveBeenCalled();
    });

    it('should not call resolveFromAuthToken twice when called concurrently (deduplication)', async () => {
      const p1 = service.bootstrap();
      const p2 = service.bootstrap();

      await Promise.all([p1, p2]);

      expect(mockTenantService.resolveFromAuthToken).toHaveBeenCalledTimes(1);
    });

    it('should clear bootstrapPromise after completion', async () => {
      await service.bootstrap();

      // Second call should start a new bootstrap, not reuse the old promise
      mockTenantService.resolveFromAuthToken.calls.reset();
      await service.bootstrap();

      expect(mockTenantService.resolveFromAuthToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('bootstrap() — no tenantId', () => {
    it('should call loadDefaults instead of loadConfig when no tenantId', async () => {
      mockTenantService.getCurrentTenantId.and.returnValue(null as any);

      await service.bootstrap();

      expect(mockConfigService.loadConfig).not.toHaveBeenCalled();
      expect(configStore.config()).toEqual(getDefaultConfig());
      expect(configStore.isLoaded()).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith('No tenantId resolved, using default config');
    });
  });

  describe('bootstrap() — cacheLogo', () => {
    it('should start logo caching when logoUrl exists (fire-and-forget)', async () => {
      await service.bootstrap();

      expect(mockLogoCacheService.getLogoDataUrl).toHaveBeenCalledWith(
        'https://example.com/logo.png',
        5,
      );
    });

    it('should not cache logo when logoUrl is empty', async () => {
      const configNoLogo = {
        ...testConfig,
        theme: { ...getDefaultTheme(), logoUrl: '' },
      };
      mockConfigService.loadConfig.and.resolveTo(configNoLogo);

      await service.bootstrap();

      expect(mockLogoCacheService.getLogoDataUrl).not.toHaveBeenCalled();
    });

    it('should not crash when logo cache fails (warn-only)', async () => {
      mockLogoCacheService.getLogoDataUrl.and.rejectWith(new Error('CORS'));

      await service.bootstrap();

      // Should complete without throwing
      // Wait for the fire-and-forget promise to settle
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockLogger.warn).toHaveBeenCalledWith('Logo cache failed', jasmine.any(Object));
    });
  });

  describe('teardown()', () => {
    it('should clear all stores', () => {
      service.teardown();

      expect(mockTenantStore.clear).toHaveBeenCalled();
      expect(configStore.config()).toBeNull();
      expect(configStore.isLoaded()).toBe(false);
    });

    it('should clear all clearable services', () => {
      service.teardown();

      expect(mockClearable.clear).toHaveBeenCalled();
    });

    it('should apply default theme', () => {
      service.teardown();

      expect(mockThemeService.applyTheme).toHaveBeenCalledWith(getDefaultTheme());
    });

    it('should log teardown completed', () => {
      service.teardown();

      expect(mockLogger.info).toHaveBeenCalledWith('Session teardown completed');
    });

    it('should nullify bootstrapPromise', async () => {
      // Start bootstrap but don't await
      const p = service.bootstrap();
      service.teardown();

      // After teardown, a new bootstrap() should create a new promise
      mockTenantService.resolveFromAuthToken.calls.reset();

      await p.catch(() => {}); // ignore potential errors from cancelled bootstrap

      const p2 = service.bootstrap();
      expect(p2).not.toBe(p);
    });
  });

  describe('generation counter — teardown during bootstrap', () => {
    it('should skip remaining steps when teardown is called during bootstrap', async () => {
      // Make resolveFromAuthToken slow to allow teardown
      let resolveAuth: () => void;
      mockTenantService.resolveFromAuthToken.and.returnValue(
        new Promise<void>(resolve => { resolveAuth = resolve; }),
      );

      const bootstrapPromise = service.bootstrap();

      // Teardown while bootstrap is waiting for auth
      service.teardown();

      // Now resolve auth — bootstrap should detect generation mismatch
      resolveAuth!();
      await bootstrapPromise;

      // Config should NOT have been loaded (skipped due to gen mismatch)
      expect(mockConfigService.loadConfig).not.toHaveBeenCalled();
    });
  });

  describe('cacheLogo — generation check in callback', () => {
    it('should set logo data URL only when generation matches', async () => {
      await service.bootstrap();

      // Wait for fire-and-forget logo cache to settle
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(configStore.logoDataUrl()).toBe('data:image/png;base64,abc');
    });

    it('should NOT set logo data URL when teardown was called before logo resolves', async () => {
      let resolveLogo: (url: string) => void;
      mockLogoCacheService.getLogoDataUrl.and.returnValue(
        new Promise<string>(resolve => { resolveLogo = resolve; }),
      );

      const bootstrapPromise = service.bootstrap();
      await bootstrapPromise;

      // Teardown before logo resolves
      service.teardown();

      // Now resolve logo — should be ignored due to gen mismatch
      resolveLogo!('data:image/png;base64,should-be-ignored');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(configStore.logoDataUrl()).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // NEW TESTS — batch B1, FAZA G
  // -----------------------------------------------------------------------

  describe('bootstrap() — full sequence ordering', () => {
    it('should execute steps sequentially: resolveFromAuthToken → loadConfig → sync → applyTheme', async () => {
      const callOrder: string[] = [];

      mockTenantService.resolveFromAuthToken.and.callFake(async () => {
        callOrder.push('resolveFromAuthToken');
      });
      mockConfigService.loadConfig.and.callFake(async () => {
        callOrder.push('loadConfig');
        return testConfig;
      });
      mockTranslationService.sync.and.callFake(async () => {
        callOrder.push('sync');
      });
      mockThemeService.applyTheme.and.callFake((_theme: unknown) => {
        callOrder.push('applyTheme');
      });

      await service.bootstrap();

      expect(callOrder).toEqual(['resolveFromAuthToken', 'loadConfig', 'sync', 'applyTheme']);
    });

    it('should call getLogoDataUrl (cacheLogo) after applyTheme during bootstrap', async () => {
      const callOrder: string[] = [];

      mockThemeService.applyTheme.and.callFake((_theme: unknown) => {
        callOrder.push('applyTheme');
      });
      mockLogoCacheService.getLogoDataUrl.and.callFake((_url: string, _v: number) => {
        callOrder.push('getLogoDataUrl');
        return Promise.resolve('data:image/png;base64,abc');
      });

      await service.bootstrap();

      expect(callOrder[0]).toBe('applyTheme');
      expect(callOrder[1]).toBe('getLogoDataUrl');
    });
  });

  describe('bootstrap() — with tenantId fetches config', () => {
    it('should call loadConfig when tenantId is present', async () => {
      mockTenantService.getCurrentTenantId.and.returnValue('tenant-xyz');

      await service.bootstrap();

      expect(mockConfigService.loadConfig).toHaveBeenCalledTimes(1);
    });

    it('should store the config returned by loadConfig in ConfigStore', async () => {
      mockTenantService.getCurrentTenantId.and.returnValue('tenant-xyz');
      mockConfigService.loadConfig.and.resolveTo(testConfig);

      await service.bootstrap();

      expect(configStore.config()).toEqual(testConfig);
      expect(configStore.isLoaded()).toBe(true);
    });
  });

  describe('bootstrap() — without tenantId loads defaults', () => {
    it('should NOT call loadConfig or translationService.sync when tenantId is absent', async () => {
      mockTenantService.getCurrentTenantId.and.returnValue(null as any);

      await service.bootstrap();

      expect(mockConfigService.loadConfig).not.toHaveBeenCalled();
      expect(mockTranslationService.sync).not.toHaveBeenCalled();
    });

    it('should still apply theme after loading defaults', async () => {
      mockTenantService.getCurrentTenantId.and.returnValue(null as any);

      await service.bootstrap();

      expect(mockThemeService.applyTheme).toHaveBeenCalled();
    });
  });

  describe('bootstrap() — promise dedup (concurrent calls share same underlying work)', () => {
    it('should execute the full bootstrap sequence only once for concurrent calls', async () => {
      let resolveAuth!: () => void;
      mockTenantService.resolveFromAuthToken.and.returnValue(
        new Promise<void>(resolve => { resolveAuth = resolve; }),
      );

      const p1 = service.bootstrap();
      const p2 = service.bootstrap();

      resolveAuth();
      await Promise.all([p1, p2]);

      // Only one full sequence was run despite two concurrent calls
      expect(mockTenantService.resolveFromAuthToken).toHaveBeenCalledTimes(1);
      expect(mockConfigService.loadConfig).toHaveBeenCalledTimes(1);
      expect(mockTranslationService.sync).toHaveBeenCalledTimes(1);
      expect(mockThemeService.applyTheme).toHaveBeenCalledTimes(1);
    });

    it('should have the bootstrapPromise set (truthy) while bootstrap is in-flight', () => {
      let resolveAuth!: () => void;
      mockTenantService.resolveFromAuthToken.and.returnValue(
        new Promise<void>(resolve => { resolveAuth = resolve; }),
      );

      service.bootstrap();

      // While in-flight, bootstrapPromise must be set so concurrent calls are deduped
      expect((service as any).bootstrapPromise).toBeTruthy();

      resolveAuth();
    });
  });

  describe('teardown() — individual store clear()', () => {
    it('should call clear() on TenantStore', () => {
      service.teardown();

      expect(mockTenantStore.clear).toHaveBeenCalledTimes(1);
    });

    it('should call clear() on ConfigStore (resets to initial state)', () => {
      // First set some state
      configStore.setConfig(testConfig);
      expect(configStore.isLoaded()).toBe(true);

      service.teardown();

      expect(configStore.config()).toBeNull();
      expect(configStore.isLoaded()).toBe(false);
      expect(configStore.logoDataUrl()).toBeNull();
    });
  });

  describe('teardown() — ALL 11 clearable services', () => {
    it('should call clear() on every one of 11 clearable services', () => {
      const clearableMocks = Array.from({ length: 11 }, (_, i) => ({
        clear: jasmine.createSpy(`clear-${i}`),
      }));

      // Build a fresh TestBed with 11 clearables
      TestBed.resetTestingModule();
      buildTestBed(clearableMocks, {
        mockTenantService,
        mockTenantStore,
        mockConfigService,
        mockThemeService,
        mockLogoCacheService,
        mockTranslationService,
        mockLogger,
      });

      const svc = TestBed.inject(SessionService);
      svc.teardown();

      for (const mock of clearableMocks) {
        expect(mock.clear).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('teardown() — applies default theme', () => {
    it('should pass exactly getDefaultTheme() to applyTheme on teardown', () => {
      mockThemeService.applyTheme.calls.reset();

      service.teardown();

      expect(mockThemeService.applyTheme).toHaveBeenCalledOnceWith(getDefaultTheme());
    });
  });

  describe('teardown() — increments generation counter', () => {
    it('should increment generation so an in-flight bootstrap is invalidated', async () => {
      let resolveAuth!: () => void;
      mockTenantService.resolveFromAuthToken.and.returnValue(
        new Promise<void>(resolve => { resolveAuth = resolve; }),
      );

      const bootstrapPromise = service.bootstrap();

      // Teardown increments generation
      service.teardown();
      resolveAuth();

      await bootstrapPromise;

      // loadConfig must NOT have been called — generation mismatch prevented it
      expect(mockConfigService.loadConfig).not.toHaveBeenCalled();
    });

    it('generation counter is strictly increasing across multiple teardowns', () => {
      const genBefore = (service as any).bootstrapGeneration as number;

      service.teardown();
      const genAfter1 = (service as any).bootstrapGeneration as number;

      service.teardown();
      const genAfter2 = (service as any).bootstrapGeneration as number;

      expect(genAfter1).toBe(genBefore + 1);
      expect(genAfter2).toBe(genBefore + 2);
    });
  });

  describe('generation counter — stale bootstrap does not apply state', () => {
    it('stale bootstrap (older generation) must not set config after teardown', async () => {
      let resolveAuth!: () => void;
      mockTenantService.resolveFromAuthToken.and.returnValue(
        new Promise<void>(resolve => { resolveAuth = resolve; }),
      );

      const bootstrapPromise = service.bootstrap();
      service.teardown(); // increments generation → old bootstrap is now stale

      resolveAuth();
      await bootstrapPromise;

      // Config must remain null — stale bootstrap was aborted before loadConfig
      expect(configStore.config()).toBeNull();
    });

    it('new bootstrap after teardown uses a fresh generation and succeeds', async () => {
      // First bootstrap completes
      await service.bootstrap();
      expect(configStore.config()).toEqual(testConfig);

      // Teardown resets state
      service.teardown();
      expect(configStore.config()).toBeNull();

      // Second bootstrap must succeed with fresh generation
      mockConfigService.loadConfig.and.resolveTo(testConfig);
      await service.bootstrap();

      expect(configStore.config()).toEqual(testConfig);
      expect(configStore.isLoaded()).toBe(true);
    });
  });

  describe('cacheLogo — error handling (does not break bootstrap)', () => {
    it('bootstrap() resolves even when getLogoDataUrl rejects', async () => {
      mockLogoCacheService.getLogoDataUrl.and.rejectWith(new Error('Network timeout'));

      let threw = false;
      try {
        await service.bootstrap();
      } catch {
        threw = true;
      }

      expect(threw).toBe(false);
    });

    it('should log a warning when logo caching fails, not an error', async () => {
      mockLogoCacheService.getLogoDataUrl.and.rejectWith(new Error('CORS error'));

      await service.bootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockLogger.warn).toHaveBeenCalledWith('Logo cache failed', jasmine.any(Object));
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('cacheLogo — skipped when logoUrl is absent', () => {
    it('should not call getLogoDataUrl when config has no logoUrl', async () => {
      const configNoLogo = {
        ...testConfig,
        theme: { ...getDefaultTheme(), logoUrl: '' },
      };
      mockConfigService.loadConfig.and.resolveTo(configNoLogo);

      await service.bootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockLogoCacheService.getLogoDataUrl).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases — full cycle and safe teardown', () => {
    it('(bonus) bootstrap → teardown → bootstrap completes successfully', async () => {
      await service.bootstrap();
      expect(configStore.isLoaded()).toBe(true);

      service.teardown();
      expect(configStore.isLoaded()).toBe(false);

      mockConfigService.loadConfig.and.resolveTo(testConfig);
      await service.bootstrap();

      expect(configStore.isLoaded()).toBe(true);
      expect(configStore.config()).toEqual(testConfig);
      expect(mockThemeService.applyTheme).toHaveBeenCalled();
    });

    it('(bonus) teardown() without prior bootstrap does not throw', () => {
      expect(() => service.teardown()).not.toThrow();
    });

    it('(bonus) consecutive teardowns without bootstrap are safe', () => {
      expect(() => {
        service.teardown();
        service.teardown();
        service.teardown();
      }).not.toThrow();
    });
  });

  // ─── EXPANSION: tenant ID variety matrix ─────────────────────────────────────

  describe('bootstrap() — tenant ID variety matrix', () => {
    const tenantIds = ['ariston-rs', 'ariston-ba', 'viessmann-mk', 'baxi-hr', 'tenant-long-name-12345'];

    tenantIds.forEach(tenantId => {
      it(`should call loadConfig for tenant "${tenantId}"`, async () => {
        mockTenantService.getCurrentTenantId.and.returnValue(tenantId);

        await service.bootstrap();

        expect(mockConfigService.loadConfig).toHaveBeenCalledTimes(1);
        expect(configStore.isLoaded()).toBe(true);
      });
    });
  });

  // ─── EXPANSION: config version variety ───────────────────────────────────────

  describe('bootstrap() — config version variety', () => {
    const versions = [0, 1, 5, 10, 100, 999];

    versions.forEach(v => {
      it(`should store config with version ${v} in ConfigStore`, async () => {
        const versionedConfig = { ...testConfig, version: v };
        mockConfigService.loadConfig.and.resolveTo(versionedConfig);

        await service.bootstrap();

        expect(configStore.config()?.version).toBe(v);
      });
    });
  });

  // ─── EXPANSION: logo URL variety ─────────────────────────────────────────────

  describe('bootstrap() — logo URL variety', () => {
    const logoUrls = [
      'https://firebase.googleapis.com/storage/logo.png',
      'https://cdn.example.com/logos/ariston.svg',
      'https://storage.googleapis.com/tenant-bucket/logo.jpeg',
    ];

    logoUrls.forEach(logoUrl => {
      it(`should pass logoUrl="${logoUrl}" to getLogoDataUrl`, async () => {
        const configWithLogo = { ...testConfig, theme: { ...testConfig.theme, logoUrl } };
        mockConfigService.loadConfig.and.resolveTo(configWithLogo);

        await service.bootstrap();

        expect(mockLogoCacheService.getLogoDataUrl).toHaveBeenCalledWith(logoUrl, testConfig.version);
      });
    });
  });

  // ─── EXPANSION: translation sync called with config ──────────────────────────

  describe('bootstrap() — translation sync is called', () => {
    it('should call translationService.sync exactly once per bootstrap with tenantId', async () => {
      await service.bootstrap();

      expect(mockTranslationService.sync).toHaveBeenCalledTimes(1);
    });

    it('should call translationService.sync with config data available in configStore', async () => {
      let configAtSync: unknown = null;
      mockTranslationService.sync.and.callFake(async () => {
        configAtSync = configStore.config();
      });

      await service.bootstrap();

      expect(configAtSync).not.toBeNull();
    });
  });

  // ─── EXPANSION: teardown clears logoDataUrl ───────────────────────────────────

  describe('teardown() — resets logoDataUrl', () => {
    it('should reset logoDataUrl to null after teardown', async () => {
      await service.bootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Logo was set by bootstrap
      expect(configStore.logoDataUrl()).toBe('data:image/png;base64,abc');

      service.teardown();

      expect(configStore.logoDataUrl()).toBeNull();
    });
  });

  // ─── EXPANSION: multiple clearable services count matrix ─────────────────────

  describe('teardown() — clearable services count matrix', () => {
    [1, 3, 5, 10].forEach(count => {
      it(`should call clear() on each of ${count} clearable services`, () => {
        const clearableMocks = Array.from({ length: count }, (_, i) => ({
          clear: jasmine.createSpy(`clear-${i}`),
        }));

        TestBed.resetTestingModule();
        buildTestBed(clearableMocks, {
          mockTenantService,
          mockTenantStore,
          mockConfigService,
          mockThemeService,
          mockLogoCacheService,
          mockTranslationService,
          mockLogger,
        });

        const svc = TestBed.inject(SessionService);
        svc.teardown();

        for (const mock of clearableMocks) {
          expect(mock.clear).toHaveBeenCalledTimes(1);
        }
      });
    });
  });

  // ─── EXPANSION: bootstrap concurrent triplet ──────────────────────────────────

  describe('bootstrap() — three concurrent calls deduplication', () => {
    it('should run only one bootstrap sequence for 3 concurrent calls', async () => {
      let resolveAuth!: () => void;
      mockTenantService.resolveFromAuthToken.and.returnValue(
        new Promise<void>(resolve => { resolveAuth = resolve; }),
      );

      const p1 = service.bootstrap();
      const p2 = service.bootstrap();
      const p3 = service.bootstrap();

      resolveAuth();
      await Promise.all([p1, p2, p3]);

      expect(mockTenantService.resolveFromAuthToken).toHaveBeenCalledTimes(1);
      expect(mockConfigService.loadConfig).toHaveBeenCalledTimes(1);
    });
  });

  // ─── EXPANSION: applyTheme called with actual theme from config ───────────────

  describe('bootstrap() — applyTheme receives correct theme', () => {
    it('should call applyTheme with the theme from loaded config', async () => {
      const customTheme = { ...getDefaultTheme(), primaryColor: '#FF0000', logoUrl: 'https://example.com/logo.png' };
      const configWithCustomTheme = { ...testConfig, theme: customTheme };
      mockConfigService.loadConfig.and.resolveTo(configWithCustomTheme);

      await service.bootstrap();

      expect(mockThemeService.applyTheme).toHaveBeenCalledWith(customTheme);
    });

    it('should call applyTheme with default theme when no tenantId (defaults loaded)', async () => {
      mockTenantService.getCurrentTenantId.and.returnValue(null as any);
      mockThemeService.applyTheme.calls.reset();

      await service.bootstrap();

      expect(mockThemeService.applyTheme).toHaveBeenCalledWith(getDefaultTheme());
    });
  });
});
