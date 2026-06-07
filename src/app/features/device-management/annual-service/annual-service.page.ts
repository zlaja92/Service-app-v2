import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonMenuButton, IonLabel, IonCard,
  IonGrid, IonRow, IonCol,
  IonSpinner,
  ViewWillEnter, ToastController,
} from '@ionic/angular/standalone';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DeviceLookupService } from '../services/device-lookup.service';
import { InterventionService } from '../services/intervention.service';
import { DeviceEnvInfoService } from '../services/device-env-info.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { LoadingAlertService } from '../../../shared/services/loading-alert.service';
import { SignatureService } from '../../signature/services/signature.service';
import { ConfigStore } from '../../../core/config/config.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { Device, DeviceType } from '../../../shared/models/device.model';
import { requiresEnvInfo } from '../models/device-env-info.model';
import {
  InterventionType,
  InterventionTypeOption,
  ANNUAL_SERVICE_TYPES,
  ANNUAL_SERVICE_DESCRIPTION,
  DEFAULT_DISTANCE,
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
  private readonly envInfoService = inject(DeviceEnvInfoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly logger = inject(LoggerService);
  private readonly confirmService = inject(ConfirmService);
  private readonly loadingAlert = inject(LoadingAlertService);
  private readonly signatureService = inject(SignatureService);
  private readonly configStore = inject(ConfigStore);

  protected sn = '';
  protected noDevice = false;
  protected isSaving = false;
  protected serviceType: InterventionTypeOption | null = null;
  protected readonly todayFormatted = this.formatToday();

  protected form = new FormGroup({
    callAccepted: new FormControl<boolean | null>(null),
    distance: new FormControl(DEFAULT_DISTANCE, { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
  });

  ionViewWillEnter(): void {
    this.isSaving = false;
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
      void this.showToast(this.transloco.translate('annual_service_no_type'));
    }

    this.resetForm();
  }

  async onSave(): Promise<void> {
    if (!this.validateForm()) return;

    const device = this.lookupService.device;
    if (!device || !this.serviceType) return;

    const formValue = this.form.getRawValue();
    const data: Record<string, unknown> = {
      warrantyStatus: 'in-warranty',
      interventionType: InterventionType.ANNUAL_SERVICE,
      interventionDescription: ANNUAL_SERVICE_DESCRIPTION,
      callAccepted: formValue.callAccepted,
      distance: formValue.distance,
      note: formValue.note,
    };

    if (requiresEnvInfo(device.type)) {
      await this.loadingAlert.show();
      const prefill = await this.envInfoService.getLastEnvInfo(this.sn, device.type);
      await this.loadingAlert.hide();
      const envInfo = await this.envInfoService.collectEnvInfo(device.type, this.sn, prefill, device.subType);
      if (!envInfo) return;
      data['envInfo'] = envInfo;
    } else {
      const confirmed = await this.showConfirmAlert();
      if (!confirmed) return;
    }

    if (this.configStore.isFeatureEnabled('signatureCapture')
      && (this.configStore.business()?.signature?.annualService ?? false)) {
      const signaturePath = await this.signatureService.captureAndUpload({ sn: this.sn, deviceType: device.type });
      if (!signaturePath) return;
      data['signaturePath'] = signaturePath;
    }

    await this.loadingAlert.show();
    const docId = await this.interventionService.saveIntervention(this.sn, device, data);

    if (!docId) {
      await this.loadingAlert.hide();
      await this.showToast(this.transloco.translate('annual_service_save_error'));
      return;
    }

    await this.saveForConnectedDevice(device, data);

    void this.router.navigate(['/device-management', this.sn]).then(() => {
      void this.loadingAlert.hide();
      void this.showToast(this.transloco.translate('annual_service_save_success'));
    });
  }

  private async saveForConnectedDevice(device: Device, data: Record<string, unknown>): Promise<void> {
    if (device.type !== DeviceType.HEAT_PUMP) return;

    const registration = await this.interventionService.getRegistration(this.sn);
    const connectedSn = registration?.['connectedDevice'] as string | undefined;

    if (!connectedSn) return;

    const connectedDevice = await this.lookupService.lookupSilent(connectedSn);

    if (!connectedDevice) {
      this.logger.warn('AnnualServicePage: connected device not found', { connectedSn });
      await this.showToast(this.transloco.translate('annual_service_connected_not_found'));
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
      );
      return false;
    }

    return true;
  }

  private showConfirmAlert(): Promise<boolean> {
    return this.confirmService.confirm(
      'annual_service_confirm_title',
      'annual_service_confirm_message',
      'annual_service_confirm_save',
      'annual_service_confirm_cancel',
    );
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
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
