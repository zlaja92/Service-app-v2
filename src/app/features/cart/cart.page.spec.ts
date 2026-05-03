/**
 * CartPage unit tests — WU-26 batch B3
 *
 * NOTE — EmailComposer (Capacitor plugin) mock limitation (BUG-03 pattern):
 * `capacitor-email-composer` uses a Capacitor Proxy object created via
 * `registerPlugin('EmailComposer')`. The Proxy has a `get` trap that always
 * delegates to `createPluginMethodWrapper(prop)`, which throws
 * `UNIMPLEMENTED` on web when no jsImplementation is registered.
 * Because the Proxy has no `set` trap, property assignment and
 * Object.defineProperty both silently write to the backing `{}` target, but
 * the `get` trap is never consulted from that target — so spying with
 * `spyOn(EmailComposer, 'open')` or direct assignment both fail.
 *
 * Tests that call `component.onOrder()` (TC-02 through TC-11, TC-14, TC-15)
 * are skipped with `xit` and flagged below.  All other tests (TC-01, TC-12,
 * TC-13) run and pass.
 *
 * Resolution requires either:
 *   a) A thin Injectable wrapper around EmailComposer in app code (DI-able), or
 *   b) A jest-style module mock via webpack aliases in karma.conf.js.
 * Both require a change outside the test file → escalated to ARCH agent.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { CartPage } from './cart.page';
import { CartService, CartItem, CartContext } from './cart.service';
import { ConfigStore } from '../../core/config/config.store';
import { AuthStore } from '../../core/auth/auth.store';
import { LoggerService } from '../../core/logger/logger.service';

// ─── Helper factories ──────────────────────────────────────────────────────────

function createMockCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    partCode: 'PART-001',
    name: 'Test Part',
    price: 100,
    currency: 'EUR',
    quantity: 1,
    ...overrides,
  };
}

function createMockCartService(items: CartItem[] = [], context: CartContext | null = null) {
  return {
    cartItems: jasmine.createSpy('cartItems').and.returnValue(items),
    totalPrice: jasmine.createSpy('totalPrice').and.returnValue(
      items.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0),
    ),
    itemCount: jasmine.createSpy('itemCount').and.returnValue(
      items.reduce((sum, i) => sum + i.quantity, 0),
    ),
    currency: jasmine.createSpy('currency').and.returnValue(items[0]?.currency ?? ''),
    context,
    addItem: jasmine.createSpy('addItem'),
    removeItem: jasmine.createSpy('removeItem'),
    increaseQuantity: jasmine.createSpy('increaseQuantity'),
    decreaseQuantity: jasmine.createSpy('decreaseQuantity'),
    clearItems: jasmine.createSpy('clearItems'),
    clear: jasmine.createSpy('clear'),
  };
}

function createMockConfigStore(orderEmailRecipients: Record<string, string> = {}, currency = 'EUR') {
  return {
    business: jasmine.createSpy('business').and.returnValue({
      currency,
      orderEmailRecipients,
      maxPartsPerIntervention: 4,
      partNote: '',
      partPhotoFolder: '',
      snModelStart: 0,
      snModelLength: 7,
      snMfgDateStart: 9,
      snMfgDateLength: 5,
      snMinLength: 21,
      snMaxLength: 21,
      userSearchPageSize: 20,
      userSearchMinLength: 2,
      interventionCollections: { default: 'interventions' },
      photoQuality: 70,
      photoMaxWidth: 1280,
    }),
    appTitle: jasmine.createSpy('appTitle').and.returnValue('Test App'),
    isFeatureEnabled: jasmine.createSpy('isFeatureEnabled').and.returnValue(false),
    features: jasmine.createSpy('features').and.returnValue({}),
  };
}

function createMockAuthStore(email = 'servicer@test.com') {
  return {
    userEmail: jasmine.createSpy('userEmail').and.returnValue(email),
    isAuthenticated: jasmine.createSpy('isAuthenticated').and.returnValue(true),
    userId: jasmine.createSpy('userId').and.returnValue('user-123'),
    user: jasmine.createSpy('user').and.returnValue({ uid: 'user-123', email, displayName: 'Test' }),
  };
}

function createMockLoggerService() {
  return {
    info: jasmine.createSpy('info'),
    debug: jasmine.createSpy('debug'),
    warn: jasmine.createSpy('warn'),
    error: jasmine.createSpy('error'),
  };
}

// ─── Transloco test langs ──────────────────────────────────────────────────────

const TEST_LANGS = {
  en: {
    cart_title: 'Cart',
    cart_empty: 'Your cart is empty',
    cart_order: 'Place Order',
    cart_total: 'Total',
    cart_note_placeholder: 'Add a note...',
    cart_price_unavailable: 'Price unavailable',
    order_email_subject: 'Spare Parts Order',
    order_item_template: 'Item: {{name}} ({{code}}) x{{quantity}} @ {{price}} {{currency}}',
    order_email_body: 'Items:\n{{items}}\n\nTotal: {{total}} {{currency}}\nServicer: {{servicer}}\n{{warrantyLine}}\n{{userLine}}\nApp: {{appTitle}}',
    order_warranty_in: 'Device is IN WARRANTY',
    order_warranty_out: 'Device is OUT OF WARRANTY',
    order_user_info: 'Customer: {{name}}, {{address}}, {{phone}}',
    order_no_user: 'No customer info provided',
  },
};

// ─── Test setup helper ─────────────────────────────────────────────────────────

async function createTestBed(
  items: CartItem[] = [createMockCartItem()],
  context: CartContext | null = null,
  recipients: Record<string, string> = {},
  currency = 'EUR',
  userEmail = 'servicer@test.com',
): Promise<{
  fixture: ComponentFixture<CartPage>;
  component: CartPage;
  router: Router;
  mockCartService: ReturnType<typeof createMockCartService>;
  mockConfigStore: ReturnType<typeof createMockConfigStore>;
  mockAuthStore: ReturnType<typeof createMockAuthStore>;
  mockLoggerService: ReturnType<typeof createMockLoggerService>;
}> {
  const mockCartService = createMockCartService(items, context);
  const mockConfigStore = createMockConfigStore(recipients, currency);
  const mockAuthStore = createMockAuthStore(userEmail);
  const mockLoggerService = createMockLoggerService();

  await TestBed.configureTestingModule({
    imports: [
      CartPage,
      TranslocoTestingModule.forRoot({
        langs: TEST_LANGS,
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        preloadLangs: true,
      }),
    ],
    providers: [
      provideRouter([]),
      { provide: CartService, useValue: mockCartService },
      { provide: ConfigStore, useValue: mockConfigStore },
      { provide: AuthStore, useValue: mockAuthStore },
      { provide: LoggerService, useValue: mockLoggerService },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(CartPage);
  const component = fixture.componentInstance;
  const router = TestBed.inject(Router);
  fixture.detectChanges();

  return { fixture, component, router, mockCartService, mockConfigStore, mockAuthStore, mockLoggerService };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('CartPage', () => {

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // ─── Creation ───────────────────────────────────────────────────────────────

  describe('creation', () => {
    it('should create the component', async () => {
      const { component } = await createTestBed();
      expect(component).toBeTruthy();
    });
  });

  // ─── TC-01: onNoteChange — updates note signal ──────────────────────────────

  describe('onNoteChange()', () => {
    it('TC-01: should update orderNote signal with value from CustomEvent detail', async () => {
      const { component } = await createTestBed();
      const event = new CustomEvent('ionInput', { detail: { value: 'Special delivery please' } });
      component.onNoteChange(event as CustomEvent);
      expect(component.orderNote()).toBe('Special delivery please');
    });

    it('should set orderNote to empty string when event detail value is null', async () => {
      const { component } = await createTestBed();
      const event = new CustomEvent('ionInput', { detail: { value: null } });
      component.onNoteChange(event as CustomEvent);
      expect(component.orderNote()).toBe('');
    });

    it('should overwrite previous note when onNoteChange called twice', async () => {
      const { component } = await createTestBed();
      component.onNoteChange(new CustomEvent('i', { detail: { value: 'first' } }) as CustomEvent);
      component.onNoteChange(new CustomEvent('i', { detail: { value: 'second' } }) as CustomEvent);
      expect(component.orderNote()).toBe('second');
    });
  });

  // ─── TC-02–TC-11: onOrder — EmailComposer (xit: BUG-03 Capacitor Proxy) ────
  //
  // These tests verify the email composition logic in onOrder().
  // They are skipped because `EmailComposer` is a Capacitor Proxy whose `get`
  // trap always throws UNIMPLEMENTED on web and cannot be spy-wrapped without
  // either a DI wrapper in app code or a webpack module alias for tests.
  //
  // See file header comment for full explanation and escalation path.
  // ──────────────────────────────────────────────────────────────────────────────

  describe('onOrder() — email subject [TC-02]', () => {
    xit('TC-02: should call EmailComposer.open with translated order_email_subject — SKIPPED: Capacitor Proxy cannot be spy-wrapped on web', async () => {
      // Would verify: EmailComposer.open called with { subject: 'Spare Parts Order' }
    });
  });

  describe('onOrder() — email body contains all items [TC-03]', () => {
    xit('TC-03: should include all cart item names in email body — SKIPPED: Capacitor Proxy', async () => {
      // Would verify: body contains each item.name
    });
  });

  describe('onOrder() — per-item details [TC-04]', () => {
    xit('TC-04: should include name, code, quantity, price for each item — SKIPPED: Capacitor Proxy', async () => {
      // Would verify: body contains item name, partCode, quantity, price.toFixed(2)
    });
  });

  describe('onOrder() — total amount [TC-05]', () => {
    xit('TC-05: should include total amount in email body — SKIPPED: Capacitor Proxy', async () => {
      // Would verify: body contains totalPrice.toFixed(2)
    });
  });

  describe('onOrder() — warranty IN message [TC-06]', () => {
    xit('TC-06: should include order_warranty_in text when warrantyStatus is in_warranty — SKIPPED: Capacitor Proxy', async () => {
      // Would verify: body contains translated order_warranty_in
    });
  });

  describe('onOrder() — warranty OUT message [TC-07]', () => {
    xit('TC-07: should include order_warranty_out text when warrantyStatus is out_of_warranty — SKIPPED: Capacitor Proxy', async () => {
      // Would verify: body contains translated order_warranty_out
    });
  });

  describe('onOrder() — user info [TC-08]', () => {
    xit('TC-08: should include userName, userAddress, userPhone in email body — SKIPPED: Capacitor Proxy', async () => {
      // Would verify: body contains ctx.userName, ctx.userAddress, ctx.userPhone
    });
  });

  describe('onOrder() — no user info fallback [TC-09]', () => {
    xit('TC-09: should use order_no_user translation when no userName in context — SKIPPED: Capacitor Proxy', async () => {
      // Would verify: body contains translated order_no_user
    });
  });

  describe('onOrder() — EmailComposer.open recipients [TC-10]', () => {
    xit('TC-10: should pass correct recipient email to EmailComposer.open based on deviceType — SKIPPED: Capacitor Proxy', async () => {
      // Would verify: EmailComposer.open called with { to: [recipients[ctx.deviceType]] }
    });
  });

  describe('onOrder() — recipients from ConfigStore [TC-11]', () => {
    xit('TC-11: should pull orderEmailRecipients from ConfigStore.business() — SKIPPED: Capacitor Proxy', async () => {
      // Would verify: mockConfigStore.business called; correct `to` passed to EmailComposer.open
    });
  });

  // ─── TC-12: navigateTo — calls Router.navigate ──────────────────────────────

  describe('navigateTo()', () => {
    it('TC-12: should call Router.navigate with the provided path wrapped in array', async () => {
      const { component, router } = await createTestBed();
      const navigateSpy = spyOn(router, 'navigate');
      component.navigateTo('/home');
      expect(navigateSpy).toHaveBeenCalledWith(['/home']);
    });

    it('should navigate to any given path (e.g. /cart)', async () => {
      const { component, router } = await createTestBed();
      const navigateSpy = spyOn(router, 'navigate');
      component.navigateTo('/cart');
      expect(navigateSpy).toHaveBeenCalledWith(['/cart']);
    });

    it('should call Router.navigate exactly once per navigateTo call', async () => {
      const { component, router } = await createTestBed();
      const navigateSpy = spyOn(router, 'navigate');
      component.navigateTo('/somewhere');
      expect(navigateSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── TC-13 (bonus): empty cart shows empty state ────────────────────────────

  describe('empty cart — .empty-state (bonus TC-13)', () => {
    it('TC-13: should render .empty-state element when cartItems returns empty array', async () => {
      const { fixture } = await createTestBed([]);
      fixture.detectChanges();
      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
    });

    it('should NOT render .empty-state when cart has items', async () => {
      const { fixture } = await createTestBed([createMockCartItem()]);
      fixture.detectChanges();
      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeNull();
    });

    it('should render translated cart_empty text in empty state', async () => {
      const { fixture } = await createTestBed([]);
      fixture.detectChanges();
      const msg = fixture.nativeElement.querySelector('.empty-state p');
      expect(msg?.textContent?.trim()).toBe('Your cart is empty');
    });
  });

  // ─── TC-14 (bonus): isHtml = false — SKIPPED (EmailComposer Proxy) ─────────

  describe('onOrder() — isHtml flag (bonus TC-14)', () => {
    xit('TC-14: should open EmailComposer with isHtml = false for plain text body — SKIPPED: Capacitor Proxy', async () => {
      // Would verify: EmailComposer.open called with { isHtml: false }
    });
  });

  // ─── TC-15 (bonus): currency — SKIPPED (EmailComposer Proxy) ────────────────

  describe('onOrder() — currency in email (bonus TC-15)', () => {
    xit('TC-15: should include currency from configStore.business().currency in email body — SKIPPED: Capacitor Proxy', async () => {
      // Would verify: body contains configStore.business().currency value (e.g. 'RSD')
    });
  });

  // ─── Supplemental unit tests (no EmailComposer dependency) ───────────────────

  describe('orderNote signal — initial state', () => {
    it('should initialise orderNote signal with empty string', async () => {
      const { component } = await createTestBed();
      expect(component.orderNote()).toBe('');
    });
  });

  describe('CartService signal bindings (via template)', () => {
    it('should render cart items in DOM when cartItems returns items', async () => {
      const items = [
        createMockCartItem({ name: 'Pump', partCode: 'P-001' }),
        createMockCartItem({ name: 'Valve', partCode: 'P-002' }),
      ];
      const { fixture } = await createTestBed(items);
      fixture.detectChanges();
      const listItems = fixture.nativeElement.querySelectorAll('ion-item.cart-item');
      expect(listItems.length).toBe(2);
    });

    it('should not render item list when cartItems is empty', async () => {
      const { fixture } = await createTestBed([]);
      fixture.detectChanges();
      const listItems = fixture.nativeElement.querySelectorAll('ion-item.cart-item');
      expect(listItems.length).toBe(0);
    });
  });

  describe('ConfigStore feature flag (via template)', () => {
    it('should NOT show note textarea when cartNote feature is disabled', async () => {
      const { fixture } = await createTestBed([createMockCartItem()]);
      // createMockConfigStore returns isFeatureEnabled = false by default
      fixture.detectChanges();
      const noteSection = fixture.nativeElement.querySelector('.note-section');
      expect(noteSection).toBeNull();
    });
  });

  // ─── EXPANSION — onNoteChange parameterized ───────────────────────────────────

  describe('onNoteChange() — parameterized values', () => {
    const noteValues: Array<{ value: any; expected: string }> = [
      { value: 'Hello', expected: 'Hello' },
      { value: '', expected: '' },
      { value: null, expected: '' },
      { value: undefined, expected: '' },
      { value: '  spaces  ', expected: '  spaces  ' },
      { value: 'Multi\nline', expected: 'Multi\nline' },
      { value: 'Special chars !@#$', expected: 'Special chars !@#$' },
      { value: 'Налог напомена', expected: 'Налог напомена' },
      { value: '0', expected: '0' },
    ];

    noteValues.forEach(({ value, expected }) => {
      it(`should set orderNote to "${expected}" for value=${JSON.stringify(value)}`, async () => {
        const { component } = await createTestBed();
        const event = new CustomEvent('ionInput', { detail: { value } });
        component.onNoteChange(event as CustomEvent);
        expect(component.orderNote()).toBe(expected);
      });
    });
  });

  // ─── EXPANSION — navigateTo parameterized paths ───────────────────────────────

  describe('navigateTo() — parameterized paths', () => {
    const paths = [
      '/home',
      '/docs',
      '/cart',
      '/device-management',
      '/profile',
      '/interventions',
      '/device-catalog',
    ];

    paths.forEach((path) => {
      it(`should navigate to "${path}"`, async () => {
        const { component, router } = await createTestBed();
        const navigateSpy = spyOn(router, 'navigate');
        component.navigateTo(path);
        expect(navigateSpy).toHaveBeenCalledWith([path]);
      });
    });
  });

  // ─── EXPANSION — multiple items rendering ─────────────────────────────────────

  describe('cart items rendering — various counts (parameterized)', () => {
    const itemCounts = [1, 2, 3, 5, 10];

    itemCounts.forEach((count) => {
      it(`should render ${count} cart items`, async () => {
        const items = Array.from({ length: count }, (_, i) =>
          createMockCartItem({ partCode: `P-${i}`, name: `Part ${i}` }),
        );
        const { fixture } = await createTestBed(items);
        fixture.detectChanges();
        const rendered = fixture.nativeElement.querySelectorAll('ion-item.cart-item');
        expect(rendered.length).toBe(count);
      });
    });
  });

  // ─── EXPANSION — empty state variations ──────────────────────────────────────

  describe('empty state — edge cases', () => {
    it('should show empty state for empty array', async () => {
      const { fixture } = await createTestBed([]);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
    });

    it('should not show cart items when empty', async () => {
      const { fixture } = await createTestBed([]);
      fixture.detectChanges();
      const items = fixture.nativeElement.querySelectorAll('ion-item.cart-item');
      expect(items.length).toBe(0);
    });
  });

  // ─── EXPANSION — orderNote signal initial state ───────────────────────────────

  describe('orderNote signal — sequential changes', () => {
    it('should update orderNote on each change', async () => {
      const { component } = await createTestBed();
      const values = ['first', 'second', 'third'];

      for (const v of values) {
        component.onNoteChange(new CustomEvent('i', { detail: { value: v } }) as CustomEvent);
        expect(component.orderNote()).toBe(v);
      }
    });

    it('should clear note when null is set after text', async () => {
      const { component } = await createTestBed();
      component.onNoteChange(new CustomEvent('i', { detail: { value: 'some text' } }) as CustomEvent);
      expect(component.orderNote()).toBe('some text');

      component.onNoteChange(new CustomEvent('i', { detail: { value: null } }) as CustomEvent);
      expect(component.orderNote()).toBe('');
    });
  });
});
