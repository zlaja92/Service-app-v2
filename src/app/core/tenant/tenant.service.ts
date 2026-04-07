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
      const result = await FirebaseAuthentication.getIdTokenResult();
      if (!result.claims) {
        this.logger.warn('No auth token available for tenant resolution');
        return;
      }

      const claims = result.claims;
      const tenantId = (claims['tenantId'] as string) ?? null;
      const role = (claims['role'] as string) ?? 'servicer';
      const servicerId = (claims['servicerId'] as string) ?? null;

      if (!tenantId) {
        this.logger.warn('No tenantId found in auth claims');
        return;
      }

      this.tenantStore.setTenant(tenantId, role, servicerId);
      this.logger.info('Tenant resolved from auth token', { tenantId, role, servicerId });
    } catch (error) {
      this.logger.warn('Failed to resolve tenant from auth token', { error: String(error) });
    }
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
}
