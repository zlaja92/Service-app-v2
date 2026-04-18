import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormGroup, Validators, FormControl } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonIcon, IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonMenuButton, IonList, IonLabel,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonSpinner,
  ViewWillEnter, AlertController, ToastController, PickerController,
  PickerColumn,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { saveOutline } from 'ionicons/icons';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DeviceLookupService } from '../services/device-lookup.service';
import { DeviceRegistrationService } from '../services/device-registration.service';
import { InterventionService } from '../services/intervention.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { DEVICE_FORM_CONFIG, FIELD_GROUPS, FieldConfig, FieldGroupConfig } from '../models/adding-device.model';
import { DeviceType } from '../../../shared/models/device.model';

const MONTH_KEYS = [
  'add_device_month_jan', 'add_device_month_feb', 'add_device_month_mar',
  'add_device_month_apr', 'add_device_month_may', 'add_device_month_jun',
  'add_device_month_jul', 'add_device_month_aug', 'add_device_month_sep',
  'add_device_month_oct', 'add_device_month_nov', 'add_device_month_dec',
];

@Component({
  selector: 'app-add-device',
  templateUrl: './add-device.page.html',
  styleUrls: ['./add-device.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonButton, IonIcon, IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption,
    IonMenuButton, IonList, IonLabel,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonSpinner,
    TranslocoModule,
  ],
})
export class AddDevicePage implements ViewWillEnter {
  private lookupService = inject(DeviceLookupService);
  private registrationService = inject(DeviceRegistrationService);
  private interventionService = inject(InterventionService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private pickerCtrl = inject(PickerController);
  private translocoService = inject(TranslocoService);
  private logger = inject(LoggerService);

  protected sn = '';
  protected fields: FieldConfig[] = [];
  protected groups: FieldGroupConfig[] = [];
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

    const deviceType = device.type as DeviceType;
    this.fields = [...DEVICE_FORM_CONFIG[deviceType]];

    if (!this.fields) {
      this.noConfig = true;
      this.logger.warn('AddDevicePage: no form config for device type', { sn: this.sn, deviceType });
      return;
    }

    if (!device.annualService) {
      const warrantyIdx = this.fields.findIndex(f => f.key === 'warrantyStatus');
      const insertIdx = warrantyIdx >= 0 ? warrantyIdx + 1 : this.fields.length;
      this.fields.splice(insertIdx, 0, {
        key: 'dateOfPurchase',
        label: 'add_device_date_of_purchase',
        type: 'date',
        required: true,
        group: 'basic',
        showWhen: (form) => form['warrantyStatus'] === 'in_warranty',
      });
    }

    this.groups = FIELD_GROUPS.filter(g => this.fields.some(f => f.group === g.key));
    this.buildForm();
  }

  getFieldsByGroup(groupKey: string): FieldConfig[] {
    return this.fields.filter(f => f.group === groupKey);
  }

  async openDatePicker(fieldKey: string): Promise<void> {
    const today = new Date();
    const currentValue = this.form.get(fieldKey)?.value as string;

    let selectedDay = today.getDate();
    let selectedMonth = today.getMonth() + 1;
    let selectedYear = today.getFullYear();

    if (currentValue) {
      const [d, m, y] = currentValue.split('.').map(Number);
      selectedDay = d;
      selectedMonth = m;
      selectedYear = y;
    }

    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    const picker = await this.pickerCtrl.create({
      cssClass: 'date-picker',
      columns: [
        this.buildDayColumn(daysInMonth, selectedDay),
        this.buildMonthColumn(selectedMonth),
        this.buildYearColumn(selectedYear),
      ],
      buttons: [
        {
          text: this.translocoService.translate('add_device_date_cancel'),
          role: 'cancel',
          cssClass: 'picker-cancel-btn',
        },
        {
          text: this.translocoService.translate('add_device_date_done'),
          cssClass: 'picker-confirm-btn',
          handler: (value: Record<string, { text: string; value: number; columnIndex: number }>) => {
            const day = String(value['day'].value).padStart(2, '0');
            const month = String(value['month'].value).padStart(2, '0');
            const year = value['year'].value;
            this.form.get(fieldKey)?.setValue(`${day}.${month}.${year}`);
          },
        },
      ],
    });

    await picker.present();
  }

  private buildDayColumn(daysInMonth: number, selectedDay: number): PickerColumn {
    return {
      name: 'day',
      selectedIndex: Math.min(selectedDay, daysInMonth) - 1,
      options: Array.from({ length: daysInMonth }, (_, i) => ({
        text: String(i + 1),
        value: i + 1,
      })),
    };
  }

  private buildMonthColumn(selectedMonth: number): PickerColumn {
    return {
      name: 'month',
      selectedIndex: selectedMonth - 1,
      options: MONTH_KEYS.map((key, i) => ({
        text: this.translocoService.translate(key),
        value: i + 1,
      })),
    };
  }

  private buildYearColumn(selectedYear: number): PickerColumn {
    const startYear = 2000;
    const endYear = new Date().getFullYear();
    return {
      name: 'year',
      selectedIndex: Math.min(selectedYear, endYear) - startYear,
      options: Array.from({ length: endYear - startYear + 1 }, (_, i) => ({
        text: String(startYear + i),
        value: startYear + i,
      })),
    };
  }

  isFieldVisible(field: FieldConfig): boolean {
    if (!field.showWhen) return true;
    return field.showWhen(this.form.value as Record<string, unknown>);
  }

  async onSave(): Promise<void> {
    const missingFields = this.getMissingRequiredFields();
    if (missingFields.length > 0) {
      this.form.markAllAsTouched();
      const fieldNames = missingFields
        .map(f => this.translocoService.translate(f.label))
        .join(', ');
      const toast = await this.toastCtrl.create({
        message: this.translocoService.translate('add_device_validation_message', { fields: fieldNames }),
        duration: 3000,
        color: 'warning',
        position: 'bottom',
      });
      await toast.present();
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
    const group: Record<string, FormControl> = {};
    for (const field of this.fields) {
      group[field.key] = new FormControl('', field.required ? Validators.required : []);
    }
    this.form = new FormGroup(group);
  }

  private getMissingRequiredFields(): FieldConfig[] {
    return this.fields.filter(field => {
      if (!field.required || !this.isFieldVisible(field)) return false;
      const control = this.form.get(field.key);
      return !control?.value;
    });
  }

  private async executeRegistration(): Promise<void> {
    const device = this.lookupService.device;
    if (!device) return;

    this.isSaving = true;

    const formValue = this.form.value as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const field of this.fields) {
      if (this.isFieldVisible(field) && formValue[field.key]) {
        data[field.key] = formValue[field.key];
      }
    }

    const warrantyStatus = data['warrantyStatus'] as string;
    if (warrantyStatus === 'out_of_warranty') {
      data['dateOfPurchase'] = null;
    } else if (device.annualService) {
      data['dateOfPurchase'] = new Date();
    } else {
      const dateStr = data['dateOfPurchase'] as string;
      if (dateStr) {
        const [day, month, year] = dateStr.split('.').map(Number);
        data['dateOfPurchase'] = new Date(year, month - 1, day);
      }
    }

    const success = await this.registrationService.register(this.sn, device, data);

    if (success && device.annualService) {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const formattedDate = `${day}.${month}.${today.getFullYear()}`;

      await this.interventionService.saveIntervention(this.sn, device, {
        interventionType: { code: 'commissioning', name: 'PUŠTANJE U RAD' },
        description: 'Puštanje u rad',
        error: 'BEZ GREŠKE',
        distance: '0',
        note: '',
        spareParts: [],
        date: formattedDate,
      });
    }

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
