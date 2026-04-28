import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonItem, IonInput, IonTextarea, IonSpinner,
  IonMenuButton, IonLabel, IonCard, IonCardHeader, IonCardSubtitle, IonCardContent,
  ViewWillEnter, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DeviceLookupService } from '../services/device-lookup.service';
import { InterventionService } from '../services/intervention.service';
import { DeviceEnvInfoService } from '../services/device-env-info.service';
import { InterventionType, COMMISSIONING_DESCRIPTION } from '../models/intervention.model';
import { requiresEnvInfo } from '../models/device-env-info.model';
import { LoggerService } from '../../../core/logger/logger.service';

@Component({
  selector: 'app-add-device',
  templateUrl: './add-device.page.html',
  styleUrls: ['./add-device.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonButton, IonItem, IonInput, IonTextarea, IonSpinner,
    IonMenuButton, IonLabel, IonCard, IonCardHeader, IonCardSubtitle, IonCardContent,
    TranslocoModule,
  ],
})
export class AddDevicePage implements ViewWillEnter {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly lookupService = inject(DeviceLookupService);
  private readonly interventionService = inject(InterventionService);
  private readonly envInfoService = inject(DeviceEnvInfoService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly logger = inject(LoggerService);

  protected sn = '';
  protected isSaving = false;
  private connectedSn = '';

  protected form = new FormGroup({
    installerName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    installerPhoneNumber: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(9)] }),
    note: new FormControl('', { nonNullable: true }),
  });

  ionViewWillEnter(): void {
    this.isSaving = false;
    this.sn = this.route.snapshot.paramMap.get('sn') ?? '';
    this.connectedSn = this.route.snapshot.queryParamMap.get('connectedSn') ?? '';
    this.form.reset();
  }

  async onSave(): Promise<void> {
    if (!this.validateForm()) return;

    const device = this.lookupService.device;
    if (!device) return;

    const formValue = this.form.getRawValue();

    const data: Record<string, unknown> = {
      interventionType: InterventionType.COMMISSIONING,
      interventionDescription: COMMISSIONING_DESCRIPTION,
      installerName: formValue.installerName,
      installerPhoneNumber: formValue.installerPhoneNumber,
      note: formValue.note,
    };

    if (requiresEnvInfo(device.type)) {
      const envInfo = await this.envInfoService.collectEnvInfo(device.type, this.sn, null);
      if (!envInfo) return;
      data['envInfo'] = envInfo;
    } else {
      const confirmed = await this.showConfirmAlert();
      if (!confirmed) return;
    }

    this.isSaving = true;

    let success: boolean;

    if (this.connectedSn) {
      success = await this.interventionService.saveInterventionBatch([
        { sn: this.sn, device, formData: data },
        { sn: this.connectedSn, device, formData: data },
      ]);
    } else {
      success = !!(await this.interventionService.saveIntervention(this.sn, device, data));
    }

    if (success) {
      void this.showToast(this.transloco.translate('commissioning_success'), 'success');
      void this.router.navigate(['/device-management', this.sn]);
    } else {
      this.isSaving = false;
      void this.showToast(this.transloco.translate('commissioning_error'), 'danger');
    }
  }

  private async showConfirmAlert(): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: this.transloco.translate('commissioning_confirm_title'),
        message: this.transloco.translate('commissioning_confirm_message'),
        buttons: [
          {
            text: this.transloco.translate('commissioning_confirm_cancel'),
            role: 'cancel',
            handler: () => resolve(false),
          },
          {
            text: this.transloco.translate('commissioning_confirm_save'),
            handler: () => resolve(true),
          },
        ],
      });
      await alert.present();
    });
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

    if (this.form.controls.installerPhoneNumber.hasError('minlength')) {
      void this.showToast(
        this.transloco.translate('commissioning_validation_phone_min_length'),
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
