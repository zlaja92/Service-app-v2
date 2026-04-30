import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonIcon, IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonMenuButton, IonLabel, IonCard, IonNote,
  IonGrid, IonRow, IonCol,
  IonSpinner,
  ViewWillEnter, AlertController, ToastController, ModalController,
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
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly modalCtrl = inject(ModalController);
  private readonly transloco = inject(TranslocoService);
  private readonly logger = inject(LoggerService);
  protected readonly configStore = inject(ConfigStore);
  protected readonly photoService = inject(PhotoService);

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
    callAccepted: new FormControl<boolean | null>(null),
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

    if (warranty === 'out_of_warranty') {
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

  get showCallAccepted(): boolean {
    return this.deviceType === DeviceType.HEAT_PUMP
      || this.deviceType === DeviceType.GAS_BOILER;
  }

  get showPhotosButton(): boolean {
    return this.configStore.isFeatureEnabled('interventionPhotos')
      && this.photoRequirement !== null;
  }

  updatePhotoRequirement(): void {
    const intType = this.form.controls.interventionType.value;
    console.log('DEBUG_INT: updatePhotoRequirement intType=' + intType + ' deviceType=' + this.deviceType);
    if (!this.deviceType || !intType) {
      this.photoRequirement = null;
      return;
    }
    const photoConfig = this.configStore.config()?.interventionPhotoConfig ?? {};
    this.photoRequirement = photoConfig[this.deviceType]?.[intType] ?? null;
    console.log('DEBUG_INT: photoRequirement=', this.photoRequirement, 'showPhotosButton=' + this.showPhotosButton);

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
      const prefill = await this.envInfoService.getLastEnvInfo(this.sn, device.type);
      const envInfo = await this.envInfoService.collectEnvInfo(device.type, this.sn, prefill);
      if (!envInfo) return;
      data['envInfo'] = envInfo;
    } else {
      const confirmed = await this.showConfirmAlert();
      if (!confirmed) return;
    }

    this.isSaving = true;

    if (this.photoService.photos.length > 0) {
      await this.photoService.uploadPhotos(this.sn, device.type, formValue.interventionType);
    }

    const docId = await this.interventionService.saveIntervention(this.sn, device, data);

    if (docId) {
      this.photoService.clear();
      await this.showToast(
        this.transloco.translate('intervention_save_success'),
        'success',
      );
      void this.router.navigate(['/device-management', this.sn]);
    } else {
      this.isSaving = false;
      await this.showToast(
        this.transloco.translate('intervention_save_error'),
        'danger',
      );
    }
  }

  onExplodedView(): void {
    const device = this.lookupService.device;
    if (!device) return;
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

    if (this.showCallAccepted && value.callAccepted == null) {
      void this.showToast(
        this.transloco.translate('intervention_validation_call_accepted'),
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

  private async showConfirmAlert(): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: this.transloco.translate('intervention_confirm_title'),
        message: this.transloco.translate('intervention_confirm_message'),
        buttons: [
          {
            text: this.transloco.translate('intervention_confirm_cancel'),
            role: 'cancel',
            handler: () => resolve(false),
          },
          {
            text: this.transloco.translate('intervention_confirm_save'),
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
      warrantyStatus: '',
      interventionType: '',
      description: '',
      error: this.errorCodes[0] ?? '',
      callAccepted: null,
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
