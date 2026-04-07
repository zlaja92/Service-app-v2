import { Injectable, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Translation } from '@jsverse/transloco';
import {
  LANGUAGE_PREF_KEY,
  translationsVersionKey,
  translationsLanguagesKey,
  translationsLabelsKey,
  translationCacheKey,
} from './i18n.model';
import { BUNDLED_TRANSLATIONS } from './translations';
import { TenantService } from '../tenant/tenant.service';

@Injectable({ providedIn: 'root' })
export class TranslationCacheService {
  private tenantService = inject(TenantService);

  private getTenantId(): string {
    return this.tenantService.getCurrentTenantId() ?? 'default';
  }

  async getCachedTranslation(lang: string): Promise<Translation | null> {
    try {
      const { value } = await Preferences.get({ key: translationCacheKey(lang, this.getTenantId()) });
      if (!value) return null;
      return JSON.parse(value) as Translation;
    } catch {
      return null;
    }
  }

  async cacheTranslation(lang: string, data: Translation): Promise<void> {
    await Preferences.set({
      key: translationCacheKey(lang, this.getTenantId()),
      value: JSON.stringify(data),
    });
  }

  getBundledTranslation(lang: string): Translation | null {
    return BUNDLED_TRANSLATIONS[lang] ?? null;
  }

  async getCachedVersions(): Promise<Record<string, number>> {
    try {
      const { value } = await Preferences.get({ key: translationsVersionKey(this.getTenantId()) });
      if (!value) return {};
      return JSON.parse(value) as Record<string, number>;
    } catch {
      return {};
    }
  }

  async cacheVersion(lang: string, version: number): Promise<void> {
    const versions = await this.getCachedVersions();
    versions[lang] = version;
    await Preferences.set({
      key: translationsVersionKey(this.getTenantId()),
      value: JSON.stringify(versions),
    });
  }

  async getCachedLanguages(): Promise<string[] | null> {
    try {
      const { value } = await Preferences.get({ key: translationsLanguagesKey(this.getTenantId()) });
      if (!value) return null;
      return JSON.parse(value) as string[];
    } catch {
      return null;
    }
  }

  async cacheLanguages(languages: string[]): Promise<void> {
    await Preferences.set({
      key: translationsLanguagesKey(this.getTenantId()),
      value: JSON.stringify(languages),
    });
  }

  async getStoredLanguage(): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key: LANGUAGE_PREF_KEY });
      return value;
    } catch {
      return null;
    }
  }

  async storeLanguage(lang: string): Promise<void> {
    await Preferences.set({ key: LANGUAGE_PREF_KEY, value: lang });
  }

  async getCachedLabels(): Promise<Record<string, string>> {
    try {
      const { value } = await Preferences.get({ key: translationsLabelsKey(this.getTenantId()) });
      if (!value) return {};
      return JSON.parse(value) as Record<string, string>;
    } catch {
      return {};
    }
  }

  async cacheLabels(labels: Record<string, string>): Promise<void> {
    await Preferences.set({
      key: translationsLabelsKey(this.getTenantId()),
      value: JSON.stringify(labels),
    });
  }
}
