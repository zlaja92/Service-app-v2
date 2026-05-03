/**
 * HomePage Unit Tests — WU-29, Batch B3
 *
 * MOCK STRATEGY
 * =============
 * AuthStore:            createMockAuthStore()
 * TenantStore:          plain object with signal-like callables
 * ConfigStore:          createMockConfigStore()
 * Router:               createMockRouter()
 * DeviceLookupService:  jasmine.createSpyObj (lookup, lookupSilent)
 * ToastController:      createMockToastController()
 * TranslocoService:     provided via TranslocoTestingModule (NOT mocked separately)
 * FirestoreService:     createMockFirestoreService() (needed by temp uploadTranslations)
 * LoggerService:        createMockLoggerService()
 * TenantService:        createMockTenantService()
 *
 * NOTE on CapacitorBarcodeScanner (BUG-03):
 *   CapacitorBarcodeScanner is a plain ES static class (not a Capacitor Proxy),
 *   so spyOn() works correctly to intercept scanBarcode() calls.
 *
 * NOTE on TranslocoService:
 *   TranslocoTestingModule.forRoot() provides the real TranslocoService backed by
 *   in-memory translations. The TranslocoService spy (mockTransloco) is retrieved
 *   via TestBed.inject() AFTER setup so spy assertions still work on the real instance.
 *   We do NOT override TranslocoService in providers — that breaks pipe rendering.
 */

import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { HomePage } from './home.page';
import { AuthStore } from '../../core/auth/auth.store';
import { TenantStore } from '../../core/tenant/tenant.store';
import { ConfigStore } from '../../core/config/config.store';
import { DeviceLookupService } from '../device-management/services/device-lookup.service';
import { FirestoreService } from '../../core/firebase/firestore.service';
import { LoggerService } from '../../core/logger/logger.service';
import { TenantService } from '../../core/tenant/tenant.service';
import {
  createMockAuthStore,
  createMockConfigStore,
  createMockRouter,
  createMockToastController,
  createMockFirestoreService,
  createMockLoggerService,
  createMockTenantService,
} from '../../testing/mock-factories';
import { getDefaultConfig, FeatureFlags } from '../../core/config/config.model';

import * as BarcodeScannerModule from '@capacitor/barcode-scanner';

// ─── Minimal Transloco translations ───────────────────────────────────────────
const translocoLangs = {
  en: {
    home_sn_placeholder: 'Enter serial number',
    home_search: 'Search',
    home_scan_barcode: 'Scan barcode',
    home_documentation: 'Documentation',
    home_search_by_device: 'Search by device',
    home_search_by_user: 'Search by user',
    home_device_not_found: 'home_device_not_found',
    home_scan_error: 'home_scan_error',
  },
};

// ─── CapacitorBarcodeScanner spy helpers ──────────────────────────────────────

function spyScanBarcodeResolve(
  result: BarcodeScannerModule.CapacitorBarcodeScannerScanResult,
): jasmine.Spy {
  return spyOn(BarcodeScannerModule.CapacitorBarcodeScanner, 'scanBarcode').and.resolveTo(result);
}

function spyScanBarcodeReject(error: unknown): jasmine.Spy {
  return spyOn(BarcodeScannerModule.CapacitorBarcodeScanner, 'scanBarcode').and.rejectWith(error);
}

// ─── TenantStore stub ─────────────────────────────────────────────────────────
// TenantStore is a SignalStore. We provide a plain object with callable
// signal accessors (functions returning the state value).
const mockTenantStoreValue = {
  tenantId: () => null as string | null,
  role: () => null as string | null,
  servicerId: () => null as string | null,
  deviceTypes: () => [] as string[],
  setTenant: jasmine.createSpy('setTenant'),
  clear: jasmine.createSpy('clear'),
};

// ─── Spec ──────────────────────────────────────────────────────────────────────

