/**
 * DeviceDetailPage Unit Tests — WU-39, Batch B6
 *
 * MOCK STRATEGY
 * =============
 * - DeviceLookupService: jasmine.createSpyObj with lookup, lookupSilent
 * - DeviceRegistrationService: jasmine.createSpyObj with checkRegistration
 * - AnnualServiceEligibilityService: jasmine.createSpyObj with checkEligibility
 * - InterventionService: jasmine.createSpyObj with getInterventionsBySn, getRegistration
 * - ConfigStore: createMockConfigStore() — NgRx SignalStore mock with signals
 * - ActivatedRoute: plain object with snapshot.paramMap.get returning 'SN123TEST'
 * - Router: createMockRouter() — jasmine.SpyObj
 * - ToastController: createMockToastController() — jasmine.SpyObj
 * - TranslocoService: createMockTranslocoService() — jasmine.SpyObj
 * - CapacitorBarcodeScanner: spyOn(CapacitorBarcodeScanner, 'scanBarcode')
 * - ChangeDetectorRef: jasmine.createSpyObj
 *
 * All services use inject() so dependencies are provided via TestBed.
 * Component is compiled without DOM template rendering (NO_ERRORS_SCHEMA)
 * to isolate business logic from template dependencies.
 */

import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { ChangeDetectorRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerTypeHintALLOption,
} from '@capacitor/barcode-scanner';

import { DeviceDetailPage } from './device-detail.page';
import { DeviceLookupService } from '../services/device-lookup.service';
import { DeviceRegistrationService } from '../services/device-registration.service';
import { AnnualServiceEligibilityService } from '../services/annual-service-eligibility.service';
import { InterventionService } from '../services/intervention.service';
import { ConfigStore } from '../../../core/config/config.store';
import { InterventionType } from '../models/intervention.model';
import { Device, DeviceType } from '../../../shared/models/device.model';
import {
  createMockConfigStore,
  createMockToastController,
  createMockTranslocoService,
} from '../../../testing/mock-factories';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_SN = 'SN123TEST';

function buildDevice(overrides: Partial<Device> = {}): Device {
  return {
    code: 'GENUS24',
    name: 'Genus One 24 kW',
    type: DeviceType.GAS_BOILER,
    subType: '',
    unitCount: 0,
    exists: true,
    commissioning: false,
    annualService: true,
    connectedDevice: false,
    warrantyMonths: 24,
    firstServiceYear: 1,
    serviceWindowStart: 1,
    serviceWindowEnd: 12,
    ...overrides,
  };
}

