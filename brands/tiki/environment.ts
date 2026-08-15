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
  // Jezici dostupni na login ekranu (pre logina) i podrazumevani jezik.
  // Posle logina tenant može dodati još jezika iz Firestore-a.
  languages: ['sr', 'en'],
  defaultLanguage: 'sr',
  // Podrazumevana primarna boja — vidi se na login-u i pre učitavanja config-a.
  // TODO(tiki): zameni Tiki brend bojom (npr. plava sa logoa).
  primaryColor: '#1578BB',
};
