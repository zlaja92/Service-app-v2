import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonButton, IonIcon, IonSkeletonText, IonMenuButton,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  buildOutline, constructOutline, hammerOutline, timeOutline,
} from 'ionicons/icons';
import { TranslocoModule } from '@jsverse/transloco';
import { FeatureFlagDirective } from '../../../shared/directives/feature-flag.directive';
import { DeviceLookupService } from '../services/device-lookup.service';
import { DeviceRegistrationService } from '../services/device-registration.service';
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
    TranslocoModule,
    FeatureFlagDirective,
  ],
})
export class DeviceDetailPage implements ViewWillEnter {
  protected lookupService = inject(DeviceLookupService);
  protected registrationService = inject(DeviceRegistrationService);
  protected eligibilityService = inject(AnnualServiceEligibilityService);
  protected configStore = inject(ConfigStore);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected sn = '';
  protected isInitializing = true;

  constructor() {
    addIcons({ buildOutline, constructOutline, hammerOutline, timeOutline });
  }

  ionViewWillEnter(): void {
    this.sn = this.route.snapshot.paramMap.get('sn') ?? '';

    if (this.sn) {
      void this.initializeDevice();
    }
  }

  private async initializeDevice(): Promise<void> {
    this.isInitializing = true;

    if (this.lookupService.sn !== this.sn) {
      await this.lookupService.lookup(this.sn);
    }

    await this.registrationService.checkRegistration(this.sn);

    const device = this.lookupService.device;
    if (device?.annualService) {
      await this.eligibilityService.checkEligibility(this.sn, device);
    }

    this.isInitializing = false;
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
