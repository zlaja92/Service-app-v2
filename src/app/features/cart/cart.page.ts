import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonList, IonItem, IonLabel, IonButton, IonIcon, IonMenuButton,
  IonTextarea, IonFooter,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, remove, cartOutline } from 'ionicons/icons';
import { TranslocoModule } from '@jsverse/transloco';
import { EmailComposer } from 'capacitor-email-composer';
import { TranslocoService } from '@jsverse/transloco';
import { CartService } from './cart.service';
import { ConfigStore } from '../../core/config/config.store';
import { AuthStore } from '../../core/auth/auth.store';
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
  private authStore = inject(AuthStore);
  private transloco = inject(TranslocoService);
  private router = inject(Router);
  private logger = inject(LoggerService);
  private toastCtrl = inject(ToastController);

  orderNote = signal('');

  constructor() {
    addIcons({ add, remove, cartOutline });
  }

  onNoteChange(event: CustomEvent): void {
    this.orderNote.set(event.detail.value ?? '');
  }

  async onOrder(): Promise<void> {
    const items = this.cartService.cartItems();
    const ctx = this.cartService.context ?? { source: 'home' as const };
    const currency = this.configStore.business()?.currency ?? '';
    const total = this.cartService.totalPrice();

    const deviceLabel = ctx.deviceCode && ctx.deviceName
      ? `${ctx.deviceCode} - ${ctx.deviceName}` : '';

    const itemLines = items.map(item =>
      this.transloco.translate('order_item_template', {
        name: item.name,
        code: item.partCode,
        quantity: item.quantity,
        price: (item.price ?? 0).toFixed(2),
        currency,
        device: deviceLabel,
      }),
    ).join('\n\n');

    let warrantyLine = '';
    if (ctx.source === 'intervention' && ctx.warrantyStatus) {
      warrantyLine = ctx.warrantyStatus === 'in-warranty'
        ? this.transloco.translate('order_warranty_in')
        : this.transloco.translate('order_warranty_out');
    }

    let userLine: string;
    if (ctx.source === 'intervention' && ctx.userName) {
      userLine = this.transloco.translate('order_user_info', {
        name: ctx.userName,
        address: ctx.userAddress ?? '',
        phone: ctx.userPhone ?? '',
      });
    } else {
      userLine = this.transloco.translate('order_no_user');
    }

    const body = this.transloco.translate('order_email_body', {
      items: itemLines,
      total: total.toFixed(2),
      currency,
      servicer: this.authStore.userEmail(),
      warrantyLine,
      userLine,
      appTitle: this.configStore.appTitle(),
    });

    this.logger.info('Order email', { itemCount: items.length, total });

    const recipients = this.configStore.business()?.orderEmailRecipients ?? {};
    const raw = ctx.deviceType ? recipients[ctx.deviceType] : undefined;
    const toEmails = Array.isArray(raw)
      ? raw.filter(e => typeof e === 'string' && e.trim() !== '')
      : (typeof raw === 'string' && raw.trim() !== '' ? [raw] : []);

    // iOS crashes hard if the mail composer is opened with no mail account set
    // up: MFMailComposeViewController.canSendMail() returns NO, the plugin still
    // tries to present a nil controller and the app terminates with
    // NSInvalidArgumentException. Ask first and bail out with a message instead.
    //
    // The guard is effectively iOS-only: the Android plugin hardcodes
    // hasAccount: true, so there it never blocks and a missing mail app surfaces
    // as a rejected open() below. The check itself is a native bridge call and
    // can reject where the plugin has no implementation (e.g. a browser during
    // development), so treat that as "unknown" and let open() decide.
    let hasAccount = true;
    try {
      ({ hasAccount } = await EmailComposer.hasAccount());
    } catch (error) {
      this.logger.warn('Order email: mail account check unavailable', { error: String(error) });
    }

    if (!hasAccount) {
      this.logger.warn('Order email: no mail account configured on device');
      await this.showToast(this.transloco.translate('cart_email_no_account'));
      return;
    }

    try {
      await EmailComposer.open({
        to: toEmails,
        subject: this.transloco.translate('order_email_subject'),
        body,
        isHtml: false,
      });
    } catch (error) {
      this.logger.error('Order email: failed to open composer', { error: String(error) });
      await this.showToast(this.transloco.translate('cart_email_open_error'));
    }
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom',
    });
    await toast.present();
  }
}
