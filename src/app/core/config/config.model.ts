export interface AppConfig {
  version: number;
  features: FeatureFlags;
  theme: ThemeConfig;
  localization: LocalizationConfig;
  business: BusinessConfig;
  interventionFaultOptions: Record<string, string[]>;
  interventionErrorOptions: Record<string, string[]>;
  interventionPhotoConfig: Record<string, Record<string, PhotoRequirement>>;
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
  interventionPhotos: boolean;
  signatureCapture: boolean;
}

/** Per-flow toggle for customer signature capture (under the signatureCapture feature flag). */
export interface SignatureFlows {
  commissioning: boolean;
  annualService: boolean;
  intervention: boolean;
}

export interface PhotoRequirement {
  maxPhotos: number;
  requiredPhotos: number;
  requireSparePartPhotos: boolean;
  description: string;
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
  exchangeRate: number;
  partNote: string;
  partPhotoFolder: string;
  snModelStart: number;
  snModelLength: number;
  snMfgDateStart: number;
  snMfgDateLength: number;
  snMinLength: number;
  snMaxLength: number;
  interventionCollections: Record<string, string>;
  photoQuality: number;
  photoMaxWidth: number;
  orderEmailRecipients: Record<string, string | string[]>;
  signature: SignatureFlows;
  /** Window (in months from the device purchase date) during which an extended
   *  warranty can be requested. Outside the window the action is hidden.
   *  0 or unset → never available. */
  warrantyExtensionWindowMonths?: number;
  /** Minimum allowed app version (e.g. "2.1.0"). If the running app is below it,
   *  a blocking notice is shown and the app cannot proceed. Empty/unset → no check. */
  minAppVersion?: string;
  /** When true, an info notice (translated `start_info_message`) with an OK
   *  button is shown when entering the app. */
  startInfo?: boolean;
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
    interventionPhotos: false,
    signatureCapture: false,
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
      exchangeRate: 1,
      partNote: '',
      partPhotoFolder: '',
      snModelStart: 0,
      snModelLength: 7,
      snMfgDateStart: 9,
      snMfgDateLength: 5,
      snMinLength: 21,
      snMaxLength: 21,
      interventionCollections: { default: 'interventions' },
      photoQuality: 70,
      photoMaxWidth: 1280,
      orderEmailRecipients: {},
      signature: { commissioning: false, annualService: false, intervention: false },
      warrantyExtensionWindowMonths: 0,
      minAppVersion: '',
      startInfo: false,
    },
    interventionFaultOptions: {},
    interventionErrorOptions: {},
    interventionPhotoConfig: {},
  };
}
