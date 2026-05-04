import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonIcon, IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonMenuButton, IonLabel, IonCard, IonNote,
  IonGrid, IonRow, IonCol,
  IonSpinner,
  ViewWillEnter, ToastController, ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, removeOutline, cameraOutline } from 'ionicons/icons';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DeviceLookupService } from '../services/device-lookup.service';
import { InterventionService } from '../services/intervention.service';
import { DeviceEnvInfoService } from '../services/device-env-info.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { ConfigStore } from '../../../core/config/config.store';
import { PhotoRequirement } from '../../../core/config/config.model';
import { DeviceType } from '../../../shared/models/device.model';
import { PhotoService } from '../../photo-upload/services/photo.service';
import { PhotoUploadPage } from '../../photo-upload/photo-upload.page';
import { DeviceRegistrationService } from '../services/device-registration.service';
import { CartService } from '../../cart/cart.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { LoadingAlertService } from '../../../shared/services/loading-alert.service';
import { requiresEnvInfo } from '../models/device-env-info.model';
import {
  InterventionType,
  InterventionTypeOption,
  INTERVENTION_OPTIONS,
  ANNUAL_SERVICE_TYPES,
  MAX_SPARE_PARTS,
  DEFAULT_DISTANCE,
} from '../models/intervention.model';

