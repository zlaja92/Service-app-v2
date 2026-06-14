import { Injectable, inject } from '@angular/core';
import { Timestamp } from '@capacitor-firebase/firestore';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { InterventionService } from '../../device-management/services/intervention.service';
import { toDate } from '../../../core/firebase/timestamp.utils';
import { DeviceType } from '../../../shared/models/device.model';
import { ServicerReportItem, ServicerReportFilter } from '../models/servicer-report.model';

/**
 * Fetches and enriches intervention records for the servicer-report feature.
 *
 * COMPOSITE INDEX REQUIREMENT (per collection):
 *   Fields: addedBy ASC, addedDate ASC
 *   Without these indexes, Firestore will reject the compound query with
 *   a FAILED_PRECONDITION error. Create one index per intervention
 *   collection defined in the tenant config (interventionCollections map).
 */
@Injectable({ providedIn: 'root' })
export class ServicerReportService {
  private readonly firestoreService = inject(FirestoreService);
  private readonly tenantService = inject(TenantService);
  private readonly authStore = inject(AuthStore);
  private readonly logger = inject(LoggerService);
  private readonly interventionService = inject(InterventionService);

  /**
   * Loads all intervention documents for the currently logged-in servicer
   * within the given date range, across all device types allowed by their
   * auth claims. Documents are enriched with customer address data and
   * sorted by date descending.
   *
   * Queries are deduplicated: if multiple device types share the same
   * Firestore collection, only one query is issued for that collection.
   */
  async getServicerInterventions(filter: ServicerReportFilter): Promise<ServicerReportItem[]> {
    const email = this.authStore.userEmail();
    if (!email) {
      this.logger.warn('ServicerReportService: no authenticated user email, returning empty list');
      return [];
    }

    const allowedDeviceTypes = this.tenantService.getAllowedDeviceTypes();
    if (allowedDeviceTypes.length === 0) {
      this.logger.warn('ServicerReportService: no allowed device types in claims, returning empty list');
      return [];
    }

    const validDeviceTypeValues = Object.values(DeviceType) as string[];
    const collectionMap = this.buildCollectionMap(allowedDeviceTypes, validDeviceTypeValues);

    // Group device types by collection name to deduplicate queries.
    const uniqueCollections = new Map<string, DeviceType[]>();
    for (const [deviceType, collectionName] of collectionMap.entries()) {
      const existing = uniqueCollections.get(collectionName) ?? [];
      existing.push(deviceType);
      uniqueCollections.set(collectionName, existing);
    }

    // plain JS Date does not serialize correctly over the Capacitor bridge on iOS/Android
    // (requires the __type__:'timestamp' marker that Timestamp.fromDate produces).
    const dateFromTs = Timestamp.fromDate(filter.dateFrom);
    const dateToTs = Timestamp.fromDate(filter.dateTo);

    // Accumulate raw items across all collections, deduplicating by document ID.
    const seenDocIds = new Set<string>();
    const rawItems: { docId: string; data: Record<string, unknown>; mappedDeviceTypes: DeviceType[] }[] = [];

    for (const [collectionName, mappedDeviceTypes] of uniqueCollections.entries()) {
      try {
        // queryTenantCollection automatically prepends the tenant path (tenants/{tenantId}/{collectionName}).
        //
        // Uses queryTenantCollection instead of queryInterventionCollection
        // because we pre-resolve collection names to deduplicate queries
        // across device types sharing the same collection.
        //
        // options.compositeFilter.queryConstraints → WHERE filters (equality + range).
        // options.queryConstraints → non-filter constraints (orderBy/limit) — intentionally
        // not used; sorting is done in-memory after merging all collections.
        const result = await this.firestoreService.queryTenantCollection<Record<string, unknown>>(
          collectionName,
          {
            compositeFilter: {
              type: 'and',
              queryConstraints: [
                { type: 'where', fieldPath: 'addedBy', opStr: '==', value: email },
                { type: 'where', fieldPath: 'addedDate', opStr: '>=', value: dateFromTs },
                { type: 'where', fieldPath: 'addedDate', opStr: '<=', value: dateToTs },
              ],
            },
          },
        );

        for (const doc of result.documents) {
          if (!seenDocIds.has(doc.id)) {
            seenDocIds.add(doc.id);
            rawItems.push({ docId: doc.id, data: doc.data, mappedDeviceTypes });
          }
        }
      } catch (error) {
        // A missing composite index causes FAILED_PRECONDITION — log and continue
        // so other collections can still be queried.
        this.logger.error('ServicerReportService: query failed for collection', {
          collectionName,
          error: String(error),
        });
      }
    }

    // Enrich raw items sequentially.
    // Promise.all over unique SNs is a future optimisation.
    const userCache = new Map<string, { streetName: string; homeNumber: string; city: string } | null>();
    const items: ServicerReportItem[] = [];

    for (const raw of rawItems) {
      const sn = this.str(raw.data['sn']);

      // interventionTypeRaw must be read before resolveDeviceType so it can be
      // passed to the heuristic that disambiguates shared collections.
      const interventionTypeRaw = this.str(raw.data['interventionType']);
      const deviceType = this.resolveDeviceType(raw.data, interventionTypeRaw, raw.mappedDeviceTypes);

      const interventionTypeLabelKey = interventionTypeRaw
        ? (this.interventionService.getInterventionLabel(deviceType, interventionTypeRaw) ?? interventionTypeRaw)
        : '';

      // User (address) lookup — skipped when SN is empty, result may be null.
      let address = '';
      let city = '';

      if (sn) {
        if (!userCache.has(sn)) {
          try {
            const userData = await this.firestoreService.getTenantDocument<Record<string, unknown>>('users', sn);
            if (userData) {
              userCache.set(sn, {
                streetName: this.str(userData['streetName']),
                homeNumber: this.str(userData['homeNumber']),
                city: this.str(userData['city']),
              });
            } else {
              userCache.set(sn, null);
            }
          } catch (error) {
            this.logger.warn('ServicerReportService: user lookup failed', { sn, error: String(error) });
            userCache.set(sn, null);
          }
        }

        const cached = userCache.get(sn) ?? null;
        if (cached) {
          address = `${cached.streetName} ${cached.homeNumber}`.trim();
          city = cached.city;
        }
      }

      const spareParts = this.extractSpareParts(raw.data);
      const distance = Number(raw.data['distance']) || 0;
      const warrantyStatus = this.str(raw.data['warrantyStatus']);

      const addedDate = toDate(raw.data['addedDate'] as Timestamp | null | undefined);
      let dateStr = '';
      let dateTimestamp = 0;

      if (addedDate) {
        const dd = String(addedDate.getDate()).padStart(2, '0');
        const mm = String(addedDate.getMonth() + 1).padStart(2, '0');
        const yyyy = addedDate.getFullYear();
        dateStr = `${dd}.${mm}.${yyyy}.`;
        dateTimestamp = addedDate.getTime();
      }

      items.push({
        docId: raw.docId,
        sn,
        deviceType,
        address,
        city,
        interventionTypeLabelKey,
        interventionType: interventionTypeRaw,
        spareParts,
        date: dateStr,
        dateTimestamp,
        distance,
        warrantyStatus,
        selected: true,
      });
    }

    items.sort((a, b) => b.dateTimestamp - a.dateTimestamp);
    return items;
  }

