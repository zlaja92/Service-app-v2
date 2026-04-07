import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonItem, IonInput,
  ToastController,
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
import { DeviceLookupService } from '../device-management/services/device-lookup.service';
import { TranslocoService } from '@jsverse/transloco';
import { FirestoreService } from '../../core/firebase/firestore.service'; // [TEMP:translation-upload] remove this import
import { LANGUAGE_LABELS, TranslationVersionDoc } from '../../core/i18n/i18n.model'; // [TEMP:translation-upload] remove this import
import { BUNDLED_TRANSLATIONS } from '../../core/i18n/translations'; // [TEMP:translation-upload] remove this import

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
  private lookupService = inject(DeviceLookupService);
  private toastCtrl = inject(ToastController);
  private translocoService = inject(TranslocoService);
  private firestoreService = inject(FirestoreService); // [TEMP:translation-upload] remove this line

  snInput = '';
  uploadStatus = ''; // [TEMP:translation-upload] remove this line

  constructor() {
    addIcons({ searchOutline, barcodeOutline, personOutline, hardwareChipOutline, documentTextOutline, cartOutline });
  }

  async searchBySn(): Promise<void> {
    const sn = this.snInput.trim();
    if (!sn) return;

    const device = await this.lookupService.lookup(sn);

    if (device) {
      this.router.navigate(['/device-management', sn]);
    } else {
      const toast = await this.toastCtrl.create({
        message: this.translocoService.translate('home_device_not_found'),
        duration: 3000,
        color: 'warning',
        position: 'bottom',
      });
      await toast.present();
    }
  }

  scanBarcode(): void {
    // TODO: Implement barcode scanning
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  // [TEMP:translation-upload] remove entire method
  async uploadTranslations(): Promise<void> {
    this.uploadStatus = 'Uploading...';
    try {
      // Read current version doc from Firestore
      const currentVersions = await this.firestoreService.getTenantDocument<TranslationVersionDoc>(
        'translations',
        'version',
      );

      const newVersionDoc: Record<string, unknown> = {};

      // Upload each bundled language
      for (const [lang, translations] of Object.entries(BUNDLED_TRANSLATIONS)) {
        this.uploadStatus = `Uploading ${lang}...`;
        await this.firestoreService.setTenantDocument(
          'translations',
          lang,
          translations as Record<string, unknown>,
        );

        const currentVersion = currentVersions?.[lang]?.version ?? 0;
        const label = LANGUAGE_LABELS[lang] ?? lang;
        newVersionDoc[lang] = { version: currentVersion + 1, label };
      }

      // Upload version doc
      await this.firestoreService.setTenantDocument('translations', 'version', newVersionDoc);

      const langs = Object.keys(BUNDLED_TRANSLATIONS);
      this.uploadStatus = `Upload complete! (${langs.join(', ')})`;
    } catch (error) {
      this.uploadStatus = `Error: ${String(error)}`;
    }
  }
}
