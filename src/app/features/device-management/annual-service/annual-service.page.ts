import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonMenuButton, IonLabel, IonCard,
  IonGrid, IonRow, IonCol,
  IonSpinner,
  ViewWillEnter, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DeviceLookupService } from '../services/device-lookup.service';
import { InterventionService } from '../services/intervention.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { Device, DeviceType } from '../../../shared/models/device.model';
import {
  ANNUAL_SERVICE_TYPES,
  ANNUAL_SERVICE_DESCRIPTION,
  DEFAULT_DISTANCE,
  InterventionType,
} from '../models/intervention.model';

@Component({
  selector: 'app-annual-service',
  templateUrl: './annual-service.page.html',
  styleUrls: ['./annual-service.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonButton, IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption,
    IonMenuButton, IonLabel, IonCard,
    IonGrid, IonRow, IonCol,
    IonSpinner,
    TranslocoModule,
  ],
})
export class AnnualServicePage implements ViewWillEnter {
  private readonly lookupService = inject(DeviceLookupService);
  private readonly interventionService = inject(InterventionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly logger = inject(LoggerService);

  protected sn = '';
  protected noDevice = false;
  protected isSaving = false;
  protected serviceType: InterventionType | null = null;
  protected readonly todayFormatted = this.formatToday();

  protected form = new FormGroup({
    callAccepted: new FormControl<boolean | null>(null),
    distance: new FormControl(DEFAULT_DISTANCE, { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
  });

  ionViewWillEnter(): void {
    this.sn = this.route.snapshot.paramMap.get('sn') ?? '';
    const device = this.lookupService.device;

    if (!device) {
      this.noDevice = true;
      this.logger.warn('AnnualServicePage: no device data', { sn: this.sn });
      return;
    }

    this.noDevice = false;
    this.serviceType = ANNUAL_SERVICE_TYPES[device.type] ?? null;

    if (!this.serviceType) {
      this.logger.warn('AnnualServicePage: no annual service type for device', {
        sn: this.sn,
        deviceType: device.type,
      });
      void this.showToast(this.transloco.translate('annual_service_no_type'), 'warning');
    }

    this.resetForm();
  }

  async onSave(): Promise<void> {
    if (!this.validateForm()) return;

    const confirmed = await this.showConfirmAlert();
    if (!confirmed) return;

    const device = this.lookupService.device;
    if (!device || !this.serviceType) return;

    this.isSaving = true;

    const formValue = this.form.getRawValue();
    const data = this.buildInterventionData(formValue);

    const docId = await this.interventionService.saveIntervention(this.sn, device, data);

    if (!docId) {
      this.isSaving = false;
      await this.showToast(this.transloco.translate('annual_service_save_error'), 'danger');
      return;
    }

    await this.saveForConnectedDevice(device, data);

    this.isSaving = false;
    await this.showToast(this.transloco.translate('annual_service_save_success'), 'success');
    void this.router.navigate(['/device-management', this.sn]);
  }

  private buildInterventionData(formValue: { callAccepted: boolean | null; distance: string; note: string }): Record<string, unknown> {
    return {
      interventionType: {
        code: this.serviceType!.code,
        name: this.serviceType!.name,
      },
      description: ANNUAL_SERVICE_DESCRIPTION,
      callAccepted: formValue.callAccepted,
      distance: formValue.distance,
      note: formValue.note,
      date: this.todayFormatted,
    };
  }

  private async saveForConnectedDevice(device: Device, data: Record<string, unknown>): Promise<void> {
    if (device.type !== DeviceType.HEAT_PUMP) return;

    const registration = await this.interventionService.getRegistration(this.sn);
    const connectedSn = registration?.['connectedDevice'] as string | undefined;

    if (!connectedSn) return;

    const connectedDevice = await this.lookupService.lookup(connectedSn);

    if (!connectedDevice) {
      this.logger.warn('AnnualServicePage: connected device not found', { connectedSn });
      await this.showToast(this.transloco.translate('annual_service_connected_not_found'), 'warning');
      return;
    }

    await this.interventionService.saveIntervention(connectedSn, connectedDevice, data);
    this.logger.info('Annual service saved for connected device', { connectedSn });
  }

  private validateForm(): boolean {
    const value = this.form.getRawValue();

    if (value.callAccepted == null) {
      void this.showToast(
        this.transloco.translate('annual_service_validation_call_accepted'),
        'warning',
      );
      return false;
    }

    return true;
  }

  private async showConfirmAlert(): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: this.transloco.translate('annual_service_confirm_title'),
        message: this.transloco.translate('annual_service_confirm_message'),
        buttons: [
          {
            text: this.transloco.translate('annual_service_confirm_cancel'),
            role: 'cancel',
            handler: () => resolve(false),
          },
          {
            text: this.transloco.translate('annual_service_confirm_save'),
            handler: () => resolve(true),
          },
        ],
      });
      await alert.present();
    });
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

  private resetForm(): void {
    this.form.reset({
      callAccepted: null,
      distance: DEFAULT_DISTANCE,
      note: '',
    });
  }

  private formatToday(): string {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  }
}
