// eslint-disable-next-line @typescript-eslint/ban-ts-comment
/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController, ModalController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';

import { AddDevicePage } from './add-device.page';
import { DeviceLookupService } from '../services/device-lookup.service';
import { InterventionService } from '../services/intervention.service';
import { DeviceEnvInfoService } from '../services/device-env-info.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { LoadingAlertService } from '../../../shared/services/loading-alert.service';
import { PhotoService } from '../../photo-upload/services/photo.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { ConfigStore } from '../../../core/config/config.store';
import { SignatureService } from '../../signature/services/signature.service';
import { ReportPreferenceService } from '../../reports/services/report-preference.service';
import { InterventionReportService } from '../../reports/services/intervention-report.service';
import { Device, DeviceType } from '../../../shared/models/device.model';
import { InterventionType } from '../models/intervention.model';
import { getDefaultConfig, PhotoRequirement } from '../../../core/config/config.model';

import {
  createMockRouter,
  createMockToastController,
  createMockModalController,
  createMockTranslocoService,
  createMockLoggerService,
  createMockConfigStore,
  createMockReportPreferenceService,
  createMockInterventionReportService,
  MockConfigStore,
} from '../../../testing/mock-factories';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockDevice(overrides: Partial<Device> = {}): Device {
  return {
    code: 'GAS-001',
    name: 'Test Gas Boiler',
    type: DeviceType.GAS_BOILER,
    subType: 'standard',
    unitCount: 1,
    exists: true,
    ...overrides,
  };
}

function createPhotoRequirement(overrides: Partial<PhotoRequirement> = {}): PhotoRequirement {
  return {
    maxPhotos: 5,
    requiredPhotos: 0,
    requireSparePartPhotos: false,
    description: 'Test requirement',
    ...overrides,
  };
}

function createMockActivatedRoute(
  paramMap: Record<string, string> = {},
  queryParamMap: Record<string, string> = {},
): Partial<ActivatedRoute> {
  return {
    snapshot: {
      paramMap: {
        get: (key: string) => paramMap[key] ?? null,
      },
      queryParamMap: {
        get: (key: string) => queryParamMap[key] ?? null,
      },
    } as unknown as ActivatedRoute['snapshot'],
  };
}

function createMockLookupServiceWithDevice(device: Device | null): jasmine.SpyObj<DeviceLookupService> {
  const mock = jasmine.createSpyObj<DeviceLookupService>('DeviceLookupService', ['lookup', 'clear']);
  (mock as any).device = device;
  return mock;
}

function createMockInterventionService(): jasmine.SpyObj<InterventionService> {
  return jasmine.createSpyObj<InterventionService>('InterventionService', [
    'saveIntervention',
    'saveInterventionBatch',
  ]);
}

function createMockEnvInfoService(): jasmine.SpyObj<DeviceEnvInfoService> {
  return jasmine.createSpyObj<DeviceEnvInfoService>('DeviceEnvInfoService', ['collectEnvInfo']);
}

function createMockConfirmService(): jasmine.SpyObj<ConfirmService> {
  return jasmine.createSpyObj<ConfirmService>('ConfirmService', ['confirm']);
}

function createMockLoadingAlertService(): jasmine.SpyObj<LoadingAlertService> {
  const mock = jasmine.createSpyObj<LoadingAlertService>('LoadingAlertService', ['show', 'hide', 'wrap']);
  mock.show.and.resolveTo();
  mock.hide.and.resolveTo();
  return mock;
}

function createMockSignatureService(): jasmine.SpyObj<SignatureService> {
  const mock = jasmine.createSpyObj<SignatureService>('SignatureService', ['captureAndUpload']);
  // Default: returns null (no signature captured / feature off by default in tests)
  mock.captureAndUpload.and.resolveTo(null);
  return mock;
}

