# White-label (brandovi) — vodič

Aplikacija se builduje za više klijenata (brendova) iz jednog koda. Svaki
klijent ima svoj folder `brands/<id>/` sa svim što je specifično za njega
(Firebase, bundle ID, ime app, ikonice). Build bira ceo folder odjednom, pa je
**nemoguće slučajno pomešati** fajlove dva klijenta.

## ⚠️ Posle git clone / checkout / merge — OBAVEZNO regeneriši slike

Generisane native slike (ikone, splash, splash_icon) NISU u gitu (namerno —
prave se iz `brands/<id>/assets/`). Zato posle svakog `git clone`, `git checkout`
na drugu granu, ili `merge`, one **fizički ne postoje na disku**, i Android build
puca sa:

```
error: resource drawable/splash_icon not found
```

Rešenje — regeneriši slike aktiviranjem brenda:

```
npm run set-brand -- <brand>
```

(`build-brand.js` orkestrator to radi sam; direktan Android Studio / Xcode Run ne — pa ne zaboravi.)

## Trenutni brendovi

| id | displayName | bundle ID (Android + iOS) |
|----|-------------|---------------------------|
| `ariston-srb` | Ariston Service | `io.ionic.Ariston` |
| `tiki` | Tiki Servis | `rs.Tiki` |

> `namespace` (Android) i source paket ostaju `io.ionic.Ariston` za SVE brendove —
> to je interni identifikator koda, ne menja se. Identitet app na Store-u
> određuje `applicationId` (Android) / `PRODUCT_BUNDLE_IDENTIFIER` (iOS), a to
> jeste po brendu.

## Kako radi (ukratko)

`scripts/set-brand.js <id>` kopira fajlove iz `brands/<id>/` na prava mesta:

| Izvor (u gitu) | Cilj (generisan, NIJE u gitu) |
|----------------|-------------------------------|
| `brands/<id>/environment.ts` | `src/environments/environment.prod.ts` |
| `brands/<id>/google-services.json` | `android/app/google-services.json` |
| `brands/<id>/GoogleService-Info.plist` | `ios/App/App/GoogleService-Info.plist` |
| `brands/<id>/brand.json` → | `android/app/brand.properties` (čita build.gradle) |
| `brands/<id>/brand.json` → | `capacitor.brand.json` (čita capacitor.config.ts) |
| `brands/<id>/assets/*` | `resources/*` (izvor za ikonice/splash) |
| `brand.json` vrednosti | iOS Info.plist + project.pbxproj (ime + bundle id) |

Ciljni fajlovi su u `.gitignore` jer se prepisuju pri svakom biranju brenda.
Kanonski izvori su u `brands/`.

**Fail-loud:** ako brend nije postavljen, i Android (gradle) i Capacitor i
app-runtime **pucaju sa jasnom porukom** umesto da tiho izaberu pogrešan brend.

## Svakodnevne komande

```bash
npm run brands                      # izlistaj brendove + trenutno aktivan
npm run set-brand -- tiki           # aktiviraj brend (za ng serve / ručni build)

# Jedna komanda = ceo build za brend:
npm run build:tiki:android          # set-brand + ng build prod + cap sync + .aab
npm run build:ariston-srb:ios       # set-brand + ng build prod + cap sync (Xcode arhivira)

# Generički oblik:
npm run build:brand -- <id> [android|ios] [--no-assets] [--no-native]
```

## Dodavanje NOVOG klijenta (npr. ariston-hr)

1. **Napravi folder** kopiranjem template-a:
   ```bash
   cp -r brands/_template brands/ariston-hr
   ```

2. **Popuni `brands/ariston-hr/brand.json`** (id MORA biti isti kao ime foldera):
   ```json
   {
     "id": "ariston-hr",
     "displayName": "Ariston Servis HR",
     "appId": "hr.ariston.service",
     "androidPackage": "hr.ariston.service",
     "iosBundleId": "hr.ariston.service",
     "customUrlScheme": "hr.ariston.service",
     "keystoreFile": "brands/ariston-hr/release.keystore"
   }
   ```

