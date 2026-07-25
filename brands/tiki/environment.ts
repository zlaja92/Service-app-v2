// Brand: tiki — production Angular environment.
// U produkciji Firebase se koristi ISKLJUČIVO kroz native plugine
// (@capacitor-firebase/*), koji čitaju google-services.json / GoogleService-Info.plist
// iz ovog brand foldera. Zato ovde NEMA web `firebase` konfiguracije.
export const environment = {
  production: true,
  brand: 'tiki',
  firebase: null,
  // TODO(tiki): zameni URL-om Tiki Cloud Functions projekta.
  cloudFunctionBaseUrl: 'https://us-central1-REPLACE-tiki-project.cloudfunctions.net',
  // TODO(tiki): zameni Tiki Storage bucket-om (npr. tiki-xxxx.firebasestorage.app).
  nativeStorageBucket: 'REPLACE-tiki.firebasestorage.app',
  logLevel: 'WARN',
};