@Component({
  selector: 'app-intervention',
  templateUrl: './intervention.page.html',
  styleUrls: ['./intervention.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonButton, IonIcon, IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption,
    IonMenuButton, IonLabel, IonCard, IonNote,
    IonGrid, IonRow, IonCol,
    IonSpinner,
    TranslocoModule,
  ],
})
export class InterventionPage implements ViewWillEnter {
  private readonly lookupService = inject(DeviceLookupService);
  private readonly interventionService = inject(InterventionService);
  private readonly envInfoService = inject(DeviceEnvInfoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  private readonly modalCtrl = inject(ModalController);
  private readonly confirmService = inject(ConfirmService);
  private readonly loadingAlert = inject(LoadingAlertService);
  private readonly transloco = inject(TranslocoService);
  private readonly logger = inject(LoggerService);
  protected readonly configStore = inject(ConfigStore);
  protected readonly photoService = inject(PhotoService);
  private readonly registrationService = inject(DeviceRegistrationService);
  private readonly cartService = inject(CartService);

  protected sn = '';
  protected noDevice = false;
  protected isSaving = false;
  protected deviceType: DeviceType | null = null;
  protected readonly maxParts = MAX_SPARE_PARTS;
  protected readonly DeviceType = DeviceType;
  protected readonly todayFormatted = this.formatToday();

  protected interventionTypes: InterventionTypeOption[] = [];
  protected faultDescriptions: string[] = [];
  protected errorCodes: string[] = [];
  protected photoRequirement: PhotoRequirement | null = null;

  protected form = new FormGroup({
    warrantyStatus: new FormControl('', { nonNullable: true }),
    interventionType: new FormControl('', { nonNullable: true }),
    description: new FormControl('', { nonNullable: true }),
    error: new FormControl('', { nonNullable: true }),
    distance: new FormControl(DEFAULT_DISTANCE, { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
  });

  protected spareParts = new FormArray<FormControl<string>>([
    new FormControl('', { nonNullable: true }),
  ]);

  constructor() {
    addIcons({ addOutline, removeOutline, cameraOutline });
  }

  ionViewWillEnter(): void {
    this.isSaving = false;
    this.sn = this.route.snapshot.paramMap.get('sn') ?? '';
    const device = this.lookupService.device;

    if (!device) {
      this.noDevice = true;
      this.logger.warn('InterventionPage: no device data', { sn: this.sn });
      return;
    }

    this.noDevice = false;
    this.deviceType = device.type;
    this.interventionTypes = INTERVENTION_OPTIONS[device.type] ?? [];

    const config = this.configStore.config();
    this.faultDescriptions = config?.interventionFaultOptions?.[device.type] ?? [];
    this.errorCodes = config?.interventionErrorOptions?.[device.type] ?? [];
    this.photoRequirement = null;
    this.photoService.clear();
    this.resetForm();
  }

  updateInterventionTypes(): void {
    if (!this.deviceType) return;

    const warranty = this.form.controls.warrantyStatus.value;
    let types = INTERVENTION_OPTIONS[this.deviceType] ?? [];

    if (warranty === 'out-of-warranty') {
      types = types.filter(t => t.key !== InterventionType.INTERVENTION_REPLACE);

      const device = this.lookupService.device;
      const annualType = ANNUAL_SERVICE_TYPES[this.deviceType];
      if (device?.annualService && annualType) {
        types = [...types, annualType];
      }
    }

    this.interventionTypes = types;
    this.form.controls.interventionType.setValue('');
    this.updatePhotoRequirement();
  }

  get showPhotosButton(): boolean {
    return this.configStore.isFeatureEnabled('interventionPhotos')
      && this.photoRequirement !== null;
  }

  updatePhotoRequirement(): void {
    const intType = this.form.controls.interventionType.value;
    if (!this.deviceType || !intType) {
      this.photoRequirement = null;
      return;
    }
    const photoConfig = this.configStore.config()?.interventionPhotoConfig ?? {};
    this.photoRequirement = photoConfig[this.deviceType]?.[intType] ?? null;

    if (this.photoRequirement) {
      this.photoService.setRequirement(this.photoRequirement);
    }
  }

  async onAddPhotos(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PhotoUploadPage,
      cssClass: 'fullscreen-modal',
    });
    await modal.present();
  }

  addPart(): void {
    if (this.spareParts.length < this.maxParts) {
      this.spareParts.push(new FormControl('', { nonNullable: true }));
    }
  }

  removePart(): void {
    if (this.spareParts.length > 1) {
      this.spareParts.removeAt(this.spareParts.length - 1);
    }
  }

  async onSave(): Promise<void> {
    if (!this.validateForm()) return;

    const device = this.lookupService.device;
    if (!device) return;

    const formValue = this.form.getRawValue();

    const parts = this.spareParts.getRawValue().filter(p => p.trim() !== '');

    const data: Record<string, unknown> = {
      warrantyStatus: formValue.warrantyStatus,
      interventionType: formValue.interventionType,
      interventionDescription: formValue.description,
      error: formValue.error,
      distance: formValue.distance,
      note: formValue.note,
    };

    parts.forEach((part, i) => { data[`sparePart${i + 1}`] = part; });

    if (requiresEnvInfo(device.type)) {
      await this.loadingAlert.show();
      const prefill = await this.envInfoService.getLastEnvInfo(this.sn, device.type);
      await this.loadingAlert.hide();
      const envInfo = await this.envInfoService.collectEnvInfo(device.type, this.sn, prefill);
      if (!envInfo) return;
      data['envInfo'] = envInfo;
    } else {
      const confirmed = await this.showConfirmAlert();
      if (!confirmed) return;
    }

    await this.loadingAlert.show();

    if (this.photoService.photos.length > 0) {
      await this.photoService.uploadPhotos(this.sn, device.type, formValue.interventionType);
    }

    const docId = await this.interventionService.saveIntervention(this.sn, device, data);

    if (docId) {
      this.photoService.clear();
      void this.router.navigate(['/device-management', this.sn]).then(() => {
        void this.loadingAlert.hide();
        void this.showToast(this.transloco.translate('intervention_save_success'), 'success');
      });
    } else {
      await this.loadingAlert.hide();
      await this.showToast(
        this.transloco.translate('intervention_save_error'),
        'danger',
      );
    }
  }

  onExplodedView(): void {
    const device = this.lookupService.device;
    if (!device) return;

    const warrantyStatus = this.form.controls.warrantyStatus.value;
    if (!warrantyStatus) {
      void this.showToast(
        this.transloco.translate('intervention_validation_warranty'),
        'warning',
      );
      return;
    }

    const registration = this.registrationService.userData;
    this.cartService.context = {
      source: 'intervention',
      deviceType: device.type,
      deviceCode: device.code,
      deviceName: device.name,
      warrantyStatus,
      userName: registration ? `${registration['firstName'] ?? ''} ${registration['lastName'] ?? ''}`.trim() : undefined,
      userAddress: registration ? `${registration['streetName'] ?? ''} ${registration['homeNumber'] ?? ''}, ${registration['postCode'] ?? ''} ${registration['city'] ?? ''}`.trim() : undefined,
      userPhone: registration?.['phoneNumber'] as string | undefined,
    };

    void this.router.navigate(['/device', device.code, 'device-groups']);
  }

  private validateForm(): boolean {
    const value = this.form.getRawValue();

    if (!value.warrantyStatus) {
      void this.showToast(
        this.transloco.translate('intervention_validation_warranty'),
        'warning',
      );
      return false;
    }

    if (!value.interventionType) {
      void this.showToast(
        this.transloco.translate('intervention_validation_type'),
        'warning',
      );
      return false;
    }

    if (!value.description) {
      void this.showToast(
        this.transloco.translate('intervention_validation_description'),
        'warning',
      );
      return false;
    }


    if (this.photoRequirement) {
      const sparePartCount = this.photoRequirement.requireSparePartPhotos
        ? this.spareParts.getRawValue().filter(p => p.trim() !== '').length
        : 0;
      const totalRequired = this.photoRequirement.requiredPhotos + sparePartCount;

      if (this.photoService.photos.length < totalRequired) {
        void this.showToast(
          this.transloco.translate('intervention_validation_photos_required', {
            required: totalRequired,
          }),
          'warning',
        );
        return false;
      }
    }

    return true;
  }

  private showConfirmAlert(): Promise<boolean> {
    return this.confirmService.confirm(
      'intervention_confirm_title',
      'intervention_confirm_message',
      'intervention_confirm_save',
      'intervention_confirm_cancel',
    );
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
      warrantyStatus: '',
      interventionType: '',
      description: '',
      error: this.errorCodes[0] ?? '',
      distance: DEFAULT_DISTANCE,
      note: '',
    });
    this.spareParts.clear();
    this.spareParts.push(new FormControl('', { nonNullable: true }));
  }

  private formatToday(): string {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  }
}
