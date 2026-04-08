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
});
