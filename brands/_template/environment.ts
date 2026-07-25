// Brand: REPLACE — production Angular environment.
// U produkciji Firebase se koristi ISKLJUČIVO kroz native plugine
// (@capacitor-firebase/*), koji čitaju google-services.json / GoogleService-Info.plist
// iz ovog brand foldera. Zato ovde NEMA web `firebase` konfiguracije.
export const environment = {
  production: true,
  brand: 'REPLACE-brand-id',
  firebase: null,
  cloudFunctionBaseUrl: 'https://us-central1-REPLACE-project.cloudfunctions.net',
  nativeStorageBucket: 'REPLACE.firebasestorage.app',
  logLevel: 'WARN',
};
