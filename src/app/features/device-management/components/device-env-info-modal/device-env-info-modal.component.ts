import { Component, Input, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonItem, IonInput, IonSelect, IonSelectOption, IonLabel,
  IonCard, IonCardHeader, IonCardSubtitle, IonCardContent,
  IonGrid, IonRow, IonCol,
  ModalController, ToastController, AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DeviceType } from '../../../../shared/models/device.model';
import {
  EnvInfoFieldConfig,
  EnvInfoSectionConfig,
  ENV_INFO_FIELDS,
  ENV_INFO_SECTIONS,
} from '../../models/device-env-info.model';

@Component({
  selector: 'app-device-env-info-modal',
  templateUrl: './device-env-info-modal.component.html',
  styleUrls: ['./device-env-info-modal.component.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonItem, IonInput, IonSelect, IonSelectOption, IonLabel,
    IonCard, IonCardHeader, IonCardSubtitle, IonCardContent,
    IonGrid, IonRow, IonCol,
    TranslocoModule,
  ],
})
export class DeviceEnvInfoModalComponent implements OnInit {
  @Input() deviceType!: DeviceType;
  @Input() prefillData: Record<string, string> | null = null;
  @Input() readOnly = false;

  private readonly modalController = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly transloco = inject(TranslocoService);

  protected sections: EnvInfoSectionConfig[] = [];
  protected fieldsPerSection = new Map<string, EnvInfoFieldConfig[]>();
  protected form!: FormGroup;

  private allFields: EnvInfoFieldConfig[] = [];

  constructor() {
    addIcons({ arrowBackOutline });
  }

  ngOnInit(): void {
    this.sections = ENV_INFO_SECTIONS[this.deviceType] ?? [];
    this.allFields = ENV_INFO_FIELDS[this.deviceType] ?? [];

    for (const section of this.sections) {
      this.fieldsPerSection.set(
        section.key,
        this.allFields.filter(f => f.section === section.key),
      );
    }

    this.buildForm();

    if (this.prefillData) {
      this.form.patchValue(this.prefillData);
    }

  }

  protected async onSave(): Promise<void> {
    if (!this.validateForm()) return;

    const confirmed = await this.showConfirmAlert();
    if (!confirmed) return;

    this.modalController.dismiss(this.form.getRawValue(), 'save');
  }

  private async showConfirmAlert(): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: this.transloco.translate('env_info_confirm_title'),
        message: this.transloco.translate('env_info_confirm_message'),
        buttons: [
          {
            text: this.transloco.translate('env_info_confirm_cancel'),
            role: 'cancel',
            handler: () => resolve(false),
          },
          {
            text: this.transloco.translate('env_info_confirm_save'),
            handler: () => resolve(true),
          },
        ],
      });
      await alert.present();
    });
  }

  protected onDismiss(): void {
    this.modalController.dismiss(null, 'cancel');
  }

  private buildForm(): void {
    const controls: Record<string, FormControl<string>> = {};
    for (const field of this.allFields) {
      controls[field.key] = new FormControl('', { nonNullable: true });
    }
    this.form = new FormGroup(controls);
  }

  private validateForm(): boolean {
    const value = this.form.getRawValue();
    for (const field of this.allFields) {
      if (!value[field.key] || value[field.key].trim() === '') {
        void this.showToast(this.transloco.translate('env_info_validation_required'), 'warning');
        return false;
      }
    }
    return true;
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
