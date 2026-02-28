import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { Group } from '../../../shared/models/group.model';

interface GroupDoc {
  'Name': string;
  'Group photo': string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class DeviceGroupsService {
  private firestoreService = inject(FirestoreService);
  private logger = inject(LoggerService);

  groups: Group[] = [];
  isLoading = false;

  private loadedDeviceCode = '';

  async load(deviceCode: string): Promise<void> {
    if (deviceCode === this.loadedDeviceCode && this.groups.length > 0) {
      return;
    }

    this.isLoading = true;
    this.groups = [];
    this.loadedDeviceCode = deviceCode;

    try {
      const result = await this.firestoreService.querySubcollection<GroupDoc>(
        `devices/${deviceCode}`,
        'Sklopovi',
      );

      this.groups = result.documents.map((doc) => ({
        id: doc.id,
        name: doc.data['Name'] ?? '',
        groupPhoto: doc.data['Group photo'] ?? '',
      }));

      this.logger.debug('Device groups loaded', {
        deviceCode,
        count: this.groups.length,
      });
    } catch (error) {
      this.logger.error('Failed to load device groups', { error: String(error) });
    } finally {
      this.isLoading = false;
    }
  }

  reset(): void {
    this.groups = [];
    this.isLoading = false;
    this.loadedDeviceCode = '';
  }
}
