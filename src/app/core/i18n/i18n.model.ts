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
export const TRANSLATIONS_VERSION_KEY = 'translations_version';
export const TRANSLATIONS_LANGUAGES_KEY = 'translations_languages';
export const TRANSLATIONS_LABELS_KEY = 'translations_labels';

export function translationCacheKey(lang: string): string {
  return `translations_${lang}`;
}

export const LANGUAGE_LABELS: Record<string, string> = {
  sr: 'Srpski',
  en: 'English',
};

export type BundledTranslations = Record<string, Translation>;
