import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { Clearable } from '../../../core/session/clearable';
import { Device } from '../../../shared/models/device.model';
import { DeviceRegistration } from '../models/adding-device.model';

@Injectable({ providedIn: 'root' })
export class DeviceRegistrationService implements Clearable {
  private firestoreService = inject(FirestoreService);
  private authStore = inject(AuthStore);
  private logger = inject(LoggerService);

  isRegistered: boolean | null = null;
  isChecking = false;

  async checkRegistration(sn: string): Promise<void> {
    this.isChecking = true;
    this.isRegistered = null;

    try {
      const doc = await this.firestoreService.getTenantDocument<DeviceRegistration>(
        'uredjaji',
        sn,
      );
      this.isRegistered = doc !== null;
      this.logger.info('Registration check complete', { sn, isRegistered: this.isRegistered });
    } catch (error) {
      this.logger.error('Registration check failed', { sn, error: String(error) });
      this.isRegistered = null;
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
      const data: Record<string, unknown> = {
        sn,
        deviceCode: device.code,
        deviceName: device.name,
        registeredBy: this.authStore.userEmail(),
        registeredAt: new Date().toISOString(),
        ...dynamicFields,
      };

      await this.firestoreService.setTenantDocument(
        'uredjaji',
        sn,
        data,
      );

      this.isRegistered = true;
      this.logger.info('Device registered', { sn, deviceCode: device.code });
      return true;
    } catch (error) {
      this.logger.error('Device registration failed', { sn, error: String(error) });
      return false;
    }
  }

  clear(): void {
    this.isRegistered = null;
    this.isChecking = false;
  }
}
