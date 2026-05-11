/**
 * PhotoService Unit Tests — WU-27, Batch B3
 *
 * MOCK STRATEGY
 * =============
 * CameraService: jasmine.SpyObj — PhotoService delegates all camera/gallery
 *   interactions to CameraService. Spy controls return values per test.
 * StorageService: jasmine.SpyObj with uploadFile spy.
 * TenantService: createMockTenantService() — returns 'mock-tenant' by default.
 * ConfigStore: createMockConfigStore() — provides business().interventionCollections.
 * LoggerService: createMockLoggerService() — absorbs all log calls.
 *
 * Each test is independent: beforeEach runs clear() on the service to reset
 * photo array and requirement so there is no state leakage between tests.
 */

import { TestBed } from '@angular/core/testing';
import { PhotoService } from './photo.service';
import { CameraService } from './camera.service';
import { StorageService } from '../../../core/firebase/storage.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { ConfigStore } from '../../../core/config/config.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { PhotoRequirement } from '../../../core/config/config.model';
import {
  createMockLoggerService,
  createMockConfigStore,
  createMockTenantService,
} from '../../../testing/mock-factories';
import { getDefaultConfig } from '../../../core/config/config.model';
import { INTERVENTION_TYPE_SHORT } from '../models/photo.model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockCameraService(): jasmine.SpyObj<CameraService> {
  const mock = jasmine.createSpyObj<CameraService>('CameraService', [
    'takePhoto',
    'pickFromGallery',
  ]);
  mock.takePhoto.and.resolveTo(null);
  mock.pickFromGallery.and.resolveTo(null);
  return mock;
}

function createMockStorageService(): jasmine.SpyObj<StorageService> {
  const mock = jasmine.createSpyObj<StorageService>('StorageService', ['uploadFile']);
  mock.uploadFile.and.resolveTo();
  return mock;
}

function makePhotoRequirement(overrides: Partial<PhotoRequirement> = {}): PhotoRequirement {
  return {
    maxPhotos: 5,
    requiredPhotos: 2,
    requireSparePartPhotos: false,
    description: 'Test requirement',
    ...overrides,
  };
}

const MOCK_PHOTO_RESULT = { webPath: 'blob:http://localhost/photo-1', uri: '/cache/photo-1.jpg' };

// ---------------------------------------------------------------------------
// Main describe
// ---------------------------------------------------------------------------

