// Razvojni (dev) Angular environment — koristi se za `ng serve`, `ng test` i
// `ng build` bez --configuration=production. Za PRODUKCIJU se ovaj fajl
// ZAMENJUJE odgovarajućim brands/<brand>/environment.ts (vidi angular.json
// fileReplacements i scripts/set-brand.js), a tamo NEMA web `firebase` ključa.
//
// Produkcija koristi Firebase isključivo kroz native plugine (@capacitor-firebase/*).
// Web `firebase` config postoji SAMO da bi unit testovi (*.spec.ts) mogli da
// pozovu initializeApp() i dobiju DEFAULT app — bez njega getAuth()/getFirestore()
// bacaju "No Firebase App '[DEFAULT]'". Testovi mock-uju sve SDK pozive i ne idu
// na mrežu, pa ove vrednosti NE moraju da pripadaju živom projektu i namerno su
// lažne. Aplikacija ih nigde ne koristi i u produkcijski build ne ulaze.
export const environment = {
  production: false,
  brand: 'dev',
  firebase: {
    apiKey: 'test-only-not-a-real-key',
    authDomain: 'localhost',
    projectId: 'ariston-srb',
    storageBucket: 'ariston-srb.firebasestorage.app',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000',
  },
  logLevel: 'INFO',
  // Jezici dostupni na login ekranu (pre logina) i podrazumevani jezik.
  languages: ['sr', 'en'],
  defaultLanguage: 'sr',
  // Podrazumevana primarna boja (pre učitavanja config-a iz Firestore-a).
  primaryColor: '#B71C1C',
};
