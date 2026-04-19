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
        deviceCode: device.code,
        deviceName: device.name,
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
    this.userData = null;
  }
}
