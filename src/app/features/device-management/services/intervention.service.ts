import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { Clearable } from '../../../core/session/clearable';
import { Device } from '../../../shared/models/device.model';

@Injectable({ providedIn: 'root' })
export class InterventionService implements Clearable {
  private readonly firestoreService = inject(FirestoreService);
  private readonly authStore = inject(AuthStore);
  private readonly logger = inject(LoggerService);

  isSaving = false;

  async saveIntervention(
    sn: string,
    device: Device,
    formData: Record<string, unknown>,
  ): Promise<string | null> {
    this.isSaving = true;

    try {
      const data: Record<string, unknown> = {
        sn,
        deviceCode: device.code,
        deviceName: device.name,
        deviceType: device.type,
        ...formData,
        createdBy: this.authStore.userEmail(),
        createdAt: new Date().toISOString(),
      };

      const docId = await this.firestoreService.addTenantDocument('interventions', data);
      this.logger.info('Intervention saved', { sn, deviceCode: device.code, docId });
      return docId;
    } catch (error) {
      this.logger.error('Intervention save failed', { sn, error: String(error) });
      return null;
    } finally {
      this.isSaving = false;
    }
  }

  async getInterventionsBySn(
    sn: string,
  ): Promise<{ id: string; data: Record<string, unknown> }[]> {
    try {
      const result = await this.firestoreService.queryTenantCollection<Record<string, unknown>>(
        'interventions',
        {
          compositeFilter: {
            type: 'and',
            queryConstraints: [{
              type: 'where',
              fieldPath: 'sn',
              opStr: '==',
              value: sn,
            }],
          },
        },
      );

      return result.documents.sort((a, b) => {
        const dateA = String(a.data['createdAt'] ?? '');
        const dateB = String(b.data['createdAt'] ?? '');
        return dateB.localeCompare(dateA);
      });
    } catch (error) {
      this.logger.error('Failed to load interventions', { sn, error: String(error) });
      return [];
    }
  }

  async getInterventionById(id: string): Promise<Record<string, unknown> | null> {
    try {
      return await this.firestoreService.getTenantDocument('interventions', id);
    } catch (error) {
      this.logger.error('Failed to load intervention', { id, error: String(error) });
      return null;
    }
  }

  async getRegistration(sn: string): Promise<Record<string, unknown> | null> {
    try {
      return await this.firestoreService.getTenantDocument('users', sn);
    } catch (error) {
      this.logger.error('Failed to load registration', { sn, error: String(error) });
      return null;
    }
  }

  clear(): void {
    this.isSaving = false;
  }
}