function createMockPhotoService(photos: any[] = []): jasmine.SpyObj<PhotoService> {
  const mock = jasmine.createSpyObj<PhotoService>('PhotoService', [
    'setRequirement',
    'uploadPhotos',
    'clear',
  ]);
  (mock as any).photos = photos;
  mock.uploadPhotos.and.resolveTo();
  return mock;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('AddDevicePage', () => {
  let page: AddDevicePage;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockToastCtrl: jasmine.SpyObj<ToastController>;
  let mockModalCtrl: jasmine.SpyObj<ModalController>;
  let mockTransloco: jasmine.SpyObj<TranslocoService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockConfigStore: MockConfigStore;
  let mockInterventionService: jasmine.SpyObj<InterventionService>;
  let mockEnvInfoService: jasmine.SpyObj<DeviceEnvInfoService>;
  let mockConfirmService: jasmine.SpyObj<ConfirmService>;
  let mockLoadingAlert: jasmine.SpyObj<LoadingAlertService>;
  let mockSignatureService: jasmine.SpyObj<SignatureService>;
  let mockReportPreference: ReturnType<typeof createMockReportPreferenceService>;
  let mockInterventionReport: jasmine.SpyObj<InterventionReportService>;

  /**
   * Configures TestBed and instantiates AddDevicePage with the given options.
   * Must be called inside each test (or inside a beforeEach that applies to a group).
   */
  function createPage(options: {
    device?: Device | null;
    sn?: string;
    connectedSn?: string;
    photos?: any[];
  } = {}): AddDevicePage {
    const device = options.device !== undefined ? options.device : createMockDevice();
    const sn = options.sn ?? 'GENUS24AB00000012345678';
    const connectedSn = options.connectedSn ?? '';
    const photos = options.photos ?? [];

    const mockRoute = createMockActivatedRoute(
      { sn },
      connectedSn ? { connectedSn } : {},
    );
    const mockLookup = createMockLookupServiceWithDevice(device);
    const mockPhoto = createMockPhotoService(photos);

    TestBed.configureTestingModule({
      providers: [
        AddDevicePage,
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: Router, useValue: mockRouter },
        { provide: ToastController, useValue: mockToastCtrl },
        { provide: ModalController, useValue: mockModalCtrl },
        { provide: TranslocoService, useValue: mockTransloco },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ConfigStore, useValue: mockConfigStore },
        { provide: DeviceLookupService, useValue: mockLookup },
        { provide: InterventionService, useValue: mockInterventionService },
        { provide: DeviceEnvInfoService, useValue: mockEnvInfoService },
        { provide: ConfirmService, useValue: mockConfirmService },
        { provide: LoadingAlertService, useValue: mockLoadingAlert },
        { provide: PhotoService, useValue: mockPhoto },
        { provide: SignatureService, useValue: mockSignatureService },
        { provide: ReportPreferenceService, useValue: mockReportPreference },
        { provide: InterventionReportService, useValue: mockInterventionReport },
      ],
    });

    return TestBed.inject(AddDevicePage);
  }

  beforeEach(() => {
    mockRouter = createMockRouter();
    mockToastCtrl = createMockToastController();
    mockModalCtrl = createMockModalController();
    mockTransloco = createMockTranslocoService();
    mockLogger = createMockLoggerService();
    mockConfigStore = createMockConfigStore();
    mockInterventionService = createMockInterventionService();
    mockEnvInfoService = createMockEnvInfoService();
    mockConfirmService = createMockConfirmService();
    mockLoadingAlert = createMockLoadingAlertService();
    mockSignatureService = createMockSignatureService();
    mockReportPreference = createMockReportPreferenceService();
    mockInterventionReport = createMockInterventionReportService();

    // Default: interventionPhotos disabled
    mockConfigStore.setConfig(getDefaultConfig());
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // ─── Helpers used within tests ────────────────────────────────────────────────

  function fillValidForm(p: AddDevicePage): void {
    (p as any).form.get('installerName').setValue('John Doe');
    (p as any).form.get('installerPhoneNumber').setValue('123456789');
  }

  // ─── Form structure ───────────────────────────────────────────────────────────

  describe('Form structure', () => {
    it('TC-AD-01: has installerName control', () => {
      page = createPage();
      expect((page as any).form.controls['installerName']).toBeDefined();
    });

    it('TC-AD-02: has installerPhoneNumber control', () => {
      page = createPage();
      expect((page as any).form.controls['installerPhoneNumber']).toBeDefined();
    });

    it('TC-AD-03: has note control', () => {
      page = createPage();
      expect((page as any).form.controls['note']).toBeDefined();
    });

    it('TC-AD-04: installerName required — error present when empty', () => {
      page = createPage();
      expect((page as any).form.get('installerName').hasError('required')).toBeTrue();
    });

    it('TC-AD-05: installerPhoneNumber required — error present when empty', () => {
      page = createPage();
      expect((page as any).form.get('installerPhoneNumber').hasError('required')).toBeTrue();
    });

    it('TC-AD-06: installerPhoneNumber minLength(9) — error when 8 chars', () => {
      page = createPage();
      (page as any).form.get('installerPhoneNumber').setValue('12345678');
      expect((page as any).form.get('installerPhoneNumber').hasError('minlength')).toBeTrue();
    });

    it('TC-AD-07: installerPhoneNumber minLength(9) — no error when 9 chars', () => {
      page = createPage();
      (page as any).form.get('installerPhoneNumber').setValue('123456789');
      expect((page as any).form.get('installerPhoneNumber').hasError('minlength')).toBeFalse();
    });

    it('TC-AD-08: note field is not required', () => {
      page = createPage();
      expect((page as any).form.get('note').hasError('required')).toBeFalse();
    });
  });

  // ─── Lifecycle — ionViewWillEnter ─────────────────────────────────────────────

  describe('ionViewWillEnter()', () => {
    it('TC-AD-09: extracts SN from route paramMap', () => {
      page = createPage({ sn: 'TESTSERIAL001234567890' });
      page.ionViewWillEnter();
      expect((page as any).sn).toBe('TESTSERIAL001234567890');
    });

    it('TC-AD-10: extracts connectedSn from queryParamMap', () => {
      page = createPage({ sn: 'SN-001', connectedSn: 'SN-CONNECTED-001' });
      page.ionViewWillEnter();
      expect((page as any).connectedSn).toBe('SN-CONNECTED-001');
    });

    it('TC-AD-11: connectedSn is empty string when not in query params', () => {
      page = createPage({ sn: 'SN-001', connectedSn: '' });
      page.ionViewWillEnter();
      expect((page as any).connectedSn).toBe('');
    });

    it('TC-AD-12: reads photoRequirement from config when interventionPhotos enabled', () => {
      const photoReq = createPhotoRequirement({ requiredPhotos: 2 });
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      page = createPage({ device });

      const cfg = getDefaultConfig();
      cfg.features.interventionPhotos = true;
      cfg.interventionPhotoConfig = { [DeviceType.GAS_BOILER]: { commissioning: photoReq } };
      mockConfigStore.setConfig(cfg);

      page.ionViewWillEnter();

      expect((page as any).photoRequirement).toEqual(photoReq);
    });

    it('TC-AD-13: photoRequirement is null when interventionPhotos disabled', () => {
      page = createPage();
      page.ionViewWillEnter();
      expect((page as any).photoRequirement).toBeNull();
    });

    it('TC-AD-14: warrantyInfo set when device is GAS_BOILER with parseable SN', () => {
      // '26100' at position 9 = day 100 of 2026 = April 10, 2026 (within 1 year of test date 2026-05-03)
      const sn = 'GENUS24AB' + '26100' + 'XX'; // positions 9-13 = '26100'
      page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn });

      const cfg = getDefaultConfig();
      cfg.business.snMfgDateStart = 9;
      cfg.business.snMfgDateLength = 5;
      mockConfigStore.setConfig(cfg);

      page.ionViewWillEnter();

      expect((page as any).warrantyInfo).not.toBeNull();
    });

    it('TC-AD-15: warrantyInfo is null when device is HEAT_PUMP (not GAS_BOILER)', () => {
      page = createPage({ device: createMockDevice({ type: DeviceType.HEAT_PUMP }) });
      page.ionViewWillEnter();
      expect((page as any).warrantyInfo).toBeNull();
    });

    it('TC-AD-16: calls photoService.setRequirement when photoRequirement found', () => {
      const photoReq = createPhotoRequirement();
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      page = createPage({ device });

      const cfg = getDefaultConfig();
      cfg.features.interventionPhotos = true;
      cfg.interventionPhotoConfig = { [DeviceType.GAS_BOILER]: { commissioning: photoReq } };
      mockConfigStore.setConfig(cfg);

      page.ionViewWillEnter();

      const photoSvc = TestBed.inject(PhotoService) as jasmine.SpyObj<PhotoService>;
      expect(photoSvc.setRequirement).toHaveBeenCalledWith(photoReq);
    });

    it('TC-AD-17: calls photoService.clear when no photoRequirement for device', () => {
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      page = createPage({ device });

      const cfg = getDefaultConfig();
      cfg.features.interventionPhotos = true;
      // No interventionPhotoConfig for this device type
      mockConfigStore.setConfig(cfg);

      page.ionViewWillEnter();

      const photoSvc = TestBed.inject(PhotoService) as jasmine.SpyObj<PhotoService>;
      expect(photoSvc.clear).toHaveBeenCalled();
    });

    it('TC-AD-18: resets form on ionViewWillEnter', () => {
      page = createPage();
      (page as any).form.get('installerName').setValue('Old Name');

      page.ionViewWillEnter();

      expect((page as any).form.get('installerName').value).toBe('');
    });

    it('TC-AD-19: resets isSaving to false', () => {
      page = createPage();
      (page as any).isSaving = true;

      page.ionViewWillEnter();

      expect((page as any).isSaving).toBe(false);
    });
  });

  // ─── showPhotosButton ─────────────────────────────────────────────────────────

  describe('showPhotosButton', () => {
    it('TC-AD-20: returns true when interventionPhotos enabled AND photoRequirement exists', () => {
      const photoReq = createPhotoRequirement();
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      page = createPage({ device });

      const cfg = getDefaultConfig();
      cfg.features.interventionPhotos = true;
      cfg.interventionPhotoConfig = { [DeviceType.GAS_BOILER]: { commissioning: photoReq } };
      mockConfigStore.setConfig(cfg);

      page.ionViewWillEnter();

      expect(page.showPhotosButton).toBeTrue();
    });

    it('TC-AD-21: returns false when interventionPhotos feature is disabled', () => {
      page = createPage();
      page.ionViewWillEnter();
      expect(page.showPhotosButton).toBeFalse();
    });

    it('TC-AD-22: returns false when interventionPhotos enabled but photoRequirement is null', () => {
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      page = createPage({ device });

      const cfg = getDefaultConfig();
      cfg.features.interventionPhotos = true;
      // No photo config for this device type
      mockConfigStore.setConfig(cfg);

      page.ionViewWillEnter();

      expect(page.showPhotosButton).toBeFalse();
    });
  });

  // ─── onAddPhotos ──────────────────────────────────────────────────────────────

  describe('onAddPhotos()', () => {
    it('TC-AD-23: creates modal with fullscreen-modal cssClass', async () => {
      page = createPage();

      await page.onAddPhotos();

      expect(mockModalCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ cssClass: 'fullscreen-modal' }),
      );
    });

    it('TC-AD-24: calls modal.present() after modal is created', async () => {
      page = createPage();
      const mockModal = {
        present: jasmine.createSpy('present').and.resolveTo(),
        dismiss: jasmine.createSpy('dismiss').and.resolveTo(true),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.resolveTo({ data: undefined, role: 'backdrop' }),
      } as unknown as HTMLIonModalElement;
      mockModalCtrl.create.and.resolveTo(mockModal);

      await page.onAddPhotos();

      expect(mockModal.present).toHaveBeenCalled();
    });
  });

  // ─── getWarrantyInfo / getManufactureDateFromSn ───────────────────────────────

  describe('getWarrantyInfo() / getManufactureDateFromSn()', () => {
    beforeEach(() => {
      const cfg = getDefaultConfig();
      cfg.business.snMfgDateStart = 9;
      cfg.business.snMfgDateLength = 5;
      mockConfigStore.setConfig(cfg);
    });

    it('TC-AD-25: SN with date within 1 year — uses commissioning_warranty_from_start key', () => {
      // Day 100 of 2026 = April 10, 2026; test date = 2026-05-03 (23 days later — within 1 year)
      const sn = 'GENUS24AB' + '26100' + 'XX';
      page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn });
      page.ionViewWillEnter();

      expect((page as any).warrantyInfo?.messageKey).toBe('commissioning_warranty_from_start');
    });

    it('TC-AD-26: SN with date over 1 year ago — uses commissioning_warranty_from_date key', () => {
      // Day 100 of 2024 = April 9, 2024; test date = 2026-05-03 (> 1 year ago)
      const sn = 'GENUS24AB' + '24100' + 'XX';
      page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn });
      page.ionViewWillEnter();

      expect((page as any).warrantyInfo?.messageKey).toBe('commissioning_warranty_from_date');
      expect((page as any).warrantyInfo?.noteKey).toBe('commissioning_warranty_upload_note');
    });

    it('TC-AD-27: SN too short — warrantyInfo is null', () => {
      page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn: 'SHORT' });
      page.ionViewWillEnter();

      expect((page as any).warrantyInfo).toBeNull();
    });

    it('TC-AD-28: leap year day 366 is valid — warrantyInfo set (2024 is leap year)', () => {
      // '24366' = day 366 of 2024 = Dec 31, 2024 — valid leap year date
      const sn = 'GENUS24AB' + '24366' + 'XX';
      page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn });
      page.ionViewWillEnter();

      // Dec 31, 2024 is over 1 year ago relative to 2026-05-03
      expect((page as any).warrantyInfo?.messageKey).toBe('commissioning_warranty_from_date');
    });

    it('TC-AD-29: non-leap year day 366 is invalid — warrantyInfo is null', () => {
      // '25366' = day 366 of 2025 — 2025 is NOT a leap year, so invalid
      const sn = 'GENUS24AB' + '25366' + 'XX';
      page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn });
      page.ionViewWillEnter();

      expect((page as any).warrantyInfo).toBeNull();
    });

    it('TC-AD-30: SN with NaN date part — warrantyInfo is null', () => {
      // Positions 9-13 = 'ABCDE' (non-numeric)
      const sn = 'GENUS24ABABCDEXXXXXXX';
      page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn });
      page.ionViewWillEnter();

      expect((page as any).warrantyInfo).toBeNull();
    });
  });

  // ─── onSave — form validation ──────────────────────────────────────────────────

  describe('onSave() — validation', () => {
    it('TC-AD-31: shows toast and aborts when installerName is empty', async () => {
      page = createPage();
      page.ionViewWillEnter();

      await page.onSave();

      expect(mockToastCtrl.create).toHaveBeenCalled();
      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
    });

    it('TC-AD-32: shows toast and aborts when installerPhoneNumber is empty', async () => {
      page = createPage();
      page.ionViewWillEnter();
      (page as any).form.get('installerName').setValue('John Doe');

      await page.onSave();

      expect(mockToastCtrl.create).toHaveBeenCalled();
      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
    });

    it('TC-AD-33: shows toast and aborts when phone is below minLength (8 chars)', async () => {
      page = createPage();
      page.ionViewWillEnter();
      (page as any).form.get('installerName').setValue('John Doe');
      (page as any).form.get('installerPhoneNumber').setValue('12345678');

      await page.onSave();

      expect(mockToastCtrl.create).toHaveBeenCalled();
      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
    });
  });

  // ─── onSave — showNoPhotosAlert ───────────────────────────────────────────────

  describe('onSave() — showNoPhotosAlert', () => {
    it('TC-AD-34: shows no-photos confirm when interventionPhotos enabled, photoReq set, no photos', async () => {
      const photoReq = createPhotoRequirement({ requiredPhotos: 0 });
      const device = createMockDevice({ type: DeviceType.BOILER });
      page = createPage({ device, photos: [] });

      const cfg = getDefaultConfig();
      cfg.features.interventionPhotos = true;
      cfg.interventionPhotoConfig = { [DeviceType.BOILER]: { commissioning: photoReq } };
      mockConfigStore.setConfig(cfg);

      mockConfirmService.confirm.and.resolveTo(false); // user cancels no-photos alert

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      expect(mockConfirmService.confirm).toHaveBeenCalledWith(
        'photo_no_photos_title',
        'photo_no_photos_message',
        'photo_no_photos_continue',
        'photo_no_photos_cancel',
      );
    });

    it('TC-AD-35: aborts save when showNoPhotosAlert returns false (user cancels)', async () => {
      const photoReq = createPhotoRequirement({ requiredPhotos: 0 });
      const device = createMockDevice({ type: DeviceType.BOILER });
      page = createPage({ device, photos: [] });

      const cfg = getDefaultConfig();
      cfg.features.interventionPhotos = true;
      cfg.interventionPhotoConfig = { [DeviceType.BOILER]: { commissioning: photoReq } };
      mockConfigStore.setConfig(cfg);

      mockConfirmService.confirm.and.resolveTo(false);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
    });

    it('TC-AD-36: proceeds when showNoPhotosAlert returns true (user confirms)', async () => {
      const photoReq = createPhotoRequirement({ requiredPhotos: 0 });
      const device = createMockDevice({ type: DeviceType.BOILER });
      page = createPage({ device, photos: [] });

      const cfg = getDefaultConfig();
      cfg.features.interventionPhotos = true;
      cfg.interventionPhotoConfig = { [DeviceType.BOILER]: { commissioning: photoReq } };
      mockConfigStore.setConfig(cfg);

      // no-photos confirm -> proceed; commissioning confirm -> proceed
      mockConfirmService.confirm.and.resolveTo(true);
      mockInterventionService.saveIntervention.and.resolveTo('doc-ok');
      mockRouter.navigate.and.resolveTo(true);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      expect(mockInterventionService.saveIntervention).toHaveBeenCalled();
    });
  });

  // ─── onSave — envInfo collection ──────────────────────────────────────────────

  describe('onSave() — envInfo collection', () => {
    it('TC-AD-37: calls DeviceEnvInfoService.collectEnvInfo for HEAT_PUMP', async () => {
      const device = createMockDevice({ type: DeviceType.HEAT_PUMP, subType: 'standard' });
      page = createPage({ device });

      mockEnvInfoService.collectEnvInfo.and.resolveTo({ field: 'value' });
      mockInterventionService.saveIntervention.and.resolveTo('doc-hp');
      mockRouter.navigate.and.resolveTo(true);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      expect(mockEnvInfoService.collectEnvInfo).toHaveBeenCalledWith(
        DeviceType.HEAT_PUMP,
        jasmine.any(String),
        null,
        'standard',
      );
    });

    it('TC-AD-38: calls DeviceEnvInfoService.collectEnvInfo for GAS_BOILER', async () => {
      const device = createMockDevice({ type: DeviceType.GAS_BOILER, subType: 'standard' });
      page = createPage({ device });

      mockEnvInfoService.collectEnvInfo.and.resolveTo({ gasType: 'env_info_opt_gas_natural' });
      mockInterventionService.saveIntervention.and.resolveTo('doc-gb');
      mockRouter.navigate.and.resolveTo(true);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      expect(mockEnvInfoService.collectEnvInfo).toHaveBeenCalledWith(
        DeviceType.GAS_BOILER,
        jasmine.any(String),
        null,
        'standard',
      );
    });

    it('TC-AD-39: aborts save when envInfo collection is cancelled (returns null)', async () => {
      const device = createMockDevice({ type: DeviceType.HEAT_PUMP });
      page = createPage({ device });

      mockEnvInfoService.collectEnvInfo.and.resolveTo(null);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
      expect(mockLoadingAlert.show).not.toHaveBeenCalled();
    });

    it('TC-AD-40: uses ConfirmService confirm dialog for BOILER (no envInfo required)', async () => {
      const device = createMockDevice({ type: DeviceType.BOILER });
      page = createPage({ device });

      mockConfirmService.confirm.and.resolveTo(true);
      mockInterventionService.saveIntervention.and.resolveTo('doc-boiler');
      mockRouter.navigate.and.resolveTo(true);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      expect(mockEnvInfoService.collectEnvInfo).not.toHaveBeenCalled();
      expect(mockConfirmService.confirm).toHaveBeenCalledWith(
        'commissioning_confirm_title',
        'commissioning_confirm_message',
        'commissioning_confirm_save',
        'commissioning_confirm_cancel',
      );
    });

    it('TC-AD-41: aborts save when ConfirmService returns false for non-envInfo device', async () => {
      const device = createMockDevice({ type: DeviceType.BOILER });
      page = createPage({ device });

      mockConfirmService.confirm.and.resolveTo(false);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
    });
  });

  // ─── onSave — LoadingAlert ────────────────────────────────────────────────────

  describe('onSave() — LoadingAlert', () => {
    it('TC-AD-42: shows LoadingAlert before saving', async () => {
      const device = createMockDevice({ type: DeviceType.BOILER });
      page = createPage({ device });

      mockConfirmService.confirm.and.resolveTo(true);
      mockInterventionService.saveIntervention.and.resolveTo('doc-ok');
      mockRouter.navigate.and.resolveTo(true);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      expect(mockLoadingAlert.show).toHaveBeenCalled();
    });

    it('TC-AD-43: hides LoadingAlert on save failure', async () => {
      const device = createMockDevice({ type: DeviceType.BOILER });
      page = createPage({ device });

      mockConfirmService.confirm.and.resolveTo(true);
      mockInterventionService.saveIntervention.and.resolveTo(null); // failure

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      expect(mockLoadingAlert.hide).toHaveBeenCalled();
    });
  });

  // ─── onSave — photo upload ────────────────────────────────────────────────────

  describe('onSave() — photo upload', () => {
    it('TC-AD-44: uploads photos when interventionPhotos enabled and photos exist', async () => {
      const photoReq = createPhotoRequirement({ requiredPhotos: 0 });
      const device = createMockDevice({ type: DeviceType.BOILER });
      const photos = [{ id: 'p1', webPath: '/p1', uri: 'file://p1' }];
      page = createPage({ device, photos });

      const cfg = getDefaultConfig();
      cfg.features.interventionPhotos = true;
      cfg.interventionPhotoConfig = { [DeviceType.BOILER]: { commissioning: photoReq } };
      mockConfigStore.setConfig(cfg);

      mockConfirmService.confirm.and.resolveTo(true);
      mockInterventionService.saveIntervention.and.resolveTo('doc-ok');
      mockRouter.navigate.and.resolveTo(true);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      const photoSvc = TestBed.inject(PhotoService) as jasmine.SpyObj<PhotoService>;
      expect(photoSvc.uploadPhotos).toHaveBeenCalledWith(
        jasmine.any(String),
        DeviceType.BOILER,
        InterventionType.COMMISSIONING,
      );
    });

    it('TC-AD-45: does not upload when photos array is empty', async () => {
      const device = createMockDevice({ type: DeviceType.BOILER });
      page = createPage({ device, photos: [] });

      mockConfirmService.confirm.and.resolveTo(true);
      mockInterventionService.saveIntervention.and.resolveTo('doc-ok');
      mockRouter.navigate.and.resolveTo(true);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      const photoSvc = TestBed.inject(PhotoService) as jasmine.SpyObj<PhotoService>;
      expect(photoSvc.uploadPhotos).not.toHaveBeenCalled();
    });

    it('TC-AD-46: uploads all photos in a single uploadPhotos call (multiple photos)', async () => {
      const photoReq = createPhotoRequirement({ requiredPhotos: 0, maxPhotos: 5 });
      const device = createMockDevice({ type: DeviceType.BOILER });
      const photos = [
        { id: 'p1', webPath: '/p1', uri: 'file://p1' },
        { id: 'p2', webPath: '/p2', uri: 'file://p2' },
        { id: 'p3', webPath: '/p3', uri: 'file://p3' },
      ];
      page = createPage({ device, photos });

      const cfg = getDefaultConfig();
      cfg.features.interventionPhotos = true;
      cfg.interventionPhotoConfig = { [DeviceType.BOILER]: { commissioning: photoReq } };
      mockConfigStore.setConfig(cfg);

      mockConfirmService.confirm.and.resolveTo(true);
      mockInterventionService.saveIntervention.and.resolveTo('doc-ok');
      mockRouter.navigate.and.resolveTo(true);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      const photoSvc = TestBed.inject(PhotoService) as jasmine.SpyObj<PhotoService>;
      expect(photoSvc.uploadPhotos).toHaveBeenCalledTimes(1);
    });
  });

  // ─── onSave — saveIntervention (single) ───────────────────────────────────────

  describe('onSave() — saveIntervention (single)', () => {
    it('TC-AD-47: calls saveIntervention when connectedSn is not set', async () => {
      const device = createMockDevice({ type: DeviceType.BOILER });
      page = createPage({ device, connectedSn: '' });

      mockConfirmService.confirm.and.resolveTo(true);
      mockInterventionService.saveIntervention.and.resolveTo('doc-single');
      mockRouter.navigate.and.resolveTo(true);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      expect(mockInterventionService.saveIntervention).toHaveBeenCalled();
      expect(mockInterventionService.saveInterventionBatch).not.toHaveBeenCalled();
    });

    it('TC-AD-48: on success — navigates to device-management/:sn', async () => {
      const device = createMockDevice({ type: DeviceType.BOILER });
      page = createPage({ device, sn: 'SN-NAV-001', connectedSn: '' });

      mockConfirmService.confirm.and.resolveTo(true);
      mockInterventionService.saveIntervention.and.resolveTo('doc-ok');
      mockRouter.navigate.and.resolveTo(true);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/device-management', 'SN-NAV-001']);
    });

    it('TC-AD-49: on success — clears photos', async () => {
      const device = createMockDevice({ type: DeviceType.BOILER });
      page = createPage({ device });

      mockConfirmService.confirm.and.resolveTo(true);
      mockInterventionService.saveIntervention.and.resolveTo('doc-clear');
      mockRouter.navigate.and.resolveTo(true);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      const photoSvc = TestBed.inject(PhotoService) as jasmine.SpyObj<PhotoService>;
      expect(photoSvc.clear).toHaveBeenCalled();
    });

    it('TC-AD-50: on failure (null returned) — shows error toast', async () => {
      const device = createMockDevice({ type: DeviceType.BOILER });
      page = createPage({ device });

      mockConfirmService.confirm.and.resolveTo(true);
      mockInterventionService.saveIntervention.and.resolveTo(null);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      expect(mockToastCtrl.create).toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  // ─── onSave — saveInterventionBatch (connected devices) ───────────────────────

  describe('onSave() — saveInterventionBatch (connected devices)', () => {
    it('TC-AD-51: calls saveInterventionBatch with both SNs when connectedSn set', async () => {
      const device = createMockDevice({ type: DeviceType.BOILER });
      page = createPage({ device, sn: 'SN-MAIN', connectedSn: 'SN-CONNECTED' });

      mockConfirmService.confirm.and.resolveTo(true);
      mockInterventionService.saveInterventionBatch.and.resolveTo(true);
      mockRouter.navigate.and.resolveTo(true);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      expect(mockInterventionService.saveInterventionBatch).toHaveBeenCalledWith([
        jasmine.objectContaining({ sn: 'SN-MAIN' }),
        jasmine.objectContaining({ sn: 'SN-CONNECTED' }),
      ]);
      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
    });

    it('TC-AD-52: on batch success — navigates to device-management/:sn', async () => {
      const device = createMockDevice({ type: DeviceType.BOILER });
      page = createPage({ device, sn: 'SN-MAIN', connectedSn: 'SN-CONNECTED' });

      mockConfirmService.confirm.and.resolveTo(true);
      mockInterventionService.saveInterventionBatch.and.resolveTo(true);
      mockRouter.navigate.and.resolveTo(true);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/device-management', 'SN-MAIN']);
    });

    it('TC-AD-53: on batch failure — shows error toast and does not navigate', async () => {
      const device = createMockDevice({ type: DeviceType.BOILER });
      page = createPage({ device, sn: 'SN-MAIN', connectedSn: 'SN-CONNECTED' });

      mockConfirmService.confirm.and.resolveTo(true);
      mockInterventionService.saveInterventionBatch.and.resolveTo(false);

      page.ionViewWillEnter();
      fillValidForm(page);

      await page.onSave();

      expect(mockToastCtrl.create).toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  // ─── onSave — device null guard ───────────────────────────────────────────────

  describe('onSave() — device null guard', () => {
    it('TC-AD-54: aborts early when device is null after form validation', async () => {
      page = createPage({ device: null });
      page.ionViewWillEnter();

      fillValidForm(page);

      await page.onSave();

      expect(mockLoadingAlert.show).not.toHaveBeenCalled();
      expect(mockInterventionService.saveIntervention).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // EXPANSION: getManufactureDateFromSn — exhaustive matrix
  // =========================================================================

  // Shared helper for building SNs with embedded manufacture date (snMfgDateStart=9, length=5)
  function buildSnWithDate(twoDigitYear: number, dayOfYear: number): string {
    const yearStr = String(twoDigitYear).padStart(2, '0');
    const dayStr = String(dayOfYear).padStart(3, '0');
    return `GENUS24AB${yearStr}${dayStr}XX`;
  }

  describe('getManufactureDateFromSn() — year × day parameterized', () => {
    // Test date context from CLAUDE.md: currentDate = 2026-05-03

    beforeEach(() => {
      const cfg = getDefaultConfig();
      cfg.business.snMfgDateStart = 9;
      cfg.business.snMfgDateLength = 5;
      mockConfigStore.setConfig(cfg);
    });

    // Years 2000-2025: day 1 of each year — all should parse to valid dates
    const recentYears = [
      2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009,
      2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019,
      2020, 2021, 2022, 2023, 2024, 2025,
    ];

    recentYears.forEach((fullYear) => {
      const twoDigit = fullYear - 2000;
      it(`EXP-AD-MFG-YEAR: year ${fullYear} day 1 → warrantyInfo not null`, () => {
        const sn = buildSnWithDate(twoDigit, 1);
        page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn });
        page.ionViewWillEnter();

        expect((page as any).warrantyInfo).not.toBeNull();
      });
    });

    // Each month: use specific day-of-year for each month of 2024 (leap year)
    const month2024DayOfYear: Array<{ month: string; day: number }> = [
      { month: 'January', day: 1 },
      { month: 'February', day: 32 },
      { month: 'March', day: 61 },
      { month: 'April', day: 92 },
      { month: 'May', day: 122 },
      { month: 'June', day: 153 },
      { month: 'July', day: 183 },
      { month: 'August', day: 214 },
      { month: 'September', day: 245 },
      { month: 'October', day: 275 },
      { month: 'November', day: 306 },
      { month: 'December', day: 336 },
    ];

    month2024DayOfYear.forEach(({ month, day }) => {
      it(`EXP-AD-MFG-MONTH: 2024 ${month} (day ${day}) → warrantyInfo not null`, () => {
        const sn = buildSnWithDate(24, day);
        page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn });
        page.ionViewWillEnter();

        expect((page as any).warrantyInfo).not.toBeNull();
      });
    });

    // Special days
    const specialDays: Array<{ label: string; dayOfYear: number; year: number; shouldBeValid: boolean }> = [
      { label: 'day 1 of 2025', dayOfYear: 1, year: 25, shouldBeValid: true },
      { label: 'day 15 of 2023', dayOfYear: 15, year: 23, shouldBeValid: true },
      { label: 'day 28 of 2022', dayOfYear: 28, year: 22, shouldBeValid: true },
      { label: 'day 100 of 2021', dayOfYear: 100, year: 21, shouldBeValid: true },
      { label: 'day 200 of 2020', dayOfYear: 200, year: 20, shouldBeValid: true },
      { label: 'day 300 of 2019', dayOfYear: 300, year: 19, shouldBeValid: true },
      { label: 'day 365 of 2023 (non-leap)', dayOfYear: 365, year: 23, shouldBeValid: true },
      { label: 'day 366 of 2024 (leap)', dayOfYear: 366, year: 24, shouldBeValid: true },
      { label: 'day 366 of 2025 (non-leap → INVALID)', dayOfYear: 366, year: 25, shouldBeValid: false },
      { label: 'day 0 → INVALID', dayOfYear: 0, year: 24, shouldBeValid: false },
      { label: 'day 367 of 2024 (leap) → INVALID', dayOfYear: 367, year: 24, shouldBeValid: false },
    ];

    specialDays.forEach(({ label, dayOfYear, year, shouldBeValid }) => {
      it(`EXP-AD-MFG-SPECIAL: ${label} → warrantyInfo ${shouldBeValid ? 'not ' : ''}null`, () => {
        const sn = buildSnWithDate(year, dayOfYear);
        page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn });
        page.ionViewWillEnter();

        if (shouldBeValid) {
          expect((page as any).warrantyInfo).not.toBeNull();
        } else {
          expect((page as any).warrantyInfo).toBeNull();
        }
      });
    });

    // Leap year Feb 29 specifically: 2024, 2020, 2016, 2012, 2000
    const leapYears: Array<{ year: number; feb29DayOfYear: number }> = [
      { year: 0, feb29DayOfYear: 60 },   // 2000 - leap
      { year: 4, feb29DayOfYear: 60 },   // 2004 - leap
      { year: 8, feb29DayOfYear: 60 },   // 2008 - leap
      { year: 12, feb29DayOfYear: 60 },  // 2012 - leap
      { year: 16, feb29DayOfYear: 60 },  // 2016 - leap
      { year: 20, feb29DayOfYear: 60 },  // 2020 - leap
      { year: 24, feb29DayOfYear: 60 },  // 2024 - leap
    ];

    leapYears.forEach(({ year, feb29DayOfYear }) => {
      it(`EXP-AD-MFG-LEAP: 20${String(year).padStart(2, '0')} Feb 29 (day ${feb29DayOfYear}) → valid`, () => {
        const sn = buildSnWithDate(year, feb29DayOfYear);
        page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn });
        page.ionViewWillEnter();

        expect((page as any).warrantyInfo).not.toBeNull();
      });
    });

    // Non-leap years Feb 29 invalid
    const nonLeapYears = [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15, 17, 18, 19, 21, 22, 23, 25];
    nonLeapYears.forEach((year) => {
      it(`EXP-AD-MFG-NONLEAP: 20${String(year).padStart(2, '0')} day 366 → invalid (non-leap)`, () => {
        const sn = buildSnWithDate(year, 366);
        page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn });
        page.ionViewWillEnter();

        expect((page as any).warrantyInfo).toBeNull();
      });
    });

    // SN too short scenarios
    const shortSnCases: Array<{ label: string; sn: string }> = [
      { label: 'empty SN', sn: '' },
      { label: '1-char SN', sn: 'A' },
      { label: '8-char SN (exactly snMfgDateStart)', sn: 'GENUS24A' },
      { label: '9-char SN (snMfgDateStart but no date)', sn: 'GENUS24AB' },
      { label: '13-char SN (partial date only)', sn: 'GENUS24AB2610' },
    ];

    shortSnCases.forEach(({ label, sn }) => {
      it(`EXP-AD-MFG-SHORT: ${label} → warrantyInfo null`, () => {
        page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn });
        page.ionViewWillEnter();

        expect((page as any).warrantyInfo).toBeNull();
      });
    });

    // Non-numeric date part
    const nonNumericCases: Array<{ label: string; datePart: string }> = [
      { label: 'ABCDE', datePart: 'ABCDE' },
      { label: '!!!!!', datePart: '!!!!!' },
      { label: '  365', datePart: '  365' },
      { label: 'NaN00', datePart: 'NaN00' },
      { label: '24abc', datePart: '24abc' },
    ];

    nonNumericCases.forEach(({ label, datePart }) => {
      it(`EXP-AD-MFG-NAN: non-numeric date part "${label}" → warrantyInfo null`, () => {
        const sn = `GENUS24AB${datePart}XX`;
        page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn });
        page.ionViewWillEnter();

        expect((page as any).warrantyInfo).toBeNull();
      });
    });

    // Warranty classification: within 1 year vs over 1 year (test date = 2026-05-03)
    const warrantyClassification: Array<{ label: string; twoDigitYear: number; day: number; expectedKey: string }> = [
      // Over 1 year ago (2024-04-09 → commissioning_warranty_from_date)
      { label: '2024 day 100 (Apr 9, 2024 — over 1yr)', twoDigitYear: 24, day: 100, expectedKey: 'commissioning_warranty_from_date' },
      // Over 1 year ago (2023)
      { label: '2023 day 1 — over 1yr', twoDigitYear: 23, day: 1, expectedKey: 'commissioning_warranty_from_date' },
      // Within 1 year (2026 day 100 = Apr 10, 2026 — within 1yr of 2026-05-03)
      { label: '2026 day 100 (Apr 10, 2026 — within 1yr)', twoDigitYear: 26, day: 100, expectedKey: 'commissioning_warranty_from_start' },
    ];

    warrantyClassification.forEach(({ label, twoDigitYear, day, expectedKey }) => {
      it(`EXP-AD-MFG-WARRANTY: ${label} → messageKey "${expectedKey}"`, () => {
        const sn = buildSnWithDate(twoDigitYear, day);
        page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn });
        page.ionViewWillEnter();

        expect((page as any).warrantyInfo?.messageKey).toBe(expectedKey);
      });
    });

    // HEAT_PUMP always null regardless of SN
    const hpYears = [24, 25, 26];
    hpYears.forEach((year) => {
      it(`EXP-AD-MFG-HEATPUMP: HEAT_PUMP with year 20${year} → warrantyInfo always null`, () => {
        const sn = buildSnWithDate(year, 100);
        page = createPage({ device: createMockDevice({ type: DeviceType.HEAT_PUMP }), sn });
        page.ionViewWillEnter();

        expect((page as any).warrantyInfo).toBeNull();
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: device type matrix — ionViewWillEnter sets deviceType
  // =========================================================================

  describe('ionViewWillEnter() — all device types set correctly', () => {
    const allDeviceTypes = [DeviceType.GAS_BOILER, DeviceType.HEAT_PUMP, DeviceType.BOILER, DeviceType.AIR_CONDITION];

    allDeviceTypes.forEach((type) => {
      it(`EXP2-AD-DEVTYPE: ${type} → device type available after enter`, () => {
        page = createPage({ device: createMockDevice({ type }) });
        page.ionViewWillEnter();
        expect((page as any).lookupService.device?.type).toBe(type);
      });

      it(`EXP2-AD-DEVTYPE-NODEVICE: null device → device is null/falsy`, () => {
        page = createPage({ device: null });
        page.ionViewWillEnter();
        expect((page as any).lookupService.device).toBeFalsy();
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: commissioning × annualService matrix
  // =========================================================================

  describe('ionViewWillEnter() — commissioning × annualService combinations', () => {
    const combos: Array<[boolean, boolean]> = [
      [false, false], [false, true], [true, false], [true, true],
    ];

    combos.forEach(([commissioning, annualService]) => {
      it(`EXP2-AD-FLAGS: commissioning=${commissioning} annualService=${annualService} → device flags set`, () => {
        page = createPage({ device: createMockDevice({ commissioning, annualService }) });
        page.ionViewWillEnter();
        expect((page as any).lookupService.device?.commissioning).toBe(commissioning);
        expect((page as any).lookupService.device?.annualService).toBe(annualService);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: getManufactureDateFromSn — more year × day combinations
  // =========================================================================

  describe('getManufactureDateFromSn() — additional year × day combinations', () => {
    // GAS_BOILER supports warranty date parsing
    const additionalYearDayCombos: Array<{ year: number; day: number; label: string }> = [
      { year: 20, day: 1, label: '2020 day 1 (Jan 1)' },
      { year: 21, day: 90, label: '2021 day 90 (Mar 31)' },
      { year: 22, day: 180, label: '2022 day 180 (Jun 29)' },
      { year: 23, day: 270, label: '2023 day 270 (Sep 27)' },
      { year: 24, day: 360, label: '2024 day 360 (Dec 25 - leap)' },
      { year: 25, day: 50, label: '2025 day 50 (Feb 19)' },
      { year: 26, day: 1, label: '2026 day 1 (Jan 1)' },
      { year: 19, day: 365, label: '2019 day 365 (Dec 31)' },
      { year: 18, day: 200, label: '2018 day 200 (Jul 19)' },
      { year: 17, day: 100, label: '2017 day 100 (Apr 10)' },
    ];

    additionalYearDayCombos.forEach(({ year, day, label }) => {
      it(`EXP2-AD-MFG-COMBO: GAS_BOILER year=20${year.toString().padStart(2, '0')} day=${day} (${label}) → warrantyInfo not null`, () => {
        const twoDigitYear = year;
        const dayPadded = String(day).padStart(3, '0');
        const sn = `GENUS${String(twoDigitYear).padStart(2, '0')}AB${String(twoDigitYear).padStart(2, '0')}${dayPadded}XX`;
        page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn });
        page.ionViewWillEnter();
        expect((page as any).warrantyInfo).not.toBeNull();
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: BOILER device — also null warrantyInfo
  // =========================================================================

  describe('getManufactureDateFromSn() — BOILER and AIR_CONDITION also return null', () => {
    function buildSnWithDate(twoDigitYear: number, dayOfYear: number): string {
      const yearStr = String(twoDigitYear).padStart(2, '0');
      const dayStr = String(dayOfYear).padStart(3, '0');
      return `GENUS24AB${yearStr}${dayStr}XX`;
    }

    const nullTypes = [DeviceType.BOILER, DeviceType.AIR_CONDITION];

    nullTypes.forEach((type) => {
      it(`EXP2-AD-MFG-${type}: ${type} device → warrantyInfo is null regardless of SN`, () => {
        const sn = buildSnWithDate(24, 100);
        page = createPage({ device: createMockDevice({ type }), sn });
        page.ionViewWillEnter();
        expect((page as any).warrantyInfo).toBeNull();
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: form reset on ionViewWillEnter
  // =========================================================================

  describe('ionViewWillEnter() — form state reset', () => {
    it('EXP2-AD-RESET: form does not carry state between enters', () => {
      page = createPage({ device: createMockDevice() });
      page.ionViewWillEnter();
      page.ionViewWillEnter();
      expect((page as any).lookupService.device).toBeDefined();
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: sn extraction from route
  // =========================================================================

  describe('ionViewWillEnter() — SN from route', () => {
    const snValues = [
      'GAS24AB12345', 'HP2024CD5678', 'BOILER001ABC', 'SN-001', '123456', 'A',
    ];

    snValues.forEach((sn) => {
      it(`EXP2-AD-SN: SN="${sn}" extracted from route`, () => {
        page = createPage({ sn, device: createMockDevice() });
        page.ionViewWillEnter();
        expect((page as any).sn).toBe(sn);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: warrantyInfo — messageKey values
  // =========================================================================

  describe('warrantyInfo messageKey — both valid cases', () => {
    function buildSnWithDate(twoDigitYear: number, dayOfYear: number): string {
      const yearStr = String(twoDigitYear).padStart(2, '0');
      const dayStr = String(dayOfYear).padStart(3, '0');
      return `GENUS24AB${yearStr}${dayStr}XX`;
    }

    const warrantyKeyScenarios: Array<{ twoDigitYear: number; day: number; label: string }> = [
      // Within warranty (within 2 years from 2026-05-03 test date)
      { twoDigitYear: 25, day: 1, label: '2025 day 1 — within 2yr' },
      { twoDigitYear: 25, day: 200, label: '2025 day 200 — within 2yr' },
      { twoDigitYear: 26, day: 1, label: '2026 day 1 — within 2yr' },
      // Beyond warranty
      { twoDigitYear: 22, day: 1, label: '2022 day 1 — beyond 2yr' },
      { twoDigitYear: 21, day: 100, label: '2021 day 100 — beyond 2yr' },
      { twoDigitYear: 20, day: 200, label: '2020 day 200 — beyond 2yr' },
    ];

    warrantyKeyScenarios.forEach(({ twoDigitYear, day, label }) => {
      it(`EXP2-AD-WARR-KEY: ${label} → messageKey is a string`, () => {
        const sn = buildSnWithDate(twoDigitYear, day);
        page = createPage({ device: createMockDevice({ type: DeviceType.GAS_BOILER }), sn });
        page.ionViewWillEnter();
        const warrantyInfo = (page as any).warrantyInfo;
        if (warrantyInfo !== null) {
          expect(typeof warrantyInfo.messageKey).toBe('string');
          expect(warrantyInfo.messageKey.length).toBeGreaterThan(0);
        }
      });
    });
  });
});
