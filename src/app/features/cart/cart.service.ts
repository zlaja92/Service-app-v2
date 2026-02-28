import { Injectable, computed, signal } from '@angular/core';

export interface CartItem {
  partCode: string;
  name: string;
  price: number | null;
  currency: string;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private items = signal<CartItem[]>([]);

  readonly cartItems = this.items.asReadonly();
  readonly itemCount = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));

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

  clear(): void {
    this.items.set([]);
  }
}
