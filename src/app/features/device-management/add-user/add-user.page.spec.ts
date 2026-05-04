/**
 * AddUserPage Unit Tests — WU-40, Batch B6
 *
 * MOCK STRATEGY
 * =============
 * - DeviceLookupService: jasmine.SpyObj — device property set directly on mock object
 * - DeviceRegistrationService: jasmine.SpyObj with register, registerBatch
 * - ServerTimeService: jasmine.SpyObj with getServerTime
 * - ConfirmService: jasmine.SpyObj with confirm
 * - ActivatedRoute: plain object with snapshot.paramMap.get / snapshot.queryParamMap.get
 * - Router: createMockRouter() from mock-factories
 * - ToastController: createMockToastController() from mock-factories
 * - TranslocoService: createMockTranslocoService() from mock-factories
 * - PickerController: jasmine.SpyObj with create
 *
 * All tests are independent — no shared mutable state carried between specs.
 * Uses TestBed.inject(AddUserPage) to avoid NavController bootstrap issues.
 */

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { PickerController, ToastController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';

import { AddUserPage } from './add-user.page';
import { DeviceLookupService } from '../services/device-lookup.service';
import { DeviceRegistrationService } from '../services/device-registration.service';
import { ServerTimeService } from '../../../core/firebase/server-time.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { Device } from '../../../shared/models/device.model';
import {
  createMockRouter,
  createMockToastController,
  createMockTranslocoService,
} from '../../../testing/mock-factories';
import { buildDevice } from '../../../testing/test-data-builders';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockActivatedRoute(sn: string, connectedSn = ''): object {
  return {
    snapshot: {
      paramMap: {
        get: jasmine.createSpy('paramMap.get').and.callFake((key: string) =>
          key === 'sn' ? sn : null,
        ),
      },
      queryParamMap: {
        get: jasmine.createSpy('queryParamMap.get').and.callFake((key: string) =>
          key === 'connectedSn' ? (connectedSn || null) : null,
        ),
      },
    },
  };
}

function createMockDeviceLookupService(initialDevice: Device | null = null): jasmine.SpyObj<DeviceLookupService> {
  const mock = jasmine.createSpyObj<DeviceLookupService>('DeviceLookupService', [
    'lookup',
    'lookupSilent',
    'clear',
    'extractModelCode',
  ]);
  // Use a backing variable so the property is writable and observable by reference
  let _device: Device | null = initialDevice;
  Object.defineProperty(mock, 'device', {
    get: () => _device,
    set: (v: Device | null) => { _device = v; },
    configurable: true,
    enumerable: true,
  });
  return mock;
}

function createMockRegistrationService(): jasmine.SpyObj<DeviceRegistrationService> {
  const mock = jasmine.createSpyObj<DeviceRegistrationService>('DeviceRegistrationService', [
    'register',
    'registerBatch',
    'checkRegistration',
    'clear',
    'getPurchaseDateFormatted',
    'getWarrantyEndDateFormatted',
  ]);
  mock.register.and.resolveTo(true);
  mock.registerBatch.and.resolveTo(true);
  return mock;
}

function createMockServerTimeService(): jasmine.SpyObj<ServerTimeService> {
  const mock = jasmine.createSpyObj<ServerTimeService>('ServerTimeService', ['getServerTime']);
  mock.getServerTime.and.resolveTo(new Date('2024-06-15T12:00:00.000Z'));
  return mock;
}

function createMockConfirmService(): jasmine.SpyObj<ConfirmService> {
  const mock = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['confirm']);
  mock.confirm.and.resolveTo(true);
  return mock;
}

function createMockPickerController(): jasmine.SpyObj<PickerController> {
  const pickerElement = {
    present: jasmine.createSpy('present').and.resolveTo(),
    dismiss: jasmine.createSpy('dismiss').and.resolveTo(true),
    onDidDismiss: jasmine.createSpy('onDidDismiss').and.resolveTo({ data: undefined, role: 'backdrop' }),
  } as unknown as HTMLIonPickerLegacyElement;

  const mock = jasmine.createSpyObj<PickerController>('PickerController', ['create', 'dismiss', 'getTop']);
  mock.create.and.resolveTo(pickerElement);
  return mock;
}

/** Access private/protected members for testing */
type PageInternals = {
  form: {
    controls: Record<string, { errors: Record<string, unknown> | null; value: unknown }>;
    get: (k: string) => {
      setValue: (v: string) => void;
      value: string;
      errors: Record<string, unknown> | null;
    };
    patchValue: (v: Record<string, unknown>) => void;
    getRawValue: () => Record<string, unknown>;
    reset: () => void;
    invalid: boolean;
  };
  sn: string;
  connectedSn: string;
  toLatinUpperCase: (v: string) => string;
};

function internals(page: AddUserPage): PageInternals {
  return page as unknown as PageInternals;
}

