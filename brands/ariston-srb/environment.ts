// Brand: ariston-srb — production Angular environment.
// U produkciji Firebase se koristi ISKLJUČIVO kroz native plugine
// (@capacitor-firebase/*), koji čitaju google-services.json / GoogleService-Info.plist
// iz ovog brand foldera. Zato ovde NEMA web `firebase` konfiguracije.
export const environment = {
  production: true,
  brand: 'ariston-srb',
  firebase: null,
  cloudFunctionBaseUrl: 'https://us-central1-aristonboilersmk-af027.cloudfunctions.net',
  nativeStorageBucket: 'ariston-srb.firebasestorage.app',
  logLevel: 'WARN',
};