describe('HomePage', () => {
  let fixture: ComponentFixture<HomePage>;
  let component: HomePage;

  let mockAuthStore: ReturnType<typeof createMockAuthStore>;
  let mockConfigStore: ReturnType<typeof createMockConfigStore>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockToastCtrl: jasmine.SpyObj<ToastController>;
  let mockLookupService: jasmine.SpyObj<DeviceLookupService>;
  let mockFirestoreService: jasmine.SpyObj<FirestoreService>;
  let mockLoggerService: jasmine.SpyObj<LoggerService>;
  let mockTenantService: jasmine.SpyObj<TenantService>;
  // The real TranslocoService from TranslocoTestingModule — retrieved after TestBed setup
  let translocoService: TranslocoService;

  function setupTestBed(featureOverrides: Partial<FeatureFlags> = {}): void {
    const cfg = getDefaultConfig();
    cfg.features = { ...cfg.features, ...featureOverrides };
    mockConfigStore.setConfig(cfg);
    mockConfigStore.isFeatureEnabled.and.callFake((featureName: keyof FeatureFlags) => {
      const features = mockConfigStore.config()?.features;
      return features?.[featureName] ?? false;
    });

    TestBed.configureTestingModule({
      imports: [
        HomePage,
        TranslocoTestingModule.forRoot({
          langs: translocoLangs,
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: TenantStore, useValue: mockTenantStoreValue },
        { provide: ConfigStore, useValue: mockConfigStore },
        { provide: Router, useValue: mockRouter },
        { provide: DeviceLookupService, useValue: mockLookupService },
        { provide: ToastController, useValue: mockToastCtrl },
        { provide: FirestoreService, useValue: mockFirestoreService },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: TenantService, useValue: mockTenantService },
      ],
    });
  }

  function createAndDetect(featureOverrides: Partial<FeatureFlags> = {}): void {
    setupTestBed(featureOverrides);
    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    translocoService = TestBed.inject(TranslocoService);
    fixture.detectChanges();
  }

  beforeEach(() => {
    mockAuthStore = createMockAuthStore();
    mockConfigStore = createMockConfigStore();
    mockRouter = createMockRouter();
    mockToastCtrl = createMockToastController();
    mockFirestoreService = createMockFirestoreService();
    mockLoggerService = createMockLoggerService();
    mockTenantService = createMockTenantService();

    mockLookupService = jasmine.createSpyObj<DeviceLookupService>('DeviceLookupService', [
      'lookup',
      'lookupSilent',
      'clear',
      'extractModelCode',
    ]);
    mockLookupService.lookup.and.resolveTo(null);
    mockLookupService.lookupSilent.and.resolveTo(null);
  });

  // ─── TC-01: searchBySn — empty input returns early ────────────────────────────

  it('TC-01: searchBySn — empty input returns early without calling lookup', async () => {
    createAndDetect();
    component.snInput = '';

    await component.searchBySn();

    expect(mockLookupService.lookup).not.toHaveBeenCalled();
    expect(mockToastCtrl.create).not.toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('TC-01b: searchBySn — whitespace-only input returns early without calling lookup', async () => {
    createAndDetect();
    component.snInput = '   ';

    await component.searchBySn();

    expect(mockLookupService.lookup).not.toHaveBeenCalled();
    expect(mockToastCtrl.create).not.toHaveBeenCalled();
  });

  // ─── TC-02: searchBySn — trimmed input used ───────────────────────────────────

  it('TC-02: searchBySn — passes trimmed value to lookup', async () => {
    createAndDetect();
    const sn = 'SN12345678901234567890';
    component.snInput = `  ${sn}  `;

    await component.searchBySn();

    expect(mockLookupService.lookup).toHaveBeenCalledWith(sn);
  });

  // ─── TC-03: searchBySn — device found → navigate to device detail ─────────────

  it('TC-03: searchBySn — device found navigates to device-management with SN', async () => {
    createAndDetect();
    const sn = 'SN12345678901234567890';
    component.snInput = sn;

    mockLookupService.lookup.and.resolveTo({
      code: 'MODEL01',
      name: 'Test Boiler',
      type: 'gas-boiler' as any,
      subType: '',
      unitCount: 0,
      exists: true,
      commissioning: false,
      annualService: false,
      connectedDevice: false,
    });

    await component.searchBySn();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/device-management', sn]);
    expect(mockToastCtrl.create).not.toHaveBeenCalled();
  });

  // ─── TC-04: searchBySn — device not found → toast 'home_device_not_found' ─────

  it('TC-04: searchBySn — device not found shows warning toast with translated message', async () => {
    createAndDetect();
    component.snInput = 'SN12345678901234567890';
    mockLookupService.lookup.and.resolveTo(null);

    await component.searchBySn();

    // TranslocoTestingModule returns the translation value from translocoLangs,
    // which maps 'home_device_not_found' -> 'home_device_not_found'
    expect(mockToastCtrl.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        message: 'home_device_not_found',
        color: 'warning',
        duration: 3000,
        position: 'bottom',
      }),
    );
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  // ─── TC-05: searchBySn — lookup returns null (internal error path) ────────────

  it('TC-05: searchBySn — when lookup returns null it shows not-found toast and does not navigate', async () => {
    // DeviceLookupService.lookup() swallows errors and returns null.
    // HomePage treats null as "not found" and shows the warning toast.
    createAndDetect();
    component.snInput = 'SN12345678901234567890';
    mockLookupService.lookup.and.resolveTo(null);

    await component.searchBySn();

    expect(mockToastCtrl.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ color: 'warning' }),
    );
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  // ─── TC-06: scanBarcode — successful scan sets snInput ────────────────────────

  it('TC-06: scanBarcode — successful scan sets snInput to ScanResult', async () => {
    createAndDetect();
    spyScanBarcodeResolve({ ScanResult: 'BARCODE123', format: 17 as any });

    await component.scanBarcode();

    expect(component.snInput).toBe('BARCODE123');
  });

  // ─── TC-07: scanBarcode — empty ScanResult does not change snInput ────────────

  it('TC-07: scanBarcode — empty ScanResult does not change snInput', async () => {
    createAndDetect();
    component.snInput = 'ORIGINAL';
    spyScanBarcodeResolve({ ScanResult: '', format: 17 as any });

    await component.scanBarcode();

    // Empty string is falsy — the `if (result.ScanResult)` guard prevents assignment
    expect(component.snInput).toBe('ORIGINAL');
  });

  // ─── TC-08: scanBarcode — user cancel (OS-PLUG-BARC-0006) → silent ───────────

  it('TC-08: scanBarcode — user cancel error code is silently ignored (no toast)', async () => {
    createAndDetect();
    spyScanBarcodeReject({ code: 'OS-PLUG-BARC-0006', message: 'User cancelled' });

    await component.scanBarcode();

    expect(mockToastCtrl.create).not.toHaveBeenCalled();
  });

  // ─── TC-09: scanBarcode — other scan error → danger toast ────────────────────

  it('TC-09: scanBarcode — unexpected scan error shows danger toast with correct i18n message', async () => {
    createAndDetect();
    spyScanBarcodeReject({ code: 'OS-PLUG-BARC-9999', message: 'Camera error' });

    await component.scanBarcode();

    expect(mockToastCtrl.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        message: 'home_scan_error',
        color: 'danger',
        duration: 3000,
        position: 'bottom',
      }),
    );
  });

  // ─── TC-10: navigateTo — navigates to provided path ──────────────────────────

  it('TC-10: navigateTo — navigates to provided path', () => {
    createAndDetect();
    component.navigateTo('/docs');

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/docs']);
  });

  // ─── TC-11: navigateTo — navigates to different paths ───────────────────────

  it('TC-11: navigateTo — navigates to search-by-device path', () => {
    createAndDetect();
    component.navigateTo('/search-by-device');

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/search-by-device']);
  });

  it('TC-11b: navigateTo — navigates to search-by-user path', () => {
    createAndDetect();
    component.navigateTo('/search-by-user');

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/search-by-user']);
  });

  // ─── TC-12: Lifecycle/config — component reads config signals ─────────────────

  it('TC-12: configStore — appTitle signal reflects config theme after runtime update', () => {
    // Create with default config first, then update config signal after component creation
    createAndDetect();

    const cfg = getDefaultConfig();
    cfg.theme.appTitle = 'My Test App';
    // Update the mock signal directly — this simulates a runtime config reload
    mockConfigStore.config.set(cfg);

    expect((component as any).configStore.appTitle()).toBe('My Test App');
  });

  it('TC-12b: configStore — isFeatureEnabled returns true for enabled deviceManagement', () => {
    createAndDetect({ deviceManagement: true });

    expect(mockConfigStore.isFeatureEnabled('deviceManagement')).toBe(true);
  });

  it('TC-12c: configStore — isFeatureEnabled returns false when feature is disabled', () => {
    createAndDetect({ cart: false });

    expect(mockConfigStore.isFeatureEnabled('cart')).toBe(false);
  });

  // ─── TC-13 (bonus): Multiple sequential searches ──────────────────────────────

  it('TC-13: searchBySn — multiple sequential searches work independently', async () => {
    createAndDetect();
    const sn1 = 'SN11111111111111111111';
    const sn2 = 'SN22222222222222222222';

    // First search: device not found → toast
    component.snInput = sn1;
    mockLookupService.lookup.and.resolveTo(null);
    await component.searchBySn();

    expect(mockLookupService.lookup).toHaveBeenCalledWith(sn1);
    expect(mockToastCtrl.create).toHaveBeenCalledTimes(1);

    // Second search: device found → navigate, no toast
    mockToastCtrl.create.calls.reset();
    component.snInput = sn2;
    mockLookupService.lookup.and.resolveTo({
      code: 'MODEL02',
      name: 'Another Boiler',
      type: 'gas-boiler' as any,
      subType: '',
      unitCount: 0,
      exists: true,
      commissioning: false,
      annualService: false,
      connectedDevice: false,
    });
    await component.searchBySn();

    expect(mockLookupService.lookup).toHaveBeenCalledWith(sn2);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/device-management', sn2]);
    expect(mockToastCtrl.create).not.toHaveBeenCalled();
  });

  // ─── TC-14 (bonus): scanBarcode — error without code property → toast ─────────

  it('TC-14: scanBarcode — plain Error object (no code) shows danger toast', async () => {
    createAndDetect();
    // Plain Error has no 'code' property → code defaults to '' → shows toast
    spyScanBarcodeReject(new Error('generic failure'));

    await component.scanBarcode();

    expect(mockToastCtrl.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        message: 'home_scan_error',
        color: 'danger',
      }),
    );
  });

  // ─── EXPANSION — searchBySn SN format variations (parameterized) ─────────────

  describe('searchBySn — SN format variations', () => {
    const emptyOrWhitespaceCases = [
      '',
      ' ',
      '  ',
      '\t',
      '\n',
      '   \t   ',
    ];

    emptyOrWhitespaceCases.forEach((input) => {
      it(`should return early for input="${JSON.stringify(input)}"`, async () => {
        createAndDetect();
        component.snInput = input;

        await component.searchBySn();

        expect(mockLookupService.lookup).not.toHaveBeenCalled();
      });
    });

    const validSnFormats = [
      'SN12345678901234567890',
      'SN00000000000000000001',
      'SN99999999999999999999',
      'AB12345678901234567890',
      '123456789012345678901234',
      'SN-12345',
      'SERIALNUMBER001',
      'A',
      'AB',
      'ABCDEF',
      '1234567890',
      'sn_lowercase',
    ];

    validSnFormats.forEach((sn) => {
      it(`should call lookup for non-empty SN="${sn}"`, async () => {
        createAndDetect();
        component.snInput = sn;
        mockLookupService.lookup.and.resolveTo(null);

        await component.searchBySn();

        expect(mockLookupService.lookup).toHaveBeenCalledWith(sn.trim());
      });
    });
  });

  // ─── EXPANSION — searchBySn whitespace trimming (parameterized) ──────────────

  describe('searchBySn — whitespace trimming', () => {
    const snWithWhitespace: Array<{ input: string; expectedTrimmed: string }> = [
      { input: '  SN12345  ', expectedTrimmed: 'SN12345' },
      { input: '\tSN-TABBED\t', expectedTrimmed: 'SN-TABBED' },
      { input: 'SN-TRAILING   ', expectedTrimmed: 'SN-TRAILING' },
      { input: '   SN-LEADING', expectedTrimmed: 'SN-LEADING' },
      { input: '  BOTH  ', expectedTrimmed: 'BOTH' },
    ];

    snWithWhitespace.forEach(({ input, expectedTrimmed }) => {
      it(`should trim "${input}" to "${expectedTrimmed}" before lookup`, async () => {
        createAndDetect();
        component.snInput = input;
        mockLookupService.lookup.and.resolveTo(null);

        await component.searchBySn();

        expect(mockLookupService.lookup).toHaveBeenCalledWith(expectedTrimmed);
      });
    });
  });

  // ─── EXPANSION — scanBarcode ScanResult variations ──────────────────────────

  describe('scanBarcode — ScanResult format variations', () => {
    const validBarcodes = [
      'SN12345678901234567890',
      '1234567890',
      'ABC-DEF-GHI',
      '   SN-WITH-SPACES   ',
      'SHORT',
    ];

    validBarcodes.forEach((barcode) => {
      it(`should set snInput to "${barcode}" after successful scan`, async () => {
        createAndDetect();
        spyScanBarcodeResolve({ ScanResult: barcode, format: 17 as any });

        await component.scanBarcode();

        expect(component.snInput).toBe(barcode);
      });
    });

    const emptyResults = ['', null as any, undefined as any];

    emptyResults.forEach((result) => {
      it(`should not change snInput when ScanResult is "${result}"`, async () => {
        createAndDetect();
        component.snInput = 'ORIGINAL_VALUE';
        spyScanBarcodeResolve({ ScanResult: result, format: 17 as any });

        await component.scanBarcode();

        expect(component.snInput).toBe('ORIGINAL_VALUE');
      });
    });
  });

  // ─── EXPANSION — navigateTo various paths ───────────────────────────────────

  describe('navigateTo — various paths (parameterized)', () => {
    const paths = [
      '/home',
      '/docs',
      '/cart',
      '/search-by-device',
      '/search-by-user',
      '/device-management',
      '/login',
      '/profile',
      '/interventions',
    ];

    paths.forEach((path) => {
      it(`should navigate to "${path}"`, () => {
        createAndDetect();
        component.navigateTo(path);
        expect(mockRouter.navigate).toHaveBeenCalledWith([path]);
      });
    });
  });

  // ─── EXPANSION — searchBySn toast properties ────────────────────────────────

  describe('searchBySn — toast configuration', () => {
    it('should show toast with duration=3000 when device not found', async () => {
      createAndDetect();
      component.snInput = 'SN12345678901234567890';
      mockLookupService.lookup.and.resolveTo(null);

      await component.searchBySn();

      expect(mockToastCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ duration: 3000 }),
      );
    });

    it('should show toast with position=bottom when device not found', async () => {
      createAndDetect();
      component.snInput = 'SN12345678901234567890';
      mockLookupService.lookup.and.resolveTo(null);

      await component.searchBySn();

      expect(mockToastCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ position: 'bottom' }),
      );
    });

    it('should present the toast after creating it', async () => {
      createAndDetect();
      component.snInput = 'SN12345678901234567890';
      mockLookupService.lookup.and.resolveTo(null);

      const presentSpy = jasmine.createSpy('present').and.resolveTo();
      const mockToast = { present: presentSpy, dismiss: jasmine.createSpy() } as unknown as HTMLIonToastElement;
      mockToastCtrl.create.and.resolveTo(mockToast);

      await component.searchBySn();

      expect(presentSpy).toHaveBeenCalledTimes(1);
    });

    it('should NOT call lookup when snInput has only whitespace variations', async () => {
      const whitespaceInputs = ['\t', '\n', '\r\n', ' \t \n '];
      createAndDetect();

      for (const ws of whitespaceInputs) {
        mockLookupService.lookup.calls.reset();
        component.snInput = ws;
        await component.searchBySn();
        expect(mockLookupService.lookup).not.toHaveBeenCalled();
      }
    });
  });

  // ─── EXPANSION — scanBarcode error codes ───────────────────────────────────

  describe('scanBarcode — error code handling (parameterized)', () => {
    const silentCodes = ['OS-PLUG-BARC-0006'];
    const dangerCodes = [
      'OS-PLUG-BARC-0001',
      'OS-PLUG-BARC-0002',
      'OS-PLUG-BARC-9999',
      'UNKNOWN-CODE',
      '',
    ];

    silentCodes.forEach((code) => {
      it(`should silently ignore barcode error with code="${code}"`, async () => {
        createAndDetect();
        spyScanBarcodeReject({ code, message: 'Cancelled' });

        await component.scanBarcode();

        expect(mockToastCtrl.create).not.toHaveBeenCalled();
      });
    });

    dangerCodes.forEach((code) => {
      it(`should show danger toast for barcode error with code="${code}"`, async () => {
        createAndDetect();
        spyScanBarcodeReject({ code, message: 'Error occurred' });

        await component.scanBarcode();

        expect(mockToastCtrl.create).toHaveBeenCalledWith(
          jasmine.objectContaining({ color: 'danger' }),
        );
      });
    });
  });
});
