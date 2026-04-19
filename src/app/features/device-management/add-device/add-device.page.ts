import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonItem, IonInput,
  IonMenuButton, IonLabel, IonCard, IonCardHeader, IonCardSubtitle, IonCardContent,
  ViewWillEnter, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DeviceLookupService } from '../services/device-lookup.service';
import { InterventionService } from '../services/intervention.service';
import { ServerTimeService } from '../../../core/firebase/server-time.service';
import { LoggerService } from '../../../core/logger/logger.service';

@Component({
  selector: 'app-add-device',
  templateUrl: './add-device.page.html',
  styleUrls: ['./add-device.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonButton, IonItem, IonInput,
    IonMenuButton, IonLabel, IonCard, IonCardHeader, IonCardSubtitle, IonCardContent,
    TranslocoModule,
  ],
})
export class AddDevicePage implements ViewWillEnter {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly lookupService = inject(DeviceLookupService);
  private readonly interventionService = inject(InterventionService);
  private readonly serverTimeService = inject(ServerTimeService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly logger = inject(LoggerService);

  protected sn = '';

  protected form = new FormGroup({
    installerName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    installerPhoneNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ionViewWillEnter(): void {
    this.sn = this.route.snapshot.paramMap.get('sn') ?? '';
    this.form.reset();
  }

  async onSave(): Promise<void> {
    if (!this.validateForm()) return;

    const device = this.lookupService.device;
    if (!device) return;

    const formValue = this.form.getRawValue();

    const alert = await this.alertCtrl.create({
      header: this.transloco.translate('commissioning_confirm_title'),
      message: this.transloco.translate('commissioning_confirm_message'),
      buttons: [
        {
          text: this.transloco.translate('commissioning_confirm_cancel'),
          role: 'cancel',
        },
        {
          text: this.transloco.translate('commissioning_confirm_save'),
          handler: () => {
            void this.saveAndNavigate(alert, formValue);
            return false;
          },
        },
      ],
    });
    await alert.present();
  }

  private async saveAndNavigate(
    alert: HTMLIonAlertElement,
    formValue: { installerName: string; installerPhoneNumber: string },
  ): Promise<void> {
    const saveButton = alert.querySelector('.alert-button:last-child') as HTMLElement | null;
    if (saveButton) {
      saveButton.textContent = '';
      const spinner = document.createElement('ion-spinner');
      spinner.setAttribute('name', 'crescent');
      saveButton.appendChild(spinner);
    }

    const device = this.lookupService.device;
    if (!device) {
      await alert.dismiss();
      return;
    }

    const serverTime = await this.serverTimeService.getServerTime();
    if (!serverTime) {
      await alert.dismiss();
      void this.showToast(this.transloco.translate('commissioning_server_time_error'), 'danger');
      return;
    }

    const day = String(serverTime.getDate()).padStart(2, '0');
    const month = String(serverTime.getMonth() + 1).padStart(2, '0');
    const formattedDate = `${day}/${month}/${serverTime.getFullYear()}`;

    const docId = await this.interventionService.saveIntervention(this.sn, device, {
      interventionType: { code: 'commissioning', name: 'PUŠTANJE U RAD' },
      description: 'Puštanje u rad',
      installerName: formValue.installerName,
      installerPhoneNumber: formValue.installerPhoneNumber,
      date: formattedDate,
    });

    await alert.dismiss();

    if (docId) {
      void this.showToast(this.transloco.translate('commissioning_success'), 'success');
      void this.router.navigate(['/device-management', this.sn]);
    } else {
      void this.showToast(this.transloco.translate('commissioning_error'), 'danger');
    }
  }

  private validateForm(): boolean {
    const value = this.form.getRawValue();
    const missing: string[] = [];

    if (!value.installerName.trim()) missing.push(this.transloco.translate('commissioning_installer_name'));
    if (!value.installerPhoneNumber.trim()) missing.push(this.transloco.translate('commissioning_installer_phone'));

    if (missing.length > 0) {
      void this.showToast(
        this.transloco.translate('commissioning_validation_message', { fields: missing.join(', ') }),
        'warning',
      );
      return false;
    }

    return true;
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
