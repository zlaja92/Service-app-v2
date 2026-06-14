import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonItem, IonInput, IonSkeletonText,
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
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerTypeHintALLOption,
} from '@capacitor/barcode-scanner';
import { SplashScreen } from '@capacitor/splash-screen';
import { stripWhitespace, hasWhitespace } from '../../shared/utils/trim';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonItem, IonInput, IonSkeletonText,
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

  snInput = '';
  private splashHidden = false;

  constructor() {
    addIcons({ searchOutline, barcodeOutline, personOutline, hardwareChipOutline, documentTextOutline, cartOutline });
  }

  /** Pozove se kad img.onload fire-uje — logo je vidljiv, splash može da nestane. */
  protected onLogoLoaded(): void {
    this.hideSplash();
  }

  /** Fallback ako img.onerror — ne čekamo, sakrij splash da korisnik ne ostane na splash-u. */
  protected onLogoError(): void {
    this.hideSplash();
  }

  private hideSplash(): void {
    if (this.splashHidden) return;
    this.splashHidden = true;
    void SplashScreen.hide();
  }

  async searchBySn(): Promise<void> {
    // A serial number must never contain whitespace. Manually typed input is
    // validated (not silently stripped) so the user is told to fix it.
    if (hasWhitespace(this.snInput)) {
      const toast = await this.toastCtrl.create({
        message: this.translocoService.translate('home_sn_no_spaces'),
        duration: 3000,
        color: 'warning',
        position: 'bottom',
      });
      await toast.present();
      return;
    }

    const sn = this.snInput;
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

  async scanBarcode(): Promise<void> {
    try {
      const result = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHintALLOption.ALL,
      });

      if (result.ScanResult) {
        // Strip all whitespace from the scan before it lands in the field —
        // barcode scans can inject spaces inside the serial number.
        this.snInput = stripWhitespace(result.ScanResult);
      }
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code ?? '';
      if (code === 'OS-PLUG-BARC-0006') return; // user cancelled

      const toast = await this.toastCtrl.create({
        message: this.translocoService.translate('home_scan_error'),
        duration: 3000,
        color: 'danger',
        position: 'bottom',
      });
      await toast.present();
    }
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
