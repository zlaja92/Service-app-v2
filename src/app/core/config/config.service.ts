import { Injectable, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { AppConfig, getDefaultConfig } from './config.model';
import { FirestoreService } from '../firebase/firestore.service';
import { TenantService } from '../tenant/tenant.service';
import { LoggerService } from '../logger/logger.service';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private logger = inject(LoggerService);
  private firestoreService = inject(FirestoreService);
  private tenantService = inject(TenantService);

  private getConfigKey(): string {
    const tenantId = this.tenantService.getCurrentTenantId();
    return `app_config_${tenantId ?? 'default'}`;
  }

  /**
   * Loads config for the current tenant.
   * Flow:
   * 1. Read local cached config from Preferences (tenant-aware key)
   * 2. Fetch ONLY the version document from Firestore (lightweight read)
   * 3. If local version matches remote → use local (no full config fetch)
   * 4. If different → fetch full config document, save to Preferences
   * 5. If offline/error → use local cache, or defaults as last resort
   *
   * Firestore structure:
   *   tenants/{tenantId}/settings/version  → { version: number }
   *   tenants/{tenantId}/settings/config   → AppConfig
   */
  async loadConfig(): Promise<AppConfig> {
    const localConfig = await this.getLocalConfig();

    try {
      const remoteVersion = await this.getRemoteConfigVersion();

      if (localConfig && localConfig.version === remoteVersion) {
        this.logger.debug('Config version matches, using local cache', {
          version: localConfig.version,
        });
        return localConfig;
      }

      this.logger.info('New config version detected, fetching full config', {
        localVersion: localConfig?.version ?? null,
        remoteVersion,
      });

      const remoteConfig = await this.fetchFullConfig(remoteVersion);
      await this.saveLocalConfig(remoteConfig);
      return remoteConfig;
    } catch (error) {
      this.logger.warn('Failed to fetch remote config, using fallback', {
        error: String(error),
      });

      if (localConfig) {
        this.logger.info('Using cached local config', { version: localConfig.version });
        return localConfig;
      }

      this.logger.warn('No local config available, using defaults');
      return getDefaultConfig();
    }
  }

  private async getLocalConfig(): Promise<AppConfig | null> {
    try {
      const { value } = await Preferences.get({ key: this.getConfigKey() });
      if (!value) return null;
      return JSON.parse(value) as AppConfig;
    } catch {
      return null;
    }
  }

  /**
   * Fetches ONLY the version document from Firestore (lightweight read).
   * Path: tenants/{tenantId}/settings/version → { version: number }
   */
  private async getRemoteConfigVersion(): Promise<number> {
    const doc = await this.firestoreService.getTenantDocument<{ version: number }>('settings', 'version');

    if (!doc || doc.version == null) {
      throw new Error('Config version document not found or missing version field');
    }

    return doc.version;
  }

  /**
   * Fetches the full config document from Firestore and attaches the version
   * read from the version document (config document itself has no version field).
   * Path: tenants/{tenantId}/settings/config → Omit<AppConfig, 'version'>
   */
  private async fetchFullConfig(version: number): Promise<AppConfig> {
    const config = await this.firestoreService.getTenantDocument<Omit<AppConfig, 'version'>>('settings', 'config');

    if (!config) {
      throw new Error('Config document not found');
    }

    return { ...config, version };
  }

  private async saveLocalConfig(config: AppConfig): Promise<void> {
    try {
      await Preferences.set({
        key: this.getConfigKey(),
        value: JSON.stringify(config),
      });
      this.logger.debug('Config saved to local cache', { version: config.version });
    } catch (error) {
      this.logger.warn('Failed to save config to local cache', { error: String(error) });
    }
  }
}
