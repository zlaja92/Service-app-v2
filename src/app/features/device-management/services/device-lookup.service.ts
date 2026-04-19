import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { ConfigStore } from '../../../core/config/config.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { Clearable } from '../../../core/session/clearable';
import { Device, DeviceType } from '../../../shared/models/device.model';

interface DeviceDoc {
  'Device Name': string;
  'Device code': string;
  'Device type': string;
  commissioning?: boolean;
  annualService?: boolean;
  intervention?: boolean;
  firstServiceYear?: number;
  serviceWindowStart?: number;
  serviceWindowEnd?: number;
  maxWarrantyMonths?: number;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class DeviceLookupService implements Clearable {
  private firestoreService = inject(FirestoreService);
  private configStore = inject(ConfigStore);
  private logger = inject(LoggerService);

  device: Device | null = null;
  isLoading = false;
  sn = '';

  /**
   * Extracts model code from SN using snModelStart and snModelLength from config.
   */
  extractModelCode(sn: string): string {
    const business = this.configStore.business();
    const start = business?.snModelStart ?? 0;
    const length = business?.snModelLength ?? 7;
    return sn.substring(start, start + length);
  }

  /**
   * Looks up a device by SN. Extracts model code and fetches from devices collection.
   * Returns the device if found, null otherwise.
   */
  async lookup(sn: string): Promise<Device | null> {
    this.isLoading = true;
    this.sn = sn;
    this.device = null;

    const modelCode = this.extractModelCode(sn);

    if (!modelCode) {
      this.logger.warn('Empty model code extracted from SN', { sn });
      this.isLoading = false;
      return null;
    }

    try {
      const doc = await this.firestoreService.getTenantDocument<DeviceDoc>('devices', modelCode);

      if (!doc) {
        this.logger.info('Device not found', { sn, modelCode });
        this.isLoading = false;
        return null;
      }

      this.device = this.mapToDevice(modelCode, doc);
      this.logger.info('Device found', {
        sn,
        modelCode,
        name: this.device.name,
        annualService: this.device.annualService,
      });
      return this.device;
    } catch (error) {
      this.logger.error('Device lookup failed', { sn, modelCode, error: String(error) });
      return null;
    } finally {
      this.isLoading = false;
    }
  }

  clear(): void {
    this.device = null;
    this.isLoading = false;
    this.sn = '';
  }

  private mapToDevice(id: string, data: DeviceDoc): Device {
    return {
      code: data['Device code'] ?? id,
      name: data['Device Name'] ?? '',
      type: (data['Device type'] as DeviceType) ?? DeviceType.BOILER,
      subType: '',
      unitCount: 0,
      exists: true,
      commissioning: data['commissioning'] ?? false,
      annualService: data['annualService'] ?? false,
      firstServiceYear: data['firstServiceYear'],
      serviceWindowStart: data['serviceWindowStart'],
      serviceWindowEnd: data['serviceWindowEnd'],
      maxWarrantyMonths: data['maxWarrantyMonths'],
    };
  }
}
