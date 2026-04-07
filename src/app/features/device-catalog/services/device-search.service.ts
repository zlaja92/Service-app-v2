import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { Clearable } from '../../../core/session/clearable';
import { Device } from '../../../shared/models/device.model';
import { QueryNonFilterConstraint } from '@capacitor-firebase/firestore';

const PAGE_SIZE = 20;
const MIN_SEARCH_LENGTH = 2;

interface DeviceDoc {
  'Device Name': string;
  'Device code': string;
  'Device type': string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class DeviceSearchService implements Clearable {
  private firestoreService = inject(FirestoreService);
  private logger = inject(LoggerService);

  devices: Device[] = [];
  isLoading = false;
  hasMore = false;
  keepState = false;

  private searchTerm = '';
  private currentSearchId = 0;
  private lastDocumentPath: string | null = null;

  async search(term: string): Promise<void> {
    const normalized = term.trim().toUpperCase();

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
      const queryConstraints: QueryNonFilterConstraint[] = [
        { type: 'limit', limit: PAGE_SIZE },
      ];

      if (this.lastDocumentPath) {
        queryConstraints.push({ type: 'startAfter', reference: this.lastDocumentPath });
      }

      const result = await this.firestoreService.queryTenantCollection<DeviceDoc>('devices', {
        compositeFilter: {
          type: 'or',
          queryConstraints: [
            {
              type: 'and',
              queryConstraints: [
                { type: 'where', fieldPath: 'Device Name', opStr: '>=', value: this.searchTerm },
                { type: 'where', fieldPath: 'Device Name', opStr: '<=', value: this.searchTerm + '\uf8ff' },
              ],
            },
            {
              type: 'and',
              queryConstraints: [
                { type: 'where', fieldPath: 'Device code', opStr: '>=', value: this.searchTerm },
                { type: 'where', fieldPath: 'Device code', opStr: '<=', value: this.searchTerm + '\uf8ff' },
              ],
            },
          ],
        },
        queryConstraints,
      });

      if (searchId !== this.currentSearchId) return;

      this.lastDocumentPath = result.lastDocumentPath;
      this.hasMore = result.documents.length === PAGE_SIZE;

      const newDevices = result.documents.map((doc) => this.mapToDevice(doc.id, doc.data));
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

  private mapToDevice(id: string, data: DeviceDoc): Device {
    return {
      code: data['Device code'] ?? id,
      name: data['Device Name'] ?? '',
      type: (data['Device type'] as Device['type']) ?? undefined!,
      subType: '',
      unitCount: 0,
      exists: true,
    };
  }
}
