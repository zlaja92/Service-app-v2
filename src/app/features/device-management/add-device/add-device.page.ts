import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonIcon, IonItem, IonInput, IonSelect, IonSelectOption,
  IonMenuButton, IonList, IonLabel, IonNote, IonDatetimeButton,
  IonSpinner,
  ViewWillEnter, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { saveOutline } from 'ionicons/icons';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DeviceLookupService } from '../services/device-lookup.service';
import { DeviceRegistrationService } from '../services/device-registration.service';
import { ConfigStore } from '../../../core/config/config.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { DynamicForm } from '../../../core/config/config.model';

@Component({
  selector: 'app-add-device',
  templateUrl: './add-device.page.html',
  styleUrls: ['./add-device.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonButton, IonIcon, IonItem, IonInput, IonSelect, IonSelectOption,
    IonMenuButton, IonList, IonLabel, IonNote, IonDatetimeButton,
    IonSpinner,
    TranslocoModule,
  ],
})
export class AddDevicePage implements ViewWillEnter {
  private lookupService = inject(DeviceLookupService);
  private registrationService = inject(DeviceRegistrationService);
  private configStore = inject(ConfigStore);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private translocoService = inject(TranslocoService);
  private logger = inject(LoggerService);

  protected sn = '';
  protected formFields: DynamicForm[] = [];
  protected form: FormGroup = new FormGroup({});
  protected noConfig = false;
  protected isSaving = false;

  constructor() {
    addIcons({ saveOutline });
  }

  ionViewWillEnter(): void {
    this.sn = this.route.snapshot.paramMap.get('sn') ?? '';

    const device = this.lookupService.device;
    if (!device) {
      this.noConfig = true;
      this.logger.warn('AddDevicePage: no device in lookup service', { sn: this.sn });
      return;
    }

    const raw = this.configStore.business()?.dynamicForm;
    this.formFields = Array.isArray(raw) ? raw : [];

    if (this.formFields.length === 0) {
      this.noConfig = true;
      this.logger.warn('AddDevicePage: no dynamicForm config', { sn: this.sn });
    }

    this.buildForm();
  }

  async onSave(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const device = this.lookupService.device;
    if (!device) return;

    const alert = await this.alertCtrl.create({
      header: this.translocoService.translate('device_register_confirm_title'),
      message: this.translocoService.translate('device_register_confirm_message', {
        name: device.name,
        sn: this.sn,
      }),
      buttons: [
        {
          text: this.translocoService.translate('device_register_confirm_cancel'),
          role: 'cancel',
        },
        {
          text: this.translocoService.translate('device_register_confirm_continue'),
          handler: () => {
            this.executeRegistration();
          },
        },
      ],
    });
    await alert.present();
  }

  private buildForm(): void {
    const controls: Record<string, unknown[]> = {};
    for (const field of this.formFields) {
      controls[field.dbKey] = [
        '',
        field.required ? [Validators.required] : [],
      ];
    }
    this.form = this.fb.group(controls);
  }

  private async executeRegistration(): Promise<void> {
    const device = this.lookupService.device;
    if (!device) return;

    this.isSaving = true;

    const formValue = this.form.value as Record<string, unknown>;
    const dynamicFields: Record<string, unknown> = {};
    for (const field of this.formFields) {
      dynamicFields[field.dbKey] = formValue[field.dbKey];
    }

    const success = await this.registrationService.register(this.sn, device, dynamicFields);

    this.isSaving = false;

    const toast = await this.toastCtrl.create({
      message: success
        ? this.translocoService.translate('device_register_success')
        : this.translocoService.translate('device_register_error'),
      duration: 3000,
      color: success ? 'success' : 'danger',
      position: 'bottom',
    });
    await toast.present();

    if (success) {
      this.router.navigate(['/device-management', this.sn]);
    }
  }
}