3. **Popuni `brands/ariston-hr/environment.ts`** (zameni `REPLACE` vrednosti:
   `brand`, `languages`, `defaultLanguage`, `primaryColor`). Firebase ostaje
   `null` — u produkciji ide samo native, kroz `google-services.json` /
   `GoogleService-Info.plist`. Storage bucket i Cloud Functions se NE navode u
   environment-u: native plugini ih čitaju iz tih Firebase fajlova.

4. **Firebase native fajlovi** (iz Firebase konzole tog projekta):
   - Android app sa package name iz `androidPackage` → preuzmi `google-services.json`
     → snimi kao `brands/ariston-hr/google-services.json`
   - iOS app sa bundle ID iz `iosBundleId` → preuzmi `GoogleService-Info.plist`
     → snimi kao `brands/ariston-hr/GoogleService-Info.plist`
   - Ako još nemaš fajl, ostavi `<ime>.MISSING` marker (kao kod tiki-ja) —
     set-brand.js će odbiti build dok ne dodaš pravi fajl.

5. **Ikonice**: zameni `brands/ariston-hr/assets/icon.png` (1024×1024),
   `splash.png`, `splash-dark.png` brendiranim slikama.

6. **Registruj bundle ID u native projektima** (jednokratno, jer Firebase i
   Store nalog moraju znati za novi ID). iOS: dodaj/potvrdi bundle ID u Apple
   Developer nalogu. Android: napravi app u Google Play Console sa novim
   `applicationId`.

7. **Keystore** (Android potpis): generiši poseban keystore po brendu:
   ```bash
   keytool -genkey -v -keystore brands/ariston-hr/release.keystore \
     -alias ariston-hr -keyalg RSA -keysize 2048 -validity 10000
   ```
   Keystore NIJE u gitu (vidi `.gitignore`). Čuvaj ga bezbedno — bez njega ne
   možeš objaviti update na Play Store.

8. **(Opciono) npm prečice** — dodaj u `package.json` scripts:
   ```json
   "build:ariston-hr:android": "node scripts/build-brand.js ariston-hr android",
   "build:ariston-hr:ios": "node scripts/build-brand.js ariston-hr ios"
   ```

9. **Testiraj**: `npm run set-brand -- ariston-hr && npm run brands`.

## Potpisivanje na CI (keystore secret) — TODO za kasnije

Keystore-ovi se čuvaju van gita. Za automatski build/potpis na CI-ju
(GitHub Actions / Bitrise) planira se:
- keystore + lozinke kao base64 CI secret,
- korak koji dekodira secret u `brands/<id>/release.keystore` i piše
  `android/keystore.properties` pre gradle `bundleRelease`.

(Nije još postavljeno — javi kada želiš da uvežemo CI pipeline.)

## Android Studio i menjanje brenda (VAŽNO)

Android Studio **kešira `applicationId` iz poslednjeg Gradle sync-a**. Posle
svake promene brenda (`set-brand` / `build:brand`) obavezno:

1. **File → Sync Project with Gradle Files** (set-brand.js osvežava build.gradle
   pa Studio sam prikaže "Sync Now" baner — klikni ga)
2. Tek onda **Run**

Simptomi ako preskočiš sync — Run instalira NOVI brend, ali **pokrene app
STAROG brenda**:
- na telefonu se pokrene pogrešna app (npr. Tiki umesto Ariston) iako je
  ispravna instalirana;
- ili "Error running 'app'" sa ID-em starog brenda ako ta app nije instalirana.

Isto važi i za Xcode na iOS-u u blažem obliku: posle promene brenda zatvori/
ponovo otvori workspace ako se scheme čudno ponaša.

## Šta se NE sme raditi

- ❌ Ne uređuj generisane fajlove ručno (`android/app/brand.properties`,
  `capacitor.brand.json`, `src/environments/environment.prod.ts`,
  native `google-services.json` / `.plist`) — prepisuje ih set-brand.js.
  Izmene idu u `brands/<id>/`.
- ❌ Ne commituj keystore-ove.
- ❌ Ne stavljaj web `firebase` config u `brands/*/environment.ts` — produkcija
  je native-only.
