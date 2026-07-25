// Razvojni (dev) Angular environment — koristi se za `ng serve`, `ng test` i
// `ng build` bez --configuration=production. Za PRODUKCIJU se ovaj fajl
// ZAMENJUJE odgovarajućim brands/<brand>/environment.ts (vidi angular.json
// fileReplacements i scripts/set-brand.js), a tamo NEMA web `firebase` ključa.
//
// Produkcija koristi Firebase isključivo kroz native plugine (@capacitor-firebase/*).
// Web `firebase` config ostaje SAMO ovde jer ga integracioni testovi
// (*.spec.ts) koriste da inicijalizuju web JS SDK DEFAULT app (inače
// getFirestore()/getAuth() bacaju "No Firebase App"). Nije bezbednosno
// osetljiv — Firebase web API ključevi nisu tajne (zaštita ide kroz Security
// Rules i App Check), a u produkcijski build ne ulazi.
export const environment = {
  production: false,
  brand: 'dev',
  firebase: {
    apiKey: 'AIzaSyBXcLf2ZUlA3HHVeizPQ3LdT9WWphDmgOY',
    authDomain: 'aristonboilersmk-af027.firebaseapp.com',
    projectId: 'aristonboilersmk-af027',
    storageBucket: 'aristonboilersmk-af027.appspot.com',
    messagingSenderId: '399858868527',
    appId: '1:399858868527:web:7048caeddb546e853681da',
  },
  cloudFunctionBaseUrl: 'https://us-central1-aristonboilersmk-af027.cloudfunctions.net',
  nativeStorageBucket: 'ariston-srb.firebasestorage.app',
  logLevel: 'INFO',
};
