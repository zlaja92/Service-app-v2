# brands/ — White-label konfiguracija po klijentu

Svaki klijent (brend) ima svoj folder ovde. **Sve što je specifično za jednog
klijenta živi ISKLJUČIVO u njegovom folderu** — Firebase, bundle ID, ime app,
ikonice. Build skripta bira ceo folder odjednom, pa je nemoguće slučajno
pomešati Firebase jednog sa ikonicom drugog klijenta.

## Trenutni brendovi

| id | displayName | bundle ID | Firebase native |
|----|-------------|-----------|-----------------|
| `ariston-srb` | Ariston Service | `io.ionic.Ariston` | ✅ postavljen |
| `tiki` | Tiki Servis | `rs.Tiki` | ⚠️ nedostaje (vidi `.MISSING` fajlove) |

## Sadržaj brand foldera

```
brands/<id>/
  brand.json              # id, displayName, bundle ID-evi, keystore putanja
  environment.ts          # prod Angular environment (bez web firebase!)
  google-services.json    # Android Firebase (iz Firebase konzole)
  GoogleService-Info.plist # iOS Firebase (iz Firebase konzole)
  release.keystore        # Android potpis (NE commituje se — vidi .gitignore)
  assets/
    icon.png              # 1024x1024 izvor za app ikonicu
    splash.png            # splash (light)
    splash-dark.png       # splash (dark)
```

## Kako se koristi

Postavi aktivni brend (kopira brand fajlove na prava mesta u projektu):

```
node scripts/set-brand.js ariston-srb
node scripts/set-brand.js tiki
```

Ili odmah build za brend:

```
npm run build:brand -- tiki android
```

## Dodavanje novog klijenta — vidi `../BRANDS.md`
