import { Injectable, inject } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { LoggerService } from '../../../core/logger/logger.service';
import { ConfigStore } from '../../../core/config/config.store';

@Injectable({ providedIn: 'root' })
export class CameraService {
  private readonly logger = inject(LoggerService);
  private readonly configStore = inject(ConfigStore);

  async takePhoto(): Promise<{ webPath: string; uri: string } | null> {
    return this.getPhoto(CameraSource.Camera);
  }

  async pickFromGallery(): Promise<{ webPath: string; uri: string } | null> {
    return this.getPhoto(CameraSource.Photos);
  }

  private async getPhoto(source: CameraSource): Promise<{ webPath: string; uri: string } | null> {
    try {
      const business = this.configStore.business()!;

      const photo = await Camera.getPhoto({
        quality: business.photoQuality,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source,
        saveToGallery: false,
        width: business.photoMaxWidth,
        height: business.photoMaxWidth,
      });

      const webPath = photo.webPath ?? '';
      const uri = photo.path ?? photo.webPath ?? '';

      if (!webPath && !uri) {
        this.logger.warn('Camera returned empty paths');
        return null;
      }

      return { webPath, uri };
    } catch (error) {
      this.logger.warn('Camera cancelled or failed', { error: String(error) });
      return null;
    }
  }
}
