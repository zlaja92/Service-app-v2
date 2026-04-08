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
});
