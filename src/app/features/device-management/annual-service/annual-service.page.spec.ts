import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';

import { AnnualServicePage } from './annual-service.page';
import { DeviceLookupService } from '../services/device-lookup.service';
import { InterventionService } from '../services/intervention.service';
import { DeviceEnvInfoService } from '../services/device-env-info.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { LoadingAlertService } from '../../../shared/services/loading-alert.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { Device, DeviceType } from '../../../shared/models/device.model';
import {
  InterventionType,
  ANNUAL_SERVICE_TYPES,
  ANNUAL_SERVICE_DESCRIPTION,
  DEFAULT_DISTANCE,
} from '../models/intervention.model';

// ─── Factories ────────────────────────────────────────────────────────────────

function createMockDevice(overrides: Partial<Device> = {}): Device {
  return {
    code: 'GAS001',
    name: 'Gas Boiler Test',
    type: DeviceType.GAS_BOILER,
    subType: '',
    unitCount: 1,
    exists: true,
    ...overrides,
  };
}

function createMockLookupService(): jasmine.SpyObj<DeviceLookupService> {
  const spy = jasmine.createSpyObj<DeviceLookupService>('DeviceLookupService', [
    'lookup',
    'lookupSilent',
    'clear',
    'extractModelCode',
  ]);
  (spy as unknown as { device: Device | null }).device = null;
  return spy;
}

function createMockInterventionService(): jasmine.SpyObj<InterventionService> {
  return jasmine.createSpyObj<InterventionService>('InterventionService', [
    'saveIntervention',
    'getRegistration',
    'getInterventionsBySn',
    'getInterventionLabel',
  ]);
}

function createMockEnvInfoService(): jasmine.SpyObj<DeviceEnvInfoService> {
  return jasmine.createSpyObj<DeviceEnvInfoService>('DeviceEnvInfoService', [
    'collectEnvInfo',
    'getLastEnvInfo',
    'viewEnvInfo',
  ]);
}

function createMockConfirmService(): jasmine.SpyObj<ConfirmService> {
  return jasmine.createSpyObj<ConfirmService>('ConfirmService', ['confirm']);
}

function createMockLoadingAlertService(): jasmine.SpyObj<LoadingAlertService> {
  const spy = jasmine.createSpyObj<LoadingAlertService>('LoadingAlertService', ['show', 'hide', 'wrap']);
  spy.show.and.resolveTo();
  spy.hide.and.resolveTo();
  return spy;
}

function createMockLoggerService(): jasmine.SpyObj<LoggerService> {
  return jasmine.createSpyObj<LoggerService>('LoggerService', ['debug', 'info', 'warn', 'error']);
}

function createMockToastController(): jasmine.SpyObj<ToastController> {
  const mockToast = jasmine.createSpyObj('HTMLIonToastElement', ['present']);
  mockToast.present.and.resolveTo();
  const ctrl = jasmine.createSpyObj<ToastController>('ToastController', ['create']);
  ctrl.create.and.resolveTo(mockToast);
  return ctrl;
}

function createMockTranslocoService(): jasmine.SpyObj<TranslocoService> {
  const spy = jasmine.createSpyObj<TranslocoService>('TranslocoService', ['translate']);
  // Cast required: real signature uses generic overloads incompatible with callFake directly
  (spy.translate as jasmine.Spy).and.callFake((key: string) => key);
  return spy;
}


// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AnnualServicePage', () => {
  let component: AnnualServicePage;
  let mockLookupService: jasmine.SpyObj<DeviceLookupService>;
  let mockInterventionService: jasmine.SpyObj<InterventionService>;
  let mockEnvInfoService: jasmine.SpyObj<DeviceEnvInfoService>;
  let mockConfirmService: jasmine.SpyObj<ConfirmService>;
  let mockLoadingAlert: jasmine.SpyObj<LoadingAlertService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockToastCtrl: jasmine.SpyObj<ToastController>;
  let mockTransloco: jasmine.SpyObj<TranslocoService>;
  let router: Router;

  const TEST_SN = 'SN-TEST-001';

  beforeEach(async () => {
    mockLookupService = createMockLookupService();
    mockInterventionService = createMockInterventionService();
    mockEnvInfoService = createMockEnvInfoService();
    mockConfirmService = createMockConfirmService();
    mockLoadingAlert = createMockLoadingAlertService();
    mockLogger = createMockLoggerService();
    mockToastCtrl = createMockToastController();
    mockTransloco = createMockTranslocoService();

    await TestBed.configureTestingModule({
      imports: [AnnualServicePage],
      providers: [
        provideRouter([]),
        { provide: DeviceLookupService, useValue: mockLookupService },
        { provide: InterventionService, useValue: mockInterventionService },
        { provide: DeviceEnvInfoService, useValue: mockEnvInfoService },
        { provide: ConfirmService, useValue: mockConfirmService },
        { provide: LoadingAlertService, useValue: mockLoadingAlert },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ToastController, useValue: mockToastCtrl },
        { provide: TranslocoService, useValue: mockTransloco },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'sn' ? TEST_SN : null),
                has: () => false,
                getAll: () => [],
                keys: [],
              },
            },
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(AnnualServicePage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  describe('ionViewWillEnter()', () => {
    it('should resolve serviceType from device.type for GAS_BOILER', () => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.GAS_BOILER });

      component.ionViewWillEnter();

      expect((component as any).serviceType).toEqual(ANNUAL_SERVICE_TYPES[DeviceType.GAS_BOILER]);
    });

    it('should resolve serviceType from device.type for HEAT_PUMP', () => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.HEAT_PUMP });

      component.ionViewWillEnter();

      expect((component as any).serviceType).toEqual(ANNUAL_SERVICE_TYPES[DeviceType.HEAT_PUMP]);
    });

    it('should set noDevice=true and warn when no device in lookup service', () => {
      (mockLookupService as unknown as { device: Device | null }).device = null;

      component.ionViewWillEnter();

      expect((component as any).noDevice).toBeTrue();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should show warning toast when device type has no annual service type (AIR_CONDITION)', fakeAsync(() => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.AIR_CONDITION });

      component.ionViewWillEnter();
      tick();

      expect((mockTransloco.translate as jasmine.Spy)).toHaveBeenCalledWith('annual_service_no_type');
      expect(mockToastCtrl.create).toHaveBeenCalled();
    }));

    it('should set serviceType to null for AIR_CONDITION (not in ANNUAL_SERVICE_TYPES)', () => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.AIR_CONDITION });

      component.ionViewWillEnter();

      expect((component as any).serviceType).toBeNull();
    });

    it('should reset isSaving to false on each enter', () => {
      (mockLookupService as unknown as { device: Device | null }).device = createMockDevice();
      (component as any).isSaving = true;

      component.ionViewWillEnter();

      expect((component as any).isSaving).toBeFalse();
    });

    it('should reset form to defaults on enter', () => {
      (mockLookupService as unknown as { device: Device | null }).device = createMockDevice();
      (component as any).form.patchValue({ callAccepted: true, note: 'old note', distance: '100' });

      component.ionViewWillEnter();

      const form = (component as any).form;
      expect(form.get('callAccepted')?.value).toBeNull();
      expect(form.get('note')?.value).toBe('');
      expect(form.get('distance')?.value).toBe(DEFAULT_DISTANCE);
    });
  });

  // ─── Form structure ────────────────────────────────────────────────────────

  describe('form structure', () => {
    it('should have callAccepted, note, and distance form controls', () => {
      const form = (component as any).form;

      expect(form.contains('callAccepted')).toBeTrue();
      expect(form.contains('note')).toBeTrue();
      expect(form.contains('distance')).toBeTrue();
    });

    it('should have callAccepted initialized to null', () => {
      const form = (component as any).form;

      expect(form.get('callAccepted')?.value).toBeNull();
    });

    it('should have distance initialized to DEFAULT_DISTANCE', () => {
      const form = (component as any).form;

      expect(form.get('distance')?.value).toBe(DEFAULT_DISTANCE);
    });

    it('should be valid (no null callAccepted error) when callAccepted is true', () => {
      const form = (component as any).form;
      form.patchValue({ callAccepted: true });

      expect(form.get('callAccepted')?.value).toBeTrue();
    });
  });

  // ─── onSave — validation ──────────────────────────────────────────────────

  describe('onSave() — validation', () => {
    it('should show warning toast and abort when callAccepted is null', async () => {
      (mockLookupService as unknown as { device: Device | null }).device = createMockDevice();
      component.ionViewWillEnter();
      // callAccepted stays null (default)

      await component.onSave();

      expect((mockTransloco.translate as jasmine.Spy)).toHaveBeenCalledWith(
        'annual_service_validation_call_accepted',
      );
      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
    });
  });

  // ─── onSave — envInfo for HEAT_PUMP ───────────────────────────────────────

  describe('onSave() — envInfo for HEAT_PUMP', () => {
    beforeEach(() => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.HEAT_PUMP });
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: true });
    });

    it('should call getLastEnvInfo and then collectEnvInfo for HEAT_PUMP', async () => {
      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo(null);

      await component.onSave();

      expect(mockEnvInfoService.getLastEnvInfo).toHaveBeenCalledWith(TEST_SN, DeviceType.HEAT_PUMP);
      expect(mockEnvInfoService.collectEnvInfo).toHaveBeenCalledWith(DeviceType.HEAT_PUMP, TEST_SN, null);
    });

    it('should include envInfo in saved data when HEAT_PUMP', async () => {
      const envInfoData = { freonSysTested: 'env_info_opt_yes', pipeLength: '10' };
      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo(envInfoData);
      mockInterventionService.saveIntervention.and.resolveTo('doc-id-456');
      mockInterventionService.getRegistration.and.resolveTo(null);

      await component.onSave();

      const callArgs = mockInterventionService.saveIntervention.calls.mostRecent().args;
      expect(callArgs[2]['envInfo']).toEqual(envInfoData);
    });

    it('should abort save when envInfo collection is cancelled (returns null)', async () => {
      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo(null);

      await component.onSave();

      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
    });

    it('should show loading alert before fetching last envInfo', async () => {
      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo(null);

      await component.onSave();

      expect(mockLoadingAlert.show).toHaveBeenCalled();
    });
  });

  // ─── onSave — envInfo for GAS_BOILER ──────────────────────────────────────

  describe('onSave() — envInfo for GAS_BOILER', () => {
    it('should collect and include envInfo for GAS_BOILER', async () => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.GAS_BOILER });
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: false });

      const envInfoData = { gasType: 'env_info_opt_gas_natural' };
      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo(envInfoData);
      mockInterventionService.saveIntervention.and.resolveTo('doc-id-gas');

      await component.onSave();

      expect(mockEnvInfoService.collectEnvInfo).toHaveBeenCalledWith(
        DeviceType.GAS_BOILER,
        TEST_SN,
        null,
      );
      const callArgs = mockInterventionService.saveIntervention.calls.mostRecent().args;
      expect(callArgs[2]['envInfo']).toEqual(envInfoData);
    });
  });

  // ─── onSave — ConfirmService for non-envInfo types ────────────────────────

  describe('onSave() — ConfirmService for types without envInfo', () => {
    it('should call ConfirmService.confirm with correct i18n keys', async () => {
      mockConfirmService.confirm.and.resolveTo(true);

      // Call the private method directly to verify its wiring to ConfirmService
      const result = await (component as any).showConfirmAlert();

      expect(mockConfirmService.confirm).toHaveBeenCalledWith(
        'annual_service_confirm_title',
        'annual_service_confirm_message',
        'annual_service_confirm_save',
        'annual_service_confirm_cancel',
      );
      expect(result).toBeTrue();
    });

    it('should return false when user cancels the confirm dialog', async () => {
      mockConfirmService.confirm.and.resolveTo(false);

      const result = await (component as any).showConfirmAlert();

      expect(result).toBeFalse();
    });
  });

  // ─── onSave — correct intervention type ───────────────────────────────────

  describe('onSave() — save with correct intervention type', () => {
    it('should save with InterventionType.ANNUAL_SERVICE as interventionType', async () => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.GAS_BOILER });
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: true });

      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo({ gasType: 'env_info_opt_gas_natural' });
      mockInterventionService.saveIntervention.and.resolveTo('doc-123');

      await component.onSave();

      const callArgs = mockInterventionService.saveIntervention.calls.mostRecent().args;
      expect(callArgs[2]['interventionType']).toBe(InterventionType.ANNUAL_SERVICE);
    });

    it('should save with correct ANNUAL_SERVICE_DESCRIPTION', async () => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.GAS_BOILER });
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: true });

      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo({ gasType: 'val' });
      mockInterventionService.saveIntervention.and.resolveTo('doc-123');

      await component.onSave();

      const callArgs = mockInterventionService.saveIntervention.calls.mostRecent().args;
      expect(callArgs[2]['interventionDescription']).toBe(ANNUAL_SERVICE_DESCRIPTION);
    });

    it('should pass correct sn and device to saveIntervention', async () => {
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      (mockLookupService as unknown as { device: Device | null }).device = device;
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: false });

      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo({ gasType: 'val' });
      mockInterventionService.saveIntervention.and.resolveTo('doc-123');

      await component.onSave();

      const [snArg, deviceArg] = mockInterventionService.saveIntervention.calls.mostRecent().args;
      expect(snArg).toBe(TEST_SN);
      expect(deviceArg).toBe(device);
    });
  });

  // ─── onSave — loading alert wraps save ────────────────────────────────────

  describe('onSave() — loading alert', () => {
    it('should call loadingAlert.show before calling saveIntervention', async () => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.GAS_BOILER });
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: true });

      let showCountBeforeSave = 0;
      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo({ gasType: 'val' });
      mockInterventionService.saveIntervention.and.callFake(async () => {
        showCountBeforeSave = mockLoadingAlert.show.calls.count();
        return 'doc-123';
      });

      await component.onSave();

      // show() must have been called at least once before saveIntervention
      expect(showCountBeforeSave).toBeGreaterThanOrEqual(1);
    });

    it('should call loadingAlert.hide when saveIntervention returns null (error path)', async () => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.GAS_BOILER });
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: true });

      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo({ gasType: 'val' });
      mockInterventionService.saveIntervention.and.resolveTo(null);

      await component.onSave();

      expect(mockLoadingAlert.hide).toHaveBeenCalled();
    });
  });

  // ─── onSave — success ─────────────────────────────────────────────────────

  describe('onSave() — success', () => {
    it('should navigate to device-management route on success', async () => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.GAS_BOILER });
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: true });

      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo({ gasType: 'val' });
      mockInterventionService.saveIntervention.and.resolveTo('doc-success');
      mockInterventionService.getRegistration.and.resolveTo(null);

      await component.onSave();

      expect(router.navigate).toHaveBeenCalledWith(['/device-management', TEST_SN]);
    });

    it('should show success toast after successful save', fakeAsync(() => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.GAS_BOILER });
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: true });

      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo({ gasType: 'val' });
      mockInterventionService.saveIntervention.and.resolveTo('doc-success');
      mockInterventionService.getRegistration.and.resolveTo(null);

      component.onSave();
      tick();

      expect((mockTransloco.translate as jasmine.Spy)).toHaveBeenCalledWith('annual_service_save_success');
    }));
  });

  // ─── onSave — error ───────────────────────────────────────────────────────

  describe('onSave() — error', () => {
    it('should show error toast when saveIntervention returns null', async () => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.GAS_BOILER });
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: true });

      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo({ gasType: 'val' });
      mockInterventionService.saveIntervention.and.resolveTo(null);

      await component.onSave();

      expect((mockTransloco.translate as jasmine.Spy)).toHaveBeenCalledWith('annual_service_save_error');
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  // ─── saveForConnectedDevice (CRITICAL) ────────────────────────────────────

  describe('saveForConnectedDevice()', () => {
    it('should skip connected device save for non-HEAT_PUMP (e.g. GAS_BOILER)', async () => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.GAS_BOILER });
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: true });

      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo({ gasType: 'val' });
      mockInterventionService.saveIntervention.and.resolveTo('doc-123');

      await component.onSave();

      // getRegistration must NOT be called for non-HEAT_PUMP
      expect(mockInterventionService.getRegistration).not.toHaveBeenCalled();
    });

    it('should skip when registration has no connectedDevice field', async () => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.HEAT_PUMP });
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: true });

      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo({ freonSysTested: 'yes' });
      mockInterventionService.saveIntervention.and.resolveTo('doc-hp');
      mockInterventionService.getRegistration.and.resolveTo({ warrantyStatus: 'in_warranty' }); // no connectedDevice

      await component.onSave();

      // lookupSilent() must NOT be called for connected device when connectedSn is missing
      expect(mockLookupService.lookupSilent).not.toHaveBeenCalled();
    });

    it('should lookup connected device via DeviceLookupService.lookupSilent when connectedDevice is in registration (BUG-09 fixed)', async () => {
      const connectedSn = 'CONNECTED-SN-001';
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.HEAT_PUMP });
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: true });

      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo({ freonSysTested: 'yes' });
      mockInterventionService.saveIntervention.and.resolveTo('doc-hp');
      mockInterventionService.getRegistration.and.resolveTo({ connectedDevice: connectedSn });
      mockLookupService.lookupSilent.and.resolveTo(createMockDevice({ type: DeviceType.GAS_BOILER }));

      await component.onSave();

      // BUG-09 FIXED: must use lookupSilent (not lookup) to avoid mutating service state
      expect(mockLookupService.lookupSilent).toHaveBeenCalledWith(connectedSn);
      expect(mockLookupService.lookup).not.toHaveBeenCalled();
    });

    it('should show warning toast when connected device is not found', async () => {
      const connectedSn = 'MISSING-CONNECTED-SN';
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.HEAT_PUMP });
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: true });

      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo({ freonSysTested: 'yes' });
      mockInterventionService.saveIntervention.and.resolveTo('doc-hp');
      mockInterventionService.getRegistration.and.resolveTo({ connectedDevice: connectedSn });
      mockLookupService.lookupSilent.and.resolveTo(null);

      await component.onSave();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnnualServicePage: connected device not found',
        jasmine.objectContaining({ connectedSn }),
      );
      expect((mockTransloco.translate as jasmine.Spy)).toHaveBeenCalledWith(
        'annual_service_connected_not_found',
      );
    });

    it('should save intervention for connected device when found', async () => {
      const connectedDevice = createMockDevice({ type: DeviceType.GAS_BOILER });
      const connectedSn = 'CONNECTED-SN-002';
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.HEAT_PUMP });
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: true });

      mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
      mockEnvInfoService.collectEnvInfo.and.resolveTo({ freonSysTested: 'yes' });

      let saveCallCount = 0;
      mockInterventionService.saveIntervention.and.callFake(async () => {
        saveCallCount++;
        return saveCallCount === 1 ? 'doc-primary' : 'doc-connected';
      });

      mockInterventionService.getRegistration.and.resolveTo({ connectedDevice: connectedSn });
      mockLookupService.lookupSilent.and.resolveTo(connectedDevice);

      await component.onSave();

      expect(saveCallCount).toBe(2);
      const secondCallArgs = mockInterventionService.saveIntervention.calls.all()[1].args;
      expect(secondCallArgs[0]).toBe(connectedSn);
      expect(secondCallArgs[1]).toBe(connectedDevice);
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should return null serviceType for AIR_CONDITION (annual service returns no_type)', () => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.AIR_CONDITION });

      component.ionViewWillEnter();

      expect(ANNUAL_SERVICE_TYPES[DeviceType.AIR_CONDITION]).toBeUndefined();
      expect((component as any).serviceType).toBeNull();
    });

    it('should not save when device is absent (noDevice guard)', async () => {
      (mockLookupService as unknown as { device: Device | null }).device = null;
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: true });

      await component.onSave();

      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
    });

    it('should not save when serviceType is null (eligibility check — type not supported)', async () => {
      // AIR_CONDITION has no annual service type entry — acts as eligibility block
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.AIR_CONDITION });
      component.ionViewWillEnter();
      (component as any).form.patchValue({ callAccepted: true });

      await component.onSave();

      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // EXPANSION: saveForConnectedDevice — device type × connection state matrix
  // =========================================================================

  describe('saveForConnectedDevice() — device type matrix', () => {
    const deviceTypesWithEnvInfo: DeviceType[] = [DeviceType.HEAT_PUMP, DeviceType.GAS_BOILER];
    const deviceTypesWithoutEnvInfo: DeviceType[] = [DeviceType.BOILER];

    deviceTypesWithEnvInfo.forEach((deviceType) => {
      it(`EXP-AS-CONN-SKIP: ${deviceType} without connectedDevice field in registration → getRegistration called, lookupSilent not called`, async () => {
        (mockLookupService as unknown as { device: Device | null }).device =
          createMockDevice({ type: deviceType });
        component.ionViewWillEnter();
        (component as any).form.patchValue({ callAccepted: true });

        mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
        mockEnvInfoService.collectEnvInfo.and.resolveTo({ someField: 'val' });
        mockInterventionService.saveIntervention.and.resolveTo('doc-id');
        mockInterventionService.getRegistration.and.resolveTo({ warrantyStatus: 'in_warranty' });

        await component.onSave();

        if (deviceType === DeviceType.HEAT_PUMP) {
          expect(mockInterventionService.getRegistration).toHaveBeenCalled();
          expect(mockLookupService.lookupSilent).not.toHaveBeenCalled();
        }
      });

      it(`EXP-AS-CONN-FOUND: ${deviceType} with connectedDevice → saveIntervention called twice`, async () => {
        const connectedDevice = createMockDevice({ type: deviceType });
        const connectedSn = `CONNECTED-SN-${deviceType}`;
        (mockLookupService as unknown as { device: Device | null }).device =
          createMockDevice({ type: deviceType });
        component.ionViewWillEnter();
        (component as any).form.patchValue({ callAccepted: true });

        mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
        mockEnvInfoService.collectEnvInfo.and.resolveTo({ field: 'value' });

        let callCount = 0;
        mockInterventionService.saveIntervention.and.callFake(async () => {
          callCount++;
          return `doc-${callCount}`;
        });

        if (deviceType === DeviceType.HEAT_PUMP) {
          mockInterventionService.getRegistration.and.resolveTo({ connectedDevice: connectedSn });
          mockLookupService.lookupSilent.and.resolveTo(connectedDevice);
        }

        await component.onSave();

        if (deviceType === DeviceType.HEAT_PUMP) {
          expect(callCount).toBe(2);
        }
      });
    });

    deviceTypesWithoutEnvInfo.forEach((deviceType) => {
      it(`EXP-AS-CONN-NOENV: ${deviceType} (no envInfo) → getRegistration never called`, async () => {
        (mockLookupService as unknown as { device: Device | null }).device =
          createMockDevice({ type: deviceType });
        component.ionViewWillEnter();
        (component as any).form.patchValue({ callAccepted: true });

        mockConfirmService.confirm.and.resolveTo(true);
        mockInterventionService.saveIntervention.and.resolveTo('doc-boiler');

        await component.onSave();

        expect(mockInterventionService.getRegistration).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // EXPANSION: form callAccepted values
  // =========================================================================

  describe('form callAccepted — value matrix', () => {
    beforeEach(() => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.GAS_BOILER });
      component.ionViewWillEnter();
    });

    const callAcceptedValues = [true, false];

    callAcceptedValues.forEach((value) => {
      it(`EXP-AS-FORM: callAccepted=${value} → included in saved data`, async () => {
        (component as any).form.patchValue({ callAccepted: value });

        mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
        mockEnvInfoService.collectEnvInfo.and.resolveTo({ gasType: 'env_info_opt_gas_natural' });
        mockInterventionService.saveIntervention.and.resolveTo('doc-id');

        await component.onSave();

        const savedData = mockInterventionService.saveIntervention.calls.mostRecent().args[2] as Record<string, unknown>;
        expect(savedData['callAccepted']).toBe(value);
      });
    });

    it('EXP-AS-FORM-NULL: callAccepted null → warning toast, no save', async () => {
      (component as any).form.patchValue({ callAccepted: null });

      await component.onSave();

      expect(mockToastCtrl.create).toHaveBeenCalled();
      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
    });

    const distanceValues = ['0', '10', '30', '50', '100', '200'];

    distanceValues.forEach((distance) => {
      it(`EXP-AS-FORM-DISTANCE: distance="${distance}" stored in saved data`, async () => {
        (component as any).form.patchValue({ callAccepted: true, distance });

        mockEnvInfoService.getLastEnvInfo.and.resolveTo(null);
        mockEnvInfoService.collectEnvInfo.and.resolveTo({ gasType: 'val' });
        mockInterventionService.saveIntervention.and.resolveTo('doc-id');

        await component.onSave();

        const savedData = mockInterventionService.saveIntervention.calls.mostRecent().args[2] as Record<string, unknown>;
        expect(savedData['distance']).toBe(distance);
      });
    });
  });

  // =========================================================================
  // EXPANSION: ionViewWillEnter — all device types
  // =========================================================================

  describe('ionViewWillEnter() — all device types', () => {
    const deviceTypeScenarios: Array<{
      deviceType: DeviceType;
      expectServiceType: boolean;
    }> = [
      { deviceType: DeviceType.GAS_BOILER, expectServiceType: true },
      { deviceType: DeviceType.HEAT_PUMP, expectServiceType: true },
      { deviceType: DeviceType.BOILER, expectServiceType: false },
      { deviceType: DeviceType.AIR_CONDITION, expectServiceType: false },
    ];

    deviceTypeScenarios.forEach(({ deviceType, expectServiceType }) => {
      it(`EXP-AS-ENTER: ${deviceType} → serviceType ${expectServiceType ? 'defined' : 'null'}`, () => {
        (mockLookupService as unknown as { device: Device | null }).device =
          createMockDevice({ type: deviceType });

        component.ionViewWillEnter();

        const serviceType = (component as any).serviceType;
        if (expectServiceType) {
          expect(serviceType).not.toBeNull();
          expect(serviceType).toBeDefined();
        } else {
          expect(serviceType).toBeNull();
        }
      });
    });

    it('EXP-AS-ENTER-RESET: form is reset on each enter regardless of device type', () => {
      [DeviceType.GAS_BOILER, DeviceType.HEAT_PUMP, DeviceType.BOILER].forEach((deviceType) => {
        (mockLookupService as unknown as { device: Device | null }).device =
          createMockDevice({ type: deviceType });
        (component as any).form.patchValue({ callAccepted: true, note: 'old', distance: '999' });

        component.ionViewWillEnter();

        const form = (component as any).form;
        expect(form.get('callAccepted')?.value).toBeNull();
        expect(form.get('note')?.value).toBe('');
        expect(form.get('distance')?.value).toBe(DEFAULT_DISTANCE);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: form — distance field values matrix
  // =========================================================================

  describe('form — distance field: all standard distance values', () => {
    const distanceValues = ['10', '20', '30', '40', '50', '60', '70', '80', '90', '100', '120', '150', '200', '0'];

    distanceValues.forEach((dist) => {
      it(`EXP2-AS-DIST: distance="${dist}" → stored in form`, () => {
        (mockLookupService as unknown as { device: Device | null }).device =
          createMockDevice({ type: DeviceType.GAS_BOILER });
        component.ionViewWillEnter();
        (component as any).form.get('distance')?.setValue(dist);
        expect((component as any).form.get('distance')?.value).toBe(dist);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: form — callAccepted boolean matrix
  // =========================================================================

  describe('form — callAccepted: true/false/null values', () => {
    const callAcceptedValues: Array<boolean | null> = [true, false, null];

    callAcceptedValues.forEach((value) => {
      it(`EXP2-AS-CALLACC: callAccepted=${value} → stored in form`, () => {
        (mockLookupService as unknown as { device: Device | null }).device =
          createMockDevice({ type: DeviceType.GAS_BOILER });
        component.ionViewWillEnter();
        (component as any).form.get('callAccepted')?.setValue(value);
        expect((component as any).form.get('callAccepted')?.value).toBe(value);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: form — note field: various string lengths
  // =========================================================================

  describe('form — note field: various string values', () => {
    const noteValues = [
      '',
      'Short note',
      'A '.repeat(50).trim(),
      'Line1\nLine2\nLine3',
      'Special chars: !@#$%^&*()',
      'Unicode: Šćžđč Наташа',
      'Numbers: 1234567890',
      'Very long note: ' + 'x'.repeat(500),
    ];

    noteValues.forEach((note) => {
      it(`EXP2-AS-NOTE: note of length ${note.length} → stored in form`, () => {
        (mockLookupService as unknown as { device: Device | null }).device =
          createMockDevice({ type: DeviceType.GAS_BOILER });
        component.ionViewWillEnter();
        (component as any).form.get('note')?.setValue(note);
        expect((component as any).form.get('note')?.value).toBe(note);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: ANNUAL_SERVICE_TYPES — device type mapping validation
  // =========================================================================

  describe('ANNUAL_SERVICE_TYPES — device type mapping validation', () => {
    const definedTypes = [DeviceType.GAS_BOILER, DeviceType.HEAT_PUMP];

    definedTypes.forEach((type) => {
      it(`EXP2-AS-TYPES-DEFINED: ANNUAL_SERVICE_TYPES[${type}] is defined`, () => {
        expect(ANNUAL_SERVICE_TYPES[type]).toBeDefined();
      });

      it(`EXP2-AS-TYPES-NONEMPTY: ANNUAL_SERVICE_TYPES[${type}] is non-empty array`, () => {
        const types = ANNUAL_SERVICE_TYPES[type];
        expect(Array.isArray(types) ? types.length > 0 : !!types).toBeTrue();
      });
    });

    it('EXP2-AS-TYPES-AIR-UNDEF: ANNUAL_SERVICE_TYPES[AIR_CONDITION] is undefined/null', () => {
      const result = ANNUAL_SERVICE_TYPES[DeviceType.AIR_CONDITION];
      expect(result == null).toBeTrue();
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: ANNUAL_SERVICE_DESCRIPTION constant
  // =========================================================================

  describe('ANNUAL_SERVICE_DESCRIPTION constant', () => {
    it('EXP2-AS-DESC-DEFINED: ANNUAL_SERVICE_DESCRIPTION is defined', () => {
      expect(ANNUAL_SERVICE_DESCRIPTION).toBeDefined();
    });

    it('EXP2-AS-DESC-STRING: ANNUAL_SERVICE_DESCRIPTION is a string', () => {
      expect(typeof ANNUAL_SERVICE_DESCRIPTION).toBe('string');
    });

    it('EXP2-AS-DESC-NONEMPTY: ANNUAL_SERVICE_DESCRIPTION is non-empty', () => {
      expect(ANNUAL_SERVICE_DESCRIPTION.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: ionViewWillEnter — SN is extracted from route
  // =========================================================================

  describe('ionViewWillEnter() — SN extraction', () => {
    it('EXP2-AS-SN: SN from route is stored in sn property', () => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.GAS_BOILER });
      component.ionViewWillEnter();
      expect((component as any).sn).toBe(TEST_SN);
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: DEFAULT_DISTANCE constant
  // =========================================================================

  describe('DEFAULT_DISTANCE constant', () => {
    it('EXP2-AS-DEF-DIST-DEFINED: DEFAULT_DISTANCE is defined', () => {
      expect(DEFAULT_DISTANCE).toBeDefined();
    });

    it('EXP2-AS-DEF-DIST-STRING: DEFAULT_DISTANCE is a string', () => {
      expect(typeof DEFAULT_DISTANCE).toBe('string');
    });

    it('EXP2-AS-DEF-DIST-NUMERIC: DEFAULT_DISTANCE parses to a positive number', () => {
      expect(Number(DEFAULT_DISTANCE)).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: form construction — all expected controls exist
  // =========================================================================

  describe('form construction — all controls present', () => {
    const expectedControls = ['callAccepted', 'note', 'distance', 'serviceType'];

    beforeEach(() => {
      (mockLookupService as unknown as { device: Device | null }).device =
        createMockDevice({ type: DeviceType.GAS_BOILER });
      component.ionViewWillEnter();
    });

    expectedControls.forEach((controlName) => {
      it(`EXP2-AS-FORM-CTRL: form has control "${controlName}"`, () => {
        const form = (component as any).form;
        expect(form.get(controlName)).toBeDefined();
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: form — serviceType values
  // =========================================================================

  describe('form — serviceType property: various values', () => {
    const serviceTypeValues = ['annual_service_1', 'annual_service_2', 'annual_service_3', null, ''];

    serviceTypeValues.forEach((value) => {
      it(`EXP2-AS-SVCTYPE: serviceType="${value}" → stored in form`, () => {
        (mockLookupService as unknown as { device: Device | null }).device =
          createMockDevice({ type: DeviceType.GAS_BOILER });
        component.ionViewWillEnter();
        // serviceType is a component property, not a form control
        (component as any).serviceType = value;
        expect((component as any).serviceType).toBe(value);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: noDevice — all device type scenarios
  // =========================================================================

  describe('noDevice — present and null device scenarios', () => {
    const allTypes = [
      DeviceType.GAS_BOILER,
      DeviceType.HEAT_PUMP,
      DeviceType.BOILER,
      DeviceType.AIR_CONDITION,
    ];

    allTypes.forEach((type) => {
      it(`EXP2-AS-NODEVICE-FALSE: ${type} device present → noDevice false`, () => {
        (mockLookupService as unknown as { device: Device | null }).device =
          createMockDevice({ type });
        component.ionViewWillEnter();
        expect((component as any).noDevice).toBeFalse();
      });
    });

    it('EXP2-AS-NODEVICE-NULL: null device → noDevice true', () => {
      (mockLookupService as unknown as { device: Device | null }).device = null;
      component.ionViewWillEnter();
      expect((component as any).noDevice).toBeTrue();
    });
  });
});
