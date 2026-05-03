import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';

import { ConfirmService } from './confirm.service';
import { createMockAlertController, createMockTranslocoService } from '../../testing/mock-factories';

describe('ConfirmService', () => {
  let service: ConfirmService;
  let mockAlertCtrl: jasmine.SpyObj<AlertController>;
  let mockTransloco: jasmine.SpyObj<TranslocoService>;

  // Captured button handlers so tests can trigger them programmatically
  let capturedButtons: { text: string; role?: string; handler?: () => void }[] = [];

  function buildMockAlert(): HTMLIonAlertElement {
    const alert = {
      present: jasmine.createSpy('present').and.resolveTo(),
      dismiss: jasmine.createSpy('dismiss').and.resolveTo(true),
      onDidDismiss: jasmine.createSpy('onDidDismiss').and.resolveTo({ data: undefined, role: 'backdrop' }),
    } as unknown as HTMLIonAlertElement;
    return alert;
  }

  function setupAlertCtrl(mockAlert: HTMLIonAlertElement): void {
    mockAlertCtrl.create.and.callFake((opts: any) => {
      capturedButtons = opts.buttons ?? [];
      return Promise.resolve(mockAlert);
    });
  }

  beforeEach(() => {
    mockAlertCtrl = createMockAlertController();
    mockTransloco = createMockTranslocoService();
    capturedButtons = [];

    TestBed.configureTestingModule({
      providers: [
        ConfirmService,
        { provide: AlertController, useValue: mockAlertCtrl },
        { provide: TranslocoService, useValue: mockTransloco },
      ],
    });

    service = TestBed.inject(ConfirmService);
  });

  // TC-CS-01: confirm() resolves true when user clicks confirm button
  it('TC-CS-01: should resolve true when confirm button handler is invoked', async () => {
    const mockAlert = buildMockAlert();
    setupAlertCtrl(mockAlert);

    const resultPromise = service.confirm(
      'common_delete_title',
      'common_delete_message',
      'common_confirm',
      'common_cancel',
    );

    // Wait for alert creation and present
    await Promise.resolve();
    await Promise.resolve();

    // Find and invoke the confirm button (no role = confirm button per source)
    const confirmButton = capturedButtons.find((b) => !b.role);
    expect(confirmButton).toBeDefined();
    confirmButton!.handler!();

    const result = await resultPromise;
    expect(result).toBe(true);
  });

  // TC-CS-02: confirm() resolves false when user clicks cancel button
  it('TC-CS-02: should resolve false when cancel button handler is invoked', async () => {
    const mockAlert = buildMockAlert();
    setupAlertCtrl(mockAlert);

    const resultPromise = service.confirm(
      'common_delete_title',
      'common_delete_message',
      'common_confirm',
      'common_cancel',
    );

    await Promise.resolve();
    await Promise.resolve();

    // Find and invoke the cancel button (role === 'cancel')
    const cancelButton = capturedButtons.find((b) => b.role === 'cancel');
    expect(cancelButton).toBeDefined();
    cancelButton!.handler!();

    const result = await resultPromise;
    expect(result).toBe(false);
  });

  // TC-CS-03: TranslocoService.translate called for each i18n key
  it('TC-CS-03: should call translate for each i18n key (header, message, confirm, cancel)', async () => {
    const mockAlert = buildMockAlert();
    setupAlertCtrl(mockAlert);

    const headerKey = 'common_delete_title';
    const messageKey = 'common_delete_message';
    const confirmKey = 'common_confirm';
    const cancelKey = 'common_cancel';

    const resultPromise = service.confirm(headerKey, messageKey, confirmKey, cancelKey);

    await Promise.resolve();
    await Promise.resolve();

    capturedButtons.find((b) => !b.role)!.handler!();
    await resultPromise;

    expect(mockTransloco.translate).toHaveBeenCalledWith(headerKey);
    expect(mockTransloco.translate).toHaveBeenCalledWith(messageKey);
    expect(mockTransloco.translate).toHaveBeenCalledWith(confirmKey);
    expect(mockTransloco.translate).toHaveBeenCalledWith(cancelKey);
    // Total: 4 translate calls
    expect((mockTransloco.translate as jasmine.Spy).calls.count()).toBe(4);
  });

  // TC-CS-04: AlertController.create called with correct header/message/buttons
  it('TC-CS-04: should call AlertController.create with translated header, message and two buttons', async () => {
    // TranslocoService mock is passthrough — returned value === key
    const mockAlert = buildMockAlert();
    setupAlertCtrl(mockAlert);

    const headerKey = 'delete_header';
    const messageKey = 'delete_message';
    const confirmKey = 'delete_confirm';
    const cancelKey = 'delete_cancel';

    const resultPromise = service.confirm(headerKey, messageKey, confirmKey, cancelKey);

    await Promise.resolve();
    await Promise.resolve();

    capturedButtons.find((b) => !b.role)!.handler!();
    await resultPromise;

    expect(mockAlertCtrl.create).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        header: headerKey,   // passthrough returns key as value
        message: messageKey,
        buttons: jasmine.arrayContaining([
          jasmine.objectContaining({ role: 'cancel' }),
          jasmine.objectContaining({ text: confirmKey }),
        ]),
      }),
    );
  });

  // TC-CS-05: Default button labels when no custom labels passed
  it('TC-CS-05: should use provided keys as button texts (passthrough translate)', async () => {
    const mockAlert = buildMockAlert();
    setupAlertCtrl(mockAlert);

    const resultPromise = service.confirm(
      'confirm_header',
      'confirm_message',
      'common_yes',
      'common_no',
    );

    await Promise.resolve();
    await Promise.resolve();

    capturedButtons.find((b) => !b.role)!.handler!();
    await resultPromise;

    const cancelBtn = capturedButtons.find((b) => b.role === 'cancel');
    const confirmBtn = capturedButtons.find((b) => !b.role);

    expect(cancelBtn?.text).toBe('common_no');
    expect(confirmBtn?.text).toBe('common_yes');
  });

  // TC-CS-06: Custom button labels override — verifies different keys produce different button texts
  it('TC-CS-06: should use custom key strings as button labels', async () => {
    const mockAlert = buildMockAlert();
    setupAlertCtrl(mockAlert);

    const resultPromise = service.confirm(
      'intervention_delete_title',
      'intervention_delete_body',
      'intervention_delete_confirm',
      'intervention_delete_cancel',
    );

    await Promise.resolve();
    await Promise.resolve();

    capturedButtons.find((b) => !b.role)!.handler!();
    await resultPromise;

    const cancelBtn = capturedButtons.find((b) => b.role === 'cancel');
    const confirmBtn = capturedButtons.find((b) => !b.role);

    expect(cancelBtn?.text).toBe('intervention_delete_cancel');
    expect(confirmBtn?.text).toBe('intervention_delete_confirm');

    // Keys are different from default labels — if defaults existed they would differ
    expect(cancelBtn?.text).not.toBe('common_cancel');
    expect(confirmBtn?.text).not.toBe('common_confirm');
  });

  // TC-CS-07 (bonus): Alert is presented after creation
  it('TC-CS-07: should call alert.present() after create()', async () => {
    const mockAlert = buildMockAlert();
    setupAlertCtrl(mockAlert);

    const resultPromise = service.confirm('h', 'm', 'ok', 'no');

    await Promise.resolve();
    await Promise.resolve();

    expect((mockAlert as any).present).toHaveBeenCalledTimes(1);

    capturedButtons.find((b) => !b.role)!.handler!();
    await resultPromise;
  });

  // TC-CS-08 (bonus): Multiple sequential confirms work independently
  it('TC-CS-08: should handle multiple sequential confirm calls independently', async () => {
    // First confirm — user confirms
    const firstAlert = buildMockAlert();
    let firstButtons: typeof capturedButtons = [];
    mockAlertCtrl.create.and.callFake((opts: any) => {
      firstButtons = opts.buttons ?? [];
      return Promise.resolve(firstAlert);
    });

    const firstPromise = service.confirm('h1', 'm1', 'ok1', 'no1');
    await Promise.resolve();
    await Promise.resolve();
    firstButtons.find((b) => !b.role)!.handler!();
    const firstResult = await firstPromise;

    // Second confirm — user cancels
    const secondAlert = buildMockAlert();
    let secondButtons: typeof capturedButtons = [];
    mockAlertCtrl.create.and.callFake((opts: any) => {
      secondButtons = opts.buttons ?? [];
      return Promise.resolve(secondAlert);
    });

    const secondPromise = service.confirm('h2', 'm2', 'ok2', 'no2');
    await Promise.resolve();
    await Promise.resolve();
    secondButtons.find((b) => b.role === 'cancel')!.handler!();
    const secondResult = await secondPromise;

    expect(firstResult).toBe(true);
    expect(secondResult).toBe(false);
  });

  // =========================================================================
  // Parameterized: i18n key combinations
  // =========================================================================

  describe('Parameterized: i18n key combinations for confirm()', () => {
    interface KeyCombo {
      headerKey: string;
      messageKey: string;
      confirmKey: string;
      cancelKey: string;
    }

    const keyCombinations: KeyCombo[] = [
      { headerKey: 'common_delete_title', messageKey: 'common_delete_message', confirmKey: 'common_confirm', cancelKey: 'common_cancel' },
      { headerKey: 'intervention_delete_title', messageKey: 'intervention_delete_body', confirmKey: 'intervention_delete_confirm', cancelKey: 'intervention_delete_cancel' },
      { headerKey: 'device_delete_title', messageKey: 'device_delete_body', confirmKey: 'device_confirm', cancelKey: 'device_cancel' },
      { headerKey: 'order_delete_title', messageKey: 'order_delete_message', confirmKey: 'order_confirm_delete', cancelKey: 'order_cancel_delete' },
      { headerKey: 'logout_confirm_title', messageKey: 'logout_confirm_message', confirmKey: 'logout_confirm_btn', cancelKey: 'logout_cancel_btn' },
      { headerKey: 'clear_cart_title', messageKey: 'clear_cart_message', confirmKey: 'clear_cart_yes', cancelKey: 'clear_cart_no' },
      { headerKey: 'a', messageKey: 'b', confirmKey: 'c', cancelKey: 'd' },
      { headerKey: 'UPPERCASE_KEY', messageKey: 'UPPER_MSG', confirmKey: 'UPPER_CONFIRM', cancelKey: 'UPPER_CANCEL' },
      { headerKey: 'mixed.dots.key', messageKey: 'dots.message', confirmKey: 'dots.confirm', cancelKey: 'dots.cancel' },
    ];

    keyCombinations.forEach(({ headerKey, messageKey, confirmKey, cancelKey }) => {
      it(`TC-CSKEY-${headerKey.slice(0, 20)}: translate called for all 4 keys (${headerKey.slice(0, 20)})`, async () => {
        const mockAlert = buildMockAlert();
        setupAlertCtrl(mockAlert);

        const resultPromise = service.confirm(headerKey, messageKey, confirmKey, cancelKey);

        await Promise.resolve();
        await Promise.resolve();

        capturedButtons.find((b) => !b.role)!.handler!();
        await resultPromise;

        expect(mockTransloco.translate).toHaveBeenCalledWith(headerKey);
        expect(mockTransloco.translate).toHaveBeenCalledWith(messageKey);
        expect(mockTransloco.translate).toHaveBeenCalledWith(confirmKey);
        expect(mockTransloco.translate).toHaveBeenCalledWith(cancelKey);
      });
    });
  });

  // =========================================================================
  // Parameterized: confirm() result — user action variants
  // =========================================================================

  describe('Parameterized: confirm() result based on user action', () => {
    const actions: Array<{ label: string; action: 'confirm' | 'cancel'; expected: boolean }> = [
      { label: 'user confirms', action: 'confirm', expected: true },
      { label: 'user cancels', action: 'cancel', expected: false },
    ];

    // Test with multiple different key sets for each action
    const keySets = [
      { h: 'h1', m: 'm1', c: 'c1', x: 'x1' },
      { h: 'delete_header', m: 'delete_msg', c: 'delete_confirm', x: 'delete_cancel' },
      { h: 'logout_title', m: 'logout_body', c: 'logout_yes', x: 'logout_no' },
    ];

    keySets.forEach(({ h, m, c, x }) => {
      actions.forEach(({ label, action, expected }) => {
        it(`TC-CSACT-${h.slice(0, 10)}-${label}: confirm() resolves ${expected} when ${label}`, async () => {
          const mockAlert = buildMockAlert();
          setupAlertCtrl(mockAlert);

          const resultPromise = service.confirm(h, m, c, x);

          await Promise.resolve();
          await Promise.resolve();

          if (action === 'confirm') {
            capturedButtons.find((b) => !b.role)!.handler!();
          } else {
            capturedButtons.find((b) => b.role === 'cancel')!.handler!();
          }

          const result = await resultPromise;
          expect(result).toBe(expected);
        });
      });
    });
  });

  // =========================================================================
  // Parameterized: button structure validation
  // =========================================================================

  describe('Parameterized: button structure for various key combos', () => {
    const keyCombos = [
      { confirmKey: 'yes', cancelKey: 'no' },
      { confirmKey: 'common_confirm', cancelKey: 'common_cancel' },
      { confirmKey: 'delete', cancelKey: 'keep' },
      { confirmKey: 'OK', cancelKey: 'Cancel' },
    ];

    keyCombos.forEach(({ confirmKey, cancelKey }) => {
      it(`TC-CSBTN-${confirmKey}/${cancelKey}: always exactly 2 buttons — one cancel-role, one no-role`, async () => {
        const mockAlert = buildMockAlert();
        setupAlertCtrl(mockAlert);

        const resultPromise = service.confirm('h', 'm', confirmKey, cancelKey);

        await Promise.resolve();
        await Promise.resolve();

        expect(capturedButtons.length).toBe(2);

        const cancelBtn = capturedButtons.find((b) => b.role === 'cancel');
        const confirmBtn = capturedButtons.find((b) => !b.role);

        expect(cancelBtn).toBeDefined();
        expect(confirmBtn).toBeDefined();
        expect(cancelBtn!.text).toBe(cancelKey);
        expect(confirmBtn!.text).toBe(confirmKey);

        confirmBtn!.handler!();
        await resultPromise;
      });
    });
  });

  // =========================================================================
  // Parameterized: AlertController.create options completeness
  // =========================================================================

  describe('Parameterized: AlertController.create called once per confirm()', () => {
    const callCounts = [1, 3, 5];

    callCounts.forEach((count) => {
      it(`TC-CSCC-${count}: AlertController.create called exactly ${count} time(s) for ${count} confirm() call(s)`, async () => {
        for (let i = 0; i < count; i++) {
          const mockAlert = buildMockAlert();
          let btns: typeof capturedButtons = [];
          mockAlertCtrl.create.and.callFake((opts: any) => {
            btns = opts.buttons ?? [];
            return Promise.resolve(mockAlert);
          });

          const p = service.confirm(`h${i}`, `m${i}`, `ok${i}`, `no${i}`);
          await Promise.resolve();
          await Promise.resolve();
          btns.find((b) => !b.role)!.handler!();
          await p;
        }

        expect(mockAlertCtrl.create).toHaveBeenCalledTimes(count);
      });
    });
  });

  // =========================================================================
  // Parameterized: alert.present() called each time
  // =========================================================================

  describe('Parameterized: alert.present() called for each confirm()', () => {
    it('TC-CSPRESENT-01: present() called once per single confirm()', async () => {
      const mockAlert = buildMockAlert();
      setupAlertCtrl(mockAlert);

      const p = service.confirm('h', 'm', 'ok', 'no');
      await Promise.resolve();
      await Promise.resolve();

      expect((mockAlert as any).present).toHaveBeenCalledTimes(1);

      capturedButtons.find((b) => !b.role)!.handler!();
      await p;
    });
  });
});
