import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { ConfigStore } from '../../../core/config/config.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { Clearable } from '../../../core/session/clearable';
import { Device, DeviceType } from '../../../shared/models/device.model';

interface DeviceDoc {
  deviceName?: string;
  deviceCode?: string;
  deviceType?: string;
  deviceSubtype?: string;
  commissioning?: boolean;
  annualService?: boolean;
  connectedDevice?: boolean;
  canExtendWarranty?: boolean;
  intervention?: boolean;
  firstServiceYear?: number;
  serviceWindowStart?: number;
  serviceWindowEnd?: number;
  warrantyMonths?: number;
  [key: string]: unknown;
}

/**
 * Outcome of a lookup in no-catalog mode (deviceCatalog flag off).
 * Stays null in catalog mode. Only 'unregistered' may open the new-device flow:
 * registration overwrites users/{sn}, so 'error' must never be treated as unregistered.
 */
export type RegistrationStatus = 'registered' | 'unregistered' | 'not-allowed' | 'error';

@Injectable({ providedIn: 'root' })
export class DeviceLookupService implements Clearable {
  private firestoreService = inject(FirestoreService);
  private configStore = inject(ConfigStore);
  private tenantService = inject(TenantService);
  private logger = inject(LoggerService);

  device: Device | null = null;
  isLoading = false;
  sn = '';
  registrationStatus: RegistrationStatus | null = null;

  /** Catalog mode resolves the device from the model code in the SN. */
  private get isCatalogMode(): boolean {
    return this.configStore.isFeatureEnabled('deviceCatalog');
  }

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
   * Looks up a device by SN. In catalog mode extracts the model code and fetches
   * from the devices collection; otherwise resolves the device type from the
   * registration (see registrationStatus). Returns the device if found, null otherwise.
   */
  async lookup(sn: string): Promise<Device | null> {
    this.isLoading = true;
    this.sn = sn;
    this.device = null;
    this.registrationStatus = null;

    if (!this.isCatalogMode) {
      try {
        const result = await this.resolveViaRegistration(sn);
        this.registrationStatus = result.status;
        this.device = result.device;
        this.logger.info('Device lookup via registration', { sn, status: result.status });
        return this.device;
      } catch (error) {
        this.registrationStatus = 'error';
        this.logger.error('Device lookup via registration failed', { sn, error: String(error) });
        return null;
      } finally {
        this.isLoading = false;
      }
    }

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

      const device = this.mapToDevice(modelCode, doc);

      if (!this.tenantService.isDeviceTypeAllowed(device.type)) {
        this.logger.info('Device found but type not allowed', { sn, modelCode, type: device.type });
        this.isLoading = false;
        return null;
      }

      this.device = device;
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

  /**
   * Looks up a device by SN without modifying service state.
   * Use this when you need device info but don't want to change
   * the currently active device (e.g. validating a connected device).
   */
  async lookupSilent(sn: string): Promise<Device | null> {
    if (!this.isCatalogMode) {
      try {
        return (await this.resolveViaRegistration(sn)).device;
      } catch (error) {
        this.logger.error('Silent device lookup via registration failed', { sn, error: String(error) });
        return null;
      }
    }

    const modelCode = this.extractModelCode(sn);
    if (!modelCode) return null;

    try {
      const doc = await this.firestoreService.getTenantDocument<DeviceDoc>('devices', modelCode);
      if (!doc) return null;

      const device = this.mapToDevice(modelCode, doc);
      if (!this.tenantService.isDeviceTypeAllowed(device.type)) return null;

      return device;
    } catch (error) {
      this.logger.error('Silent device lookup failed', { sn, error: String(error) });
      return null;
    }
  }

  /**
   * Devices offered for an unregistered SN in no-catalog mode, loaded from
   * devices/{deviceType}: business.supportedDeviceTypes filtered by the types
   * allowed in the user's claims (all allowed types when the list is empty).
   * Types without a devices document are left out.
   */
  async getSelectableDevices(): Promise<Device[]> {
    const allowed = this.tenantService.getAllowedDeviceTypes();
    const configured = this.configStore.business()?.supportedDeviceTypes ?? [];
    const types = configured.length > 0 ? configured.filter(t => allowed.includes(t)) : allowed;

    const devices = await Promise.all(types.map(type => this.lookupByDeviceType(type)));
    return devices.filter((d): d is Device => d !== null);
  }

  /**
   * Loads the parameters of a device type (devices/{deviceType}). Used in
   * no-catalog mode when the user picks the type of an unregistered SN.
   * Does not change service state — the caller sets `device`.
   */
  async lookupByDeviceType(deviceType: string): Promise<Device | null> {
    if (!this.tenantService.isDeviceTypeAllowed(deviceType)) return null;

    try {
      const doc = await this.firestoreService.getTenantDocument<DeviceDoc>('devices', deviceType);
      if (!doc) {
        this.logger.warn('Device type document not found', { deviceType });
        return null;
      }
      return this.mapTypeDevice(deviceType, doc);
    } catch (error) {
      this.logger.error('Device type lookup failed', { deviceType, error: String(error) });
      return null;
    }
  }

  clear(): void {
    this.device = null;
    this.isLoading = false;
    this.sn = '';
    this.registrationStatus = null;
  }

  /**
   * No-catalog mode: reads the device type from the registration (users/{sn})
   * and its parameters from devices/{deviceType}. Firestore errors are thrown
   * to the caller so they are never mistaken for an unregistered SN.
   */
  private async resolveViaRegistration(
    sn: string,
  ): Promise<{ status: RegistrationStatus; device: Device | null }> {
    const registration = await this.firestoreService.getTenantDocument<Record<string, unknown>>('users', sn);
    if (!registration) return { status: 'unregistered', device: null };

    const deviceType = registration['deviceType'] as string | undefined;
    if (!deviceType) return { status: 'error', device: null };
    if (!this.tenantService.isDeviceTypeAllowed(deviceType)) return { status: 'not-allowed', device: null };

    const doc = await this.firestoreService.getTenantDocument<DeviceDoc>('devices', deviceType);
    if (!doc) return { status: 'error', device: null };

    // devices/{deviceType} holds only the per-type parameters; the model is
    // entered per SN at registration, so the name comes from the registration.
    const device = { ...this.mapTypeDevice(deviceType, doc), name: String(registration['deviceModel'] ?? '') };
    return { status: 'registered', device };
  }

  /**
   * Maps a devices/{deviceType} document (no-catalog mode). The document ID is
   * the type, so it wins over the deviceType field: a missing field must not fall
   * back to 'boiler', which register() would then write into the registration.
   */
  private mapTypeDevice(deviceType: string, data: DeviceDoc): Device {
    return { ...this.mapToDevice(deviceType, data), type: deviceType as DeviceType };
  }

  private mapToDevice(id: string, data: DeviceDoc): Device {
    return {
      code: data.deviceCode ?? id,
      name: data.deviceName ?? '',
      type: (data.deviceType as DeviceType) ?? DeviceType.BOILER,
      subType: data.deviceSubtype ?? '',
      unitCount: 0,
      exists: true,
      commissioning: data.commissioning ?? false,
      annualService: data.annualService ?? false,
      connectedDevice: data.connectedDevice ?? false,
      canExtendWarranty: data.canExtendWarranty ?? false,
      firstServiceYear: data.firstServiceYear,
      serviceWindowStart: data.serviceWindowStart,
      serviceWindowEnd: data.serviceWindowEnd,
      warrantyMonths: data.warrantyMonths,
    };
  }
}
