import { Injectable, inject } from '@angular/core';
import { TenantService } from '../tenant/tenant.service';
import { TenantStore } from '../tenant/tenant.store';
import { ConfigService } from '../config/config.service';
import { ConfigStore } from '../config/config.store';
import { getDefaultTheme } from '../config/config.model';
import { ThemeService } from '../theme/theme.service';
import { LogoCacheService } from '../theme/logo-cache.service';
import { TranslationService } from '../i18n/translation.service';
import { LoggerService } from '../logger/logger.service';
import { CLEARABLE_SERVICES } from './clearable';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private tenantService = inject(TenantService);
  private tenantStore = inject(TenantStore);
  private configService = inject(ConfigService);
  private configStore = inject(ConfigStore);
  private themeService = inject(ThemeService);
  private logoCacheService = inject(LogoCacheService);
  private translationService = inject(TranslationService);
  private logger = inject(LoggerService);
  private clearables = inject(CLEARABLE_SERVICES, { optional: true }) ?? [];

  private bootstrapGeneration = 0;
  private bootstrapPromise: Promise<void> | null = null;

  /**
   * Post-login / session-restore sequence.
   * Uses Promise-caching + generation counter:
   * - If already in progress, returns the same Promise (no duplicate work)
   * - If teardown() is called during bootstrap, in-flight steps are skipped
   */
  async bootstrap(): Promise<void> {
    if (this.bootstrapPromise) return this.bootstrapPromise;

    const gen = ++this.bootstrapGeneration;
    const promise = this.doBootstrap(gen);
    this.bootstrapPromise = promise;

    try {
      await promise;
    } finally {
      if (this.bootstrapPromise === promise) {
        this.bootstrapPromise = null;
      }
    }
  }

  /**
   * Logout cleanup: cancels any in-flight bootstrap, clears all stores
   * and feature service state.
   */
  teardown(): void {
    this.bootstrapGeneration++;
    this.bootstrapPromise = null;

    this.tenantStore.clear();
    this.configStore.clear();

    for (const service of this.clearables) {
      service.clear();
    }

    this.themeService.applyTheme(getDefaultTheme());
    this.logger.info('Session teardown completed');
  }

  private async doBootstrap(gen: number): Promise<void> {
    await this.tenantService.resolveFromAuthToken();
    if (gen !== this.bootstrapGeneration) return;

    if (this.tenantService.getCurrentTenantId()) {
      const config = await this.configService.loadConfig();
      if (gen !== this.bootstrapGeneration) return;

      this.configStore.setConfig(config);
      this.logger.info('Config loaded', { version: config.version });

      await this.translationService.sync();
      if (gen !== this.bootstrapGeneration) return;
    } else {
      this.logger.warn('No tenantId resolved, using default config');
      this.configStore.loadDefaults();
    }

    this.themeService.applyTheme(this.configStore.theme());
    this.cacheLogo(gen);
  }

  private cacheLogo(gen: number): void {
    const theme = this.configStore.theme();
    const version = this.configStore.config()?.version ?? 0;

    if (theme.logoUrl) {
      this.logoCacheService
        .getLogoDataUrl(theme.logoUrl, version)
        .then((url) => {
          if (gen === this.bootstrapGeneration) {
            this.configStore.setLogoDataUrl(url);
          }
        })
        .catch((err) => this.logger.warn('Logo cache failed', { error: String(err) }));
    }
  }
}
