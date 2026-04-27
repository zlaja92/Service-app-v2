# Ariston Service - Arhitektura nove aplikacije

## Sadržaj

1. [Pregled tehnologija](#1-pregled-tehnologija)
2. [Arhitekturni slojevi - Dijagram](#2-arhitekturni-slojevi)
3. [Tok pokretanja aplikacije](#3-tok-pokretanja-aplikacije)
4. [Core Layer - Detalji](#4-core-layer)
5. [Konfiguracioni sistem](#5-konfiguracioni-sistem)
6. [Multi-Tenant dizajn](#6-multi-tenant-dizajn)
7. [Feature Flags i Guards](#7-feature-flags-i-guards)
8. [Autentifikacija](#8-autentifikacija)
9. [Lokalizacija (i18n)](#9-lokalizacija-i18n)
10. [Logging sistem](#10-logging-sistem)
11. [Tema i izgled (Theming)](#11-tema-i-izgled)
12. [State Management](#12-state-management)
13. [Data Layer](#13-data-layer)
14. [Shared Layer](#14-shared-layer)
15. [Features Layer](#15-features-layer)
16. [Struktura fajlova](#16-struktura-fajlova)
17. [Firestore model podataka](#17-firestore-model-podataka)
18. [Capacitor plugini](#18-capacitor-plugini)
19. [Routing i navigacija](#19-routing-i-navigacija)
20. [Bezbednost](#20-bezbednost)
21. [PDF generisanje](#21-pdf-generisanje)

---

## 1. Pregled tehnologija

| Tehnologija | Verzija | Napomena |
|---|---|---|
| **Ionic Framework** | 8.7.x | Standalone komponente, CSS utility klase |
| **Angular** | 19.x | Signals, standalone po defaultu |
| **Capacitor** | 8.x | Node.js 22+, Swift Package Manager za iOS |
| **TypeScript** | 5.4+ | Striktni mod |
| **Firebase** (native) | `@capacitor-firebase/*` 8.x | capawesome-team plugini |
| **State Management** | NgRx SignalStore | Lightweight state management sa Signals |
| **Lokalizacija** | @jsverse/transloco | Runtime i18n, standalone kompatibilan |
| **PDF** | pdfmake | Pure JS, bez native zavisnosti |

### Zašto NgRx SignalStore (preporuka za state management)

Aplikacija ima umerenu kompleksnost stanja:
- Auth state (korisnik, servicer, sesija)
- Config state (feature flags, tema, verzija)
- Tenant state (aktivan tenant)
- Cart state (korpa sa delovima)
- Poslovni podaci (uređaji, korisnici, intervencije)

NgRx SignalStore je idealan izbor jer:
- **Lakši od klasičnog NgRx** - nema actions/reducers/effects boilerplate
- **Koristi Angular Signals** nativno - budućnost Angular ekosistema
- **Strukturiran** - za razliku od golih servisa sa signalima, daje jasnu organizaciju
- **DevTools podrška** - debugging i inspekcija stanja
- **Skalabilan** - može rasti sa aplikacijom bez refaktorisanja

### Zašto pdfmake (preporuka za PDF)

- Pure JavaScript - radi u WebView-u bez native zavisnosti
- Radi offline (jednom učitan)
- Bogat API za kompleksne layoute (tabele, slike, stilovi)
- Dobro održavan i široko korišćen
- Već si upoznat sa njim iz postojeće aplikacije

---

## 2. Arhitekturni slojevi

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                          │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │  Login   │ │   Home   │ │  Device  │ │ Service  │ │  Search  │ │
│  │  Page    │ │   Page   │ │  Pages   │ │  Pages   │ │  Pages   │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                           │
│  │   Cart   │ │   Docs   │ │  History │                           │
│  │   Page   │ │   Page   │ │   Page   │                           │
│  └──────────┘ └──────────┘ └──────────┘                           │
│                                                                     │
│         Standalone Components + Lazy Loading + Feature Guards       │
├─────────────────────────────────────────────────────────────────────┤
│                         LAYOUT LAYER                                │
│                                                                     │
│  ┌─────────────────────────────┐  ┌──────────────────────────────┐ │
│  │       App Shell             │  │       Side Menu              │ │
│  │   (IonApp + IonRouterOutlet)│  │   (IonMenu + Navigation)    │ │
│  └─────────────────────────────┘  └──────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                         SHARED LAYER                                │
│                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐  │
│  │ Components │ │   Pipes    │ │ Directives │ │    Utils        │  │
│  │ (Loading,  │ │ (Currency, │ │ (Feature   │ │ (Date, String,  │  │
│  │  Error,    │ │  Cyrillic) │ │   Flag)    │ │  Validation)    │  │
│  │  Confirm)  │ │            │ │            │ │                 │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Models / Interfaces                       │   │
│  │  Device, User, Intervention, Setup, Servicer, Config...     │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                      STATE MANAGEMENT LAYER                         │
│                        (NgRx SignalStore)                           │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │  Auth    │ │  Config  │ │  Tenant  │ │   Cart   │             │
│  │  Store   │ │  Store   │ │  Store   │ │  Store   │             │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
├─────────────────────────────────────────────────────────────────────┤
│                          CORE LAYER                                 │
│                   (Singleton servisi, providedIn: 'root')          │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │  Auth    │ │  Config  │ │  Tenant  │ │  Theme   │             │
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │             │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │  i18n    │ │  Logger  │ │  Report  │ │  Guards  │             │
│  │ Service  │ │ Service  │ │ Service  │ │ (Auth,   │             │
│  │          │ │          │ │ (PDF)    │ │  Feature)│             │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
├─────────────────────────────────────────────────────────────────────┤
│                       DATA ACCESS LAYER                             │
│                     (Firebase Native Plugins)                       │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│  │  Firestore   │ │   Storage    │ │     Auth     │              │
│  │  Service     │ │   Service    │ │   Service    │              │
│  │  (CRUD ops)  │ │  (Files)     │ │  (Firebase)  │              │
│  └──────────────┘ └──────────────┘ └──────────────┘              │
│  ┌──────────────┐ ┌──────────────┐                                │
│  │  App Check   │ │  Analytics   │                                │
│  │  Service     │ │  Service     │                                │
│  └──────────────┘ └──────────────┘                                │
├─────────────────────────────────────────────────────────────────────┤
│                      PLATFORM LAYER                                 │
│                       (Capacitor 8)                                 │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Native Bridge (iOS / Android / Web)                         │  │
│  │                                                               │  │
│  │  @capacitor-firebase/* │ @capacitor/filesystem               │  │
│  │  @capacitor/preferences │ @capacitor/browser                 │  │
│  │  @capawesome/barcode-scanning │ @capacitor/share             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Objašnjenje slojeva

| Sloj | Odgovornost | Pravilo zavisnosti |
|---|---|---|
| **Presentation** | UI stranice, korisničke interakcije | Može koristiti Shared, State, Core |
| **Layout** | App shell, meni, navigacioni okvir | Može koristiti Core |
| **Shared** | Ponovo upotrebljive komponente, pipe-ovi, modeli | Ne zavisi od Feature ili Core servisa |
| **State Management** | Centralno stanje aplikacije (SignalStore) | Može koristiti Core servise |
| **Core** | Singleton servisi, biznis logika | Može koristiti Data Access |
| **Data Access** | Firebase komunikacija, CRUD operacije | Može koristiti samo Platform |
| **Platform** | Capacitor native bridge | Najniži sloj |

**Pravilo: Zavisnosti teku samo NADOLE. Niži sloj nikada ne uvozi iz višeg.**

---

## 3. Tok pokretanja aplikacije

```
┌──────────────────────────────────────────────────────────────┐
│                    APP STARTUP FLOW                           │
└──────────────────────────────────────────────────────────────┘

        ┌─────────────┐
        │  App Start   │
        │  (main.ts)   │
        └──────┬───────┘
               │
               ▼
        ┌─────────────────┐
        │ APP_INITIALIZER  │
        │ (app.init.ts)    │
        └──────┬──────────┘
               │
               ▼
        ┌─────────────────┐
        │ 1. Initialize   │
        │    Firebase      │
        │    (native SDK)  │
        └──────┬──────────┘
               │
               ▼
        ┌─────────────────┐
        │ 2. Initialize   │
        │    App Check     │
        │    (attestation) │
        └──────┬──────────┘
               │
               ▼
        ┌─────────────────┐
        │ 3. Initialize   │
        │    Logger        │
        └──────┬──────────┘
               │
               ▼
        ┌─────────────────────────────────────────────┐
        │ 4. Listen for Auth State Change             │
        │    (Firebase native SDK automatski          │
        │     obnavlja sesiju iz Keychain/Android     │
        │     encrypted storage - BEZ Preferences)    │
        └──────┬──────────────────────────┬───────────┘
               │ (user authenticated)      │ (no user / session expired)
               ▼                           │
        ┌──────────────────┐               │
        │ 5. Resolve tenant│               │
        │    from Auth     │               │
        │    Custom Claims │               │
        │    (BEZ mrežnog  │               │
        │     poziva!)     │               │
        └──────┬───────────┘               │
               │                           │
               ▼                           │
        ┌──────────────────┐               │
        │ 6. Load config   │               │
        │    (see Config   │               │
        │     Flow below)  │               │
        └──────┬───────────┘               │
               │                           │
               ▼                           │
        ┌──────────────────┐               │
        │ 7. Apply theme   │               │
        │    from config   │               │
        └──────┬───────────┘               │
               │                           │
               ▼                           │
        ┌──────────────────┐               │
        │ 8. Load i18n     │               │
        │    (Preferences  │               │
        │     saved lang   │               │
        │     → fallback   │               │
        │     config def.) │               │
        └──────┬───────────┘               │
               │                           │
               ▼                           ▼
        ┌──────────────┐       ┌──────────────────┐
        │ Navigate to  │       │  Navigate to     │
        │ /home        │       │  /login          │
        └──────────────┘       └──────────────────┘
```

### Ključna razlika: Nema ručnog čuvanja auth sesije

Firebase native SDK (`@capacitor-firebase/authentication`) **automatski** upravlja sesijom:
- **iOS**: Čuva tokene u Keychain
- **Android**: Čuva tokene u Encrypted SharedPreferences

Ne koristimo `@capacitor/preferences` za auth stanje ni za tenantId. Tok je:
1. Firebase SDK se inicijalizuje → automatski obnavlja poslednju sesiju
2. `authStateChange` event se emituje → dobijamo korisnika (ili null)
3. Iz auth tokena čitamo Custom Claims → `tenantId`, `role`, `servicerId`
4. Sve se dešava lokalno, **bez mrežnog poziva** ka Firestore-u

### Config Loading Flow (detalj koraka 7)

```
        ┌─────────────────────┐
        │  Start Config Load  │
        └──────┬──────────────┘
               │
               ▼
        ┌─────────────────────┐
        │ Read local config   │
        │ from Preferences    │
        │ (localVersion,      │
        │  localConfig)       │
        └──────┬──────────────┘
               │
               ▼
        ┌─────────────────────────┐
        │ Fetch ONLY configVersion│
        │ field from Firestore    │
        │ (lightweight read)      │
        └──────┬──────────────────┘
               │
               ▼
        ┌──────────────────────┐
        │ localVersion ===     │
        │ remoteVersion ?      │
        └──┬───────────────┬───┘
           │ DA            │ NE
           ▼               ▼
   ┌───────────────┐  ┌───────────────────┐
   │ Use local     │  │ Fetch FULL config │
   │ config        │  │ from Firestore    │
   │ (no network)  │  └──────┬────────────┘
   └───────┬───────┘         │
           │                 ▼
           │          ┌───────────────────┐
           │          │ Save to local     │
           │          │ Preferences       │
           │          │ (config + version)│
           │          └──────┬────────────┘
           │                 │
           ▼                 ▼
        ┌─────────────────────┐
        │ Parse config:       │
        │ - Feature flags     │
        │ - Theme settings    │
        │ - Localization      │
        │ → Update ConfigStore│
        └─────────────────────┘
```

---

## 4. Core Layer

Core layer sadrži singleton servise koji su dostupni u celoj aplikaciji kroz `providedIn: 'root'`. Nijedan Core servis ne sme imati zavisnost na Feature layer.

### Pregled Core servisa

```
core/
├── auth/
│   ├── auth.service.ts          # Firebase autentifikacija
│   ├── auth.guard.ts            # CanActivate - zaštita ruta
│   └── auth.model.ts            # AuthUser, AuthState interfejsi
│
├── config/
│   ├── config.service.ts        # Učitavanje/čuvanje konfiguracije
│   ├── config.store.ts          # NgRx SignalStore za config state
│   ├── config.model.ts          # AppConfig, FeatureFlags, ThemeConfig
│   └── feature.guard.ts         # CanMatch guard za feature flags
│
├── tenant/
│   ├── tenant.service.ts        # Upravljanje tenant kontekstom
│   ├── tenant.store.ts          # NgRx SignalStore za tenant state
│   └── tenant.model.ts          # Tenant, TenantId interfejsi
│
├── firebase/
│   ├── firebase-init.service.ts # Inicijalizacija Firebase native SDK
│   ├── firestore.service.ts     # Generički CRUD wrapper za Firestore
│   ├── storage.service.ts       # Firebase Storage operacije
│   ├── app-check.service.ts     # App Check inicijalizacija i tokeni
│   └── analytics.service.ts     # Firebase Analytics wrapper
│
├── i18n/
│   ├── i18n.service.ts          # Wrapper oko Transloco-a
│   └── transloco-loader.ts      # Custom loader za prevode
│
├── logger/
│   ├── logger.service.ts        # Centralizovano logovanje
│   ├── logger.model.ts          # LogLevel, LogEntry interfejsi
│   └── log-transport.ts         # Interfejs za transport (console, firestore...)
│
├── theme/
│   ├── theme.service.ts         # Primena tema (CSS varijable)
│   └── theme.model.ts           # ThemeConfig interfejs
│
├── report/
│   ├── report.service.ts        # PDF generisanje sa pdfmake
│   └── report-templates/        # Šabloni za izveštaje
│       ├── commissioning.template.ts
│       ├── intervention.template.ts
│       ├── warranty.template.ts
│       └── servicer-history.template.ts
│
└── initializer/
    └── app-initializer.ts       # APP_INITIALIZER factory funkcija
```

---

## 5. Konfiguracioni sistem

### Config model (config.model.ts)

```typescript
// Glavni konfiguracioni interfejs
export interface AppConfig {
  version: number;
  features: FeatureFlags;
  theme: ThemeConfig;
  localization: LocalizationConfig;
  business: BusinessConfig;
}

// Feature flags - svaki feature koji se može uključiti/isključiti
export interface FeatureFlags {
  commissioning: boolean;
  warrantyExtension: boolean;
  interventionInWarranty: boolean;
  interventionOutWarranty: boolean;
  spareParts: boolean;
  cart: boolean;
  documentation: boolean;
  searchByDevice: boolean;
  bugReport: boolean;
  pdfReports: boolean;
  emailOrders: boolean;
}

// Konfiguracija izgleda
export interface ThemeConfig {
  primaryColor: string;       // hex, npr. '#B71C1C'
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;            // URL ka logu u Firebase Storage
  appTitle: string;           // Naziv aplikacije u header-u
  menuHeaderBackground: string;
}

// Konfiguracija lokalizacije
export interface LocalizationConfig {
  defaultLanguage: string;         // 'sr', 'en', 'mk'
  supportedLanguages: string[];
}

// Poslovna konfiguracija
export interface BusinessConfig {
  maxPartsPerIntervention: number;
  // ... ostali poslovni parametri
}
```

### Config Store (config.store.ts) - NgRx SignalStore

```typescript
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';

export interface ConfigState {
  config: AppConfig | null;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: ConfigState = {
  config: null,
  isLoaded: false,
  isLoading: false,
  error: null,
};

export const ConfigStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((store) => ({
    features: computed(() => store.config()?.features ?? getDefaultFeatures()),
    theme: computed(() => store.config()?.theme ?? getDefaultTheme()),
    localization: computed(() => store.config()?.localization),
  })),

  withMethods((store, configService = inject(ConfigService)) => ({
    isFeatureEnabled(featureName: keyof FeatureFlags): boolean {
      return store.features()?.[featureName] ?? false;
    },

    async loadConfig(tenantId: string): Promise<void> {
      patchState(store, { isLoading: true });
      try {
        const config = await configService.loadConfig(tenantId);
        patchState(store, { config, isLoaded: true, isLoading: false });
      } catch (error) {
        patchState(store, { error: String(error), isLoading: false });
      }
    },
  }))
);
```

### Config Service (config.service.ts)

```typescript
// Odgovornosti:
// 1. Čita lokalnu konfiguraciju iz Capacitor Preferences
// 2. Poredi verzije sa Firestore-om
// 3. Downloaduje novu konfiguraciju ako je potrebno
// 4. Čuva konfiguraciju lokalno

@Injectable({ providedIn: 'root' })
export class ConfigService {
  async loadConfig(tenantId: string): Promise<AppConfig> {
    const localConfig = await this.getLocalConfig(tenantId);
    const remoteVersion = await this.getRemoteConfigVersion(tenantId);

    if (localConfig && localConfig.version === remoteVersion) {
      return localConfig; // Koristi lokalnu - bez mrežnog poziva
    }

    const remoteConfig = await this.fetchFullConfig(tenantId);
    await this.saveLocalConfig(tenantId, remoteConfig);
    return remoteConfig;
  }

  private async getLocalConfig(tenantId: string): Promise<AppConfig | null> {
    // Čita iz Capacitor Preferences
  }

  private async getRemoteConfigVersion(tenantId: string): Promise<number> {
    // Čita SAMO version polje iz Firestore - minimalan mrežni poziv
  }

  private async fetchFullConfig(tenantId: string): Promise<AppConfig> {
    // Čita ceo config dokument iz Firestore
  }

  private async saveLocalConfig(tenantId: string, config: AppConfig): Promise<void> {
    // Čuva u Capacitor Preferences kao JSON string
  }
}
```

### Kako config utiče na aplikaciju - dijagram

```
┌───────────────────────────────────────────────────────────┐
│                      AppConfig                             │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ FeatureFlags │  │ ThemeConfig  │  │ Localization   │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                 │                   │           │
└─────────┼─────────────────┼───────────────────┼───────────┘
          │                 │                   │
          ▼                 ▼                   ▼
  ┌───────────────┐ ┌───────────────┐ ┌─────────────────┐
  │ Feature Guard │ │ Theme Service │ │  i18n Service   │
  │               │ │               │ │                 │
  │ Kontroliše    │ │ Postavlja CSS │ │ Učitava prevode │
  │ koje rute su  │ │ varijable na  │ │ za izabrani     │
  │ dostupne      │ │ :root element │ │ jezik           │
  └───────┬───────┘ └───────┬───────┘ └────────┬────────┘
          │                 │                   │
          ▼                 ▼                   ▼
  ┌───────────────┐ ┌───────────────┐ ┌─────────────────┐
  │ Router:       │ │ UI:           │ │ UI:             │
  │ Dozvoli/blokiraj│ │ Boje, logo, │ │ Tekstovi na     │
  │ lazy loading  │ │ naslovi       │ │ ispravnom jeziku │
  │ stranica      │ │               │ │                 │
  └───────────────┘ └───────────────┘ └─────────────────┘
```

---

## 6. Multi-Tenant dizajn

### Pristup: Jedan Firebase projekat sa logičkom separacijom

Svi podaci su razdvojeni po tenant ID-u u Firestore kolekcijama. **Nema globalne `userProfiles` kolekcije.** Tenant ID se čuva isključivo kao **Firebase Auth Custom Claim** i čita se iz auth tokena.

### Zašto Custom Claims umesto globalne kolekcije?

- **Nema extra Firestore čitanja** pri pokretanju app-a (tenantId je deo auth tokena)
- **Server-side verifikacija** - Custom Claims su potpisani od strane Firebase-a, ne mogu se falsifikovati
- **Potpuna tenant izolacija** - nema kolekcije koja "probija" granice tenanta
- **Custom Claims limit**: 1000 bajta - za `tenantId` + `role` više nego dovoljno

Custom Claims se postavljaju **server-side** (Cloud Function ili Admin SDK):
```typescript
// Cloud Function - prilikom kreiranja ili ažuriranja korisnika
admin.auth().setCustomUserClaims(uid, {
  tenantId: 'SR',
  role: 'servicer',
  servicerId: 'servicer-doc-id'  // referenca ka servicer dokumentu
});
```

### Dijagram toka podataka

```
┌─────────────────────────────────────────────────────────┐
│                    FIRESTORE DATABASE                     │
│                                                          │
│  tenants/                                                │
│  ├── SR/                  ◄── Tenant: Srbija            │
│  │   ├── (config doc)                                    │
│  │   ├── devices/                                        │
│  │   ├── users/                                          │
│  │   ├── interventions/                                  │
│  │   ├── servicers/       ◄── Servicer profili           │
│  │   ├── partGroups/                                     │
│  │   ├── parts/                                          │
│  │   ├── exchangeRates/                                  │
│  │   └── appErrors/                                      │
│  │                                                       │
│  ├── NS/                  ◄── Tenant: Novi Sad           │
│  │   ├── (config doc)                                    │
│  │   ├── devices/                                        │
│  │   └── ...                                             │
│  │                                                       │
│  ├── MK/                  ◄── Tenant: Makedonija         │
│  │   └── ...                                             │
│  │                                                       │
│  └── MKB/                 ◄── Tenant: MK Boilers         │
│      └── ...                                             │
│                                                          │
│  NEMA globalne userProfiles kolekcije!                   │
│  tenantId + role + servicerId → Firebase Auth Custom     │
│  Claims (deo auth tokena)                                │
└─────────────────────────────────────────────────────────┘
```

### Tenant Resolver (tenant.service.ts)

Tenant resolver čita `tenantId` direktno iz Firebase Auth tokena (Custom Claims). Ne postoji Firestore upit - sve je u tokenu.

```typescript
// Odgovornosti:
// 1. Čita tenantId iz Firebase Auth Custom Claims (auth token)
// 2. Pruža baznu putanju za sve Firestore upite
// 3. Ne vrši nikakav mrežni poziv - sve je lokalno iz tokena

@Injectable({ providedIn: 'root' })
export class TenantService {
  private tenantId = signal<string | null>(null);

  // Poziva se jednom nakon uspešne autentifikacije
  async resolveFromAuthToken(): Promise<void> {
    const result = await FirebaseAuthentication.getIdToken({ forceRefresh: false });
    // getIdTokenResult daje decoded token sa custom claims
    const tokenResult = await FirebaseAuthentication.getIdTokenResult();
    this.tenantId.set(tokenResult.claims.tenantId);
  }

  // Vraća baznu putanju za sve Firestore operacije
  getCollectionPath(collection: string): string {
    const tid = this.tenantId();
    if (!tid) throw new Error('Tenant not resolved');
    return `tenants/${tid}/${collection}`;
  }

  getCurrentTenantId(): string {
    const tid = this.tenantId();
    if (!tid) throw new Error('Tenant not resolved');
    return tid;
  }
}
```

### Kako tenant utiče na Firestore upite

```
                    ┌─────────────────────┐
                    │  Firebase Auth Token │
                    │  Custom Claims:      │
                    │   tenantId: "SR"     │
                    │   role: "servicer"   │
                    │   servicerId: "abc"  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  TenantService      │
                    │  (Tenant Resolver)  │
                    │                     │
                    │  resolveFromToken() │
                    │  getCollectionPath()│
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌──────────────┐  ┌────────────┐  ┌──────────────┐
     │ Device       │  │ User       │  │ Intervention │
     │ Service      │  │ Service    │  │ Service      │
     └──────┬───────┘  └─────┬──────┘  └──────┬───────┘
            │                │                 │
            ▼                ▼                 ▼
  tenants/{tid}/     tenants/{tid}/   tenants/{tid}/
   devices/{id}       users/{id}      interventions/{id}
```

Svaki servis koji pristupa Firestore-u **mora** koristiti `TenantService.getCollectionPath()` umesto hardkodiranih putanja. Ovo garantuje izolaciju podataka između tenanta.

---

## 7. Feature Flags i Guards

### Feature Guard (feature.guard.ts)

```typescript
// Factory funkcija koja kreira CanMatch guard za specifičan feature
export function featureGuard(featureName: keyof FeatureFlags): CanMatchFn {
  return () => {
    const configStore = inject(ConfigStore);
    const router = inject(Router);

    if (configStore.isFeatureEnabled(featureName)) {
      return true;
    }

    // Feature nije omogućen - preusmeri na home
    return router.createUrlTree(['/home']);
  };
}
```

### Primena u rutama

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: 'commissioning/:barcode',
    loadComponent: () => import('./features/service/commissioning/commissioning.page'),
    canMatch: [featureGuard('commissioning')],
  },
  {
    path: 'warranty-extension/:barcode',
    loadComponent: () => import('./features/service/warranty-extension/warranty-extension.page'),
    canMatch: [featureGuard('warrantyExtension')],
  },
  {
    path: 'cart',
    loadComponent: () => import('./features/cart/cart.page'),
    canMatch: [featureGuard('cart')],
  },
  // ... ostale rute
];
```

### Zašto `canMatch` umesto `canActivate`?

```
canActivate:
  1. Router matchuje rutu          ✓ (učitava lazy chunk)
  2. Učita lazy-loaded komponentu  ✓ (download JS bundle)
  3. Proveri guard                  ✗ (guard vrati false)
  → JS bundle je NEPOTREBNO učitan!

canMatch:
  1. Router pokušava da matchuje rutu
  2. Proveri guard                  ✗ (guard vrati false)
  3. Ruta se NE matchuje            → JS bundle se NE učitava
  → Efikasnije! Lazy chunk se nikada ne downloaduje.
```

### Feature Flag Directive (za sakrivanje UI elemenata)

```typescript
// Pored guard-a za rute, treba i direktiva za sakrivanje
// UI elemenata (dugmadi, menija) na osnovu feature flag-ova

@Directive({ selector: '[appFeatureFlag]', standalone: true })
export class FeatureFlagDirective {
  // Prikazuje ili sakriva element na osnovu feature flag-a
  // Koristi se u template-ima:
  // <ion-button *appFeatureFlag="'deviceManagement'">Scan</ion-button>
}
```

### Dijagram: Feature Flag uticaj na celu aplikaciju

```
┌─────────────────┐
│  Config Store   │
│  features()     │
└────────┬────────┘
         │
    ┌────┴────────────────────────────────────┐
    │                                          │
    ▼                                          ▼
┌──────────────────┐               ┌──────────────────────┐
│  Feature Guard   │               │  Feature Flag        │
│  (Router level)  │               │  Directive           │
│                  │               │  (Template level)    │
│  Blokira pristup │               │  Sakriva UI elemente │
│  celoj stranici  │               │  unutar stranica     │
└──────────────────┘               └──────────────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────┐               ┌──────────────────────┐
│  Ruta /cart      │               │  Home page:          │
│  se NE učitava   │               │  Dugme "Cart"        │
│  ako cart=false  │               │  se NE prikazuje     │
│                  │               │  ako cart=false       │
└──────────────────┘               └──────────────────────┘
```

---

## 8. Autentifikacija

### Auth Flow dijagram (prvi login)

```
┌─────────────┐
│ Login Page   │
│              │
│ Email: _____ │
│ Pass:  _____ │
│ [Login]      │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ AuthService.login()  │
│                      │
│ 1. FirebaseAuth      │
│    .signInWith       │
│    EmailAndPassword  │
│    (native plugin)   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 2. Read Custom       │
│    Claims from       │
│    Auth Token:       │
│                      │
│    → tenantId        │
│    → role            │
│    → servicerId      │
│                      │
│  (BEZ Firestore      │
│   čitanja!)          │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 3. Resolve tenant    │
│    TenantService     │
│    .resolveFromToken │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 4. Update stores:    │
│    AuthStore ← user  │
│    TenantStore ← tid │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 5. Load config       │
│    for tenant        │
│    (ConfigService)   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 6. Apply theme       │
│    Load translations │
│    (saved lang from  │
│     Preferences or   │
│     config default)  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 7. Navigate to /home │
└──────────────────────┘
```

### Auth Flow dijagram (app restart - automatska sesija)

```
┌─────────────────────┐
│ App Restart          │
│ (korisnik se nije   │
│  izlogovao)         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Firebase native SDK automatski      │
│ obnavlja sesiju iz:                 │
│  iOS: Keychain                      │
│  Android: Encrypted SharedPrefs     │
│                                     │
│ Nema mrežnog poziva za ovo!         │
└──────┬──────────────────────────────┘
       │
       ▼
┌──────────────────────┐
│ authStateChange      │
│ event → user != null │
│                      │
│ Custom Claims:       │
│  tenantId: "SR"      │
│  role: "servicer"    │
│  servicerId: "abc"   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Isti tok kao koraci  │
│ 3-7 iz prvog login-a│
│ (resolve tenant,     │
│  load config, theme, │
│  i18n, → /home)      │
└──────────────────────┘
```

### Auth Guard (auth.guard.ts)

```typescript
export const authGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
```

### Session Persistence - Firebase Native SDK

**Ne koristimo `@capacitor/preferences` za auth stanje.**

Firebase native SDK automatski upravlja sesijom:
- **iOS**: Tokeni se čuvaju u Keychain (siguran, šifrovan storage)
- **Android**: Tokeni se čuvaju u Encrypted SharedPreferences
- Prilikom pokretanja app: SDK automatski obnavlja sesiju
- `authStateChange` listener detektuje da li je korisnik ulogovan
- Iz obnovljenog tokena čitamo Custom Claims (tenantId, role, servicerId)
- **Jedini slučaj kad se koristi Preferences**: čuvanje korisnikove jezičke preferencije

---

## 9. Lokalizacija (i18n)

### Biblioteka: @jsverse/transloco

Transloco je runtime i18n biblioteka za Angular koja podržava:
- Dinamičko menjanje jezika bez ponovnog buildanja
- Lazy loading prevoda (učitava samo aktivni jezik)
- Standalone komponente
- Interpolacija, pluralizacija, ugneždeni ključevi

### Struktura prevoda

```
src/assets/i18n/
├── sr.json         # Srpski (default)
├── en.json         # Engleski
└── mk.json         # Makedonski
```

### Primer translation fajla (sr.json)

```json
{
  "common": {
    "save": "Sačuvaj",
    "cancel": "Otkaži",
    "delete": "Obriši",
    "search": "Pretraži",
    "loading": "Učitavanje..."
  },
  "login": {
    "title": "Prijava",
    "email": "Email adresa",
    "password": "Lozinka",
    "submit": "Prijavi se",
    "error": "Pogrešan email ili lozinka"
  },
  "home": {
    "scanBarcode": "Skeniraj barkod",
    "searchByUser": "Pretraga po korisniku",
    "searchByDevice": "Pretraga po uređaju"
  },
  "device": {
    "info": "Informacije o uređaju",
    "warranty": "Garancija",
    "history": "Istorija"
  }
}
```

### Kako se koristi u komponentama

```typescript
// U standalone komponenti
@Component({
  imports: [TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ t('home.scanBarcode') }}</ion-title>
        </ion-toolbar>
      </ion-header>
    </ng-container>
  `
})
```

### Čuvanje jezičke preferencije

Odabrani jezik se čuva u `@capacitor/preferences` kako korisnik ne bi morao svaki put da bira.

**Tok određivanja jezika:**
1. Proveri Preferences za ključ `selectedLanguage`
2. Ako postoji → koristi ga (korisnik je ranije izabrao)
3. Ako ne postoji → koristi `defaultLanguage` iz tenant config-a
4. Kada korisnik promeni jezik → sačuvaj u Preferences

```typescript
// U i18n.service.ts
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly LANG_KEY = 'selectedLanguage';

  async resolveLanguage(configDefault: string): Promise<string> {
    const { value } = await Preferences.get({ key: this.LANG_KEY });
    return value ?? configDefault;
  }

  async changeLanguage(lang: string): Promise<void> {
    await Preferences.set({ key: this.LANG_KEY, value: lang });
    this.translocoService.setActiveLang(lang);
  }
}
```

### Dijagram: Lokalizacija tok

```
                         ┌─────────────────────┐
                         │   App pokretanje     │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Preferences.get      │
                         │ ('selectedLanguage') │
                         └────┬────────────┬────┘
                              │            │
                         (postoji)    (ne postoji)
                              │            │
                              ▼            ▼
                    ┌──────────────┐ ┌──────────────────┐
                    │ Koristi      │ │ Koristi           │
                    │ sačuvani     │ │ config.localizat. │
                    │ lang         │ │ .defaultLanguage  │
                    └──────┬───────┘ └────────┬─────────┘
                           │                  │
                           └────────┬─────────┘
                                    │
                                    ▼
                         ┌──────────────────┐     ┌──────────────────┐
                         │  Transloco       │     │  assets/i18n/    │
                         │  Service         │────▶│  sr.json         │
                         │                  │     │  en.json         │
                         │  setActiveLang() │     │  mk.json         │
                         │  translate()     │     └──────────────────┘
                         └────────┬─────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ Template │ │ Template │ │ Service  │
              │ direktiva│ │ pipe     │ │ inject   │
              │ *transloco│ │ | trans. │ │ translate│
              └──────────┘ └──────────┘ └──────────┘

                    Korisnik menja jezik
                           │
                           ▼
                  ┌────────────────────┐
                  │ Preferences.set    │
                  │ ('selectedLanguage',│
                  │  'en')             │
                  │                    │
                  │ + Transloco        │
                  │   .setActiveLang() │
                  └────────────────────┘
```

---

## 10. Logging sistem

### Logger Service dizajn

Logger je dizajniran sa **transport pattern-om** - odvaja logiku logovanja od destinacije logova. Trenutno loguje samo u konzolu, ali je predviđen prostor za slanje u Firestore ili bilo koji drugi backend.

```
┌──────────────────────────────────────────────────────┐
│                    LoggerService                      │
│                                                       │
│  debug(msg, context?)                                │
│  info(msg, context?)                                 │
│  warn(msg, context?)                                 │
│  error(msg, context?)                                │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │            LogTransport[]                        │ │
│  │                                                  │ │
│  │  ┌─────────────────┐  ┌──────────────────────┐  │ │
│  │  │ Console         │  │ Firestore            │  │ │
│  │  │ Transport       │  │ Transport            │  │ │
│  │  │ (aktivno)       │  │ (BUDUĆNOST -         │  │ │
│  │  │                 │  │  predviđen prostor)  │  │ │
│  │  │ console.log()   │  │  batch write to DB   │  │ │
│  │  │ console.warn()  │  │                      │  │ │
│  │  │ console.error() │  │                      │  │ │
│  │  └─────────────────┘  └──────────────────────┘  │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Logger modeli (logger.model.ts)

```typescript
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: Date;
  tenantId?: string;
  userId?: string;
}

// Transport interfejs - svaki transport implementira ovo
export interface LogTransport {
  log(entry: LogEntry): void | Promise<void>;
}
```

### Kako dodati Firestore transport u budućnosti

```typescript
// Kada budeš spreman, samo implementiraj LogTransport:
export class FirestoreLogTransport implements LogTransport {
  private buffer: LogEntry[] = [];
  private readonly FLUSH_INTERVAL = 30000; // 30 sec
  private readonly BUFFER_SIZE = 50;

  async log(entry: LogEntry): Promise<void> {
    this.buffer.push(entry);
    if (this.buffer.length >= this.BUFFER_SIZE) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    // Batch write u Firestore
    // tenants/{tenantId}/logs/{logId}
  }
}

// I registruj ga u LoggerService:
// this.transports.push(new FirestoreLogTransport());
```

---

## 11. Tema i izgled (Theming)

### Kako Ionic koristi CSS varijable

Ionic se u potpunosti oslanja na CSS custom properties (varijable). Menjajući vrednosti na `:root` elementu, menjamo izgled cele aplikacije.

### Theme Service (theme.service.ts)

```typescript
@Injectable({ providedIn: 'root' })
export class ThemeService {
  applyTheme(theme: ThemeConfig): void {
    const root = document.documentElement;

    // Primarne boje
    root.style.setProperty('--ion-color-primary', theme.primaryColor);
    root.style.setProperty('--ion-color-primary-rgb', this.hexToRgb(theme.primaryColor));
    root.style.setProperty('--ion-color-primary-contrast', this.getContrast(theme.primaryColor));
    root.style.setProperty('--ion-color-primary-shade', this.shade(theme.primaryColor));
    root.style.setProperty('--ion-color-primary-tint', this.tint(theme.primaryColor));

    // Sekundarne boje
    root.style.setProperty('--ion-color-secondary', theme.secondaryColor);
    // ... kontrast, shade, tint

    // Accent boje
    root.style.setProperty('--ion-color-tertiary', theme.accentColor);
    // ... kontrast, shade, tint

    // Custom varijable za app-specifične stvari
    root.style.setProperty('--app-menu-header-bg', theme.menuHeaderBackground);
  }

  // Logo se učitava sa URL-a iz config-a
  // i čuva lokalno za offline pristup
}
```

### Dijagram: Tema sistem

```
┌──────────────────┐
│ Firestore Config │
│                  │
│ theme: {         │
│  primaryColor:   │
│    "#B71C1C"     │
│  secondaryColor: │
│    "#1565C0"     │
│  logoUrl: "..."  │
│  appTitle:       │
│   "Ariston SRB"  │
│ }                │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  ThemeService    │
│  .applyTheme()   │
└────────┬─────────┘
         │
    ┌────┴──────────────────────────────────────┐
    │                                            │
    ▼                                            ▼
┌──────────────────────┐          ┌──────────────────────────┐
│ CSS Variables na     │          │ Dinamički sadržaj        │
│ :root elementu       │          │                          │
│                      │          │ logo   → <img [src]="">  │
│ --ion-color-primary  │          │ title  → {{ appTitle }}  │
│ --ion-color-secondary│          │                          │
│ --ion-color-tertiary │          │                          │
│ --app-menu-header-bg │          │                          │
└──────────┬───────────┘          └──────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────┐
│  Ionic komponente automatski koriste         │
│  --ion-color-primary za dugmad, toolbar...   │
│  --ion-color-secondary za sekundarne akcije  │
│                                              │
│  Nema potrebe za ručnim stilizovanjem!       │
│  Ionic se sam prilagođava.                   │
└──────────────────────────────────────────────┘
```

---

## 12. State Management

### Pregled svih Store-ova

```
┌──────────────────────────────────────────────────────────┐
│                  NgRx SignalStore Layer                    │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐ │
│  │  AuthStore  │  │ ConfigStore │  │  TenantStore     │ │
│  │             │  │             │  │  (resolved from  │ │
│  │ user()      │  │ config()    │  │   Auth Custom    │ │
│  │ servicer()  │  │ features()  │  │   Claims)        │ │
│  │ isAuth()    │  │ theme()     │  │                  │ │
│  │ role()      │  │ isLoaded()  │  │ tenantId()       │ │
│  │             │  │             │  │ servicerId()     │ │
│  │ login()     │  │ loadConfig()│  │ collectionPath() │ │
│  │ logout()    │  │ isEnabled() │  │                  │ │
│  └─────────────┘  └─────────────┘  └──────────────────┘ │
│                                                           │
│  ┌─────────────┐                                         │
│  │  CartStore  │                                         │
│  │             │                                         │
│  │ items()     │                                         │
│  │ total()     │                                         │
│  │ count()     │                                         │
│  │             │                                         │
│  │ addItem()   │                                         │
│  │ removeItem()│                                         │
│  │ clear()     │                                         │
│  └─────────────┘                                         │
└──────────────────────────────────────────────────────────┘
```

### Zašto nemamo store za Device, User, Intervention?

Podaci o uređajima, korisnicima i intervencijama su **transakcioni** - učitavaju se po potrebi za konkretnu stranicu i ne moraju da budu globalno dostupni. Za njih koristimo **obične Angular servise** sa signalima ili Observable-ima u okviru Feature layer-a.

Store-ovi su rezervisani za **globalno stanje** koje se koristi na više mesta u aplikaciji:
- Auth state → koristi se u guardima, meniju, svim servisima
- Config state → koristi se u guardima, temi, feature flag-ovima
- Tenant state → koristi se u svim Firestore upitima
- Cart state → koristi se na više stranica (parts, cart, checkout)

---

## 13. Data Access Layer

### Firestore Service (firestore.service.ts)

Generički wrapper oko `@capacitor-firebase/firestore` koji automatski dodaje tenant prefiks.

```typescript
@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private tenantService = inject(TenantService);

  // Generički CRUD operacije sa automatskim tenant prefiksom

  async getDocument<T>(collection: string, docId: string): Promise<T | null> {
    const path = this.tenantService.getCollectionPath(collection);
    // koristi @capacitor-firebase/firestore
    const result = await FirebaseFirestore.getDocument({
      reference: `${path}/${docId}`,
    });
    return result.snapshot?.data as T ?? null;
  }

  async getCollection<T>(collection: string, filters?: QueryFilter[]): Promise<T[]> {
    const path = this.tenantService.getCollectionPath(collection);
    // koristi @capacitor-firebase/firestore sa filterima
  }

  async addDocument<T>(collection: string, data: T): Promise<string> {
    const path = this.tenantService.getCollectionPath(collection);
    // dodaje dokument u kolekciju
  }

  async updateDocument(collection: string, docId: string, data: Partial<unknown>): Promise<void> {
    // ažurira dokument
  }

  // Svi upiti prolaze kroz tenant kontekst
  // Nema globalnih kolekcija - tenantId + role dolaze iz Auth Custom Claims
}
```

### Dijagram: Data Access tok

```
┌──────────────────┐
│  Feature Service │  npr. DeviceService.getDevice(barcode)
│  (biznis logika) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ FirestoreService │  getDocument<Device>('devices', barcode)
│ (generički CRUD) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  TenantService   │  getCollectionPath('devices')
│  (putanja)       │  → "tenants/SR/devices"
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│  @capacitor-firebase/        │  getDocument({ reference:
│  firestore                   │    "tenants/SR/devices/{barcode}" })
│  (native plugin)             │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Firebase Firestore          │
│  (cloud database)            │
└──────────────────────────────┘
```

---

## 14. Shared Layer

Shared layer sadrži ponovo upotrebljive elemente koji nemaju zavisnosti na Core ili Feature slojeve.

### Struktura

```
shared/
├── components/                  # Ponovo upotrebljive UI komponente
│   ├── loading-spinner/
│   │   ├── loading-spinner.component.ts
│   │   └── loading-spinner.component.html
│   ├── error-display/
│   │   ├── error-display.component.ts
│   │   └── error-display.component.html
│   ├── confirm-dialog/
│   │   ├── confirm-dialog.component.ts
│   │   └── confirm-dialog.component.html
│   └── empty-state/
│       ├── empty-state.component.ts
│       └── empty-state.component.html
│
├── pipes/
│   ├── currency-format.pipe.ts     # Formatiranje cena sa deviznim kursom
│   └── cyrillic-latin.pipe.ts      # Konverzija ćirilica ↔ latinica
│
├── directives/
│   └── feature-flag.directive.ts   # *appFeatureFlag strukturna direktiva
│
├── models/                         # Interfejsi i tipovi za podatke
│   ├── device.model.ts
│   ├── user.model.ts
│   ├── intervention.model.ts
│   ├── setup.model.ts
│   ├── servicer.model.ts
│   ├── part.model.ts
│   ├── part-group.model.ts
│   └── error-code.model.ts
│
└── utils/                          # Pure funkcije (bez zavisnosti)
    ├── date.utils.ts               # Formatiranje datuma, kalkulacije
    ├── string.utils.ts             # Cyrillic/Latin konverzija, sanitizacija
    ├── warranty.utils.ts           # Kalkulacija garancije (čista logika)
    └── validation.utils.ts         # Validaciona pravila za forme
```

### Važno pravilo za Shared Layer

```
┌───────────────────────────────────────────────────────┐
│                    DOZVOLJENO                          │
│                                                        │
│  Shared komponenta MOŽE uvoziti:                      │
│  ✓ Druge Shared komponente                            │
│  ✓ Angular/Ionic komponente                           │
│  ✓ Third-party biblioteke (transloco, pdfmake...)     │
│                                                        │
│  Shared komponenta NE SME uvoziti:                    │
│  ✗ Core servise (AuthService, ConfigService...)       │
│  ✗ Feature komponente                                 │
│  ✗ State Store-ove                                    │
│                                                        │
│  Izuzetak: FeatureFlagDirective uvozi ConfigStore     │
│  jer je to njena jedina svrha. Ovo je prihvatljivo    │
│  jer je direktiva "most" između config-a i UI-a.      │
└───────────────────────────────────────────────────────┘
```

---

## 15. Features Layer

Svaka feature je grupisana po poslovnom domenu i sadrži lazy-loaded standalone stranice.

### Organizacija po domenu

```
features/
├── auth/                           # Autentifikacija
│   └── login/
│       ├── login.page.ts
│       ├── login.page.html
│       └── login.page.scss
│
├── home/                           # Glavna stranica
│   ├── home.page.ts
│   ├── home.page.html
│   └── home.page.scss
│
├── device/                         # Sve vezano za uređaje
│   ├── services/
│   │   └── device.service.ts       # Biznis logika za uređaje
│   ├── device-info/
│   │   ├── device-info.page.ts
│   │   ├── device-info.page.html
│   │   └── device-info.page.scss
│   ├── device-history/
│   │   ├── device-history.page.ts
│   │   ├── device-history.page.html
│   │   └── device-history.page.scss
│   ├── part-groups/
│   │   ├── part-groups.page.ts
│   │   ├── part-groups.page.html
│   │   └── part-groups.page.scss
│   └── device-parts/
│       ├── device-parts.page.ts
│       ├── device-parts.page.html
│       └── device-parts.page.scss
│
├── service/                        # Servisne intervencije
│   ├── services/
│   │   └── intervention.service.ts # Biznis logika za intervencije
│   ├── shared/
│   │   ├── device-env-info/        # Modal za tehničke podatke
│   │   │   ├── device-env-info.component.ts
│   │   │   └── device-env-info.component.html
│   │   └── intervention-form/      # Zajednički form elementi
│   │       ├── intervention-form.component.ts
│   │       └── intervention-form.component.html
│   ├── commissioning/
│   │   ├── commissioning.page.ts
│   │   ├── commissioning.page.html
│   │   └── commissioning.page.scss
│   ├── warranty-extension/
│   │   ├── warranty-extension.page.ts
│   │   ├── warranty-extension.page.html
│   │   └── warranty-extension.page.scss
│   ├── intervention-in-warranty/
│   │   ├── intervention-in-warranty.page.ts
│   │   ├── intervention-in-warranty.page.html
│   │   └── intervention-in-warranty.page.scss
│   └── intervention-out-warranty/
│       ├── intervention-out-warranty.page.ts
│       ├── intervention-out-warranty.page.html
│       └── intervention-out-warranty.page.scss
│
├── search/                         # Pretraživanje
│   ├── services/
│   │   └── search.service.ts
│   ├── search-by-user/
│   │   ├── search-by-user.page.ts
│   │   ├── search-by-user.page.html
│   │   └── search-by-user.page.scss
│   └── search-by-name/
│       ├── search-by-name.page.ts
│       ├── search-by-name.page.html
│       └── search-by-name.page.scss
│
├── cart/                           # Korpa za rezervne delove
│   ├── cart.page.ts
│   ├── cart.page.html
│   └── cart.page.scss
│
├── docs/                           # Dokumentacija / manuali
│   ├── services/
│   │   └── docs.service.ts
│   ├── docs.page.ts
│   ├── docs.page.html
│   └── docs.page.scss
│
├── history/                        # Istorija servicera
│   ├── servicer-history.page.ts
│   ├── servicer-history.page.html
│   └── servicer-history.page.scss
│
└── bugs/                           # Prijava grešaka
    ├── bugs.page.ts
    ├── bugs.page.html
    └── bugs.page.scss
```

### Feature Service pattern

Svaki domen može imati svoj servis koji enkapsulira biznis logiku za taj domen. Feature servis koristi Core servise (FirestoreService, TenantService) ali ne zavisi od drugih Feature servisa.

```
┌──────────────────────────────────────────────────────────────┐
│                    Feature Layer pravila                      │
│                                                               │
│  ✓ Feature MOŽE koristiti: Core servise, Shared, Store-ove   │
│  ✓ Feature MOŽE imati sopstveni servis za biznis logiku       │
│  ✗ Feature NE SME uvoziti drugi Feature (osim shared/)        │
│  ✗ Feature NE SME direktno pozivati Firebase plugine          │
│    (uvek kroz Core Data Access Layer)                         │
└──────────────────────────────────────────────────────────────┘
```

### Dijagram zavisnosti feature-a

```
                    ┌─────────────────┐
                    │ commissioning   │
                    │ .page.ts        │
                    └────────┬────────┘
                             │ imports / inject
              ┌──────────────┼──────────────────┐
              │              │                  │
              ▼              ▼                  ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │ intervention │ │ Shared:      │ │ ConfigStore  │
     │ .service.ts  │ │ Device model │ │ (feature     │
     │ (feature     │ │ User model   │ │  flags)      │
     │  service)    │ │ Setup model  │ │              │
     └──────┬───────┘ └──────────────┘ └──────────────┘
            │
            ▼
     ┌──────────────┐
     │ Core:        │
     │ Firestore    │
     │ Service      │
     └──────────────┘
```

---

## 16. Struktura fajlova

### Kompletna struktura projekta

```
ariston-service/                        # Root projekta
│
├── src/
│   ├── main.ts                         # Bootstrap (bootstrapApplication)
│   ├── index.html
│   │
│   ├── app/
│   │   ├── app.component.ts            # Root komponenta (IonApp)
│   │   ├── app.component.html
│   │   ├── app.component.scss
│   │   ├── app.routes.ts               # Glavne rute aplikacije
│   │   │
│   │   ├── core/                       # === CORE LAYER ===
│   │   │   │
│   │   │   ├── auth/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.store.ts
│   │   │   │   ├── auth.guard.ts
│   │   │   │   └── auth.model.ts
│   │   │   │
│   │   │   ├── config/
│   │   │   │   ├── config.service.ts
│   │   │   │   ├── config.store.ts
│   │   │   │   ├── config.model.ts
│   │   │   │   └── feature.guard.ts
│   │   │   │
│   │   │   ├── tenant/
│   │   │   │   ├── tenant.service.ts
│   │   │   │   ├── tenant.store.ts
│   │   │   │   └── tenant.model.ts
│   │   │   │
│   │   │   ├── firebase/
│   │   │   │   ├── firebase-init.service.ts
│   │   │   │   ├── firestore.service.ts
│   │   │   │   ├── storage.service.ts
│   │   │   │   ├── app-check.service.ts
│   │   │   │   └── analytics.service.ts
│   │   │   │
│   │   │   ├── i18n/
│   │   │   │   ├── i18n.service.ts
│   │   │   │   └── transloco-loader.ts
│   │   │   │
│   │   │   ├── logger/
│   │   │   │   ├── logger.service.ts
│   │   │   │   ├── logger.model.ts
│   │   │   │   └── transports/
│   │   │   │       ├── console.transport.ts
│   │   │   │       └── firestore.transport.ts  # budućnost
│   │   │   │
│   │   │   ├── theme/
│   │   │   │   ├── theme.service.ts
│   │   │   │   └── theme.model.ts
│   │   │   │
│   │   │   ├── report/
│   │   │   │   ├── report.service.ts
│   │   │   │   └── templates/
│   │   │   │       ├── commissioning.template.ts
│   │   │   │       ├── intervention.template.ts
│   │   │   │       ├── warranty.template.ts
│   │   │   │       └── servicer-history.template.ts
│   │   │   │
│   │   │   └── initializer/
│   │   │       └── app-initializer.ts
│   │   │
│   │   ├── shared/                     # === SHARED LAYER ===
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── loading-spinner/
│   │   │   │   │   ├── loading-spinner.component.ts
│   │   │   │   │   └── loading-spinner.component.html
│   │   │   │   ├── error-display/
│   │   │   │   │   ├── error-display.component.ts
│   │   │   │   │   └── error-display.component.html
│   │   │   │   ├── confirm-dialog/
│   │   │   │   │   ├── confirm-dialog.component.ts
│   │   │   │   │   └── confirm-dialog.component.html
│   │   │   │   └── empty-state/
│   │   │   │       ├── empty-state.component.ts
│   │   │   │       └── empty-state.component.html
│   │   │   │
│   │   │   ├── pipes/
│   │   │   │   ├── currency-format.pipe.ts
│   │   │   │   └── cyrillic-latin.pipe.ts
│   │   │   │
│   │   │   ├── directives/
│   │   │   │   └── feature-flag.directive.ts
│   │   │   │
│   │   │   ├── models/
│   │   │   │   ├── device.model.ts
│   │   │   │   ├── user.model.ts
│   │   │   │   ├── intervention.model.ts
│   │   │   │   ├── setup.model.ts
│   │   │   │   ├── servicer.model.ts
│   │   │   │   ├── part.model.ts
│   │   │   │   ├── part-group.model.ts
│   │   │   │   └── error-code.model.ts
│   │   │   │
│   │   │   └── utils/
│   │   │       ├── date.utils.ts
│   │   │       ├── string.utils.ts
│   │   │       ├── warranty.utils.ts
│   │   │       └── validation.utils.ts
│   │   │
│   │   ├── layout/                     # === LAYOUT LAYER ===
│   │   │   ├── shell/
│   │   │   │   ├── shell.component.ts
│   │   │   │   ├── shell.component.html
│   │   │   │   └── shell.component.scss
│   │   │   └── menu/
│   │   │       ├── menu.component.ts
│   │   │       ├── menu.component.html
│   │   │       └── menu.component.scss
│   │   │
│   │   └── features/                   # === FEATURES LAYER ===
│   │       │
│   │       ├── auth/
│   │       │   └── login/
│   │       │       ├── login.page.ts
│   │       │       ├── login.page.html
│   │       │       └── login.page.scss
│   │       │
│   │       ├── home/
│   │       │   ├── home.page.ts
│   │       │   ├── home.page.html
│   │       │   └── home.page.scss
│   │       │
│   │       ├── device/
│   │       │   ├── services/
│   │       │   │   └── device.service.ts
│   │       │   ├── device-info/
│   │       │   │   ├── device-info.page.ts
│   │       │   │   ├── device-info.page.html
│   │       │   │   └── device-info.page.scss
│   │       │   ├── device-history/
│   │       │   │   ├── device-history.page.ts
│   │       │   │   ├── device-history.page.html
│   │       │   │   └── device-history.page.scss
│   │       │   ├── part-groups/
│   │       │   │   ├── part-groups.page.ts
│   │       │   │   ├── part-groups.page.html
│   │       │   │   └── part-groups.page.scss
│   │       │   └── device-parts/
│   │       │       ├── device-parts.page.ts
│   │       │       ├── device-parts.page.html
│   │       │       └── device-parts.page.scss
│   │       │
│   │       ├── service/
│   │       │   ├── services/
│   │       │   │   └── intervention.service.ts
│   │       │   ├── shared/
│   │       │   │   ├── device-env-info/
│   │       │   │   │   ├── device-env-info.component.ts
│   │       │   │   │   └── device-env-info.component.html
│   │       │   │   └── intervention-form/
│   │       │   │       ├── intervention-form.component.ts
│   │       │   │       └── intervention-form.component.html
│   │       │   ├── commissioning/
│   │       │   │   ├── commissioning.page.ts
│   │       │   │   ├── commissioning.page.html
│   │       │   │   └── commissioning.page.scss
│   │       │   ├── warranty-extension/
│   │       │   │   ├── warranty-extension.page.ts
│   │       │   │   ├── warranty-extension.page.html
│   │       │   │   └── warranty-extension.page.scss
│   │       │   ├── intervention-in-warranty/
│   │       │   │   ├── intervention-in-warranty.page.ts
│   │       │   │   ├── intervention-in-warranty.page.html
│   │       │   │   └── intervention-in-warranty.page.scss
│   │       │   └── intervention-out-warranty/
│   │       │       ├── intervention-out-warranty.page.ts
│   │       │       ├── intervention-out-warranty.page.html
│   │       │       └── intervention-out-warranty.page.scss
│   │       │
│   │       ├── search/
│   │       │   ├── services/
│   │       │   │   └── search.service.ts
│   │       │   ├── search-by-user/
│   │       │   │   ├── search-by-user.page.ts
│   │       │   │   ├── search-by-user.page.html
│   │       │   │   └── search-by-user.page.scss
│   │       │   └── search-by-name/
│   │       │       ├── search-by-name.page.ts
│   │       │       ├── search-by-name.page.html
│   │       │       └── search-by-name.page.scss
│   │       │
│   │       ├── cart/
│   │       │   ├── cart.page.ts
│   │       │   ├── cart.page.html
│   │       │   └── cart.page.scss
│   │       │
│   │       ├── docs/
│   │       │   ├── services/
│   │       │   │   └── docs.service.ts
│   │       │   ├── docs.page.ts
│   │       │   ├── docs.page.html
│   │       │   └── docs.page.scss
│   │       │
│   │       ├── history/
│   │       │   ├── servicer-history.page.ts
│   │       │   ├── servicer-history.page.html
│   │       │   └── servicer-history.page.scss
│   │       │
│   │       └── bugs/
│   │           ├── bugs.page.ts
│   │           ├── bugs.page.html
│   │           └── bugs.page.scss
│   │
│   ├── assets/
│   │   ├── i18n/                       # Fajlovi sa prevodima
│   │   │   ├── sr.json
│   │   │   ├── en.json
│   │   │   └── mk.json
│   │   ├── icon/
│   │   │   └── favicon.png
│   │   └── images/
│   │       └── default-logo.png        # Fallback logo
│   │
│   ├── environments/
│   │   ├── environment.ts              # Dev konfiguracija
│   │   └── environment.prod.ts         # Prod konfiguracija
│   │
│   ├── theme/
│   │   ├── variables.scss              # Ionic CSS varijable (defaults)
│   │   └── global.scss                 # Globalni stilovi
│   │
│   └── global.scss
│
├── android/                            # Capacitor Android projekat
│   ├── app/
│   │   └── google-services.json        # Firebase config za Android
│   └── ...
│
├── ios/                                # Capacitor iOS projekat
│   ├── App/
│   │   └── GoogleService-Info.plist    # Firebase config za iOS
│   └── ...
│
├── capacitor.config.ts                 # Capacitor konfiguracija
├── angular.json                        # Angular CLI konfiguracija
├── package.json
├── tsconfig.json
├── tsconfig.app.json
└── tsconfig.spec.json
```

---

## 17. Firestore model podataka

### Kompletna Firestore struktura

```
Firebase Firestore Database
│
│  NEMA userProfiles kolekcije!
│  tenantId, role, servicerId → Firebase Auth Custom Claims
│  Postavljaju se server-side (Cloud Function / Admin SDK):
│    admin.auth().setCustomUserClaims(uid, {
│      tenantId: "SR", role: "servicer", servicerId: "abc123"
│    });
│
├── tenants/
│   └── {tenantId}/                         # "SR", "NS", "MK", "MKB"
│       │
│       ├── (tenant document fields)
│       │   ├── config: {                   # === KONFIGURACIJA ===
│       │   │   ├── version: number
│       │   │   ├── features: {
│       │   │   │   ├── commissioning: boolean
│       │   │   │   ├── warrantyExtension: boolean
│       │   │   │   ├── interventionInWarranty: boolean
│       │   │   │   ├── cart: boolean
│       │   │   │   ├── documentation: boolean
│       │   │   │   ├── searchByDevice: boolean
│       │   │   │   ├── bugReport: boolean
│       │   │   │   ├── pdfReports: boolean
│       │   │   │   └── emailOrders: boolean
│       │   │   }
│       │   │   ├── theme: {
│       │   │   │   ├── primaryColor: "#B71C1C"
│       │   │   │   ├── secondaryColor: "#1565C0"
│       │   │   │   ├── accentColor: "#FFC107"
│       │   │   │   ├── logoUrl: "gs://bucket/logos/sr-logo.png"
│       │   │   │   ├── appTitle: "Ariston Servis"
│       │   │   │   └── menuHeaderBackground: "#B71C1C"
│       │   │   }
│       │   │   ├── localization: {
│       │   │   │   ├── defaultLanguage: "sr"
│       │   │   │   └── supportedLanguages: ["sr", "en"]
│       │   │   }
│       │   │   └── business: {
│       │   │       └── maxPartsPerIntervention: 4
│       │   │   }
│       │   }
│       │   └── name: string                # Ime tenanta
│       │
│       ├── devices/                        # === UREĐAJI ===
│       │   └── {barcode}/                  # 21-cifreni barkod
│       │       ├── code: string
│       │       ├── name: string
│       │       ├── type: string            # "heat_pump", "Gas_boiler"...
│       │       ├── subType: string
│       │       └── unitCount: number
│       │
│       ├── users/                          # === KORISNICI/KUPCI ===
│       │   └── {barcode}/                  # Ključ = barkod uređaja
│       │       ├── firstName: string
│       │       ├── lastName: string
│       │       ├── street: string
│       │       ├── homeNumber: string
│       │       ├── city: string
│       │       ├── postalCode: string
│       │       ├── phone: string
│       │       ├── connectedDeviceSN: string
│       │       ├── installerName: string
│       │       ├── installerPhoneNumber: string
│       │       ├── dateOfPurchase: timestamp
│       │       ├── lastWarrantyExtension: timestamp
│       │       ├── voidWarranty: boolean
│       │       ├── addedBy: string         # Servicer koji je dodao
│       │       └── additionType: string    # "COMMIS" | "NO_COMMIS"
│       │
│       ├── interventions/                  # === INTERVENCIJE ===
│       │   └── {interventionId}/
│       │       ├── barcode: string         # Za query po uređaju
│       │       ├── date: timestamp
│       │       ├── type: {
│       │       │   ├── name: string
│       │       │   └── code: string        # "A799001", "M799001"...
│       │       │ }
│       │       ├── servicer: string
│       │       ├── description: string
│       │       ├── notes: string
│       │       ├── errorCode: string
│       │       ├── distance: number
│       │       ├── parts: [                # Niz korišćenih delova
│       │       │   { name, code, quantity }
│       │       │ ]
│       │       └── setup: object           # Opcioni setup podaci
│       │
│       ├── servicers/                      # === SERVICERI ===
│       │   └── {servicerId}/
│       │       ├── email: string
│       │       ├── company: string
│       │       ├── name: string
│       │       ├── city: string
│       │       └── phone: string
│       │
│       ├── partGroups/                     # === GRUPE DELOVA ===
│       │   └── {groupId}/
│       │       ├── name: string
│       │       └── deviceId: string
│       │
│       ├── parts/                          # === REZERVNI DELOVI ===
│       │   └── {partId}/
│       │       ├── name: string
│       │       ├── code: string
│       │       ├── price: number
│       │       ├── groupId: string         # Referenca ka grupi
│       │       ├── deviceId: string
│       │       ├── inWarranty: boolean
│       │       └── imageUrls: string[]
│       │
│       ├── exchangeRates/                  # === DEVIZNI KURS ===
│       │   └── current/
│       │       ├── EUR: number
│       │       ├── USD: number
│       │       └── updatedAt: timestamp
│       │
│       └── appErrors/                      # === PRIJAVE GREŠAKA ===
│           └── {errorId}/
│               ├── description: string
│               ├── reportedBy: string
│               ├── timestamp: timestamp
│               └── appVersion: string
```

---

## 18. Capacitor plugini

### Potrebni plugini

| Plugin | npm paket | Svrha |
|---|---|---|
| **Firebase Auth** | `@capacitor-firebase/authentication` | Email/password autentifikacija |
| **Firebase Firestore** | `@capacitor-firebase/firestore` | Čitanje/pisanje podataka |
| **Firebase Storage** | `@capacitor-firebase/storage` | Upload/download fajlova (dokumentacija, logo) |
| **Firebase App Check** | `@capacitor-firebase/app-check` | Zaštita API-ja od neautorizovanog pristupa |
| **Firebase Analytics** | `@capacitor-firebase/analytics` | Praćenje korisničkih akcija |
| **Firebase Crashlytics** | `@capacitor-firebase/crashlytics` | Crash reporting |
| **Preferences** | `@capacitor/preferences` | Lokalno čuvanje key-value podataka (config, session) |
| **Filesystem** | `@capacitor/filesystem` | Čuvanje PDF fajlova na uređaju |
| **Browser** | `@capacitor/browser` | Otvaranje eksternih linkova |
| **Share** | `@capacitor/share` | Deljenje fajlova (PDF izveštaji) |
| **Barcode Scanner** | `@capacitor-mlkit/barcode-scanning` | Skeniranje barkodova (kapacitor MLKit) |
| **Status Bar** | `@capacitor/status-bar` | Kontrola status bar-a |
| **Splash Screen** | `@capacitor/splash-screen` | Splash screen upravljanje |
| **App** | `@capacitor/app` | App lifecycle eventi |
| **Keyboard** | `@capacitor/keyboard` | Keyboard kontrola |

### Napomena o Barcode Scanner-u

`@capacitor-mlkit/barcode-scanning` koristi Google ML Kit za skeniranje i ne zahteva Capawesome Insiders licencu.
Alternativa je `@capawesome/capacitor-barcode-scanner` koji je deo Insiders programa (plaćena licenca).

### Napomena o Email Composer-u

Za slanje email-a sa narudžbinom delova, opcije su:
1. `@capacitor-community/email-composer` - ako je dostupan za Capacitor 8
2. Korišćenje `Share` plugin-a za deljenje teksta putem email klijenta
3. Implementacija putem Firebase Cloud Functions (server-side email)

Preporučujem opciju 2 ili 3, jer community plugini mogu kasniti za novim Capacitor verzijama.

---

## 19. Routing i navigacija

### main.ts - Bootstrap

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { provideIonicAngular, IonicRouteStrategy } from '@ionic/angular/standalone';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideTransloco } from '@jsverse/transloco';
import { APP_INITIALIZER } from '@angular/core';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { appInitializerFactory } from './app/core/initializer/app-initializer';
import { translocoConfig } from './app/core/i18n/transloco-loader';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes),
    provideHttpClient(),
    provideTransloco(translocoConfig),
    {
      provide: APP_INITIALIZER,
      useFactory: appInitializerFactory,
      multi: true,
    },
  ],
});
```

### app.routes.ts - Glavne rute

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { featureGuard } from './core/config/feature.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.page').then(m => m.LoginPage),
  },
  {
    path: '',
    // Shell komponenta sa IonMenu + IonRouterOutlet
    loadComponent: () =>
      import('./layout/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./features/home/home.page').then(m => m.HomePage),
      },
      // === DEVICE ROUTES ===
      {
        path: 'device-info/:barcode',
        loadComponent: () =>
          import('./features/device/device-info/device-info.page')
            .then(m => m.DeviceInfoPage),
      },
      {
        path: 'device-history/:barcode',
        loadComponent: () =>
          import('./features/device/device-history/device-history.page')
            .then(m => m.DeviceHistoryPage),
      },
      {
        path: 'part-groups/:deviceId',
        loadComponent: () =>
          import('./features/device/part-groups/part-groups.page')
            .then(m => m.PartGroupsPage),
        canMatch: [featureGuard('spareParts')],
      },
      {
        path: 'device-parts/:deviceId/:groupId',
        loadComponent: () =>
          import('./features/device/device-parts/device-parts.page')
            .then(m => m.DevicePartsPage),
        canMatch: [featureGuard('spareParts')],
      },
      // === SERVICE ROUTES ===
      {
        path: 'commissioning/:barcode',
        loadComponent: () =>
          import('./features/service/commissioning/commissioning.page')
            .then(m => m.CommissioningPage),
        canMatch: [featureGuard('commissioning')],
      },
      {
        path: 'warranty-extension/:barcode',
        loadComponent: () =>
          import('./features/service/warranty-extension/warranty-extension.page')
            .then(m => m.WarrantyExtensionPage),
        canMatch: [featureGuard('warrantyExtension')],
      },
      {
        path: 'inter-in-warranty/:barcode',
        loadComponent: () =>
          import('./features/service/intervention-in-warranty/intervention-in-warranty.page')
            .then(m => m.InterventionInWarrantyPage),
        canMatch: [featureGuard('interventionInWarranty')],
      },
      {
        path: 'inter-out-warranty/:barcode',
        loadComponent: () =>
          import('./features/service/intervention-out-warranty/intervention-out-warranty.page')
            .then(m => m.InterventionOutWarrantyPage),
        canMatch: [featureGuard('interventionOutWarranty')],
      },
      // === SEARCH ROUTES ===
      {
        path: 'search-by-user',
        loadComponent: () =>
          import('./features/search/search-by-user/search-by-user.page')
            .then(m => m.SearchByUserPage),
        canMatch: [featureGuard('deviceManagement')],
      },
      {
        path: 'search-by-name',
        loadComponent: () =>
          import('./features/search/search-by-name/search-by-name.page')
            .then(m => m.SearchByNamePage),
        canMatch: [featureGuard('searchByDevice')],
      },
      // === OTHER ROUTES ===
      {
        path: 'cart',
        loadComponent: () =>
          import('./features/cart/cart.page').then(m => m.CartPage),
        canMatch: [featureGuard('cart')],
      },
      {
        path: 'docs/:path',
        loadComponent: () =>
          import('./features/docs/docs.page').then(m => m.DocsPage),
        canMatch: [featureGuard('documentation')],
      },
      {
        path: 'servicer-history',
        loadComponent: () =>
          import('./features/history/servicer-history.page')
            .then(m => m.ServicerHistoryPage),
        canMatch: [featureGuard('servicerHistory')],
      },
      {
        path: 'bugs',
        loadComponent: () =>
          import('./features/bugs/bugs.page').then(m => m.BugsPage),
        canMatch: [featureGuard('bugReport')],
      },
    ],
  },
];
```

### Dijagram navigacije

```
                           ┌─────────────┐
                    ┌──────│   /login     │
                    │      └──────┬───────┘
                    │             │ (uspešan login)
                    │             ▼
                    │      ┌─────────────────────────────────────┐
                    │      │         Shell (IonMenu)             │
                    │      │  ┌──────────────────────────────┐   │
                    │      │  │        /home                  │   │
                    │      │  │  [Scan] [Search] [Docs]       │   │
                    │      │  └──────┬───────────────┬────────┘   │
   (logout) ◄──────┘      │         │               │            │
                           │         ▼               ▼            │
                           │  ┌─────────────┐ ┌──────────────┐   │
                           │  │/device-info │ │/search-by-*  │   │
                           │  │  /:barcode  │ │              │   │
                           │  └──────┬──────┘ └──────────────┘   │
                           │         │                            │
                           │    ┌────┼────┬────┬─────┐           │
                           │    │    │    │    │     │           │
                           │    ▼    ▼    ▼    ▼     ▼           │
                           │  ┌───┐┌───┐┌───┐┌───┐┌────┐        │
                           │  │COM││WEX││IIW││IOW││HIST│        │
                           │  └───┘└───┘└───┘└───┘└────┘        │
                           │                                     │
                           │  COM = commissioning                │
                           │  WEX = warranty-extension           │
                           │  IIW = inter-in-warranty            │
                           │  IOW = inter-out-warranty           │
                           │  HIST = device-history              │
                           │                                     │
                           │  ┌──────────────────────────────┐   │
                           │  │ Side Menu:                    │   │
                           │  │  - Servicer History           │   │
                           │  │  - Report Bugs                │   │
                           │  │  - Cart                       │   │
                           │  │  - Logout                     │   │
                           │  └──────────────────────────────┘   │
                           └─────────────────────────────────────┘
```

---

## 20. Bezbednost

### Slojevi zaštite

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│  SLOJ 1: App Check (Native Attestation)                 │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Play Integrity (Android) / App Attest (iOS)        │ │
│  │ Samo prava aplikacija može pristupiti Firebase-u   │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  SLOJ 2: Firebase Authentication                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Email/Password autentifikacija                     │ │
│  │ Token-based session management                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  SLOJ 3: Firestore Security Rules                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Korisnik može pristupiti SAMO podacima svog tenanta│ │
│  │ Pravilo: request.auth.token.tenantId == tenantId   │ │
│  │ (koristeći Custom Claims na Firebase Auth tokenu)  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  SLOJ 4: Angular Guards (Client-side)                    │
│  ┌────────────────────────────────────────────────────┐ │
│  │ authGuard: Samo ulogovani korisnici                │ │
│  │ featureGuard: Samo omogućeni feature-i              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Firestore Security Rules (primer)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // NEMA userProfiles pravila - ta kolekcija ne postoji!
    // tenantId + role dolaze iz Custom Claims u auth tokenu.

    // Tenant izolacija - SVE operacije zahtevaju auth
    // i poklapanje tenantId-a iz Custom Claims
    match /tenants/{tenantId}/{document=**} {
      allow read: if request.auth != null
        && request.auth.token.tenantId == tenantId;
      allow write: if request.auth != null
        && request.auth.token.tenantId == tenantId
        && request.auth.token.role in ['servicer', 'admin'];
    }
  }
}
```

### Firebase Auth Custom Claims

Custom Claims se postavljaju **isključivo server-side** (Cloud Function ili Admin SDK).
Aplikacija ih **samo čita** iz auth tokena. Ovo je jedini izvor informacija o tome
kom tenantu korisnik pripada.

```typescript
// Cloud Function / Admin SDK - prilikom kreiranja ili ažuriranja korisnika
admin.auth().setCustomUserClaims(uid, {
  tenantId: 'SR',          // Određuje pristup podacima
  role: 'servicer',        // Određuje nivo dozvola (read/write)
  servicerId: 'abc123'     // Referenca ka dokumentu u tenants/SR/servicers/abc123
});
```

**Čitanje u aplikaciji** (posle autentifikacije):
```typescript
const tokenResult = await FirebaseAuthentication.getIdTokenResult();
const tenantId = tokenResult.claims.tenantId;    // "SR"
const role = tokenResult.claims.role;             // "servicer"
const servicerId = tokenResult.claims.servicerId; // "abc123"
```

Ovo omogućava:
1. Firestore Security Rules da provere tenant pristup bez dodatnih upita
2. Aplikacija da zna tenantId bez čitanja iz baze
3. Potpunu server-side kontrolu nad pristupom korisnika

---

## 21. PDF generisanje

### Report Service dizajn

```
┌──────────────────────────────────────────────────────────────┐
│                      ReportService                            │
│                                                               │
│  generateCommissioningReport(data): Promise<Blob>            │
│  generateInterventionReport(data): Promise<Blob>             │
│  generateWarrantyReport(data): Promise<Blob>                 │
│  generateServicerHistoryReport(data): Promise<Blob>          │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  Template Engine                        │  │
│  │                                                         │  │
│  │  Svaki tip izveštaja ima svoj template fajl koji        │  │
│  │  definiše layout pomoću pdfmake DocumentDefinition.     │  │
│  │                                                         │  │
│  │  templates/                                             │  │
│  │  ├── commissioning.template.ts                          │  │
│  │  ├── intervention.template.ts                           │  │
│  │  ├── warranty.template.ts                               │  │
│  │  └── servicer-history.template.ts                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              File Management                            │  │
│  │                                                         │  │
│  │  saveToDevice(blob, filename)                           │  │
│  │  → koristi @capacitor/filesystem                        │  │
│  │                                                         │  │
│  │  shareReport(filePath)                                  │  │
│  │  → koristi @capacitor/share                             │  │
│  │                                                         │  │
│  │  openReport(filePath)                                   │  │
│  │  → koristi @capacitor/browser ili filesystem viewer     │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Sumarni dijagram celokupnog sistema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                         ARISTON SERVICE APP                              │
│                    Ionic 8 + Angular 19 + Capacitor 8                    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                        ANGULAR APP                                 │  │
│  │                                                                    │  │
│  │   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐         │  │
│  │   │ Feature │   │ Feature │   │ Feature │   │ Feature │  ...     │  │
│  │   │ Pages   │   │ Pages   │   │ Pages   │   │ Pages   │         │  │
│  │   │ (lazy)  │   │ (lazy)  │   │ (lazy)  │   │ (lazy)  │         │  │
│  │   └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘         │  │
│  │        │              │              │              │              │  │
│  │        └──────────────┴──────────────┴──────────────┘              │  │
│  │                              │                                     │  │
│  │                    ┌─────────┴─────────┐                          │  │
│  │                    │  Guards & Config   │                          │  │
│  │                    │  (Feature Flags)   │                          │  │
│  │                    └─────────┬─────────┘                          │  │
│  │                              │                                     │  │
│  │              ┌───────────────┼───────────────┐                    │  │
│  │              │               │               │                    │  │
│  │       ┌──────┴──────┐ ┌─────┴─────┐ ┌──────┴──────┐             │  │
│  │       │ Auth Store  │ │Config Store│ │Tenant Store │             │  │
│  │       │ Cart Store  │ │           │ │             │             │  │
│  │       └──────┬──────┘ └─────┬─────┘ └──────┬──────┘             │  │
│  │              │               │               │                    │  │
│  │              └───────────────┼───────────────┘                    │  │
│  │                              │                                     │  │
│  │                    ┌─────────┴─────────┐                          │  │
│  │                    │   Core Services    │                          │  │
│  │                    │  Auth, Config,     │                          │  │
│  │                    │  i18n, Logger,     │                          │  │
│  │                    │  Theme, Report     │                          │  │
│  │                    └─────────┬─────────┘                          │  │
│  │                              │                                     │  │
│  │                    ┌─────────┴─────────┐                          │  │
│  │                    │  Data Access Layer │                          │  │
│  │                    │  Firestore Service │                          │  │
│  │                    │  Storage Service   │                          │  │
│  │                    └─────────┬─────────┘                          │  │
│  └──────────────────────────────┼────────────────────────────────────┘  │
│                                 │                                        │
│  ┌──────────────────────────────┼────────────────────────────────────┐  │
│  │                     CAPACITOR 8 BRIDGE                             │  │
│  │                                                                    │  │
│  │  @capacitor-firebase/auth     │  @capacitor/preferences           │  │
│  │  @capacitor-firebase/firestore│  @capacitor/filesystem            │  │
│  │  @capacitor-firebase/storage  │  @capacitor/browser               │  │
│  │  @capacitor-firebase/app-check│  @capacitor-mlkit/barcode-scan    │  │
│  │  @capacitor-firebase/analytics│  @capacitor/share                 │  │
│  └──────────────────────────────┼────────────────────────────────────┘  │
│                                 │                                        │
│  ┌──────────────────────────────┼────────────────────────────────────┐  │
│  │                    NATIVE PLATFORM                                 │  │
│  │                                                                    │  │
│  │          ┌───────────┐              ┌───────────┐                 │  │
│  │          │  Android  │              │    iOS    │                 │  │
│  │          │           │              │           │                 │  │
│  │          │ Firebase  │              │ Firebase  │                 │  │
│  │          │ SDK (Java)│              │ SDK(Swift)│                 │  │
│  │          │           │              │           │                 │  │
│  │          │ Play      │              │ App       │                 │  │
│  │          │ Integrity │              │ Attest    │                 │  │
│  │          └───────────┘              └───────────┘                 │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Environment fajlovi

### environment.ts (development)

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: '...',
    authDomain: '...',
    projectId: '...',
    storageBucket: '...',
    messagingSenderId: '...',
    appId: '...',
  },
  appCheckDebugToken: '...', // Samo za dev
  logLevel: 'DEBUG',
};
```

### environment.prod.ts (production)

```typescript
export const environment = {
  production: true,
  firebase: {
    apiKey: '...',
    authDomain: '...',
    projectId: '...',
    storageBucket: '...',
    messagingSenderId: '...',
    appId: '...',
  },
  logLevel: 'WARN',
};
```

---

## Capacitor konfiguracija

### capacitor.config.ts

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.aristonservice',
  appName: 'Ariston Service',
  webDir: 'www',
  plugins: {
    SplashScreen: {
      launchAutoHide: false,  // Ručno sakrivamo nakon inicijalizacije
      showSpinner: true,
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: [],  // Samo email/password, ne treba provider
    },
  },
};

export default config;
```

---

## Rezime ključnih odluka

| Odluka | Izbor | Obrazloženje |
|---|---|---|
| Framework | Ionic 8 + Angular 19 | Najnoviji stabilan, standalone komponente |
| Runtime | Capacitor 8 | Najnoviji, SPM za iOS, Node 22+ |
| Firebase pristup | Native (@capacitor-firebase/*) | App Check zahteva native, konzistentnost |
| Multi-tenant | Jedan Firebase projekat | Jednostavnije upravljanje, logička izolacija |
| Tenant resolver | Auth Custom Claims | tenantId iz tokena, BEZ Firestore čitanja |
| User profili | Nema globalne kolekcije | Sve info u Custom Claims + tenant kolekcijama |
| Auth persistence | Firebase native SDK | Keychain (iOS) / Encrypted SharedPrefs (Android) |
| Config storage | Firestore dokument | Fleksibilna struktura, real-time updates |
| State management | NgRx SignalStore | Lakši od NgRx, koristi Signals, skalabilan |
| Lokalizacija | @jsverse/transloco | Runtime i18n, lazy loading prevoda |
| Jezička preferencija | Capacitor Preferences | Čuva korisnikov izbor jezika lokalno |
| PDF | pdfmake | Pure JS, offline, bogat API |
| Routing | Standalone routes + loadComponent | Moderne Angular konvencije, tree-shaking |
| Guards | canMatch za features | Sprečava učitavanje JS bundle-a |
| Logging | Transport pattern | Lako proširiv (console → firestore) |
| Theming | CSS custom properties | Ionic native pristup, dinamička promena |