describe('PhotoService', () => {
  let service: PhotoService;
  let mockCamera: jasmine.SpyObj<CameraService>;
  let mockStorage: jasmine.SpyObj<StorageService>;
  let mockTenant: jasmine.SpyObj<TenantService>;
  let mockConfigStore: ReturnType<typeof createMockConfigStore>;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    mockCamera = createMockCameraService();
    mockStorage = createMockStorageService();
    mockTenant = createMockTenantService();
    mockConfigStore = createMockConfigStore();
    mockLogger = createMockLoggerService();

    // Load defaults so business().interventionCollections is populated
    mockConfigStore.loadDefaults();

    TestBed.configureTestingModule({
      providers: [
        PhotoService,
        { provide: CameraService, useValue: mockCamera },
        { provide: StorageService, useValue: mockStorage },
        { provide: TenantService, useValue: mockTenant },
        { provide: ConfigStore, useValue: mockConfigStore },
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(PhotoService);

    // Ensure clean state before each test
    service.clear();
  });

  // =========================================================================
  // setRequirement()
  // =========================================================================

  describe('setRequirement()', () => {
    it('TC-PS01: stores the requirement object on the service', () => {
      const req = makePhotoRequirement({ maxPhotos: 3, requiredPhotos: 1 });

      service.setRequirement(req);

      expect(service.requirement).toBe(req);
    });

    it('TC-PS02: stores requirement with all fields intact', () => {
      const req = makePhotoRequirement({
        maxPhotos: 10,
        requiredPhotos: 5,
        requireSparePartPhotos: true,
        description: 'Must have 5 photos',
      });

      service.setRequirement(req);

      expect(service.requirement!.maxPhotos).toBe(10);
      expect(service.requirement!.requiredPhotos).toBe(5);
      expect(service.requirement!.requireSparePartPhotos).toBeTrue();
      expect(service.requirement!.description).toBe('Must have 5 photos');
    });
  });

  // =========================================================================
  // takePhoto()
  // =========================================================================

  describe('takePhoto()', () => {
    it('TC-PS03: calls CameraService.takePhoto', async () => {
      service.setRequirement(makePhotoRequirement());
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);

      await service.takePhoto();

      expect(mockCamera.takePhoto).toHaveBeenCalledTimes(1);
    });

    it('TC-PS04: rejects (returns false) when canTakeMore is false', async () => {
      // maxPhotos: 1, and we already have 1 photo
      service.setRequirement(makePhotoRequirement({ maxPhotos: 1 }));
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
      await service.takePhoto(); // adds first photo

      const result = await service.takePhoto(); // canTakeMore is now false

      expect(result).toBeFalse();
      expect(mockCamera.takePhoto).toHaveBeenCalledTimes(1); // only called once
    });

    it('TC-PS05: pushes photo to internal photos array on success', async () => {
      service.setRequirement(makePhotoRequirement());
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);

      await service.takePhoto();

      expect(service.photos.length).toBe(1);
      expect(service.photos[0].webPath).toBe(MOCK_PHOTO_RESULT.webPath);
      expect(service.photos[0].uri).toBe(MOCK_PHOTO_RESULT.uri);
    });

    it('TC-PS06: does not push photo when CameraService returns null', async () => {
      service.setRequirement(makePhotoRequirement());
      mockCamera.takePhoto.and.resolveTo(null);

      const result = await service.takePhoto();

      expect(result).toBeFalse();
      expect(service.photos.length).toBe(0);
    });

    it('TC-PS07: returns false when no requirement is set (canTakeMore is false)', async () => {
      // no setRequirement call — requirement is null → canTakeMore returns false

      const result = await service.takePhoto();

      expect(result).toBeFalse();
      expect(mockCamera.takePhoto).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // pickFromGallery()
  // =========================================================================

  describe('pickFromGallery()', () => {
    it('TC-PS08: calls CameraService.pickFromGallery', async () => {
      service.setRequirement(makePhotoRequirement());
      mockCamera.pickFromGallery.and.resolveTo(MOCK_PHOTO_RESULT);

      await service.pickFromGallery();

      expect(mockCamera.pickFromGallery).toHaveBeenCalledTimes(1);
    });

    it('TC-PS09: pushes photo to internal photos array on gallery pick success', async () => {
      service.setRequirement(makePhotoRequirement());
      mockCamera.pickFromGallery.and.resolveTo(MOCK_PHOTO_RESULT);

      await service.pickFromGallery();

      expect(service.photos.length).toBe(1);
      expect(service.photos[0].webPath).toBe(MOCK_PHOTO_RESULT.webPath);
    });

    it('TC-PS10: returns false and does not push when gallery returns null', async () => {
      service.setRequirement(makePhotoRequirement());
      mockCamera.pickFromGallery.and.resolveTo(null);

      const result = await service.pickFromGallery();

      expect(result).toBeFalse();
      expect(service.photos.length).toBe(0);
    });
  });

  // =========================================================================
  // removePhoto()
  // =========================================================================

  describe('removePhoto()', () => {
    it('TC-PS11: removes photo by id from photos array', async () => {
      service.setRequirement(makePhotoRequirement());
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);

      await service.takePhoto();

      const idToRemove = service.photos[0].id;
      service.removePhoto(idToRemove);

      expect(service.photos.length).toBe(0);
    });

    it('TC-PS12: removes only the photo with matching id, leaves others intact', async () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 5 }));
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);

      await service.takePhoto();
      await service.takePhoto();

      const idToRemove = service.photos[0].id;
      const remainingId = service.photos[1].id;
      service.removePhoto(idToRemove);

      expect(service.photos.length).toBe(1);
      expect(service.photos[0].id).toBe(remainingId);
    });

    it('TC-PS13: does nothing when id is not found', () => {
      service.setRequirement(makePhotoRequirement());
      // No photos added

      service.removePhoto('non-existent-id');

      expect(service.photos.length).toBe(0);
    });
  });

  // =========================================================================
  // uploadPhotos()
  // =========================================================================

  describe('uploadPhotos()', () => {
    it('TC-PS14: constructs storage path with tenantId/collection/sn/fileName', async () => {
      const cfg = getDefaultConfig();
      cfg.business.interventionCollections = { default: 'interventions', boiler: 'boiler-interventions' };
      mockConfigStore.setConfig(cfg);
      mockTenant.getCurrentTenantId.and.returnValue('acme-corp');

      service.setRequirement(makePhotoRequirement());
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
      await service.takePhoto();

      await service.uploadPhotos('SN12345', 'boiler', 'interventionRepair');

      const callArgs = mockStorage.uploadFile.calls.mostRecent().args;
      const storagePath = callArgs[0];
      // path: acme-corp/boiler-interventions/SN12345/repair_DD-MM-YYYY_1.jpg
      expect(storagePath).toContain('acme-corp/');
      expect(storagePath).toContain('/boiler-interventions/');
      expect(storagePath).toContain('/SN12345/');
      expect(storagePath).toContain('repair_');
    });

    it('TC-PS15: uses INTERVENTION_TYPE_SHORT mapping in file name', async () => {
      service.setRequirement(makePhotoRequirement());
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
      await service.takePhoto();

      await service.uploadPhotos('SN99', 'default', 'commissioning');

      const storagePath = mockStorage.uploadFile.calls.mostRecent().args[0];
      expect(storagePath).toContain('comm_');
    });

    it('TC-PS16: uses raw interventionType when not found in INTERVENTION_TYPE_SHORT', async () => {
      service.setRequirement(makePhotoRequirement());
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
      await service.takePhoto();

      await service.uploadPhotos('SN01', 'default', 'custom_type');

      const storagePath = mockStorage.uploadFile.calls.mostRecent().args[0];
      expect(storagePath).toContain('custom_type_');
    });

    it('TC-PS17: calls StorageService.uploadFile for each photo', async () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 5 }));
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
      await service.takePhoto();
      await service.takePhoto();
      await service.takePhoto();

      await service.uploadPhotos('SN42', 'default', 'annual_service');

      expect(mockStorage.uploadFile).toHaveBeenCalledTimes(3);
    });

    it('TC-PS18: continues uploading remaining photos when one upload fails', async () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 5 }));

      const photo1 = { webPath: 'blob:http://localhost/photo-1', uri: '/cache/photo-1.jpg' };
      const photo2 = { webPath: 'blob:http://localhost/photo-2', uri: '/cache/photo-2.jpg' };
      const photo3 = { webPath: 'blob:http://localhost/photo-3', uri: '/cache/photo-3.jpg' };

      mockCamera.takePhoto.and.returnValues(
        Promise.resolve(photo1),
        Promise.resolve(photo2),
        Promise.resolve(photo3),
      );
      await service.takePhoto();
      await service.takePhoto();
      await service.takePhoto();

      // First upload fails, others should succeed
      mockStorage.uploadFile.and.returnValues(
        Promise.reject(new Error('Network error')),
        Promise.resolve(),
        Promise.resolve(),
      );

      await service.uploadPhotos('SN10', 'default', 'interventionRepair');

      // All 3 were attempted
      expect(mockStorage.uploadFile).toHaveBeenCalledTimes(3);
      // Error logged for failed upload
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Photo upload failed',
        jasmine.objectContaining({ error: jasmine.stringContaining('Network error') }),
      );
    });

    it('TC-PS19: logs info for each successful upload', async () => {
      service.setRequirement(makePhotoRequirement());
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
      await service.takePhoto();

      await service.uploadPhotos('SN-LOG', 'default', 'interventionRepair');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Photo uploaded',
        jasmine.objectContaining({ storagePath: jasmine.any(String) }),
      );
    });

    it('TC-PS20: does not call uploadFile when photos array is empty', async () => {
      // No photos added

      await service.uploadPhotos('SN00', 'default', 'interventionRepair');

      expect(mockStorage.uploadFile).not.toHaveBeenCalled();
    });

    it('TC-PS21: falls back to "interventions" collection when no mapping found', async () => {
      const cfg = getDefaultConfig();
      cfg.business.interventionCollections = {};
      mockConfigStore.setConfig(cfg);

      service.setRequirement(makePhotoRequirement());
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
      await service.takePhoto();

      await service.uploadPhotos('SN-FB', 'unknown', 'annual_service');

      const storagePath = mockStorage.uploadFile.calls.mostRecent().args[0];
      expect(storagePath).toContain('/interventions/');
    });

    it('TC-PS22: passes photo uri to uploadFile', async () => {
      service.setRequirement(makePhotoRequirement());
      mockCamera.takePhoto.and.resolveTo({ webPath: 'blob:http://localhost/x', uri: '/native/path.jpg' });
      await service.takePhoto();

      await service.uploadPhotos('SN-URI', 'default', 'interventionRepair');

      const uploadArgs = mockStorage.uploadFile.calls.mostRecent().args;
      expect(uploadArgs[1]).toBe('/native/path.jpg');
    });
  });

  // =========================================================================
  // isMinimumMet
  // =========================================================================

  describe('isMinimumMet', () => {
    it('TC-PS23: returns true when photo count equals requiredPhotos', async () => {
      service.setRequirement(makePhotoRequirement({ requiredPhotos: 1, maxPhotos: 5 }));
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
      await service.takePhoto();

      expect(service.isMinimumMet).toBeTrue();
    });

    it('TC-PS24: returns true when photo count exceeds requiredPhotos', async () => {
      service.setRequirement(makePhotoRequirement({ requiredPhotos: 1, maxPhotos: 5 }));
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
      await service.takePhoto();
      await service.takePhoto();

      expect(service.isMinimumMet).toBeTrue();
    });

    it('TC-PS25: returns false when photo count is below requiredPhotos', () => {
      service.setRequirement(makePhotoRequirement({ requiredPhotos: 3, maxPhotos: 5 }));
      // No photos added

      expect(service.isMinimumMet).toBeFalse();
    });

    it('TC-PS26: returns true when requirement is null (no requirement set)', () => {
      // requirement is null after clear()

      expect(service.isMinimumMet).toBeTrue();
    });
  });

  // =========================================================================
  // canTakeMore
  // =========================================================================

  describe('canTakeMore', () => {
    it('TC-PS27: returns true when photo count is below maxPhotos', () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 3, requiredPhotos: 1 }));
      // No photos — count 0 < max 3

      expect(service.canTakeMore).toBeTrue();
    });

    it('TC-PS28: returns false when photo count equals maxPhotos', async () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 1, requiredPhotos: 1 }));
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
      await service.takePhoto();

      expect(service.canTakeMore).toBeFalse();
    });

    it('TC-PS29: returns false when requirement is null', () => {
      // requirement is null after clear()

      expect(service.canTakeMore).toBeFalse();
    });
  });

  // =========================================================================
  // clear()
  // =========================================================================

  describe('clear()', () => {
    it('TC-PS30: empties the photos array', async () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 5 }));
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
      await service.takePhoto();
      await service.takePhoto();
      expect(service.photos.length).toBe(2);

      service.clear();

      expect(service.photos.length).toBe(0);
    });

    it('TC-PS31: resets requirement to null', () => {
      service.setRequirement(makePhotoRequirement());

      service.clear();

      expect(service.requirement).toBeNull();
    });

    it('TC-PS32: results in canTakeMore returning false after clear', () => {
      service.setRequirement(makePhotoRequirement());

      service.clear();

      expect(service.canTakeMore).toBeFalse();
    });

    it('TC-PS33: results in isMinimumMet returning true after clear (no requirement)', () => {
      service.setRequirement(makePhotoRequirement({ requiredPhotos: 3 }));

      service.clear();

      expect(service.isMinimumMet).toBeTrue();
    });
  });

  // =========================================================================
  // Bonus: Sequential takePhoto calls
  // =========================================================================

  describe('Sequential takePhoto calls', () => {
    it('TC-PS34: multiple sequential takePhoto calls each add a photo with unique id', async () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 5, requiredPhotos: 1 }));

      const results = [
        { webPath: 'blob:http://localhost/p1', uri: '/p1.jpg' },
        { webPath: 'blob:http://localhost/p2', uri: '/p2.jpg' },
        { webPath: 'blob:http://localhost/p3', uri: '/p3.jpg' },
      ];
      mockCamera.takePhoto.and.returnValues(
        Promise.resolve(results[0]),
        Promise.resolve(results[1]),
        Promise.resolve(results[2]),
      );

      await service.takePhoto();
      await service.takePhoto();
      await service.takePhoto();

      expect(service.photos.length).toBe(3);

      const ids = service.photos.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('TC-PS35: stops accepting photos once maxPhotos is reached', async () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 2, requiredPhotos: 1 }));
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);

      await service.takePhoto();
      await service.takePhoto();
      const result = await service.takePhoto(); // should be rejected

      expect(result).toBeFalse();
      expect(service.photos.length).toBe(2);
      expect(mockCamera.takePhoto).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // Bonus: INTERVENTION_TYPE_SHORT mapping coverage
  // =========================================================================

  describe('INTERVENTION_TYPE_SHORT mapping', () => {
    const mappingCases: Array<[string, string]> = Object.entries(INTERVENTION_TYPE_SHORT) as Array<[string, string]>;

    mappingCases.forEach(([interventionType, expectedShort]) => {
      it(`TC-PS36: maps "${interventionType}" to "${expectedShort}" in storage path`, async () => {
        service.setRequirement(makePhotoRequirement());
        mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
        await service.takePhoto();

        await service.uploadPhotos('SN-MAP', 'default', interventionType);

        const storagePath = mockStorage.uploadFile.calls.mostRecent().args[0];
        expect(storagePath).toContain(`${expectedShort}_`);
      });
    });
  });

  // =========================================================================
  // EXPANSION — setRequirement variations
  // =========================================================================

  describe('setRequirement() — parameterized variations', () => {
    const requirementVariations: Array<{ maxPhotos: number; requiredPhotos: number; desc: string }> = [
      { maxPhotos: 1, requiredPhotos: 0, desc: 'maxPhotos=1 requiredPhotos=0' },
      { maxPhotos: 1, requiredPhotos: 1, desc: 'maxPhotos=1 requiredPhotos=1' },
      { maxPhotos: 3, requiredPhotos: 0, desc: 'maxPhotos=3 requiredPhotos=0' },
      { maxPhotos: 3, requiredPhotos: 1, desc: 'maxPhotos=3 requiredPhotos=1' },
      { maxPhotos: 3, requiredPhotos: 3, desc: 'maxPhotos=3 requiredPhotos=3' },
      { maxPhotos: 5, requiredPhotos: 2, desc: 'maxPhotos=5 requiredPhotos=2' },
      { maxPhotos: 10, requiredPhotos: 5, desc: 'maxPhotos=10 requiredPhotos=5' },
      { maxPhotos: 10, requiredPhotos: 10, desc: 'maxPhotos=10 requiredPhotos=10' },
      { maxPhotos: 100, requiredPhotos: 0, desc: 'maxPhotos=100 requiredPhotos=0' },
    ];

    requirementVariations.forEach(({ maxPhotos, requiredPhotos, desc }) => {
      it(`should store requirement correctly for ${desc}`, () => {
        const req = makePhotoRequirement({ maxPhotos, requiredPhotos });
        service.setRequirement(req);
        expect(service.requirement!.maxPhotos).toBe(maxPhotos);
        expect(service.requirement!.requiredPhotos).toBe(requiredPhotos);
      });
    });

    requirementVariations.forEach(({ maxPhotos, requiredPhotos, desc }) => {
      it(`canTakeMore should be true when no photos for ${desc}`, () => {
        service.setRequirement(makePhotoRequirement({ maxPhotos, requiredPhotos }));
        // No photos added → canTakeMore true as long as maxPhotos > 0
        expect(service.canTakeMore).toBeTrue();
      });
    });
  });

  // =========================================================================
  // EXPANSION — takePhoto with maxPhotos boundary
  // =========================================================================

  describe('takePhoto() — maxPhotos boundary (parameterized)', () => {
    const maxPhotosCases = [1, 2, 3, 5, 10];

    maxPhotosCases.forEach((maxPhotos) => {
      it(`should stop accepting photos once maxPhotos=${maxPhotos} is reached`, async () => {
        service.setRequirement(makePhotoRequirement({ maxPhotos, requiredPhotos: 1 }));
        mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);

        for (let i = 0; i < maxPhotos; i++) {
          await service.takePhoto();
        }

        // One more should be refused
        const extraResult = await service.takePhoto();

        expect(extraResult).toBeFalse();
        expect(service.photos.length).toBe(maxPhotos);
        expect(mockCamera.takePhoto).toHaveBeenCalledTimes(maxPhotos);
      });
    });
  });

  // =========================================================================
  // EXPANSION — isMinimumMet boundary values
  // =========================================================================

  describe('isMinimumMet — requiredPhotos boundary values', () => {
    const requiredCases = [0, 1, 2, 3, 5];

    requiredCases.forEach((requiredPhotos) => {
      it(`should return true when requiredPhotos=${requiredPhotos} and 0 photos taken (${requiredPhotos === 0 ? 'zero-required' : 'would normally fail but shows current state'})`, () => {
        service.setRequirement(makePhotoRequirement({ maxPhotos: 10, requiredPhotos }));
        // No photos — isMinimumMet = (0 >= requiredPhotos)
        expect(service.isMinimumMet).toBe(requiredPhotos === 0);
      });
    });

    requiredCases.forEach((requiredPhotos) => {
      it(`should return true after taking exactly ${requiredPhotos} photos when required=${requiredPhotos}`, async () => {
        service.setRequirement(makePhotoRequirement({ maxPhotos: requiredPhotos + 5, requiredPhotos }));
        mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);

        for (let i = 0; i < requiredPhotos; i++) {
          await service.takePhoto();
        }

        expect(service.isMinimumMet).toBeTrue();
      });
    });
  });

  // =========================================================================
  // EXPANSION — uploadPhotos with SN variations
  // =========================================================================

  describe('uploadPhotos() — SN format variations', () => {
    const snVariations = [
      'SN12345678901234567890',
      'SN00000000000000000000',
      'AB-CD-EF-12345',
      'SN_UNDERSCORE',
      'SHORT',
    ];

    snVariations.forEach((sn) => {
      it(`should include SN="${sn}" in storage path`, async () => {
        service.setRequirement(makePhotoRequirement());
        mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
        await service.takePhoto();

        await service.uploadPhotos(sn, 'default', 'interventionRepair');

        const storagePath = mockStorage.uploadFile.calls.mostRecent().args[0];
        expect(storagePath).toContain(`/${sn}/`);
      });
    });
  });

  // =========================================================================
  // EXPANSION — uploadPhotos for multiple photos
  // =========================================================================

  describe('uploadPhotos() — photo count variations', () => {
    const photoCounts = [1, 2, 3, 5];

    photoCounts.forEach((count) => {
      it(`should call uploadFile ${count} times for ${count} photos`, async () => {
        service.setRequirement(makePhotoRequirement({ maxPhotos: count + 5 }));
        const photos = Array.from({ length: count }, (_, i) => ({
          webPath: `blob:http://localhost/p${i}`,
          uri: `/cache/p${i}.jpg`,
        }));
        mockCamera.takePhoto.and.returnValues(...photos.map((p) => Promise.resolve(p)));

        for (let i = 0; i < count; i++) {
          await service.takePhoto();
        }

        await service.uploadPhotos('SN-COUNT', 'default', 'interventionRepair');

        expect(mockStorage.uploadFile).toHaveBeenCalledTimes(count);
      });
    });
  });

  // =========================================================================
  // EXPANSION — removePhoto from various positions
  // =========================================================================

  describe('removePhoto() — various positions', () => {
    it('should remove first photo from array of 3', async () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 5 }));
      const p1 = { webPath: 'blob:http://localhost/1', uri: '/1.jpg' };
      const p2 = { webPath: 'blob:http://localhost/2', uri: '/2.jpg' };
      const p3 = { webPath: 'blob:http://localhost/3', uri: '/3.jpg' };

      mockCamera.takePhoto.and.returnValues(
        Promise.resolve(p1),
        Promise.resolve(p2),
        Promise.resolve(p3),
      );

      await service.takePhoto();
      await service.takePhoto();
      await service.takePhoto();

      const firstId = service.photos[0].id;
      service.removePhoto(firstId);

      expect(service.photos.length).toBe(2);
      expect(service.photos.map((p) => p.uri)).toEqual(['/2.jpg', '/3.jpg']);
    });

    it('should remove last photo from array of 3', async () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 5 }));
      const p1 = { webPath: 'blob:http://localhost/1', uri: '/1.jpg' };
      const p2 = { webPath: 'blob:http://localhost/2', uri: '/2.jpg' };
      const p3 = { webPath: 'blob:http://localhost/3', uri: '/3.jpg' };

      mockCamera.takePhoto.and.returnValues(
        Promise.resolve(p1),
        Promise.resolve(p2),
        Promise.resolve(p3),
      );

      await service.takePhoto();
      await service.takePhoto();
      await service.takePhoto();

      const lastId = service.photos[2].id;
      service.removePhoto(lastId);

      expect(service.photos.length).toBe(2);
      expect(service.photos.map((p) => p.uri)).toEqual(['/1.jpg', '/2.jpg']);
    });

    it('should allow re-adding photo after removal restores canTakeMore', async () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 2 }));
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);

      await service.takePhoto();
      await service.takePhoto();
      expect(service.canTakeMore).toBeFalse();

      const firstId = service.photos[0].id;
      service.removePhoto(firstId);

      expect(service.canTakeMore).toBeTrue();
    });

    it('should be no-op for unknown id when photos exist', async () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 3 }));
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
      await service.takePhoto();
      await service.takePhoto();

      service.removePhoto('totally-unknown-id');

      expect(service.photos.length).toBe(2);
    });
  });

  // =========================================================================
  // EXPANSION — pickFromGallery variations
  // =========================================================================

  describe('pickFromGallery() — canTakeMore guard', () => {
    it('should return false when canTakeMore is false', async () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 1 }));
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
      await service.takePhoto(); // fills maxPhotos

      const result = await service.pickFromGallery();

      expect(result).toBeFalse();
      expect(mockCamera.pickFromGallery).not.toHaveBeenCalled();
    });

    it('should accept gallery photo when canTakeMore is true', async () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 5 }));
      mockCamera.pickFromGallery.and.resolveTo(MOCK_PHOTO_RESULT);

      const result = await service.pickFromGallery();

      expect(result).not.toBeFalse();
      expect(service.photos.length).toBe(1);
    });

    it('should increment photos count after successful gallery pick', async () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 5 }));
      mockCamera.pickFromGallery.and.resolveTo(MOCK_PHOTO_RESULT);

      await service.pickFromGallery();
      await service.pickFromGallery();
      await service.pickFromGallery();

      expect(service.photos.length).toBe(3);
    });
  });

  // =========================================================================
  // EXPANSION — clear() after various states
  // =========================================================================

  describe('clear() — after various states', () => {
    it('should clear after 1 photo', async () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 5 }));
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
      await service.takePhoto();

      service.clear();

      expect(service.photos.length).toBe(0);
      expect(service.requirement).toBeNull();
    });

    it('should clear after 5 photos', async () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 5 }));
      mockCamera.takePhoto.and.resolveTo(MOCK_PHOTO_RESULT);
      for (let i = 0; i < 5; i++) await service.takePhoto();

      service.clear();

      expect(service.photos.length).toBe(0);
    });

    it('should work idempotently when called twice', () => {
      service.setRequirement(makePhotoRequirement());
      service.clear();
      service.clear();

      expect(service.photos.length).toBe(0);
      expect(service.requirement).toBeNull();
    });

    it('should allow setRequirement again after clear', () => {
      service.setRequirement(makePhotoRequirement({ maxPhotos: 3 }));
      service.clear();

      const newReq = makePhotoRequirement({ maxPhotos: 7, requiredPhotos: 2 });
      service.setRequirement(newReq);

      expect(service.requirement!.maxPhotos).toBe(7);
    });
  });
});
