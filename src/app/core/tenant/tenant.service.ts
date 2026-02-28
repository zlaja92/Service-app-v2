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
      const result = await FirebaseAuthentication.getIdToken();
      if (!result.token) {
        this.logger.warn('No auth token available for tenant resolution');
        return;
      }

      // Decode JWT to read custom claims
      const payload = JSON.parse(atob(result.token.split('.')[1]));
      //const tenantId = payload.tenantId ?? null;
      const tenantId = 'testId'
      const role = payload.role ?? 'servicer';
      const servicerId = payload.servicerId ?? null;

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
    return `envs/testEnv/tenants/${tenantId}`;
  }

  getCollectionPath(collection: string): string {
    return `${this.getTenantDocPath()}/${collection}`;
  }

  getCurrentTenantId(): string | null {
    return this.tenantStore.tenantId();
  }
}
