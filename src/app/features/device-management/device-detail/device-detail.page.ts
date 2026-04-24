import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonButton, IonIcon, IonSkeletonText, IonMenuButton,
  IonItem, IonLabel, IonInput, IonSpinner,
  ViewWillEnter, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personAddOutline, buildOutline, constructOutline, hammerOutline, timeOutline,
  searchOutline, barcodeOutline,
} from 'ionicons/icons';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { FeatureFlagDirective } from '../../../shared/directives/feature-flag.directive';
import { DeviceLookupService } from '../services/device-lookup.service';
import { DeviceRegistrationService } from '../services/device-registration.service';
import { InterventionService } from '../services/intervention.service';
import { InterventionType } from '../models/intervention.model';
import { AnnualServiceEligibilityService } from '../services/annual-service-eligibility.service';
import { ConfigStore } from '../../../core/config/config.store';
import { Device } from '../../../shared/models/device.model';

@Component({
  selector: 'app-device-detail',
  templateUrl: './device-detail.page.html',
  styleUrls: ['./device-detail.page.scss'],
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonButton, IonIcon, IonSkeletonText, IonMenuButton,
    IonItem, IonLabel, IonInput, IonSpinner,
    TranslocoModule,
    FeatureFlagDirective,
  ],
})
export class DeviceDetailPage implements ViewWillEnter {
  protected lookupService = inject(DeviceLookupService);
  protected registrationService = inject(DeviceRegistrationService);
  protected eligibilityService = inject(AnnualServiceEligibilityService);
  private interventionService = inject(InterventionService);
  protected configStore = inject(ConfigStore);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private transloco = inject(TranslocoService);

  protected sn = '';
  protected isInitializing = true;
  protected isCommissioningDone = false;

  protected connectedSnInput = '';
  protected connectedSn = '';
  protected isSearchingConnected = false;

  constructor() {
    addIcons({ personAddOutline, buildOutline, constructOutline, hammerOutline, timeOutline, searchOutline, barcodeOutline });
  }

  ionViewWillEnter(): void {
    this.sn = this.route.snapshot.paramMap.get('sn') ?? '';

    if (this.sn) {
      void this.initializeDevice();
    }
  }

  private async initializeDevice(): Promise<void> {
    this.isInitializing = true;
    this.isCommissioningDone = false;

    if (this.lookupService.sn !== this.sn) {
      await this.lookupService.lookup(this.sn);
    }

    const device = this.lookupService.device;

    if (!device) {
      this.isInitializing = false;
      return;
    }

    await this.registrationService.checkRegistration(this.sn);

    if (this.registrationService.isRegistered) {
      const savedConnected = this.registrationService.userData?.['connectedDevice'] as string | undefined;
      if (savedConnected) {
        this.connectedSn = savedConnected;
      }
    }

    if (this.registrationService.isRegistered && device.commissioning) {
      await this.checkCommissioningDone(device.type);
    }

    if (device.annualService) {
      await this.eligibilityService.checkEligibility(this.sn, device);
    }

    this.isInitializing = false;
  }

  private async checkCommissioningDone(deviceType: string): Promise<void> {
    const interventions = await this.interventionService.getInterventionsBySn(this.sn, deviceType);
    this.isCommissioningDone = interventions.some(i =>
      i.data['interventionType'] === InterventionType.COMMISSIONING,
    );
  }

  get isOperational(): boolean {
    if (this.registrationService.isRegistered !== true) return false;

    const warrantyStatus = this.registrationService.userData?.['warrantyStatus'];
    if (warrantyStatus === 'out_of_warranty') return true;

    return !this.lookupService.device?.commissioning || this.isCommissioningDone;
  }

  get isAnnualServiceEnabled(): boolean {
    const warrantyStatus = this.registrationService.userData?.['warrantyStatus'];
    if (warrantyStatus === 'out_of_warranty') return true;
    return this.eligibilityService.isEligible && !this.eligibilityService.isChecking;
  }

  get needsConnectedDevice(): boolean {
    return !!this.lookupService.device?.connectedDevice
      && this.registrationService.isRegistered !== true;
  }

  scanConnectedBarcode(): void {
    // TODO: Implement barcode scanning for connected device
  }

  async onAddUser(): Promise<void> {
    if (this.needsConnectedDevice) {
      const valid = await this.validateConnectedDevice();
      if (!valid) return;
    }

    const extras = this.connectedSn
      ? { queryParams: { connectedSn: this.connectedSn } }
      : undefined;
    this.router.navigate(['/device-management', this.sn, 'add-user'], extras);
  }

  private async validateConnectedDevice(): Promise<boolean> {
    const sn = this.connectedSnInput.trim();

    if (!sn) {
      await this.showToast(this.transloco.translate('connected_device_sn_placeholder'), 'warning');
      return false;
    }

    this.isSearchingConnected = true;

    try {
      const device = await this.lookupConnectedDevice(sn);

      if (!device) {
        await this.showToast(this.transloco.translate('connected_device_not_found'), 'danger');
        return false;
      }

      if (!device.connectedDevice) {
        await this.showToast(this.transloco.translate('connected_device_no_connected_flag'), 'danger');
        return false;
      }

      if (device.type !== this.lookupService.device?.type) {
        await this.showToast(this.transloco.translate('connected_device_wrong_type'), 'danger');
        return false;
      }

      if (device.code === this.lookupService.device?.code) {
        await this.showToast(this.transloco.translate('connected_device_same_model'), 'danger');
        return false;
      }

      const existingRegistration = await this.interventionService.getRegistration(sn);

      if (existingRegistration) {
        await this.showToast(this.transloco.translate('connected_device_already_registered'), 'danger');
        return false;
      }

      this.connectedSn = sn;
      return true;
    } catch {
      await this.showToast(this.transloco.translate('connected_device_not_found'), 'danger');
      return false;
    } finally {
      this.isSearchingConnected = false;
    }
  }

  private async lookupConnectedDevice(sn: string): Promise<Device | null> {
    return this.lookupService.lookupSilent(sn);
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

  onCommissioning(): void {
    const extras = this.connectedSn
      ? { queryParams: { connectedSn: this.connectedSn } }
      : undefined;
    this.router.navigate(['/device-management', this.sn, 'add-device'], extras);
  }

  onAnnualService(): void {
    this.router.navigate(['/device-management', this.sn, 'annual-service']);
  }

  onIntervention(): void {
    this.router.navigate(['/device-management', this.sn, 'intervention']);
  }

  onHistory(): void {
    this.router.navigate(['/device-management', this.sn, 'history']);
  }
}
