/**
 * SignatureService Unit Tests
 *
 * MOCK STRATEGY
 * =============
 * ModalController:      createMockModalController() — per-test onDidDismiss override
 * ToastController:      createMockToastController()
 * TranslocoService:     createMockTranslocoService()
 * StorageService:       createMockStorageService()
 * TenantService:        createMockTenantService() — getCurrentTenantId returns 'mock-tenant'
 * ConfigStore:          createMockConfigStore() — business() computed from config signal
 * LoadingAlertService:  createMockLoadingAlertService() — wrap() is transparent pass-through
 * LoggerService:        createMockLoggerService()
 *
 * COVERAGE
 * ========
 * captureAndUpload — happy path, cancel, upload throws
 * openModal (indirect) — role/data combinations, modal config verification
 * buildStoragePath (indirect) — deviceType mapping, default fallback, no-config fallback,
 *                               path format regex
 */

import { TestBed } from '@angular/core/testing';
import { ModalController, ToastController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';

import { SignatureService } from './signature.service';
import { StorageService } from '../../../core/firebase/storage.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { ConfigStore } from '../../../core/config/config.store';
import { LoadingAlertService } from '../../../shared/services/loading-alert.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { SignatureModalComponent } from '../components/signature-modal/signature-modal.component';

import {
  createMockModalController,
  createMockToastController,
  createMockTranslocoService,
  createMockStorageService,
  createMockTenantService,
  createMockConfigStore,
  createMockLoadingAlertService,
  createMockLoggerService,
} from '../../../testing/mock-factories';
import { getDefaultConfig } from '../../../core/config/config.model';

// ─── Helper: build a modal fake with controllable onDidDismiss ────────────────

function makeModalFake(data: unknown, role: string): HTMLIonModalElement {
  return {
    present: jasmine.createSpy('present').and.resolveTo(),
    dismiss: jasmine.createSpy('dismiss').and.resolveTo(true),
    onDidDismiss: () => Promise.resolve({ data, role }),
  } as unknown as HTMLIonModalElement;
}

// ─── Spec ─────────────────────────────────────────────────────────────────────

describe('SignatureService', () => {
  let service: SignatureService;

  let modalCtrl: jasmine.SpyObj<ModalController>;
  let toastCtrl: jasmine.SpyObj<ToastController>;
  let translocoService: jasmine.SpyObj<TranslocoService>;
  let storageService: jasmine.SpyObj<StorageService>;
  let tenantService: jasmine.SpyObj<TenantService>;
  let configStore: ReturnType<typeof createMockConfigStore>;
  let loadingAlert: jasmine.SpyObj<LoadingAlertService>;
  let logger: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    modalCtrl = createMockModalController();
    toastCtrl = createMockToastController();
    translocoService = createMockTranslocoService();
    storageService = createMockStorageService();
    tenantService = createMockTenantService();
    configStore = createMockConfigStore();
    loadingAlert = createMockLoadingAlertService();
    logger = createMockLoggerService();

    TestBed.configureTestingModule({
      providers: [
        SignatureService,
        { provide: ModalController, useValue: modalCtrl },
        { provide: ToastController, useValue: toastCtrl },
        { provide: TranslocoService, useValue: translocoService },
        { provide: StorageService, useValue: storageService },
        { provide: TenantService, useValue: tenantService },
        { provide: ConfigStore, useValue: configStore },
        { provide: LoadingAlertService, useValue: loadingAlert },
        { provide: LoggerService, useValue: logger },
      ],
    });

    service = TestBed.inject(SignatureService);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // captureAndUpload — happy path
  // ═══════════════════════════════════════════════════════════════════════════

  describe('captureAndUpload — happy path', () => {
    it('TC-CAU-01: returns storage path when user saves signature and upload succeeds', async () => {
      const dataUrl = 'data:image/png;base64,abc123';
      modalCtrl.create.and.resolveTo(makeModalFake({ dataUrl }, 'save'));
      storageService.uploadDataUrl.and.resolveTo();

      // Use default config so 'gas-boiler' falls back through default → 'interventions'
      configStore.loadDefaults();

      const result = await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(result).toMatch(/^mock-tenant\/interventions\/SN001\/signatures\/signature_\d+\.png$/);
    });

    it('TC-CAU-02: calls loadingAlert.wrap when upload proceeds', async () => {
      const dataUrl = 'data:image/png;base64,abc123';
      modalCtrl.create.and.resolveTo(makeModalFake({ dataUrl }, 'save'));
      storageService.uploadDataUrl.and.resolveTo();
      configStore.loadDefaults();

      await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(loadingAlert.wrap).toHaveBeenCalledTimes(1);
    });

    it('TC-CAU-03: calls logger.info after successful upload', async () => {
      const dataUrl = 'data:image/png;base64,abc123';
      modalCtrl.create.and.resolveTo(makeModalFake({ dataUrl }, 'save'));
      storageService.uploadDataUrl.and.resolveTo();
      configStore.loadDefaults();

      await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(logger.info).toHaveBeenCalledWith('Signature uploaded', jasmine.objectContaining({ path: jasmine.any(String) }));
    });

    it('TC-CAU-04: passes correct dataUrl to uploadDataUrl', async () => {
      const dataUrl = 'data:image/png;base64,SPECIFIC_DATA';
      modalCtrl.create.and.resolveTo(makeModalFake({ dataUrl }, 'save'));
      storageService.uploadDataUrl.and.resolveTo();
      configStore.loadDefaults();

      await service.captureAndUpload({ sn: 'SN002', deviceType: 'gas-boiler' });

      expect(storageService.uploadDataUrl).toHaveBeenCalledWith(
        jasmine.any(String),
        dataUrl,
        'image/png',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // captureAndUpload — cancel path
  // ═══════════════════════════════════════════════════════════════════════════

  describe('captureAndUpload — cancel', () => {
    it('TC-CAU-05: returns null when user cancels (role=cancel, data=null)', async () => {
      modalCtrl.create.and.resolveTo(makeModalFake(null, 'cancel'));

      const result = await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(result).toBeNull();
    });

    it('TC-CAU-06: does NOT call uploadDataUrl when user cancels', async () => {
      modalCtrl.create.and.resolveTo(makeModalFake(null, 'cancel'));

      await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(storageService.uploadDataUrl).not.toHaveBeenCalled();
    });

    it('TC-CAU-07: does NOT call loadingAlert.wrap when user cancels', async () => {
      modalCtrl.create.and.resolveTo(makeModalFake(null, 'cancel'));

      await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(loadingAlert.wrap).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // captureAndUpload — upload throws
  // ═══════════════════════════════════════════════════════════════════════════

  describe('captureAndUpload — upload throws', () => {
    it('TC-CAU-08: returns null when uploadDataUrl rejects', async () => {
      const dataUrl = 'data:image/png;base64,abc123';
      modalCtrl.create.and.resolveTo(makeModalFake({ dataUrl }, 'save'));
      storageService.uploadDataUrl.and.rejectWith(new Error('Network error'));
      // loadingAlert.wrap is transparent — it calls the operation, which throws
      loadingAlert.wrap.and.callFake(<T>(operation: () => Promise<T>) => operation());
      configStore.loadDefaults();

      const result = await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(result).toBeNull();
    });

    it('TC-CAU-09: shows error toast when uploadDataUrl rejects', async () => {
      const dataUrl = 'data:image/png;base64,abc123';
      modalCtrl.create.and.resolveTo(makeModalFake({ dataUrl }, 'save'));
      storageService.uploadDataUrl.and.rejectWith(new Error('Network error'));
      loadingAlert.wrap.and.callFake(<T>(operation: () => Promise<T>) => operation());
      configStore.loadDefaults();

      await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(toastCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          color: 'danger',
          duration: 3000,
          position: 'bottom',
        }),
      );
    });

    it('TC-CAU-10: calls logger.error when uploadDataUrl rejects', async () => {
      const dataUrl = 'data:image/png;base64,abc123';
      modalCtrl.create.and.resolveTo(makeModalFake({ dataUrl }, 'save'));
      storageService.uploadDataUrl.and.rejectWith(new Error('Network error'));
      loadingAlert.wrap.and.callFake(<T>(operation: () => Promise<T>) => operation());
      configStore.loadDefaults();

      await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(logger.error).toHaveBeenCalledWith(
        'Signature upload failed',
        jasmine.objectContaining({ path: jasmine.any(String) }),
      );
    });

    it('TC-CAU-11: presents the error toast after creating it', async () => {
      const dataUrl = 'data:image/png;base64,abc123';
      modalCtrl.create.and.resolveTo(makeModalFake({ dataUrl }, 'save'));
      storageService.uploadDataUrl.and.rejectWith(new Error('Network error'));
      loadingAlert.wrap.and.callFake(<T>(operation: () => Promise<T>) => operation());
      configStore.loadDefaults();

      const presentSpy = jasmine.createSpy('present').and.resolveTo();
      toastCtrl.create.and.resolveTo({
        present: presentSpy,
        dismiss: jasmine.createSpy('dismiss').and.resolveTo(true),
      } as unknown as HTMLIonToastElement);

      await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(presentSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // openModal — indirect testing via captureAndUpload
  // ═══════════════════════════════════════════════════════════════════════════

  describe('openModal — role and data combinations (indirect)', () => {
    beforeEach(() => {
      configStore.loadDefaults();
      storageService.uploadDataUrl.and.resolveTo();
    });

    it('TC-OM-01: role=save + {dataUrl} — upload is called (dataUrl extracted)', async () => {
      const dataUrl = 'data:image/png;base64,abc';
      modalCtrl.create.and.resolveTo(makeModalFake({ dataUrl }, 'save'));

      await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(storageService.uploadDataUrl).toHaveBeenCalledWith(
        jasmine.any(String),
        dataUrl,
        'image/png',
      );
    });

    it('TC-OM-02: role=cancel + null — returns null, upload NOT called', async () => {
      modalCtrl.create.and.resolveTo(makeModalFake(null, 'cancel'));

      const result = await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(result).toBeNull();
      expect(storageService.uploadDataUrl).not.toHaveBeenCalled();
    });

    it('TC-OM-03: role=save + data=undefined — returns null, upload NOT called', async () => {
      modalCtrl.create.and.resolveTo(makeModalFake(undefined, 'save'));

      const result = await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(result).toBeNull();
      expect(storageService.uploadDataUrl).not.toHaveBeenCalled();
    });

    it('TC-OM-04: role=save + {dataUrl:""} — returns null, upload NOT called', async () => {
      modalCtrl.create.and.resolveTo(makeModalFake({ dataUrl: '' }, 'save'));

      const result = await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(result).toBeNull();
      expect(storageService.uploadDataUrl).not.toHaveBeenCalled();
    });

    it('TC-OM-05: role=undefined — returns null, upload NOT called', async () => {
      modalCtrl.create.and.resolveTo(makeModalFake(null, undefined as unknown as string));

      const result = await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(result).toBeNull();
      expect(storageService.uploadDataUrl).not.toHaveBeenCalled();
    });
  });

  describe('openModal — modal creation config verification (indirect)', () => {
    it('TC-OM-06: creates modal with cssClass=fullscreen-modal, backdropDismiss=false and SignatureModalComponent', async () => {
      modalCtrl.create.and.resolveTo(makeModalFake(null, 'cancel'));

      await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(modalCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          component: SignatureModalComponent,
          cssClass: 'fullscreen-modal',
          backdropDismiss: false,
        }),
      );
    });

    it('TC-OM-07: calls modal.present() after creating the modal', async () => {
      const presentSpy = jasmine.createSpy('present').and.resolveTo();
      const modalFake = {
        present: presentSpy,
        dismiss: jasmine.createSpy('dismiss').and.resolveTo(true),
        onDidDismiss: () => Promise.resolve({ data: null, role: 'cancel' }),
      } as unknown as HTMLIonModalElement;
      modalCtrl.create.and.resolveTo(modalFake);

      await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(presentSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // buildStoragePath — indirect testing via captureAndUpload
  // ═══════════════════════════════════════════════════════════════════════════

  describe('buildStoragePath — collection resolution (indirect)', () => {
    beforeEach(() => {
      storageService.uploadDataUrl.and.resolveTo();
    });

    it('TC-BSP-01: uses mapped collection when deviceType exists in interventionCollections', async () => {
      const cfg = getDefaultConfig();
      cfg.business.interventionCollections = {
        'gas-boiler': 'gas-boiler-interventions',
        default: 'interventions',
      };
      configStore.setConfig(cfg);

      modalCtrl.create.and.resolveTo(
        makeModalFake({ dataUrl: 'data:image/png;base64,x' }, 'save'),
      );

      await service.captureAndUpload({ sn: 'SN100', deviceType: 'gas-boiler' });

      expect(storageService.uploadDataUrl).toHaveBeenCalledWith(
        jasmine.stringMatching(/^mock-tenant\/gas-boiler-interventions\/SN100\/signatures\/signature_\d+\.png$/),
        jasmine.any(String),
        'image/png',
      );
    });

    it('TC-BSP-02: falls back to "default" collection when deviceType has no specific mapping', async () => {
      const cfg = getDefaultConfig();
      cfg.business.interventionCollections = {
        default: 'default-collection',
      };
      configStore.setConfig(cfg);

      modalCtrl.create.and.resolveTo(
        makeModalFake({ dataUrl: 'data:image/png;base64,x' }, 'save'),
      );

      await service.captureAndUpload({ sn: 'SN200', deviceType: 'heat-pump' });

      expect(storageService.uploadDataUrl).toHaveBeenCalledWith(
        jasmine.stringMatching(/^mock-tenant\/default-collection\/SN200\/signatures\/signature_\d+\.png$/),
        jasmine.any(String),
        'image/png',
      );
    });

    it('TC-BSP-03: falls back to hardcoded "interventions" when no deviceType mapping and no default', async () => {
      const cfg = getDefaultConfig();
      cfg.business.interventionCollections = {};
      configStore.setConfig(cfg);

      modalCtrl.create.and.resolveTo(
        makeModalFake({ dataUrl: 'data:image/png;base64,x' }, 'save'),
      );

      await service.captureAndUpload({ sn: 'SN300', deviceType: 'unknown-type' });

      expect(storageService.uploadDataUrl).toHaveBeenCalledWith(
        jasmine.stringMatching(/^mock-tenant\/interventions\/SN300\/signatures\/signature_\d+\.png$/),
        jasmine.any(String),
        'image/png',
      );
    });

    it('TC-BSP-04: uses "interventions" (DEFAULT_BUSINESS default) when configStore.business() returns undefined (no config set)', async () => {
      // configStore.config signal is null → business computed returns undefined
      // buildStoragePath: mapping = undefined ?? {} = {} → collection = 'interventions'
      configStore.config.set(null);

      modalCtrl.create.and.resolveTo(
        makeModalFake({ dataUrl: 'data:image/png;base64,x' }, 'save'),
      );

      await service.captureAndUpload({ sn: 'SN400', deviceType: 'gas-boiler' });

      expect(storageService.uploadDataUrl).toHaveBeenCalledWith(
        jasmine.stringMatching(/^mock-tenant\/interventions\/SN400\/signatures\/signature_\d+\.png$/),
        jasmine.any(String),
        'image/png',
      );
    });
  });

  describe('buildStoragePath — path format (indirect)', () => {
    beforeEach(() => {
      configStore.loadDefaults();
      storageService.uploadDataUrl.and.resolveTo();
    });

    it('TC-BSP-05: path matches format {tenantId}/{collection}/{sn}/signatures/signature_{timestamp}.png', async () => {
      modalCtrl.create.and.resolveTo(
        makeModalFake({ dataUrl: 'data:image/png;base64,x' }, 'save'),
      );

      await service.captureAndUpload({ sn: 'SN-MYSERIAL', deviceType: 'gas-boiler' });

      const pathArg = (storageService.uploadDataUrl.calls.mostRecent().args)[0] as string;
      const pattern = /^mock-tenant\/interventions\/SN-MYSERIAL\/signatures\/signature_\d+\.png$/;
      expect(pattern.test(pathArg)).toBeTrue();
    });

    it('TC-BSP-06: path uses tenantId from tenantService.getCurrentTenantId()', async () => {
      tenantService.getCurrentTenantId.and.returnValue('custom-tenant-id');
      modalCtrl.create.and.resolveTo(
        makeModalFake({ dataUrl: 'data:image/png;base64,x' }, 'save'),
      );

      await service.captureAndUpload({ sn: 'SN-XYZ', deviceType: 'gas-boiler' });

      const pathArg = (storageService.uploadDataUrl.calls.mostRecent().args)[0] as string;
      expect(pathArg).toMatch(/^custom-tenant-id\//);
    });

    it('TC-BSP-07: path uses the sn from the context', async () => {
      modalCtrl.create.and.resolveTo(
        makeModalFake({ dataUrl: 'data:image/png;base64,x' }, 'save'),
      );

      await service.captureAndUpload({ sn: 'UNIQUE-SN-999', deviceType: 'gas-boiler' });

      const pathArg = (storageService.uploadDataUrl.calls.mostRecent().args)[0] as string;
      expect(pathArg).toContain('/UNIQUE-SN-999/');
    });

    it('TC-BSP-08: filename ends with .png and contains "signature_" prefix followed by digits', async () => {
      modalCtrl.create.and.resolveTo(
        makeModalFake({ dataUrl: 'data:image/png;base64,x' }, 'save'),
      );

      await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      const pathArg = (storageService.uploadDataUrl.calls.mostRecent().args)[0] as string;
      const filename = pathArg.split('/').pop()!;
      expect(filename).toMatch(/^signature_\d+\.png$/);
    });

    it('TC-BSP-09: path segment "signatures" is present between sn and filename', async () => {
      modalCtrl.create.and.resolveTo(
        makeModalFake({ dataUrl: 'data:image/png;base64,x' }, 'save'),
      );

      await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      const pathArg = (storageService.uploadDataUrl.calls.mostRecent().args)[0] as string;
      const segments = pathArg.split('/');
      // Expected: ['mock-tenant', 'interventions', 'SN001', 'signatures', 'signature_NNN.png']
      expect(segments[segments.length - 2]).toBe('signatures');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // showError toast content
  // ═══════════════════════════════════════════════════════════════════════════

  describe('showError — toast message i18n key', () => {
    it('TC-SE-01: error toast message uses translated "signature_upload_error" key', async () => {
      const dataUrl = 'data:image/png;base64,abc123';
      modalCtrl.create.and.resolveTo(makeModalFake({ dataUrl }, 'save'));
      storageService.uploadDataUrl.and.rejectWith(new Error('fail'));
      loadingAlert.wrap.and.callFake(<T>(operation: () => Promise<T>) => operation());
      configStore.loadDefaults();

      // createMockTranslocoService returns key as-is
      await service.captureAndUpload({ sn: 'SN001', deviceType: 'gas-boiler' });

      expect(toastCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: 'signature_upload_error',
        }),
      );
    });
  });
});
