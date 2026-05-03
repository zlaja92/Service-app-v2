import { TestBed } from '@angular/core/testing';
import { CartService, CartContext } from './cart.service';
import { buildCartItem } from '../../testing/test-data-builders';

// ── Expansion helpers ──────────────────────────────────────────────────────────

interface PartVariation {
  partCode: string;
  name: string;
  price: number | null;
  currency: string;
}

function buildPartVariation(overrides: Partial<PartVariation> = {}): PartVariation {
  return {
    partCode: 'PART-VAR-001',
    name: 'Variation Part',
    price: 10,
    currency: 'EUR',
    ...overrides,
  };
}

describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CartService],
    });
    service = TestBed.inject(CartService);
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have empty cartItems', () => {
      expect(service.cartItems()).toEqual([]);
    });

    it('should have itemCount of 0', () => {
      expect(service.itemCount()).toBe(0);
    });

    it('should have totalPrice of 0', () => {
      expect(service.totalPrice()).toBe(0);
    });

    it('should have empty currency string', () => {
      expect(service.currency()).toBe('');
    });

    it('should have null context', () => {
      expect(service.context).toBeNull();
    });
  });

  // ── addItem ────────────────────────────────────────────────────────────────

  describe('addItem()', () => {
    it('should add new item to cart', () => {
      const item = buildCartItem({ partCode: 'PART-001', name: 'Filter', price: 20, currency: 'EUR' });
      service.addItem(item.partCode, item.name, item.price, item.currency);

      const cart = service.cartItems();
      expect(cart.length).toBe(1);
      expect(cart[0].partCode).toBe('PART-001');
      expect(cart[0].name).toBe('Filter');
      expect(cart[0].price).toBe(20);
      expect(cart[0].currency).toBe('EUR');
      expect(cart[0].quantity).toBe(1);
    });

    it('should increment quantity if item with same partCode already exists', () => {
      const item = buildCartItem({ partCode: 'PART-001' });
      service.addItem(item.partCode, item.name, item.price!, item.currency);
      service.addItem(item.partCode, item.name, item.price!, item.currency);

      const cart = service.cartItems();
      expect(cart.length).toBe(1);
      expect(cart[0].quantity).toBe(2);
    });

    it('should update totalPrice computed signal after add', () => {
      service.addItem('P1', 'Part A', 10, 'EUR');
      expect(service.totalPrice()).toBe(10);

      service.addItem('P2', 'Part B', 5, 'EUR');
      expect(service.totalPrice()).toBe(15);
    });

    it('should update itemCount computed signal after add', () => {
      service.addItem('P1', 'Part A', 10, 'EUR');
      expect(service.itemCount()).toBe(1);

      service.addItem('P1', 'Part A', 10, 'EUR');
      expect(service.itemCount()).toBe(2);
    });

    it('should maintain order for multiple sequential addItem calls', () => {
      service.addItem('PART-A', 'Part A', 1, 'EUR');
      service.addItem('PART-B', 'Part B', 2, 'EUR');
      service.addItem('PART-C', 'Part C', 3, 'EUR');

      const codes = service.cartItems().map((i) => i.partCode);
      expect(codes).toEqual(['PART-A', 'PART-B', 'PART-C']);
    });
  });

  // ── removeItem ─────────────────────────────────────────────────────────────

  describe('removeItem()', () => {
    it('should remove item by partCode', () => {
      service.addItem('P1', 'Part 1', 10, 'EUR');
      service.addItem('P2', 'Part 2', 20, 'EUR');

      service.removeItem('P1');

      const cart = service.cartItems();
      expect(cart.length).toBe(1);
      expect(cart[0].partCode).toBe('P2');
    });

    it('should update computed signals after removal', () => {
      service.addItem('P1', 'Part 1', 10, 'EUR');
      service.addItem('P2', 'Part 2', 20, 'EUR');

      service.removeItem('P1');

      expect(service.itemCount()).toBe(1);
      expect(service.totalPrice()).toBe(20);
    });
  });

  // ── increaseQuantity ───────────────────────────────────────────────────────

  describe('increaseQuantity()', () => {
    it('should increase quantity by 1', () => {
      service.addItem('P1', 'Part 1', 10, 'EUR');
      service.increaseQuantity('P1');

      expect(service.cartItems()[0].quantity).toBe(2);
    });

    it('should update computed signals after increaseQuantity', () => {
      service.addItem('P1', 'Part 1', 10, 'EUR');
      service.increaseQuantity('P1');

      expect(service.itemCount()).toBe(2);
      expect(service.totalPrice()).toBe(20);
    });
  });

  // ── decreaseQuantity ───────────────────────────────────────────────────────

  describe('decreaseQuantity()', () => {
    it('should decrease quantity by 1 when quantity > 1', () => {
      service.addItem('P1', 'Part 1', 10, 'EUR');
      service.addItem('P1', 'Part 1', 10, 'EUR'); // quantity = 2
      service.decreaseQuantity('P1');

      expect(service.cartItems()[0].quantity).toBe(1);
    });

    it('should remove item when quantity reaches 1 and decrease is called', () => {
      service.addItem('P1', 'Part 1', 10, 'EUR'); // quantity = 1
      service.decreaseQuantity('P1');

      expect(service.cartItems().length).toBe(0);
    });

    it('should be a no-op for non-existent partCode (early return)', () => {
      service.addItem('P1', 'Part 1', 10, 'EUR');
      const cartBefore = service.cartItems();

      service.decreaseQuantity('NON-EXISTENT');

      expect(service.cartItems()).toEqual(cartBefore);
      expect(service.itemCount()).toBe(1);
    });

    it('should update computed signals after decreaseQuantity', () => {
      service.addItem('P1', 'Part 1', 10, 'EUR');
      service.addItem('P1', 'Part 1', 10, 'EUR'); // quantity = 2
      service.decreaseQuantity('P1');

      expect(service.itemCount()).toBe(1);
      expect(service.totalPrice()).toBe(10);
    });
  });

  // ── clearItems ─────────────────────────────────────────────────────────────

  describe('clearItems()', () => {
    it('should empty items array', () => {
      service.addItem('P1', 'Part 1', 10, 'EUR');
      service.addItem('P2', 'Part 2', 20, 'EUR');
      service.clearItems();

      expect(service.cartItems()).toEqual([]);
    });

    it('should reset totalPrice to 0', () => {
      service.addItem('P1', 'Part 1', 10, 'EUR');
      service.clearItems();

      expect(service.totalPrice()).toBe(0);
    });

    it('should reset itemCount to 0', () => {
      service.addItem('P1', 'Part 1', 10, 'EUR');
      service.addItem('P2', 'Part 2', 20, 'EUR');
      service.clearItems();

      expect(service.itemCount()).toBe(0);
    });
  });

  // ── clear ──────────────────────────────────────────────────────────────────

  describe('clear()', () => {
    it('should clear items and context (full reset)', () => {
      service.addItem('P1', 'Part 1', 10, 'EUR');
      service.context = { source: 'intervention', deviceSn: 'SN001' } as unknown as CartContext;

      service.clear();

      expect(service.cartItems()).toEqual([]);
      expect(service.context).toBeNull();
    });
  });

  // ── Computed signals ───────────────────────────────────────────────────────

  describe('computed signals', () => {
    it('itemCount should sum all quantities correctly', () => {
      service.addItem('P1', 'Part 1', 10, 'EUR');
      service.addItem('P1', 'Part 1', 10, 'EUR'); // qty = 2
      service.addItem('P2', 'Part 2', 5, 'EUR');   // qty = 1

      expect(service.itemCount()).toBe(3);
    });

    it('totalPrice should sum prices correctly with quantities', () => {
      service.addItem('P1', 'Part 1', 10, 'EUR');
      service.addItem('P1', 'Part 1', 10, 'EUR'); // qty=2, subtotal=20
      service.addItem('P2', 'Part 2', 5, 'EUR');  // qty=1, subtotal=5

      expect(service.totalPrice()).toBe(25);
    });

    it('totalPrice should treat null price as 0', () => {
      service.addItem('P1', 'Part 1', null, 'EUR');
      service.addItem('P2', 'Part 2', 15, 'EUR');

      expect(service.totalPrice()).toBe(15);
    });

    it('currency should reflect the first item currency', () => {
      service.addItem('P1', 'Part 1', 10, 'RSD');
      expect(service.currency()).toBe('RSD');
    });

    it('currency should return empty string when cart is empty', () => {
      expect(service.currency()).toBe('');
    });

    it('currency should return empty string after clearItems', () => {
      service.addItem('P1', 'Part 1', 10, 'EUR');
      service.clearItems();

      expect(service.currency()).toBe('');
    });
  });

  // ── addItem — Part variations matrix ──────────────────────────────────────

  describe('addItem() — part variations matrix', () => {
    const partVariations: PartVariation[] = [
      { partCode: 'P-001', name: 'Filter', price: 5.99, currency: 'EUR' },
      { partCode: 'P-002', name: 'Pump', price: 125.00, currency: 'EUR' },
      { partCode: 'P-003', name: 'Valve', price: 0, currency: 'EUR' },
      { partCode: 'P-004', name: '', price: 1, currency: 'EUR' },
      { partCode: 'P-005', name: 'A very long name that exceeds typical field lengths for testing edge cases', price: 9999, currency: 'EUR' },
      { partCode: 'P-006', name: 'Kompresors', price: 450.50, currency: 'RSD' },
      { partCode: 'P-007', name: 'Pumpa', price: null, currency: 'EUR' },
      { partCode: 'P-008', name: 'Grejac', price: 0.01, currency: 'USD' },
      { partCode: 'P-009', name: 'Термостат', price: 75, currency: 'EUR' },
      { partCode: 'P-010', name: 'Part (Special)', price: 200, currency: 'GBP' },
      { partCode: 'PART-LONG-CODE-WITH-DASHES-001', name: 'Long code part', price: 30, currency: 'EUR' },
      { partCode: 'P011', name: 'No dash code', price: 15, currency: 'EUR' },
      { partCode: 'p-lowercase', name: 'Lowercase code', price: 55, currency: 'EUR' },
      { partCode: 'P-013', name: 'Price 1000', price: 1000, currency: 'EUR' },
      { partCode: 'P-014', name: 'Price 10000', price: 10000, currency: 'EUR' },
      { partCode: 'P-015', name: 'Price 0.001', price: 0.001, currency: 'EUR' },
      { partCode: 'P-016', name: 'Price 99.99', price: 99.99, currency: 'EUR' },
      { partCode: 'P-017', name: 'Mixed currency', price: 100, currency: 'CHF' },
      { partCode: 'P-018', name: 'Unicode code 🔧', price: 45, currency: 'EUR' },
      { partCode: 'P-019', name: 'Part with\nnewline', price: 10, currency: 'EUR' },
    ];

    partVariations.forEach((part) => {
      it(`should add part "${part.partCode}" with price ${part.price} and currency "${part.currency}"`, () => {
        service.addItem(part.partCode, part.name, part.price, part.currency);

        const cart = service.cartItems();
        expect(cart.length).toBe(1);
        expect(cart[0].partCode).toBe(part.partCode);
        expect(cart[0].name).toBe(part.name);
        expect(cart[0].price).toBe(part.price);
        expect(cart[0].currency).toBe(part.currency);
        expect(cart[0].quantity).toBe(1);
      });
    });
  });

  // ── addItem — quantity accumulation per repeat add ──────────────────────────

  describe('addItem() — multiple adds of same code accumulate quantity', () => {
    const repeatCounts = [2, 3, 5, 10, 50, 100];

    repeatCounts.forEach((count) => {
      it(`should accumulate quantity=${count} after ${count} addItem calls`, () => {
        for (let i = 0; i < count; i++) {
          service.addItem('P-REPEAT', 'Repeat Part', 10, 'EUR');
        }
        expect(service.cartItems()[0].quantity).toBe(count);
        expect(service.itemCount()).toBe(count);
      });
    });
  });

  // ── totalPrice computation matrix ──────────────────────────────────────────

  describe('totalPrice — price × quantity computation', () => {
    const priceQuantityCases: Array<{ price: number | null; quantity: number; expectedTotal: number }> = [
      { price: 10, quantity: 1, expectedTotal: 10 },
      { price: 10, quantity: 5, expectedTotal: 50 },
      { price: 10, quantity: 10, expectedTotal: 100 },
      { price: 0, quantity: 10, expectedTotal: 0 },
      { price: 0.01, quantity: 100, expectedTotal: 1 },
      { price: 99.99, quantity: 2, expectedTotal: 199.98 },
      { price: 1000, quantity: 3, expectedTotal: 3000 },
      { price: null, quantity: 5, expectedTotal: 0 },
      { price: 0.001, quantity: 1000, expectedTotal: 1 },
      { price: 500, quantity: 1, expectedTotal: 500 },
    ];

    priceQuantityCases.forEach(({ price, quantity, expectedTotal }) => {
      it(`price=${price} × qty=${quantity} should total ≈${expectedTotal}`, () => {
        service.addItem('P-PRICE', 'Part', price, 'EUR');
        // Adjust quantity via repeated adds
        for (let i = 1; i < quantity; i++) {
          service.addItem('P-PRICE', 'Part', price, 'EUR');
        }
        expect(service.totalPrice()).toBeCloseTo(expectedTotal, 5);
      });
    });
  });

  // ── totalPrice — multi-item cart scenarios ─────────────────────────────────

  describe('totalPrice — multi-item cart', () => {
    it('should correctly sum 5 items with different prices', () => {
      service.addItem('P1', 'Part1', 10, 'EUR');
      service.addItem('P2', 'Part2', 20, 'EUR');
      service.addItem('P3', 'Part3', 30, 'EUR');
      service.addItem('P4', 'Part4', 40, 'EUR');
      service.addItem('P5', 'Part5', 50, 'EUR');
      expect(service.totalPrice()).toBe(150);
    });

    it('should correctly sum 10 items with price 1', () => {
      for (let i = 1; i <= 10; i++) {
        service.addItem(`P-${i}`, `Part${i}`, 1, 'EUR');
      }
      expect(service.totalPrice()).toBe(10);
    });

    it('should handle 100 distinct items each priced 1', () => {
      for (let i = 1; i <= 100; i++) {
        service.addItem(`P-${i}`, `Part${i}`, 1, 'EUR');
      }
      expect(service.totalPrice()).toBe(100);
    });

    it('should handle mix of null-price and priced items', () => {
      service.addItem('P1', 'Free part', null, 'EUR');
      service.addItem('P2', 'Paid part', 25, 'EUR');
      service.addItem('P3', 'Another free', null, 'EUR');
      service.addItem('P4', 'Paid', 75, 'EUR');
      expect(service.totalPrice()).toBe(100);
    });

    it('should sum correctly when one item has qty=10 and price=5', () => {
      service.addItem('P1', 'Part', 5, 'EUR');
      for (let i = 1; i < 10; i++) service.addItem('P1', 'Part', 5, 'EUR');
      service.addItem('P2', 'Other', 10, 'EUR');
      // P1: 5*10=50, P2: 10*1=10 => total=60
      expect(service.totalPrice()).toBe(60);
    });

    it('should handle zero total when all prices are null', () => {
      service.addItem('P1', 'A', null, 'EUR');
      service.addItem('P2', 'B', null, 'EUR');
      service.addItem('P3', 'C', null, 'EUR');
      expect(service.totalPrice()).toBe(0);
    });

    it('should maintain total after removeItem', () => {
      service.addItem('P1', 'Part1', 30, 'EUR');
      service.addItem('P2', 'Part2', 70, 'EUR');
      service.removeItem('P1');
      expect(service.totalPrice()).toBe(70);
    });

    it('should maintain total after clearItems', () => {
      service.addItem('P1', 'Part1', 50, 'EUR');
      service.addItem('P2', 'Part2', 50, 'EUR');
      service.clearItems();
      expect(service.totalPrice()).toBe(0);
    });

    it('should sum large amounts correctly', () => {
      service.addItem('P1', 'Expensive', 9999.99, 'EUR');
      service.addItem('P2', 'Also expensive', 9999.99, 'EUR');
      expect(service.totalPrice()).toBeCloseTo(19999.98, 2);
    });

    it('should handle single item with qty=1000 and price=0.001', () => {
      service.addItem('P1', 'Cheap', 0.001, 'EUR');
      for (let i = 1; i < 1000; i++) service.addItem('P1', 'Cheap', 0.001, 'EUR');
      expect(service.totalPrice()).toBeCloseTo(1, 5);
    });
  });

  // ── itemCount — quantity across cart states ────────────────────────────────

  describe('itemCount — various cart states', () => {
    it('should be 0 initially', () => {
      expect(service.itemCount()).toBe(0);
    });

    it('should be 1 after adding one item once', () => {
      service.addItem('P1', 'A', 10, 'EUR');
      expect(service.itemCount()).toBe(1);
    });

    it('should be 10 after adding same item 10 times', () => {
      for (let i = 0; i < 10; i++) service.addItem('P1', 'A', 10, 'EUR');
      expect(service.itemCount()).toBe(10);
    });

    it('should be 3 after adding 3 distinct items', () => {
      service.addItem('P1', 'A', 10, 'EUR');
      service.addItem('P2', 'B', 20, 'EUR');
      service.addItem('P3', 'C', 30, 'EUR');
      expect(service.itemCount()).toBe(3);
    });

    it('should decrease by 1 after decreaseQuantity', () => {
      service.addItem('P1', 'A', 10, 'EUR');
      service.addItem('P1', 'A', 10, 'EUR'); // qty=2
      service.decreaseQuantity('P1');
      expect(service.itemCount()).toBe(1);
    });

    it('should decrease to 0 when decreaseQuantity removes last item', () => {
      service.addItem('P1', 'A', 10, 'EUR'); // qty=1
      service.decreaseQuantity('P1'); // removes
      expect(service.itemCount()).toBe(0);
    });

    it('should reset to 0 after clearItems', () => {
      service.addItem('P1', 'A', 10, 'EUR');
      service.addItem('P2', 'B', 20, 'EUR');
      service.addItem('P1', 'A', 10, 'EUR'); // qty=2 for P1
      service.clearItems();
      expect(service.itemCount()).toBe(0);
    });
  });

  // ── removeItem — various scenarios ────────────────────────────────────────

  describe('removeItem() — various scenarios', () => {
    it('should be no-op when removing non-existent code', () => {
      service.addItem('P1', 'A', 10, 'EUR');
      service.removeItem('NON-EXISTENT');
      expect(service.cartItems().length).toBe(1);
    });

    it('should reduce cart to 0 when removing last item', () => {
      service.addItem('P1', 'A', 10, 'EUR');
      service.removeItem('P1');
      expect(service.cartItems().length).toBe(0);
    });

    it('should remove correct item when multiple items share same price', () => {
      service.addItem('P1', 'A', 10, 'EUR');
      service.addItem('P2', 'B', 10, 'EUR');
      service.removeItem('P1');
      expect(service.cartItems().length).toBe(1);
      expect(service.cartItems()[0].partCode).toBe('P2');
    });

    it('should remove item with qty>1 completely (not just decrease)', () => {
      service.addItem('P1', 'A', 10, 'EUR');
      service.addItem('P1', 'A', 10, 'EUR'); // qty=2
      service.removeItem('P1');
      expect(service.cartItems().length).toBe(0);
    });

    it('should not affect other items when removing middle item', () => {
      service.addItem('P1', 'A', 10, 'EUR');
      service.addItem('P2', 'B', 20, 'EUR');
      service.addItem('P3', 'C', 30, 'EUR');
      service.removeItem('P2');
      const codes = service.cartItems().map((i) => i.partCode);
      expect(codes).toEqual(['P1', 'P3']);
    });
  });

  // ── increaseQuantity — chained calls ──────────────────────────────────────

  describe('increaseQuantity() — chained calls', () => {
    it('should reach qty=5 after 4 increaseQuantity calls', () => {
      service.addItem('P1', 'A', 10, 'EUR'); // qty=1
      for (let i = 0; i < 4; i++) service.increaseQuantity('P1');
      expect(service.cartItems()[0].quantity).toBe(5);
    });

    it('should be no-op on non-existent item', () => {
      service.addItem('P1', 'A', 10, 'EUR');
      service.increaseQuantity('P-MISSING');
      expect(service.cartItems()[0].quantity).toBe(1);
    });

    it('should update totalPrice accordingly', () => {
      service.addItem('P1', 'A', 10, 'EUR');
      service.increaseQuantity('P1'); // qty=2
      service.increaseQuantity('P1'); // qty=3
      expect(service.totalPrice()).toBe(30);
    });
  });

  // ── decreaseQuantity — edge cases ─────────────────────────────────────────

  describe('decreaseQuantity() — edge cases', () => {
    it('should remove item when qty is exactly 1', () => {
      service.addItem('P1', 'A', 10, 'EUR');
      service.decreaseQuantity('P1');
      expect(service.cartItems().length).toBe(0);
    });

    it('should not remove item when qty > 1', () => {
      service.addItem('P1', 'A', 10, 'EUR');
      service.addItem('P1', 'A', 10, 'EUR'); // qty=2
      service.decreaseQuantity('P1');
      expect(service.cartItems().length).toBe(1);
    });

    it('should leave cart empty after decreasing only item at qty=1', () => {
      service.addItem('P1', 'A', 10, 'EUR');
      service.decreaseQuantity('P1');
      expect(service.cartItems()).toEqual([]);
    });
  });

  // ── currency — various scenarios ──────────────────────────────────────────

  describe('currency — various scenarios', () => {
    const currencies = ['EUR', 'RSD', 'USD', 'GBP', 'CHF'];

    currencies.forEach((currency) => {
      it(`should reflect currency="${currency}" from first item`, () => {
        service.addItem('P1', 'A', 10, currency);
        expect(service.currency()).toBe(currency);
      });
    });

    it('should return first item currency when multiple items added', () => {
      service.addItem('P1', 'A', 10, 'EUR');
      service.addItem('P2', 'B', 20, 'RSD');
      expect(service.currency()).toBe('EUR');
    });

    it('should return empty string when only item is removed', () => {
      service.addItem('P1', 'A', 10, 'EUR');
      service.removeItem('P1');
      expect(service.currency()).toBe('');
    });
  });

  // ── Context management ─────────────────────────────────────────────────────

  describe('context management', () => {
    it('setContext: should store context (deviceSn, deviceType, etc.)', () => {
      const ctx: CartContext = {
        source: 'intervention',
        deviceType: 'GAS_BOILER',
        deviceCode: 'GENUS-ONE-24',
        deviceName: 'Genus One',
        warrantyStatus: 'valid',
        userName: 'Marko',
        userAddress: 'Beograd',
        userPhone: '+381601234567',
      };

      service.context = ctx;

      expect(service.context).toEqual(ctx);
      expect(service.context!.source).toBe('intervention');
      expect(service.context!.deviceType).toBe('GAS_BOILER');
    });

    it('clearContext: clear() should clear context without affecting previous items check', () => {
      service.context = { source: 'home' };
      service.addItem('P1', 'Part', 5, 'EUR');

      service.clear();

      expect(service.context).toBeNull();
      expect(service.cartItems()).toEqual([]);
    });

    it('context should remain null when not set', () => {
      service.addItem('P1', 'Part', 5, 'EUR');
      expect(service.context).toBeNull();
    });
  });
});
