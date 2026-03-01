import { TestBed } from '@angular/core/testing';
import { PartDetailService, PartDetail } from './part-detail.service';

describe('PartDetailService', () => {
  let service: PartDetailService;
  let mockFirestoreService: {
    getDocument: jasmine.Spy;
  };
  let mockStorageService: {
    resolveFileUrl: jasmine.Spy;
  };
  let mockConfigStore: {
    config: jasmine.Spy;
    isFeatureEnabled: jasmine.Spy;
  };
  let mockLoggerService: {
    debug: jasmine.Spy;
    error: jasmine.Spy;
  };

  beforeEach(() => {
    mockFirestoreService = {
      getDocument: jasmine.createSpy('getDocument').and.resolveTo({ Price: 100 }),
    };
    mockStorageService = {
      resolveFileUrl: jasmine.createSpy('resolveFileUrl').and.resolveTo('https://cdn.example.com/photo.png'),
    };
    mockConfigStore = {
      config: jasmine.createSpy('config').and.returnValue({
        business: { currency: 'EUR', partPhotoFolder: 'PartPhotos' },
      }),
      isFeatureEnabled: jasmine.createSpy('isFeatureEnabled').and.returnValue(false),
    };
    mockLoggerService = {
      debug: jasmine.createSpy('debug'),
      error: jasmine.createSpy('error'),
    };

    TestBed.configureTestingModule({ providers: [PartDetailService] });
    service = TestBed.inject(PartDetailService);
    (service as any).firestoreService = mockFirestoreService;
    (service as any).storageService = mockStorageService;
    (service as any).configStore = mockConfigStore;
    (service as any).logger = mockLoggerService;
  });

  // ── Initial state ──
  describe('initial state', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should not be loading', () => {
      expect(service.isLoading).toBeFalse();
    });
  });

  // ── loadPartDetail() basic ──
  describe('loadPartDetail() basic', () => {
    it('should query priceList collection for part code', async () => {
      await service.loadPartDetail('PART-001', 'Part Name');
      expect(mockFirestoreService.getDocument).toHaveBeenCalledWith('priceList/PART-001');
    });

    it('should set isLoading true during execution', async () => {
      let loadingDuringCall = false;
      mockFirestoreService.getDocument.and.callFake(() => {
        loadingDuringCall = service.isLoading;
        return Promise.resolve({ Price: 50 });
      });
      await service.loadPartDetail('P1', 'Part');
      expect(loadingDuringCall).toBeTrue();
    });

    it('should set isLoading false after completion', async () => {
      await service.loadPartDetail('P1', 'Part');
      expect(service.isLoading).toBeFalse();
    });

    it('should return PartDetail object', async () => {
      const detail = await service.loadPartDetail('P1', 'My Part');
      expect(detail).toBeDefined();
      expect(detail.partCode).toBe('P1');
      expect(detail.name).toBe('My Part');
    });
  });

  // ── Price handling ──
  describe('price handling', () => {
    it('should return price from document', async () => {
      mockFirestoreService.getDocument.and.resolveTo({ Price: 150 });
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.price).toBe(150);
    });

    it('should return null price when document has no Price field', async () => {
      mockFirestoreService.getDocument.and.resolveTo({});
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.price).toBeNull();
    });

    it('should return null price when document is null', async () => {
      mockFirestoreService.getDocument.and.resolveTo(null);
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.price).toBeNull();
    });

    it('should return price of 0 correctly', async () => {
      mockFirestoreService.getDocument.and.resolveTo({ Price: 0 });
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.price).toBe(0);
    });

    it('should return decimal price correctly', async () => {
      mockFirestoreService.getDocument.and.resolveTo({ Price: 99.99 });
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.price).toBe(99.99);
    });
  });

  // ── Currency ──
  describe('currency', () => {
    it('should use currency from config', async () => {
      mockConfigStore.config.and.returnValue({ business: { currency: 'RSD' } });
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.currency).toBe('RSD');
    });

    it('should default to EUR when config has no business', async () => {
      mockConfigStore.config.and.returnValue(null);
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.currency).toBe('EUR');
    });

    it('should default to EUR when config has no currency', async () => {
      mockConfigStore.config.and.returnValue({ business: {} });
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.currency).toBe('EUR');
    });

    it('should handle USD currency', async () => {
      mockConfigStore.config.and.returnValue({ business: { currency: 'USD' } });
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.currency).toBe('USD');
    });
  });

  // ── Part photo (partPhoto feature enabled) ──
  describe('part photo (feature enabled)', () => {
    beforeEach(() => {
      mockConfigStore.isFeatureEnabled.and.callFake((f: string) => f === 'partPhoto');
      mockConfigStore.config.and.returnValue({
        business: { currency: 'EUR', partPhotoFolder: 'PartPhotos' },
      });
    });

    it('should resolve photo URL when partPhoto feature is enabled', async () => {
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(mockStorageService.resolveFileUrl).toHaveBeenCalled();
      expect(detail.photoUrl).toBe('https://cdn.example.com/photo.png');
    });

    it('should set showPhoto to true', async () => {
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.showPhoto).toBeTrue();
    });

    it('should use partPhotoFolder from config', async () => {
      mockConfigStore.config.and.returnValue({
        business: { currency: 'EUR', partPhotoFolder: 'CustomFolder' },
      });
      await service.loadPartDetail('P1', 'Part');
      expect(mockStorageService.resolveFileUrl).toHaveBeenCalledWith(
        'CustomFolder', 'P1', ['png', 'jpg', 'jpeg'],
      );
    });

    it('should pass part code as filename to resolveFileUrl', async () => {
      await service.loadPartDetail('ABC-123', 'Part');
      expect(mockStorageService.resolveFileUrl).toHaveBeenCalledWith(
        'PartPhotos', 'ABC-123', jasmine.any(Array),
      );
    });

    it('should pass correct extensions', async () => {
      await service.loadPartDetail('P1', 'Part');
      expect(mockStorageService.resolveFileUrl).toHaveBeenCalledWith(
        jasmine.any(String), jasmine.any(String), ['png', 'jpg', 'jpeg'],
      );
    });

    it('should not resolve photo when partPhotoFolder is empty', async () => {
      mockConfigStore.config.and.returnValue({
        business: { currency: 'EUR', partPhotoFolder: '' },
      });
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(mockStorageService.resolveFileUrl).not.toHaveBeenCalled();
      expect(detail.photoUrl).toBe('');
    });

    it('should not resolve photo when partPhotoFolder is undefined', async () => {
      mockConfigStore.config.and.returnValue({
        business: { currency: 'EUR' },
      });
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(mockStorageService.resolveFileUrl).not.toHaveBeenCalled();
      expect(detail.photoUrl).toBe('');
    });
  });

  // ── Part photo (partPhoto feature disabled) ──
  describe('part photo (feature disabled)', () => {
    beforeEach(() => {
      mockConfigStore.isFeatureEnabled.and.returnValue(false);
    });

    it('should not resolve photo URL', async () => {
      await service.loadPartDetail('P1', 'Part');
      expect(mockStorageService.resolveFileUrl).not.toHaveBeenCalled();
    });

    it('should set showPhoto to false', async () => {
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.showPhoto).toBeFalse();
    });

    it('should return empty photoUrl', async () => {
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.photoUrl).toBe('');
    });
  });

  // ── Error handling ──
  describe('error handling', () => {
    it('should return fallback detail on Firestore error', async () => {
      mockFirestoreService.getDocument.and.rejectWith(new Error('Firestore error'));
      const detail = await service.loadPartDetail('P1', 'My Part');
      expect(detail.partCode).toBe('P1');
      expect(detail.name).toBe('My Part');
      expect(detail.price).toBeNull();
      expect(detail.currency).toBe('EUR');
      expect(detail.showPhoto).toBeFalse();
      expect(detail.photoUrl).toBe('');
    });

    it('should log error on failure', async () => {
      mockFirestoreService.getDocument.and.rejectWith(new Error('fail'));
      await service.loadPartDetail('P1', 'Part');
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to load part detail',
        jasmine.objectContaining({ partCode: 'P1', error: 'Error: fail' }),
      );
    });

    it('should set isLoading false on error', async () => {
      mockFirestoreService.getDocument.and.rejectWith(new Error('fail'));
      await service.loadPartDetail('P1', 'Part');
      expect(service.isLoading).toBeFalse();
    });

    it('should return fallback with EUR currency on error regardless of config', async () => {
      mockConfigStore.config.and.returnValue({ business: { currency: 'RSD' } });
      mockFirestoreService.getDocument.and.rejectWith(new Error('fail'));
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.currency).toBe('EUR');
    });

    it('should handle photo resolution error gracefully', async () => {
      mockConfigStore.isFeatureEnabled.and.callFake((f: string) => f === 'partPhoto');
      mockConfigStore.config.and.returnValue({
        business: { currency: 'EUR', partPhotoFolder: 'Photos' },
      });
      mockStorageService.resolveFileUrl.and.rejectWith(new Error('Photo not found'));
      const detail = await service.loadPartDetail('P1', 'Part');
      // The whole try/catch will catch this, returning fallback
      expect(detail.price).toBeNull();
      expect(detail.showPhoto).toBeFalse();
    });
  });

  // ── Logging ──
  describe('logging', () => {
    it('should log debug on success', async () => {
      mockFirestoreService.getDocument.and.resolveTo({ Price: 100 });
      await service.loadPartDetail('P1', 'Part');
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Part detail loaded', {
        partCode: 'P1',
        price: 100,
        currency: 'EUR',
      });
    });

    it('should log null price on success when no price', async () => {
      mockFirestoreService.getDocument.and.resolveTo(null);
      await service.loadPartDetail('P1', 'Part');
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Part detail loaded', jasmine.objectContaining({
        price: null,
      }));
    });

    it('should not log debug on error', async () => {
      mockFirestoreService.getDocument.and.rejectWith(new Error('fail'));
      await service.loadPartDetail('P1', 'Part');
      expect(mockLoggerService.debug).not.toHaveBeenCalled();
    });
  });

  // ── Complete PartDetail structure ──
  describe('complete PartDetail structure', () => {
    it('should return all fields for part with price and no photo', async () => {
      mockConfigStore.isFeatureEnabled.and.returnValue(false);
      mockFirestoreService.getDocument.and.resolveTo({ Price: 250 });
      mockConfigStore.config.and.returnValue({ business: { currency: 'RSD' } });

      const detail = await service.loadPartDetail('PART-X', 'Test Part');
      expect(detail).toEqual({
        partCode: 'PART-X',
        name: 'Test Part',
        price: 250,
        currency: 'RSD',
        showPhoto: false,
        photoUrl: '',
      });
    });

    it('should return all fields for part with price and photo', async () => {
      mockConfigStore.isFeatureEnabled.and.callFake((f: string) => f === 'partPhoto');
      mockFirestoreService.getDocument.and.resolveTo({ Price: 50 });
      mockConfigStore.config.and.returnValue({
        business: { currency: 'EUR', partPhotoFolder: 'Photos' },
      });
      mockStorageService.resolveFileUrl.and.resolveTo('https://cdn.example.com/p.jpg');

      const detail = await service.loadPartDetail('P1', 'My Part');
      expect(detail).toEqual({
        partCode: 'P1',
        name: 'My Part',
        price: 50,
        currency: 'EUR',
        showPhoto: true,
        photoUrl: 'https://cdn.example.com/p.jpg',
      });
    });
  });

  // ── Edge cases ──
  describe('edge cases', () => {
    it('should handle empty part code', async () => {
      await service.loadPartDetail('', 'Part');
      expect(mockFirestoreService.getDocument).toHaveBeenCalledWith('priceList/');
    });

    it('should handle empty part name', async () => {
      const detail = await service.loadPartDetail('P1', '');
      expect(detail.name).toBe('');
    });

    it('should handle unicode part name', async () => {
      const detail = await service.loadPartDetail('P1', 'Компресор');
      expect(detail.name).toBe('Компресор');
    });

    it('should handle very large price', async () => {
      mockFirestoreService.getDocument.and.resolveTo({ Price: 999999.99 });
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.price).toBe(999999.99);
    });

    it('should handle negative price', async () => {
      mockFirestoreService.getDocument.and.resolveTo({ Price: -10 });
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.price).toBe(-10);
    });
  });
});
