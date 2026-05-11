import { Injectable, inject } from '@angular/core';
import { AlertController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly alertCtrl = inject(AlertController);
  private readonly transloco = inject(TranslocoService);

  /**
   * Shows a confirmation alert with translated header, message, cancel and confirm buttons.
   * Returns true if user confirms, false if cancels.
   *
   * @param headerKey - i18n key for alert header
   * @param messageKey - i18n key for alert message
   * @param confirmKey - i18n key for confirm button text
   * @param cancelKey - i18n key for cancel button text
   */
  async confirm(
    headerKey: string,
    messageKey: string,
    confirmKey: string,
    cancelKey: string,
  ): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: this.transloco.translate(headerKey),
        message: this.transloco.translate(messageKey),
        buttons: [
          {
            text: this.transloco.translate(cancelKey),
            role: 'cancel',
            handler: () => resolve(false),
          },
          {
            text: this.transloco.translate(confirmKey),
            handler: () => resolve(true),
          },
        ],
      });
      await alert.present();
    });
  }

  /**
   * Shows a warning alert with a single OK button. Resolves when the user dismisses it.
   *
   * @param messageKey - i18n key for alert message (required)
   * @param headerKey - i18n key for alert header (default: 'common_warning_title')
   * @param okKey - i18n key for OK button text (default: 'common_warning_understood')
   */
  async warn(
    messageKey: string,
    headerKey: string = 'common_warning_title',
    okKey: string = 'common_warning_understood',
  ): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.transloco.translate(headerKey),
      message: this.transloco.translate(messageKey),
      backdropDismiss: false,
      buttons: [{
        text: this.transloco.translate(okKey),
        role: 'confirm',
      }],
    });
    await alert.present();
    await alert.onDidDismiss();
  }
}
