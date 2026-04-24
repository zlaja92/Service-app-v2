import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonIcon, IonItem, IonInput, IonLabel, IonList,
  IonMenuButton, IonSpinner,
  ViewWillEnter, ViewDidLeave,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { searchOutline } from 'ionicons/icons';
import { TranslocoModule } from '@jsverse/transloco';
import { ConfigStore } from '../../../core/config/config.store';
import { UserSearchService } from '../services/user-search.service';

@Component({
  selector: 'app-search-by-user',
  templateUrl: './search-by-user.page.html',
  styleUrls: ['./search-by-user.page.scss'],
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonButton, IonIcon, IonItem, IonInput, IonLabel, IonList,
    IonMenuButton, IonSpinner,
    TranslocoModule,
  ],
})
export class SearchByUserPage implements ViewWillEnter, ViewDidLeave {
  protected searchService = inject(UserSearchService);
  protected configStore = inject(ConfigStore);
  private router = inject(Router);

  protected firstName = '';
  protected lastName = '';
  protected hasSearched = false;

  constructor() {
    addIcons({ searchOutline });
  }

  ionViewWillEnter(): void {
    // State preserved when returning from device-detail
  }

  ionViewDidLeave(): void {
    // If we navigated to device-detail, keep state. Otherwise clear.
    if (!this.router.url.startsWith('/device-management')) {
      this.firstName = '';
      this.lastName = '';
      this.hasSearched = false;
      this.searchService.clear();
    }
  }

  async onSearch(): Promise<void> {
    this.hasSearched = true;
    await this.searchService.search(this.firstName, this.lastName);
  }

  async onLoadMore(): Promise<void> {
    await this.searchService.loadMore();
  }

  onResultClick(sn: string): void {
    this.router.navigate(['/device-management', sn]);
  }
}
