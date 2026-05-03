/**
 * CameraService Unit Tests — WU-27, Batch B3
 *
 * MOCK STRATEGY — IMPORTANT NOTES
 * ================================
 * Camera from @capacitor/camera is a Capacitor Proxy object (BUG-03 pattern).
 * registerPlugin() returns a Proxy whose get trap always delegates to
 * CameraWeb instance — spyOn(Camera, 'getPhoto') silently writes to the
 * Proxy target {} but the get trap ignores it, so the spy is never called.
 *
 * Solution: spy on CameraWeb.prototype.getPhoto AFTER the class is loaded.
 * Because Camera service calls Camera.getPhoto() and the Proxy lazily loads
 * CameraWeb as its web implementation, spying on the prototype intercepts
 * all calls made through the Proxy.
 *
 * ConfigStore: mock via createMockConfigStore() — CameraService reads
 * configStore.business() for photoQuality and photoMaxWidth.
 * LoggerService: mock via createMockLoggerService().
 */

import { TestBed } from '@angular/core/testing';
import { CameraWeb } from '@capacitor/camera/dist/esm/web';
import { CameraService } from './camera.service';
import { ConfigStore } from '../../../core/config/config.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { createMockLoggerService, createMockConfigStore } from '../../../testing/mock-factories';
import { getDefaultConfig } from '../../../core/config/config.model';

