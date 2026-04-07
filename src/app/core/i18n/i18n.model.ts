import { Translation } from '@jsverse/transloco';

export interface TranslationVersionEntry {
  version: number;
  label: string;
}

export interface TranslationVersionDoc {
  [lang: string]: TranslationVersionEntry;
}

export const DEFAULT_LANGUAGE = 'sr';
export const BUNDLED_LANGUAGES = ['sr', 'en'];

export const LANGUAGE_PREF_KEY = 'app_language';

export function translationsVersionKey(tenantId: string): string {
  return `translations_version_${tenantId}`;
}

export function translationsLanguagesKey(tenantId: string): string {
  return `translations_languages_${tenantId}`;
}

export function translationsLabelsKey(tenantId: string): string {
  return `translations_labels_${tenantId}`;
}

export function translationCacheKey(lang: string, tenantId: string): string {
  return `translations_${lang}_${tenantId}`;
}

export const LANGUAGE_LABELS: Record<string, string> = {
  sr: 'Srpski',
  en: 'English',
};

export type BundledTranslations = Record<string, Translation>;
