import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ServerTimeService } from '../../../core/firebase/server-time.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { Clearable } from '../../../core/session/clearable';
import { Device } from '../../../shared/models/device.model';

@Injectable({ providedIn: 'root' })
export class DeviceRegistrationService implements Clearable {
  private firestoreService = inject(FirestoreService);
  private authStore = inject(AuthStore);
  private serverTimeService = inject(ServerTimeService);
  private logger = inject(LoggerService);

  isRegistered: boolean | null = null;
  isChecking = false;
  userData: Record<string, unknown> | null = null;

  async checkRegistration(sn: string): Promise<void> {
    this.isChecking = true;
    this.isRegistered = null;
    this.userData = null;

    try {
      const doc = await this.firestoreService.getTenantDocument<Record<string, unknown>>(
        'users',
        sn,
      );
      this.isRegistered = doc !== null;
      this.userData = doc;
      this.logger.info('Registration check complete', { sn, isRegistered: this.isRegistered });
    } catch (error) {
      this.logger.error('Registration check failed', { sn, error: String(error) });
      this.isRegistered = null;
      this.userData = null;
    } finally {
      this.isChecking = false;
    }
  }

  async register(
    sn: string,
    device: Device,
    dynamicFields: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const serverTime = await this.serverTimeService.getServerTime();
      if (!serverTime) {
        this.logger.error('Registration failed: server time unavailable', { sn });
        return false;
      }

      const data: Record<string, unknown> = {
        sn,
        deviceType: device.type,
        addedBy: this.authStore.userEmail(),
        addedDate: serverTime,
        ...dynamicFields,
      };

      await this.firestoreService.setTenantDocument(
        'users',
        sn,
        data,
      );

      this.isRegistered = true;
      this.logger.info('Device registered', { sn, deviceType: device.type, deviceCode: device.code });
      return true;
    } catch (error) {
      this.logger.error('Device registration failed', { sn, error: String(error) });
      return false;
    }
  }

  /**
   * Registers two devices atomically using batch write.
   * Both user documents are created or neither is.
   */
  async registerBatch(
    entries: { sn: string; device: Device; dynamicFields: Record<string, unknown> }[],
  ): Promise<boolean> {
    try {
      const serverTime = await this.serverTimeService.getServerTime();
      if (!serverTime) {
        this.logger.error('Batch registration failed: server time unavailable');
        return false;
      }

      const operations = entries.map((entry) => {
        const data: Record<string, unknown> = {
          sn: entry.sn,
          deviceType: entry.device.type,
          addedBy: this.authStore.userEmail(),
          addedDate: serverTime,
          ...entry.dynamicFields,
        };

        return {
          type: 'set' as const,
          reference: this.firestoreService.buildTenantReference('users', entry.sn),
          data,
        };
      });

      await this.firestoreService.writeBatch(operations);
      this.isRegistered = true;
      this.logger.info('Batch registration saved', { count: entries.length });
      return true;
    } catch (error) {
      this.logger.error('Batch registration failed', { error: String(error) });
      return false;
    }
  }

  getPurchaseDateFormatted(): string | null {
    const raw = this.userData?.['dateOfPurchase'];
    const date = this.toDate(raw);
    if (!date) return null;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${date.getFullYear()}`;
  }

  getWarrantyEndDateFormatted(device: Device): string | null {
    if (!this.userData || !device.maxWarrantyMonths) return null;

    const raw = this.userData['dateOfPurchase'];
    const date = this.toDate(raw);
    if (!date) return null;

    const extendedMonths = Number(this.userData['extendedWarrantyMonths']) || 0;
    const totalMonths = Number(device.maxWarrantyMonths) + extendedMonths;

    const endDate = new Date(date);
    endDate.setMonth(endDate.getMonth() + totalMonths);

    const day = String(endDate.getDate()).padStart(2, '0');
    const month = String(endDate.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${endDate.getFullYear()}`;
  }

  private toDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'object' && value !== null && 'seconds' in value) {
      return new Date((value as { seconds: number }).seconds * 1000);
    }
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  clear(): void {
    this.isRegistered = null;
    this.isChecking = false;
    this.userData = null;
  }
}
