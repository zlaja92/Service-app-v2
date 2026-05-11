import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonItem, IonInput, IonTextarea, IonSpinner, IonIcon, IonNote,
  IonSelect, IonSelectOption,
  IonMenuButton, IonLabel, IonCard, IonCardContent,
  ViewWillEnter, ToastController, ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cameraOutline, informationCircleOutline } from 'ionicons/icons';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DeviceLookupService } from '../services/device-lookup.service';
import { InterventionService } from '../services/intervention.service';
import { DeviceEnvInfoService } from '../services/device-env-info.service';
import { InterventionType, COMMISSIONING_DESCRIPTION } from '../models/intervention.model';
import { DeviceType } from '../../../shared/models/device.model';
import { requiresEnvInfo } from '../models/device-env-info.model';
import { LoggerService } from '../../../core/logger/logger.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { LoadingAlertService } from '../../../shared/services/loading-alert.service';
import { ConfigStore } from '../../../core/config/config.store';
import { PhotoRequirement } from '../../../core/config/config.model';
import { PhotoService } from '../../photo-upload/services/photo.service';
import { PhotoUploadPage } from '../../photo-upload/photo-upload.page';

@Component({
  selector: 'app-add-device',
  templateUrl: './add-device.page.html',
  styleUrls: ['./add-device.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonButton, IonItem, IonInput, IonTextarea, IonSpinner, IonIcon, IonNote,
    IonSelect, IonSelectOption,
    IonMenuButton, IonLabel, IonCard, IonCardContent,
    TranslocoModule,
  ],
})
export class AddDevicePage implements ViewWillEnter {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly lookupService = inject(DeviceLookupService);
  private readonly interventionService = inject(InterventionService);
  private readonly envInfoService = inject(DeviceEnvInfoService);
  private readonly toastCtrl = inject(ToastController);
  private readonly confirmService = inject(ConfirmService);
  private readonly loadingAlert = inject(LoadingAlertService);
  private readonly transloco = inject(TranslocoService);
  private readonly logger = inject(LoggerService);
  private readonly modalCtrl = inject(ModalController);
  private readonly configStore = inject(ConfigStore);
  protected readonly photoService = inject(PhotoService);

  protected sn = '';
  protected isSaving = false;
  private connectedSn = '';
  protected photoRequirement: PhotoRequirement | null = null;
  protected warrantyInfo: { messageKey: string; messageParams: Record<string, string>; noteKey: string } | null = null;

  constructor() {
    addIcons({ cameraOutline, informationCircleOutline });
  }

  get showPhotosButton(): boolean {
    return this.configStore.isFeatureEnabled('interventionPhotos')
      && this.photoRequirement !== null;
  }

