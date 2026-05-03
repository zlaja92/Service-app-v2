import { TestBed } from '@angular/core/testing';
import { LoadingController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';

import { LoadingAlertService } from './loading-alert.service';
import { createMockTranslocoService } from '../../testing/mock-factories';

// ─── Inline LoadingController factory ────────────────────────────────────────
// LoadingController is not in mock-factories, so we create it inline.

function buildMockLoadingElement(): HTMLIonLoadingElement {
  return {
    present: jasmine.createSpy('present').and.resolveTo(),
    dismiss: jasmine.createSpy('dismiss').and.resolveTo(true),
    onDidDismiss: jasmine.createSpy('onDidDismiss').and.resolveTo({ data: undefined, role: 'timeout' }),
  } as unknown as HTMLIonLoadingElement;
}

function createMockLoadingController(
  loadingEl?: HTMLIonLoadingElement,
): jasmine.SpyObj<LoadingController> {
  const element = loadingEl ?? buildMockLoadingElement();
  const mock = jasmine.createSpyObj<LoadingController>('LoadingController', ['create', 'dismiss', 'getTop']);
  mock.create.and.resolveTo(element);
  mock.dismiss.and.resolveTo(true);
  mock.getTop.and.resolveTo(undefined);
  return mock;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('LoadingAlertService', () => {
  let service: LoadingAlertService;
  let mockLoadingCtrl: jasmine.SpyObj<LoadingController>;
  let mockTransloco: jasmine.SpyObj<TranslocoService>;
  let mockLoadingEl: HTMLIonLoadingElement;

  beforeEach(() => {
    mockLoadingEl = buildMockLoadingElement();
    mockLoadingCtrl = createMockLoadingController(mockLoadingEl);
    mockTransloco = createMockTranslocoService();

    TestBed.configureTestingModule({
      providers: [
        LoadingAlertService,
        { provide: LoadingController, useValue: mockLoadingCtrl },
        { provide: TranslocoService, useValue: mockTransloco },
      ],
    });

    service = TestBed.inject(LoadingAlertService);
  });

  // TC-LA-01: show() creates and presents loading alert
  it('TC-LA-01: should create and present loading element when show() is called', async () => {
    await service.show();

    expect(mockLoadingCtrl.create).toHaveBeenCalledTimes(1);
    expect((mockLoadingEl as any).present).toHaveBeenCalledTimes(1);
  });

  // TC-LA-02: show() with custom message uses translated message
  it('TC-LA-02: should translate the provided messageKey and pass it to create()', async () => {
    const customKey = 'saving_please_wait';

    await service.show(customKey);

    expect(mockTransloco.translate).toHaveBeenCalledWith(customKey);
    expect(mockLoadingCtrl.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        message: customKey, // passthrough translate returns the key
      }),
    );
  });

  // TC-LA-03: hide() dismisses active loading alert
  it('TC-LA-03: should dismiss the active loading element when hide() is called', async () => {
    await service.show();
    await service.hide();

    expect((mockLoadingEl as any).dismiss).toHaveBeenCalledTimes(1);
  });

  // TC-LA-04: hide() is a no-op if no active loading
  it('TC-LA-04: should not throw and not call dismiss when hide() is called without prior show()', async () => {
    await expectAsync(service.hide()).toBeResolved();
    expect((mockLoadingEl as any).dismiss).not.toHaveBeenCalled();
  });

  // TC-LA-05: wrap() shows before promise, hides after success
  it('TC-LA-05: should show loading before operation and hide after successful promise', async () => {
    const callOrder: string[] = [];

    (mockLoadingEl as any).present.and.callFake(() => {
      callOrder.push('present');
      return Promise.resolve();
    });
    (mockLoadingEl as any).dismiss.and.callFake(() => {
      callOrder.push('dismiss');
      return Promise.resolve(true);
    });

    const operation = () => {
      callOrder.push('operation');
      return Promise.resolve('done');
    };

    await service.wrap(operation);

    expect(callOrder).toEqual(['present', 'operation', 'dismiss']);
  });

  // TC-LA-06: wrap() shows before promise, hides after error (and re-throws)
  it('TC-LA-06: should hide loading after failed promise and re-throw the error', async () => {
    const expectedError = new Error('operation failed');
    const operation = () => Promise.reject(expectedError);

    await expectAsync(service.wrap(operation)).toBeRejectedWith(expectedError);

    // hide() must have been called even though operation threw
    expect((mockLoadingEl as any).dismiss).toHaveBeenCalledTimes(1);
  });

  // TC-LA-07: wrap() returns the promise result on success
  it('TC-LA-07: should return the resolved value of the wrapped operation', async () => {
    const expectedValue = { id: 42, name: 'test-result' };
    const operation = () => Promise.resolve(expectedValue);

    const result = await service.wrap(operation);

    expect(result).toEqual(expectedValue);
  });

  // TC-LA-08: show() then show() again — duplicate handling
  it('TC-LA-08: should create a second loading element when show() is called while one is already active', async () => {
    // The service does not guard against duplicate show() calls.
    // Each show() creates a new element and presents it; the previous reference is lost.
    const firstEl = buildMockLoadingElement();
    const secondEl = buildMockLoadingElement();

    let callCount = 0;
    mockLoadingCtrl.create.and.callFake(() => {
      callCount++;
      return Promise.resolve(callCount === 1 ? firstEl : secondEl);
    });

    await service.show('first_key');
    await service.show('second_key');

    expect(mockLoadingCtrl.create).toHaveBeenCalledTimes(2);
    expect((firstEl as any).present).toHaveBeenCalledTimes(1);
    expect((secondEl as any).present).toHaveBeenCalledTimes(1);

    // hide() should dismiss the SECOND element (last assigned to this.loading)
    await service.hide();
    expect((secondEl as any).dismiss).toHaveBeenCalledTimes(1);
    expect((firstEl as any).dismiss).not.toHaveBeenCalled();
  });

  // TC-LA-09 (bonus): wrap() with custom message
  it('TC-LA-09: should translate and use custom messageKey when provided to wrap()', async () => {
    const customKey = 'uploading_photo';

    await service.wrap(() => Promise.resolve(), customKey);

    expect(mockTransloco.translate).toHaveBeenCalledWith(customKey);
    expect(mockLoadingCtrl.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ message: customKey }),
    );
  });

  // TC-LA-10 (bonus): hide() called multiple times safely (no crash)
  it('TC-LA-10: should not throw when hide() is called multiple times after show()', async () => {
    await service.show();

    await expectAsync(service.hide()).toBeResolved();
    // Second hide — this.loading is null, optional chaining prevents crash
    await expectAsync(service.hide()).toBeResolved();

    // dismiss was only called once (first hide sets this.loading = null)
    expect((mockLoadingEl as any).dismiss).toHaveBeenCalledTimes(1);
  });

  // TC-LA-11: show() passes correct options to LoadingController.create
  it('TC-LA-11: should create loading with spinner, cssClass, backdropDismiss:false and default timeout', async () => {
    await service.show();

    expect(mockLoadingCtrl.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        spinner: 'crescent',
        cssClass: 'fullscreen-loading',
        backdropDismiss: false,
        duration: 30000,
      }),
    );
  });

  // TC-LA-12: show() with custom timeout passes it to create()
  it('TC-LA-12: should pass custom timeoutMs as duration to LoadingController.create', async () => {
    await service.show('loading_please_wait', 5000);

    expect(mockLoadingCtrl.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ duration: 5000 }),
    );
  });

  // =========================================================================
  // Parameterized: show() — message key variants
  // =========================================================================

  describe('Parameterized: show() — message key variants', () => {
    const messageKeys = [
      'loading_please_wait',
      'saving_please_wait',
      'uploading_photo',
      'fetching_data',
      'processing_request',
      'connecting_to_server',
      'common_loading',
      'intervention_saving',
      'order_creating',
      'a',
      'KEY_UPPER_CASE',
      'key.with.dots',
      'key-with-dashes',
      'key_with_underscores',
    ];

    messageKeys.forEach((key) => {
      it(`TC-LAKEY-${key.slice(0, 25)}: show("${key.slice(0, 25)}") calls translate with the key`, async () => {
        await service.show(key);

        expect(mockTransloco.translate).toHaveBeenCalledWith(key);
        expect(mockLoadingCtrl.create).toHaveBeenCalledWith(
          jasmine.objectContaining({ message: key }),
        );
      });
    });
  });

  // =========================================================================
  // Parameterized: show() — timeout variants
  // =========================================================================

  describe('Parameterized: show() — timeout variants', () => {
    const timeoutValues = [
      0,
      100,
      1000,
      5000,
      10000,
      15000,
      30000,
      60000,
      120000,
      300000,
      Number.MAX_SAFE_INTEGER,
    ];

    timeoutValues.forEach((timeoutMs) => {
      it(`TC-LATOUT-${timeoutMs}: show() with timeoutMs=${timeoutMs} passes duration=${timeoutMs}`, async () => {
        await service.show('loading', timeoutMs);

        expect(mockLoadingCtrl.create).toHaveBeenCalledWith(
          jasmine.objectContaining({ duration: timeoutMs }),
        );
      });
    });
  });

  // =========================================================================
  // Parameterized: wrap() — operation return value types
  // =========================================================================

  describe('Parameterized: wrap() — return value type variants', () => {
    const returnValues = [
      { label: 'string', value: 'result-string' },
      { label: 'number', value: 42 },
      { label: 'boolean true', value: true },
      { label: 'boolean false', value: false },
      { label: 'null', value: null },
      { label: 'object', value: { id: 1, name: 'test' } },
      { label: 'array', value: [1, 2, 3] },
      { label: 'empty string', value: '' },
      { label: 'zero', value: 0 },
      { label: 'nested object', value: { deep: { nested: { value: 42 } } } },
    ];

    returnValues.forEach(({ label, value }) => {
      it(`TC-LAWRAP-${label}: wrap() returns "${label}" from operation`, async () => {
        const operation = () => Promise.resolve(value as any);

        const result = await service.wrap(operation);

        expect(result).toEqual(value as any);
      });
    });
  });

  // =========================================================================
  // Parameterized: wrap() — error types re-thrown
  // =========================================================================

  describe('Parameterized: wrap() — error types are re-thrown', () => {
    const errorVariants = [
      new Error('generic error'),
      new Error('network-error'),
      new Error('firestore/permission-denied'),
      new Error('auth/unauthorized'),
      new Error(''),
      new TypeError('type mismatch'),
      new RangeError('value out of range'),
    ];

    errorVariants.forEach((err) => {
      it(`TC-LAWRAPE-${err.message.slice(0, 25)}: wrap() re-throws "${err.message.slice(0, 25)}"`, async () => {
        const operation = () => Promise.reject(err);

        await expectAsync(service.wrap(operation)).toBeRejectedWith(err);

        // hide() must still have been called
        expect((mockLoadingEl as any).dismiss).toHaveBeenCalledTimes(1);
      });
    });
  });

  // =========================================================================
  // Parameterized: wrap() — message key variants
  // =========================================================================

  describe('Parameterized: wrap() — message key variants', () => {
    const messageKeys = [
      'loading_please_wait',
      'saving_intervention',
      'uploading_document',
      'processing_payment',
      'syncing_data',
    ];

    messageKeys.forEach((key) => {
      it(`TC-LAWRKEY-${key}: wrap() calls show() with key="${key}"`, async () => {
        await service.wrap(() => Promise.resolve('done'), key);

        expect(mockTransloco.translate).toHaveBeenCalledWith(key);
        expect(mockLoadingCtrl.create).toHaveBeenCalledWith(
          jasmine.objectContaining({ message: key }),
        );
      });
    });
  });

  // =========================================================================
  // Parameterized: show/hide cycles
  // =========================================================================

  describe('Parameterized: show/hide cycles', () => {
    const cycleCounts = [1, 2, 3, 5];

    cycleCounts.forEach((count) => {
      it(`TC-LACYCLE-${count}: ${count} show/hide cycle(s) — dismiss called ${count} time(s)`, async () => {
        for (let i = 0; i < count; i++) {
          // Reset element for each cycle
          const el = buildMockLoadingElement();
          mockLoadingCtrl.create.and.resolveTo(el);

          await service.show();
          await service.hide();

          expect((el as any).dismiss).toHaveBeenCalledTimes(1);
        }
      });
    });
  });

  // =========================================================================
  // Parameterized: wrap() — operation duration does not affect dismiss
  // =========================================================================

  describe('Parameterized: wrap() — dismiss always called regardless of operation result', () => {
    it('TC-LAWRSEQ-01: dismiss called after successful synchronous-equivalent operation', async () => {
      await service.wrap(() => Promise.resolve(42));

      expect((mockLoadingEl as any).dismiss).toHaveBeenCalledTimes(1);
    });

    it('TC-LAWRSEQ-02: dismiss called after failed operation', async () => {
      await service.wrap(() => Promise.reject(new Error('fail'))).catch(() => {});

      expect((mockLoadingEl as any).dismiss).toHaveBeenCalledTimes(1);
    });

    it('TC-LAWRSEQ-03: present called before dismiss in successful operation', async () => {
      const order: string[] = [];

      (mockLoadingEl as any).present.and.callFake(() => {
        order.push('present');
        return Promise.resolve();
      });
      (mockLoadingEl as any).dismiss.and.callFake(() => {
        order.push('dismiss');
        return Promise.resolve(true);
      });

      await service.wrap(async () => {
        order.push('operation');
        return 'done';
      });

      expect(order).toEqual(['present', 'operation', 'dismiss']);
    });
  });

  // =========================================================================
  // Parameterized: show() options — fixed properties
  // =========================================================================

  describe('Parameterized: show() always passes fixed options', () => {
    const fixedKeys = ['loading_key_1', 'loading_key_2', 'loading_key_3'];

    fixedKeys.forEach((key) => {
      it(`TC-LASHOWOPT-${key}: show("${key}") always uses spinner=crescent, cssClass=fullscreen-loading, backdropDismiss=false`, async () => {
        await service.show(key);

        expect(mockLoadingCtrl.create).toHaveBeenCalledWith(
          jasmine.objectContaining({
            spinner: 'crescent',
            cssClass: 'fullscreen-loading',
            backdropDismiss: false,
          }),
        );
      });
    });
  });
});
