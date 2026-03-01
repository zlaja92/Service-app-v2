import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonSearchbar, IonList, IonItem, IonLabel, IonButton,
  IonSkeletonText, IonMenuButton, ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslocoModule } from '@jsverse/transloco';
import { DeviceSearchService } from '../services/device-search.service';

@Component({
  selector: 'app-device-search',
  templateUrl: './device-search.page.html',
  styleUrls: ['./device-search.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonSearchbar, IonList, IonItem, IonLabel, IonButton,
    IonSkeletonText, IonMenuButton,
    TranslocoModule,
  ],
})
export class DeviceSearchPage implements ViewWillEnter {
  protected searchService = inject(DeviceSearchService);
  private router = inject(Router);

  ionViewWillEnter(): void {
    if (this.searchService.keepState) {
      this.searchService.keepState = false;
      return;
    }
    this.searchService.reset();
  }

  onSearchInput(event: CustomEvent): void {
    const value = (event.detail.value as string) ?? '';

    if (!value.trim()) {
      this.searchService.reset();
      return;
    }

    this.searchService.search(value);
  }

  loadMore(): void {
    this.searchService.loadMore();
  }

  onDeviceClick(deviceCode: string): void {
    this.searchService.keepState = true;
    this.router.navigate(['/device', deviceCode, 'device-groups']);
  }
}
