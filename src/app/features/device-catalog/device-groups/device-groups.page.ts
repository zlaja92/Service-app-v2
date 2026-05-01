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
  // Tracks if user navigated forward to parts page.
  // When returning from parts, cart is preserved.
  // When entering fresh from search, cart is cleared.
  private hasNavigatedToParts = false;

  ionViewWillEnter(): void {
    this.deviceCode = this.route.snapshot.paramMap.get('code') ?? '';
    this.groupsService.load(this.deviceCode);

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
