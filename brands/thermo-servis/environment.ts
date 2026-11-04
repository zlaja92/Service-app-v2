// Brand: thermo-servis — production Angular environment.
// In production Firebase is used ONLY through the native plugins
// (@capacitor-firebase/*), which read google-services.json / GoogleService-Info.plist
// from this brand folder. That is why there is NO web `firebase` config here.
export const environment = {
  production: true,
  brand: 'thermo-servis',
  firebase: null,
  logLevel: 'WARN',
  // Languages available on the login screen (before login) and the default language.
  // After login the tenant can add more languages from Firestore.
  languages: ['sr', 'en'],
  defaultLanguage: 'sr',
  // Default primary color — visible on login and before the config loads.
  // TODO(thermo-servis): replace with the brand color (also in brand.json).
  primaryColor: '#B71C1C',
};