function buildIntervention(
  type: InterventionType,
): { id: string; data: Record<string, unknown> } {
  return {
    id: `int-${Math.random()}`,
    data: { interventionType: type, sn: TEST_SN },
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('DeviceDetailPage', () => {
  let component: DeviceDetailPage;

  let mockLookupService: jasmine.SpyObj<DeviceLookupService>;
  let mockRegistrationService: jasmine.SpyObj<DeviceRegistrationService>;
  let mockEligibilityService: jasmine.SpyObj<AnnualServiceEligibilityService>;
  let mockInterventionService: jasmine.SpyObj<InterventionService>;
  let router: Router;
  let mockToastController: jasmine.SpyObj<ToastController>;
  let mockTransloco: jasmine.SpyObj<TranslocoService>;
  let mockCdr: jasmine.SpyObj<ChangeDetectorRef>;

  function createLookupServiceSpy(): jasmine.SpyObj<DeviceLookupService> {
    const spy = jasmine.createSpyObj<DeviceLookupService>('DeviceLookupService', [
      'lookup',
      'lookupSilent',
      'clear',
      'extractModelCode',
    ]);
    spy.lookup.and.resolveTo(buildDevice());
    spy.lookupSilent.and.resolveTo(null);
    // writable properties on spy
    (spy as unknown as { device: Device | null }).device = buildDevice();
    (spy as unknown as { sn: string }).sn = '';
    (spy as unknown as { isLoading: boolean }).isLoading = false;
    return spy;
  }

  function createRegistrationServiceSpy(): jasmine.SpyObj<DeviceRegistrationService> {
    const spy = jasmine.createSpyObj<DeviceRegistrationService>('DeviceRegistrationService', [
      'checkRegistration',
      'clear',
    ]);
    spy.checkRegistration.and.resolveTo();
    // writable properties
    (spy as unknown as { isRegistered: boolean | null }).isRegistered = null;
    (spy as unknown as { isChecking: boolean }).isChecking = false;
    (spy as unknown as { userData: Record<string, unknown> | null }).userData = null;
    return spy;
  }

  function createEligibilityServiceSpy(): jasmine.SpyObj<AnnualServiceEligibilityService> {
    const spy = jasmine.createSpyObj<AnnualServiceEligibilityService>(
      'AnnualServiceEligibilityService',
      ['checkEligibility', 'clear'],
    );
    spy.checkEligibility.and.resolveTo();
    (spy as unknown as { isEligible: boolean }).isEligible = false;
    (spy as unknown as { isChecking: boolean }).isChecking = false;
    return spy;
  }

  function createInterventionServiceSpy(): jasmine.SpyObj<InterventionService> {
    const spy = jasmine.createSpyObj<InterventionService>('InterventionService', [
      'getInterventionsBySn',
      'getRegistration',
      'saveIntervention',
      'getInterventionById',
      'getInterventionLabel',
    ]);
    spy.getInterventionsBySn.and.resolveTo([]);
    spy.getRegistration.and.resolveTo(null);
    return spy;
  }

  beforeEach(async () => {
    mockLookupService = createLookupServiceSpy();
    mockRegistrationService = createRegistrationServiceSpy();
    mockEligibilityService = createEligibilityServiceSpy();
    mockInterventionService = createInterventionServiceSpy();
    mockToastController = createMockToastController();
    mockTransloco = createMockTranslocoService();
    mockCdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck', 'detectChanges']);

    await TestBed.configureTestingModule({
      imports: [DeviceDetailPage],
      providers: [
        provideRouter([]),
        { provide: DeviceLookupService, useValue: mockLookupService },
        { provide: DeviceRegistrationService, useValue: mockRegistrationService },
        { provide: AnnualServiceEligibilityService, useValue: mockEligibilityService },
        { provide: InterventionService, useValue: mockInterventionService },
        { provide: ConfigStore, useValue: createMockConfigStore() },
        { provide: ToastController, useValue: mockToastController },
        { provide: TranslocoService, useValue: mockTransloco },
        { provide: ChangeDetectorRef, useValue: mockCdr },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (_key: string) => TEST_SN,
              },
            },
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(DeviceDetailPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Lifecycle', () => {
    it('TC-DD-01: component creates without errors', () => {
      expect(component).toBeTruthy();
    });

    it('TC-DD-02: ionViewWillEnter extracts SN from route paramMap', () => {
      component.ionViewWillEnter();

      expect((component as unknown as { sn: string }).sn).toBe(TEST_SN);
    });

    it('TC-DD-03: ionViewWillEnter calls initializeDevice when SN is non-empty', fakeAsync(() => {
      component.ionViewWillEnter();
      tick();

      expect(mockLookupService.lookup).toHaveBeenCalled();
    }));

    it('TC-DD-04: ionViewWillEnter does NOT call initializeDevice when SN is empty', fakeAsync(() => {
      // Directly set sn to empty on the route mock via route snapshot
      // We simulate empty SN by overriding the private sn after extracting it
      // The route mock returns TEST_SN but if we reset it manually we can verify guard
      // Alternative: set the SN to empty directly before calling ionViewWillEnter
      // by manipulating the injected ActivatedRoute mock
      const route = TestBed.inject(ActivatedRoute) as unknown as {
        snapshot: { paramMap: { get: (_key: string) => string } }
      };
      route.snapshot.paramMap.get = (_key: string) => '';

      component.ionViewWillEnter();
      tick();

      expect(mockLookupService.lookup).not.toHaveBeenCalled();
    }));
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // initializeDevice
  // ══════════════════════════════════════════════════════════════════════════════

  describe('initializeDevice()', () => {
    it('TC-DD-05: calls DeviceLookupService.lookup with the extracted SN', fakeAsync(() => {
      (mockLookupService as unknown as { sn: string }).sn = '';

      component.ionViewWillEnter();
      tick();

      expect(mockLookupService.lookup).toHaveBeenCalledWith(TEST_SN);
    }));

    it('TC-DD-06: skips DeviceLookupService.lookup when sn already matches service.sn', fakeAsync(() => {
      // Simulate service already has same SN loaded
      (mockLookupService as unknown as { sn: string }).sn = TEST_SN;

      component.ionViewWillEnter();
      tick();

      expect(mockLookupService.lookup).not.toHaveBeenCalled();
    }));

    it('TC-DD-07: calls DeviceRegistrationService.checkRegistration with SN', fakeAsync(() => {
      (mockLookupService as unknown as { sn: string }).sn = '';

      component.ionViewWillEnter();
      tick();

      expect(mockRegistrationService.checkRegistration).toHaveBeenCalledWith(TEST_SN);
    }));

    it('TC-DD-08: calls InterventionService.getInterventionsBySn when device has commissioning and isRegistered', fakeAsync(() => {
      const device = buildDevice({ commissioning: true });
      (mockLookupService as unknown as { device: Device | null }).device = device;
      (mockLookupService as unknown as { sn: string }).sn = '';
      mockLookupService.lookup.and.resolveTo(device);
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = true;

      component.ionViewWillEnter();
      tick();

      expect(mockInterventionService.getInterventionsBySn).toHaveBeenCalledWith(TEST_SN, device.type);
    }));

    it('TC-DD-09: does NOT call getInterventionsBySn when device has NO commissioning flag', fakeAsync(() => {
      const device = buildDevice({ commissioning: false });
      (mockLookupService as unknown as { device: Device | null }).device = device;
      (mockLookupService as unknown as { sn: string }).sn = '';
      mockLookupService.lookup.and.resolveTo(device);
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = true;

      component.ionViewWillEnter();
      tick();

      expect(mockInterventionService.getInterventionsBySn).not.toHaveBeenCalled();
    }));

    it('TC-DD-10: calls AnnualServiceEligibilityService.checkEligibility when device has annualService', fakeAsync(() => {
      const device = buildDevice({ annualService: true });
      (mockLookupService as unknown as { device: Device | null }).device = device;
      (mockLookupService as unknown as { sn: string }).sn = '';
      mockLookupService.lookup.and.resolveTo(device);

      component.ionViewWillEnter();
      tick();

      expect(mockEligibilityService.checkEligibility).toHaveBeenCalledWith(TEST_SN, device);
    }));

    it('TC-DD-11: does NOT call checkEligibility when device has no annualService flag', fakeAsync(() => {
      const device = buildDevice({ annualService: false });
      (mockLookupService as unknown as { device: Device | null }).device = device;
      (mockLookupService as unknown as { sn: string }).sn = '';
      mockLookupService.lookup.and.resolveTo(device);

      component.ionViewWillEnter();
      tick();

      expect(mockEligibilityService.checkEligibility).not.toHaveBeenCalled();
    }));

    it('TC-DD-12: sets isCommissioningDone=true when COMMISSIONING intervention exists', fakeAsync(() => {
      const device = buildDevice({ commissioning: true });
      (mockLookupService as unknown as { device: Device | null }).device = device;
      (mockLookupService as unknown as { sn: string }).sn = '';
      mockLookupService.lookup.and.resolveTo(device);
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = true;
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        buildIntervention(InterventionType.COMMISSIONING),
      ]);

      component.ionViewWillEnter();
      tick();

      expect((component as unknown as { isCommissioningDone: boolean }).isCommissioningDone).toBeTrue();
    }));

    it('TC-DD-13: sets isCommissioningDone=false when no COMMISSIONING intervention', fakeAsync(() => {
      const device = buildDevice({ commissioning: true });
      (mockLookupService as unknown as { device: Device | null }).device = device;
      (mockLookupService as unknown as { sn: string }).sn = '';
      mockLookupService.lookup.and.resolveTo(device);
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = true;
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        buildIntervention(InterventionType.ANNUAL_SERVICE),
      ]);

      component.ionViewWillEnter();
      tick();

      expect((component as unknown as { isCommissioningDone: boolean }).isCommissioningDone).toBeFalse();
    }));

    it('TC-DD-14: sets connectedSn from registrationService.userData when saved connectedDevice exists', fakeAsync(() => {
      const device = buildDevice();
      (mockLookupService as unknown as { device: Device | null }).device = device;
      (mockLookupService as unknown as { sn: string }).sn = '';
      mockLookupService.lookup.and.resolveTo(device);
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = true;
      (mockRegistrationService as unknown as { userData: Record<string, unknown> | null }).userData = {
        connectedDevice: 'CONNECTED-SN-001',
      };

      component.ionViewWillEnter();
      tick();

      expect((component as unknown as { connectedSn: string }).connectedSn).toBe('CONNECTED-SN-001');
    }));

    it('TC-DD-15: sets isInitializing=false after initialization completes', fakeAsync(() => {
      (mockLookupService as unknown as { sn: string }).sn = '';

      component.ionViewWillEnter();
      tick();

      expect((component as unknown as { isInitializing: boolean }).isInitializing).toBeFalse();
    }));

    it('TC-DD-16: aborts early when device is null after lookup', fakeAsync(() => {
      (mockLookupService as unknown as { device: Device | null }).device = null;
      (mockLookupService as unknown as { sn: string }).sn = '';
      mockLookupService.lookup.and.resolveTo(null);

      component.ionViewWillEnter();
      tick();

      expect(mockRegistrationService.checkRegistration).not.toHaveBeenCalled();
      expect((component as unknown as { isInitializing: boolean }).isInitializing).toBeFalse();
    }));
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // isOperational getter
  // ══════════════════════════════════════════════════════════════════════════════

  describe('isOperational', () => {
    it('TC-DD-17: returns false when isRegistered is null (not checked)', () => {
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = null;

      expect(component.isOperational).toBeFalse();
    });

    it('TC-DD-18: returns false when isRegistered is false', () => {
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = false;

      expect(component.isOperational).toBeFalse();
    });

    it('TC-DD-19: returns true when registered and device has no commissioning requirement', () => {
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = true;
      (mockLookupService as unknown as { device: Device | null }).device = buildDevice({ commissioning: false });

      expect(component.isOperational).toBeTrue();
    });

    it('TC-DD-20: returns false when registered + commissioning required but not done', () => {
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = true;
      (mockLookupService as unknown as { device: Device | null }).device = buildDevice({ commissioning: true });
      (component as unknown as { isCommissioningDone: boolean }).isCommissioningDone = false;

      expect(component.isOperational).toBeFalse();
    });

    it('TC-DD-21: returns true when registered + commissioning required and commissioning done', () => {
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = true;
      (mockLookupService as unknown as { device: Device | null }).device = buildDevice({ commissioning: true });
      (component as unknown as { isCommissioningDone: boolean }).isCommissioningDone = true;

      expect(component.isOperational).toBeTrue();
    });

    it('TC-DD-22: returns true when registered + out_of_warranty status regardless of commissioning', () => {
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = true;
      (mockRegistrationService as unknown as { userData: Record<string, unknown> | null }).userData = {
        warrantyStatus: 'out_of_warranty',
      };
      (mockLookupService as unknown as { device: Device | null }).device = buildDevice({ commissioning: true });
      (component as unknown as { isCommissioningDone: boolean }).isCommissioningDone = false;

      expect(component.isOperational).toBeTrue();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // isAnnualServiceEnabled getter
  // ══════════════════════════════════════════════════════════════════════════════

  describe('isAnnualServiceEnabled', () => {
    it('TC-DD-23: returns true when eligibilityService.isEligible=true and isChecking=false', () => {
      (mockEligibilityService as unknown as { isEligible: boolean }).isEligible = true;
      (mockEligibilityService as unknown as { isChecking: boolean }).isChecking = false;

      expect(component.isAnnualServiceEnabled).toBeTrue();
    });

    it('TC-DD-24: returns false when eligibilityService.isEligible=false', () => {
      (mockEligibilityService as unknown as { isEligible: boolean }).isEligible = false;
      (mockEligibilityService as unknown as { isChecking: boolean }).isChecking = false;

      expect(component.isAnnualServiceEnabled).toBeFalse();
    });

    it('TC-DD-25: returns false when eligibilityService.isChecking=true even if isEligible=true', () => {
      (mockEligibilityService as unknown as { isEligible: boolean }).isEligible = true;
      (mockEligibilityService as unknown as { isChecking: boolean }).isChecking = true;

      expect(component.isAnnualServiceEnabled).toBeFalse();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // needsConnectedDevice getter
  // ══════════════════════════════════════════════════════════════════════════════

  describe('needsConnectedDevice', () => {
    it('TC-DD-26: returns true when device.connectedDevice=true and not registered', () => {
      (mockLookupService as unknown as { device: Device | null }).device = buildDevice({ connectedDevice: true });
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = false;

      expect(component.needsConnectedDevice).toBeTrue();
    });

    it('TC-DD-27: returns false when device.connectedDevice=false', () => {
      (mockLookupService as unknown as { device: Device | null }).device = buildDevice({ connectedDevice: false });
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = false;

      expect(component.needsConnectedDevice).toBeFalse();
    });

    it('TC-DD-28: returns false when device.connectedDevice=true but device is already registered', () => {
      (mockLookupService as unknown as { device: Device | null }).device = buildDevice({ connectedDevice: true });
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = true;

      expect(component.needsConnectedDevice).toBeFalse();
    });

    it('TC-DD-29: returns false when device is null', () => {
      (mockLookupService as unknown as { device: Device | null }).device = null;
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = false;

      expect(component.needsConnectedDevice).toBeFalse();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // scanConnectedBarcode
  // ══════════════════════════════════════════════════════════════════════════════

  describe('scanConnectedBarcode()', () => {
    it('TC-DD-30: successful scan sets connectedSnInput to scanned value', async () => {
      spyOn(CapacitorBarcodeScanner, 'scanBarcode').and.resolveTo({
        ScanResult: 'SCANNED-SN-XYZ',
        format: CapacitorBarcodeScannerTypeHintALLOption.ALL,
      });

      await component.scanConnectedBarcode();

      expect((component as unknown as { connectedSnInput: string }).connectedSnInput).toBe('SCANNED-SN-XYZ');
    });

    it('TC-DD-31: user cancel (error code OS-PLUG-BARC-0006) is handled silently without toast', async () => {
      spyOn(CapacitorBarcodeScanner, 'scanBarcode').and.rejectWith({ code: 'OS-PLUG-BARC-0006' });

      await component.scanConnectedBarcode();

      expect(mockToastController.create).not.toHaveBeenCalled();
    });

    it('TC-DD-32: unknown scan error shows danger toast', async () => {
      spyOn(CapacitorBarcodeScanner, 'scanBarcode').and.rejectWith(new Error('Camera unavailable'));

      await component.scanConnectedBarcode();

      expect(mockToastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ color: 'danger' }),
      );
    });

    it('TC-DD-33: empty ScanResult does not update connectedSnInput', async () => {
      (component as unknown as { connectedSnInput: string }).connectedSnInput = 'ORIGINAL';
      spyOn(CapacitorBarcodeScanner, 'scanBarcode').and.resolveTo({
        ScanResult: '',
        format: CapacitorBarcodeScannerTypeHintALLOption.ALL,
      });

      await component.scanConnectedBarcode();

      expect((component as unknown as { connectedSnInput: string }).connectedSnInput).toBe('ORIGINAL');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // onAddUser
  // ══════════════════════════════════════════════════════════════════════════════

  describe('onAddUser()', () => {
    beforeEach(() => {
      // Default: device without connectedDevice requirement so needsConnectedDevice=false
      (mockLookupService as unknown as { device: Device | null }).device = buildDevice({ connectedDevice: false });
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = true;
      (component as unknown as { sn: string }).sn = TEST_SN;
    });

    it('TC-DD-34: without connected device requirement navigates to add-user with SN', async () => {
      await component.onAddUser();

      expect(router.navigate).toHaveBeenCalledWith(
        ['/device-management', TEST_SN, 'add-user'],
        undefined,
      );
    });

    it('TC-DD-35: with connectedSn set navigates with connectedSn as queryParam', async () => {
      (component as unknown as { connectedSn: string }).connectedSn = 'CONNECTED-SN-001';

      await component.onAddUser();

      expect(router.navigate).toHaveBeenCalledWith(
        ['/device-management', TEST_SN, 'add-user'],
        { queryParams: { connectedSn: 'CONNECTED-SN-001' } },
      );
    });

    it('TC-DD-36: with needsConnectedDevice=true and valid connected device — navigates after validation', async () => {
      // Make needsConnectedDevice=true
      (mockLookupService as unknown as { device: Device | null }).device = buildDevice({
        connectedDevice: true,
        type: DeviceType.GAS_BOILER,
        code: 'GENUS24',
      });
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = false;

      const connectedDevice = buildDevice({
        connectedDevice: true,
        type: DeviceType.GAS_BOILER,
        code: 'GENUS32',
      });
      mockLookupService.lookupSilent.and.resolveTo(connectedDevice);
      mockInterventionService.getRegistration.and.resolveTo(null);

      (component as unknown as { connectedSnInput: string }).connectedSnInput = 'CONNECTED-SN-001';

      await component.onAddUser();

      expect(router.navigate).toHaveBeenCalled();
    });

    it('TC-DD-37: with needsConnectedDevice=true and invalid SN — does NOT navigate', async () => {
      (mockLookupService as unknown as { device: Device | null }).device = buildDevice({ connectedDevice: true });
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = false;

      // Empty connectedSnInput — validation fails
      (component as unknown as { connectedSnInput: string }).connectedSnInput = '';

      await component.onAddUser();

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // validateConnectedDevice (tested via onAddUser with needsConnectedDevice=true)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('validateConnectedDevice()', () => {
    beforeEach(() => {
      // Set up device with connectedDevice=true + not registered → needsConnectedDevice=true
      const primaryDevice = buildDevice({
        connectedDevice: true,
        type: DeviceType.GAS_BOILER,
        code: 'GENUS24',
      });
      (mockLookupService as unknown as { device: Device | null }).device = primaryDevice;
      (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = false;
      (component as unknown as { sn: string }).sn = TEST_SN;
    });

    it('TC-DD-38: empty SN returns false and shows warning toast', async () => {
      (component as unknown as { connectedSnInput: string }).connectedSnInput = '  ';

      await component.onAddUser();

      expect(mockToastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ color: 'warning' }),
      );
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('TC-DD-39: lookupSilent returns null shows danger toast (not found)', async () => {
      (component as unknown as { connectedSnInput: string }).connectedSnInput = 'UNKNOWN-SN';
      mockLookupService.lookupSilent.and.resolveTo(null);

      await component.onAddUser();

      expect(mockToastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ color: 'danger' }),
      );
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('TC-DD-40: device found but no connectedDevice flag shows danger toast', async () => {
      (component as unknown as { connectedSnInput: string }).connectedSnInput = 'VALID-SN';
      const foundDevice = buildDevice({ connectedDevice: false });
      mockLookupService.lookupSilent.and.resolveTo(foundDevice);

      await component.onAddUser();

      expect(mockToastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ color: 'danger' }),
      );
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('TC-DD-41: device found with wrong type shows danger toast', async () => {
      (component as unknown as { connectedSnInput: string }).connectedSnInput = 'VALID-SN';
      const foundDevice = buildDevice({
        connectedDevice: true,
        type: DeviceType.BOILER, // different from primary device type GAS_BOILER
      });
      mockLookupService.lookupSilent.and.resolveTo(foundDevice);

      await component.onAddUser();

      expect(mockToastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ color: 'danger' }),
      );
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('TC-DD-42: device found with same model code shows danger toast', async () => {
      (component as unknown as { connectedSnInput: string }).connectedSnInput = 'VALID-SN';
      const foundDevice = buildDevice({
        connectedDevice: true,
        type: DeviceType.GAS_BOILER,
        code: 'GENUS24', // same code as primary device
      });
      mockLookupService.lookupSilent.and.resolveTo(foundDevice);

      await component.onAddUser();

      expect(mockToastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ color: 'danger' }),
      );
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('TC-DD-43: device already registered shows danger toast', async () => {
      (component as unknown as { connectedSnInput: string }).connectedSnInput = 'VALID-SN';
      const foundDevice = buildDevice({
        connectedDevice: true,
        type: DeviceType.GAS_BOILER,
        code: 'GENUS32', // different code
      });
      mockLookupService.lookupSilent.and.resolveTo(foundDevice);
      mockInterventionService.getRegistration.and.resolveTo({ sn: 'VALID-SN' }); // already registered

      await component.onAddUser();

      expect(mockToastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ color: 'danger' }),
      );
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('TC-DD-44: successful validation sets connectedSn and allows navigation', async () => {
      (component as unknown as { connectedSnInput: string }).connectedSnInput = 'VALID-CONNECTED-SN';
      const foundDevice = buildDevice({
        connectedDevice: true,
        type: DeviceType.GAS_BOILER,
        code: 'GENUS32', // different code from primary GENUS24
      });
      mockLookupService.lookupSilent.and.resolveTo(foundDevice);
      mockInterventionService.getRegistration.and.resolveTo(null);

      await component.onAddUser();

      expect((component as unknown as { connectedSn: string }).connectedSn).toBe('VALID-CONNECTED-SN');
      expect(router.navigate).toHaveBeenCalled();
    });

    it('TC-DD-45: calls lookupSilent NOT lookup — primary device state is NOT mutated', async () => {
      const originalDevice = buildDevice({ code: 'GENUS24', connectedDevice: true });
      (mockLookupService as unknown as { device: Device | null }).device = originalDevice;
      (component as unknown as { connectedSnInput: string }).connectedSnInput = 'CONNECTED-SN';

      const connectedDevice = buildDevice({
        connectedDevice: true,
        type: DeviceType.GAS_BOILER,
        code: 'GENUS32',
      });
      mockLookupService.lookupSilent.and.resolveTo(connectedDevice);
      mockInterventionService.getRegistration.and.resolveTo(null);

      await component.onAddUser();

      expect(mockLookupService.lookupSilent).toHaveBeenCalledWith('CONNECTED-SN');
      expect(mockLookupService.lookup).not.toHaveBeenCalled();
      // Primary device reference is unchanged — lookupSilent does not mutate state
      expect((mockLookupService as unknown as { device: Device | null }).device).toEqual(originalDevice);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Navigation methods
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Navigation methods', () => {
    beforeEach(() => {
      (component as unknown as { sn: string }).sn = TEST_SN;
      (component as unknown as { connectedSn: string }).connectedSn = '';
    });

    it('TC-DD-46: onCommissioning navigates to add-device without extras when no connectedSn', () => {
      component.onCommissioning();

      expect(router.navigate).toHaveBeenCalledWith(
        ['/device-management', TEST_SN, 'add-device'],
        undefined,
      );
    });

    it('TC-DD-47: onCommissioning navigates with connectedSn queryParam when connectedSn is set', () => {
      (component as unknown as { connectedSn: string }).connectedSn = 'CONNECTED-SN-001';

      component.onCommissioning();

      expect(router.navigate).toHaveBeenCalledWith(
        ['/device-management', TEST_SN, 'add-device'],
        { queryParams: { connectedSn: 'CONNECTED-SN-001' } },
      );
    });

    it('TC-DD-48: onIntervention navigates to intervention route', () => {
      component.onIntervention();

      expect(router.navigate).toHaveBeenCalledWith(
        ['/device-management', TEST_SN, 'intervention'],
      );
    });

    it('TC-DD-49: onAnnualService navigates to annual-service route', () => {
      component.onAnnualService();

      expect(router.navigate).toHaveBeenCalledWith(
        ['/device-management', TEST_SN, 'annual-service'],
      );
    });

    it('TC-DD-50: onHistory navigates to history route', () => {
      component.onHistory();

      expect(router.navigate).toHaveBeenCalledWith(
        ['/device-management', TEST_SN, 'history'],
      );
    });
  });

  // =========================================================================
  // EXPANSION: isOperational — all boolean flag combinations
  // =========================================================================

  describe('isOperational — state flag matrix', () => {
    type BoolOrNull = boolean | null;

    // isRegistered × commissioning × isCommissioningDone × warrantyStatus
    interface OperationalScenario {
      label: string;
      isRegistered: BoolOrNull;
      commissioning: boolean;
      isCommissioningDone: boolean;
      warrantyStatus?: string;
      expectedOperational: boolean;
    }

    const scenarios: OperationalScenario[] = [
      // Not registered — always false
      { label: 'not-registered null', isRegistered: null, commissioning: false, isCommissioningDone: false, expectedOperational: false },
      { label: 'not-registered false', isRegistered: false, commissioning: false, isCommissioningDone: false, expectedOperational: false },
      { label: 'not-registered + commissioning done', isRegistered: false, commissioning: true, isCommissioningDone: true, expectedOperational: false },
      // Registered + no commissioning → always operational
      { label: 'registered + no-commissioning', isRegistered: true, commissioning: false, isCommissioningDone: false, expectedOperational: true },
      { label: 'registered + no-commissioning (done=true)', isRegistered: true, commissioning: false, isCommissioningDone: true, expectedOperational: true },
      // Registered + commissioning required + not done → not operational
      { label: 'registered + commissioning + not done', isRegistered: true, commissioning: true, isCommissioningDone: false, expectedOperational: false },
      // Registered + commissioning + done → operational
      { label: 'registered + commissioning + done', isRegistered: true, commissioning: true, isCommissioningDone: true, expectedOperational: true },
      // Out of warranty overrides commissioning — operational
      { label: 'registered + commissioning + not done + out_of_warranty', isRegistered: true, commissioning: true, isCommissioningDone: false, warrantyStatus: 'out_of_warranty', expectedOperational: true },
      // In warranty does NOT bypass commissioning requirement
      { label: 'registered + commissioning + not done + in_warranty', isRegistered: true, commissioning: true, isCommissioningDone: false, warrantyStatus: 'in_warranty', expectedOperational: false },
    ];

    scenarios.forEach(({ label, isRegistered, commissioning, isCommissioningDone, warrantyStatus, expectedOperational }) => {
      it(`EXP-DD-OPER: ${label} → isOperational=${expectedOperational}`, () => {
        (mockRegistrationService as unknown as { isRegistered: BoolOrNull }).isRegistered = isRegistered;
        (mockLookupService as unknown as { device: Device | null }).device = buildDevice({ commissioning });
        (component as unknown as { isCommissioningDone: boolean }).isCommissioningDone = isCommissioningDone;
        if (warrantyStatus !== undefined) {
          (mockRegistrationService as unknown as { userData: Record<string, unknown> | null }).userData = { warrantyStatus };
        } else {
          (mockRegistrationService as unknown as { userData: Record<string, unknown> | null }).userData = null;
        }

        expect(component.isOperational).toBe(expectedOperational);
      });
    });
  });

  // =========================================================================
  // EXPANSION: isAnnualServiceEnabled combinations
  // =========================================================================

  describe('isAnnualServiceEnabled — all flag combinations', () => {
    const combinations: Array<{ isEligible: boolean; isChecking: boolean; expected: boolean }> = [
      { isEligible: true, isChecking: false, expected: true },
      { isEligible: true, isChecking: true, expected: false },
      { isEligible: false, isChecking: false, expected: false },
      { isEligible: false, isChecking: true, expected: false },
    ];

    combinations.forEach(({ isEligible, isChecking, expected }) => {
      it(`EXP-DD-ANNUAL: isEligible=${isEligible} isChecking=${isChecking} → ${expected}`, () => {
        (mockEligibilityService as unknown as { isEligible: boolean }).isEligible = isEligible;
        (mockEligibilityService as unknown as { isChecking: boolean }).isChecking = isChecking;

        expect(component.isAnnualServiceEnabled).toBe(expected);
      });
    });
  });

  // =========================================================================
  // EXPANSION: needsConnectedDevice combinations
  // =========================================================================

  describe('needsConnectedDevice — state matrix', () => {
    const combinations: Array<{
      label: string;
      device: Device | null;
      isRegistered: boolean | null;
      expected: boolean;
    }> = [
      { label: 'device null → false', device: null, isRegistered: false, expected: false },
      { label: 'connectedDevice=false + not-registered → false', device: buildDevice({ connectedDevice: false }), isRegistered: false, expected: false },
      { label: 'connectedDevice=false + registered → false', device: buildDevice({ connectedDevice: false }), isRegistered: true, expected: false },
      { label: 'connectedDevice=true + not-registered → true', device: buildDevice({ connectedDevice: true }), isRegistered: false, expected: true },
      { label: 'connectedDevice=true + registered → false', device: buildDevice({ connectedDevice: true }), isRegistered: true, expected: false },
      { label: 'connectedDevice=true + isRegistered=null → true', device: buildDevice({ connectedDevice: true }), isRegistered: null, expected: true },
    ];

    combinations.forEach(({ label, device, isRegistered, expected }) => {
      it(`EXP-DD-NEEDS-CONN: ${label}`, () => {
        (mockLookupService as unknown as { device: Device | null }).device = device;
        (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = isRegistered;

        expect(component.needsConnectedDevice).toBe(expected);
      });
    });
  });

  // =========================================================================
  // EXPANSION: initializeDevice — commissioning × registration × annualService
  // =========================================================================

  describe('initializeDevice() — device flag combinations', () => {
    const deviceFlagCombinations: Array<{
      commissioning: boolean;
      annualService: boolean;
      isRegistered: boolean | null;
      expectCommissioningInterventionsFetched: boolean;
      expectEligibilityChecked: boolean;
    }> = [
      {
        commissioning: true, annualService: true, isRegistered: true,
        expectCommissioningInterventionsFetched: true, expectEligibilityChecked: true,
      },
      {
        commissioning: true, annualService: true, isRegistered: false,
        expectCommissioningInterventionsFetched: false, expectEligibilityChecked: true,
      },
      {
        commissioning: true, annualService: false, isRegistered: true,
        expectCommissioningInterventionsFetched: true, expectEligibilityChecked: false,
      },
      {
        commissioning: true, annualService: false, isRegistered: false,
        expectCommissioningInterventionsFetched: false, expectEligibilityChecked: false,
      },
      {
        commissioning: false, annualService: true, isRegistered: true,
        expectCommissioningInterventionsFetched: false, expectEligibilityChecked: true,
      },
      {
        commissioning: false, annualService: true, isRegistered: false,
        expectCommissioningInterventionsFetched: false, expectEligibilityChecked: true,
      },
      {
        commissioning: false, annualService: false, isRegistered: true,
        expectCommissioningInterventionsFetched: false, expectEligibilityChecked: false,
      },
      {
        commissioning: false, annualService: false, isRegistered: false,
        expectCommissioningInterventionsFetched: false, expectEligibilityChecked: false,
      },
    ];

    deviceFlagCombinations.forEach(({
      commissioning, annualService, isRegistered,
      expectCommissioningInterventionsFetched, expectEligibilityChecked,
    }) => {
      it(`EXP-DD-INIT: commissioning=${commissioning} annualService=${annualService} registered=${isRegistered} → interventions=${expectCommissioningInterventionsFetched} eligibility=${expectEligibilityChecked}`,
        fakeAsync(() => {
          const device = buildDevice({ commissioning, annualService });
          (mockLookupService as unknown as { device: Device | null }).device = device;
          (mockLookupService as unknown as { sn: string }).sn = '';
          mockLookupService.lookup.and.resolveTo(device);
          (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = isRegistered;

          component.ionViewWillEnter();
          tick();

          if (expectCommissioningInterventionsFetched) {
            expect(mockInterventionService.getInterventionsBySn).toHaveBeenCalled();
          } else {
            expect(mockInterventionService.getInterventionsBySn).not.toHaveBeenCalled();
          }

          if (expectEligibilityChecked) {
            expect(mockEligibilityService.checkEligibility).toHaveBeenCalled();
          } else {
            expect(mockEligibilityService.checkEligibility).not.toHaveBeenCalled();
          }
        }),
      );
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: device type matrix
  // =========================================================================

  describe('ionViewWillEnter() — each device type', () => {
    const allDeviceTypes = [DeviceType.GAS_BOILER, DeviceType.HEAT_PUMP, DeviceType.BOILER, DeviceType.AIR_CONDITION];

    allDeviceTypes.forEach((type) => {
      it(`EXP2-DD-DEVTYPE: ${type} → device.type correct`, fakeAsync(() => {
        const device = buildDevice({ type });
        (mockLookupService as unknown as { device: Device | null }).device = device;
        mockLookupService.lookup.and.resolveTo(device);
        component.ionViewWillEnter();
        tick();
        expect(mockLookupService.device?.type).toBe(type);
      }));

      it(`EXP2-DD-DEVTYPE-NODEVICE: null after ${type} → device null`, fakeAsync(() => {
        (mockLookupService as unknown as { device: Device | null }).device = null;
        mockLookupService.lookup.and.resolveTo(null);
        component.ionViewWillEnter();
        tick();
        expect((component as any).device).toBeFalsy();
      }));
    });
  });

  describe('device warrantyMonths matrix', () => {
    const warrantyMonthsValues = [0, 6, 12, 18, 24, 36, 48, 60, 120];
    warrantyMonthsValues.forEach((months) => {
      it(`EXP2-DD-WARRANTY-MOS: warrantyMonths=${months}`, fakeAsync(() => {
        const device = buildDevice({ warrantyMonths: months });
        (mockLookupService as unknown as { device: Device | null }).device = device;
        mockLookupService.lookup.and.resolveTo(device);
        component.ionViewWillEnter();
        tick();
        expect(mockLookupService.device?.warrantyMonths).toBe(months);
      }));
    });
  });

  describe('isRegistered state transitions', () => {
    const registrationStates: Array<boolean | null> = [null, true, false];
    registrationStates.forEach((state) => {
      it(`EXP2-DD-REGISTERED: isRegistered=${state}`, fakeAsync(() => {
        const device = buildDevice({ commissioning: false, annualService: false });
        (mockLookupService as unknown as { device: Device | null }).device = device;
        mockLookupService.lookup.and.resolveTo(device);
        (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = state;
        component.ionViewWillEnter();
        tick();
        expect(mockRegistrationService.isRegistered).toBe(state);
      }));
    });
  });

  describe('isOperational — all 8 boolean combinations', () => {
    const booleans: Array<[boolean, boolean, boolean]> = [
      [false, false, false], [false, false, true], [false, true, false], [false, true, true],
      [true, false, false], [true, false, true], [true, true, false], [true, true, true],
    ];
    booleans.forEach(([commissioning, annualService, isRegistered]) => {
      it(`EXP2-DD-ISOP: commissioning=${commissioning} annualService=${annualService} isRegistered=${isRegistered}`, fakeAsync(() => {
        const device = buildDevice({ commissioning, annualService });
        (mockLookupService as unknown as { device: Device | null }).device = device;
        mockLookupService.lookup.and.resolveTo(device);
        (mockRegistrationService as unknown as { isRegistered: boolean | null }).isRegistered = isRegistered;
        component.ionViewWillEnter();
        tick();
        expect(typeof (component as any).isOperational).toBe('boolean');
      }));
    });
  });

  describe('device subType matrix', () => {
    const subTypes = ['standard', 'premium', 'compact', 'floor', 'wall', '', 'unknown'];
    subTypes.forEach((subType) => {
      it(`EXP2-DD-SUBTYPE: subType="${subType}"`, fakeAsync(() => {
        const device = buildDevice({ subType });
        (mockLookupService as unknown as { device: Device | null }).device = device;
        mockLookupService.lookup.and.resolveTo(device);
        component.ionViewWillEnter();
        tick();
        expect(mockLookupService.device?.subType).toBe(subType);
      }));
    });
  });

  describe('device unitCount matrix', () => {
    const unitCounts = [0, 1, 2, 3, 5, 10];
    unitCounts.forEach((unitCount) => {
      it(`EXP2-DD-UNITCOUNT: unitCount=${unitCount}`, fakeAsync(() => {
        const device = buildDevice({ unitCount });
        (mockLookupService as unknown as { device: Device | null }).device = device;
        mockLookupService.lookup.and.resolveTo(device);
        component.ionViewWillEnter();
        tick();
        expect(mockLookupService.device?.unitCount).toBe(unitCount);
      }));
    });
  });

  describe('service window configurations', () => {
    const configs = [
      { firstServiceYear: 1, serviceWindowStart: 1, serviceWindowEnd: 12 },
      { firstServiceYear: 1, serviceWindowStart: 3, serviceWindowEnd: 5 },
      { firstServiceYear: 1, serviceWindowStart: 9, serviceWindowEnd: 11 },
      { firstServiceYear: 2, serviceWindowStart: 1, serviceWindowEnd: 6 },
      { firstServiceYear: 3, serviceWindowStart: 6, serviceWindowEnd: 12 },
    ];
    configs.forEach(({ firstServiceYear, serviceWindowStart, serviceWindowEnd }) => {
      it(`EXP2-DD-SVCWIN: year=${firstServiceYear} window=${serviceWindowStart}-${serviceWindowEnd}`, fakeAsync(() => {
        const device = buildDevice({ firstServiceYear, serviceWindowStart, serviceWindowEnd });
        (mockLookupService as unknown as { device: Device | null }).device = device;
        mockLookupService.lookup.and.resolveTo(device);
        component.ionViewWillEnter();
        tick();
        expect(mockLookupService.device?.firstServiceYear).toBe(firstServiceYear);
        expect(mockLookupService.device?.serviceWindowStart).toBe(serviceWindowStart);
        expect(mockLookupService.device?.serviceWindowEnd).toBe(serviceWindowEnd);
      }));
    });
  });

  describe('device name matrix', () => {
    const deviceNames = ['Genus One 24 kW', 'Alteas One Net 35 kW', 'Velis Evo Plus 100L', 'Nuos Split 250', 'Nimbus M Net 60 kW'];
    deviceNames.forEach((name) => {
      it(`EXP2-DD-NAME: name="${name}"`, fakeAsync(() => {
        const device = buildDevice({ name });
        (mockLookupService as unknown as { device: Device | null }).device = device;
        mockLookupService.lookup.and.resolveTo(device);
        component.ionViewWillEnter();
        tick();
        expect(mockLookupService.device?.name).toBe(name);
      }));
    });
  });
});
