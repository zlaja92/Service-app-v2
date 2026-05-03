import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { LogoCacheService } from './logo-cache.service';
import { TenantService } from '../tenant/tenant.service';
import { LoggerService } from '../logger/logger.service';
import { PreferencesService } from '../storage/preferences.service';
import { CapacitorHttpService } from '../http/capacitor-http.service';

describe('LogoCacheService', () => {
  let service: LogoCacheService;
  let mockTenant: jasmine.SpyObj<TenantService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;
  let mockCapacitorHttp: jasmine.SpyObj<CapacitorHttpService>;

  beforeEach(() => {
    mockTenant = jasmine.createSpyObj('TenantService', ['getCurrentTenantId']);
    mockLogger = jasmine.createSpyObj('LoggerService', ['debug', 'info', 'warn', 'error']);
    mockPreferences = jasmine.createSpyObj('PreferencesService', ['get', 'set', 'remove', 'clear']);
    mockCapacitorHttp = jasmine.createSpyObj('CapacitorHttpService', ['get']);

    mockTenant.getCurrentTenantId.and.returnValue('tenant-abc');
    mockPreferences.get.and.resolveTo(null);
    mockPreferences.set.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        LogoCacheService,
        { provide: TenantService, useValue: mockTenant },
        { provide: LoggerService, useValue: mockLogger },
        { provide: PreferencesService, useValue: mockPreferences },
        { provide: CapacitorHttpService, useValue: mockCapacitorHttp },
      ],
    });

    service = TestBed.inject(LogoCacheService);
  });

  describe('getLogoDataUrl — empty URL', () => {
    it('should return null when logoUrl is empty', async () => {
      const result = await service.getLogoDataUrl('', 1);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('No logo URL provided, skipping logo cache');
    });
  });

  describe('getLogoDataUrl — cache hit', () => {
    it('should return cached dataUrl when version and URL match', async () => {
      const cached = { configVersion: 5, logoUrl: 'https://example.com/logo.png', dataUrl: 'data:image/png;base64,cached123' };
      mockPreferences.get.and.resolveTo(JSON.stringify(cached));

      const result = await service.getLogoDataUrl('https://example.com/logo.png', 5);

      expect(result).toBe('data:image/png;base64,cached123');
      expect(mockLogger.debug).toHaveBeenCalledWith('Using cached logo', { configVersion: 5 });
    });
  });

  describe('getLogoDataUrl — cache miss (version mismatch)', () => {
    it('should download logo when config version differs', async () => {
      const cached = { configVersion: 3, logoUrl: 'https://example.com/logo.png', dataUrl: 'data:image/png;base64,old' };
      mockPreferences.get.and.resolveTo(JSON.stringify(cached));
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);

      const mockBlob = new Blob(['test'], { type: 'image/png' });
      spyOn(window, 'fetch').and.resolveTo(new Response(mockBlob, { status: 200 }));

      const result = await service.getLogoDataUrl('https://example.com/logo.png', 5);

      expect(result).toBeTruthy();
      expect(result).toContain('data:');
      expect(mockLogger.info).toHaveBeenCalledWith('Logo cached successfully', { configVersion: 5 });
      expect(mockPreferences.set).toHaveBeenCalled();
    });
  });

  describe('getLogoDataUrl — download failure fallbacks', () => {
    it('should return cached dataUrl as fallback when download fails and cache exists', async () => {
      const cached = { configVersion: 3, logoUrl: 'https://example.com/logo.png', dataUrl: 'data:image/png;base64,fallback' };
      mockPreferences.get.and.resolveTo(JSON.stringify(cached));
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
      spyOn(window, 'fetch').and.rejectWith(new Error('Network error'));

      const result = await service.getLogoDataUrl('https://example.com/logo.png', 5);

      expect(result).toBe('data:image/png;base64,fallback');
      expect(mockLogger.info).toHaveBeenCalledWith('Using previously cached logo as fallback');
    });

    it('should return direct URL on web when download fails and no cache', async () => {
      mockPreferences.get.and.resolveTo(null);
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
      spyOn(window, 'fetch').and.rejectWith(new Error('CORS'));

      const result = await service.getLogoDataUrl('https://example.com/logo.png', 5);

      expect(result).toBe('https://example.com/logo.png');
      expect(mockLogger.info).toHaveBeenCalledWith('Web platform: falling back to direct URL');
    });

    it('should return null on native when download fails and no cache', async () => {
      mockPreferences.get.and.resolveTo(null);
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
      mockCapacitorHttp.get.and.rejectWith(new Error('Network error'));

      const result = await service.getLogoDataUrl('https://example.com/logo.png', 5);

      expect(result).toBeNull();
    });
  });

  describe('getLogoDataUrl — native platform download', () => {
    it('should use CapacitorHttp on native platform', async () => {
      mockPreferences.get.and.resolveTo(null);
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
      mockCapacitorHttp.get.and.resolveTo({
        data: 'base64data',
        headers: { 'Content-Type': 'image/jpeg' },
        status: 200,
        url: '',
      } as any);

      const result = await service.getLogoDataUrl('https://example.com/logo.jpg', 1);

      expect(result).toBe('data:image/jpeg;base64,base64data');
      expect(mockCapacitorHttp.get).toHaveBeenCalledWith({
        url: 'https://example.com/logo.jpg',
        responseType: 'arraybuffer',
      });
    });

    it('should fallback to image/png Content-Type when header is missing', async () => {
      mockPreferences.get.and.resolveTo(null);
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
      mockCapacitorHttp.get.and.resolveTo({
        data: 'base64data',
        headers: {},
        status: 200,
        url: '',
      } as any);

      const result = await service.getLogoDataUrl('https://example.com/logo', 1);

      expect(result).toBe('data:image/png;base64,base64data');
    });
  });

  describe('getLogoDataUrl — web platform download failure', () => {
    it('should fallback to direct URL on non-ok response', async () => {
      mockPreferences.get.and.resolveTo(null);
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
      spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 404, statusText: 'Not Found' }));

      const result = await service.getLogoDataUrl('https://example.com/logo.png', 1);

      expect(result).toBe('https://example.com/logo.png');
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to download logo', jasmine.any(Object));
    });
  });

  describe('getCachedLogo — error handling', () => {
    it('should treat Preferences error as no cache', async () => {
      mockPreferences.get.and.rejectWith(new Error('Storage error'));
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
      spyOn(window, 'fetch').and.rejectWith(new Error('Network'));

      const result = await service.getLogoDataUrl('https://example.com/logo.png', 1);

      expect(result).toBe('https://example.com/logo.png');
    });
  });

  describe('saveCachedLogo — error handling', () => {
    it('should log warning when save fails but not throw', async () => {
      mockPreferences.get.and.resolveTo(null);
      mockPreferences.set.and.rejectWith(new Error('Storage full'));
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);

      const mockBlob = new Blob(['test'], { type: 'image/png' });
      spyOn(window, 'fetch').and.resolveTo(new Response(mockBlob, { status: 200 }));

      const result = await service.getLogoDataUrl('https://example.com/logo.png', 1);

      expect(result).toBeTruthy();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to save logo to cache',
        jasmine.objectContaining({ error: jasmine.stringContaining('Storage full') }),
      );
    });
  });

  describe('getLogoDataUrl — cache miss (URL mismatch)', () => {
    it('should re-download logo when cached URL differs from requested URL', async () => {
      const cached = {
        configVersion: 5,
        logoUrl: 'https://example.com/old-logo.png',
        dataUrl: 'data:image/png;base64,old',
      };
      mockPreferences.get.and.resolveTo(JSON.stringify(cached));
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);

      const mockBlob = new Blob(['newdata'], { type: 'image/png' });
      spyOn(window, 'fetch').and.resolveTo(new Response(mockBlob, { status: 200 }));

      const result = await service.getLogoDataUrl('https://example.com/new-logo.png', 5);

      expect(result).toBeTruthy();
      expect(result).not.toBe('data:image/png;base64,old');
      expect(mockLogger.info).toHaveBeenCalledWith('Logo cached successfully', { configVersion: 5 });
    });
  });

  describe('tenant-aware cache keys', () => {
    it('should use tenant-specific key', async () => {
      mockTenant.getCurrentTenantId.and.returnValue('ariston-rs');
      mockPreferences.get.and.resolveTo(null);
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);

      const mockBlob = new Blob(['test'], { type: 'image/png' });
      spyOn(window, 'fetch').and.resolveTo(new Response(mockBlob, { status: 200 }));

      await service.getLogoDataUrl('https://example.com/logo.png', 1);

      expect(mockPreferences.get).toHaveBeenCalledWith('logo_cache_ariston-rs');
    });

    it('should use default key when tenantId is null', async () => {
      mockTenant.getCurrentTenantId.and.returnValue(null as any);
      mockPreferences.get.and.resolveTo(null);
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);

      const mockBlob = new Blob(['test'], { type: 'image/png' });
      spyOn(window, 'fetch').and.resolveTo(new Response(mockBlob, { status: 200 }));

      await service.getLogoDataUrl('https://example.com/logo.png', 1);

      expect(mockPreferences.get).toHaveBeenCalledWith('logo_cache_default');
    });
  });

  // ─── EXPANSION: empty URL variety ────────────────────────────────────────────

  describe('getLogoDataUrl — empty/null/undefined URL', () => {
    it('should return null when logoUrl is ""', async () => {
      const result = await service.getLogoDataUrl('', 1);

      expect(result).toBeNull();
    });

    it('should attempt download when logoUrl is "   " (whitespace, not treated as empty)', async () => {
      // The app uses `if (!logoUrl)` which only guards against falsy values.
      // A whitespace-only string is truthy, so the service will attempt a download.
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
      spyOn(window, 'fetch').and.rejectWith(new Error('Network error'));

      const result = await service.getLogoDataUrl('   ', 1);

      // Falls back to direct URL (web + no cache + download failed)
      expect(result).toBe('   ');
    });
  });

  // ─── EXPANSION: cache hit version matrix ──────────────────────────────────────

  describe('getLogoDataUrl — cache hit version matrix', () => {
    const versions = [1, 2, 5, 10, 50, 100];

    versions.forEach(v => {
      it(`should return cached dataUrl for version ${v} when version matches`, async () => {
        const logoUrl = 'https://example.com/logo.png';
        const cached = { configVersion: v, logoUrl, dataUrl: `data:image/png;base64,v${v}` };
        mockPreferences.get.and.resolveTo(JSON.stringify(cached));

        const result = await service.getLogoDataUrl(logoUrl, v);

        expect(result).toBe(`data:image/png;base64,v${v}`);
        expect(mockPreferences.set).not.toHaveBeenCalled();
      });
    });
  });

  // ─── EXPANSION: tenant key matrix ────────────────────────────────────────────

  describe('tenant-aware cache key matrix', () => {
    const tenants = ['ariston-rs', 'ariston-ba', 'viessmann', 'baxi', 'tenant-long-name-12345'];

    tenants.forEach(tenantId => {
      it(`should use key "logo_cache_${tenantId}" for tenant "${tenantId}"`, async () => {
        mockTenant.getCurrentTenantId.and.returnValue(tenantId);
        mockPreferences.get.and.resolveTo(null);
        spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
        spyOn(window, 'fetch').and.resolveTo(
          new Response(new Blob(['data'], { type: 'image/png' }), { status: 200 }),
        );

        await service.getLogoDataUrl('https://example.com/logo.png', 1);

        expect(mockPreferences.get).toHaveBeenCalledWith(`logo_cache_${tenantId}`);
      });
    });
  });

  // ─── EXPANSION: native platform content types ─────────────────────────────────

  describe('native platform — content type matrix', () => {
    const contentTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/gif', 'image/webp'];

    contentTypes.forEach(contentType => {
      it(`should build correct data URL for Content-Type="${contentType}"`, async () => {
        mockPreferences.get.and.resolveTo(null);
        spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
        mockCapacitorHttp.get.and.resolveTo({
          data: 'base64data',
          headers: { 'Content-Type': contentType },
          status: 200,
          url: '',
        } as any);

        const result = await service.getLogoDataUrl('https://example.com/logo', 1);

        expect(result).toBe(`data:${contentType};base64,base64data`);
      });
    });
  });

  // ─── EXPANSION: web HTTP status code matrix ──────────────────────────────────

  describe('web platform — HTTP status code matrix (non-200)', () => {
    const errorStatuses = [400, 401, 403, 404, 500, 503];

    errorStatuses.forEach(status => {
      it(`should fallback to direct URL when HTTP status ${status}`, async () => {
        mockPreferences.get.and.resolveTo(null);
        spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
        spyOn(window, 'fetch').and.resolveTo(
          new Response(null, { status, statusText: 'Error' }),
        );

        const logoUrl = 'https://example.com/logo.png';
        const result = await service.getLogoDataUrl(logoUrl, 1);

        expect(result).toBe(logoUrl);
      });
    });
  });

  // ─── EXPANSION: version mismatch triggers download ───────────────────────────

  describe('getLogoDataUrl — version mismatch triggers download', () => {
    const versionPairs = [
      { cached: 1, current: 2 },
      { cached: 5, current: 10 },
      { cached: 0, current: 1 },
      { cached: 99, current: 100 },
    ];

    versionPairs.forEach(({ cached: cachedV, current }) => {
      it(`should download when cached version=${cachedV} but current=${current}`, async () => {
        const logoUrl = 'https://example.com/logo.png';
        const cachedData = { configVersion: cachedV, logoUrl, dataUrl: 'data:image/png;base64,old' };
        mockPreferences.get.and.resolveTo(JSON.stringify(cachedData));
        spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
        spyOn(window, 'fetch').and.resolveTo(
          new Response(new Blob(['newdata'], { type: 'image/png' }), { status: 200 }),
        );

        const result = await service.getLogoDataUrl(logoUrl, current);

        expect(result).toBeTruthy();
        expect(result).not.toBe('data:image/png;base64,old');
      });
    });
  });

  // ─── EXPANSION: URL mismatch triggers download ───────────────────────────────

  describe('getLogoDataUrl — URL mismatch triggers download', () => {
    const urlPairs = [
      { cachedUrl: 'https://old.example.com/logo.png', newUrl: 'https://new.example.com/logo.png' },
      { cachedUrl: 'https://firebase.googleapis.com/v1/logo.png', newUrl: 'https://firebase.googleapis.com/v2/logo.png' },
    ];

    urlPairs.forEach(({ cachedUrl, newUrl }) => {
      it(`should re-download when URL changed from "${cachedUrl}" to "${newUrl}"`, async () => {
        const cachedData = { configVersion: 5, logoUrl: cachedUrl, dataUrl: 'data:image/png;base64,old' };
        mockPreferences.get.and.resolveTo(JSON.stringify(cachedData));
        spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
        spyOn(window, 'fetch').and.resolveTo(
          new Response(new Blob(['newdata'], { type: 'image/png' }), { status: 200 }),
        );

        const result = await service.getLogoDataUrl(newUrl, 5);

        expect(result).toBeTruthy();
        expect(result).not.toBe('data:image/png;base64,old');
        expect(mockPreferences.set).toHaveBeenCalled();
      });
    });
  });

  // ─── EXPANSION: corrupted JSON in Preferences ────────────────────────────────

  describe('getCachedLogo — corrupted JSON handling', () => {
    it('should treat corrupted JSON as cache miss on web platform', async () => {
      mockPreferences.get.and.resolveTo('{corrupted: json data!!!}');
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
      spyOn(window, 'fetch').and.rejectWith(new Error('Network'));

      const logoUrl = 'https://example.com/logo.png';
      const result = await service.getLogoDataUrl(logoUrl, 1);

      // Falls back to direct URL (web + no cache + download failed)
      expect(result).toBe(logoUrl);
    });
  });

  // ─── EXPANSION: multiple calls with same version — idempotent ────────────────

  describe('getLogoDataUrl — idempotent calls with cache', () => {
    it('should return same cached value on multiple calls with same version', async () => {
      const logoUrl = 'https://example.com/logo.png';
      const cached = { configVersion: 3, logoUrl, dataUrl: 'data:image/png;base64,stable' };
      mockPreferences.get.and.resolveTo(JSON.stringify(cached));

      const result1 = await service.getLogoDataUrl(logoUrl, 3);
      const result2 = await service.getLogoDataUrl(logoUrl, 3);

      expect(result1).toBe('data:image/png;base64,stable');
      expect(result2).toBe('data:image/png;base64,stable');
      expect(mockPreferences.set).not.toHaveBeenCalled();
    });
  });

  // ─── EXPANSION: save to Preferences uses tenant key ──────────────────────────

  describe('saveCachedLogo — tenant key on write', () => {
    it('should save with tenant-specific key when tenantId is set', async () => {
      mockTenant.getCurrentTenantId.and.returnValue('baxi-ba');
      mockPreferences.get.and.resolveTo(null);
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
      spyOn(window, 'fetch').and.resolveTo(
        new Response(new Blob(['data'], { type: 'image/png' }), { status: 200 }),
      );

      await service.getLogoDataUrl('https://example.com/logo.png', 1);

      expect(mockPreferences.set).toHaveBeenCalledWith('logo_cache_baxi-ba', jasmine.any(String));
    });
  });
});
