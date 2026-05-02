import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonList, IonItem, IonLabel, IonSkeletonText, IonMenuButton, ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslocoModule } from '@jsverse/transloco';
import { DeviceGroupsService } from '../services/device-groups.service';
import { CartService } from '../../cart/cart.service';
import { Group } from '../../../shared/models/group.model';

@Component({
  selector: 'app-device-groups',
  templateUrl: './device-groups.page.html',
  styleUrls: ['./device-groups.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonList, IonItem, IonLabel, IonSkeletonText, IonMenuButton,
    TranslocoModule,
  ],
})
export class DeviceGroupsPage implements ViewWillEnter {
  protected groupsService = inject(DeviceGroupsService);
  private cartService = inject(CartService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private deviceCode = '';
  private hasNavigatedToParts = false;
  private loadingTimeout: ReturnType<typeof setTimeout> | null = null;

  ionViewWillEnter(): void {
    this.deviceCode = this.route.snapshot.paramMap.get('code') ?? '';
    if (this.loadingTimeout) clearTimeout(this.loadingTimeout);

    this.groupsService.load(this.deviceCode).then(() => {
      if (this.loadingTimeout) clearTimeout(this.loadingTimeout);
    });

    this.loadingTimeout = setTimeout(() => {
      this.groupsService.isLoading = false;
    }, 30000);

    if (!this.hasNavigatedToParts) {
      this.cartService.clearItems();
    }
    this.hasNavigatedToParts = false;
  }

  onGroupClick(group: Group): void {
    this.hasNavigatedToParts = true;
    this.router.navigate(['/device', this.deviceCode, 'device-groups', group.id, 'device-parts']);
  }
}
