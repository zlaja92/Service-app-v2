import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonButton, IonIcon, IonSkeletonText, IonMenuButton,
  IonItem, IonLabel, IonInput, IonSpinner, IonSelect, IonSelectOption,
  ViewWillEnter, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personAddOutline, buildOutline, constructOutline, hammerOutline, timeOutline,
  searchOutline, barcodeOutline, shieldCheckmarkOutline,
} from 'ionicons/icons';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerTypeHintALLOption,
} from '@capacitor/barcode-scanner';
import { FeatureFlagDirective } from '../../../shared/directives/feature-flag.directive';
import { DeviceLookupService } from '../services/device-lookup.service';
import { DeviceRegistrationService } from '../services/device-registration.service';
import { InterventionService } from '../services/intervention.service';
import { InterventionType } from '../models/intervention.model';
import { AnnualServiceEligibilityService } from '../services/annual-service-eligibility.service';
import { ConfigStore } from '../../../core/config/config.store';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { WarrantyExtensionService } from '../services/warranty-extension.service';
import { LoadingAlertService } from '../../../shared/services/loading-alert.service';
import { Device } from '../../../shared/models/device.model';
import { stripWhitespace, hasWhitespace } from '../../../shared/utils/trim';

@Component({
  selector: 'app-device-detail',
  templateUrl: './device-detail.page.html',
  styleUrls: ['./device-detail.page.scss'],
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonButton, IonIcon, IonSkeletonText, IonMenuButton,
    IonItem, IonLabel, IonInput, IonSpinner, IonSelect, IonSelectOption,
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
  private confirmService = inject(ConfirmService);
  private warrantyService = inject(WarrantyExtensionService);
  private loadingAlert = inject(LoadingAlertService);
  private transloco = inject(TranslocoService);
  private cdr = inject(ChangeDetectorRef);

  protected sn = '';
  protected isInitializing = true;
  protected isCommissioningDone = false;

  protected connectedSnInput = '';
  protected connectedSn = '';
  protected isSearchingConnected = false;
  /** True when a warranty-extension request already exists for this device → button disabled. */
  protected warrantyRequestExists = false;

  /** No-catalog mode, SN confirmed unregistered: the device type is picked before adding the user. */
  protected canPickType = false;
  protected typeOptions: Device[] = [];
  protected selectedType = '';
  /** No-catalog mode: models are entered per SN and stored in each unit's registration. */
  protected modelInput = '';
  protected connectedModelInput = '';

  constructor() {
    addIcons({ personAddOutline, buildOutline, constructOutline, hammerOutline, timeOutline, searchOutline, barcodeOutline, shieldCheckmarkOutline });
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
    this.warrantyRequestExists = false;
    this.canPickType = false;

    if (this.lookupService.sn !== this.sn) {
      await this.lookupService.lookup(this.sn);
    }

    let device = this.lookupService.device;
    const unregisteredNoCatalog = this.isNoCatalogMode
      && this.lookupService.registrationStatus === 'unregistered';

    if (!device && !unregisteredNoCatalog) {
      this.isInitializing = false;
      return;
    }

    await this.registrationService.checkRegistration(this.sn);

    if (unregisteredNoCatalog) {
      // Registration overwrites users/{sn}, so the type is offered only when
      // this second check also confirms the SN is unregistered.
      if (this.registrationService.isRegistered === false) {
        this.canPickType = true;
        this.typeOptions = await this.lookupService.getSelectableDevices();
        this.selectedType = device?.type ?? '';
      } else if (this.registrationService.isRegistered === true) {
        // Just registered (back from add-user) or registered meanwhile: resolve it
        // like any registered SN, so the model comes from the registration.
        device = await this.lookupService.lookup(this.sn);
      } else if (this.registrationService.isRegistered === null) {
        void this.showToast(this.transloco.translate('device_detail_registration_check_error'));
      }
    }

    if (!device) {
      // No-catalog mode, no type picked yet (or the check failed).
      this.eligibilityService.clear();
      this.isInitializing = false;
      this.cdr.markForCheck();
      return;
    }

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

    // Only when the action would otherwise show: is there already a request?
    this.warrantyRequestExists = this.canExtendWarrantyNow
      ? await this.warrantyService.exists(this.sn)
      : false;

    this.isInitializing = false;
    this.cdr.markForCheck();

    if (this.needsCommissioning) {
      void this.confirmService.warn('device_detail_commissioning_required_message');
    }
  }

  /** Device catalog off: the device type comes from the registration, not the SN. */
  protected get isNoCatalogMode(): boolean {
    return !this.configStore.isFeatureEnabled('deviceCatalog');
  }

  /** Makes the picked device type the active device of this unregistered SN. */
  protected onTypeSelected(): void {
    const device = this.typeOptions.find(d => d.type === this.selectedType);
    if (!device || device.type === this.lookupService.device?.type) return;

    // The type's deviceName only labels the picker; the model name is unknown
    // until registration, so the card shows no title yet.
    this.lookupService.device = { ...device, name: '' };
    this.lookupService.sn = this.sn;
    // An unregistered SN has no eligibility yet; drop any state of a previous device.
    this.eligibilityService.clear();
    this.cdr.markForCheck();
  }

  get needsCommissioning(): boolean {
    const device = this.lookupService.device;
    if (!device) return false;
    const warrantyStatus = this.registrationService.userData?.['warrantyStatus'];
    return device.commissioning === true
      && !this.isCommissioningDone
      && warrantyStatus === 'in-warranty';
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
    if (warrantyStatus === 'out-of-warranty') return true;

    return !this.lookupService.device?.commissioning || this.isCommissioningDone;
  }

  get isAnnualServiceEnabled(): boolean {
    return this.eligibilityService.isEligible && !this.eligibilityService.isChecking;
  }

  /**
   * Whether the "Extended warranty" action is available: the device allows it
   * (canExtendWarranty) AND today is still within the configured window of
   * `warrantyExtensionWindowMonths` months from the device's purchase date.
   */
  get canExtendWarrantyNow(): boolean {
    return this.warrantyService.canRequest(this.lookupService.device, this.registrationService.userData);
  }

  get needsConnectedDevice(): boolean {
    return !!this.lookupService.device?.connectedDevice
      && this.registrationService.isRegistered !== true;
  }

  async scanConnectedBarcode(): Promise<void> {
    try {
      const result = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHintALLOption.ALL,
      });

      if (result.ScanResult) {
        // Strip all whitespace from the scan — barcode scans can inject spaces
        // inside the serial number.
        this.connectedSnInput = stripWhitespace(result.ScanResult);
      }
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code ?? '';
      if (code === 'OS-PLUG-BARC-0006') return;

      // OS-PLUG-BARC-0007: camera access denied — tell the user how to fix it.
      await this.showToast(this.transloco.translate(
        code === 'OS-PLUG-BARC-0007' ? 'scan_camera_denied' : 'home_scan_error',
      ));
    }
  }

  async onAddUser(): Promise<void> {
    if (this.canPickType && !this.modelInput.trim()) {
      await this.showToast(this.transloco.translate('device_detail_model_required'));
      return;
    }

    if (this.needsConnectedDevice) {
      const valid = await this.validateConnectedDevice();
      if (!valid) return;

      if (this.canPickType && !this.connectedModelInput.trim()) {
        await this.showToast(this.transloco.translate('device_detail_connected_model_required'));
        return;
      }
    }

    const queryParams: Record<string, string> = {};
    if (this.connectedSn) queryParams['connectedSn'] = this.connectedSn;
    if (this.canPickType) {
      queryParams['deviceModel'] = this.modelInput.trim();
      if (this.connectedSn) queryParams['connectedDeviceModel'] = this.connectedModelInput.trim();
    }

    const extras = Object.keys(queryParams).length > 0 ? { queryParams } : undefined;
    this.router.navigate(['/device-management', this.sn, 'add-user'], extras);
  }

  private async validateConnectedDevice(): Promise<boolean> {
    const sn = this.connectedSnInput;

    if (!sn.trim()) {
      await this.showToast(this.transloco.translate('connected_device_sn_placeholder'));
      return false;
    }

    // A serial number must never contain whitespace — validate manual input
    // (the scan path already strips it) before the length check.
    if (hasWhitespace(sn)) {
      await this.showToast(this.transloco.translate('connected_device_sn_no_spaces'));
      return false;
    }

    // The SN is a Firestore document ID, where '/' is a path separator.
    if (sn.includes('/')) {
      await this.showToast(this.transloco.translate('home_sn_no_slash'));
      return false;
    }

    // Applies in both modes: a unit cannot be connected to itself.
    if (sn === this.sn) {
      await this.showToast(this.transloco.translate('connected_device_same_sn'));
      return false;
    }

    const minLength = this.configStore.business()?.snMinLength ?? 0;
    if (sn.length < minLength) {
      await this.showToast(
        this.transloco.translate('connected_device_sn_too_short', { min: minLength }),
      );
      return false;
    }

    this.isSearchingConnected = true;

    try {
      if (this.isNoCatalogMode) {
        // No catalog to validate the connected unit against: it gets the main
        // device's type (both units are registered with the same device).
        if (await this.interventionService.getRegistration(sn)) {
          await this.showToast(this.transloco.translate('connected_device_already_registered'));
          return false;
        }
        this.connectedSn = sn;
        return true;
      }

      const device = await this.lookupConnectedDevice(sn);

      if (!device) {
        await this.showToast(this.transloco.translate('connected_device_not_found'));
        return false;
      }

      if (!device.connectedDevice) {
        await this.showToast(this.transloco.translate('connected_device_no_connected_flag'));
        return false;
      }

      if (device.type !== this.lookupService.device?.type) {
        await this.showToast(this.transloco.translate('connected_device_wrong_type'));
        return false;
      }

      if (device.code === this.lookupService.device?.code) {
        await this.showToast(this.transloco.translate('connected_device_same_model'));
        return false;
      }

      const existingRegistration = await this.interventionService.getRegistration(sn);

      if (existingRegistration) {
        await this.showToast(this.transloco.translate('connected_device_already_registered'));
        return false;
      }

      this.connectedSn = sn;
      return true;
    } catch {
      await this.showToast(this.transloco.translate('connected_device_not_found'));
      return false;
    } finally {
      this.isSearchingConnected = false;
    }
  }

  private async lookupConnectedDevice(sn: string): Promise<Device | null> {
    return this.lookupService.lookupSilent(sn);
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
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

  /**
   * Records a customer warranty extension after a (translatable) confirmation.
   * Creates a document in the tenant `warrantyExtensions` collection.
   */
  async onWarrantyExtension(): Promise<void> {
    const confirmed = await this.confirmService.confirm(
      'warranty_extension_confirm_title',
      'warranty_extension_confirm_message',
      'warranty_extension_confirm_ok',
      'warranty_extension_confirm_cancel',
    );
    if (!confirmed) return;

    const ok = await this.loadingAlert.wrap(() => this.warrantyService.extend(this.sn));
    if (ok) {
      // Disable the button once a request has been sent for this device.
      this.warrantyRequestExists = true;
    }
    await this.showToast(
      this.transloco.translate(ok ? 'warranty_extension_success' : 'warranty_extension_error'),
    );
  }
}
