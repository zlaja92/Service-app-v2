import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { Clearable } from '../../../core/session/clearable';
import { Device } from '../../../shared/models/device.model';
import { toLatinUpperCase } from '../../../shared/utils/transliterate';
import { QueryNonFilterConstraint } from '@capacitor-firebase/firestore';

const PAGE_SIZE = 20;
const MIN_SEARCH_LENGTH = 2;

interface DeviceDoc {
  deviceName?: string;
  deviceCode?: string;
  deviceType?: string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class DeviceSearchService implements Clearable {
  private firestoreService = inject(FirestoreService);
  private tenantService = inject(TenantService);
  private logger = inject(LoggerService);

  devices: Device[] = [];
  isLoading = false;
  hasMore = false;
  keepState = false;

  private searchTerm = '';
  private currentSearchId = 0;
  private lastDocumentPath: string | null = null;

  async search(term: string): Promise<void> {
    // Canonicalize the term the same way device names/codes are stored: Cyrillic
    // and Serbian-Latin diacritics are transliterated to plain Latin uppercase,
    // so a user can type in any script/diacritics and still match.
    const normalized = toLatinUpperCase(term.trim());

    if (normalized.length < MIN_SEARCH_LENGTH) {
      this.reset();
      return;
    }

    this.searchTerm = normalized;
    this.devices = [];
    this.lastDocumentPath = null;
    this.currentSearchId++;
    await this.loadPage(this.currentSearchId);
  }

  async loadMore(): Promise<void> {
    if (this.isLoading || !this.hasMore) return;
    await this.loadPage(this.currentSearchId);
  }

  clear(): void {
    this.reset();
  }

  reset(): void {
    this.devices = [];
    this.isLoading = false;
    this.hasMore = false;
    this.searchTerm = '';
    this.currentSearchId++;
    this.lastDocumentPath = null;
  }

  private async loadPage(searchId: number): Promise<void> {
    this.isLoading = true;

    try {
      // Scope to the device types the servicer may see — applied server-side so
      // that `hasMore` and the page count are accurate and out-of-scope devices
      // are never fetched. An empty `in` array is an invalid Firestore filter,
      // so short-circuit to an empty result instead.
      const allowedTypes = this.tenantService.getAllowedDeviceTypes();
      if (allowedTypes.length === 0) {
        this.hasMore = false;
        this.logger.warn('Device search: no allowed device types for current servicer');
        return;
      }

      const queryConstraints: QueryNonFilterConstraint[] = [
        { type: 'limit', limit: PAGE_SIZE },
      ];

      if (this.lastDocumentPath) {
        queryConstraints.push({ type: 'startAfter', reference: this.lastDocumentPath });
      }

      // deviceType in allowedTypes  AND  (deviceName prefix  OR  deviceCode prefix)
      const result = await this.firestoreService.queryTenantCollection<DeviceDoc>('devices', {
        compositeFilter: {
          type: 'and',
          queryConstraints: [
            { type: 'where', fieldPath: 'deviceType', opStr: 'in', value: allowedTypes },
            {
              type: 'or',
              queryConstraints: [
                {
                  type: 'and',
                  queryConstraints: [
                    { type: 'where', fieldPath: 'deviceName', opStr: '>=', value: this.searchTerm },
                    { type: 'where', fieldPath: 'deviceName', opStr: '<=', value: this.searchTerm + '' },
                  ],
                },
                {
                  type: 'and',
                  queryConstraints: [
                    { type: 'where', fieldPath: 'deviceCode', opStr: '>=', value: this.searchTerm },
                    { type: 'where', fieldPath: 'deviceCode', opStr: '<=', value: this.searchTerm + '' },
                  ],
                },
              ],
            },
          ],
        },
        queryConstraints,
      });

      if (searchId !== this.currentSearchId) return;

      this.lastDocumentPath = result.lastDocumentPath;
      this.hasMore = result.documents.length === PAGE_SIZE;

      const newDevices = result.documents
        .map((doc) => this.mapToDevice(doc.id, doc.data))
        .filter((device): device is Device => device !== null);
      this.devices = [...this.devices, ...newDevices];

      this.logger.debug('Device search results', {
        term: this.searchTerm,
        fetched: result.documents.length,
        total: this.devices.length,
      });
    } catch (error) {
      if (searchId !== this.currentSearchId) return;
      this.logger.error('Device search failed', { error: String(error) });
    } finally {
      if (searchId === this.currentSearchId) {
        this.isLoading = false;
      }
    }
  }

  private mapToDevice(id: string, data: DeviceDoc): Device | null {
    const type = data.deviceType as Device['type'] | undefined;
    if (!type) {
      this.logger.warn('DeviceSearchService: skipping device with missing type', { id });
      return null;
    }
    return {
      code: data.deviceCode ?? id,
      name: data.deviceName ?? '',
      type,
      subType: '',
      unitCount: 0,
      exists: true,
    };
  }
}
