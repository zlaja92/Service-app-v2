import { Injectable, inject } from '@angular/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { TenantStore } from './tenant.store';
import { LoggerService } from '../logger/logger.service';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private logger = inject(LoggerService);
  private tenantStore = inject(TenantStore);

  async resolveFromAuthToken(): Promise<void> {
    try {
      // Get raw JWT token and decode manually to ensure custom claims are visible
      const tokenResult = await FirebaseAuthentication.getIdToken({ forceRefresh: true });
      const token = tokenResult.token;

      if (!token) {
        this.logger.warn('No auth token available for tenant resolution');
        return;
      }

      const claims = this.decodeJwtPayload(token);
      const tenantId = (claims['tenantId'] as string) ?? null;
      const role = (claims['role'] as string) ?? 'servicer';
      const servicerId = (claims['servicerId'] as string) ?? null;

      if (!tenantId) {
        this.logger.warn('No tenantId found in auth claims');
        return;
      }

      const deviceTypes = Array.isArray(claims['deviceTypes'])
        ? (claims['deviceTypes'] as string[])
        : [];

      this.tenantStore.setTenant(tenantId, role, servicerId, deviceTypes);
      this.logger.info('Tenant resolved from auth token', { tenantId, role, servicerId, deviceTypes });
    } catch (error) {
      this.logger.warn('Failed to resolve tenant from auth token', { error: String(error) });
    }
  }

  private decodeJwtPayload(token: string): Record<string, unknown> {
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payload);
    return JSON.parse(decoded);
  }

  getTenantDocPath(): string {
    const tenantId = this.tenantStore.tenantId();
    if (!tenantId) {
      throw new Error('Tenant not resolved. Call resolveFromAuthToken() first.');
    }
    return `tenants/${tenantId}`;
  }

  getCollectionPath(collection: string): string {
    return `${this.getTenantDocPath()}/${collection}`;
  }

  getCurrentTenantId(): string | null {
    return this.tenantStore.tenantId();
  }

  /**
   * Returns collection path scoped to device type.
   * Path: tenants/{tenantId}/{deviceType}/{collection}
   * Used for users and interventions collections.
   */
  getDeviceTypeCollectionPath(deviceType: string, collection: string): string {
    return `${this.getTenantDocPath()}/deviceTypes/${deviceType}/${collection}`;
  }

  /**
   * Checks if the current user has access to the given device type.
   */
  isDeviceTypeAllowed(deviceType: string): boolean {
    return this.tenantStore.deviceTypes().includes(deviceType);
  }

  /**
   * Returns the list of allowed device types from claims.
   */
  getAllowedDeviceTypes(): string[] {
    return this.tenantStore.deviceTypes();
  }
}
