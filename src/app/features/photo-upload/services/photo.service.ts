import { Injectable, inject } from '@angular/core';
import { CapturedPhoto, INTERVENTION_TYPE_SHORT } from '../models/photo.model';
import { CameraService } from './camera.service';
import { StorageService } from '../../../core/firebase/storage.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { ConfigStore } from '../../../core/config/config.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { PhotoRequirement } from '../../../core/config/config.model';
import { Clearable } from '../../../core/session/clearable';

@Injectable({ providedIn: 'root' })
export class PhotoService implements Clearable {
  private readonly cameraService = inject(CameraService);
  private readonly storageService = inject(StorageService);
  private readonly tenantService = inject(TenantService);
  private readonly configStore = inject(ConfigStore);
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

  async uploadPhotos(sn: string, deviceType: string, interventionType: string): Promise<void> {
    if (this.photos.length === 0) return;

    const tenantId = this.tenantService.getCurrentTenantId();
    const collectionMapping = this.configStore.business()?.interventionCollections ?? {};
    const collectionName = collectionMapping[deviceType] ?? collectionMapping['default'] ?? 'interventions';
    const shortType = INTERVENTION_TYPE_SHORT[interventionType] ?? interventionType;
    const date = this.formatDate();

    for (let i = 0; i < this.photos.length; i++) {
      const fileName = `${shortType}_${date}_${i + 1}.jpg`;
      const storagePath = `${tenantId}/${collectionName}/${sn}/${fileName}`;

      try {
        await this.storageService.uploadFile(storagePath, this.photos[i].uri);
        this.logger.info('Photo uploaded', { storagePath });
      } catch (error) {
        this.logger.error('Photo upload failed', { storagePath, error: String(error) });
      }
    }
  }

  clear(): void {
    this.photos = [];
    this.requirement = null;
  }

  private formatDate(): string {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${d.getFullYear()}`;
  }
}
