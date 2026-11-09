// Brand: agt — production Angular environment.
// In production Firebase is used ONLY through the native plugins
// (@capacitor-firebase/*), which read google-services.json / GoogleService-Info.plist
// from this brand folder. That is why there is NO web `firebase` config here.
export const environment = {
  production: true,
  brand: 'agt',
  firebase: null,
  logLevel: 'WARN',
  // Languages available on the login screen (before login) and the default language.
  // After login the tenant can add more languages from Firestore.
  languages: ['sr', 'en'],
  defaultLanguage: 'sr',
  // Default primary color — visible on login and before the config loads.
  primaryColor: '#E6A800',
};