describe('CameraService', () => {
  let service: CameraService;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockConfigStore: ReturnType<typeof createMockConfigStore>;
  let getPhotoSpy: jasmine.Spy;

  beforeEach(() => {
    mockLogger = createMockLoggerService();
    mockConfigStore = createMockConfigStore();

    // Load defaults so business() returns photoQuality + photoMaxWidth
    mockConfigStore.loadDefaults();

    TestBed.configureTestingModule({
      providers: [
        CameraService,
        { provide: ConfigStore, useValue: mockConfigStore },
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(CameraService);

    // Spy on CameraWeb.prototype.getPhoto — intercepts calls through the Proxy
    getPhotoSpy = spyOn(CameraWeb.prototype, 'getPhoto');
  });

  afterEach(() => {
    // Restore prototype spy to avoid cross-test contamination
    getPhotoSpy.calls.reset();
  });

  // =========================================================================
  // takePhoto()
  // =========================================================================

  describe('takePhoto()', () => {
    it('TC-CS01: returns webPath and uri on successful camera capture', async () => {
      getPhotoSpy.and.resolveTo({ webPath: 'blob:http://localhost/photo-1', path: '/var/mobile/photo-1.jpg' });

      const result = await service.takePhoto();

      expect(result).not.toBeNull();
      expect(result!.webPath).toBe('blob:http://localhost/photo-1');
      expect(result!.uri).toBe('/var/mobile/photo-1.jpg');
    });

    it('TC-CS02: returns null when user cancels (getPhoto throws)', async () => {
      getPhotoSpy.and.rejectWith(new Error('User cancelled photos app'));

      const result = await service.takePhoto();

      expect(result).toBeNull();
    });

    it('TC-CS03: handles error gracefully — does not throw, returns null', async () => {
      getPhotoSpy.and.rejectWith(new Error('Camera not available'));

      await expectAsync(service.takePhoto()).toBeResolvedTo(null);
    });

    it('TC-CS04: logs warning when camera is cancelled or fails', async () => {
      getPhotoSpy.and.rejectWith(new Error('User cancelled photos app'));

      await service.takePhoto();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Camera cancelled or failed',
        jasmine.objectContaining({ error: jasmine.stringContaining('User cancelled photos app') }),
      );
    });

    it('TC-CS05: uses photoQuality and photoMaxWidth from config store', async () => {
      const cfg = getDefaultConfig();
      cfg.business.photoQuality = 85;
      cfg.business.photoMaxWidth = 1920;
      mockConfigStore.setConfig(cfg);

      getPhotoSpy.and.resolveTo({ webPath: 'blob:http://localhost/img', path: '/img.jpg' });

      await service.takePhoto();

      const callArgs = getPhotoSpy.calls.mostRecent().args[0];
      expect(callArgs.quality).toBe(85);
      expect(callArgs.width).toBe(1920);
    });

    it('TC-CS06: returns null when getPhoto returns empty webPath and empty path', async () => {
      // webPath falls back to '' and path is undefined → both empty → logger.warn + null
      getPhotoSpy.and.resolveTo({ webPath: undefined, path: undefined });

      const result = await service.takePhoto();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Camera returned empty paths');
    });
  });

  // =========================================================================
  // pickFromGallery()
  // =========================================================================

  describe('pickFromGallery()', () => {
    it('TC-CS07: returns webPath on successful gallery pick', async () => {
      getPhotoSpy.and.resolveTo({ webPath: 'blob:http://localhost/gallery-1', path: '/gallery-1.jpg' });

      const result = await service.pickFromGallery();

      expect(result).not.toBeNull();
      expect(result!.webPath).toBe('blob:http://localhost/gallery-1');
    });

    it('TC-CS08: returns null when user cancels gallery picker', async () => {
      getPhotoSpy.and.rejectWith(new Error('User cancelled photos app'));

      const result = await service.pickFromGallery();

      expect(result).toBeNull();
    });

    it('TC-CS09: logs warning when gallery picker is cancelled', async () => {
      getPhotoSpy.and.rejectWith(new Error('No photo selected'));

      await service.pickFromGallery();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Camera cancelled or failed',
        jasmine.objectContaining({ error: jasmine.stringContaining('No photo selected') }),
      );
    });

    it('TC-CS10: uses uri from path field when path is available', async () => {
      getPhotoSpy.and.resolveTo({ webPath: 'blob:http://localhost/img2', path: '/storage/img2.jpg' });

      const result = await service.pickFromGallery();

      expect(result!.uri).toBe('/storage/img2.jpg');
    });

    it('TC-CS11: falls back to webPath as uri when path is not set', async () => {
      // photo.path is undefined — code uses photo.webPath as uri fallback
      getPhotoSpy.and.resolveTo({ webPath: 'blob:http://localhost/fallback', path: undefined });

      const result = await service.pickFromGallery();

      expect(result).not.toBeNull();
      expect(result!.uri).toBe('blob:http://localhost/fallback');
    });

    it('TC-CS12: returns null when both webPath and path are missing', async () => {
      getPhotoSpy.and.resolveTo({ webPath: undefined, path: undefined });

      const result = await service.pickFromGallery();

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // Bonus: Logger interaction
  // =========================================================================

  describe('Logger interaction', () => {
    it('TC-CS13: does NOT log warning when photo is captured successfully', async () => {
      getPhotoSpy.and.resolveTo({ webPath: 'blob:http://localhost/ok', path: '/ok.jpg' });

      await service.takePhoto();

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // EXPANSION — quality and width config matrix
  // =========================================================================

  describe('takePhoto() — quality config variations', () => {
    const qualityValues = [0, 1, 10, 30, 50, 70, 85, 90, 95, 100];

    qualityValues.forEach((quality) => {
      it(`should pass quality=${quality} to getPhoto`, async () => {
        const cfg = getDefaultConfig();
        cfg.business.photoQuality = quality;
        cfg.business.photoMaxWidth = 1280;
        mockConfigStore.setConfig(cfg);
        getPhotoSpy.and.resolveTo({ webPath: 'blob:http://localhost/img', path: '/img.jpg' });

        await service.takePhoto();

        const callArgs = getPhotoSpy.calls.mostRecent().args[0];
        expect(callArgs.quality).toBe(quality);
      });
    });
  });

  describe('takePhoto() — photoMaxWidth config variations', () => {
    const widthValues = [320, 640, 800, 1024, 1280, 1920, 2560, 3840];

    widthValues.forEach((width) => {
      it(`should pass width=${width} to getPhoto`, async () => {
        const cfg = getDefaultConfig();
        cfg.business.photoQuality = 70;
        cfg.business.photoMaxWidth = width;
        mockConfigStore.setConfig(cfg);
        getPhotoSpy.and.resolveTo({ webPath: 'blob:http://localhost/img', path: '/img.jpg' });

        await service.takePhoto();

        const callArgs = getPhotoSpy.calls.mostRecent().args[0];
        expect(callArgs.width).toBe(width);
      });
    });
  });

  // =========================================================================
  // EXPANSION — takePhoto result shapes
  // =========================================================================

  describe('takePhoto() — various result shapes', () => {
    const resultShapes: Array<{ webPath: string | undefined; path: string | undefined; expectNull: boolean }> = [
      { webPath: 'blob:http://localhost/1', path: '/path/1.jpg', expectNull: false },
      { webPath: 'blob:http://localhost/2', path: undefined, expectNull: false },
      { webPath: undefined, path: '/path/3.jpg', expectNull: false }, // uri is truthy → valid result
      { webPath: undefined, path: undefined, expectNull: true },
      { webPath: '', path: '', expectNull: true },
    ];

    resultShapes.forEach(({ webPath, path, expectNull }) => {
      it(`webPath=${webPath}, path=${path} should ${expectNull ? 'return null' : 'return result'}`, async () => {
        getPhotoSpy.and.resolveTo({ webPath, path } as any);

        const result = await service.takePhoto();

        if (expectNull) {
          expect(result).toBeNull();
        } else {
          expect(result).not.toBeNull();
        }
      });
    });
  });

  // =========================================================================
  // EXPANSION — pickFromGallery result shapes
  // =========================================================================

  describe('pickFromGallery() — various result shapes', () => {
    it('should correctly set webPath from gallery result', async () => {
      getPhotoSpy.and.resolveTo({ webPath: 'blob:http://localhost/gal1', path: '/gal1.jpg' });

      const result = await service.pickFromGallery();

      expect(result).not.toBeNull();
      expect(result!.webPath).toBe('blob:http://localhost/gal1');
    });

    it('should set uri from path when path present', async () => {
      getPhotoSpy.and.resolveTo({ webPath: 'blob:http://localhost/gal2', path: '/native/gal2.jpg' });

      const result = await service.pickFromGallery();

      expect(result!.uri).toBe('/native/gal2.jpg');
    });

    it('should fallback to webPath as uri when path undefined', async () => {
      getPhotoSpy.and.resolveTo({ webPath: 'blob:http://localhost/gal3', path: undefined });

      const result = await service.pickFromGallery();

      expect(result!.uri).toBe('blob:http://localhost/gal3');
    });

    it('should return null when user cancels with specific message "User cancelled photos app"', async () => {
      getPhotoSpy.and.rejectWith(new Error('User cancelled photos app'));

      const result = await service.pickFromGallery();

      expect(result).toBeNull();
    });

    it('should return null when gallery throws unexpected error', async () => {
      getPhotoSpy.and.rejectWith(new Error('Unexpected gallery error'));

      const result = await service.pickFromGallery();

      expect(result).toBeNull();
    });

    it('should log warning with error message on gallery failure', async () => {
      getPhotoSpy.and.rejectWith(new Error('Gallery access denied'));

      await service.pickFromGallery();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Camera cancelled or failed',
        jasmine.objectContaining({ error: jasmine.stringContaining('Gallery access denied') }),
      );
    });
  });

  // =========================================================================
  // EXPANSION — takePhoto error message variations
  // =========================================================================

  describe('takePhoto() — error message variations', () => {
    const errorMessages = [
      'User cancelled photos app',
      'Camera not available',
      'Permission denied',
      'Hardware not available',
      'Camera busy',
      'Unknown error',
    ];

    errorMessages.forEach((msg) => {
      it(`should return null and log warn for error: "${msg}"`, async () => {
        getPhotoSpy.and.rejectWith(new Error(msg));

        const result = await service.takePhoto();

        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Camera cancelled or failed',
          jasmine.objectContaining({ error: jasmine.stringContaining(msg) }),
        );
      });
    });
  });

  // =========================================================================
  // EXPANSION — multiple sequential calls
  // =========================================================================

  describe('takePhoto() — multiple sequential calls', () => {
    it('should handle 3 sequential successful calls', async () => {
      getPhotoSpy.and.resolveTo({ webPath: 'blob:http://localhost/ok', path: '/ok.jpg' });

      const r1 = await service.takePhoto();
      const r2 = await service.takePhoto();
      const r3 = await service.takePhoto();

      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
      expect(r3).not.toBeNull();
    });

    it('should handle alternating success/failure calls', async () => {
      getPhotoSpy.and.returnValues(
        Promise.resolve({ webPath: 'blob:http://localhost/a', path: '/a.jpg' }),
        Promise.reject(new Error('User cancelled')),
        Promise.resolve({ webPath: 'blob:http://localhost/b', path: '/b.jpg' }),
      );

      const r1 = await service.takePhoto();
      const r2 = await service.takePhoto();
      const r3 = await service.takePhoto();

      expect(r1).not.toBeNull();
      expect(r2).toBeNull();
      expect(r3).not.toBeNull();
    });
  });
});
