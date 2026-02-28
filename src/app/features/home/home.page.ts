import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonItem, IonInput,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  searchOutline, barcodeOutline, personOutline, hardwareChipOutline, documentTextOutline, cartOutline,
} from 'ionicons/icons';
import { AuthStore } from '../../core/auth/auth.store';
import { TenantStore } from '../../core/tenant/tenant.store';
import { ConfigStore } from '../../core/config/config.store';
import { FeatureFlagDirective } from '../../shared/directives/feature-flag.directive';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonItem, IonInput,
    FeatureFlagDirective,
  ],
})
export class HomePage {
  protected authStore = inject(AuthStore);
  protected tenantStore = inject(TenantStore);
  protected configStore = inject(ConfigStore);
  private router = inject(Router);

  barcodeInput = '';

  constructor() {
    addIcons({ searchOutline, barcodeOutline, personOutline, hardwareChipOutline, documentTextOutline, cartOutline });
  }

  searchByBarcode(): void {
    // TODO: Implement barcode search (manual input)
  }

  scanBarcode(): void {
    // TODO: Implement barcode scanning
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
