import { TestBed } from '@angular/core/testing';
import { PartDetailService, PartDetail } from './part-detail.service';

describe('PartDetailService', () => {
  let service: PartDetailService;
  let mockFirestoreService: {
    getTenantDocument: jasmine.Spy;
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
      getTenantDocument: jasmine.createSpy('getTenantDocument').and.resolveTo({ Price: 100 }),
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
      expect(mockFirestoreService.getTenantDocument).toHaveBeenCalledWith('priceList', 'PART-001');
    });

    it('should set isLoading true during execution', async () => {
      let loadingDuringCall = false;
      mockFirestoreService.getTenantDocument.and.callFake(() => {
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
      mockFirestoreService.getTenantDocument.and.resolveTo({ Price: 150 });
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.price).toBe(150);
    });

    it('should return null price when document has no Price field', async () => {
      mockFirestoreService.getTenantDocument.and.resolveTo({});
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.price).toBeNull();
    });

    it('should return null price when document is null', async () => {
      mockFirestoreService.getTenantDocument.and.resolveTo(null);
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.price).toBeNull();
    });

    it('should return price of 0 correctly', async () => {
      mockFirestoreService.getTenantDocument.and.resolveTo({ Price: 0 });
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.price).toBe(0);
    });

    it('should return decimal price correctly', async () => {
      mockFirestoreService.getTenantDocument.and.resolveTo({ Price: 99.99 });
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
      mockFirestoreService.getTenantDocument.and.rejectWith(new Error('Firestore error'));
      const detail = await service.loadPartDetail('P1', 'My Part');
      expect(detail.partCode).toBe('P1');
      expect(detail.name).toBe('My Part');
      expect(detail.price).toBeNull();
      expect(detail.currency).toBe('EUR');
      expect(detail.showPhoto).toBeFalse();
      expect(detail.photoUrl).toBe('');
    });

    it('should log error on failure', async () => {
      mockFirestoreService.getTenantDocument.and.rejectWith(new Error('fail'));
      await service.loadPartDetail('P1', 'Part');
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to load part detail',
        jasmine.objectContaining({ partCode: 'P1', error: 'Error: fail' }),
      );
    });

    it('should set isLoading false on error', async () => {
      mockFirestoreService.getTenantDocument.and.rejectWith(new Error('fail'));
      await service.loadPartDetail('P1', 'Part');
      expect(service.isLoading).toBeFalse();
    });

    it('should return fallback with EUR currency on error regardless of config', async () => {
      mockConfigStore.config.and.returnValue({ business: { currency: 'RSD' } });
      mockFirestoreService.getTenantDocument.and.rejectWith(new Error('fail'));
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
      mockFirestoreService.getTenantDocument.and.resolveTo({ Price: 100 });
      await service.loadPartDetail('P1', 'Part');
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Part detail loaded', {
        partCode: 'P1',
        price: 100,
        currency: 'EUR',
      });
    });

    it('should log null price on success when no price', async () => {
      mockFirestoreService.getTenantDocument.and.resolveTo(null);
      await service.loadPartDetail('P1', 'Part');
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Part detail loaded', jasmine.objectContaining({
        price: null,
      }));
    });

    it('should not log debug on error', async () => {
      mockFirestoreService.getTenantDocument.and.rejectWith(new Error('fail'));
      await service.loadPartDetail('P1', 'Part');
      expect(mockLoggerService.debug).not.toHaveBeenCalled();
    });
  });

  // ── Complete PartDetail structure ──
  describe('complete PartDetail structure', () => {
    it('should return all fields for part with price and no photo', async () => {
      mockConfigStore.isFeatureEnabled.and.returnValue(false);
      mockFirestoreService.getTenantDocument.and.resolveTo({ Price: 250 });
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
      mockFirestoreService.getTenantDocument.and.resolveTo({ Price: 50 });
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
      expect(mockFirestoreService.getTenantDocument).toHaveBeenCalledWith('priceList', '');
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
      mockFirestoreService.getTenantDocument.and.resolveTo({ Price: 999999.99 });
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.price).toBe(999999.99);
    });

    it('should handle negative price', async () => {
      mockFirestoreService.getTenantDocument.and.resolveTo({ Price: -10 });
      const detail = await service.loadPartDetail('P1', 'Part');
      expect(detail.price).toBe(-10);
    });
  });

  // ── EXPANSION — part code variations ────────────────────────────────────────

  describe('loadPartDetail() — part code variations (parameterized)', () => {
    const partCodes = [
      'RD-001',
      'ABC123',
      'PART_WITH_UNDERSCORES',
      'part-lowercase',
      '12345678',
      'VERY-LONG-PART-CODE-WITH-MANY-CHARACTERS',
      'P001',
      '',
    ];

    partCodes.forEach((code) => {
      it(`should call getTenantDocument with code="${code}"`, async () => {
        await service.loadPartDetail(code, 'Part Name');
        expect(mockFirestoreService.getTenantDocument).toHaveBeenCalledWith('priceList', code);
      });

      it(`should return PartDetail with partCode="${code}"`, async () => {
        const detail = await service.loadPartDetail(code, 'Part Name');
        expect(detail.partCode).toBe(code);
      });
    });
  });

  // ── EXPANSION — part name variations ────────────────────────────────────────

  describe('loadPartDetail() — part name variations (parameterized)', () => {
    const partNames = [
      'Simple Part',
      'Klipnjača kompresora',
      'UPPERCASE PART NAME',
      'part-with-hyphens',
      'Клапан вентила',
      '弁バルブ',
      '',
      'Part (v2.0)',
      'A very very very very long part name with many words and characters',
    ];

    partNames.forEach((name) => {
      it(`should return PartDetail with name="${name}"`, async () => {
        const detail = await service.loadPartDetail('P1', name);
        expect(detail.name).toBe(name);
      });
    });
  });

  // ── EXPANSION — price values (parameterized) ─────────────────────────────────

  describe('price handling — price value variations (parameterized)', () => {
    const priceValues: Array<{ price: any; expectedPrice: number | null }> = [
      { price: 0, expectedPrice: 0 },
      { price: 1, expectedPrice: 1 },
      { price: 0.01, expectedPrice: 0.01 },
      { price: 0.99, expectedPrice: 0.99 },
      { price: 99.99, expectedPrice: 99.99 },
      { price: 100, expectedPrice: 100 },
      { price: 1000, expectedPrice: 1000 },
      { price: 9999.99, expectedPrice: 9999.99 },
      { price: 100000, expectedPrice: 100000 },
      { price: -1, expectedPrice: -1 },
      { price: null, expectedPrice: null },
      { price: undefined, expectedPrice: null },
    ];

    priceValues.forEach(({ price, expectedPrice }) => {
      it(`document.Price=${JSON.stringify(price)} should yield detail.price=${expectedPrice}`, async () => {
        mockFirestoreService.getTenantDocument.and.resolveTo(price !== undefined ? { Price: price } : {});
        const detail = await service.loadPartDetail('P1', 'Part');
        expect(detail.price).toBe(expectedPrice);
      });
    });
  });

  // ── EXPANSION — currency variations ─────────────────────────────────────────

  describe('currency — currency code variations (parameterized)', () => {
    const currencies = ['EUR', 'RSD', 'USD', 'GBP', 'CHF', 'HRK', 'BAM'];

    currencies.forEach((currency) => {
      it(`should use currency="${currency}" from config`, async () => {
        mockConfigStore.config.and.returnValue({ business: { currency } });
        const detail = await service.loadPartDetail('P1', 'Part');
        expect(detail.currency).toBe(currency);
      });
    });
  });

  // ── EXPANSION — multiple sequential calls ────────────────────────────────────

  describe('loadPartDetail() — multiple sequential calls', () => {
    it('should handle 5 sequential calls independently', async () => {
      const codes = ['P1', 'P2', 'P3', 'P4', 'P5'];
      const prices = [10, 20, 30, 40, 50];

      for (let i = 0; i < codes.length; i++) {
        mockFirestoreService.getTenantDocument.and.resolveTo({ Price: prices[i] });
        const detail = await service.loadPartDetail(codes[i], `Part ${i}`);
        expect(detail.partCode).toBe(codes[i]);
        expect(detail.price).toBe(prices[i]);
      }
    });

    it('should call getTenantDocument once per loadPartDetail call', async () => {
      mockFirestoreService.getTenantDocument.and.resolveTo({ Price: 100 });

      await service.loadPartDetail('P1', 'Part 1');
      await service.loadPartDetail('P2', 'Part 2');
      await service.loadPartDetail('P3', 'Part 3');

      expect(mockFirestoreService.getTenantDocument).toHaveBeenCalledTimes(3);
    });

    it('should set isLoading=false between sequential calls', async () => {
      mockFirestoreService.getTenantDocument.and.resolveTo({ Price: 100 });

      await service.loadPartDetail('P1', 'Part');
      expect(service.isLoading).toBeFalse();

      await service.loadPartDetail('P2', 'Part');
      expect(service.isLoading).toBeFalse();
    });
  });

  // ── EXPANSION — error handling for various errors ────────────────────────────

  describe('error handling — various error types (parameterized)', () => {
    const errorMessages = [
      'Firestore error',
      'Network timeout',
      'Permission denied',
      'Not found',
      'Internal server error',
    ];

    errorMessages.forEach((msg) => {
      it(`should log error containing "${msg}"`, async () => {
        mockFirestoreService.getTenantDocument.and.rejectWith(new Error(msg));

        await service.loadPartDetail('P1', 'Part');

        expect(mockLoggerService.error).toHaveBeenCalledWith(
          'Failed to load part detail',
          jasmine.objectContaining({ error: jasmine.stringContaining(msg) }),
        );
      });

      it(`should return fallback PartDetail for error "${msg}"`, async () => {
        mockFirestoreService.getTenantDocument.and.rejectWith(new Error(msg));

        const detail = await service.loadPartDetail('P-ERR', 'Error Part');

        expect(detail.partCode).toBe('P-ERR');
        expect(detail.name).toBe('Error Part');
        expect(detail.price).toBeNull();
        expect(detail.showPhoto).toBeFalse();
        expect(detail.photoUrl).toBe('');
      });
    });
  });

  // ── EXPANSION — partPhoto feature flag matrix ────────────────────────────────

  describe('partPhoto feature — enabled/disabled matrix', () => {
    const photoFolders = ['PartPhotos', 'Photos', 'CustomFolder', 'parts/photos'];

    photoFolders.forEach((folder) => {
      it(`should resolve photo from folder "${folder}" when feature enabled`, async () => {
        mockConfigStore.isFeatureEnabled.and.callFake((f: string) => f === 'partPhoto');
        mockConfigStore.config.and.returnValue({ business: { currency: 'EUR', partPhotoFolder: folder } });
        mockStorageService.resolveFileUrl.and.resolveTo('https://cdn.example.com/p.png');

        await service.loadPartDetail('P1', 'Part');

        expect(mockStorageService.resolveFileUrl).toHaveBeenCalledWith(
          folder, 'P1', jasmine.any(Array),
        );
      });
    });

    it('should not resolve photo when feature disabled regardless of folder', async () => {
      mockConfigStore.isFeatureEnabled.and.returnValue(false);
      mockConfigStore.config.and.returnValue({ business: { currency: 'EUR', partPhotoFolder: 'PartPhotos' } });

      await service.loadPartDetail('P1', 'Part');

      expect(mockStorageService.resolveFileUrl).not.toHaveBeenCalled();
    });
  });
});
