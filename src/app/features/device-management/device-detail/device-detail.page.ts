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
  protected configStore = inject(ConfigStore);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected sn = '';

  constructor() {
    addIcons({ buildOutline, constructOutline, hammerOutline, timeOutline });
  }

  ionViewWillEnter(): void {
    this.sn = this.route.snapshot.paramMap.get('sn') ?? '';

    if (this.sn && this.lookupService.sn !== this.sn) {
      this.lookupService.lookup(this.sn);
    }
  }

  onCommissioning(): void {
    // TODO: navigate to commissioning page
  }

  onAnnualService(): void {
    // TODO: navigate to annual service page
  }

  onIntervention(): void {
    // TODO: navigate to intervention page
  }

  onHistory(): void {
    // TODO: navigate to history page
  }
}