  protected form = new FormGroup({
    installerName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    installerPhoneNumber: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(9)] }),
    callAccepted: new FormControl<boolean | null>(null),
    note: new FormControl('', { nonNullable: true }),
  });

  ionViewWillEnter(): void {
    this.isSaving = false;
    this.sn = this.route.snapshot.paramMap.get('sn') ?? '';
    this.connectedSn = this.route.snapshot.queryParamMap.get('connectedSn') ?? '';

    this.warrantyInfo = null;
    const device = this.lookupService.device;

    if (device?.type === DeviceType.GAS_BOILER) {
      this.warrantyInfo = this.getWarrantyInfo();
    }

    if (this.configStore.isFeatureEnabled('interventionPhotos')) {
      const photoConfig = this.configStore.config()?.interventionPhotoConfig ?? {};
      this.photoRequirement = device ? (photoConfig[device.type]?.['commissioning'] ?? null) : null;

      if (this.photoRequirement) {
        this.photoService.setRequirement(this.photoRequirement);
      } else {
        this.photoService.clear();
      }
    }

    this.form.reset();
  }

  async onAddPhotos(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PhotoUploadPage,
      cssClass: 'fullscreen-modal',
    });
    await modal.present();
  }

  async onSave(): Promise<void> {
    if (!this.validateForm()) return;

    const device = this.lookupService.device;
    if (!device) return;

    const formValue = this.form.getRawValue();

    const data: Record<string, unknown> = {
      warrantyStatus: 'in-warranty',
      interventionType: InterventionType.COMMISSIONING,
      interventionDescription: COMMISSIONING_DESCRIPTION,
      installerName: formValue.installerName,
      installerPhoneNumber: formValue.installerPhoneNumber,
      callAccepted: formValue.callAccepted,
      note: formValue.note,
    };

    if (this.configStore.isFeatureEnabled('interventionPhotos')
      && this.photoRequirement
      && this.photoService.photos.length === 0) {
      const proceed = await this.showNoPhotosAlert();
      if (!proceed) return;
    }

    if (requiresEnvInfo(device.type)) {
      const envInfo = await this.envInfoService.collectEnvInfo(device.type, this.sn, null, device.subType);
      if (!envInfo) return;
      data['envInfo'] = envInfo;
    } else {
      const confirmed = await this.showConfirmAlert();
      if (!confirmed) return;
    }

    await this.loadingAlert.show();

    if (this.configStore.isFeatureEnabled('interventionPhotos') && this.photoService.photos.length > 0) {
      await this.photoService.uploadPhotos(this.sn, device.type, InterventionType.COMMISSIONING);
    }

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
      this.photoService.clear();
      void this.router.navigate(['/device-management', this.sn]).then(() => {
        void this.loadingAlert.hide();
        void this.showToast(this.transloco.translate('commissioning_success'), 'success');
      });
    } else {
      await this.loadingAlert.hide();
      void this.showToast(this.transloco.translate('commissioning_error'), 'danger');
    }
  }

  private showNoPhotosAlert(): Promise<boolean> {
    return this.confirmService.confirm(
      'photo_no_photos_title',
      'photo_no_photos_message',
      'photo_no_photos_continue',
      'photo_no_photos_cancel',
    );
  }

  private showConfirmAlert(): Promise<boolean> {
    return this.confirmService.confirm(
      'commissioning_confirm_title',
      'commissioning_confirm_message',
      'commissioning_confirm_save',
      'commissioning_confirm_cancel',
    );
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

    if (this.configStore.isFeatureEnabled('interventionPhotos')
      && this.photoRequirement
      && this.photoService.photos.length < this.photoRequirement.requiredPhotos) {
      void this.showToast(
        this.transloco.translate('intervention_validation_photos_required', {
          required: this.photoRequirement.requiredPhotos,
        }),
        'warning',
      );
      return false;
    }

    return true;
  }

  private getWarrantyInfo(): { messageKey: string; messageParams: Record<string, string>; noteKey: string } | null {
    const manufactureDate = this.getManufactureDateFromSn();
    if (!manufactureDate) return null;

    const now = new Date();
    const daysSince = (now.getTime() - manufactureDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince / 365 <= 1) {
      return { messageKey: 'commissioning_warranty_from_start', messageParams: {}, noteKey: '' };
    }

    const warrantyStart = new Date(manufactureDate);
    warrantyStart.setMonth(warrantyStart.getMonth() + 6);
    const formatted = warrantyStart.toLocaleDateString('sr-RS', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });

    return {
      messageKey: 'commissioning_warranty_from_date',
      messageParams: { date: formatted },
      noteKey: 'commissioning_warranty_upload_note',
    };
  }

  private getManufactureDateFromSn(): Date | null {
    const sn = this.sn;
    const business = this.configStore.business();
    const start = business?.snMfgDateStart ?? 9;
    const length = business?.snMfgDateLength ?? 5;

    if (!sn || sn.length < start + length) return null;

    const dateStr = sn.substring(start, start + length);
    const yearStr = dateStr.substring(0, 2);
    const dayOfYearStr = dateStr.substring(2, length);

    const year = 2000 + parseInt(yearStr, 10);
    const dayOfYear = parseInt(dayOfYearStr, 10);

    if (isNaN(year) || year < 2000 || year > 2100) return null;

    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    if (isNaN(dayOfYear) || dayOfYear < 1 || dayOfYear > (isLeapYear ? 366 : 365)) return null;

    const date = new Date(year, 0, dayOfYear);
    return isNaN(date.getTime()) ? null : date;
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
