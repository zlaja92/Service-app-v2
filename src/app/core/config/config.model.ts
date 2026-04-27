export interface AppConfig {
  version: number;
  features: FeatureFlags;
  theme: ThemeConfig;
  localization: LocalizationConfig;
  business: BusinessConfig;
}

export interface FeatureFlags {
  cart: boolean;
  documentation: boolean;
  deviceCatalog: boolean;
  bugReport: boolean;
  pdfReports: boolean;
  emailOrders: boolean;
  partPhoto: boolean;
  cartNote: boolean;
  deviceManagement: boolean;
}

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  appTitle: string;
  menuHeaderBackground: string;
}

export interface LocalizationConfig {
  defaultLanguage: string;
  supportedLanguages: string[];
}

export interface BusinessConfig {
  maxPartsPerIntervention: number;
  currency: string;
  partNote: string;
  partPhotoFolder: string;
  snModelStart: number;
  snModelLength: number;
  userSearchPageSize: number;
  userSearchMinLength: number;
  interventionCollections: Record<string, string>;
  interventionFaultOptions: { value: string; label: string }[];
  interventionErrorOptions: { value: string; label: string }[];
}

export function getDefaultFeatures(): FeatureFlags {
  return {
    cart: false,
    documentation: false,
    deviceCatalog: true,
    bugReport: false,
    pdfReports: false,
    emailOrders: false,
    partPhoto: false,
    cartNote: false,
    deviceManagement: true,
  };
}

export function getDefaultTheme(): ThemeConfig {
  return {
    primaryColor: '#B71C1C',
    secondaryColor: '#1565C0',
    accentColor: '#FFC107',
    logoUrl: '',
    appTitle: 'Ariston Service',
    menuHeaderBackground: '#B71C1C',
  };
}

export function getDefaultConfig(): AppConfig {
  return {
    version: 0,
    features: getDefaultFeatures(),
    theme: getDefaultTheme(),
    localization: {
      defaultLanguage: 'sr',
      supportedLanguages: ['sr', 'en', 'mk'],
    },
    business: {
      maxPartsPerIntervention: 4,
      currency: 'EUR',
      partNote: '',
      partPhotoFolder: '',
      snModelStart: 0,
      snModelLength: 7,
      userSearchPageSize: 20,
      userSearchMinLength: 2,
      interventionCollections: { default: 'interventions' },
      interventionFaultOptions: [],
      interventionErrorOptions: [],
    },
  };
}
