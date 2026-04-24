export interface AppConfig {
  version: number;
  features: FeatureFlags;
  theme: ThemeConfig;
  localization: LocalizationConfig;
  business: BusinessConfig;
}

export interface FeatureFlags {
  commissioning: boolean;
  warrantyExtension: boolean;
  interventionInWarranty: boolean;
  interventionOutWarranty: boolean;
  spareParts: boolean;
  cart: boolean;
  documentation: boolean;
  searchByUser: boolean;
  deviceCatalog: boolean;
  servicerHistory: boolean;
  bugReport: boolean;
  barcodeScan: boolean;
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
  warrantyPeriodMonths: number;
  serviceIntervalMonths: number;
  maxPartsPerIntervention: number;
  currency: string;
  partNote: string;
  partPhotoFolder: string;
  snModelStart: number;
  snModelLength: number;
  userSearchPageSize: number;
  userSearchMinLength: number;
  interventionFaultOptions: { value: string; label: string }[];
  interventionErrorOptions: { value: string; label: string }[];
}

export function getDefaultFeatures(): FeatureFlags {
  return {
    commissioning: false,
    warrantyExtension: false,
    interventionInWarranty: false,
    interventionOutWarranty: false,
    spareParts: false,
    cart: false,
    documentation: false,
    searchByUser: true,
    deviceCatalog: true,
    servicerHistory: false,
    bugReport: false,
    barcodeScan: true,
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
      warrantyPeriodMonths: 60,
      serviceIntervalMonths: 19,
      maxPartsPerIntervention: 4,
      currency: 'EUR',
      partNote: '',
      partPhotoFolder: '',
      snModelStart: 0,
      snModelLength: 7,
      userSearchPageSize: 20,
      userSearchMinLength: 2,
      interventionFaultOptions: [],
      interventionErrorOptions: [],
    },
  };
}
