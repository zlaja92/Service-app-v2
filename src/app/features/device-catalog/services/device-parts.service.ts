import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { StorageService } from '../../../core/firebase/storage.service';
import { LoggerService } from '../../../core/logger/logger.service';

export interface Part {
  id: string;
  code: string;
  name: string;
}

interface PartDoc {
  Code: string;
  'Part name': string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class DevicePartsService {
  private firestoreService = inject(FirestoreService);
  private storageService = inject(StorageService);
  private logger = inject(LoggerService);

  parts: Part[] = [];
  groupPhoto = '';
  isLoading = false;

  async load(deviceCode: string, groupId: string, groupPhoto: string): Promise<void> {
    this.isLoading = true;
    this.parts = [];
    this.groupPhoto = '';

    try {
      if (groupPhoto) {
        this.groupPhoto = await this.storageService.resolveFileUrl('Photos', groupPhoto, ['PNG', 'png', 'jpg', 'jpeg']);
      }

      const result = await this.firestoreService.querySubcollection(
        `devices/${deviceCode}/Sklopovi/${groupId}`,
        'Rezervni delovi',
      );

      this.parts = result.documents.map((doc) => ({
        id: doc.id,
        code: (doc.data as PartDoc).Code ?? doc.id,
        name: (doc.data as PartDoc)['Part name'] ?? '',
      }));

      this.logger.debug('Device parts loaded', {
        deviceCode,
        groupId,
        count: this.parts.length,
        groupPhotoUrl: this.groupPhoto,
      });
    } catch (error) {
      this.logger.error('Failed to load device parts', { error: String(error) });
    } finally {
      this.isLoading = false;
    }
  }

  reset(): void {
    this.parts = [];
    this.groupPhoto = '';
    this.isLoading = false;
  }
}
