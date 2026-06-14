import { Injectable, inject } from '@angular/core';
import { FieldValue, Timestamp } from '@capacitor-firebase/firestore';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfigStore } from '../../../core/config/config.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { toDate } from '../../../core/firebase/timestamp.utils';
import { Device } from '../../../shared/models/device.model';

const WARRANTY_EXTENSIONS_COLLECTION = 'warrantyExtensions';

/**
 * Customer warranty extensions, stored in the tenant `warrantyExtensions`
 * collection. The document id is the device serial number, so a given device
 * can never have two extension requests (a repeat just overwrites the same doc).
 * Path: tenants/{tenantId}/warrantyExtensions/{sn}.
 */
@Injectable({ providedIn: 'root' })
export class WarrantyExtensionService {
  private firestore = inject(FirestoreService);
  private authStore = inject(AuthStore);
  private configStore = inject(ConfigStore);
  private logger = inject(LoggerService);

  /**
   * Whether an extension can be requested for this device. True only when the
   * device allows it, the registration is not already extended, and today is
   * within `warrantyExtensionWindowMonths` months of the purchase date. Any
   * missing/undefined input → false (no request possible).
   */
  canRequest(device: Device | null | undefined, userData: Record<string, unknown> | null | undefined): boolean {
    if (!device?.canExtendWarranty) return false;

    // Already extended in the registration document → not available.
    const alreadyExtended = Number(userData?.['extendedWarrantyMonths']) || 0;
    if (alreadyExtended > 0) return false;

    const months = this.configStore.business()?.warrantyExtensionWindowMonths ?? 0;
    if (months <= 0) return false;

    const purchase = toDate(userData?.['dateOfPurchase'] as Timestamp | null | undefined);
    if (!purchase) return false;

    const deadline = new Date(purchase);
    deadline.setMonth(deadline.getMonth() + months);
    return Date.now() <= deadline.getTime();
  }

  /** Creates/overwrites the warranty-extension record for `sn`. Returns success. */
  async extend(sn: string): Promise<boolean> {
    try {
      await this.firestore.setTenantDocument(WARRANTY_EXTENSIONS_COLLECTION, sn, {
        sn,
        addedBy: this.authStore.userEmail(),
        addedDate: FieldValue.serverTimestamp(),
        exported: false,
      });
      this.logger.info('Warranty extension recorded', { sn });
      return true;
    } catch (error) {
      this.logger.error('Warranty extension failed', { sn, error: String(error) });
      return false;
    }
  }

  /** True if a warranty-extension request already exists for `sn`. */
  async exists(sn: string): Promise<boolean> {
    try {
      const doc = await this.firestore.getTenantDocument(WARRANTY_EXTENSIONS_COLLECTION, sn);
      return doc != null;
    } catch (error) {
      this.logger.warn('Warranty extension exists-check failed', { sn, error: String(error) });
      return false;
    }
  }
}
