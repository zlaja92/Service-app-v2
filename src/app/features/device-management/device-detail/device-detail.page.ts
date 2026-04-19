import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonButton, IonIcon, IonSkeletonText, IonMenuButton,
  IonItem, IonLabel, IonInput,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personAddOutline, buildOutline, constructOutline, hammerOutline, timeOutline,
} from 'ionicons/icons';
import { TranslocoModule } from '@jsverse/transloco';
import { FeatureFlagDirective } from '../../../shared/directives/feature-flag.directive';
import { DeviceLookupService } from '../services/device-lookup.service';
import { DeviceRegistrationService } from '../services/device-registration.service';
import { InterventionService } from '../services/intervention.service';
import { AnnualServiceEligibilityService } from '../services/annual-service-eligibility.service';
import { ConfigStore } from '../../../core/config/config.store';

@Component({
  selector: 'app-device-detail',
  templateUrl: './device-detail.page.html',
  styleUrls: ['./device-detail.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonButton, IonIcon, IonSkeletonText, IonMenuButton,
    IonItem, IonLabel, IonInput,
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

  protected sn = '';
  protected isInitializing = true;
  protected isCommissioningDone = false;

  constructor() {
    addIcons({ personAddOutline, buildOutline, constructOutline, hammerOutline, timeOutline });
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

    await this.registrationService.checkRegistration(this.sn);

    const device = this.lookupService.device;

    console.log('device-detail init', {
      commissioning: device?.commissioning,
      isRegistered: this.registrationService.isRegistered,
      warrantyStatus: this.registrationService.userData?.['warrantyStatus'],
    });

    if (this.registrationService.isRegistered && device?.commissioning) {
      await this.checkCommissioningDone();
    }

    if (device?.annualService) {
      await this.eligibilityService.checkEligibility(this.sn, device);
    }

    this.isInitializing = false;
  }

  private async checkCommissioningDone(): Promise<void> {
    const interventions = await this.interventionService.getInterventionsBySn(this.sn);
    this.isCommissioningDone = interventions.some(i => {
      const typeName = this.getInterventionTypeName(i.data);
      return typeName.toUpperCase().includes('PUŠTANJE')
        || typeName.toUpperCase().includes('PUSTANJE');
    });
  }

  private getInterventionTypeName(data: Record<string, unknown>): string {
    const interventionType = data['interventionType'];
    if (typeof interventionType === 'object' && interventionType !== null) {
      return (interventionType as { name: string }).name ?? '';
    }
    return String(interventionType ?? '');
  }

  get isOperational(): boolean {
    if (this.registrationService.isRegistered !== true) return false;

    const warrantyStatus = this.registrationService.userData?.['warrantyStatus'];
    if (warrantyStatus === 'out_of_warranty') return true;

    return !this.lookupService.device?.commissioning || this.isCommissioningDone;
  }

  onAddUser(): void {
    this.router.navigate(['/device-management', this.sn, 'add-user']);
  }

  onCommissioning(): void {
    this.router.navigate(['/device-management', this.sn, 'add-device']);
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
