import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonList, IonItem, IonLabel, IonSkeletonText, IonMenuButton, IonButton, IonIcon, IonSpinner,
  ViewWillEnter, ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cartOutline } from 'ionicons/icons';
import { DevicePartsService, Part } from '../services/device-parts.service';
import { DeviceGroupsService } from '../services/device-groups.service';
import { ConfigStore } from '../../../core/config/config.store';
import { CartService } from '../../cart/cart.service';
import { DeviceSearchService } from '../services/device-search.service';
import { PartDetailModalComponent } from '../components/part-detail-modal/part-detail-modal.component';
import { TranslocoModule } from '@jsverse/transloco';
import { PartDetail } from '../services/part-detail.service';

@Component({
  selector: 'app-device-parts',
  templateUrl: './device-parts.page.html',
  styleUrls: ['./device-parts.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonList, IonItem, IonLabel, IonSkeletonText, IonMenuButton, IonButton, IonIcon, IonSpinner,
    TranslocoModule,
  ],
})
export class DevicePartsPage implements ViewWillEnter {
  protected partsService = inject(DevicePartsService);
  protected configStore = inject(ConfigStore);
  protected cartService = inject(CartService);
  private searchService = inject(DeviceSearchService);
  private groupsService = inject(DeviceGroupsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private modalController = inject(ModalController);

  constructor() {
    addIcons({ cartOutline });
  }

  protected isReady = false;
  private readyTimeout: ReturnType<typeof setTimeout> | null = null;

  async ionViewWillEnter(): Promise<void> {
    this.isReady = false;
    if (this.readyTimeout) clearTimeout(this.readyTimeout);

    const code = this.route.snapshot.paramMap.get('code') ?? '';
    const groupId = this.route.snapshot.paramMap.get('groupId') ?? '';
    const groupPhoto = this.groupsService.groups.find((g) => g.id === groupId)?.groupPhoto ?? '';

    await this.partsService.load(code, groupId, groupPhoto);

    if (!this.partsService.groupPhoto) {
      this.isReady = true;
      return;
    }

    this.readyTimeout = setTimeout(() => { this.isReady = true; }, 30000);
  }

  onImageLoaded(): void {
    if (this.readyTimeout) clearTimeout(this.readyTimeout);
    this.isReady = true;
  }

  async onPartClick(part: Part): Promise<void> {
    const modal = await this.modalController.create({
      component: PartDetailModalComponent,
      componentProps: {
        partCode: part.code,
        partName: part.name,
      },
      cssClass: 'card-dialog',
    });

    await modal.present();

    const { data, role } = await modal.onDidDismiss<PartDetail>();
    if (role === 'add-to-cart' && data) {
      this.cartService.addItem(data.partCode, data.name, data.price, data.currency);

      if (!this.cartService.context?.deviceType) {
        const code = this.route.snapshot.paramMap.get('code') ?? '';
        const device = this.searchService.devices.find(d => d.code === code);
        if (device) {
          this.cartService.context = {
            ...this.cartService.context ?? { source: 'home' },
            deviceType: device.type,
            deviceCode: device.code,
            deviceName: device.name,
          };
        }
      }
    }
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
