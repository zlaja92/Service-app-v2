import { Injectable, inject } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { AlertController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '../logger/logger.service';
import { compareVersions } from '../../shared/utils/version';

/**
 * App-level notices driven by tenant business config:
 *  - a blocking "minimum version" gate, and
 *  - an optional "start info" message on entering the app.
 * Both texts are translated i18n keys.
 */
@Injectable({ providedIn: 'root' })
export class AppNoticeService {
  private alertCtrl = inject(AlertController);
  private transloco = inject(TranslocoService);
  private logger = inject(LoggerService);

  /**
   * If the installed app version is below `minVersion`, shows a permanent,
   * button-less, non-dismissible blocking notice and returns true (blocked).
   * Only runs on native (the version is unavailable on the web dev build).
   */
  async enforceMinVersion(minVersion?: string): Promise<boolean> {
    if (!minVersion || !minVersion.trim()) return false;
    if (!Capacitor.isNativePlatform()) return false;

    let current: string;
    try {
      current = (await App.getInfo()).version;
    } catch (error) {
      this.logger.warn('Could not read app version; skipping version gate', { error: String(error) });
      return false;
    }

    if (compareVersions(current, minVersion) >= 0) return false;

    this.logger.warn('App version below minimum — blocking', { current, minVersion });
    // The blocking gate stops the normal flow, so hide the splash ourselves —
    // otherwise it stays up and covers the notice.
    await this.hideSplash();
    const alert = await this.alertCtrl.create({
      header: this.transloco.translate('app_version_min_title'),
      message: this.transloco.translate('app_version_min_message'),
      backdropDismiss: false,
      buttons: [],
    });
    await alert.present();
    return true;
  }

  /** Shows the start-info notice (translated, with an OK button) when enabled. */
  async showStartInfo(enabled?: boolean): Promise<void> {
    if (!enabled) return;
    await this.hideSplash();
    const alert = await this.alertCtrl.create({
      header: this.transloco.translate('start_info_title'),
      message: this.transloco.translate('start_info_message'),
      backdropDismiss: false,
      buttons: [this.transloco.translate('common_warning_understood')],
    });
    await alert.present();
    await alert.onDidDismiss();
  }

  private async hideSplash(): Promise<void> {
    try {
      await SplashScreen.hide();
    } catch {
      // No splash / not native — ignore.
    }
  }
}
