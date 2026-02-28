import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonSearchbar, IonList, IonItem, IonLabel, IonButton,
  IonSkeletonText, IonMenuButton,
} from '@ionic/angular/standalone';
import { SearchByDeviceService } from '../services/search-by-device.service';

@Component({
  selector: 'app-search-by-device',
  templateUrl: './search-by-device.page.html',
  styleUrls: ['./search-by-device.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonSearchbar, IonList, IonItem, IonLabel, IonButton,
    IonSkeletonText, IonMenuButton,
  ],
})
export class SearchByDevicePage {
  protected searchService = inject(SearchByDeviceService);
  private router = inject(Router);

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
    this.router.navigate(['/device-info', deviceCode]);
  }
}
