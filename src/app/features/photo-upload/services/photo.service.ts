import { Injectable, inject } from '@angular/core';
import { CapturedPhoto, INTERVENTION_TYPE_SHORT, PhotoUploadResult } from '../models/photo.model';
import { CameraService } from './camera.service';
import { StorageService } from '../../../core/firebase/storage.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { PhotoRequirement } from '../../../core/config/config.model';
import { Clearable } from '../../../core/session/clearable';

/**
 * Intervention photos never change (unique, timestamped names), so the WebView
 * may keep them cached for a year: the gallery and the viewer then reuse the
 * downloaded file instead of revalidating it with the server.
 */
const PHOTO_CACHE_CONTROL = 'private, max-age=31536000';

@Injectable({ providedIn: 'root' })
export class PhotoService implements Clearable {
  private readonly cameraService = inject(CameraService);
  private readonly storageService = inject(StorageService);
  private readonly tenantService = inject(TenantService);
  private readonly logger = inject(LoggerService);

  photos: CapturedPhoto[] = [];
  requirement: PhotoRequirement | null = null;

  get isMinimumMet(): boolean {
    if (!this.requirement) return true;
    return this.photos.length >= this.requirement.requiredPhotos;
  }

  get canTakeMore(): boolean {
    if (!this.requirement) return false;
    return this.photos.length < this.requirement.maxPhotos;
  }

  setRequirement(requirement: PhotoRequirement): void {
    this.requirement = requirement;
  }

  async takePhoto(): Promise<boolean> {
    if (!this.canTakeMore) return false;

    const result = await this.cameraService.takePhoto();
    if (!result) return false;

    this.photos.push({
      id: crypto.randomUUID(),
      webPath: result.webPath,
      uri: result.uri,
    });
    return true;
  }

  async pickFromGallery(): Promise<boolean> {
    if (!this.canTakeMore) return false;

    const result = await this.cameraService.pickFromGallery();
    if (!result) return false;

    this.photos.push({
      id: crypto.randomUUID(),
      webPath: result.webPath,
      uri: result.uri,
    });
    return true;
  }

  removePhoto(id: string): void {
    this.photos = this.photos.filter(p => p.id !== id);
  }

  /**
   * Uploads the captured photos. Returns the relative paths (without the tenant,
   * like signaturePath) of the uploaded photos, in capture order, and how many
   * failed — the caller stores both in the intervention, so a failed upload
   * stays visible instead of being lost silently.
   */
  async uploadPhotos(sn: string, deviceType: string, interventionType: string): Promise<PhotoUploadResult> {
    const result: PhotoUploadResult = { uploaded: [], failed: 0 };
    if (this.photos.length === 0) return result;

    // Relative to the tenant root; StorageService adds the tenant folder.
    const folder = this.tenantService.getInterventionStorageFolder(deviceType, sn);
    const shortType = INTERVENTION_TYPE_SHORT[interventionType] ?? interventionType;
    const timestamp = this.formatTimestamp();

    for (let i = 0; i < this.photos.length; i++) {
      const fileName = `${shortType}_${timestamp}_${i + 1}.jpg`;
      const storagePath = `${folder}/${fileName}`;

      try {
        await this.storageService.uploadFile(storagePath, this.photos[i].uri, 'image/jpeg', PHOTO_CACHE_CONTROL);
        this.logger.info('Photo uploaded', { storagePath });
        result.uploaded.push(storagePath);
      } catch (error) {
        this.logger.error('Photo upload failed', { storagePath, error: String(error) });
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Download URLs of stored intervention photos (relative paths from photoPaths),
   * in the same order. A photo that cannot be resolved (deleted, no access)
   * gives null, so the caller can show a placeholder in its place.
   */
  async getPhotoUrls(paths: string[]): Promise<(string | null)[]> {
    return Promise.all(paths.map(path => this.storageService.getFileUrl(path)));
  }

  clear(): void {
    this.photos = [];
    this.requirement = null;
  }

  /**
   * 'DD-MM-YYYY_HH-mm-ss'. The time keeps file names unique when several
   * interventions of the same type are saved for one SN on the same day —
   * with the date alone, a later upload overwrote the earlier photos.
   */
  private formatTimestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
      + `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  }
}
