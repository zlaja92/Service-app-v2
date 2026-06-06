import { Injectable, inject } from '@angular/core';
import {
  QueryFieldFilterConstraint,
  QueryOrderByConstraint,
} from '@capacitor-firebase/firestore';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { Clearable } from '../../../core/session/clearable';
import { toLatinUpperCase } from '../../../shared/utils/transliterate';

/**
 * Number of results fetched per page. Fixed application constant — deliberately
 * not tenant-configurable, as it has no business reason to vary per tenant.
 */
const PAGE_SIZE = 20;

/**
 * Minimum number of characters before a name term participates as a filter.
 * Fixed application constant — not tenant-configurable.
 */
const MIN_SEARCH_LENGTH = 2;

export interface UserSearchResult {
  sn: string;
  firstName: string;
  lastName: string;
  streetName: string;
  homeNumber: string;
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
  homeNumber: string;
  city: string;
  deviceType: string;
  [key: string]: unknown;
}

/**
 * Searches the tenant `users` collection by normalized first/last name prefixes.
 *
 * Names are matched against the `firstNameSrch` / `lastNameSrch` fields, which
 * are written in canonical form (Latin uppercase, see {@link toLatinUpperCase}).
 * A term matches as a prefix via the range `[term, term + '']`.
 *
 * Both fields are filtered in a SINGLE Firestore query using range/inequality
 * filters on multiple fields (GA feature). This requires the composite index
 * `deviceType ASC, firstNameSrch ASC, lastNameSrch ASC`; the first run without
 * it throws `failed-precondition` with a console link to create it.
 *
 * Results are returned in Firestore order (no client re-sort) so that paging
 * via `loadMore()` always appends — never inserts mid-list. Ordering leads with
 * `firstNameSrch` whenever a first name is searched, otherwise `lastNameSrch`.
 */
@Injectable({ providedIn: 'root' })
export class UserSearchService implements Clearable {
  private firestoreService = inject(FirestoreService);
  private tenantService = inject(TenantService);
  private logger = inject(LoggerService);

  /** Minimum term length, exposed for the search form's validation. */
  readonly minSearchLength = MIN_SEARCH_LENGTH;

  results: UserSearchResult[] = [];
  isLoading = false;
  hasMore = false;

  private lastDocumentPath: string | null = null;
  private currentSearchId = 0;
  private firstNameTerm = '';
  private lastNameTerm = '';

  async search(firstName: string, lastName: string): Promise<void> {
    const firstNorm = toLatinUpperCase(firstName.trim());
    const lastNorm = toLatinUpperCase(lastName.trim());

    // A term only participates as a filter once it meets the minimum length.
    // Searching is aborted only when neither term qualifies.
    const useFirst = firstNorm.length >= this.minSearchLength;
    const useLast = lastNorm.length >= this.minSearchLength;

    if (!useFirst && !useLast) {
      this.reset();
      return;
    }

    this.firstNameTerm = useFirst ? firstNorm : '';
    this.lastNameTerm = useLast ? lastNorm : '';
    this.results = [];
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

  private reset(): void {
    this.results = [];
    this.isLoading = false;
    this.hasMore = false;
    this.firstNameTerm = '';
    this.lastNameTerm = '';
    this.currentSearchId++;
    this.lastDocumentPath = null;
  }

  private async loadPage(searchId: number): Promise<void> {
    this.isLoading = true;
    const allowedTypes = this.tenantService.getAllowedDeviceTypes();

    try {
      const result = await this.firestoreService.queryTenantCollection<UserDoc>('users', {
        compositeFilter: {
          type: 'and',
          queryConstraints: this.buildFilters(allowedTypes),
        },
        queryConstraints: [
          ...this.buildOrderBy(),
          { type: 'limit', limit: PAGE_SIZE },
          ...(this.lastDocumentPath
            ? [{ type: 'startAfter' as const, reference: this.lastDocumentPath }]
            : []),
        ],
      });

      if (searchId !== this.currentSearchId) return;

      this.lastDocumentPath = result.lastDocumentPath;
      this.hasMore = result.documents.length === PAGE_SIZE;
      this.appendResults(result.documents.map(doc => this.mapToResult(doc.data)));
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

  /**
   * Builds the AND filter set: device-type scoping plus a prefix range for each
   * term that is active. Both name ranges in one query is the multi-field
   * range/inequality query that replaces the old two-query client intersection.
   */
  private buildFilters(allowedTypes: string[]): QueryFieldFilterConstraint[] {
    const filters: QueryFieldFilterConstraint[] = [
      { type: 'where', fieldPath: 'deviceType', opStr: 'in', value: allowedTypes },
    ];

    if (this.firstNameTerm) {
      filters.push(
        { type: 'where', fieldPath: 'firstNameSrch', opStr: '>=', value: this.firstNameTerm },
        { type: 'where', fieldPath: 'firstNameSrch', opStr: '<=', value: this.firstNameTerm + '' },
      );
    }

    if (this.lastNameTerm) {
      filters.push(
        { type: 'where', fieldPath: 'lastNameSrch', opStr: '>=', value: this.lastNameTerm },
        { type: 'where', fieldPath: 'lastNameSrch', opStr: '<=', value: this.lastNameTerm + '' },
      );
    }

    return filters;
  }

  /**
   * Orders by the range fields (Firestore requires the inequality fields to lead
   * the sort). First name leads whenever it is searched, so results sort by first
   * name for first-name and combined searches, and by last name for last-name-only
   * searches. Matching the query order to the displayed order keeps paging coherent.
   */
  private buildOrderBy(): QueryOrderByConstraint[] {
    const orderBy: QueryOrderByConstraint[] = [];
    if (this.firstNameTerm) {
      orderBy.push({ type: 'orderBy', fieldPath: 'firstNameSrch', directionStr: 'asc' });
    }
    if (this.lastNameTerm) {
      orderBy.push({ type: 'orderBy', fieldPath: 'lastNameSrch', directionStr: 'asc' });
    }
    return orderBy;
  }

  /** Appends new results in Firestore order, skipping serial numbers already shown. */
  private appendResults(newResults: UserSearchResult[]): void {
    const existingSns = new Set(this.results.map(r => r.sn));
    const unique = newResults.filter(r => !existingSns.has(r.sn));
    this.results = [...this.results, ...unique];
  }

  private mapToResult(data: UserDoc): UserSearchResult {
    return {
      sn: data.sn ?? '',
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      streetName: data.streetName ?? '',
      homeNumber: data.homeNumber ?? '',
      city: data.city ?? '',
      deviceType: data.deviceType ?? '',
    };
  }
}
