import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ServerTimeService } from '../../../core/firebase/server-time.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { Clearable } from '../../../core/session/clearable';
import { Device, DeviceType } from '../../../shared/models/device.model';
import {
  COMMISSIONING_TYPES, ANNUAL_SERVICE_TYPES, INTERVENTION_OPTIONS,
} from '../models/intervention.model';

@Injectable({ providedIn: 'root' })
export class InterventionService implements Clearable {
  private readonly firestoreService = inject(FirestoreService);
  private readonly authStore = inject(AuthStore);
  private readonly serverTimeService = inject(ServerTimeService);
  private readonly logger = inject(LoggerService);

  isSaving = false;

  async saveIntervention(
    sn: string,
    device: Device,
    formData: Record<string, unknown>,
  ): Promise<string | null> {
    this.isSaving = true;

    try {
      const serverTime = await this.serverTimeService.getServerTime();
      if (!serverTime) {
        this.logger.error('Intervention save failed: server time unavailable', { sn });
        return null;
      }

      const registration = await this.getRegistration(sn);
      const warrantyStatus = registration?.['warrantyStatus'] as string ?? '';

      const data: Record<string, unknown> = {
        sn,
        ...formData,
        warrantyStatus,
        addedBy: this.authStore.userEmail(),
        addedDate: serverTime,
        exported: false,
      };

      const docId = await this.firestoreService.addInterventionDocument(device.type, data);
      this.logger.info('Intervention saved', { sn, deviceType: device.type, docId });
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
    deviceType: string,
  ): Promise<{ id: string; data: Record<string, unknown> }[]> {
    try {
      const result = await this.firestoreService.queryInterventionCollection<Record<string, unknown>>(
        deviceType,
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
        const dateA = this.toTimestamp(a.data['addedDate']);
        const dateB = this.toTimestamp(b.data['addedDate']);
        return dateA - dateB;
      });
    } catch (error) {
      this.logger.error('Failed to load interventions', { sn, error: String(error) });
      return [];
    }
  }

  async getInterventionById(id: string, deviceType: string): Promise<Record<string, unknown> | null> {
    try {
      return await this.firestoreService.getInterventionDocument(deviceType, id);
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

  getInterventionLabel(deviceType: DeviceType, type: string): string | null {
    if (COMMISSIONING_TYPES[deviceType]?.key === type) return COMMISSIONING_TYPES[deviceType]!.label;
    if (ANNUAL_SERVICE_TYPES[deviceType]?.key === type) return ANNUAL_SERVICE_TYPES[deviceType]!.label;
    return INTERVENTION_OPTIONS[deviceType]?.find(o => o.key === type)?.label ?? null;
  }

  /**
   * Saves two interventions atomically using batch write.
   * Both succeed or both fail - no partial writes.
   */
  async saveInterventionBatch(
    entries: { sn: string; device: Device; formData: Record<string, unknown> }[],
  ): Promise<boolean> {
    this.isSaving = true;

    try {
      const serverTime = await this.serverTimeService.getServerTime();
      if (!serverTime) {
        this.logger.error('Intervention batch save failed: server time unavailable');
        return false;
      }

      const operations = await Promise.all(
        entries.map(async (entry) => {
          const registration = await this.getRegistration(entry.sn);
          const warrantyStatus = registration?.['warrantyStatus'] as string ?? '';

          const data: Record<string, unknown> = {
            sn: entry.sn,
            ...entry.formData,
            warrantyStatus,
            addedBy: this.authStore.userEmail(),
            addedDate: serverTime,
            exported: false,
          };

          const docId = this.firestoreService.generateId();
          return {
            type: 'set' as const,
            reference: this.firestoreService.buildInterventionReference(entry.device.type, docId),
            data,
          };
        }),
      );

      await this.firestoreService.writeBatch(operations);
      this.logger.info('Intervention batch saved', { count: entries.length });
      return true;
    } catch (error) {
      this.logger.error('Intervention batch save failed', { error: String(error) });
      return false;
    } finally {
      this.isSaving = false;
    }
  }

  clear(): void {
    this.isSaving = false;
  }

  private toTimestamp(value: unknown): number {
    if (!value) return 0;
    if (typeof value === 'object' && value !== null && 'seconds' in value) {
      return (value as { seconds: number }).seconds * 1000;
    }
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    return 0;
  }
}
