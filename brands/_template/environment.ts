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
  // Jezici dostupni na login ekranu (pre logina) i podrazumevani jezik.
  // Posle logina tenant može dodati još jezika iz Firestore-a.
  languages: ['sr', 'en'],
  defaultLanguage: 'sr',
  // Podrazumevana primarna boja — vidi se na login-u i pre učitavanja config-a.
  primaryColor: '#B71C1C',
};
