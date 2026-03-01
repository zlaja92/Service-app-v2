import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonList, IonItem, IonLabel, IonButton, IonIcon, IonMenuButton,
  IonTextarea, IonFooter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, remove, cartOutline } from 'ionicons/icons';
import { TranslocoModule } from '@jsverse/transloco';
import { CartService } from './cart.service';
import { ConfigStore } from '../../core/config/config.store';
import { LoggerService } from '../../core/logger/logger.service';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.page.html',
  styleUrls: ['./cart.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonList, IonItem, IonLabel, IonButton, IonIcon, IonMenuButton,
    IonTextarea, IonFooter,
    TranslocoModule, DecimalPipe,
  ],
})
export class CartPage {
  protected cartService = inject(CartService);
  protected configStore = inject(ConfigStore);
  private router = inject(Router);
  private logger = inject(LoggerService);

  orderNote = signal('');

  constructor() {
    addIcons({ add, remove, cartOutline });
  }

  onNoteChange(event: CustomEvent): void {
    this.orderNote.set(event.detail.value ?? '');
  }

  onOrder(): void {
    this.logger.info('Order placed', {
      items: this.cartService.cartItems(),
      note: this.orderNote(),
      total: this.cartService.totalPrice(),
    });
    // TODO: integrate with backend order service
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