  /**
   * Builds a map of DeviceType → collection name for all allowed device types.
   *
   * Device types unknown to this app version are skipped with a warning.
   * If no valid mappings are produced despite non-empty input, falls back
   * to the first allowed device type mapped to 'interventions'.
   */
  private buildCollectionMap(
    allowedDeviceTypes: string[],
    validDeviceTypeValues: string[],
  ): Map<DeviceType, string> {
    const map = new Map<DeviceType, string>();

    for (const dt of allowedDeviceTypes) {
      if (!validDeviceTypeValues.includes(dt)) {
        this.logger.warn('ServicerReportService: skipping unknown device type from claims', { deviceType: dt });
        continue;
      }

      // getInterventionCollectionPath returns "tenants/{tenantId}/{collectionName}".
      const fullPath = this.tenantService.getInterventionCollectionPath(dt);
      const collectionName = fullPath.split('/').pop()!;
      map.set(dt as DeviceType, collectionName);
    }

    if (map.size === 0 && allowedDeviceTypes.length > 0) {
      this.logger.warn(
        'ServicerReportService: no valid device types found in claims, falling back to first type → interventions',
        { allowedDeviceTypes },
      );
      map.set(allowedDeviceTypes[0] as DeviceType, 'interventions');
    }

    return map;
  }

  /**
   * Resolves the DeviceType for a raw intervention document using a
   * three-step strategy:
   *
   * 1. Explicit field — if the document contains a 'deviceType' field
   *    with a recognised enum value, use it directly. Documents currently
   *    do not include this field, but the check is future-proof.
   * 2. InterventionType heuristic — if the collection is shared by multiple
   *    device types and an interventionType code is present, return the first
   *    type for which that code is a known option.
   * 3. Fallback — use the first mapped device type, or DeviceType.BOILER if
   *    the list is empty.
   */
  private resolveDeviceType(
    data: Record<string, unknown>,
    interventionTypeRaw: string,
    mappedDeviceTypes: DeviceType[],
  ): DeviceType {
    // Step 1: explicit 'deviceType' field on the document (future-proof).
    const raw = this.str(data['deviceType']);
    if (raw && (Object.values(DeviceType) as string[]).includes(raw)) {
      return raw as DeviceType;
    }

    // Step 2: disambiguation heuristic for shared collections.
    if (mappedDeviceTypes.length > 1 && interventionTypeRaw) {
      for (const dt of mappedDeviceTypes) {
        if (this.interventionService.getInterventionLabel(dt, interventionTypeRaw) !== null) {
          return dt;
        }
      }
    }

    // Step 3: fallback.
    return mappedDeviceTypes[0] ?? DeviceType.BOILER;
  }

  /**
   * Extracts spare parts from known fields (sparePart1–sparePart4) and
   * returns them as a comma-separated string. Empty fields are omitted.
   */
  private extractSpareParts(data: Record<string, unknown>): string {
    return (['sparePart1', 'sparePart2', 'sparePart3', 'sparePart4'] as const)
      .map((k) => this.str(data[k]))
      .filter((v) => v.length > 0)
      .join(', ');
  }

  /** Coerces an unknown Firestore field value to a string (null/undefined → ''). */
  private str(value: unknown): string {
    return value == null ? '' : String(value);
  }
}
