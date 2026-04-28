# Konfiguracija aplikacije

Sva podešavanja se čuvaju u Firestore na putanji:
```
tenants/{tenantId}/settings/config
```

Konfiguracija se kešira lokalno i osvežava samo kad se verzija promeni (`settings/version`).

---

## Feature Flags

Boolean flagovi koji kontrolišu vidljivost funkcionalnosti u aplikaciji.
Koriste se kroz direktivu `*appFeatureFlag="'ime'"`, guard `featureGuard('ime')` i metodu `configStore.isFeatureEnabled('ime')`.

| Flag | Default | Opis |
|------|---------|------|
| `deviceManagement` | `true` | Upravljanje uređajima — pretraga po SN, skeniranje barkoda, registracija, detalji uređaja, intervencije, godišnji servis, istorija, pretraga po korisniku |
| `deviceCatalog` | `true` | Katalog uređaja — pretraga po tipu, grupe delova, rezervni delovi |
| `documentation` | `false` | Sekcija sa dokumentacijom (uputstva, šeme, itd.) |
| `cart` | `false` | Korpa za naručivanje rezervnih delova |
| `cartNote` | `false` | Polje za napomenu u korpi |
| `bugReport` | `false` | Prijava grešaka (meni) |
| `pdfReports` | `false` | Generisanje PDF izveštaja |
| `emailOrders` | `false` | Slanje narudžbina emailom |
| `partPhoto` | `false` | Prikaz fotografija rezervnih delova iz Firebase Storage |

### Zaštićene rute po feature flagu

| Ruta | Flag |
|------|------|
| `/device-management/:sn` | `deviceManagement` |
| `/device-management/:sn/add-user` | `deviceManagement` |
| `/device-management/:sn/add-device` | `deviceManagement` |
| `/device-management/:sn/annual-service` | `deviceManagement` |
| `/device-management/:sn/intervention` | `deviceManagement` |
| `/device-management/:sn/history` | `deviceManagement` |
| `/device-management/:sn/history/:id` | `deviceManagement` |
| `/search-by-device` | `deviceCatalog` |
| `/device/:code/device-groups` | `deviceCatalog` |
| `/device/:code/device-groups/:groupId/device-parts` | `deviceCatalog` |
| `/search-by-user` | `deviceManagement` |
| `/docs` | `documentation` |
| `/cart` | `cart` |

---

## Tema (ThemeConfig)

Vizuelna podešavanja aplikacije.

| Polje | Tip | Default | Opis |
|-------|-----|---------|------|
| `primaryColor` | string | `#B71C1C` | Primarna boja (toolbar, dugmadi) |
| `secondaryColor` | string | `#1565C0` | Sekundarna boja |
| `accentColor` | string | `#FFC107` | Akcentna boja |
| `logoUrl` | string | `''` | URL logotipa (kešira se kao base64) |
| `appTitle` | string | `Ariston Service` | Naziv aplikacije u headeru |
| `menuHeaderBackground` | string | `#B71C1C` | Pozadina header-a menija |

---

## Lokalizacija (LocalizationConfig)

| Polje | Tip | Default | Opis |
|-------|-----|---------|------|
| `defaultLanguage` | string | `sr` | Podrazumevani jezik |
| `supportedLanguages` | string[] | `['sr', 'en', 'mk']` | Dostupni jezici u meniju |

---

## Poslovna podešavanja (BusinessConfig)

| Polje | Tip | Default | Opis |
|-------|-----|---------|------|
| `maxPartsPerIntervention` | number | `4` | Maksimalan broj delova po intervenciji |
| `currency` | string | `EUR` | Valuta za cene rezervnih delova |
| `snModelStart` | number | `0` | Početna pozicija koda modela u serijskom broju |
| `snModelLength` | number | `7` | Dužina koda modela u serijskom broju |
| `userSearchPageSize` | number | `20` | Broj rezultata po stranici u pretrazi korisnika |
| `userSearchMinLength` | number | `2` | Minimalan broj karaktera za pretragu korisnika |
| `partNote` | string | `''` | Napomena koja se prikazuje na detaljima dela |
| `partPhotoFolder` | string | `''` | Folder u Firebase Storage za fotografije delova |
| `interventionCollections` | Record | `{ default: 'interventions' }` | Mapiranje tip uređaja → ime kolekcije za intervencije |

---

## Intervencije — opisi kvarova i kodovi grešaka

Ova polja su na root nivou config dokumenta (ne unutar `business`).
Vrednosti su i18n ključevi — prevode se pri prikazu na aktivnom jeziku korisnika.

| Polje | Tip | Default | Opis |
|-------|-----|---------|------|
| `interventionFaultOptions` | Record&lt;string, string[]&gt; | `{}` | Opisi kvarova po tipu uređaja (ključ = DeviceType, vrednost = lista i18n ključeva) |
| `interventionErrorOptions` | Record&lt;string, string[]&gt; | `{}` | Kodovi grešaka po tipu uređaja (ključ = DeviceType, vrednost = lista i18n ključeva) |

---

## Primer konfiguracije u Firestore

```json
{
  "features": {
    "deviceManagement": true,
    "deviceCatalog": true,
    "documentation": false,
    "cart": false,
    "partPhoto": true
  },
  "theme": {
    "primaryColor": "#B71C1C",
    "logoUrl": "https://firebasestorage.googleapis.com/...",
    "appTitle": "Ariston Service SRB"
  },
  "localization": {
    "defaultLanguage": "sr",
    "supportedLanguages": ["sr", "en"]
  },
  "business": {
    "currency": "RSD",
    "interventionCollections": {
      "default": "interventions",
      "BOILER": "interventions-boiler"
    },
    "interventionFaultOptions": {
      "BOILER": ["NE GREJE, SIJA SIJALICA", "CURENJE GREJAČA", "..."],
      "GAS_BOILER": ["BUKA PRILIKOM ZAGREVANJA", "CURI VODA IZ KOTLA", "..."],
      "HEAT_PUMP": ["BUKA PRILIKOM ZAGREVANJA", "..."]
    },
    "interventionErrorOptions": {
      "BOILER": ["BEZ GREŠKE", "101 - Pregrevanje", "..."],
      "HEAT_PUMP": ["BEZ GREŠKE", "1 - Greška TD senzora", "..."]
    }
  }
}
```

> Napomena: Dovoljno je poslati samo polja koja se razlikuju od default vrednosti — konfiguracija se merguje sa default-ima.
