import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonItem, IonInput, IonSelect, IonSelectOption,
  IonMenuButton, IonLabel, IonCard, IonCardHeader, IonCardSubtitle, IonCardContent,
  IonSpinner,
  ViewWillEnter, ToastController, PickerController, PickerColumn,
} from '@ionic/angular/standalone';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DeviceLookupService } from '../services/device-lookup.service';
import { DeviceRegistrationService } from '../services/device-registration.service';
import { ServerTimeService } from '../../../core/firebase/server-time.service';
import { ConfirmService } from '../../../shared/services/confirm.service';

@Component({
  selector: 'app-add-user',
  templateUrl: './add-user.page.html',
  styleUrls: ['./add-user.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonButton, IonItem, IonInput, IonSelect, IonSelectOption,
    IonMenuButton, IonLabel, IonCard, IonCardHeader, IonCardSubtitle, IonCardContent,
    IonSpinner,
    TranslocoModule,
  ],
})
export class AddUserPage implements ViewWillEnter {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly lookupService = inject(DeviceLookupService);
  private readonly registrationService = inject(DeviceRegistrationService);
  private readonly toastCtrl = inject(ToastController);
  private readonly confirmService = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);
  private readonly serverTimeService = inject(ServerTimeService);
  protected sn = '';
  private connectedSn = '';

  protected form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    streetName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    homeNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    city: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    postCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phoneNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    warrantyStatus: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    dateOfPurchase: new FormControl('', { nonNullable: true }),
  });

  private readonly pickerCtrl = inject(PickerController);

  private readonly MONTH_KEYS = [
    'add_user_month_jan', 'add_user_month_feb', 'add_user_month_mar',
    'add_user_month_apr', 'add_user_month_may', 'add_user_month_jun',
    'add_user_month_jul', 'add_user_month_aug', 'add_user_month_sep',
    'add_user_month_oct', 'add_user_month_nov', 'add_user_month_dec',
  ];

  get showDateOfPurchase(): boolean {
    const device = this.lookupService.device;
    if (!device) return false;
    return !device.commissioning
      && this.form.get('warrantyStatus')?.value === 'in-warranty';
  }

  async openDatePicker(): Promise<void> {
    const today = new Date();
    const currentValue = this.form.get('dateOfPurchase')?.value as string;

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
          text: this.transloco.translate('add_user_date_cancel'),
          role: 'cancel',
          cssClass: 'picker-cancel-btn',
        },
        {
          text: this.transloco.translate('add_user_date_done'),
          cssClass: 'picker-confirm-btn',
          handler: (value: Record<string, { value: number }>) => {
            const day = String(value['day'].value).padStart(2, '0');
            const month = String(value['month'].value).padStart(2, '0');
            const year = value['year'].value;
            this.form.get('dateOfPurchase')?.setValue(`${day}.${month}.${year}`);
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
      options: this.MONTH_KEYS.map((key, i) => ({
        text: this.transloco.translate(key),
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

  ionViewWillEnter(): void {
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
      ...formValue,
      firstNameSrch: this.toLatinUpperCase(formValue.firstName),
      lastNameSrch: this.toLatinUpperCase(formValue.lastName),
    };

    if (!device.annualService) {
      delete data['callAccepted'];
    }

    if (formValue.warrantyStatus === 'out-of-warranty') {
      delete data['dateOfPurchase'];
    } else if (device.commissioning) {
      const serverTime = await this.serverTimeService.getServerTime();
      if (!serverTime) {
        void this.showToast(this.transloco.translate('add_user_server_time_error'), 'danger');
        return;
      }
      data['dateOfPurchase'] = serverTime;
    } else if (formValue.dateOfPurchase) {
      const [day, month, year] = formValue.dateOfPurchase.split('.').map(Number);
      data['dateOfPurchase'] = new Date(year, month - 1, day);
    }

    const confirmed = await this.confirmService.confirm(
      'add_user_confirm_title',
      'add_user_confirm_message',
      'add_user_confirm_save',
      'add_user_confirm_cancel',
    );
    if (!confirmed) return;

    let success: boolean;

    if (this.connectedSn) {
      const mainData = { ...data, connectedDevice: this.connectedSn };
      const connectedData = { ...data, connectedDevice: this.sn };
      success = await this.registrationService.registerBatch([
        { sn: this.sn, device, dynamicFields: mainData },
        { sn: this.connectedSn, device, dynamicFields: connectedData },
      ]);
    } else {
      success = await this.registrationService.register(this.sn, device, data);
    }

    if (success) {
      void this.showToast(this.transloco.translate('add_user_success'), 'success');
      void this.router.navigate(['/device-management', this.sn]);
    } else {
      void this.showToast(this.transloco.translate('add_user_error'), 'danger');
    }
  }

  private validateForm(): boolean {
    const value = this.form.getRawValue();
    const missing: string[] = [];

    if (!value.firstName.trim()) missing.push(this.transloco.translate('add_user_first_name'));
    if (!value.lastName.trim()) missing.push(this.transloco.translate('add_user_last_name'));
    if (!value.streetName.trim()) missing.push(this.transloco.translate('add_user_street'));
    if (!value.homeNumber.trim()) missing.push(this.transloco.translate('add_user_house_number'));
    if (!value.city.trim()) missing.push(this.transloco.translate('add_user_city'));
    if (!value.postCode.trim()) missing.push(this.transloco.translate('add_user_post_code'));
    if (!value.phoneNumber.trim()) missing.push(this.transloco.translate('add_user_phone'));
    if (!value.warrantyStatus) missing.push(this.transloco.translate('add_user_warranty'));
    if (this.showDateOfPurchase && !value.dateOfPurchase) missing.push(this.transloco.translate('add_user_date_of_purchase'));

    if (missing.length > 0) {
      void this.showToast(
        this.transloco.translate('add_user_validation_message', { fields: missing.join(', ') }),
        'warning',
      );
      return false;
    }

    return true;
  }

  private toLatinUpperCase(value: string): string {
    const cyrillicToLatin: Record<string, string> = {
      'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Ђ': 'DJ', 'Е': 'E',
      'Ж': 'Z', 'З': 'Z', 'И': 'I', 'Ј': 'J', 'К': 'K', 'Л': 'L', 'Љ': 'LJ',
      'М': 'M', 'Н': 'N', 'Њ': 'NJ', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S',
      'Т': 'T', 'Ћ': 'C', 'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'C', 'Ч': 'C',
      'Џ': 'DZ', 'Ш': 'S',
      'а': 'A', 'б': 'B', 'в': 'V', 'г': 'G', 'д': 'D', 'ђ': 'DJ', 'е': 'E',
      'ж': 'Z', 'з': 'Z', 'и': 'I', 'ј': 'J', 'к': 'K', 'л': 'L', 'љ': 'LJ',
      'м': 'M', 'н': 'N', 'њ': 'NJ', 'о': 'O', 'п': 'P', 'р': 'R', 'с': 'S',
      'т': 'T', 'ћ': 'C', 'у': 'U', 'ф': 'F', 'х': 'H', 'ц': 'C', 'ч': 'C',
      'џ': 'DZ', 'ш': 'S',
      'Č': 'C', 'č': 'C', 'Ć': 'C', 'ć': 'C', 'Đ': 'DJ', 'đ': 'DJ',
      'Š': 'S', 'š': 'S', 'Ž': 'Z', 'ž': 'Z',
    };

    return value
      .split('')
      .map(ch => cyrillicToLatin[ch] ?? ch.toUpperCase())
      .join('');
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
