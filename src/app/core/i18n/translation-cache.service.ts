import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Translation } from '@jsverse/transloco';
import {
  LANGUAGE_PREF_KEY,
  TRANSLATIONS_VERSION_KEY,
  TRANSLATIONS_LANGUAGES_KEY,
  TRANSLATIONS_LABELS_KEY,
  translationCacheKey,
} from './i18n.model';
import { BUNDLED_TRANSLATIONS } from './translations';

@Injectable({ providedIn: 'root' })
export class TranslationCacheService {

  async getCachedTranslation(lang: string): Promise<Translation | null> {
    try {
      const { value } = await Preferences.get({ key: translationCacheKey(lang) });
      if (!value) return null;
      return JSON.parse(value) as Translation;
    } catch {
      return null;
    }
  }

  async cacheTranslation(lang: string, data: Translation): Promise<void> {
    await Preferences.set({
      key: translationCacheKey(lang),
      value: JSON.stringify(data),
    });
  }

  getBundledTranslation(lang: string): Translation | null {
    return BUNDLED_TRANSLATIONS[lang] ?? null;
  }

  async getCachedVersions(): Promise<Record<string, number>> {
    try {
      const { value } = await Preferences.get({ key: TRANSLATIONS_VERSION_KEY });
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
      key: TRANSLATIONS_VERSION_KEY,
      value: JSON.stringify(versions),
    });
  }

  async getCachedLanguages(): Promise<string[] | null> {
    try {
      const { value } = await Preferences.get({ key: TRANSLATIONS_LANGUAGES_KEY });
      if (!value) return null;
      return JSON.parse(value) as string[];
    } catch {
      return null;
    }
  }

  async cacheLanguages(languages: string[]): Promise<void> {
    await Preferences.set({
      key: TRANSLATIONS_LANGUAGES_KEY,
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
      const { value } = await Preferences.get({ key: TRANSLATIONS_LABELS_KEY });
      if (!value) return {};
      return JSON.parse(value) as Record<string, string>;
    } catch {
      return {};
    }
  }

  async cacheLabels(labels: Record<string, string>): Promise<void> {
    await Preferences.set({
      key: TRANSLATIONS_LABELS_KEY,
      value: JSON.stringify(labels),
    });
  }
}
