import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FieldValue, Timestamp } from '@capacitor-firebase/firestore';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonItem, IonInput, IonSelect, IonSelectOption,
  IonMenuButton, IonLabel, IonCard, IonCardHeader, IonCardSubtitle, IonCardContent,
  IonSpinner,
  ViewWillEnter, ToastController,
} from '@ionic/angular/standalone';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DeviceLookupService } from '../services/device-lookup.service';
import { DeviceRegistrationService } from '../services/device-registration.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { LoadingAlertService } from '../../../shared/services/loading-alert.service';
import { toLatinUpperCase } from '../../../shared/utils/transliterate';

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
  private readonly loadingAlert = inject(LoadingAlertService);
  private readonly transloco = inject(TranslocoService);
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

  get showDateOfPurchase(): boolean {
    const device = this.lookupService.device;
    if (!device) return false;
    return !device.commissioning
      && this.form.get('warrantyStatus')?.value === 'in-warranty';
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
      firstNameSrch: toLatinUpperCase(formValue.firstName),
      lastNameSrch: toLatinUpperCase(formValue.lastName),
    };

    if (!device.annualService) {
      delete data['callAccepted'];
    }

    if (formValue.warrantyStatus === 'out-of-warranty') {
      delete data['dateOfPurchase'];
    } else if (device.commissioning) {
      data['dateOfPurchase'] = FieldValue.serverTimestamp();
    } else if (formValue.dateOfPurchase) {
      // <ion-input type="date"> stores ISO yyyy-MM-dd.
      const [year, month, day] = formValue.dateOfPurchase.split('-').map(Number);
      data['dateOfPurchase'] = Timestamp.fromDate(new Date(year, month - 1, day));
    }

    const confirmed = await this.confirmService.confirm(
      'add_user_confirm_title',
      'add_user_confirm_message',
      'add_user_confirm_save',
      'add_user_confirm_cancel',
    );
    if (!confirmed) return;

    const success = await this.loadingAlert.wrap(async () => {
      if (this.connectedSn) {
        const mainData = { ...data, connectedDevice: this.connectedSn };
        const connectedData = { ...data, connectedDevice: this.sn };
        return this.registrationService.registerBatch([
          { sn: this.sn, device, dynamicFields: mainData },
          { sn: this.connectedSn, device, dynamicFields: connectedData },
        ]);
      }
      return this.registrationService.register(this.sn, device, data);
    });

    if (success) {
      void this.showToast(this.transloco.translate('add_user_success'));
      void this.router.navigate(['/device-management', this.sn]);
    } else {
      void this.showToast(this.transloco.translate('add_user_error'));
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
      );
      return false;
    }

    return true;
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom',
    });
    await toast.present();
  }
}
