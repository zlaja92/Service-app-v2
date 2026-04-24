import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { ConfigStore } from '../../../core/config/config.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { Clearable } from '../../../core/session/clearable';

export interface UserSearchResult {
  sn: string;
  firstName: string;
  lastName: string;
  streetName: string;
  city: string;
  deviceType: string;
}

interface UserDoc {
  sn: string;
  firstName: string;
  lastName: string;
  firstNameSrch: string;
  lastNameSrch: string;
  streetName: string;
  city: string;
  deviceType: string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class UserSearchService implements Clearable {
  private firestoreService = inject(FirestoreService);
  private tenantService = inject(TenantService);
  private configStore = inject(ConfigStore);
  private logger = inject(LoggerService);

  private get pageSize(): number {
    return this.configStore.business()!.userSearchPageSize;
  }

  private get minSearchLength(): number {
    return this.configStore.business()!.userSearchMinLength;
  }

  results: UserSearchResult[] = [];
  isLoading = false;
  hasMore = false;

  private lastFirstNamePath: string | null = null;
  private lastLastNamePath: string | null = null;
  private hasMoreFirstName = false;
  private hasMoreLastName = false;
  private currentSearchId = 0;
  private firstNameTerm = '';
  private lastNameTerm = '';

  async search(firstName: string, lastName: string): Promise<void> {
    const firstNorm = firstName.trim().toUpperCase();
    const lastNorm = lastName.trim().toUpperCase();

    if (firstNorm.length < this.minSearchLength && lastNorm.length < this.minSearchLength) {
      this.reset();
      return;
    }

    this.firstNameTerm = firstNorm;
    this.lastNameTerm = lastNorm;
    this.results = [];
    this.lastFirstNamePath = null;
    this.lastLastNamePath = null;
    this.hasMoreFirstName = false;
    this.hasMoreLastName = false;
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

  private reset(): void {
    this.results = [];
    this.isLoading = false;
    this.hasMore = false;
    this.hasMoreFirstName = false;
    this.hasMoreLastName = false;
    this.firstNameTerm = '';
    this.lastNameTerm = '';
    this.currentSearchId++;
    this.lastFirstNamePath = null;
    this.lastLastNamePath = null;
  }

  private async loadPage(searchId: number): Promise<void> {
    this.isLoading = true;
    const allowedTypes = this.tenantService.getAllowedDeviceTypes();

    try {
      if (this.firstNameTerm && this.lastNameTerm) {
        await this.searchBothFields(searchId, allowedTypes);
      } else if (this.lastNameTerm) {
        await this.searchSingleField(searchId, allowedTypes, 'lastNameSrch', this.lastNameTerm, 'lastName');
      } else {
        await this.searchSingleField(searchId, allowedTypes, 'firstNameSrch', this.firstNameTerm, 'firstName');
      }
    } catch (error) {
      if (searchId === this.currentSearchId) {
        this.logger.error('User search failed', { error: String(error) });
      }
    } finally {
      if (searchId === this.currentSearchId) {
        this.isLoading = false;
      }
    }
  }

  private async searchSingleField(
    searchId: number,
    allowedTypes: string[],
    field: string,
    term: string,
    cursorType: 'firstName' | 'lastName',
  ): Promise<void> {
    const cursor = cursorType === 'firstName' ? this.lastFirstNamePath : this.lastLastNamePath;

    const result = await this.firestoreService.queryTenantCollection<UserDoc>('users', {
      compositeFilter: {
        type: 'and',
        queryConstraints: [
          { type: 'where', fieldPath: 'deviceType', opStr: 'in', value: allowedTypes },
          { type: 'where', fieldPath: field, opStr: '>=', value: term },
          { type: 'where', fieldPath: field, opStr: '<=', value: term + '\uf8ff' },
        ],
      },
      queryConstraints: [
        { type: 'limit', limit: this.pageSize },
        ...(cursor ? [{ type: 'startAfter' as const, reference: cursor }] : []),
      ],
    });

    if (searchId !== this.currentSearchId) return;

    if (cursorType === 'firstName') {
      this.lastFirstNamePath = result.lastDocumentPath;
      this.hasMoreFirstName = result.documents.length === this.pageSize;
    } else {
      this.lastLastNamePath = result.lastDocumentPath;
      this.hasMoreLastName = result.documents.length === this.pageSize;
    }
    this.hasMore = this.hasMoreFirstName || this.hasMoreLastName;

    const newResults = result.documents.map(doc => this.mapToResult(doc.data));
    this.mergeResults(newResults);
  }

  private async searchBothFields(
    searchId: number,
    allowedTypes: string[],
  ): Promise<void> {
    const [firstNameResult, lastNameResult] = await Promise.all([
      this.firestoreService.queryTenantCollection<UserDoc>('users', {
        compositeFilter: {
          type: 'and',
          queryConstraints: [
            { type: 'where', fieldPath: 'deviceType', opStr: 'in', value: allowedTypes },
            { type: 'where', fieldPath: 'firstNameSrch', opStr: '>=', value: this.firstNameTerm },
            { type: 'where', fieldPath: 'firstNameSrch', opStr: '<=', value: this.firstNameTerm + '\uf8ff' },
          ],
        },
        queryConstraints: [
          { type: 'limit', limit: this.pageSize },
          ...(this.lastFirstNamePath ? [{ type: 'startAfter' as const, reference: this.lastFirstNamePath }] : []),
        ],
      }),
      this.firestoreService.queryTenantCollection<UserDoc>('users', {
        compositeFilter: {
          type: 'and',
          queryConstraints: [
            { type: 'where', fieldPath: 'deviceType', opStr: 'in', value: allowedTypes },
            { type: 'where', fieldPath: 'lastNameSrch', opStr: '>=', value: this.lastNameTerm },
            { type: 'where', fieldPath: 'lastNameSrch', opStr: '<=', value: this.lastNameTerm + '\uf8ff' },
          ],
        },
        queryConstraints: [
          { type: 'limit', limit: this.pageSize },
          ...(this.lastLastNamePath ? [{ type: 'startAfter' as const, reference: this.lastLastNamePath }] : []),
        ],
      }),
    ]);

    if (searchId !== this.currentSearchId) return;

    this.lastFirstNamePath = firstNameResult.lastDocumentPath;
    this.lastLastNamePath = lastNameResult.lastDocumentPath;
    this.hasMoreFirstName = firstNameResult.documents.length === this.pageSize;
    this.hasMoreLastName = lastNameResult.documents.length === this.pageSize;
    this.hasMore = this.hasMoreFirstName || this.hasMoreLastName;

    // Intersection - only users that appear in both result sets
    const firstNameSns = new Set(firstNameResult.documents.map(d => d.data.sn));
    const intersection = lastNameResult.documents
      .filter(d => firstNameSns.has(d.data.sn))
      .map(d => this.mapToResult(d.data));

    // Also check reverse - docs from firstName query that match lastName query
    const lastNameSns = new Set(lastNameResult.documents.map(d => d.data.sn));
    const fromFirstName = firstNameResult.documents
      .filter(d => lastNameSns.has(d.data.sn) && !intersection.find(r => r.sn === d.data.sn))
      .map(d => this.mapToResult(d.data));

    this.mergeResults([...intersection, ...fromFirstName]);
  }

  private mergeResults(newResults: UserSearchResult[]): void {
    const existingSns = new Set(this.results.map(r => r.sn));
    const unique = newResults.filter(r => !existingSns.has(r.sn));
    this.results = [...this.results, ...unique]
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  }

  private mapToResult(data: UserDoc): UserSearchResult {
    return {
      sn: data.sn ?? '',
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      streetName: data.streetName ?? '',
      city: data.city ?? '',
      deviceType: data.deviceType ?? '',
    };
  }
}
