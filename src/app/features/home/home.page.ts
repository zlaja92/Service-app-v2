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
import { TranslocoModule } from '@jsverse/transloco';
import { FeatureFlagDirective } from '../../shared/directives/feature-flag.directive';
import { FirestoreService } from '../../core/firebase/firestore.service';
import { sr } from '../../core/i18n/translations/sr';
import { en } from '../../core/i18n/translations/en';
import { LANGUAGE_LABELS } from '../../core/i18n/i18n.model';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonItem, IonInput,
    TranslocoModule,
    FeatureFlagDirective,
  ],
})
export class HomePage {
  protected authStore = inject(AuthStore);
  protected tenantStore = inject(TenantStore);
  protected configStore = inject(ConfigStore);
  private router = inject(Router);
  private firestoreService = inject(FirestoreService);

  barcodeInput = '';
  uploadStatus = '';

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

  // TODO: Remove after initial upload
  async uploadTranslations(): Promise<void> {
    this.uploadStatus = 'Uploading...';
    try {
      await this.firestoreService.setTenantDocument('translations', 'sr', sr as Record<string, unknown>);
      await this.firestoreService.setTenantDocument('translations', 'en', en as Record<string, unknown>);

      const versionDoc: Record<string, unknown> = {};
      for (const [lang, label] of Object.entries(LANGUAGE_LABELS)) {
        versionDoc[lang] = { version: 1, label };
      }
      await this.firestoreService.setTenantDocument('translations', 'version', versionDoc);

      this.uploadStatus = 'Upload complete!';
    } catch (error) {
      this.uploadStatus = `Error: ${String(error)}`;
    }
  }
}
