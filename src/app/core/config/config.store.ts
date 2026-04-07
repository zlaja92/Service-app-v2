import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { AppConfig, FeatureFlags, getDefaultConfig, getDefaultFeatures, getDefaultTheme } from './config.model';

interface ConfigState {
  config: AppConfig | null;
  logoDataUrl: string | null;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: ConfigState = {
  config: null,
  logoDataUrl: null,
  isLoaded: false,
  isLoading: false,
  error: null,
};

export const ConfigStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((state) => ({
    features: computed(() => state.config()?.features ?? getDefaultFeatures()),
    theme: computed(() => state.config()?.theme ?? getDefaultTheme()),
    localization: computed(() => state.config()?.localization),
    appTitle: computed(() => state.config()?.theme?.appTitle ?? 'Ariston Service'),
    business: computed(() => state.config()?.business),
  })),

  withMethods((store) => ({
    isFeatureEnabled(featureName: keyof FeatureFlags): boolean {
      const features = store.config()?.features ?? getDefaultFeatures();
      return features[featureName] ?? false;
    },

    setConfig(config: AppConfig): void {
      patchState(store, { config, isLoaded: true, isLoading: false, error: null });
    },

    setLogoDataUrl(logoDataUrl: string | null): void {
      patchState(store, { logoDataUrl });
    },

    loadDefaults(): void {
      patchState(store, { config: getDefaultConfig(), isLoaded: true });
    },

    setLoading(isLoading: boolean): void {
      patchState(store, { isLoading });
    },

    setError(error: string): void {
      patchState(store, { error, isLoading: false });
    },

    clear(): void {
      patchState(store, initialState);
    },
  })),
);
