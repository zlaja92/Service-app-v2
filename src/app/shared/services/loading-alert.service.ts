import { Injectable, inject } from '@angular/core';
import { LoadingController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';

@Injectable({ providedIn: 'root' })
export class LoadingAlertService {
  private readonly loadingCtrl = inject(LoadingController);
  private readonly transloco = inject(TranslocoService);
  private loading: HTMLIonLoadingElement | null = null;

  async show(messageKey = 'loading_please_wait', timeoutMs = 30000): Promise<void> {
    this.loading = await this.loadingCtrl.create({
      message: this.transloco.translate(messageKey),
      spinner: 'crescent',
      duration: timeoutMs,
      cssClass: 'fullscreen-loading',
      backdropDismiss: false,
    });
    await this.loading.present();
  }

  async hide(): Promise<void> {
    await this.loading?.dismiss();
    this.loading = null;
  }

  /**
   * Prikazuje loading spinner dok se async operacija izvršava.
   * Automatski ga sakriva nakon završetka (uspeh ili greška).
   * Timeout: ako operacija traje duže od timeoutMs, spinner se zatvara.
   */
  async wrap<T>(operation: () => Promise<T>, messageKey = 'loading_please_wait', timeoutMs = 30000): Promise<T> {
    await this.show(messageKey, timeoutMs);
    try {
      return await operation();
    } finally {
      await this.hide();
    }
  }
}
