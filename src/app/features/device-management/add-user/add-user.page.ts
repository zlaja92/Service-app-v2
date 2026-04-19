import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonMenuButton, IonLabel, IonCard, IonCardHeader, IonCardSubtitle, IonCardContent,
  IonSpinner,
  ViewWillEnter, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DeviceLookupService } from '../services/device-lookup.service';
import { DeviceRegistrationService } from '../services/device-registration.service';

@Component({
  selector: 'app-add-user',
  templateUrl: './add-user.page.html',
  styleUrls: ['./add-user.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonButton, IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption,
    IonMenuButton, IonLabel, IonCard, IonCardHeader, IonCardSubtitle, IonCardContent,
    IonSpinner,
    TranslocoModule,
  ],
})
export class AddUserPage implements ViewWillEnter {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly lookupService = inject(DeviceLookupService);
  private readonly registrationService = inject(DeviceRegistrationService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  protected sn = '';

  protected form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    streetName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    homeNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    city: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    postCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phoneNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    warrantyStatus: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    note: new FormControl('', { nonNullable: true }),
  });

  ionViewWillEnter(): void {
    this.sn = this.route.snapshot.paramMap.get('sn') ?? '';
    this.form.reset();
  }

  async onSave(): Promise<void> {
    if (!this.validateForm()) return;

    const device = this.lookupService.device;
    if (!device) return;

    const formValue = this.form.getRawValue();

    const alert = await this.alertCtrl.create({
      header: this.transloco.translate('add_user_confirm_title'),
      message: this.transloco.translate('add_user_confirm_message'),
      buttons: [
        {
          text: this.transloco.translate('add_user_confirm_cancel'),
          role: 'cancel',
        },
        {
          text: this.transloco.translate('add_user_confirm_save'),
          handler: () => {
            void this.saveAndNavigate(alert, formValue);
            return false;
          },
        },
      ],
    });
    await alert.present();
  }

  private async saveAndNavigate(
    alert: HTMLIonAlertElement,
    formValue: Record<string, string>,
  ): Promise<void> {
    const saveButton = alert.querySelector('.alert-button:last-child') as HTMLElement | null;
    if (saveButton) {
      saveButton.textContent = '';
      const spinner = document.createElement('ion-spinner');
      spinner.setAttribute('name', 'crescent');
      saveButton.appendChild(spinner);
    }

    const device = this.lookupService.device;
    if (!device) {
      await alert.dismiss();
      return;
    }

    const data: Record<string, unknown> = {
      ...formValue,
      firstNameSrch: this.toLatinUpperCase(formValue['firstName']),
      lastNameSrch: this.toLatinUpperCase(formValue['lastName']),
    };

    const success = await this.registrationService.register(this.sn, device, data);

    await alert.dismiss();

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
