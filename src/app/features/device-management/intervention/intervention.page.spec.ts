/**
 * InterventionPage Unit Tests — WU-42, Batch B6
 *
 * MOCK STRATEGY
 * =============
 * DeviceLookupService:       jasmine.createSpyObj (device property set directly)
 * InterventionService:       jasmine.createSpyObj (saveIntervention)
 * DeviceEnvInfoService:      jasmine.createSpyObj (collectEnvInfo, getLastEnvInfo)
 * DeviceRegistrationService: jasmine.createSpyObj (userData property set directly)
 * CartService:               jasmine.createSpyObj (context property set directly)
 * ConfirmService:            jasmine.createSpyObj (confirm)
 * LoadingAlertService:       jasmine.createSpyObj (show, hide)
 * PhotoService:              jasmine.createSpyObj (clear, uploadPhotos, setRequirement, photos)
 * SignatureService:          jasmine.createSpyObj (captureAndUpload) — required by page injection
 * ConfigStore:               createMockConfigStore() — NgRx SignalStore cannot use createSpyObj
 * ActivatedRoute:            plain object with snapshot.paramMap.get stub
 * Router:                    createMockRouter()
 * ToastController:           createMockToastController()
 * ModalController:           createMockModalController()
 * TranslocoService:          createMockTranslocoService()
 * LoggerService:             createMockLoggerService()
 *
 * NOTE — protected member access:
 * InterventionPage declares `form`, `spareParts`, `photoRequirement`, etc. as
 * `protected`. Tests access them via `(component as any)` — the standard pattern
 * for Angular component unit tests, as established in the project's existing specs.
 *
 * NOTE — faultDescriptions / errorCodes shape:
 * As of the current app version ionViewWillEnter() maps raw string arrays from
 * ConfigStore through transloco.translate(), producing { key: string; label: string }[]
 * (not string[]). All assertions on these arrays use jasmine.objectContaining({key}).
 *
 * NOTE — showToast color:
 * The private showToast() helper does not pass a `color` property when creating
 * the Ionic toast (it passes only message, duration, position). Toast color
 * assertions therefore do not check for a `color` field.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { ToastController, ModalController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';

import { InterventionPage } from './intervention.page';
import { DeviceLookupService } from '../services/device-lookup.service';
import { InterventionService } from '../services/intervention.service';
import { DeviceEnvInfoService } from '../services/device-env-info.service';
import { DeviceRegistrationService } from '../services/device-registration.service';
import { CartService } from '../../cart/cart.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { LoadingAlertService } from '../../../shared/services/loading-alert.service';
import { PhotoService } from '../../photo-upload/services/photo.service';
import { SignatureService } from '../../signature/services/signature.service';
import { ConfigStore } from '../../../core/config/config.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { Device, DeviceType } from '../../../shared/models/device.model';
import { AppConfig, getDefaultConfig, PhotoRequirement } from '../../../core/config/config.model';
import {
  InterventionType,
  INTERVENTION_OPTIONS,
  ANNUAL_SERVICE_TYPES,
  MAX_SPARE_PARTS,
} from '../models/intervention.model';
import {
  createMockConfigStore,
  createMockToastController,
  createMockModalController,
  createMockTranslocoService,
  createMockLoggerService,
  MockConfigStore,
} from '../../../testing/mock-factories';

// ─── Factories ────────────────────────────────────────────────────────────────

function createMockDevice(overrides: Partial<Device> = {}): Device {
  return {
    code: 'GENUS24',
    name: 'Genus One 24',
    type: DeviceType.GAS_BOILER,
    subType: 'standard',
    unitCount: 1,
    exists: true,
    annualService: false,
    ...overrides,
  };
}

function buildConfigWithPhotoConfig(
  deviceType: DeviceType,
  interventionType: string,
  requirement: PhotoRequirement,
): AppConfig {
  const cfg = getDefaultConfig();
  cfg.interventionPhotoConfig = { [deviceType]: { [interventionType]: requirement } };
  cfg.features.interventionPhotos = true;
  return cfg;
}

function buildConfigWithFaultAndErrorOptions(
  deviceType: DeviceType,
  faultOptions: string[],
  errorOptions: string[],
): AppConfig {
  const cfg = getDefaultConfig();
  cfg.interventionFaultOptions = { [deviceType]: faultOptions };
  cfg.interventionErrorOptions = { [deviceType]: errorOptions };
  return cfg;
}

// ─── Main describe ─────────────────────────────────────────────────────────────

describe('InterventionPage', () => {
  let component: InterventionPage;

  let mockLookupService: jasmine.SpyObj<DeviceLookupService>;
  let mockInterventionService: jasmine.SpyObj<InterventionService>;
  let mockEnvInfoService: jasmine.SpyObj<DeviceEnvInfoService>;
  let mockRegistrationService: jasmine.SpyObj<DeviceRegistrationService>;
  let mockCartService: jasmine.SpyObj<CartService>;
  let mockConfirmService: jasmine.SpyObj<ConfirmService>;
  let mockLoadingAlert: jasmine.SpyObj<LoadingAlertService>;
  let mockPhotoService: jasmine.SpyObj<PhotoService>;
  let mockSignatureService: jasmine.SpyObj<SignatureService>;
  let mockConfigStore: MockConfigStore;
  let mockRouter: Router;
  let mockToastCtrl: jasmine.SpyObj<ToastController>;
  let mockModalCtrl: jasmine.SpyObj<ModalController>;
  let mockTransloco: jasmine.SpyObj<TranslocoService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockActivatedRoute: { snapshot: { paramMap: { get: jasmine.Spy } } };

  beforeEach(async () => {
    mockLookupService = jasmine.createSpyObj<DeviceLookupService>('DeviceLookupService', ['lookup', 'clear']);
    (mockLookupService as any).device = null;

    mockInterventionService = jasmine.createSpyObj<InterventionService>('InterventionService', ['saveIntervention']);
    mockInterventionService.saveIntervention.and.resolveTo('doc-001');

    mockEnvInfoService = jasmine.createSpyObj<DeviceEnvInfoService>('DeviceEnvInfoService', [
      'collectEnvInfo',
      'getLastEnvInfo',
    ]);
    mockEnvInfoService.collectEnvInfo.and.resolveTo({ gasType: 'env_info_opt_gas_natural' });
    mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);

    mockRegistrationService = jasmine.createSpyObj<DeviceRegistrationService>('DeviceRegistrationService', [
      'checkRegistration',
    ]);
    (mockRegistrationService as any).userData = null;

    mockCartService = jasmine.createSpyObj<CartService>('CartService', ['addItem', 'clear']);
    (mockCartService as any).context = null;

    mockConfirmService = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['confirm']);
    mockConfirmService.confirm.and.resolveTo(true);

    mockLoadingAlert = jasmine.createSpyObj<LoadingAlertService>('LoadingAlertService', ['show', 'hide', 'wrap']);
    mockLoadingAlert.show.and.resolveTo();
    mockLoadingAlert.hide.and.resolveTo();

    mockPhotoService = jasmine.createSpyObj<PhotoService>('PhotoService', [
      'clear',
      'uploadPhotos',
      'setRequirement',
    ]);
    mockPhotoService.clear.and.stub();
    mockPhotoService.uploadPhotos.and.resolveTo();
    mockPhotoService.setRequirement.and.stub();
    (mockPhotoService as any).photos = [];

    // SignatureService is injected by InterventionPage; feature flag is OFF by default
    // so captureAndUpload is never called in normal test scenarios
    mockSignatureService = jasmine.createSpyObj<SignatureService>('SignatureService', ['captureAndUpload']);
    mockSignatureService.captureAndUpload.and.resolveTo('signatures/mock-path.png');

    mockConfigStore = createMockConfigStore();
    mockConfigStore.setConfig(getDefaultConfig());

    mockToastCtrl = createMockToastController();
    mockModalCtrl = createMockModalController();
    mockTransloco = createMockTranslocoService();
    mockLogger = createMockLoggerService();

    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: jasmine.createSpy('get').and.returnValue('SN001'),
        },
      },
    };

    await TestBed.configureTestingModule({
      imports: [InterventionPage, ReactiveFormsModule],
      providers: [
        { provide: DeviceLookupService, useValue: mockLookupService },
        { provide: InterventionService, useValue: mockInterventionService },
        { provide: DeviceEnvInfoService, useValue: mockEnvInfoService },
        { provide: DeviceRegistrationService, useValue: mockRegistrationService },
        { provide: CartService, useValue: mockCartService },
        { provide: ConfirmService, useValue: mockConfirmService },
        { provide: LoadingAlertService, useValue: mockLoadingAlert },
        { provide: PhotoService, useValue: mockPhotoService },
        { provide: SignatureService, useValue: mockSignatureService },
        { provide: ConfigStore, useValue: mockConfigStore },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ToastController, useValue: mockToastCtrl },
        { provide: ModalController, useValue: mockModalCtrl },
        { provide: TranslocoService, useValue: mockTransloco },
        provideRouter([]),
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(InterventionPage);
    component = fixture.componentInstance;
    // Use the real router from provideRouter([]) and spy on navigate
    mockRouter = TestBed.inject(Router);
    spyOn(mockRouter, 'navigate').and.resolveTo(true);
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  /** Set device on the mock lookup service (plain property) */
  function setDevice(device: Device | null): void {
    (mockLookupService as any).device = device;
  }

  /** Set photos array on the mock photo service (plain property) */
  function setPhotos(photos: unknown[]): void {
    (mockPhotoService as any).photos = photos;
  }

  /**
   * Fill the protected form with valid values via any-cast.
   * Standard pattern for Angular component unit tests when form is protected.
   */
  function fillValidForm(
    warrantyStatus = 'in-warranty',
    interventionType: string = InterventionType.INTERVENTION_REPAIR,
  ): void {
    const c = component as any;
    c.form.controls.warrantyStatus.setValue(warrantyStatus);
    c.form.controls.interventionType.setValue(interventionType);
    c.form.controls.description.setValue('Test fault description');
  }

  // =========================================================================
  // Lifecycle — ionViewWillEnter
  // =========================================================================

  describe('ionViewWillEnter()', () => {
    it('TC-IP-01: loads device data from lookupService and sets deviceType', () => {
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      setDevice(device);

      component.ionViewWillEnter();

      expect((component as any).deviceType).toBe(DeviceType.GAS_BOILER);
      expect((component as any).noDevice).toBeFalse();
    });

    it('TC-IP-02: loads fault options and error options from ConfigStore for device type', () => {
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      setDevice(device);
      mockConfigStore.setConfig(buildConfigWithFaultAndErrorOptions(
        DeviceType.GAS_BOILER,
        ['Fault A', 'Fault B'],
        ['Error 1', 'Error 2'],
      ));

      component.ionViewWillEnter();

      // ionViewWillEnter maps string arrays through transloco.translate() producing {key,label}[] objects
      const faults: Array<{ key: string; label: string }> = (component as any).faultDescriptions;
      expect(faults).toEqual([
        { key: 'Fault A', label: 'Fault A' },
        { key: 'Fault B', label: 'Fault B' },
      ]);
      const errors: Array<{ key: string; label: string }> = (component as any).errorCodes;
      expect(errors).toEqual([
        { key: 'Error 1', label: 'Error 1' },
        { key: 'Error 2', label: 'Error 2' },
      ]);
    });

    it('TC-IP-03: resets photoRequirement to null on enter', () => {
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      setDevice(device);
      // Pre-set to non-null
      (component as any).photoRequirement = { requiredPhotos: 1, maxPhotos: 2, requireSparePartPhotos: false, description: 'x' };

      component.ionViewWillEnter();

      expect((component as any).photoRequirement).toBeNull();
    });

    it('TC-IP-04: sets noDevice=true and logs warning when lookupService.device is null', () => {
      setDevice(null);

      component.ionViewWillEnter();

      expect((component as any).noDevice).toBeTrue();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'InterventionPage: no device data',
        jasmine.objectContaining({ sn: 'SN001' }),
      );
    });

    it('TC-IP-05: calls photoService.clear() on enter', () => {
      const device = createMockDevice();
      setDevice(device);

      component.ionViewWillEnter();

      expect(mockPhotoService.clear).toHaveBeenCalledTimes(1);
    });

    it('TC-IP-06: reads sn from route snapshot paramMap', () => {
      const device = createMockDevice();
      setDevice(device);
      mockActivatedRoute.snapshot.paramMap.get.and.returnValue('SN-TEST-123');

      component.ionViewWillEnter();

      expect((component as any).sn).toBe('SN-TEST-123');
    });
  });

  // =========================================================================
  // updateInterventionTypes
  // =========================================================================

  describe('updateInterventionTypes()', () => {
    beforeEach(() => {
      setDevice(createMockDevice({ type: DeviceType.BOILER, annualService: false }));
      component.ionViewWillEnter();
    });

    it('TC-IP-07: in_warranty → all INTERVENTION_OPTIONS shown including INTERVENTION_REPLACE', () => {
      (component as any).form.controls.warrantyStatus.setValue('in-warranty');

      component.updateInterventionTypes();

      const types: Array<{ key: string }> = (component as any).interventionTypes;
      const expected = INTERVENTION_OPTIONS[DeviceType.BOILER] ?? [];
      expect(types.length).toBe(expected.length);
      expect(types.map(t => t.key)).toContain(InterventionType.INTERVENTION_REPLACE);
    });

    it('TC-IP-08: out_of_warranty → INTERVENTION_REPLACE filtered out', () => {
      (component as any).form.controls.warrantyStatus.setValue('out-of-warranty');

      component.updateInterventionTypes();

      const keys: string[] = ((component as any).interventionTypes as Array<{ key: string }>).map(t => t.key);
      expect(keys).not.toContain(InterventionType.INTERVENTION_REPLACE);
    });

    it('TC-IP-09: out_of_warranty + annualService=true → annual service type appended', () => {
      setDevice(createMockDevice({ type: DeviceType.GAS_BOILER, annualService: true }));
      component.ionViewWillEnter();
      (component as any).form.controls.warrantyStatus.setValue('out-of-warranty');

      component.updateInterventionTypes();

      const keys: string[] = ((component as any).interventionTypes as Array<{ key: string }>).map(t => t.key);
      const annualType = ANNUAL_SERVICE_TYPES[DeviceType.GAS_BOILER];
      expect(annualType).toBeDefined();
      expect(keys).toContain(annualType!.key);
    });

    it('TC-IP-10: out_of_warranty + annualService=false → annual service type NOT appended', () => {
      setDevice(createMockDevice({ type: DeviceType.GAS_BOILER, annualService: false }));
      component.ionViewWillEnter();
      (component as any).form.controls.warrantyStatus.setValue('out-of-warranty');

      component.updateInterventionTypes();

      const keys: string[] = ((component as any).interventionTypes as Array<{ key: string }>).map(t => t.key);
      expect(keys).not.toContain(InterventionType.ANNUAL_SERVICE);
    });
  });

  // =========================================================================
  // updatePhotoRequirement
  // =========================================================================

  describe('updatePhotoRequirement()', () => {
    it('TC-IP-11: sets photoRequirement from configStore for current device+interventionType', () => {
      const requirement: PhotoRequirement = {
        maxPhotos: 5,
        requiredPhotos: 2,
        requireSparePartPhotos: false,
        description: 'Take photos of the defect',
      };
      mockConfigStore.setConfig(buildConfigWithPhotoConfig(
        DeviceType.GAS_BOILER,
        InterventionType.INTERVENTION_REPAIR,
        requirement,
      ));
      setDevice(createMockDevice({ type: DeviceType.GAS_BOILER }));
      component.ionViewWillEnter();
      (component as any).form.controls.interventionType.setValue(InterventionType.INTERVENTION_REPAIR);

      component.updatePhotoRequirement();

      expect((component as any).photoRequirement).toEqual(requirement);
    });

    it('TC-IP-12: sets photoRequirement to null when no interventionType selected', () => {
      setDevice(createMockDevice({ type: DeviceType.GAS_BOILER }));
      component.ionViewWillEnter();
      (component as any).form.controls.interventionType.setValue('');

      component.updatePhotoRequirement();

      expect((component as any).photoRequirement).toBeNull();
    });

    it('TC-IP-13: calls photoService.setRequirement when photoRequirement resolves to non-null', () => {
      const requirement: PhotoRequirement = {
        maxPhotos: 3,
        requiredPhotos: 1,
        requireSparePartPhotos: false,
        description: 'Photo required',
      };
      mockConfigStore.setConfig(buildConfigWithPhotoConfig(
        DeviceType.GAS_BOILER,
        InterventionType.INTERVENTION_REPAIR,
        requirement,
      ));
      setDevice(createMockDevice({ type: DeviceType.GAS_BOILER }));
      component.ionViewWillEnter();
      (component as any).form.controls.interventionType.setValue(InterventionType.INTERVENTION_REPAIR);

      component.updatePhotoRequirement();

      expect(mockPhotoService.setRequirement).toHaveBeenCalledWith(requirement);
    });

    it('TC-IP-BUG01: should NOT call console.log directly (BUG-01 fixed)', () => {
      spyOn(console, 'log');
      setDevice(createMockDevice({ type: DeviceType.GAS_BOILER }));
      component.ionViewWillEnter();
      (component as any).form.controls.interventionType.setValue(InterventionType.INTERVENTION_REPAIR);

      component.updatePhotoRequirement();

      expect(console.log).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Spare parts
  // =========================================================================

  describe('Spare parts', () => {
    beforeEach(() => {
      setDevice(createMockDevice());
      component.ionViewWillEnter();
    });

    it('TC-IP-14: addPart() adds a new spare part control to spareParts FormArray', () => {
      const initialLength = (component as any).spareParts.length;

      component.addPart();

      expect((component as any).spareParts.length).toBe(initialLength + 1);
    });

    it('TC-IP-15: removePart() removes the last spare part control', () => {
      component.addPart(); // ensure 2 parts
      const lengthBefore = (component as any).spareParts.length;

      component.removePart();

      expect((component as any).spareParts.length).toBe(lengthBefore - 1);
    });

    it('TC-IP-16: addPart() does not exceed MAX_SPARE_PARTS limit', () => {
      for (let i = 0; i < MAX_SPARE_PARTS + 5; i++) {
        component.addPart();
      }

      expect((component as any).spareParts.length).toBeLessThanOrEqual(MAX_SPARE_PARTS);
    });

    it('TC-IP-17: removePart() does not reduce spareParts below 1', () => {
      // Only 1 part initially (from resetForm) — try to remove
      component.removePart();

      expect((component as any).spareParts.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // Form validation (exercised via onSave)
  // =========================================================================

  describe('Form validation (via onSave)', () => {
    beforeEach(() => {
      setDevice(createMockDevice({ type: DeviceType.BOILER }));
      component.ionViewWillEnter();
    });

    it('TC-IP-18: shows toast and blocks save when warrantyStatus is empty', async () => {
      (component as any).form.controls.warrantyStatus.setValue('');
      (component as any).form.controls.interventionType.setValue(InterventionType.INTERVENTION_REPAIR);
      (component as any).form.controls.description.setValue('Fault');

      await component.onSave();

      // showToast() creates the toast without a color property (only message, duration, position)
      expect(mockToastCtrl.create).toHaveBeenCalledWith(jasmine.objectContaining({ message: jasmine.any(String) }));
      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
    });

    it('TC-IP-19: shows toast and blocks save when interventionType is empty', async () => {
      (component as any).form.controls.warrantyStatus.setValue('in-warranty');
      (component as any).form.controls.interventionType.setValue('');
      (component as any).form.controls.description.setValue('Fault');

      await component.onSave();

      expect(mockToastCtrl.create).toHaveBeenCalledWith(jasmine.objectContaining({ message: jasmine.any(String) }));
      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
    });

    it('TC-IP-20: shows toast and blocks save when description is empty', async () => {
      (component as any).form.controls.warrantyStatus.setValue('in-warranty');
      (component as any).form.controls.interventionType.setValue(InterventionType.INTERVENTION_REPAIR);
      (component as any).form.controls.description.setValue('');

      await component.onSave();

      expect(mockToastCtrl.create).toHaveBeenCalledWith(jasmine.objectContaining({ message: jasmine.any(String) }));
      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
    });

    it('TC-IP-21: shows toast when spare part photos required but not enough uploaded', async () => {
      const requirement: PhotoRequirement = {
        maxPhotos: 5,
        requiredPhotos: 2,
        requireSparePartPhotos: true,
        description: 'Photos required',
      };
      (component as any).form.controls.warrantyStatus.setValue('in-warranty');
      (component as any).form.controls.interventionType.setValue(InterventionType.INTERVENTION_REPAIR);
      (component as any).form.controls.description.setValue('Fault');
      // Set photoRequirement so validation runs
      (component as any).photoRequirement = requirement;
      // Add 1 non-empty spare part → totalRequired = 2 + 1 = 3
      (component as any).spareParts.controls[0].setValue('PART-001');
      // 0 photos uploaded → fails
      setPhotos([]);

      await component.onSave();

      expect(mockToastCtrl.create).toHaveBeenCalledWith(jasmine.objectContaining({ message: jasmine.any(String) }));
      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // onSave() — happy path
  // =========================================================================

  describe('onSave()', () => {
    describe('Non-envInfo device (BOILER)', () => {
      beforeEach(() => {
        setDevice(createMockDevice({ type: DeviceType.BOILER }));
        component.ionViewWillEnter();
        fillValidForm('in-warranty', InterventionType.INTERVENTION_REPAIR);
      });

      it('TC-IP-22: calls confirmService.confirm for non-envInfo device', async () => {
        await component.onSave();

        expect(mockConfirmService.confirm).toHaveBeenCalledTimes(1);
      });

      it('TC-IP-23: aborts save when confirmService.confirm returns false', async () => {
        mockConfirmService.confirm.and.resolveTo(false);

        await component.onSave();

        expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
      });

      it('TC-IP-24: calls photoService.uploadPhotos when photos exist', async () => {
        setPhotos([{ id: 'photo-1', webPath: '/path/1', uri: 'file:///1' }]);

        await component.onSave();

        expect(mockPhotoService.uploadPhotos).toHaveBeenCalledWith(
          'SN001',
          DeviceType.BOILER,
          InterventionType.INTERVENTION_REPAIR,
        );
      });

      it('TC-IP-25: calls interventionService.saveIntervention with correct sn and device', async () => {
        await component.onSave();

        expect(mockInterventionService.saveIntervention).toHaveBeenCalledWith(
          'SN001',
          jasmine.objectContaining({ type: DeviceType.BOILER }),
          jasmine.any(Object),
        );
      });

      it('TC-IP-26: navigates to /device-management/:sn after successful save', async () => {
        await component.onSave();

        expect(mockRouter.navigate).toHaveBeenCalledWith(['/device-management', 'SN001']);
      });

      it('TC-IP-27: shows toast when saveIntervention returns null', async () => {
        mockInterventionService.saveIntervention.and.resolveTo(null);

        await component.onSave();

        // showToast() creates the toast without a color property (only message, duration, position)
        expect(mockToastCtrl.create).toHaveBeenCalledWith(jasmine.objectContaining({ message: jasmine.any(String) }));
      });

      it('TC-IP-28: calls photoService.clear after successful save', async () => {
        // ionViewWillEnter called clear once already; after save it should be called again
        const callsBefore = mockPhotoService.clear.calls.count();

        await component.onSave();

        expect(mockPhotoService.clear.calls.count()).toBeGreaterThan(callsBefore);
      });

      it('TC-IP-29: does NOT call photoService.uploadPhotos when no photos', async () => {
        setPhotos([]);

        await component.onSave();

        expect(mockPhotoService.uploadPhotos).not.toHaveBeenCalled();
      });
    });

    describe('EnvInfo device (GAS_BOILER)', () => {
      beforeEach(() => {
        setDevice(createMockDevice({ type: DeviceType.GAS_BOILER }));
        component.ionViewWillEnter();
        fillValidForm('in-warranty', InterventionType.INTERVENTION_REPAIR);
      });

      it('TC-IP-30: calls getLastEnvInfo for prefill on GAS_BOILER/HEAT_PUMP device', async () => {
        mockEnvInfoService.getLastEnvInfo.and.resolveTo({ gasType: 'env_info_opt_gas_natural' });

        await component.onSave();

        expect(mockEnvInfoService.getLastEnvInfo).toHaveBeenCalledWith('SN001', DeviceType.GAS_BOILER);
      });

      it('TC-IP-31: passes prefill data to collectEnvInfo', async () => {
        const prefill = { gasType: 'env_info_opt_gas_natural', voltage: '230' };
        mockEnvInfoService.getLastEnvInfo.and.resolveTo(prefill);

        await component.onSave();

        // collectEnvInfo is called with (deviceType, sn, prefill, device.subType)
        // createMockDevice() sets subType: 'standard'
        expect(mockEnvInfoService.collectEnvInfo).toHaveBeenCalledWith(
          DeviceType.GAS_BOILER,
          'SN001',
          prefill,
          'standard',
        );
      });

      it('TC-IP-32: aborts save when collectEnvInfo returns null (user cancelled env info)', async () => {
        mockEnvInfoService.collectEnvInfo.and.resolveTo(null);

        await component.onSave();

        expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
      });

      it('TC-IP-33: includes envInfo in the payload passed to saveIntervention', async () => {
        const envData = { gasType: 'env_info_opt_gas_natural', voltage: '220' };
        mockEnvInfoService.collectEnvInfo.and.resolveTo(envData);

        await component.onSave();

        const savedData = mockInterventionService.saveIntervention.calls.mostRecent().args[2] as Record<string, unknown>;
        expect(savedData['envInfo']).toEqual(envData);
      });

      it('TC-IP-34: shows loadingAlert (show then hide) during env info collection', async () => {
        await component.onSave();

        expect(mockLoadingAlert.show).toHaveBeenCalled();
        expect(mockLoadingAlert.hide).toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // onExplodedView()
  // =========================================================================

  describe('onExplodedView()', () => {
    beforeEach(() => {
      setDevice(createMockDevice({ type: DeviceType.GAS_BOILER, code: 'GENUS24', name: 'Genus One 24' }));
      component.ionViewWillEnter();
    });

    it('TC-IP-35: sets cart context with source=intervention and correct device fields', () => {
      (component as any).form.controls.warrantyStatus.setValue('in-warranty');

      component.onExplodedView();

      const ctx = (mockCartService as any).context as Record<string, unknown>;
      expect(ctx).toBeTruthy();
      expect(ctx['source']).toBe('intervention');
      expect(ctx['deviceType']).toBe(DeviceType.GAS_BOILER);
      expect(ctx['deviceCode']).toBe('GENUS24');
      expect(ctx['deviceName']).toBe('Genus One 24');
    });

    it('TC-IP-36: cart context includes warrantyStatus from form', () => {
      (component as any).form.controls.warrantyStatus.setValue('out-of-warranty');

      component.onExplodedView();

      const ctx = (mockCartService as any).context as Record<string, unknown>;
      expect(ctx['warrantyStatus']).toBe('out-of-warranty');
    });

    it('TC-IP-37: shows toast and does NOT navigate when warrantyStatus is empty', async () => {
      (component as any).form.controls.warrantyStatus.setValue('');

      component.onExplodedView();
      await new Promise(resolve => setTimeout(resolve, 10));

      // showToast() creates the toast without a color property (only message, duration, position)
      expect(mockToastCtrl.create).toHaveBeenCalledWith(jasmine.objectContaining({ message: jasmine.any(String) }));
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('TC-IP-38: navigates to /device/:code/device-groups after setting context', async () => {
      (component as any).form.controls.warrantyStatus.setValue('in-warranty');

      component.onExplodedView();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/device', 'GENUS24', 'device-groups']);
    });

    it('TC-IP-39: cart context includes userName and userPhone from registrationService.userData', () => {
      (mockRegistrationService as any).userData = {
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '+381601234567',
        streetName: 'Main St',
        homeNumber: '5',
        postCode: '11000',
        city: 'Belgrade',
      };
      (component as any).form.controls.warrantyStatus.setValue('in-warranty');

      component.onExplodedView();

      const ctx = (mockCartService as any).context as Record<string, unknown>;
      expect(ctx['userName']).toBe('John Doe');
      expect(ctx['userPhone']).toBe('+381601234567');
    });
  });

  // =========================================================================
  // resetForm() — exercised via ionViewWillEnter
  // =========================================================================

  describe('resetForm() — via ionViewWillEnter', () => {
    it('TC-IP-40: clears all form controls to empty/default values on enter', () => {
      setDevice(createMockDevice());
      // Pre-fill form
      (component as any).form.controls.warrantyStatus.setValue('in-warranty');
      (component as any).form.controls.interventionType.setValue(InterventionType.INTERVENTION_REPAIR);
      (component as any).form.controls.description.setValue('Some fault');

      component.ionViewWillEnter();

      expect((component as any).form.controls.warrantyStatus.value).toBe('');
      expect((component as any).form.controls.interventionType.value).toBe('');
      expect((component as any).form.controls.description.value).toBe('');
    });

    it('TC-IP-41: clears spareParts FormArray and resets to exactly one empty control', () => {
      setDevice(createMockDevice());
      component.ionViewWillEnter();
      // Add extra spare parts
      component.addPart();
      component.addPart();
      expect((component as any).spareParts.length).toBe(3);

      component.ionViewWillEnter();

      expect((component as any).spareParts.length).toBe(1);
      expect((component as any).spareParts.controls[0].value).toBe('');
    });

    it('TC-IP-42: calls photoService.clear() to reset uploaded photos on enter', () => {
      setDevice(createMockDevice());
      mockPhotoService.clear.calls.reset();

      component.ionViewWillEnter();

      expect(mockPhotoService.clear).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Edge cases (bonus)
  // =========================================================================

  describe('Edge cases (bonus)', () => {
    beforeEach(() => {
      setDevice(createMockDevice({ type: DeviceType.BOILER }));
      component.ionViewWillEnter();
    });

    it('TC-IP-43 (bonus): multiple sequential saves each invoke saveIntervention once per save', async () => {
      fillValidForm();
      await component.onSave();

      fillValidForm();
      await component.onSave();

      expect(mockInterventionService.saveIntervention).toHaveBeenCalledTimes(2);
    });

    it('TC-IP-44 (bonus): photoRequirement updates correctly when interventionType changes mid-form', () => {
      const req1: PhotoRequirement = { maxPhotos: 3, requiredPhotos: 1, requireSparePartPhotos: false, description: 'First' };
      const req2: PhotoRequirement = { maxPhotos: 5, requiredPhotos: 3, requireSparePartPhotos: true, description: 'Second' };
      const cfg = getDefaultConfig();
      cfg.features.interventionPhotos = true;
      cfg.interventionPhotoConfig = {
        [DeviceType.BOILER]: {
          [InterventionType.INTERVENTION_REPAIR]: req1,
          [InterventionType.INTERVENTION_NOISE]: req2,
        },
      };
      mockConfigStore.setConfig(cfg);
      setDevice(createMockDevice({ type: DeviceType.BOILER }));
      component.ionViewWillEnter();

      (component as any).form.controls.interventionType.setValue(InterventionType.INTERVENTION_REPAIR);
      component.updatePhotoRequirement();
      expect((component as any).photoRequirement).toEqual(req1);

      (component as any).form.controls.interventionType.setValue(InterventionType.INTERVENTION_NOISE);
      component.updatePhotoRequirement();
      expect((component as any).photoRequirement).toEqual(req2);
    });

    it('TC-IP-45 (bonus): toggling warrantyStatus mid-form resets interventionType to empty', () => {
      (component as any).form.controls.warrantyStatus.setValue('in-warranty');
      (component as any).form.controls.interventionType.setValue(InterventionType.INTERVENTION_REPAIR);

      (component as any).form.controls.warrantyStatus.setValue('out-of-warranty');
      component.updateInterventionTypes();

      expect((component as any).form.controls.interventionType.value).toBe('');
    });
  });

  // =========================================================================
  // EXPANSION: fault descriptions × device type matrix
  // =========================================================================

  describe('fault descriptions per device type — parameterized', () => {
    const faultSets: Array<{ deviceType: DeviceType; faults: string[] }> = [
      {
        deviceType: DeviceType.GAS_BOILER,
        faults: [
          'fault_no_hot_water',
          'fault_no_heating',
          'fault_noise',
          'fault_leak',
          'fault_error_code',
          'fault_pressure_drop',
          'fault_ignition',
          'fault_flue_gas',
        ],
      },
      {
        deviceType: DeviceType.BOILER,
        faults: [
          'fault_no_hot_water',
          'fault_thermostat',
          'fault_anode',
          'fault_leak',
          'fault_noise',
        ],
      },
      {
        deviceType: DeviceType.HEAT_PUMP,
        faults: [
          'fault_no_heating',
          'fault_no_cooling',
          'fault_noise',
          'fault_freon_leak',
          'fault_compressor',
          'fault_error_code',
        ],
      },
      {
        deviceType: DeviceType.AIR_CONDITION,
        faults: [
          'fault_no_cooling',
          'fault_no_heating',
          'fault_noise',
          'fault_freon_leak',
          'fault_drainage',
          'fault_error_code',
        ],
      },
    ];

    faultSets.forEach(({ deviceType, faults }) => {
      describe(`device type: ${deviceType}`, () => {
        beforeEach(() => {
          const cfg = getDefaultConfig();
          cfg.interventionFaultOptions = { [deviceType]: faults };
          cfg.interventionErrorOptions = {};
          mockConfigStore.setConfig(cfg);
          setDevice(createMockDevice({ type: deviceType }));
          component.ionViewWillEnter();
        });

        faults.forEach((fault) => {
          it(`EXP-IP-FAULT: ${deviceType} has fault description "${fault}"`, () => {
            // faultDescriptions is {key,label}[] — ionViewWillEnter maps string keys through transloco
            const descriptions: Array<{ key: string; label: string }> = (component as any).faultDescriptions;
            expect(descriptions).toContain(jasmine.objectContaining({ key: fault }));
          });
        });

        it(`EXP-IP-FAULT-COUNT: ${deviceType} has exactly ${faults.length} fault descriptions`, () => {
          const descriptions: Array<{ key: string; label: string }> = (component as any).faultDescriptions;
          expect(descriptions.length).toBe(faults.length);
        });
      });
    });
  });

  // =========================================================================
  // EXPANSION: error codes × device type matrix
  // =========================================================================

  describe('error codes per device type — parameterized', () => {
    const errorSets: Array<{ deviceType: DeviceType; errors: string[] }> = [
      {
        deviceType: DeviceType.GAS_BOILER,
        errors: [
          'E01', 'E02', 'E03', 'E04', 'E05',
          'F01', 'F02', 'F03', 'F04', 'F05',
          'A01', 'A02',
        ],
      },
      {
        deviceType: DeviceType.BOILER,
        errors: ['B01', 'B02', 'B03', 'B04', 'B05'],
      },
      {
        deviceType: DeviceType.HEAT_PUMP,
        errors: [
          'HP01', 'HP02', 'HP03', 'HP04', 'HP05',
          'HP06', 'HP07', 'HP08',
        ],
      },
      {
        deviceType: DeviceType.AIR_CONDITION,
        errors: [
          'AC01', 'AC02', 'AC03', 'AC04', 'AC05', 'AC06',
        ],
      },
    ];

    errorSets.forEach(({ deviceType, errors }) => {
      describe(`error codes: ${deviceType}`, () => {
        beforeEach(() => {
          const cfg = getDefaultConfig();
          cfg.interventionFaultOptions = {};
          cfg.interventionErrorOptions = { [deviceType]: errors };
          mockConfigStore.setConfig(cfg);
          setDevice(createMockDevice({ type: deviceType }));
          component.ionViewWillEnter();
        });

        errors.forEach((errorCode) => {
          it(`EXP-IP-ERROR: ${deviceType} has error code "${errorCode}"`, () => {
            // errorCodes is {key,label}[] — ionViewWillEnter maps string keys through transloco
            const codes: Array<{ key: string; label: string }> = (component as any).errorCodes;
            expect(codes).toContain(jasmine.objectContaining({ key: errorCode }));
          });
        });

        it(`EXP-IP-ERROR-COUNT: ${deviceType} has exactly ${errors.length} error codes`, () => {
          const codes: Array<{ key: string; label: string }> = (component as any).errorCodes;
          expect(codes.length).toBe(errors.length);
        });
      });
    });
  });

  // =========================================================================
  // EXPANSION: updateInterventionTypes × all device types
  // =========================================================================

  describe('updateInterventionTypes() — per device type', () => {
    const deviceTypes = [
      DeviceType.BOILER,
      DeviceType.GAS_BOILER,
      DeviceType.HEAT_PUMP,
      DeviceType.AIR_CONDITION,
    ];

    deviceTypes.forEach((deviceType) => {
      it(`EXP-IP-INTTYPES: ${deviceType} + in_warranty includes INTERVENTION_REPAIR`, () => {
        setDevice(createMockDevice({ type: deviceType }));
        component.ionViewWillEnter();
        (component as any).form.controls.warrantyStatus.setValue('in-warranty');

        component.updateInterventionTypes();

        const types: Array<{ key: string }> = (component as any).interventionTypes;
        const keys = types.map(t => t.key);
        expect(keys).toContain(InterventionType.INTERVENTION_REPAIR);
      });

      it(`EXP-IP-INTTYPES-OOW: ${deviceType} + out_of_warranty excludes INTERVENTION_REPLACE`, () => {
        setDevice(createMockDevice({ type: deviceType }));
        component.ionViewWillEnter();
        (component as any).form.controls.warrantyStatus.setValue('out-of-warranty');

        component.updateInterventionTypes();

        const keys: string[] = ((component as any).interventionTypes as Array<{ key: string }>).map(t => t.key);
        expect(keys).not.toContain(InterventionType.INTERVENTION_REPLACE);
      });
    });
  });

  // =========================================================================
  // EXPANSION: spare parts — parameterized add/remove sequences
  // =========================================================================

  describe('spare parts — addPart/removePart sequences', () => {
    beforeEach(() => {
      setDevice(createMockDevice());
      component.ionViewWillEnter();
    });

    const addCounts = [1, 2, 3, MAX_SPARE_PARTS];

    addCounts.forEach((count) => {
      it(`EXP-IP-PARTS-ADD: adding ${count} parts results in ${Math.min(count + 1, MAX_SPARE_PARTS)} total (1 initial + added)`, () => {
        for (let i = 0; i < count; i++) {
          component.addPart();
        }

        const total = (component as any).spareParts.length;
        expect(total).toBe(Math.min(count + 1, MAX_SPARE_PARTS));
      });
    });

    it('EXP-IP-PARTS-MAX: adding MAX_SPARE_PARTS+10 never exceeds MAX_SPARE_PARTS', () => {
      for (let i = 0; i < MAX_SPARE_PARTS + 10; i++) {
        component.addPart();
      }
      expect((component as any).spareParts.length).toBe(MAX_SPARE_PARTS);
    });

    it('EXP-IP-PARTS-REMOVE-BELOW-MIN: removing from 1 part stays at 1', () => {
      // Start at 1
      for (let i = 0; i < 5; i++) {
        component.removePart();
      }
      expect((component as any).spareParts.length).toBeGreaterThanOrEqual(1);
    });

    it('EXP-IP-PARTS-ADD-REMOVE: add 3 then remove 2 = 2 total', () => {
      component.addPart();
      component.addPart();
      component.addPart();
      // now 4 total
      component.removePart();
      component.removePart();
      expect((component as any).spareParts.length).toBe(2);
    });
  });

  // =========================================================================
  // EXPANSION: updatePhotoRequirement × all device types
  // =========================================================================

  describe('updatePhotoRequirement() — per device type and intervention type', () => {
    const interventionTypesForPhotoTest = [
      InterventionType.INTERVENTION_REPAIR,
      InterventionType.INTERVENTION_NOISE,
    ];

    const deviceTypesForPhoto = [
      DeviceType.BOILER,
      DeviceType.GAS_BOILER,
      DeviceType.HEAT_PUMP,
      DeviceType.AIR_CONDITION,
    ];

    deviceTypesForPhoto.forEach((deviceType) => {
      interventionTypesForPhotoTest.forEach((intType) => {
        it(`EXP-IP-PHOTO: ${deviceType}+${intType} with photo config → photoRequirement set`, () => {
          const requirement: PhotoRequirement = {
            maxPhotos: 4,
            requiredPhotos: 1,
            requireSparePartPhotos: false,
            description: `Photo for ${deviceType} ${intType}`,
          };
          const cfg = getDefaultConfig();
          cfg.features.interventionPhotos = true;
          cfg.interventionPhotoConfig = { [deviceType]: { [intType]: requirement } };
          mockConfigStore.setConfig(cfg);
          setDevice(createMockDevice({ type: deviceType }));
          component.ionViewWillEnter();
          (component as any).form.controls.interventionType.setValue(intType);

          component.updatePhotoRequirement();

          expect((component as any).photoRequirement).toEqual(requirement);
        });

        it(`EXP-IP-PHOTO-EMPTY: ${deviceType}+${intType} without photo config → photoRequirement null`, () => {
          const cfg = getDefaultConfig();
          cfg.features.interventionPhotos = true;
          cfg.interventionPhotoConfig = {};
          mockConfigStore.setConfig(cfg);
          setDevice(createMockDevice({ type: deviceType }));
          component.ionViewWillEnter();
          (component as any).form.controls.interventionType.setValue(intType);

          component.updatePhotoRequirement();

          expect((component as any).photoRequirement).toBeNull();
        });
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: ionViewWillEnter — all device types × fault/error options
  // =========================================================================

  describe('ionViewWillEnter() — all device types set deviceType correctly', () => {
    const deviceTypes = [
      DeviceType.GAS_BOILER,
      DeviceType.HEAT_PUMP,
      DeviceType.BOILER,
      DeviceType.AIR_CONDITION,
    ];

    deviceTypes.forEach((type) => {
      it(`EXP2-IP-DEVTYPE: ${type} → deviceType set correctly`, () => {
        setDevice(createMockDevice({ type }));
        component.ionViewWillEnter();
        expect((component as any).deviceType).toBe(type);
      });

      it(`EXP2-IP-DEVTYPE-NODEVICE: ${type} device → noDevice is false`, () => {
        setDevice(createMockDevice({ type }));
        component.ionViewWillEnter();
        expect((component as any).noDevice).toBeFalse();
      });
    });

    it('EXP2-IP-NULL-DEVICE: null device → noDevice is true', () => {
      setDevice(null);
      component.ionViewWillEnter();
      expect((component as any).noDevice).toBeTrue();
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: fault options — various list lengths per device type
  // =========================================================================

  describe('ionViewWillEnter() — fault option list sizes per device type', () => {
    const faultListScenarios: Array<{
      deviceType: DeviceType;
      faults: string[];
      label: string;
    }> = [
      { deviceType: DeviceType.GAS_BOILER, faults: [], label: 'GAS_BOILER 0 faults' },
      { deviceType: DeviceType.GAS_BOILER, faults: ['F1'], label: 'GAS_BOILER 1 fault' },
      { deviceType: DeviceType.GAS_BOILER, faults: ['F1', 'F2', 'F3'], label: 'GAS_BOILER 3 faults' },
      { deviceType: DeviceType.GAS_BOILER, faults: Array.from({ length: 10 }, (_, i) => `F${i}`), label: 'GAS_BOILER 10 faults' },
      { deviceType: DeviceType.HEAT_PUMP, faults: [], label: 'HEAT_PUMP 0 faults' },
      { deviceType: DeviceType.HEAT_PUMP, faults: ['F1', 'F2'], label: 'HEAT_PUMP 2 faults' },
      { deviceType: DeviceType.HEAT_PUMP, faults: Array.from({ length: 8 }, (_, i) => `HP_F${i}`), label: 'HEAT_PUMP 8 faults' },
      { deviceType: DeviceType.BOILER, faults: ['F1', 'F2', 'F3', 'F4', 'F5'], label: 'BOILER 5 faults' },
      { deviceType: DeviceType.AIR_CONDITION, faults: ['AC1', 'AC2', 'AC3'], label: 'AIR_CONDITION 3 faults' },
    ];

    faultListScenarios.forEach(({ deviceType, faults, label }) => {
      it(`EXP2-IP-FAULTSIZE: ${label} → faultDescriptions.length = ${faults.length}`, () => {
        setDevice(createMockDevice({ type: deviceType }));
        const cfg = getDefaultConfig();
        cfg.interventionFaultOptions = { [deviceType]: faults };
        mockConfigStore.setConfig(cfg);

        component.ionViewWillEnter();

        // faultDescriptions is {key,label}[] — length check remains valid
        const descriptions: Array<{ key: string; label: string }> = (component as any).faultDescriptions;
        expect(descriptions.length).toBe(faults.length);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: error options — various list lengths per device type
  // =========================================================================

  describe('ionViewWillEnter() — error option list sizes per device type', () => {
    const errorListScenarios: Array<{
      deviceType: DeviceType;
      errors: string[];
      label: string;
    }> = [
      { deviceType: DeviceType.GAS_BOILER, errors: [], label: 'GAS_BOILER 0 errors' },
      { deviceType: DeviceType.GAS_BOILER, errors: ['E1'], label: 'GAS_BOILER 1 error' },
      { deviceType: DeviceType.GAS_BOILER, errors: ['E1', 'E2', 'E3', 'E4', 'E5'], label: 'GAS_BOILER 5 errors' },
      { deviceType: DeviceType.GAS_BOILER, errors: Array.from({ length: 15 }, (_, i) => `E${i}`), label: 'GAS_BOILER 15 errors' },
      { deviceType: DeviceType.HEAT_PUMP, errors: ['HP_E1', 'HP_E2'], label: 'HEAT_PUMP 2 errors' },
      { deviceType: DeviceType.HEAT_PUMP, errors: Array.from({ length: 12 }, (_, i) => `HP_E${i}`), label: 'HEAT_PUMP 12 errors' },
      { deviceType: DeviceType.BOILER, errors: ['B1', 'B2', 'B3'], label: 'BOILER 3 errors' },
      { deviceType: DeviceType.AIR_CONDITION, errors: ['AC_E1'], label: 'AIR_CONDITION 1 error' },
      { deviceType: DeviceType.AIR_CONDITION, errors: Array.from({ length: 7 }, (_, i) => `AC_E${i}`), label: 'AIR_CONDITION 7 errors' },
    ];

    errorListScenarios.forEach(({ deviceType, errors, label }) => {
      it(`EXP2-IP-ERRSIZE: ${label} → errorCodes.length = ${errors.length}`, () => {
        setDevice(createMockDevice({ type: deviceType }));
        const cfg = getDefaultConfig();
        cfg.interventionErrorOptions = { [deviceType]: errors };
        mockConfigStore.setConfig(cfg);

        component.ionViewWillEnter();

        // errorCodes is {key,label}[] — length check remains valid
        const codes: Array<{ key: string; label: string }> = (component as any).errorCodes;
        expect(codes.length).toBe(errors.length);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: addPart() — adding parts one-by-one tracks array correctly
  // =========================================================================

  describe('addPart() — spare parts incremental addition', () => {
    beforeEach(() => {
      setDevice(createMockDevice());
      component.ionViewWillEnter();
    });

    // ionViewWillEnter initializes spareParts with 1 element, so after count addPart() calls
    // the total is Math.min(count + 1, MAX_SPARE_PARTS)
    const addCounts = [1, 2, 3, 4];

    addCounts.forEach((count) => {
      it(`EXP2-IP-ADDPART: add ${count} parts → spareParts.length = ${Math.min(count + 1, MAX_SPARE_PARTS)}`, () => {
        for (let i = 0; i < count; i++) {
          component.addPart();
        }
        expect((component as any).spareParts.length).toBe(Math.min(count + 1, MAX_SPARE_PARTS));
      });
    });

    it('EXP2-IP-ADDPART-MAX: add MAX_SPARE_PARTS+2 → capped at MAX_SPARE_PARTS', () => {
      for (let i = 0; i < MAX_SPARE_PARTS + 2; i++) {
        component.addPart();
      }
      expect((component as any).spareParts.length).toBe(MAX_SPARE_PARTS);
    });

    it('EXP2-IP-ADDPART-EXACT: add exactly MAX_SPARE_PARTS times → length equals MAX_SPARE_PARTS', () => {
      for (let i = 0; i < MAX_SPARE_PARTS; i++) {
        component.addPart();
      }
      expect((component as any).spareParts.length).toBe(MAX_SPARE_PARTS);
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: removePart() — specific index removal
  // =========================================================================

  describe('removePart() — stack-based removal (always removes last)', () => {
    beforeEach(() => {
      setDevice(createMockDevice());
      component.ionViewWillEnter();
    });

    it('EXP2-IP-RMPART-LAST: add 2 then removePart → length decreases by 1', () => {
      component.addPart();
      component.addPart();
      const before = (component as any).spareParts.length;
      component.removePart();
      expect((component as any).spareParts.length).toBe(before - 1);
    });

    it('EXP2-IP-RMPART-MIDDLE: removePart removes last (no index support)', () => {
      component.addPart();
      component.addPart();
      (component as any).spareParts.controls[0].setValue('PART-A');
      (component as any).spareParts.controls[1].setValue('PART-B');
      (component as any).spareParts.controls[2].setValue('PART-C');
      component.removePart();
      expect((component as any).spareParts.length).toBe(2);
      expect((component as any).spareParts.controls[0].value).toBe('PART-A');
      expect((component as any).spareParts.controls[1].value).toBe('PART-B');
    });

    it('EXP2-IP-RMPART-ALL: cannot reduce below 1 part (guard)', () => {
      component.addPart();
      component.addPart();
      component.addPart();
      component.removePart();
      component.removePart();
      component.removePart();
      component.removePart();
      expect((component as any).spareParts.length).toBe(1);
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: updateInterventionTypes() — each device type × warranty
  // =========================================================================

  describe('updateInterventionTypes() — warranty status × device type matrix', () => {
    const warrantyStatuses = ['in-warranty', 'out-of-warranty', 'commissioning_warranty_from_start', 'commissioning_warranty_from_date'];

    warrantyStatuses.forEach((status) => {
      it(`EXP2-IP-INTTYPES-${status}: interventionTypes populated after update`, () => {
        setDevice(createMockDevice({ type: DeviceType.GAS_BOILER }));
        component.ionViewWillEnter();
        (component as any).form.controls.warrantyStatus.setValue(status);

        component.updateInterventionTypes();

        expect(Array.isArray((component as any).interventionTypes)).toBeTrue();
      });
    });

    const deviceTypesForIntTypes = [
      DeviceType.GAS_BOILER,
      DeviceType.HEAT_PUMP,
      DeviceType.BOILER,
      DeviceType.AIR_CONDITION,
    ];

    deviceTypesForIntTypes.forEach((dt) => {
      it(`EXP2-IP-INTTYPES-DEVTYPE: ${dt} in_warranty → interventionTypes array set`, () => {
        setDevice(createMockDevice({ type: dt }));
        component.ionViewWillEnter();
        (component as any).form.controls.warrantyStatus.setValue('in-warranty');

        component.updateInterventionTypes();

        expect(Array.isArray((component as any).interventionTypes)).toBeTrue();
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: form field — intervention type values
  // =========================================================================

  describe('form — interventionType field with all InterventionType values', () => {
    const interventionTypes = [
      InterventionType.COMMISSIONING,
      InterventionType.ANNUAL_SERVICE,
      InterventionType.INTERVENTION_REPAIR,
      InterventionType.INTERVENTION_NOISE,
      InterventionType.INTERVENTION_REPLACE,
    ];

    interventionTypes.forEach((type) => {
      it(`EXP2-IP-FORM-INTTYPE: setting interventionType to ${type} — value stored`, () => {
        setDevice(createMockDevice());
        component.ionViewWillEnter();
        (component as any).form.controls.interventionType.setValue(type);
        expect((component as any).form.controls.interventionType.value).toBe(type);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: form — warrantyStatus field with all possible values
  // =========================================================================

  describe('form — warrantyStatus field with all possible values', () => {
    const warrantyValues = [
      'in-warranty',
      'out-of-warranty',
      'commissioning_warranty_from_start',
      'commissioning_warranty_from_date',
      '',
    ];

    warrantyValues.forEach((value) => {
      it(`EXP2-IP-FORM-WARRANTY: warrantyStatus="${value}" — value stored in form`, () => {
        setDevice(createMockDevice());
        component.ionViewWillEnter();
        (component as any).form.controls.warrantyStatus.setValue(value);
        expect((component as any).form.controls.warrantyStatus.value).toBe(value);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: INTERVENTION_OPTIONS constant — all device types present
  // =========================================================================

  describe('INTERVENTION_OPTIONS constant — structure validation', () => {
    const expectedDeviceTypes = [
      DeviceType.GAS_BOILER,
      DeviceType.HEAT_PUMP,
      DeviceType.BOILER,
      DeviceType.AIR_CONDITION,
    ];

    expectedDeviceTypes.forEach((type) => {
      it(`EXP2-IP-CONSTS-OPTS: INTERVENTION_OPTIONS has entry for ${type}`, () => {
        expect(INTERVENTION_OPTIONS[type]).toBeDefined();
      });

      it(`EXP2-IP-CONSTS-OPTS-ARRAY: INTERVENTION_OPTIONS[${type}] is an array`, () => {
        expect(Array.isArray(INTERVENTION_OPTIONS[type])).toBeTrue();
      });

      it(`EXP2-IP-CONSTS-OPTS-NONEMPTY: INTERVENTION_OPTIONS[${type}] is non-empty`, () => {
        expect((INTERVENTION_OPTIONS[type] ?? []).length).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: ANNUAL_SERVICE_TYPES — structure validation
  // =========================================================================

  describe('ANNUAL_SERVICE_TYPES constant — structure validation', () => {
    it('EXP2-IP-CONSTS-AS: ANNUAL_SERVICE_TYPES is defined', () => {
      expect(ANNUAL_SERVICE_TYPES).toBeDefined();
    });

    it('EXP2-IP-CONSTS-AS-RECORD: ANNUAL_SERVICE_TYPES is an object', () => {
      expect(typeof ANNUAL_SERVICE_TYPES).toBe('object');
    });

    it('EXP2-IP-CONSTS-AS-NONEMPTY: ANNUAL_SERVICE_TYPES has entries', () => {
      expect(Object.keys(ANNUAL_SERVICE_TYPES).length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: photoRequirement — all PhotoRequirement types
  // =========================================================================

  describe('updatePhotoRequirement() — all PhotoRequirement types', () => {
    const requirementValues: PhotoRequirement[] = [
      { maxPhotos: 5, requiredPhotos: 5, requireSparePartPhotos: true, description: 'required' },
      { maxPhotos: 5, requiredPhotos: 0, requireSparePartPhotos: false, description: 'optional' },
      { maxPhotos: 0, requiredPhotos: 0, requireSparePartPhotos: false, description: 'none' },
    ];

    requirementValues.forEach((requirement) => {
      it(`EXP2-IP-PHOTOREQ: requirement=${requirement} — photoRequirement set correctly`, () => {
        const cfg = getDefaultConfig();
        cfg.features.interventionPhotos = true;
        cfg.interventionPhotoConfig = {
          [DeviceType.GAS_BOILER]: {
            [InterventionType.INTERVENTION_REPAIR]: requirement,
          },
        };
        mockConfigStore.setConfig(cfg);
        setDevice(createMockDevice({ type: DeviceType.GAS_BOILER }));
        component.ionViewWillEnter();
        (component as any).form.controls.interventionType.setValue(InterventionType.INTERVENTION_REPAIR);

        component.updatePhotoRequirement();

        expect((component as any).photoRequirement).toEqual(requirement);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: spareParts — canAddPart boundary conditions
  // =========================================================================

  describe('addPart boundary conditions (via actual behavior)', () => {
    beforeEach(() => {
      setDevice(createMockDevice());
      component.ionViewWillEnter();
    });

    it('EXP2-IP-CANADD-INITIAL: initial state (1 part) → addPart succeeds', () => {
      const before = (component as any).spareParts.length;
      component.addPart();
      expect((component as any).spareParts.length).toBe(before + 1);
    });

    it('EXP2-IP-CANADD-TWO: 2 parts → addPart succeeds', () => {
      component.addPart();
      const before = (component as any).spareParts.length;
      component.addPart();
      expect((component as any).spareParts.length).toBe(before + 1);
    });

    it('EXP2-IP-CANADD-MAX-MINUS-ONE: MAX-1 parts → addPart succeeds', () => {
      const max = (component as any).maxParts;
      for (let i = 1; i < max - 1; i++) component.addPart();
      expect((component as any).spareParts.length).toBe(max - 1);
      component.addPart();
      expect((component as any).spareParts.length).toBe(max);
    });

    it('EXP2-IP-CANADD-MAX: MAX parts → addPart is no-op', () => {
      const max = (component as any).maxParts;
      for (let i = 1; i < max; i++) component.addPart();
      expect((component as any).spareParts.length).toBe(max);
      component.addPart();
      expect((component as any).spareParts.length).toBe(max);
    });
  });
});
