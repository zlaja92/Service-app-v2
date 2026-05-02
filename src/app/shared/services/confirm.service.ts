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
}
