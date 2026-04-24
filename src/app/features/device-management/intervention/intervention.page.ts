import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonIcon, IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonMenuButton, IonLabel, IonCard,
  IonGrid, IonRow, IonCol,
  IonSpinner,
  ViewWillEnter, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, removeOutline } from 'ionicons/icons';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DeviceLookupService } from '../services/device-lookup.service';
import { InterventionService } from '../services/intervention.service';
import { DeviceEnvInfoService } from '../services/device-env-info.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { ConfigStore } from '../../../core/config/config.store';
import { DeviceType } from '../../../shared/models/device.model';
import { requiresEnvInfo } from '../models/device-env-info.model';
import {
  InterventionTypeOption,
  INTERVENTION_OPTIONS,
  FAULT_DESCRIPTIONS,
  ERROR_CODES,
  MAX_SPARE_PARTS,
  DEFAULT_ERROR,
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
    IonMenuButton, IonLabel, IonCard,
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
  private readonly transloco = inject(TranslocoService);
  private readonly logger = inject(LoggerService);
  protected readonly configStore = inject(ConfigStore);

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

  protected form = new FormGroup({
    interventionType: new FormControl('', { nonNullable: true }),
    description: new FormControl('', { nonNullable: true }),
    error: new FormControl(DEFAULT_ERROR, { nonNullable: true }),
    callAccepted: new FormControl<boolean | null>(null),
    distance: new FormControl(DEFAULT_DISTANCE, { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
  });

  protected spareParts = new FormArray<FormControl<string>>([
    new FormControl('', { nonNullable: true }),
  ]);

  constructor() {
    addIcons({ addOutline, removeOutline });
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
    this.faultDescriptions = FAULT_DESCRIPTIONS[device.type] ?? [];
    this.errorCodes = ERROR_CODES[device.type] ?? [];
    this.resetForm();
  }

  get showCallAccepted(): boolean {
    return this.deviceType === DeviceType.HEAT_PUMP
      || this.deviceType === DeviceType.GAS_BOILER;
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
      interventionType: formValue.interventionType,
      interventionDescription: formValue.description.toUpperCase(),
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
    const docId = await this.interventionService.saveIntervention(this.sn, device, data);

    if (docId) {
      await this.showToast(
        this.transloco.translate('intervention_save_success'),
        'success',
      );
      // TODO: Generate PDF report when pdfReports feature is implemented
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
      interventionType: '',
      description: '',
      error: DEFAULT_ERROR,
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
