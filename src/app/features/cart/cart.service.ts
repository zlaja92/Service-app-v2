import { Injectable, computed, signal } from '@angular/core';
import { Clearable } from '../../core/session/clearable';

export interface CartItem {
  partCode: string;
  name: string;
  price: number | null;
  currency: string;
  quantity: number;
}

export interface CartContext {
  source: 'intervention' | 'home';
  deviceCode?: string;
  deviceName?: string;
  warrantyStatus?: string;
  userName?: string;
  userAddress?: string;
  userPhone?: string;
}

@Injectable({ providedIn: 'root' })
export class CartService implements Clearable {
  private items = signal<CartItem[]>([]);
  context: CartContext | null = null;

  readonly cartItems = this.items.asReadonly();
  readonly itemCount = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));
  readonly totalPrice = computed(() =>
    this.items().reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0),
  );
  readonly currency = computed(() => this.items()[0]?.currency ?? '');

  addItem(partCode: string, name: string, price: number | null, currency: string): void {
    const current = this.items();
    const existing = current.find((item) => item.partCode === partCode);

    if (existing) {
      this.items.set(current.map((item) =>
        item.partCode === partCode ? { ...item, quantity: item.quantity + 1 } : item,
      ));
    } else {
      this.items.set([...current, { partCode, name, price, currency, quantity: 1 }]);
    }
  }

  removeItem(partCode: string): void {
    this.items.set(this.items().filter((item) => item.partCode !== partCode));
  }

  increaseQuantity(partCode: string): void {
    this.items.set(this.items().map((item) =>
      item.partCode === partCode ? { ...item, quantity: item.quantity + 1 } : item,
    ));
  }

  decreaseQuantity(partCode: string): void {
    const item = this.items().find((i) => i.partCode === partCode);
    if (!item) return;

    if (item.quantity <= 1) {
      this.removeItem(partCode);
    } else {
      this.items.set(this.items().map((i) =>
        i.partCode === partCode ? { ...i, quantity: i.quantity - 1 } : i,
      ));
    }
  }

  clearItems(): void {
    this.items.set([]);
  }

  clear(): void {
    this.items.set([]);
    this.context = null;
  }
}
