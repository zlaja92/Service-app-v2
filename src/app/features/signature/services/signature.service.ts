import { Injectable, inject } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';
import { StorageService } from '../../../core/firebase/storage.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { LoadingAlertService } from '../../../shared/services/loading-alert.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { SignatureModalComponent } from '../components/signature-modal/signature-modal.component';
import { SignatureUploadContext } from '../models/signature.model';

/**
 * Captures a customer signature (fullscreen modal) and uploads it to Storage.
 * Self-contained: callers only decide whether to invoke it (via the feature flag
 * + per-flow config) and store the returned path on the intervention.
 */
@Injectable({ providedIn: 'root' })
export class SignatureService {
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly storageService = inject(StorageService);
  private readonly tenantService = inject(TenantService);
  private readonly loadingAlert = inject(LoadingAlertService);
  private readonly logger = inject(LoggerService);

  /**
   * Opens the signature modal, uploads the signature as a PNG, and returns its
   * Storage path. Returns null if the user cancelled or the upload failed
   * (no network) — in which case the caller must abort saving the intervention.
   */
  async captureAndUpload(ctx: SignatureUploadContext): Promise<string | null> {
    const dataUrl = await this.openModal();
    if (!dataUrl) return null;

    const path = this.buildStoragePath(ctx);
    try {
      await this.loadingAlert.wrap(
        () => this.storageService.uploadDataUrl(path, dataUrl, 'image/png'),
        'signature_uploading',
      );
      this.logger.info('Signature uploaded', { path });
      return path;
    } catch (error) {
      this.logger.error('Signature upload failed', { path, error: String(error) });
      await this.showError();
      return null;
    }
  }

  private async openModal(): Promise<string | null> {
    const modal = await this.modalCtrl.create({
      component: SignatureModalComponent,
      cssClass: 'fullscreen-modal',
      backdropDismiss: false,
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<{ dataUrl: string }>();
    return role === 'save' && data?.dataUrl ? data.dataUrl : null;
  }

  private buildStoragePath(ctx: SignatureUploadContext): string {
    // Stored in the intervention as signaturePath, relative to the tenant root
    // (StorageService adds the tenant folder); older documents keep the full path.
    const folder = this.tenantService.getInterventionStorageFolder(ctx.deviceType, ctx.sn);
    return `${folder}/signatures/signature_${Date.now()}.png`;
  }

  private async showError(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: this.transloco.translate('signature_upload_error'),
      duration: 3000,
      color: 'danger',
      position: 'bottom',
    });
    await toast.present();
  }
}