/** Fills the form with all valid required values */
function fillValidForm(page: AddUserPage): void {
  internals(page).form.patchValue({
    firstName: 'Marko',
    lastName: 'Markovic',
    streetName: 'Bulevar Kralja Aleksandra',
    homeNumber: '73',
    city: 'Beograd',
    postCode: '11000',
    phoneNumber: '+381601234567',
    warrantyStatus: 'in-warranty',
    dateOfPurchase: '15.06.2024',
  });
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AddUserPage', () => {
  let page: AddUserPage;
  let mockLookupService: jasmine.SpyObj<DeviceLookupService>;
  let mockRegistrationService: jasmine.SpyObj<DeviceRegistrationService>;
  let mockServerTimeService: jasmine.SpyObj<ServerTimeService>;
  let mockConfirmService: jasmine.SpyObj<ConfirmService>;
  let mockToastController: jasmine.SpyObj<ToastController>;
  let mockRouter: ReturnType<typeof createMockRouter>;
  let mockTransloco: jasmine.SpyObj<TranslocoService>;
  let mockPickerController: jasmine.SpyObj<PickerController>;

  function setupTestBed(sn = 'SN-TEST-001', connectedSn = ''): void {
    mockLookupService = createMockDeviceLookupService(buildDevice());
    mockRegistrationService = createMockRegistrationService();
    mockServerTimeService = createMockServerTimeService();
    mockConfirmService = createMockConfirmService();
    mockToastController = createMockToastController();
    mockRouter = createMockRouter();
    mockTransloco = createMockTranslocoService();
    mockPickerController = createMockPickerController();

    TestBed.configureTestingModule({
      providers: [
        AddUserPage,
        { provide: DeviceLookupService, useValue: mockLookupService },
        { provide: DeviceRegistrationService, useValue: mockRegistrationService },
        { provide: ServerTimeService, useValue: mockServerTimeService },
        { provide: ConfirmService, useValue: mockConfirmService },
        { provide: ToastController, useValue: mockToastController },
        { provide: PickerController, useValue: mockPickerController },
        { provide: TranslocoService, useValue: mockTransloco },
        { provide: ActivatedRoute, useValue: createMockActivatedRoute(sn, connectedSn) },
        { provide: Router, useValue: mockRouter },
      ],
    });

    page = TestBed.inject(AddUserPage);
  }

  beforeEach(() => {
    setupTestBed('SN-TEST-001', '');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // =========================================================================
  // Form construction
  // =========================================================================

  describe('Form construction', () => {
    it('TC-AU-01: form has all required fields', () => {
      const { form } = internals(page);
      expect(form.controls['firstName']).toBeDefined();
      expect(form.controls['lastName']).toBeDefined();
      expect(form.controls['streetName']).toBeDefined();
      expect(form.controls['homeNumber']).toBeDefined();
      expect(form.controls['city']).toBeDefined();
      expect(form.controls['postCode']).toBeDefined();
      expect(form.controls['phoneNumber']).toBeDefined();
      expect(form.controls['warrantyStatus']).toBeDefined();
      expect(form.controls['dateOfPurchase']).toBeDefined();
    });

    it('TC-AU-02: form is invalid when required field firstName is missing', () => {
      const { form } = internals(page);
      fillValidForm(page);
      form.get('firstName').setValue('');
      expect(form.invalid).toBeTrue();
    });

    it('TC-AU-03: form is invalid when required field lastName is missing', () => {
      const { form } = internals(page);
      fillValidForm(page);
      form.get('lastName').setValue('');
      expect(form.invalid).toBeTrue();
    });

    it('TC-AU-04: form is invalid when required field city is missing', () => {
      const { form } = internals(page);
      fillValidForm(page);
      form.get('city').setValue('');
      expect(form.invalid).toBeTrue();
    });

    it('TC-AU-05: phoneNumber field has required validator — errors when empty', () => {
      const { form } = internals(page);
      form.get('phoneNumber').setValue('');
      expect(form.get('phoneNumber').errors).not.toBeNull();
      expect(form.get('phoneNumber').errors?.['required']).toBeTruthy();
    });
  });

  // =========================================================================
  // showDateOfPurchase logic
  // =========================================================================

  describe('showDateOfPurchase', () => {
    it('TC-AU-06: visible when device not commissioning and warrantyStatus=in_warranty', () => {
      (mockLookupService as unknown as { device: Device }).device = buildDevice({ annualService: true, commissioning: false });
      internals(page).form.get('warrantyStatus').setValue('in-warranty');
      expect(page.showDateOfPurchase).toBeTrue();
    });

    it('TC-AU-07: hidden when warrantyStatus=out_of_warranty', () => {
      (mockLookupService as unknown as { device: Device }).device = buildDevice({ annualService: true, commissioning: false });
      internals(page).form.get('warrantyStatus').setValue('out-of-warranty');
      expect(page.showDateOfPurchase).toBeFalse();
    });

    it('TC-AU-08: hidden when device commissioning=true', () => {
      (mockLookupService as unknown as { device: Device }).device = buildDevice({ annualService: true, commissioning: true });
      internals(page).form.get('warrantyStatus').setValue('in-warranty');
      expect(page.showDateOfPurchase).toBeFalse();
    });

    it('TC-AU-09: hidden when warrantyStatus is empty (default state with null device)', () => {
      // BUG-08 FIXED: getter now explicitly returns false when device === null.
      (mockLookupService as unknown as { device: Device | null }).device = null;
      // warrantyStatus remains '' (default after reset)
      expect(page.showDateOfPurchase).toBeFalse();
    });

    it('TC-AU-09b: BUG-08 FIXED — hidden when device is null even with warrantyStatus=in_warranty', () => {
      // Before BUG-08 fix this returned true (because !null?.commissioning === true).
      // After fix: explicit null check returns false when device is not loaded.
      (mockLookupService as unknown as { device: Device | null }).device = null;
      internals(page).form.get('warrantyStatus').setValue('in-warranty');
      expect(page.showDateOfPurchase).toBeFalse();
    });
  });

  // =========================================================================
  // openDatePicker
  // =========================================================================

  describe('openDatePicker()', () => {
    it('TC-AU-10: calls PickerController.create', async () => {
      await page.openDatePicker();
      expect(mockPickerController.create).toHaveBeenCalledTimes(1);
    });

    it('TC-AU-11: picker columns include day, month and year', async () => {
      await page.openDatePicker();
      const createArgs = mockPickerController.create.calls.mostRecent().args[0] as {
        columns: Array<{ name: string }>;
      };
      const columnNames = createArgs.columns.map((c) => c.name);
      expect(columnNames).toContain('day');
      expect(columnNames).toContain('month');
      expect(columnNames).toContain('year');
    });

    it('TC-AU-12: month column has 12 options', async () => {
      await page.openDatePicker();
      const createArgs = mockPickerController.create.calls.mostRecent().args[0] as {
        columns: Array<{ name: string; options: unknown[] }>;
      };
      const monthCol = createArgs.columns.find((c) => c.name === 'month')!;
      expect(monthCol.options.length).toBe(12);
    });

    it('TC-AU-13: year column starts from year 2000', async () => {
      await page.openDatePicker();
      const createArgs = mockPickerController.create.calls.mostRecent().args[0] as {
        columns: Array<{ name: string; options: Array<{ value: number }> }>;
      };
      const yearCol = createArgs.columns.find((c) => c.name === 'year')!;
      expect(yearCol.options[0].value).toBe(2000);
    });

    it('TC-AU-14: confirm handler sets dateOfPurchase on form with zero-padded day and month', async () => {
      let capturedHandler: ((value: Record<string, { value: number }>) => void) | undefined;

      mockPickerController.create.and.callFake(async (opts?: { buttons?: Array<{ handler?: (v: Record<string, { value: number }>) => void }> }) => {
        capturedHandler = opts?.buttons?.[1]?.handler;
        return {
          present: jasmine.createSpy('present').and.resolveTo(),
        } as unknown as HTMLIonPickerLegacyElement;
      });

      await page.openDatePicker();

      capturedHandler!({ day: { value: 5 }, month: { value: 3 }, year: { value: 2023 } });

      expect(internals(page).form.get('dateOfPurchase').value).toBe('05.03.2023');
    });

    it('TC-AU-15: pre-existing dateOfPurchase is parsed for initial month selection', async () => {
      internals(page).form.get('dateOfPurchase').setValue('10.08.2021');

      await page.openDatePicker();

      const createArgs = mockPickerController.create.calls.mostRecent().args[0] as {
        columns: Array<{ name: string; selectedIndex: number }>;
      };
      const monthCol = createArgs.columns.find((c) => c.name === 'month')!;
      // month 8 → selectedIndex = 7 (0-based)
      expect(monthCol.selectedIndex).toBe(7);
    });
  });

  // =========================================================================
  // onSave — validation
  // =========================================================================

  describe('onSave() — validation', () => {
    it('TC-AU-16: shows warning toast and aborts when firstName is empty', async () => {
      fillValidForm(page);
      internals(page).form.get('firstName').setValue('');

      await page.onSave();

      expect(mockToastController.create).toHaveBeenCalledTimes(1);
      expect(mockToastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ color: 'warning' }),
      );
      expect(mockRegistrationService.register).not.toHaveBeenCalled();
    });

    it('TC-AU-17: shows warning toast and aborts when lastName is empty', async () => {
      fillValidForm(page);
      internals(page).form.get('lastName').setValue('');

      await page.onSave();

      expect(mockToastController.create).toHaveBeenCalledTimes(1);
      expect(mockRegistrationService.register).not.toHaveBeenCalled();
    });

    it('TC-AU-18: shows warning toast and aborts when phoneNumber is empty', async () => {
      fillValidForm(page);
      internals(page).form.get('phoneNumber').setValue('');

      await page.onSave();

      expect(mockToastController.create).toHaveBeenCalledTimes(1);
      expect(mockRegistrationService.register).not.toHaveBeenCalled();
    });

    it('TC-AU-19: shows warning toast and aborts when warrantyStatus is empty', async () => {
      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('');

      await page.onSave();

      expect(mockToastController.create).toHaveBeenCalledTimes(1);
      expect(mockRegistrationService.register).not.toHaveBeenCalled();
    });

    it('TC-AU-20: aborts without save when device is null', async () => {
      fillValidForm(page);
      (mockLookupService as unknown as { device: Device | null }).device = null;

      await page.onSave();

      expect(mockRegistrationService.register).not.toHaveBeenCalled();
      expect(mockRegistrationService.registerBatch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // onSave — data preparation
  // =========================================================================

  describe('onSave() — data preparation', () => {
    beforeEach(() => {
      (mockLookupService as unknown as { device: Device }).device = buildDevice({
        commissioning: false,
        annualService: false,
      });
    });

    it('TC-AU-21: prepares firstNameSrch as toLatinUpperCase of firstName', async () => {
      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('out-of-warranty');
      internals(page).form.get('firstName').setValue('Marko');

      await page.onSave();

      const data = mockRegistrationService.register.calls.mostRecent().args[2] as Record<string, unknown>;
      expect(data['firstNameSrch']).toBe('MARKO');
    });

    it('TC-AU-22: prepares lastNameSrch as toLatinUpperCase of lastName', async () => {
      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('out-of-warranty');
      internals(page).form.get('lastName').setValue('Markovic');

      await page.onSave();

      const data = mockRegistrationService.register.calls.mostRecent().args[2] as Record<string, unknown>;
      expect(data['lastNameSrch']).toBe('MARKOVIC');
    });

    it('TC-AU-23: out_of_warranty — dateOfPurchase deleted from data', async () => {
      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('out-of-warranty');

      await page.onSave();

      const data = mockRegistrationService.register.calls.mostRecent().args[2] as Record<string, unknown>;
      expect('dateOfPurchase' in data).toBeFalse();
    });

    it('TC-AU-24: commissioning device — dateOfPurchase set to server time Date', async () => {
      const serverDate = new Date('2024-06-15T12:00:00.000Z');
      mockServerTimeService.getServerTime.and.resolveTo(serverDate);
      (mockLookupService as unknown as { device: Device }).device = buildDevice({
        commissioning: true,
        annualService: false,
      });
      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('in-warranty');

      await page.onSave();

      const data = mockRegistrationService.register.calls.mostRecent().args[2] as Record<string, unknown>;
      expect(data['dateOfPurchase']).toEqual(serverDate);
    });

    it('TC-AU-25: manual date input — parsed Date object stored in data', async () => {
      (mockLookupService as unknown as { device: Device }).device = buildDevice({
        commissioning: false,
        annualService: true,
      });
      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('in-warranty');
      internals(page).form.get('dateOfPurchase').setValue('15.06.2023');

      await page.onSave();

      const data = mockRegistrationService.register.calls.mostRecent().args[2] as Record<string, unknown>;
      const storedDate = data['dateOfPurchase'] as Date;
      expect(storedDate instanceof Date).toBeTrue();
      expect(storedDate.getFullYear()).toBe(2023);
      expect(storedDate.getMonth()).toBe(5); // June = index 5
      expect(storedDate.getDate()).toBe(15);
    });

    it('TC-AU-26: device without annualService — callAccepted deleted from data', async () => {
      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('out-of-warranty');

      await page.onSave();

      const data = mockRegistrationService.register.calls.mostRecent().args[2] as Record<string, unknown>;
      expect('callAccepted' in data).toBeFalse();
    });
  });

  // =========================================================================
  // onSave — ConfirmService
  // =========================================================================

  describe('onSave() — ConfirmService interaction', () => {
    beforeEach(() => {
      (mockLookupService as unknown as { device: Device }).device = buildDevice({
        commissioning: false,
        annualService: false,
      });
    });

    it('TC-AU-27: ConfirmService.confirm called before register', async () => {
      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('out-of-warranty');

      await page.onSave();

      expect(mockConfirmService.confirm).toHaveBeenCalledBefore(mockRegistrationService.register);
    });

    it('TC-AU-28: cancel from confirm dialog — register not called', async () => {
      mockConfirmService.confirm.and.resolveTo(false);
      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('out-of-warranty');

      await page.onSave();

      expect(mockRegistrationService.register).not.toHaveBeenCalled();
      expect(mockRegistrationService.registerBatch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // onSave — registration dispatch
  // =========================================================================

  describe('onSave() — registration dispatch', () => {
    it('TC-AU-29: single device (no connectedSn) — register called once, registerBatch not called', async () => {
      TestBed.resetTestingModule();
      setupTestBed('SN-MAIN-001', '');
      (mockLookupService as unknown as { device: Device }).device = buildDevice({
        commissioning: false,
        annualService: false,
      });
      page.ionViewWillEnter();

      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('out-of-warranty');

      await page.onSave();

      expect(mockRegistrationService.register).toHaveBeenCalledTimes(1);
      expect(mockRegistrationService.registerBatch).not.toHaveBeenCalled();
    });

    it('TC-AU-30: connected device present — registerBatch called, register not called', async () => {
      TestBed.resetTestingModule();
      setupTestBed('SN-MAIN-002', 'SN-CONN-002');
      (mockLookupService as unknown as { device: Device }).device = buildDevice({
        commissioning: false,
        annualService: false,
      });
      page.ionViewWillEnter();

      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('out-of-warranty');

      await page.onSave();

      expect(mockRegistrationService.registerBatch).toHaveBeenCalledTimes(1);
      expect(mockRegistrationService.register).not.toHaveBeenCalled();
    });

    it('TC-AU-31: registerBatch receives two entries with cross-referenced connectedDevice SNs', async () => {
      TestBed.resetTestingModule();
      setupTestBed('SN-MAIN-003', 'SN-CONN-003');
      (mockLookupService as unknown as { device: Device }).device = buildDevice({
        commissioning: false,
        annualService: false,
      });
      page.ionViewWillEnter();

      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('out-of-warranty');

      await page.onSave();

      const batchEntries = mockRegistrationService.registerBatch.calls.mostRecent().args[0] as Array<{
        sn: string;
        dynamicFields: Record<string, unknown>;
      }>;
      expect(batchEntries.length).toBe(2);
      expect(batchEntries[0].sn).toBe('SN-MAIN-003');
      expect(batchEntries[0].dynamicFields['connectedDevice']).toBe('SN-CONN-003');
      expect(batchEntries[1].sn).toBe('SN-CONN-003');
      expect(batchEntries[1].dynamicFields['connectedDevice']).toBe('SN-MAIN-003');
    });
  });

  // =========================================================================
  // onSave — success / error paths
  // =========================================================================

  describe('onSave() — success and error', () => {
    it('TC-AU-32: success — navigates to /device-management/:sn', async () => {
      TestBed.resetTestingModule();
      setupTestBed('SN-SUCCESS-001', '');
      (mockLookupService as unknown as { device: Device }).device = buildDevice({
        commissioning: false,
        annualService: false,
      });
      mockRegistrationService.register.and.resolveTo(true);
      page.ionViewWillEnter();

      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('out-of-warranty');

      await page.onSave();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/device-management', 'SN-SUCCESS-001']);
    });

    it('TC-AU-33: success — shows success toast', async () => {
      (mockLookupService as unknown as { device: Device }).device = buildDevice({
        commissioning: false,
        annualService: false,
      });
      mockRegistrationService.register.and.resolveTo(true);
      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('out-of-warranty');

      await page.onSave();

      expect(mockToastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ color: 'success' }),
      );
    });

    it('TC-AU-34: error from register — shows danger toast and does not navigate', async () => {
      (mockLookupService as unknown as { device: Device }).device = buildDevice({
        commissioning: false,
        annualService: false,
      });
      mockRegistrationService.register.and.resolveTo(false);
      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('out-of-warranty');

      await page.onSave();

      expect(mockToastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ color: 'danger' }),
      );
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // toLatinUpperCase
  // =========================================================================

  describe('toLatinUpperCase()', () => {
    function callToLatinUpperCase(value: string): string {
      return internals(page).toLatinUpperCase(value);
    }

    it('TC-AU-35: transliterates Cyrillic letters to Latin uppercase — Марко → MARKO', () => {
      expect(callToLatinUpperCase('Марко')).toBe('MARKO');
    });

    it('TC-AU-36: converts lowercase Latin diacritics š→S and č→C', () => {
      expect(callToLatinUpperCase('šč')).toBe('SC');
    });

    it('TC-AU-37: converts uppercase Latin diacritics Š→S and Č→C', () => {
      expect(callToLatinUpperCase('ŠČ')).toBe('SC');
    });

    it('TC-AU-38: transliterates Cyrillic Никола → NIKOLA', () => {
      expect(callToLatinUpperCase('Никола')).toBe('NIKOLA');
    });

    it('TC-AU-39: empty string returns empty string', () => {
      expect(callToLatinUpperCase('')).toBe('');
    });

    it('TC-AU-40: plain Latin letters are uppercased', () => {
      expect(callToLatinUpperCase('marko')).toBe('MARKO');
    });
  });

  // =========================================================================
  // Lifecycle — ionViewWillEnter
  // =========================================================================

  describe('ionViewWillEnter()', () => {
    it('TC-AU-41: extracts SN from route paramMap and stores in sn property', () => {
      TestBed.resetTestingModule();
      setupTestBed('SN-LIFECYCLE-001', '');

      page.ionViewWillEnter();

      expect(internals(page).sn).toBe('SN-LIFECYCLE-001');
    });

    it('TC-AU-42: extracts connectedSn from queryParamMap when present', () => {
      TestBed.resetTestingModule();
      setupTestBed('SN-LIFECYCLE-002', 'SN-CONN-LIFECYCLE-002');

      page.ionViewWillEnter();

      expect(internals(page).connectedSn).toBe('SN-CONN-LIFECYCLE-002');
    });

    it('TC-AU-43: connectedSn defaults to empty string when not in queryParams', () => {
      TestBed.resetTestingModule();
      setupTestBed('SN-LIFECYCLE-003', '');

      page.ionViewWillEnter();

      expect(internals(page).connectedSn).toBe('');
    });

    it('TC-AU-44: form is reset on ionViewWillEnter', () => {
      internals(page).form.get('firstName').setValue('Prethodni');

      page.ionViewWillEnter();

      expect(internals(page).form.get('firstName').value).toBe('');
    });
  });

  // =========================================================================
  // Server time error
  // =========================================================================

  describe('Server time error handling', () => {
    it('TC-AU-45: server time unavailable on commissioning device — shows danger toast and aborts', async () => {
      mockServerTimeService.getServerTime.and.resolveTo(null);
      (mockLookupService as unknown as { device: Device }).device = buildDevice({
        commissioning: true,
        annualService: false,
      });
      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('in-warranty');

      await page.onSave();

      expect(mockToastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ color: 'danger' }),
      );
      expect(mockRegistrationService.register).not.toHaveBeenCalled();
      expect(mockRegistrationService.registerBatch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Edge cases (bonus)
  // =========================================================================

  describe('Edge cases', () => {
    beforeEach(() => {
      (mockLookupService as unknown as { device: Device }).device = buildDevice({
        commissioning: false,
        annualService: false,
      });
    });

    it('TC-AU-46: special characters in city and street are stored as-is', async () => {
      fillValidForm(page);
      internals(page).form.get('city').setValue('Нови Сад');
      internals(page).form.get('streetName').setValue('Трг слободе');
      internals(page).form.get('warrantyStatus').setValue('out-of-warranty');

      await page.onSave();

      const data = mockRegistrationService.register.calls.mostRecent().args[2] as Record<string, unknown>;
      expect(data['city']).toBe('Нови Сад');
      expect(data['streetName']).toBe('Трг слободе');
    });

    it('TC-AU-47: long phone number is stored without truncation', async () => {
      fillValidForm(page);
      internals(page).form.get('phoneNumber').setValue('+38160123456789012345');
      internals(page).form.get('warrantyStatus').setValue('out-of-warranty');

      await page.onSave();

      const data = mockRegistrationService.register.calls.mostRecent().args[2] as Record<string, unknown>;
      expect(data['phoneNumber']).toBe('+38160123456789012345');
    });

    it('TC-AU-48: out_of_warranty with empty dateOfPurchase — save succeeds and dateOfPurchase absent from data', async () => {
      fillValidForm(page);
      internals(page).form.get('warrantyStatus').setValue('out-of-warranty');
      internals(page).form.get('dateOfPurchase').setValue('');

      await page.onSave();

      const data = mockRegistrationService.register.calls.mostRecent().args[2] as Record<string, unknown>;
      expect('dateOfPurchase' in data).toBeFalse();
      expect(mockRouter.navigate).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // EXPANSION: toLatinUpperCase — exhaustive Cyrillic alphabet matrix
  // =========================================================================

  describe('toLatinUpperCase() — Cyrillic uppercase letters exhaustive', () => {
    function tluc(value: string): string {
      return internals(page).toLatinUpperCase(value);
    }

    // Uppercase Cyrillic → Latin
    const uppercaseCyrillicMap: Array<[string, string]> = [
      ['А', 'A'], ['Б', 'B'], ['В', 'V'], ['Г', 'G'], ['Д', 'D'],
      ['Ђ', 'DJ'], ['Е', 'E'], ['Ж', 'Z'], ['З', 'Z'], ['И', 'I'],
      ['Ј', 'J'], ['К', 'K'], ['Л', 'L'], ['Љ', 'LJ'], ['М', 'M'],
      ['Н', 'N'], ['Њ', 'NJ'], ['О', 'O'], ['П', 'P'], ['Р', 'R'],
      ['С', 'S'], ['Т', 'T'], ['Ћ', 'C'], ['У', 'U'], ['Ф', 'F'],
      ['Х', 'H'], ['Ц', 'C'], ['Ч', 'C'], ['Џ', 'DZ'], ['Ш', 'S'],
    ];

    uppercaseCyrillicMap.forEach(([cyr, lat]) => {
      it(`EXP-AU-CYR-UP: should convert uppercase "${cyr}" to "${lat}"`, () => {
        expect(tluc(cyr)).toBe(lat);
      });
    });

    // Lowercase Cyrillic → Latin uppercase
    const lowercaseCyrillicMap: Array<[string, string]> = [
      ['а', 'A'], ['б', 'B'], ['в', 'V'], ['г', 'G'], ['д', 'D'],
      ['ђ', 'DJ'], ['е', 'E'], ['ж', 'Z'], ['з', 'Z'], ['и', 'I'],
      ['ј', 'J'], ['к', 'K'], ['л', 'L'], ['љ', 'LJ'], ['м', 'M'],
      ['н', 'N'], ['њ', 'NJ'], ['о', 'O'], ['п', 'P'], ['р', 'R'],
      ['с', 'S'], ['т', 'T'], ['ћ', 'C'], ['у', 'U'], ['ф', 'F'],
      ['х', 'H'], ['ц', 'C'], ['ч', 'C'], ['џ', 'DZ'], ['ш', 'S'],
    ];

    lowercaseCyrillicMap.forEach(([cyr, lat]) => {
      it(`EXP-AU-CYR-LO: should convert lowercase "${cyr}" to "${lat}"`, () => {
        expect(tluc(cyr)).toBe(lat);
      });
    });
  });

  describe('toLatinUpperCase() — Latin diacritics exhaustive', () => {
    function tluc(value: string): string {
      return internals(page).toLatinUpperCase(value);
    }

    const diacriticMap: Array<[string, string]> = [
      ['š', 'S'], ['Š', 'S'],
      ['č', 'C'], ['Č', 'C'],
      ['ć', 'C'], ['Ć', 'C'],
      ['đ', 'DJ'], ['Đ', 'DJ'],
      ['ž', 'Z'], ['Ž', 'Z'],
    ];

    diacriticMap.forEach(([diac, expected]) => {
      it(`EXP-AU-DIAC: should convert diacritic "${diac}" to "${expected}"`, () => {
        expect(tluc(diac)).toBe(expected);
      });
    });
  });

  describe('toLatinUpperCase() — word/name contexts', () => {
    function tluc(value: string): string {
      return internals(page).toLatinUpperCase(value);
    }

    const wordContexts: Array<[string, string]> = [
      // pure Cyrillic names
      ['Марко', 'MARKO'],
      ['Никола', 'NIKOLA'],
      ['Јован', 'JOVAN'],
      ['Александар', 'ALEKSANDAR'],
      ['Милица', 'MILICA'],
      ['Наташа', 'NATASA'],
      ['Живко', 'ZIVKO'],
      ['Ђорђе', 'DJORDJE'],
      ['Љубица', 'LJUBICA'],
      ['Њемира', 'NJEMIRA'],
      ['Цвета', 'CVETA'],
      ['Чедомир', 'CEDOMIR'],
      ['Џавид', 'DZAVID'],
      ['Ћирило', 'CIRILO'],
      // surname with uppercase Cyrillic
      ['МАРКОВИЋ', 'MARKOVIC'],
      ['НИКОЛИЋ', 'NIKOLIC'],
      // mixed Cyrillic + digit (digit pass-through)
      ['Лука1', 'LUKA1'],
      ['Тест123', 'TEST123'],
      // spaces preserved
      ['Нови Сад', 'NOVI SAD'],
      ['Трг слободе', 'TRG SLOBODE'],
      // diacritic names
      ['Šimić', 'SIMIC'],
      ['Čović', 'COVIC'],
      ['Žunić', 'ZUNIC'],
      ['Đorić', 'DJORIC'],
      ['Ćurić', 'CURIC'],
      // pure Latin
      ['marko', 'MARKO'],
      ['MARKO', 'MARKO'],
      ['Ana', 'ANA'],
      // empty
      ['', ''],
      // single space
      [' ', ' '],
    ];

    wordContexts.forEach(([input, expected]) => {
      it(`EXP-AU-WORD: "${input}" → "${expected}"`, () => {
        expect(tluc(input)).toBe(expected);
      });
    });
  });

  describe('toLatinUpperCase() — mixed Cyrillic + Latin input', () => {
    function tluc(value: string): string {
      return internals(page).toLatinUpperCase(value);
    }

    const mixedCases: Array<[string, string]> = [
      ['Маrko', 'MARKO'],    // Cyrillic М + Latin arko
      ['МARKо', 'MARKO'],    // Cyrillic М и о, rest Latin
      ['АnaS', 'ANAS'],
      ['Šарко', 'SARKO'],    // Latin Š + Cyrillic арко
      ['čаша', 'CASA'],      // Latin č + Cyrillic аша
    ];

    mixedCases.forEach(([input, expected]) => {
      it(`EXP-AU-MIXED: "${input}" → "${expected}"`, () => {
        expect(tluc(input)).toBe(expected);
      });
    });
  });

  describe('toLatinUpperCase() — numbers, symbols, edge inputs', () => {
    function tluc(value: string): string {
      return internals(page).toLatinUpperCase(value);
    }

    it('EXP-AU-EDGE-01: digits pass through unchanged', () => {
      expect(tluc('12345')).toBe('12345');
    });

    it('EXP-AU-EDGE-02: hyphen passes through unchanged', () => {
      expect(tluc('abc-def')).toBe('ABC-DEF');
    });

    it('EXP-AU-EDGE-03: period passes through unchanged', () => {
      expect(tluc('a.b')).toBe('A.B');
    });

    it('EXP-AU-EDGE-04: plus sign passes through unchanged', () => {
      expect(tluc('+381')).toBe('+381');
    });

    it('EXP-AU-EDGE-05: apostrophe passes through unchanged', () => {
      expect(tluc("o'Brien")).toBe("O'BRIEN");
    });

    it('EXP-AU-EDGE-06: long all-Cyrillic surname', () => {
      expect(tluc('Достојевски')).toBe('DOSTOJEVSKI');
    });

    it('EXP-AU-EDGE-07: all-diacritic string', () => {
      expect(tluc('šćžđč')).toBe('SCZDJ' + 'C');
      // š→S, ć→C, ž→Z, đ→DJ, č→C → SCZDJC
      expect(tluc('šćžđč')).toBe('SCZDJC');
    });

    it('EXP-AU-EDGE-08: single Cyrillic Ш', () => {
      expect(tluc('Ш')).toBe('S');
    });

    it('EXP-AU-EDGE-09: single Cyrillic Џ', () => {
      expect(tluc('Џ')).toBe('DZ');
    });

    it('EXP-AU-EDGE-10: single Cyrillic Љ', () => {
      expect(tluc('Љ')).toBe('LJ');
    });

    it('EXP-AU-EDGE-11: single Cyrillic Њ', () => {
      expect(tluc('Њ')).toBe('NJ');
    });

    it('EXP-AU-EDGE-12: single Cyrillic Ђ', () => {
      expect(tluc('Ђ')).toBe('DJ');
    });

    it('EXP-AU-EDGE-13: whitespace-only string returns same whitespace uppercased', () => {
      expect(tluc('   ')).toBe('   ');
    });

    it('EXP-AU-EDGE-14: tab character passes through', () => {
      expect(tluc('\t')).toBe('\t');
    });
  });

  // =========================================================================
  // EXPANSION: openDatePicker — month × year combinations
  // =========================================================================

  describe('openDatePicker() — month/year pre-selection matrix', () => {
    const monthScenarios: Array<{ dateValue: string; expectedMonthIndex: number; label: string }> = [
      { dateValue: '01.01.2020', expectedMonthIndex: 0, label: 'January' },
      { dateValue: '15.02.2021', expectedMonthIndex: 1, label: 'February' },
      { dateValue: '10.03.2022', expectedMonthIndex: 2, label: 'March' },
      { dateValue: '20.04.2020', expectedMonthIndex: 3, label: 'April' },
      { dateValue: '05.05.2023', expectedMonthIndex: 4, label: 'May' },
      { dateValue: '30.06.2019', expectedMonthIndex: 5, label: 'June' },
      { dateValue: '07.07.2024', expectedMonthIndex: 6, label: 'July' },
      { dateValue: '18.08.2000', expectedMonthIndex: 7, label: 'August' },
      { dateValue: '11.09.2010', expectedMonthIndex: 8, label: 'September' },
      { dateValue: '25.10.2015', expectedMonthIndex: 9, label: 'October' },
      { dateValue: '03.11.2018', expectedMonthIndex: 10, label: 'November' },
      { dateValue: '31.12.2024', expectedMonthIndex: 11, label: 'December' },
    ];

    monthScenarios.forEach(({ dateValue, expectedMonthIndex, label }) => {
      it(`EXP-AU-DATEPICKER: pre-set date ${dateValue} selects ${label} (index ${expectedMonthIndex})`, async () => {
        internals(page).form.get('dateOfPurchase').setValue(dateValue);

        await page.openDatePicker();

        const createArgs = mockPickerController.create.calls.mostRecent().args[0] as {
          columns: Array<{ name: string; selectedIndex: number }>;
        };
        const monthCol = createArgs.columns.find((c) => c.name === 'month')!;
        expect(monthCol.selectedIndex).toBe(expectedMonthIndex);
      });
    });

    const yearScenarios: Array<{ dateValue: string; startYear: number; label: string }> = [
      { dateValue: '01.01.2000', startYear: 2000, label: '2000 → index 0' },
      { dateValue: '15.06.2010', startYear: 2000, label: '2010 → index 10' },
      { dateValue: '20.12.2020', startYear: 2000, label: '2020 → index 20' },
      { dateValue: '01.03.2024', startYear: 2000, label: '2024 → index 24' },
      { dateValue: '31.12.2025', startYear: 2000, label: '2025 → index 25' },
    ];

    yearScenarios.forEach(({ dateValue, startYear, label }) => {
      it(`EXP-AU-DATEPICKER-YEAR: date ${dateValue} selects year correctly (${label})`, async () => {
        internals(page).form.get('dateOfPurchase').setValue(dateValue);

        await page.openDatePicker();

        const createArgs = mockPickerController.create.calls.mostRecent().args[0] as {
          columns: Array<{ name: string; selectedIndex: number; options: Array<{ value: number }> }>;
        };
        const yearCol = createArgs.columns.find((c) => c.name === 'year')!;
        const [, , yearStr] = dateValue.split('.');
        const yearNum = parseInt(yearStr, 10);
        const expectedIndex = yearNum - startYear;
        expect(yearCol.selectedIndex).toBe(expectedIndex);
      });
    });

    // Confirm handler — zero-pad matrix
    const confirmScenarios: Array<{ day: number; month: number; year: number; expected: string }> = [
      { day: 1, month: 1, year: 2020, expected: '01.01.2020' },
      { day: 5, month: 3, year: 2023, expected: '05.03.2023' },
      { day: 15, month: 12, year: 2021, expected: '15.12.2021' },
      { day: 28, month: 2, year: 2024, expected: '28.02.2024' },
      { day: 29, month: 2, year: 2024, expected: '29.02.2024' },
      { day: 30, month: 6, year: 2000, expected: '30.06.2000' },
      { day: 31, month: 12, year: 2025, expected: '31.12.2025' },
      { day: 9, month: 9, year: 2019, expected: '09.09.2019' },
    ];

    confirmScenarios.forEach(({ day, month, year, expected }) => {
      it(`EXP-AU-DATEPICKER-CONFIRM: day=${day} month=${month} year=${year} → "${expected}"`, async () => {
        let capturedHandler: ((value: Record<string, { value: number }>) => void) | undefined;

        mockPickerController.create.and.callFake(async (opts?: { buttons?: Array<{ handler?: (v: Record<string, { value: number }>) => void }> }) => {
          capturedHandler = opts?.buttons?.[1]?.handler;
          return {
            present: jasmine.createSpy('present').and.resolveTo(),
          } as unknown as HTMLIonPickerLegacyElement;
        });

        await page.openDatePicker();
        capturedHandler!({ day: { value: day }, month: { value: month }, year: { value: year } });

        expect(internals(page).form.get('dateOfPurchase').value).toBe(expected);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: validateForm — each required field missing individually
  // =========================================================================

  describe('validateForm() — each required field missing triggers warning toast', () => {
    const requiredFields: Array<{ field: string; label: string }> = [
      { field: 'firstName', label: 'firstName empty' },
      { field: 'lastName', label: 'lastName empty' },
      { field: 'streetName', label: 'streetName empty' },
      { field: 'homeNumber', label: 'homeNumber empty' },
      { field: 'city', label: 'city empty' },
      { field: 'postCode', label: 'postCode empty' },
      { field: 'phoneNumber', label: 'phoneNumber empty' },
      { field: 'warrantyStatus', label: 'warrantyStatus empty' },
    ];

    beforeEach(() => {
      (mockLookupService as unknown as { device: Device }).device = buildDevice({
        commissioning: false,
        annualService: false,
      });
    });

    requiredFields.forEach(({ field, label }) => {
      it(`EXP-AU-VALIDATE: missing ${label} → warning toast shown, register NOT called`, async () => {
        fillValidForm(page);
        internals(page).form.get(field).setValue('');

        await page.onSave();

        expect(mockToastController.create).toHaveBeenCalledWith(
          jasmine.objectContaining({ color: 'warning' }),
        );
        expect(mockRegistrationService.register).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: form field — individual valid value sets
  // =========================================================================

  describe('form field valid values — each field with various inputs', () => {
    const firstNameValues = [
      'Ana', 'Milena', 'Jovana', 'Aleksandra', 'Dragana',
      'Biljana', 'Svetlana', 'Gordana', 'Tatjana', 'Lidija',
      'Mirjana', 'Vesna', 'Branka', 'Slavica', 'Radmila',
    ];

    firstNameValues.forEach((name) => {
      it(`EXP-AU-FNAME: firstName="${name}" is valid`, () => {
        internals(page).form.get('firstName').setValue(name);
        const ctrl = internals(page).form.get('firstName');
        expect(ctrl.errors).toBeNull();
      });
    });

    const lastNameValues = [
      'Jovanovic', 'Petrovic', 'Nikolic', 'Markovic', 'Stojanovic',
      'Ilic', 'Pavlovic', 'Radovanovic', 'Simic', 'Milovanovic',
      'Savic', 'Milosevic', 'Jankovic', 'Stankovic', 'Jovic',
    ];

    lastNameValues.forEach((name) => {
      it(`EXP-AU-LNAME: lastName="${name}" is valid`, () => {
        internals(page).form.get('lastName').setValue(name);
        const ctrl = internals(page).form.get('lastName');
        expect(ctrl.errors).toBeNull();
      });
    });

    const cityValues = [
      'Beograd', 'Novi Sad', 'Nis', 'Kragujevac', 'Subotica',
      'Zrenjanin', 'Pancevo', 'Cacak', 'Leskovac', 'Smederevo',
      'Valjevo', 'Vranje', 'Sabac', 'Uzice', 'Pozarevac',
    ];

    cityValues.forEach((city) => {
      it(`EXP-AU-CITY: city="${city}" is valid`, () => {
        internals(page).form.get('city').setValue(city);
        const ctrl = internals(page).form.get('city');
        expect(ctrl.errors).toBeNull();
      });
    });

    const phoneNumbers = [
      '+381601234567', '+381641234567', '+381691234567',
      '+381611234567', '+381621234567', '+381631234567',
      '0601234567', '0641234567', '0691234567',
      '0611234567', '0621234567', '0631234567',
    ];

    phoneNumbers.forEach((phone) => {
      it(`EXP-AU-PHONE: phoneNumber="${phone}" is valid (no error)`, () => {
        internals(page).form.get('phoneNumber').setValue(phone);
        const ctrl = internals(page).form.get('phoneNumber');
        expect(ctrl.errors).toBeNull();
      });
    });

    const postCodes = ['11000', '21000', '18000', '34000', '24000', '23000', '26000', '32000', '16000', '11080'];

    postCodes.forEach((code) => {
      it(`EXP-AU-POSTCODE: postCode="${code}" is valid`, () => {
        internals(page).form.get('postCode').setValue(code);
        const ctrl = internals(page).form.get('postCode');
        expect(ctrl.errors).toBeNull();
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: warrantyStatus × commissioning matrix
  // =========================================================================

  describe('showDateOfPurchase — warrantyStatus × commissioning matrix', () => {
    const scenarios: Array<{
      warrantyStatus: string;
      commissioning: boolean;
      expected: boolean;
      label: string;
    }> = [
      { warrantyStatus: 'in-warranty', commissioning: false, expected: true, label: 'in_warranty non-commissioning → show' },
      { warrantyStatus: 'in-warranty', commissioning: true, expected: false, label: 'in_warranty commissioning → hide' },
      { warrantyStatus: 'out-of-warranty', commissioning: false, expected: false, label: 'out_of_warranty non-commissioning → hide' },
      { warrantyStatus: 'out-of-warranty', commissioning: true, expected: false, label: 'out_of_warranty commissioning → hide' },
      { warrantyStatus: '', commissioning: false, expected: false, label: 'empty status non-commissioning → hide' },
      { warrantyStatus: '', commissioning: true, expected: false, label: 'empty status commissioning → hide' },
      { warrantyStatus: 'unknown_value', commissioning: false, expected: false, label: 'unknown status → hide' },
      { warrantyStatus: 'unknown_value', commissioning: true, expected: false, label: 'unknown status commissioning → hide' },
    ];

    scenarios.forEach(({ warrantyStatus, commissioning, expected, label }) => {
      it(`EXP-AU-SHOWDOP: ${label}`, () => {
        (mockLookupService as unknown as { device: Device }).device = buildDevice({ commissioning });
        internals(page).form.get('warrantyStatus').setValue(warrantyStatus);

        expect(page.showDateOfPurchase).toBe(expected);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: onSave — warrantyStatus variants on non-commissioning device
  // =========================================================================

  describe('onSave() — warrantyStatus data handling matrix', () => {
    beforeEach(() => {
      (mockLookupService as unknown as { device: Device }).device = buildDevice({
        commissioning: false,
        annualService: false,
      });
    });

    const warrantyVariants: Array<{
      status: string;
      dateOfPurchase: string;
      label: string;
      expectDateInData: boolean;
      expectDateAsDate: boolean;
    }> = [
      { status: 'out-of-warranty', dateOfPurchase: '', label: 'out_of_warranty empty date', expectDateInData: false, expectDateAsDate: false },
      { status: 'out-of-warranty', dateOfPurchase: '01.01.2020', label: 'out_of_warranty with date', expectDateInData: false, expectDateAsDate: false },
      { status: 'in-warranty', dateOfPurchase: '15.06.2024', label: 'in_warranty with date', expectDateInData: true, expectDateAsDate: true },
      { status: 'in-warranty', dateOfPurchase: '01.01.2020', label: 'in_warranty early date', expectDateInData: true, expectDateAsDate: true },
      { status: 'in-warranty', dateOfPurchase: '31.12.2025', label: 'in_warranty late date', expectDateInData: true, expectDateAsDate: true },
    ];

    warrantyVariants.forEach(({ status, dateOfPurchase, label, expectDateInData, expectDateAsDate }) => {
      it(`EXP-AU-SAVE-WARRANTY: ${label}`, async () => {
        fillValidForm(page);
        internals(page).form.get('warrantyStatus').setValue(status);
        internals(page).form.get('dateOfPurchase').setValue(dateOfPurchase);

        await page.onSave();

        if (mockRegistrationService.register.calls.any()) {
          const data = mockRegistrationService.register.calls.mostRecent().args[2] as Record<string, unknown>;
          if (expectDateInData && expectDateAsDate) {
            expect(data['dateOfPurchase']).toBeInstanceOf(Date);
          } else if (!expectDateInData) {
            expect('dateOfPurchase' in data).toBeFalse();
          }
        }
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: connectedSn registration — various SN formats
  // =========================================================================

  describe('onSave() — connectedSn registration with various SN formats', () => {
    const connectedSnCases: Array<{ mainSn: string; connectedSn: string; label: string }> = [
      { mainSn: 'GAS1234567890', connectedSn: 'HP1234567890', label: 'GAS + HP serial numbers' },
      { mainSn: 'SN-001', connectedSn: 'SN-002', label: 'simple hyphenated SNs' },
      { mainSn: 'ABCDE12345', connectedSn: 'FGHIJ67890', label: 'alphanumeric SNs' },
      { mainSn: '123456', connectedSn: '789012', label: 'numeric-only SNs' },
      { mainSn: 'SN_001_MAIN', connectedSn: 'SN_001_CONN', label: 'underscore SNs' },
      { mainSn: 'A'.repeat(13), connectedSn: 'B'.repeat(13), label: '13-char SNs' },
    ];

    connectedSnCases.forEach(({ mainSn, connectedSn, label }) => {
      it(`EXP-AU-CONNECTED: ${label} → registerBatch called with both SNs`, async () => {
        TestBed.resetTestingModule();
        setupTestBed(mainSn, connectedSn);
        (mockLookupService as unknown as { device: Device }).device = buildDevice({
          commissioning: false,
          annualService: false,
        });
        fillValidForm(page);
        internals(page).form.get('warrantyStatus').setValue('out-of-warranty');
        internals(page).sn = mainSn;
        internals(page).connectedSn = connectedSn;

        await page.onSave();

        expect(mockRegistrationService.registerBatch).toHaveBeenCalledWith(
          jasmine.arrayContaining([
            jasmine.objectContaining({ sn: mainSn }),
            jasmine.objectContaining({ sn: connectedSn }),
          ]),
        );
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: toLatinUpperCase — full sentence parameterization
  // =========================================================================

  describe('toLatinUpperCase() — full Cyrillic sentences', () => {
    function tluc(value: string): string {
      return internals(page).toLatinUpperCase(value);
    }

    const sentenceCases: Array<[string, string]> = [
      ['Добар дан', 'DOBAR DAN'],
      ['Хвала лепо', 'HVALA LEPO'],
      ['Лаку ноћ', 'LAKU NOC'],
      ['Добро јутро', 'DOBRO JUTRO'],
      ['Добро вече', 'DOBRO VECE'],
      ['Срећан Божић', 'SRECAN BOZIC'],
      ['Честитам', 'CESTITAM'],
      ['Волим те', 'VOLIM TE'],
      ['Мир и љубав', 'MIR I LJUBAV'],
      ['Здраво свима', 'ZDRAVO SVIMA'],
      ['Нови Сад је леп', 'NOVI SAD JE LEP'],
      ['Бела кућа', 'BELA KUCA'],
      ['Никад не кажи никад', 'NIKAD NE KAZI NIKAD'],
      ['Живео Дунав', 'ZIVEO DUNAV'],
      ['Шума и вода', 'SUMA I VODA'],
      ['Чоколада', 'COKOLADA'],
      ['Ђаво плаче', 'DJAVO PLACE'],
      ['Љиљана пева', 'LJILJANA PEVA'],
      ['Џамија у граду', 'DZAMIJA U GRADU'],
      ['Ћирилица и латиница', 'CIRILICA I LATINICA'],
    ];

    sentenceCases.forEach(([input, expected]) => {
      it(`EXP-AU-SENTENCE: "${input}" → "${expected}"`, () => {
        expect(tluc(input)).toBe(expected);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: ionViewWillEnter — multiple SN formats
  // =========================================================================

  describe('ionViewWillEnter() — SN format matrix', () => {
    const snFormats: Array<{ sn: string; label: string }> = [
      { sn: 'GAS24AB12345', label: 'GAS boiler SN' },
      { sn: 'HP24CD54321', label: 'heat pump SN' },
      { sn: 'BOILER001', label: 'boiler SN' },
      { sn: '', label: 'empty SN' },
      { sn: 'ABCDE12345FGHIJ', label: '15-char SN' },
      { sn: '1234567890', label: 'numeric SN' },
      { sn: 'SN-WITH-HYPHENS', label: 'hyphenated SN' },
      { sn: 'sn_lower_case', label: 'lowercase SN' },
      { sn: 'A', label: 'single-char SN' },
      { sn: 'X'.repeat(20), label: '20-char SN' },
    ];

    snFormats.forEach(({ sn, label }) => {
      it(`EXP-AU-SN: ${label} "${sn}" — ionViewWillEnter sets sn correctly`, () => {
        TestBed.resetTestingModule();
        setupTestBed(sn, '');

        page.ionViewWillEnter();

        expect(internals(page).sn).toBe(sn);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: form reset — fields cleared after ionViewWillEnter
  // =========================================================================

  describe('form reset — all fields cleared on ionViewWillEnter', () => {
    const fieldsThatReset: Array<string> = [
      'firstName', 'lastName', 'streetName', 'homeNumber',
      'city', 'postCode', 'phoneNumber', 'warrantyStatus',
    ];

    fieldsThatReset.forEach((field) => {
      it(`EXP-AU-RESET: field "${field}" is cleared after ionViewWillEnter`, () => {
        internals(page).form.get(field).setValue('somePrefilledValue');

        page.ionViewWillEnter();

        expect(internals(page).form.get(field).value).toBe('');
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: toLatinUpperCase — symbol pass-through matrix
  // =========================================================================

  describe('toLatinUpperCase() — symbol and special character pass-through', () => {
    function tluc(value: string): string {
      return internals(page).toLatinUpperCase(value);
    }

    const symbolCases: Array<[string, string]> = [
      ['!', '!'],
      ['@', '@'],
      ['#', '#'],
      ['$', '$'],
      ['%', '%'],
      ['^', '^'],
      ['&', '&'],
      ['*', '*'],
      ['(', '('],
      [')', ')'],
      ['-', '-'],
      ['_', '_'],
      ['=', '='],
      ['+', '+'],
      ['[', '['],
      [']', ']'],
      ['{', '{'],
      ['}', '}'],
      ['|', '|'],
      ['\\', '\\'],
      [':', ':'],
      [';', ';'],
      ['"', '"'],
      ["'", "'"],
      ['<', '<'],
      ['>', '>'],
      [',', ','],
      ['.', '.'],
      ['?', '?'],
      ['/', '/'],
    ];

    symbolCases.forEach(([symbol, expected]) => {
      it(`EXP-AU-SYM: symbol "${symbol}" passes through unchanged`, () => {
        expect(tluc(symbol)).toBe(expected);
      });
    });
  });
});
