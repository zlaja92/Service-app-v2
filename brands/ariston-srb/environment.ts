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
  // Jezici dostupni na login ekranu (pre logina) i podrazumevani jezik.
  // Posle logina tenant može dodati još jezika iz Firestore-a.
  languages: ['sr', 'en'],
  defaultLanguage: 'sr',
  // Podrazumevana primarna boja — vidi se na login-u i pre učitavanja config-a
  // iz Firestore-a. Posle logina ThemeService može override-ovati bojom tenanta.
  primaryColor: '#B71C1C',
};
