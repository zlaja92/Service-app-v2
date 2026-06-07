import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../firebase/firestore.service';
import { AuthStore } from '../auth/auth.store';
import { LoggerService } from '../logger/logger.service';
import { Servicer } from './servicer.model';

/**
 * Data access for the tenant `servicers` collection (docId = account email).
 * Cross-feature: report headers, servicer statistics, profile, etc.
 */
@Injectable({ providedIn: 'root' })
export class ServicerService {
  private firestore = inject(FirestoreService);
  private authStore = inject(AuthStore);
  private logger = inject(LoggerService);

  /** Loads the logged-in servicer (servicers/{currentEmail}). Returns null when missing/failed. */
  async getCurrent(): Promise<Servicer | null> {
    const email = this.authStore.userEmail();
    if (!email) {
      this.logger.warn('ServicerService: no current user email; cannot load servicer');
      return null;
    }
    return this.getByEmail(email);
  }

  /** Loads a servicer by account email (e.g. for the stats report). */
  async getByEmail(email: string): Promise<Servicer | null> {
    if (!email) return null;
    try {
      return await this.firestore.getTenantDocument<Servicer>('servicers', email);
    } catch (error) {
      this.logger.warn('ServicerService: failed to load servicer', { email, error: String(error) });
      return null;
    }
  }
}
