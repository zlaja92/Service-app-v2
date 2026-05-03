Now I have all the information needed to produce the v2 architecture. Let me now compile the complete revised document.

Here is the complete revised Master Test Architecture v2:

---

# CHANGELOG v1 -> v2

1. **[REQ-01] WU-01 Shared Models**: Expanded from 2 files to 7 files (device, group, intervention, part, servicer, setup, user). Added ~10 test cases covering UserAddType enum, DeviceUser interface (dateOfPurchase/lastWarrantyExtension null), HeatPumpSetup, GasBoilerSetup, Servicer, PartGroup, Part (imageUrls), Intervention (parts array). Total: ~22 test cases.
2. **[REQ-02] NEW WU-62 DocsListPage**: Added P2 component test (~6 test cases) for ionViewWillEnter, onEntryClick folder/file routing, goBack.
3. **[REQ-03] NEW WU-63 AppComponent**: Added P2 smoke test (~2 test cases) for component creation and ion-app/ion-router-outlet rendering.
4. **[REQ-04] NEW WU-64 app.routes.ts**: Added P1 routing configuration test (~12 test cases) covering route count, lazy loading, authGuard on shell, each featureGuard mapping, redirect '' -> 'home'.
5. **[REQ-05] NEW WU-65 main.ts bootstrap**: Added P1 verification test (~6 test cases) for CLEARABLE_SERVICES (all 11), Transloco config, appInitializer, IonicRouteStrategy, registerSwiperElements.
6. **[REQ-06] WU-17 Config**: Added featureGuard gap analysis -- test for featureGuard called when configStore.isLoaded === false. +2 test cases.
7. **[REQ-07] WU-24 LoginPage**: Expanded getErrorMessage to explicitly list auth/invalid-credential, auth/user-not-found, auth/wrong-password, auth/too-many-requests, auth/network-request-failed, generic fallback. Total: ~19 test cases.
8. **[REQ-08] WU-26 CartPage**: Changed priority from P2 to P1 (order email is business-critical).
9. **[REQ-09] WU-07 FirestoreService**: Added explicit querySubcollection (always returns lastDocumentPath: null) and all 4 intervention methods. +5 test cases. Total: ~33 test cases.
10. **[REQ-10] WU-18 i18n**: Added i18n.model.ts utility functions with different tenantId tests. Corrected mock dependencies: TranslationCacheService uses Preferences directly (NOT PreferencesService).
11. **[REQ-11] WU-20 SessionService**: Added cacheLogo error (gracefully handled), cacheLogo stale generation, cacheLogo no logoUrl, teardown calls clear() on all 11 CLEARABLE_SERVICES. +4 test cases. Total: ~24 test cases.
12. **[REQ-12] WU-13 TenantService**: Added JWT edge cases (token < 3 parts, invalid base64, invalid JSON). +3 test cases. Total: ~25 test cases.
13. **[REQ-13] WU-25 CartService**: Added decreaseQuantity for non-existent partCode (no-op). +1 test case. Total: ~19 test cases.
14. **[REQ-14] WU-31 device-catalog**: Expanded scope to explicitly cover DeviceSearchPage, DeviceGroupsPage, DevicePartsPage gap analysis. Added POTENTIAL BUG test for DeviceSearchService.mapToDevice undefined! type. +3 test cases. Total: ~18 test cases.
15. **[REQ-15] WU-38 UserSearchService**: Added test for business() null scenario (runtime error). +1 test case. Total: ~23 test cases.
16. **[REQ-16] WU-40 AddUserPage**: Added onSave removes callAccepted for non-annualService, dateOfPurchase handling (out_of_warranty/commissioning/manual). +3 test cases. Total: ~31 test cases.
17. **[REQ-17] WU-43 AnnualServicePage**: Expanded saveForConnectedDevice with all 4 scenarios (non-HEAT_PUMP skip, no connectedDevice field, not found warning, successful save). +4 test cases. Total: ~22 test cases.
18. **[REQ-18] WU-41 AddDevicePage**: Added showNoPhotosAlert flow (user cancels/user confirms). +2 test cases. Total: ~30 test cases.
19. **[REQ-19] Section G Risks**: Added 5 new risks (SignalStore singleton pollution, DeviceSearchService.mapToDevice undefined! bug, src/testing/ vs src/app/testing/, Swiper registration, TranslationCacheService uses Preferences directly).
20. **[REQ-20] Section G Firebase Emulator**: Added pre-requisite for Firebase Emulator setup OR Playwright network interceptor alternative for PHASE FINAL. Marked as BLOCKER for WU-48 to WU-61.
21. **[REQ-21] Section F Exit criteria**: Added "0 direct console.log/error/warn calls in production code".
22. **[REQ-22] POTENTIAL BUG reported**: DeviceSearchService.mapToDevice line 133 uses undefined! for type fallback.
23. **[REQ-23] BUG escalated as blocker**: console.log('DEBUG_INT: ...') in intervention.page.ts lines 150 and 157.
24. **[REQ-24] Folder structure**: Changed src/testing/ to src/app/testing/ for Angular CLI compatibility.

Additionally confirmed: features/bugs, features/history, features/service directories are empty -- NOT included. core/report has only empty templates/ -- skipped. shared/pipes, shared/components, shared/utils are empty -- skipped.

---

# MASTER TEST ARCHITECTURE v2 -- serviceAppV2

## 1. PREGLED FUNKCIONALNOSTI

serviceAppV2 je Ionic/Angular mobilna servisna aplikacija za Ariston servisere. Aplikacija pokriva: autentifikaciju preko Firebase Auth sa JWT custom claims (tenantId, role, servicerId, deviceTypes), multi-tenant konfiguraciju (per-tenant config, theme, translations u Firestore), pretragu uredjaja po SN/barkodu, registraciju uredjaja sa korisnickim podacima, pustanje u rad (commissioning), godisnji servis sa provere eligibilnosti (slozeni window/calendar algoritam), intervencije (popravke/buka/zamena), istoriju intervencija sa detaljnim prikazom, fotografisanje tokom intervencija (Camera/Gallery + Firebase Storage upload), env-info modal za GAS_BOILER/HEAT_PUMP uredjaje, device catalog (delovi/grupe/cene sa exploded view slikama), korpu za narucivanje delova sa email composer-om, dokumentaciju (Firebase Storage folder browsing), i18n (sr/en/mk sa Firestore sync + bundled fallback), i theme/dark mode sistem.

**Kljucne zavisnosti**: FirestoreService (svi Firestore pozivi), TenantService (multi-tenant path resolution), ConfigStore (feature flags, business config), AuthStore (user state), SessionService (bootstrap/teardown lifecycle), LoggerService (logging), PreferencesService (Capacitor Preferences), StorageService (Firebase Storage), ServerTimeService (Cloud Functions), TranslationService/TranslationCacheService (i18n).

**Kljucni rizicni delovi**: AnnualServiceEligibilityService.determineEligibility (slozen algoritam), DeviceRegistrationService.registerBatch (atomic writes), InterventionService.saveInterventionBatch, SessionService bootstrap/teardown/generation counter, ConfigService loadConfig (cache-first + version check), connected device validation flow, warranty date calculations, cyrillic-to-latin conversion u AddUserPage, manufacture date extraction from SN.

---

## 2. STRATEGIJA TESTIRANJA

### A. Master plan -- Work Units u dependency-aware redosledu

---

### PHASE 0 -- Foundational shared utilities/services/pipes/directives/components/models

**WU-01: Shared Models (ALL 7 model files)**
- Faza: Phase 0
- Prioritet: P0
- Scope: Unit testovi za SVE shared modele:
  - `device.model.ts`: DeviceType enum completeness (4 values: HEAT_PUMP, GAS_BOILER, BOILER, AIR_CONDITION), Device interface assignability (all optional fields: commissioning, annualService, connectedDevice, firstServiceYear, serviceWindowStart, serviceWindowEnd, warrantyMonths)
  - `group.model.ts`: Group interface assignability (id, name, groupPhoto)
  - `intervention.model.ts`: InterventionType interface, InterventionPart interface (name, code, quantity), Intervention interface (parts: InterventionPart[], setup?: Record, dateOfPurchase nullable)
  - `part.model.ts`: PartGroup interface (id optional, name, deviceId), Part interface (id optional, imageUrls: string[] -- verify array type, inWarranty boolean, price number)
  - `servicer.model.ts`: Servicer interface (id optional, email, company, name, city, phone)
  - `setup.model.ts`: HeatPumpSetup interface (all 16 string fields), GasBoilerSetup interface (4 string fields + 2 boolean fields: leakTested, installationVerified)
  - `user.model.ts`: UserAddType enum (COMMIS, NO_COMMIS -- 2 values), DeviceUser interface (dateOfPurchase: Date | null, lastWarrantyExtension: Date | null, voidWarranty: boolean, callAccepted: boolean, additionType: UserAddType)
- Source fajlovi: `src/app/shared/models/device.model.ts`, `src/app/shared/models/group.model.ts`, `src/app/shared/models/intervention.model.ts`, `src/app/shared/models/part.model.ts`, `src/app/shared/models/servicer.model.ts`, `src/app/shared/models/setup.model.ts`, `src/app/shared/models/user.model.ts`
- Tip testa: unit
- Output: `src/app/shared/models/device.model.spec.ts`, `src/app/shared/models/group.model.spec.ts`, `src/app/shared/models/intervention.model.spec.ts`, `src/app/shared/models/part.model.spec.ts`, `src/app/shared/models/servicer.model.spec.ts`, `src/app/shared/models/setup.model.spec.ts`, `src/app/shared/models/user.model.spec.ts`
- Mock dependencies: nema
- Procena: 7 fajlova, ~22 test case-ova

**WU-02: Shared Directives -- FeatureFlagDirective**
- Faza: Phase 0
- Prioritet: P0
- Scope: Testiranje strukturne direktive -- rendering kad je feature enabled, ne-rendering kad disabled, update kad se config promeni, edge case za nepostojeci feature key.
- Source fajlovi: `src/app/shared/directives/feature-flag.directive.ts`
- Tip testa: component-test
- Output: `src/app/shared/directives/feature-flag.directive.spec.ts`
- Mock dependencies: ConfigStore (mock sa signalStore)
- Procena: 1 fajl, ~8 test case-ova

**WU-03: Shared Services -- ConfirmService**
- Faza: Phase 0
- Prioritet: P1
- Scope: Testiranje confirm/cancel flow-a, verifikacija da koristi translated stringove, oba dugmeta resolve correct boolean.
- Source fajlovi: `src/app/shared/services/confirm.service.ts`
- Tip testa: unit
- Output: `src/app/shared/services/confirm.service.spec.ts`
- Mock dependencies: AlertController (Ionic mock), TranslocoService
- Procena: 1 fajl, ~6 test case-ova

**WU-04: Shared Services -- LoadingAlertService**
- Faza: Phase 0
- Prioritet: P1
- Scope: show/hide/wrap metode, timeout, duplicate show/hide, wrap sa error-om.
- Source fajlovi: `src/app/shared/services/loading-alert.service.ts`
- Tip testa: unit
- Output: `src/app/shared/services/loading-alert.service.spec.ts`
- Mock dependencies: LoadingController (Ionic mock), TranslocoService
- Procena: 1 fajl, ~8 test case-ova

---

### PHASE 1 -- Core infrastructure (gap-ovi nad postojecim coverage-om)

**WU-05: Logger -- LoggerService + ConsoleTransport**
- Faza: Phase 1
- Prioritet: P1
- Scope: Min-level filtering, all log levels, addTransport, context passing, timestamp generation. ConsoleTransport: correct console method per level, formatting.
- Source fajlovi: `src/app/core/logger/logger.service.ts`, `src/app/core/logger/logger.model.ts`, `src/app/core/logger/transports/console.transport.ts`
- Tip testa: unit
- Output: `src/app/core/logger/logger.service.spec.ts`, `src/app/core/logger/transports/console.transport.spec.ts`
- Mock dependencies: environment (mock logLevel)
- Procena: 2 fajla, ~18 test case-ova

**WU-06: Storage -- PreferencesService**
- Faza: Phase 1
- Prioritet: P1
- Scope: get/set/remove/clear -- wrapping Capacitor Preferences plugin.
- Source fajlovi: `src/app/core/storage/preferences.service.ts`
- Tip testa: unit
- Output: `src/app/core/storage/preferences.service.spec.ts`
- Mock dependencies: Capacitor Preferences plugin
- Procena: 1 fajl, ~8 test case-ova

**WU-07: Firebase -- FirestoreService**
- Faza: Phase 1
- Prioritet: P0
- Scope: Svi metodi:
  - `getDocument` (success, null snapshot)
  - `getTenantDocument` (delegates to getDocument with tenant path)
  - `queryTenantCollection` (results, empty results, lastDocumentPath calculation)
  - `setDocument` (success)
  - `setTenantDocument` (delegates with tenant path)
  - `addTenantDocument` (returns id)
  - `queryTenantSubcollection` (delegates to querySubcollection with tenant prefix)
  - **`querySubcollection`** (public method, returns results, **always returns lastDocumentPath: null** -- verify this explicitly)
  - `writeBatch` (success, error)
  - `buildTenantReference` (correct path construction)
  - `generateId` (20 chars, alphanumeric)
  - **`getInterventionDocument`** (delegates to getDocument with intervention collection path)
  - **`addInterventionDocument`** (returns id, uses intervention collection path)
  - **`queryInterventionCollection`** (results, empty, lastDocumentPath calculation)
  - **`buildInterventionReference`** (correct path construction with device type)
  - Edge: null snapshot, empty results, error handling.
- Source fajlovi: `src/app/core/firebase/firestore.service.ts`
- Tip testa: unit
- Output: `src/app/core/firebase/firestore.service.spec.ts`
- Mock dependencies: FirebaseFirestore (Capacitor plugin), TenantService, LoggerService
- Procena: 1 fajl, ~33 test case-ova

**WU-08: Firebase -- StorageService**
- Faza: Phase 1
- Prioritet: P1
- Scope: getFileUrl (native vs web), listFolder (native vs web, _folders.txt parsing), uploadFile (native vs web, callback handling), resolveFileUrl (multiple extensions, none found).
- Source fajlovi: `src/app/core/firebase/storage.service.ts`
- Tip testa: unit
- Output: `src/app/core/firebase/storage.service.spec.ts`
- Mock dependencies: FirebaseStorage, Capacitor (isNativePlatform), firebase/storage SDK, LoggerService
- Procena: 1 fajl, ~20 test case-ova

**WU-09: Firebase -- ServerTimeService**
- Faza: Phase 1
- Prioritet: P1
- Scope: Successful fetch, invalid response (no timestamp, non-number), network error, returns Date.
- Source fajlovi: `src/app/core/firebase/server-time.service.ts`
- Tip testa: unit
- Output: `src/app/core/firebase/server-time.service.spec.ts`
- Mock dependencies: FirebaseFunctions (Capacitor plugin), LoggerService
- Procena: 1 fajl, ~8 test case-ova

**WU-10: Firebase -- FirebaseInitService**
- Faza: Phase 1
- Prioritet: P2
- Scope: Initialize (first call, subsequent call), getApp before/after init.
- Source fajlovi: `src/app/core/firebase/firebase-init.service.ts`
- Tip testa: unit
- Output: `src/app/core/firebase/firebase-init.service.spec.ts`
- Mock dependencies: firebase/app (initializeApp, getApps), firebase/auth (getAuth), LoggerService
- Procena: 1 fajl, ~6 test case-ova

**WU-11: HTTP -- CapacitorHttpService**
- Faza: Phase 1
- Prioritet: P2
- Scope: get method delegates to CapacitorHttp.
- Source fajlovi: `src/app/core/http/capacitor-http.service.ts`
- Tip testa: unit
- Output: `src/app/core/http/capacitor-http.service.spec.ts`
- Mock dependencies: CapacitorHttp
- Procena: 1 fajl, ~3 test case-a

**WU-12: Tenant -- TenantStore**
- Faza: Phase 1
- Prioritet: P0
- Scope: Initial state, setTenant, clear, signal reactivity.
- Source fajlovi: `src/app/core/tenant/tenant.store.ts`
- Tip testa: unit
- Output: `src/app/core/tenant/tenant.store.spec.ts`
- Mock dependencies: nema
- Procena: 1 fajl, ~8 test case-ova

**WU-13: Tenant -- TenantService**
- Faza: Phase 1
- Prioritet: P0
- Scope: resolveFromAuthToken (JWT decode, claims extraction, missing tenantId, malformed token), getTenantDocPath (with/without tenantId), getCollectionPath, getInterventionCollectionPath (mapping, fallback), isDeviceTypeAllowed, getAllowedDeviceTypes.
  **JWT edge cases (added v2):**
  - Token with < 3 parts (e.g., "header.payload" -- only 2 parts) -> returns empty object from decodeJwtPayload, no tenantId resolved
  - Token with invalid base64 in payload section (e.g., "a.!!!invalid!!!.c") -> atob throws, caught by try/catch, logs warning
  - Token where payload is valid base64 but not valid JSON (e.g., "a.bm90anNvbg.c" where decoded = "notjson") -> JSON.parse throws, caught by try/catch
- Source fajlovi: `src/app/core/tenant/tenant.service.ts`
- Tip testa: unit
- Output: `src/app/core/tenant/tenant.service.spec.ts`
- Mock dependencies: FirebaseAuthentication (Capacitor plugin), TenantStore, ConfigStore, LoggerService
- Procena: 1 fajl, ~25 test case-ova

**WU-14: Auth -- AuthService**
- Faza: Phase 1
- Prioritet: P0
- Scope: login success/failure, logout, waitForAuthReady (auth state fires, timeout, settled guard), onAuthStateChange callback.
- Source fajlovi: `src/app/core/auth/auth.service.ts`, `src/app/core/auth/auth.model.ts`
- Tip testa: unit
- Output: `src/app/core/auth/auth.service.spec.ts`
- Mock dependencies: FirebaseAuthentication (Capacitor plugin), LoggerService
- Procena: 1 fajl, ~16 test case-ova

**WU-15: Auth -- AuthStore**
- Faza: Phase 1
- Prioritet: P0
- Scope: Initial state, setUser, clearUser, setLoading, setError, computed (isAuthenticated, userEmail, userId).
- Source fajlovi: `src/app/core/auth/auth.store.ts`
- Tip testa: unit
- Output: `src/app/core/auth/auth.store.spec.ts`
- Mock dependencies: nema
- Procena: 1 fajl, ~12 test case-ova

**WU-16: Auth -- authGuard**
- Faza: Phase 1
- Prioritet: P0
- Scope: Authenticated returns true, unauthenticated returns UrlTree to /login. VEC POSTOJI `feature.guard.spec.ts`, ali `auth.guard.spec.ts` NE postoji.
- Source fajlovi: `src/app/core/auth/auth.guard.ts`
- Tip testa: unit
- Output: `src/app/core/auth/auth.guard.spec.ts`
- Mock dependencies: AuthStore, Router
- Procena: 1 fajl, ~4 test case-a

**WU-17: Config -- ConfigStore, ConfigService, ConfigModel + featureGuard gap (GAP analiza)**
- Faza: Phase 1
- Prioritet: P0
- Scope: Postojeci testovi pokrivaju ConfigStore, ConfigService, ConfigModel. Gap analiza: proveriti da li su pokriveni novi fieldovi (interventionPhotoConfig, snMfgDateStart, snMfgDateLength, orderEmailRecipients, photoQuality, photoMaxWidth), mergeWithDefaults sa interventionPhotoConfig, interventionFaultOptions, interventionErrorOptions. Dodati testove za nove fieldove ako nedostaju.
  **featureGuard gap analysis (added v2):**
  - Test za scenario gde se `featureGuard` poziva PRE nego sto je config ucitan (`configStore.isLoaded === false`). U tom slucaju, `configStore.isFeatureEnabled(featureName)` pristupa `store.config()?.features` gde je `config === null`, sto rezultira fallback na `getDefaultFeatures()` gde su svi feature-ovi `false`. Ovo znaci da se korisnik UVEK redirectuje na /home ako config nije ucitan -- sto je korektno ponasanje, ali treba biti eksplicitno testirano.
  - Test: featureGuard called when configStore.isLoaded is false -> returns UrlTree('/home')
  - Test: featureGuard called when config is loaded but feature disabled -> returns UrlTree('/home')
- Source fajlovi: `src/app/core/config/config.store.ts`, `src/app/core/config/config.service.ts`, `src/app/core/config/config.model.ts`, `src/app/core/config/feature.guard.ts`
- Tip testa: unit
- Output: Patch na postojece `*.spec.ts` fajlove
- Mock dependencies: vec definisani u postojecim testovima
- Procena: 0 novih fajlova, ~12 novih test case-ova

**WU-18: i18n -- TranslationService + TranslationCacheService + FirestoreTranslocoLoader + i18n.model.ts utilities**
- Faza: Phase 1
- Prioritet: P1
- Scope:
  - TranslationService: init (stored lang, default), sync (version check, download only changed, new languages detected), setLanguage, getLanguageLabel.
  - TranslationCacheService: all cache methods (get/set cached translation, version, languages, labels, stored language).
    **IMPORTANT (v2 correction)**: `TranslationCacheService` uses `Preferences` from `@capacitor/preferences` DIRECTLY -- it does NOT use `PreferencesService` wrapper. Mock `Preferences` plugin directly, not `PreferencesService`.
  - FirestoreTranslocoLoader: cache hit, Firestore fallback, bundled fallback, default language fallback.
  - **i18n.model.ts utility functions (added v2)**:
    - `translationsVersionKey(tenantId)` -- test with different tenantIds (e.g., 'tenant1', 'tenant2') to verify tenant isolation of cache keys
    - `translationsLanguagesKey(tenantId)` -- same pattern
    - `translationsLabelsKey(tenantId)` -- same pattern
    - `translationCacheKey(lang, tenantId)` -- test with different lang+tenant combinations
    - Constants: DEFAULT_LANGUAGE === 'sr', BUNDLED_LANGUAGES === ['sr', 'en'], LANGUAGE_LABELS keys match BUNDLED_LANGUAGES
- Source fajlovi: `src/app/core/i18n/translation.service.ts`, `src/app/core/i18n/translation-cache.service.ts`, `src/app/core/i18n/firestore-transloco-loader.ts`, `src/app/core/i18n/i18n.model.ts`
- Tip testa: unit
- Output: `src/app/core/i18n/translation.service.spec.ts`, `src/app/core/i18n/translation-cache.service.spec.ts`, `src/app/core/i18n/firestore-transloco-loader.spec.ts`, `src/app/core/i18n/i18n.model.spec.ts`
- Mock dependencies: TranslocoService, FirestoreService, **Preferences (Capacitor plugin directly, NOT PreferencesService)**, TenantService, LoggerService
- Procena: 4 fajla, ~43 test case-ova

**WU-19: Theme -- ThemeService + LogoCacheService (GAP analiza)**
- Faza: Phase 1
- Prioritet: P1
- Scope: Postojeci testovi pokrivaju ThemeService i LogoCacheService. Gap analiza: verifikovati da applyTheme setuje sve CSS varijable (uklj. shade/tint/rgb/contrast), hexToRgb edge cases, getContrast light/dark threshold, adjustColor negative/positive percent, initDarkMode, setDarkMode saves to preferences.
- Source fajlovi: `src/app/core/theme/theme.service.ts`, `src/app/core/theme/logo-cache.service.ts`
- Tip testa: unit
- Output: Patch na postojece `*.spec.ts` fajlove ili novi ako ne postoje dovoljno detaljni
- Mock dependencies: PreferencesService, CapacitorHttpService, TenantService, LoggerService
- Procena: 0-1 novih fajlova, ~12 novih test case-ova

**WU-20: Session -- SessionService + Clearable**
- Faza: Phase 1
- Prioritet: P0
- Scope: bootstrap (full sequence: tenant resolve -> config load -> translation sync -> theme apply -> logo cache), teardown (generation increment, store clears, clearable services called, default theme applied), generation counter (stale bootstrap skipped), promise deduplication, bootstrap with no tenantId (defaults loaded). Postojeci spec pokriva nesto, provera gap-ova.
  **Additional scenarios (added v2):**
  - `cacheLogo` error path: when `logoCacheService.getLogoDataUrl` rejects -> logs warning "Logo cache failed", does NOT throw, bootstrap continues normally (gracefully handled)
  - `cacheLogo` stale generation: logo resolves AFTER teardown (gen mismatch) -> `configStore.setLogoDataUrl` is NOT called
  - `cacheLogo` no logoUrl: when `theme.logoUrl` is falsy (empty string or undefined) -> `logoCacheService.getLogoDataUrl` is never called
  - `teardown` calls `clear()` on ALL 11 CLEARABLE_SERVICES: must mock all 11 (DeviceSearchService, DeviceGroupsService, DevicePartsService, CartService, DocsService, PartDetailService, DeviceLookupService, DeviceRegistrationService, InterventionService, AnnualServiceEligibilityService, PhotoService) and verify each receives `clear()` call
- Source fajlovi: `src/app/core/session/session.service.ts`, `src/app/core/session/clearable.ts`
- Tip testa: unit
- Output: `src/app/core/session/session.service.spec.ts` (dopuna postojeceg ili novi ako ne postoji dovoljno)
- Mock dependencies: TenantService, TenantStore, ConfigService, ConfigStore, ThemeService, LogoCacheService, TranslationService, LoggerService, CLEARABLE_SERVICES (all 11 mocks)
- Procena: 1 fajl, ~24 test case-ova

**WU-21: Initializer -- appInitializer**
- Faza: Phase 1
- Prioritet: P0
- Scope: Firebase init, dark mode init, translation init, waitForAuthReady (user present -> bootstrap, user null -> defaults, error -> defaults), onAuthStateChange listener (user present -> setUser + bootstrap, user null -> clearUser + teardown + navigate login, error in handler -> caught).
- Source fajlovi: `src/app/core/initializer/app-initializer.ts`
- Tip testa: unit
- Output: `src/app/core/initializer/app-initializer.spec.ts`
- Mock dependencies: FirebaseInitService, AuthService, AuthStore, ConfigStore, ThemeService, TranslationService, SessionService, LoggerService, Router
- Procena: 1 fajl, ~16 test case-ova

---

### PHASE 2 -- Layout + Bootstrap verification

**WU-22: Layout -- ShellComponent**
- Faza: Phase 2
- Prioritet: P2
- Scope: Renders MenuComponent + IonRouterOutlet. Minimal template test.
- Source fajlovi: `src/app/layout/shell/shell.component.ts`
- Tip testa: component-test
- Output: `src/app/layout/shell/shell.component.spec.ts`
- Mock dependencies: MenuComponent (stub), IonRouterOutlet
- Procena: 1 fajl, ~3 test case-a

**WU-23: Layout -- MenuComponent**
- Faza: Phase 2
- Prioritet: P1
- Scope: Navigation links, dark mode toggle (calls ThemeService.setDarkMode), language change (calls TranslationService.setLanguage), logout (calls AuthService.logout + MenuController.close), app version loading (native vs web), feature flag gating of menu items.
- Source fajlovi: `src/app/layout/menu/menu.component.ts`
- Tip testa: component-test
- Output: `src/app/layout/menu/menu.component.spec.ts`
- Mock dependencies: AuthService, AuthStore, ConfigStore, ThemeService, TranslationService, Router, MenuController, LoggerService, App (Capacitor), FeatureFlagDirective
- Procena: 1 fajl, ~14 test case-ova

**WU-62: DocsListPage component test**
- Faza: Phase 2
- Prioritet: P2
- Scope:
  - Component creates successfully
  - `ionViewWillEnter` calls `docsService.loadFolder()` with no arguments
  - `onEntryClick` with folder entry (isFolder === true) calls `docsService.loadFolder(entry.fullPath)`
  - `onEntryClick` with file entry (isFolder === false) calls `docsService.openFile(entry)`
  - `goBack` calls `docsService.goBack()`
  - Icons registered in constructor (documentOutline, folderOutline, arrowBackOutline)
- Source fajlovi: `src/app/features/docs/list/docs-list.page.ts`
- Tip testa: component-test
- Output: `src/app/features/docs/list/docs-list.page.spec.ts`
- Mock dependencies: DocsService
- Procena: 1 fajl, ~6 test case-ova

**WU-63: AppComponent smoke test**
- Faza: Phase 2
- Prioritet: P2
- Scope:
  - Component creates successfully
  - Template renders `ion-app` containing `ion-router-outlet`
- Source fajlovi: `src/app/app.component.ts`
- Tip testa: component-test
- Output: `src/app/app.component.spec.ts`
- Mock dependencies: IonApp, IonRouterOutlet (Ionic stubs)
- Procena: 1 fajl, ~2 test case-a

**WU-64: app.routes.ts routing configuration**
- Faza: Phase 2
- Prioritet: P1
- Scope:
  - Total route count verification (1 login + 1 shell parent = 2 top-level; shell has 15 children including redirect)
  - Login route: path 'login', lazy loads LoginPage
  - Shell route: path '', lazy loads ShellComponent, `canActivate: [authGuard]`
  - Each child route with `canMatch: [featureGuard('X')]`:
    - 'search-by-device' -> featureGuard('deviceCatalog')
    - 'device/:code/device-groups' -> featureGuard('deviceCatalog')
    - 'device/:code/device-groups/:groupId/device-parts' -> featureGuard('deviceCatalog')
    - 'docs' -> featureGuard('documentation')
    - 'cart' -> featureGuard('cart')
    - 'search-by-user' -> featureGuard('deviceManagement')
    - 'device-management/:sn/add-user' -> featureGuard('deviceManagement')
    - 'device-management/:sn/add-device' -> featureGuard('deviceManagement')
    - 'device-management/:sn/annual-service' -> featureGuard('deviceManagement')
    - 'device-management/:sn/intervention' -> featureGuard('deviceManagement')
    - 'device-management/:sn/history/:id' -> featureGuard('deviceManagement')
    - 'device-management/:sn/history' -> featureGuard('deviceManagement')
    - 'device-management/:sn' -> featureGuard('deviceManagement')
  - Default redirect: '' -> 'home' (pathMatch: 'full')
  - 'home' route has NO canMatch guard (always accessible when authenticated)
  - All routes use lazy loading (loadComponent)
- Source fajlovi: `src/app/app.routes.ts`
- Tip testa: unit
- Output: `src/app/app.routes.spec.ts`
- Mock dependencies: nema (pure route config analysis)
- Procena: 1 fajl, ~12 test case-ova

**WU-65: main.ts bootstrap / CLEARABLE_SERVICES verification**
- Faza: Phase 2
- Prioritet: P1
- Scope:
  - All 11 CLEARABLE_SERVICES registered: DeviceSearchService, DeviceGroupsService, DevicePartsService, CartService, DocsService, PartDetailService, DeviceLookupService, DeviceRegistrationService, InterventionService, AnnualServiceEligibilityService, PhotoService
  - Transloco configured with: availableLangs = BUNDLED_LANGUAGES, defaultLang = DEFAULT_LANGUAGE, reRenderOnLangChange = true
  - FirestoreTranslocoLoader provided as loader
  - appInitializer registered via provideAppInitializer
  - RouteReuseStrategy set to IonicRouteStrategy
  - `registerSwiperElements()` called (at module level, before bootstrapApplication)
- Source fajlovi: `src/main.ts`
- Tip testa: unit (integration-style -- bootstrap verification)
- Output: `src/main.spec.ts`
- Mock dependencies: Ovo je bootstrap test -- moze zahtevati TestBed.configureTestingModule sa patchovanim providerima, ili staticku analizu providers array-a
- Procena: 1 fajl, ~6 test case-ova

---

### PHASE 3 -- Single-feature work units

**WU-24: features/auth/login -- LoginPage**
- Faza: Phase 3
- Prioritet: P0
- Scope: Form validation (email pattern, required), onLogin success flow (setUser -> bootstrap -> navigate home), onLogin error (wrong credentials, too many requests, network error, generic), loading state, menu disable/enable on init/destroy.
  **getErrorMessage grane (explicitno navedene, v2):**
  - `auth/user-not-found` -> returns `login_error_wrong_credentials` translation
  - `auth/wrong-password` -> returns `login_error_wrong_credentials` translation
  - `auth/invalid-credential` (Firebase v10 format, replaces user-not-found/wrong-password in newer versions) -> returns `login_error_wrong_credentials` translation
  - `auth/too-many-requests` -> returns `login_error_too_many_attempts` translation
  - `auth/network-request-failed` -> returns `login_error_no_internet` translation
  - Generic fallback (unknown error) -> returns `login_error_generic` translation
  - Error stringification: verifikacija da `String(error)` se koristi (ne `error.code` ili `error.message`)
- Source fajlovi: `src/app/features/auth/login/login.page.ts`
- Tip testa: component-test
- Output: `src/app/features/auth/login/login.page.spec.ts`
- Mock dependencies: AuthService, AuthStore, ConfigStore, SessionService, LoggerService, Router, FormBuilder, MenuController, TranslocoService
- Procena: 1 fajl, ~19 test case-ova

**WU-25: features/cart -- CartService**
- Faza: Phase 3
- Prioritet: P0
- Scope: addItem (new, existing increment), removeItem, increaseQuantity, decreaseQuantity (to 1 -> remove, above 1), clearItems, clear (items + context), computed signals (itemCount, totalPrice, currency), context management.
  **Additional scenario (added v2):**
  - `decreaseQuantity` for non-existent partCode -> no-op (early return because `find` returns undefined, if(!item) return)
- Source fajlovi: `src/app/features/cart/cart.service.ts`
- Tip testa: unit
- Output: `src/app/features/cart/cart.service.spec.ts`
- Mock dependencies: nema
- Procena: 1 fajl, ~19 test case-ova

**WU-26: features/cart -- CartPage**
- Faza: Phase 3
- Prioritet: **P1** (changed from P2 in v1 -- order email is business-critical)
- Scope: onNoteChange, onOrder (email template generation with items/total/warranty/user info, EmailComposer.open call with correct recipients per device type), navigateTo.
- Source fajlovi: `src/app/features/cart/cart.page.ts`
- Tip testa: component-test
- Output: `src/app/features/cart/cart.page.spec.ts`
- Mock dependencies: CartService, ConfigStore, AuthStore, TranslocoService, Router, LoggerService, EmailComposer (Capacitor plugin)
- Procena: 1 fajl, ~12 test case-ova

**WU-27: features/photo-upload -- PhotoService + CameraService**
- Faza: Phase 3
- Prioritet: P1
- Scope: PhotoService: setRequirement, takePhoto (canTakeMore check, camera call, photo array push), pickFromGallery, removePhoto, uploadPhotos (path construction with tenant/collection/sn/date, per-photo upload, error handling per photo), isMinimumMet, canTakeMore, clear. CameraService: takePhoto/pickFromGallery (success, cancel, empty paths).
- Source fajlovi: `src/app/features/photo-upload/services/photo.service.ts`, `src/app/features/photo-upload/services/camera.service.ts`, `src/app/features/photo-upload/models/photo.model.ts`
- Tip testa: unit
- Output: `src/app/features/photo-upload/services/photo.service.spec.ts`, `src/app/features/photo-upload/services/camera.service.spec.ts`
- Mock dependencies: CameraService (for PhotoService), Camera (Capacitor, for CameraService), StorageService, TenantService, ConfigStore, LoggerService
- Procena: 2 fajla, ~24 test case-ova

**WU-28: features/photo-upload -- PhotoUploadPage**
- Faza: Phase 3
- Prioritet: P2
- Scope: onAddPhoto (action sheet with camera/gallery), onRemovePhoto, onOk/onDismiss (modal dismiss).
- Source fajlovi: `src/app/features/photo-upload/photo-upload.page.ts`
- Tip testa: component-test
- Output: `src/app/features/photo-upload/photo-upload.page.spec.ts`
- Mock dependencies: PhotoService, ModalController, ActionSheetController, TranslocoService
- Procena: 1 fajl, ~8 test case-ova

**WU-29: features/home -- HomePage**
- Faza: Phase 3
- Prioritet: P1
- Scope: searchBySn (trim, empty guard, device found -> navigate, not found -> toast), scanBarcode (success, user cancel OS-PLUG-BARC-0006, error), navigateTo.
- Source fajlovi: `src/app/features/home/home.page.ts`
- Tip testa: component-test
- Output: `src/app/features/home/home.page.spec.ts`
- Mock dependencies: AuthStore, TenantStore, ConfigStore, Router, DeviceLookupService, ToastController, TranslocoService, CapacitorBarcodeScanner, FeatureFlagDirective
- Procena: 1 fajl, ~12 test case-ova

**WU-30: features/docs -- DocsService (GAP analiza)**
- Faza: Phase 3
- Prioritet: P2
- Scope: Postojeci spec pokriva nesto. Gap: loadFolder (success, error, isLoading guard), openFile (Browser.open), goBack (root check, path truncation), clear/reset, isRoot, currentFolderName.
- Source fajlovi: `src/app/features/docs/services/docs.service.ts`, `src/app/features/docs/models/doc.model.ts`
- Tip testa: unit
- Output: Dopuna postojeceg `docs.service.spec.ts`
- Mock dependencies: StorageService, LoggerService, Browser (Capacitor)
- Procena: 0 novih fajlova, ~8 novih test case-ova

**WU-31: features/device-catalog (GAP analiza + POTENTIAL BUG test)**
- Faza: Phase 3
- Prioritet: P2
- Scope: Postojeci spec fajlovi pokrivaju device-search, device-groups, device-parts, part-detail servise i device-groups/device-parts/search page-ove + part-detail-modal. Gap analiza na svaki, dodavanje testova za nepokrivene grane (stale search cancellation, keepState, allowedTypes filtering).
  **Expanded page component gap analysis (v2):**
  - `DeviceSearchPage`: ionViewWillEnter keepState true (skips reset) vs keepState false (calls reset), onSearchInput empty -> reset, onSearchInput value -> search, loadMore, onDeviceClick sets keepState = true + navigates
  - `DeviceGroupsPage`: gap analysis on existing spec
  - `DevicePartsPage`: gap analysis on existing spec
  **POTENTIAL BUG test (added v2):**
  - `DeviceSearchService.mapToDevice` line 133: `type: (data['Device type'] as Device['type']) ?? undefined!` -- when `data['Device type']` is undefined/null, result is `undefined!` which is `undefined` at runtime (the `!` is TypeScript non-null assertion, has no runtime effect). This is DIFFERENT from `DeviceLookupService.mapToDevice` which uses `DeviceType.BOILER` as fallback. Test should verify that when Device type field is missing, the mapped device has `type === undefined` -- and separately verify that `.filter((device) => allowedTypes.includes(device.type))` correctly EXCLUDES such devices (since `allowedTypes.includes(undefined)` returns false). This is a latent bug that happens to work by accident for the filter case but would crash if the device were used downstream.
- Source fajlovi: svi u `src/app/features/device-catalog/`
- Tip testa: unit + component-test
- Output: Patch na postojece spec fajlove
- Mock dependencies: vec definisani
- Procena: 0 novih fajlova, ~18 novih test case-ova

**WU-32: features/device-management -- models (intervention.model, device-env-info.model)**
- Faza: Phase 3
- Prioritet: P1
- Scope: InterventionModel: enum completeness, COMMISSIONING_TYPES/ANNUAL_SERVICE_TYPES/INTERVENTION_OPTIONS mapping za svaki DeviceType, display field lists, hidden fields. DeviceEnvInfoModel: requiresEnvInfo function, ENV_INFO_FIELDS/SECTIONS za HEAT_PUMP i GAS_BOILER, field config structure validation.
- Source fajlovi: `src/app/features/device-management/models/intervention.model.ts`, `src/app/features/device-management/models/device-env-info.model.ts`
- Tip testa: unit
- Output: `src/app/features/device-management/models/intervention.model.spec.ts`, `src/app/features/device-management/models/device-env-info.model.spec.ts`
- Mock dependencies: nema
- Procena: 2 fajla, ~20 test case-ova

**WU-33: features/device-management/services -- DeviceLookupService**
- Faza: Phase 3
- Prioritet: P0
- Scope: extractModelCode (config-driven start/length), lookup (full flow: extract code -> fetch -> mapToDevice -> device type allowed check), lookupSilent (no state mutation), lookup with not found, lookup with disallowed type, empty model code, Firestore error, clear.
- Source fajlovi: `src/app/features/device-management/services/device-lookup.service.ts`
- Tip testa: unit
- Output: `src/app/features/device-management/services/device-lookup.service.spec.ts`
- Mock dependencies: FirestoreService, ConfigStore, TenantService, LoggerService
- Procena: 1 fajl, ~18 test case-ova

**WU-34: features/device-management/services -- DeviceRegistrationService**
- Faza: Phase 3
- Prioritet: P0
- Scope: checkRegistration (found, not found, error), register (success, server time unavailable, Firestore error), registerBatch (atomic write, server time unavailable, Firestore error), getPurchaseDateFormatted (Date, Firestore timestamp, string, null), getWarrantyEndDateFormatted (with/without extendedWarrantyMonths, no warrantyMonths, no dateOfPurchase), toDate private method edge cases, clear.
- Source fajlovi: `src/app/features/device-management/services/device-registration.service.ts`
- Tip testa: unit
- Output: `src/app/features/device-management/services/device-registration.service.spec.ts`
- Mock dependencies: FirestoreService, AuthStore, ServerTimeService, LoggerService
- Procena: 1 fajl, ~24 test case-ova

**WU-35: features/device-management/services -- InterventionService**
- Faza: Phase 3
- Prioritet: P0
- Scope: saveIntervention (success, server time unavailable, Firestore error), getInterventionsBySn (results sorted by date, empty, error), getInterventionById (found, null, error), getRegistration, getInterventionLabel (commissioning, annual, intervention options, unknown), saveInterventionBatch (success, server time unavailable, Firestore error), toTimestamp private method (Firestore timestamp, Date, string, null, invalid), clear.
- Source fajlovi: `src/app/features/device-management/services/intervention.service.ts`
- Tip testa: unit
- Output: `src/app/features/device-management/services/intervention.service.spec.ts`
- Mock dependencies: FirestoreService, AuthStore, ServerTimeService, LoggerService
- Procena: 1 fajl, ~28 test case-ova

**WU-36: features/device-management/services -- AnnualServiceEligibilityService**
- Faza: Phase 3
- Prioritet: P0 (CRITICAL -- complex algorithm)
- Scope: checkEligibility full flow (all DisableReason paths), determineEligibility algorithm (warranty expired, missed annual service, already serviced, outside window, eligible, extended warranty impact), extractParams (all null checks, NaN checks, firstServiceYear < 1), monthsDiff, toDate, hasServiceInWindow. This is the most complex business logic in the app and must have exhaustive boundary testing.
- Source fajlovi: `src/app/features/device-management/services/annual-service-eligibility.service.ts`
- Tip testa: unit
- Output: `src/app/features/device-management/services/annual-service-eligibility.service.spec.ts`
- Mock dependencies: InterventionService, ServerTimeService, LoggerService
- Procena: 1 fajl, ~40 test case-ova (highest density WU)

**WU-37: features/device-management/services -- DeviceEnvInfoService**
- Faza: Phase 3
- Prioritet: P1
- Scope: collectEnvInfo (modal save, modal cancel), viewEnvInfo (read-only modal), getLastEnvInfo (with envInfo, without, empty, reverse traversal).
- Source fajlovi: `src/app/features/device-management/services/device-env-info.service.ts`
- Tip testa: unit
- Output: `src/app/features/device-management/services/device-env-info.service.spec.ts`
- Mock dependencies: ModalController, InterventionService, LoggerService
- Procena: 1 fajl, ~10 test case-ova

**WU-38: features/device-management/services -- UserSearchService**
- Faza: Phase 3
- Prioritet: P1
- Scope: search (single field firstName, single field lastName, both fields intersection logic, min length guard, stale search cancellation), loadMore, clear, mergeResults deduplication, sorting.
  **Additional scenario (added v2):**
  - `business()` null scenario: `this.configStore.business()!.userSearchPageSize` -- when `business()` returns null, the non-null assertion `!` will cause a runtime error (`Cannot read properties of null (reading 'userSearchPageSize')`). Test should verify that if configStore.business() returns null, calling `search()` throws (or verify this is a known precondition). This exposes a potential runtime vulnerability.
- Source fajlovi: `src/app/features/device-management/services/user-search.service.ts`
- Tip testa: unit
- Output: `src/app/features/device-management/services/user-search.service.spec.ts`
- Mock dependencies: FirestoreService, TenantService, ConfigStore, LoggerService
- Procena: 1 fajl, ~23 test case-ova

**WU-39: features/device-management -- DeviceDetailPage**
- Faza: Phase 3
- Prioritet: P0
- Scope: ionViewWillEnter (SN extraction, initializeDevice flow), initializeDevice (lookup, registration check, commissioning check, annual eligibility check), isOperational (all conditions), isAnnualServiceEnabled, needsConnectedDevice, scanConnectedBarcode (success, cancel, error), onAddUser (with/without connected device), validateConnectedDevice (empty SN, not found, no connectedDevice flag, wrong type, same model, already registered, success), navigation methods.
- Source fajlovi: `src/app/features/device-management/device-detail/device-detail.page.ts`
- Tip testa: component-test
- Output: `src/app/features/device-management/device-detail/device-detail.page.spec.ts`
- Mock dependencies: DeviceLookupService, DeviceRegistrationService, AnnualServiceEligibilityService, InterventionService, ConfigStore, ActivatedRoute, Router, ToastController, TranslocoService, CapacitorBarcodeScanner, ChangeDetectorRef
- Procena: 1 fajl, ~30 test case-ova

**WU-40: features/device-management -- AddUserPage**
- Faza: Phase 3
- Prioritet: P0
- Scope: Form construction/validation, showDateOfPurchase logic, openDatePicker (column building), onSave (form validation, data preparation with search fields, warranty status logic for date handling, commissioning date vs manual date, confirm dialog, single vs batch registration, success/error toast, navigation), toLatinUpperCase (Cyrillic + Latin diacritics + mixed), ionViewWillEnter (SN + connectedSn from route).
  **Additional scenarios (added v2):**
  - `onSave` removes `callAccepted` for non-annualService devices: when `device.annualService === false`, `delete data['callAccepted']` (lines 167-169) -- verify the saved data does NOT contain callAccepted key
  - `onSave` `dateOfPurchase` handling -- all 3 branches:
    - `warrantyStatus === 'out_of_warranty'` -> `delete data['dateOfPurchase']` (date field removed from saved data)
    - `device.commissioning === true` -> `data['dateOfPurchase'] = serverTime` (Date from ServerTimeService.getServerTime)
    - Manual date input (non-commissioning, in_warranty) -> `data['dateOfPurchase'] = new Date(year, month - 1, day)` parsed from DD.MM.YYYY format
  - `onSave` server time unavailable for commissioning -> shows danger toast, returns early without saving
- Source fajlovi: `src/app/features/device-management/add-user/add-user.page.ts`
- Tip testa: component-test
- Output: `src/app/features/device-management/add-user/add-user.page.spec.ts`
- Mock dependencies: DeviceLookupService, DeviceRegistrationService, ServerTimeService, ConfirmService, ActivatedRoute, Router, ToastController, TranslocoService, PickerController
- Procena: 1 fajl, ~31 test case-ova

**WU-41: features/device-management -- AddDevicePage (Commissioning)**
- Faza: Phase 3
- Prioritet: P0
- Scope: Form validation, ionViewWillEnter (photo requirement setup from config, warrantyInfo calculation), showPhotosButton, onAddPhotos, getWarrantyInfo (within 1 year, over 1 year), getManufactureDateFromSn (SN parsing, leap year, edge dates), onSave (validation, photo check, envInfo collection for HP/GB, confirm for non-envInfo types, loading alert, photo upload, single vs batch save, success/error handling).
  **Additional scenarios (added v2):**
  - `showNoPhotosAlert` flow:
    - `onSave` with interventionPhotos feature enabled + photoRequirement set + no photos taken -> calls `showNoPhotosAlert` which calls `confirmService.confirm`:
      - User cancels (confirm returns false) -> save is ABORTED, no intervention saved
      - User confirms (confirm returns true) -> save PROCEEDS without photos
  - These tests verify the `const proceed = await this.showNoPhotosAlert(); if (!proceed) return;` logic at lines 133-134
- Source fajlovi: `src/app/features/device-management/add-device/add-device.page.ts`
- Tip testa: component-test
- Output: `src/app/features/device-management/add-device/add-device.page.spec.ts`
- Mock dependencies: DeviceLookupService, InterventionService, DeviceEnvInfoService, ConfirmService, LoadingAlertService, PhotoService, ConfigStore, ActivatedRoute, Router, ToastController, ModalController, TranslocoService, LoggerService
- Procena: 1 fajl, ~30 test case-ova

**WU-42: features/device-management -- InterventionPage**
- Faza: Phase 3
- Prioritet: P0
- Scope: ionViewWillEnter (device data, fault/error options from config, photo config), updateInterventionTypes (warranty-based filtering, annual service append for out_of_warranty), updatePhotoRequirement, spare parts add/remove (max limit), form validation (warranty, type, description, photo count with spare part photos), onSave (envInfo collection with prefill, photo upload, save success/error), onExplodedView (cart context setup from intervention + registration data, warranty validation), resetForm.
- **NOTE**: This WU is BLOCKED until BUG-01 (console.log in lines 150/157) is resolved. Tests should be written to test the EXPECTED behavior (using LoggerService), but the test will initially fail due to the bug. Do NOT adjust the test to match the buggy code.
- Source fajlovi: `src/app/features/device-management/intervention/intervention.page.ts`
- Tip testa: component-test
- Output: `src/app/features/device-management/intervention/intervention.page.spec.ts`
- Mock dependencies: DeviceLookupService, InterventionService, DeviceEnvInfoService, DeviceRegistrationService, CartService, ConfirmService, LoadingAlertService, PhotoService, ConfigStore, ActivatedRoute, Router, ToastController, ModalController, TranslocoService, LoggerService
- Procena: 1 fajl, ~32 test case-ova

**WU-43: features/device-management -- AnnualServicePage**
- Faza: Phase 3
- Prioritet: P1
- Scope: ionViewWillEnter (service type resolution, no device guard, no service type guard), form validation (callAccepted required), onSave (envInfo for HP/GB, confirm for others, save, connected device auto-save for HEAT_PUMP), saveForConnectedDevice (lookup, save, not found warning).
  **saveForConnectedDevice explicit scenarios (expanded v2):**
  - **Skipped for non-HEAT_PUMP**: when `device.type !== DeviceType.HEAT_PUMP` (e.g., GAS_BOILER) -> method returns immediately at line 138, `interventionService.getRegistration` is NEVER called
  - **Skipped when registration has no connectedDevice field**: when `registration?.['connectedDevice']` is undefined or null -> early return at line 143, `lookupService.lookup` is NEVER called
  - **Connected device not found**: when `lookupService.lookup(connectedSn)` returns null -> logs warning, shows warning toast 'annual_service_connected_not_found', does NOT attempt to save
  - **Successful save for connected device**: when lookup returns device -> calls `interventionService.saveIntervention(connectedSn, connectedDevice, data)`, logs info
- Source fajlovi: `src/app/features/device-management/annual-service/annual-service.page.ts`
- Tip testa: component-test
- Output: `src/app/features/device-management/annual-service/annual-service.page.spec.ts`
- Mock dependencies: DeviceLookupService, InterventionService, DeviceEnvInfoService, ConfirmService, LoadingAlertService, ActivatedRoute, Router, ToastController, TranslocoService, LoggerService
- Procena: 1 fajl, ~22 test case-ova

**WU-44: features/device-management -- InterventionHistoryPage**
- Faza: Phase 3
- Prioritet: P1
- Scope: ionViewWillEnter (SN, device lookup if stale), loadHistory (registration header construction with commissioning-header vs registration source, intervention items with COMMISSIONING filtered out, date formatting), openDetail (clickable guard, commissioning-header special case, registration id case, regular intervention), formatDate/toDateString helpers.
- Source fajlovi: `src/app/features/device-management/intervention-history/intervention-history.page.ts`
- Tip testa: component-test
- Output: `src/app/features/device-management/intervention-history/intervention-history.page.spec.ts`
- Mock dependencies: DeviceLookupService, InterventionService, ActivatedRoute, Router, ToastController, TranslocoService, LoggerService
- Procena: 1 fajl, ~18 test case-ova

**WU-45: features/device-management -- InterventionDetailPage**
- Faza: Phase 3
- Prioritet: P1
- Scope: ionViewWillEnter (SN, id from route, device lookup if stale), loadDetail (intervention vs registration, notFound case), buildDisplayFields (ordered fields, field label keys, spare part suffix), resolveRawValue (interventionType label lookup, callAccepted boolean to i18n, warrantyStatus mapping, date formatting, spareParts array join), isTranslatable, onViewEnvInfo, formatDate/toDateString helpers.
- Source fajlovi: `src/app/features/device-management/intervention-detail/intervention-detail.page.ts`
- Tip testa: component-test
- Output: `src/app/features/device-management/intervention-detail/intervention-detail.page.spec.ts`
- Mock dependencies: InterventionService, DeviceLookupService, DeviceEnvInfoService, ActivatedRoute, LoggerService
- Procena: 1 fajl, ~20 test case-ova

**WU-46: features/device-management -- SearchByUserPage**
- Faza: Phase 3
- Prioritet: P1
- Scope: ionViewWillEnter, ionViewDidLeave (state preservation when navigating to device-management, clear otherwise), onSearch, onLoadMore, onResultClick.
- Source fajlovi: `src/app/features/device-management/search-by-user/search-by-user.page.ts`
- Tip testa: component-test
- Output: `src/app/features/device-management/search-by-user/search-by-user.page.spec.ts`
- Mock dependencies: UserSearchService, ConfigStore, Router
- Procena: 1 fajl, ~10 test case-ova

**WU-47: features/device-management/components -- DeviceEnvInfoModalComponent**
- Faza: Phase 3
- Prioritet: P1
- Scope: ngOnInit (sections/fields setup per device type, form building, prefill), onSave (validation -- all fields required, confirm dialog, modal dismiss with data), onDismiss (cancel), readOnly mode (form disabled, no save button), HEAT_PUMP vs GAS_BOILER field configurations.
- Source fajlovi: `src/app/features/device-management/components/device-env-info-modal/device-env-info-modal.component.ts`
- Tip testa: component-test
- Output: `src/app/features/device-management/components/device-env-info-modal/device-env-info-modal.component.spec.ts`
- Mock dependencies: ModalController, ToastController, TranslocoService, ConfirmService
- Procena: 1 fajl, ~16 test case-ova

---

### PHASE FINAL -- Cross-feature integration E2E

**PRE-REQUISITE (BLOCKER for WU-48 through WU-61):**
Firebase Emulator setup OR Playwright network interceptor alternative must be resolved before implementing any E2E tests in this phase.

**Option A (Recommended): Firebase Emulator**
- Requires `firebase.json` with emulator configuration (Auth, Firestore, Storage, Functions)
- Seed scripts for test data (users, devices, interventions, config)
- `e2e/playwright.config.ts` updated to start emulator before tests via `globalSetup`
- Pros: realistic test environment, tests actual Firebase behavior
- Cons: setup complexity, CI pipeline changes needed

**Option B (Alternative): Playwright Network Interceptors**
- Mock all Firebase REST API calls via `page.route()` interceptors
- Create interceptor helpers in `e2e/fixtures/firebase-interceptors.ts`
- Return pre-defined JSON responses for Auth, Firestore, and Storage calls
- Pros: no external dependencies, fast, predictable
- Cons: does not test actual Firebase SDK behavior, fragile if SDK changes internal URLs

**Decision needed from ARCH level before Phase Final implementation begins.**

**WU-48: E2E -- Login + tenant resolve + config load + home + search device by SN**
- Faza: Phase Final
- Prioritet: P0
- Scope: Full authentication flow through home page to device detail. Requires Firebase Emulator or network interceptors.
- Tip testa: E2E
- Output: `e2e/tests/integration/login-to-device-detail.spec.ts`
- Procena: 1 fajl, ~8 test case-ova

**WU-49: E2E -- Search by user + device detail + add user + register device**
- Faza: Phase Final
- Prioritet: P0
- Scope: User search -> select result -> device detail -> add user form -> save registration.
- Tip testa: E2E
- Output: `e2e/tests/integration/user-search-to-registration.spec.ts`
- Procena: 1 fajl, ~6 test case-ova

**WU-50: E2E -- Commissioning flow (general data + env-info modal + save + warranty start)**
- Faza: Phase Final
- Prioritet: P0
- Scope: Device detail -> commissioning -> form fill -> env-info modal (for HP/GB) -> save -> navigate back -> commissioning done reflected.
- Tip testa: E2E
- Output: `e2e/tests/integration/commissioning-flow.spec.ts`
- Procena: 1 fajl, ~8 test case-ova

**WU-51: E2E -- Intervention flow (warranty + fault + env-info + photos + save + history)**
- Faza: Phase Final
- Prioritet: P0
- Scope: Device detail -> intervention -> warranty selection -> type -> description -> spare parts -> env-info -> photos -> save -> history -> detail view.
- Tip testa: E2E
- Output: `e2e/tests/integration/intervention-flow.spec.ts`
- Procena: 1 fajl, ~10 test case-ova

**WU-52: E2E -- Annual service flow (eligibility + fault + env-info + save)**
- Faza: Phase Final
- Prioritet: P1
- Scope: Device detail -> annual service (only when eligible) -> form -> env-info -> save -> connected device auto-save.
- Tip testa: E2E
- Output: `e2e/tests/integration/annual-service-flow.spec.ts`
- Procena: 1 fajl, ~6 test case-ova

**WU-53: E2E -- History + intervention detail (read-only env-info, photos)**
- Faza: Phase Final
- Prioritet: P1
- Scope: History page -> registration header -> intervention items -> detail page -> env-info read-only modal.
- Tip testa: E2E
- Output: `e2e/tests/integration/history-detail-flow.spec.ts`
- Procena: 1 fajl, ~6 test case-ova

**WU-54: E2E -- Cart flow (device-parts + add to cart + cart + order email)**
- Faza: Phase Final
- Prioritet: P1
- Scope: Intervention -> exploded view -> device groups -> parts -> add to cart -> cart page -> order email with context.
- Tip testa: E2E
- Output: `e2e/tests/integration/cart-order-flow.spec.ts`
- Procena: 1 fajl, ~8 test case-ova

**WU-55: E2E -- Photo upload integration in intervention/commissioning**
- Faza: Phase Final
- Prioritet: P1
- Scope: Photo modal -> take photo / gallery -> remove -> minimum check -> save with upload.
- Tip testa: E2E
- Output: `e2e/tests/integration/photo-upload-flow.spec.ts`
- Procena: 1 fajl, ~6 test case-ova

**WU-56: E2E -- Connected device flow (search related SN, validate, batch save)**
- Faza: Phase Final
- Prioritet: P1
- Scope: Device detail with connectedDevice flag -> enter connected SN -> validation (wrong type, same model, already registered) -> add user batch -> commissioning batch.
- Tip testa: E2E
- Output: `e2e/tests/integration/connected-device-flow.spec.ts`
- Procena: 1 fajl, ~8 test case-ova

**WU-57: E2E -- i18n switching during flow**
- Faza: Phase Final
- Prioritet: P2
- Scope: Login -> menu -> switch language -> verify translations on home page -> navigate to feature -> verify feature translations.
- Tip testa: E2E
- Output: `e2e/tests/integration/i18n-switching.spec.ts`
- Procena: 1 fajl, ~4 test case-a

**WU-58: E2E -- Feature flag gating**
- Faza: Phase Final
- Prioritet: P1
- Scope: Verify that disabled features (cart, documentation, bugReport, etc.) are not accessible via menu or direct URL navigation. Verify enabled features are visible.
- Tip testa: E2E
- Output: `e2e/tests/integration/feature-flag-gating.spec.ts`
- Procena: 1 fajl, ~11 test case-ova (one per feature flag)

**WU-59: E2E -- Auth guard + session expiry + re-login**
- Faza: Phase Final
- Prioritet: P0
- Scope: Existing E2E tests cover unauthenticated guard behavior. Extend with: session expiry simulation (clear auth state -> verify redirect), re-login after expiry.
- Tip testa: E2E
- Output: `e2e/tests/integration/auth-session-lifecycle.spec.ts`
- Procena: 1 fajl, ~6 test case-ova

**WU-60: E2E -- Offline/no-internet scenarios**
- Faza: Phase Final
- Prioritet: P2
- Scope: Simulate offline mode -> verify graceful degradation (cached config used, error toasts, no crash). Limited by Playwright's ability to simulate offline on Capacitor.
- Tip testa: E2E
- Output: `e2e/tests/integration/offline-resilience.spec.ts`
- Procena: 1 fajl, ~4 test case-a

**WU-61: E2E -- Multi-tenant isolation**
- Faza: Phase Final
- Prioritet: P2
- Scope: Verify tenant-scoped cache keys (existing tests partially cover this), no cross-tenant data leakage in localStorage, distinct config per tenant.
- Tip testa: E2E
- Output: `e2e/tests/integration/multi-tenant-isolation.spec.ts`
- Procena: 1 fajl, ~4 test case-a

---

### B. Sumarna statistika

- **Total Work Units**: 65 (was 61 in v1; added WU-62, WU-63, WU-64, WU-65)
- **Total novih test fajlova**: ~60 (was ~52 in v1; added 7 new model specs, docs-list spec, app-component spec, routes spec, main spec, i18n-model spec)
- **Total novih test case-ova**: ~863 (was ~785 in v1; net increase ~78 from expanded WUs + 4 new WUs)
- **P0 (Critical)**: WU-01, 02, 07, 12, 13, 14, 15, 16, 17, 20, 21, 24, 25, 33, 34, 35, 36, 39, 40, 41, 42, 48, 49, 50, 51, 59
- **P1 (Important)**: WU-03, 04, 05, 06, 08, 09, 18, 19, 23, **26** (promoted from P2), 27, 29, 32, 37, 38, 43, 44, 45, 46, 47, 52, 53, 54, 55, 56, 58, **64**, **65**
- **P2 (Nice-to-have)**: WU-10, 11, 22, 28, 30, 31, 57, 60, 61, **62**, **63**

---

## C. Globalna mock strategija

### Firebase Auth
- **Unit**: Mock `FirebaseAuthentication` (Capacitor plugin) -- `signInWithEmailAndPassword`, `signOut`, `getIdToken`, `addListener` za authStateChange. Pattern: `jasmine.createSpyObj` ili manual spy object sa `and.resolveTo()`.
- **E2E**: Firebase Emulator ili real test credentials u `.env.test`. Za unauthenticated E2E tests (vec implementirano) -- nista mockovati, koristiti natural redirect to /login.

### Firebase Firestore
- **Unit**: Mock `FirebaseFirestore` (Capacitor plugin) -- `getDocument`, `getCollection`, `setDocument`, `addDocument`, `writeBatch`. Svaki metod kao spy koji vraca `Promise`. Podatke kontrolisati kroz `and.resolveTo()`.
- **E2E**: Firebase Emulator sa seed podacima ili interceptovanje network poziva. Za E2E bez Emulator-a, testirati samo unauthenticated flows.

### Firebase Storage
- **Unit**: Mock `FirebaseStorage` (Capacitor plugin) -- `getDownloadUrl`, `listFiles`, `uploadFile`. Za web fallback, mock `getStorage`/`ref`/`getDownloadURL`/`listAll` iz `firebase/storage`.
- **E2E**: Mock kroz network intercept ili Firebase Emulator.

### Firebase Functions
- **Unit**: Mock `FirebaseFunctions` (Capacitor plugin) -- `callByName`. Return controlled `{ data: { timestamp: number } }`.
- **E2E**: Firebase Emulator za Cloud Functions.

### Capacitor Plugins
- **BarcodeScanner**: `jasmine.createSpyObj('CapacitorBarcodeScanner', ['scanBarcode'])`. Simulirati success (ScanResult), cancel (code: 'OS-PLUG-BARC-0006'), error.
- **Camera**: `jasmine.createSpyObj('Camera', ['getPhoto'])`. Return mock `{ webPath, path }` ili throw za cancel.
- **Browser**: `jasmine.createSpyObj('Browser', ['open'])`.
- **Preferences**: `jasmine.createSpyObj('Preferences', ['get', 'set', 'remove', 'clear'])`. In-memory map za simulaciju persistence. **IMPORTANT**: TranslationCacheService uses `Preferences` from `@capacitor/preferences` DIRECTLY, not `PreferencesService` wrapper. Mock accordingly.
- **Keyboard, StatusBar, Haptics**: Unlikely to need, but mock as empty spies if imported.
- **EmailComposer**: `jasmine.createSpyObj('EmailComposer', ['open'])`.
- **App**: `jasmine.createSpyObj('App', ['getInfo'])` -- return `{ version: '1.0.0' }`.

### Transloco
- **Unit**: Koristiti `TranslocoTestingModule` iz `@jsverse/transloco` sa in-memory translations. Alternativno, mock `TranslocoService` sa `translate` spy koji vraca key (passthrough). Pattern iz postojecih testova: `inject(TranslocoService)` mock.
- **E2E**: Real translations (bundled sr/en).

### Angular Router
- **Unit**: `provideRouter([])` sa spy na `Router.navigate` ili `Router.createUrlTree`. Za guards, koristiti `TestBed` sa `RouterModule.forRoot([])`.
- **E2E**: Real routing.

### Ionic Controllers (ModalController, AlertController, ToastController, PickerController, LoadingController, ActionSheetController, MenuController)
- **Unit**: `jasmine.createSpyObj` sa simuliranim `create` koji vraca mock element sa `present`/`dismiss`/`onDidDismiss`.
- Pattern:
```typescript
const mockToastCtrl = jasmine.createSpyObj('ToastController', ['create']);
mockToastCtrl.create.and.resolveTo({ present: jasmine.createSpy(), dismiss: jasmine.createSpy() });
```

### LoggerService
- **Unit**: `jasmine.createSpyObj('LoggerService', ['debug', 'info', 'warn', 'error'])`. Koristi se u skoro svakom testu.

### SignalStore Singleton Pattern
- **IMPORTANT (added v2)**: All stores (ConfigStore, AuthStore, TenantStore) are `providedIn: 'root'` singletons. To prevent test pollution:
  - Use `TestBed.overrideProvider()` to inject fresh instances per test suite
  - OR call store's `clear()` method in `beforeEach` to reset state
  - OR use `TestBed.resetTestingModule()` between test suites (performance cost)
  - Pattern:
```typescript
beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [ConfigStore] // fresh instance per test
  });
  const store = TestBed.inject(ConfigStore);
  store.clear(); // explicit reset
});
```

---

## D. Folder/file naming konvencije

### Unit testovi
- **Lokacija**: Pored source fajla (`<file>.spec.ts`)
- **Primer**: `src/app/core/auth/auth.service.spec.ts`
- **Naming**: `describe('<ClassName>')` sa nested `describe` za svaki public metod

### E2E feature testovi
- **Lokacija**: `e2e/tests/<feature>/<scenario>.spec.ts`
- **Primer**: `e2e/tests/device-management/device-detail.spec.ts`
- **Naming**: `test.describe('<Feature> - <Scenario>')`

### E2E integration testovi (cross-feature)
- **Lokacija**: `e2e/tests/integration/<flow-name>.spec.ts`
- **Primer**: `e2e/tests/integration/commissioning-flow.spec.ts`

### Test helpers/fixtures
- **Unit helpers**: **`src/app/testing/`** direktorijum (changed from `src/testing/` for Angular CLI compatibility -- automatic include u `tsconfig.spec.json`)
  - `src/app/testing/mock-factories.ts` -- factory funkcije za Firebase, Ionic, Capacitor mock-ove
  - `src/app/testing/test-data-builders.ts` -- builder pattern za Device, AppConfig, AuthUser, itd.
  - `src/app/testing/transloco-testing.ts` -- TranslocoService test setup helper
- **E2E fixtures**: `e2e/fixtures/`
  - `e2e/fixtures/test-data.ts` -- seed podaci (user credentials, device SNs, config)
  - `e2e/fixtures/firebase-interceptors.ts` -- (if Option B chosen) Playwright route interceptors for Firebase API
- **E2E Page Objects**: `e2e/pages/`
  - `e2e/pages/login.page.ts`
  - `e2e/pages/home.page.ts`
  - `e2e/pages/device-detail.page.ts`
  - `e2e/pages/add-user.page.ts`
  - `e2e/pages/commissioning.page.ts`
  - `e2e/pages/intervention.page.ts`
  - `e2e/pages/cart.page.ts`
  - `e2e/pages/menu.page.ts`

---

## E. Test fixture/helper struktura

### Unit Mock Factories (`src/app/testing/mock-factories.ts`)
```typescript
// createMockFirestoreService() -- returns jasmine spy object
// createMockLoggerService() -- returns spy with debug/info/warn/error
// createMockTenantService() -- with getCurrentTenantId, getCollectionPath, etc.
// createMockConfigStore() -- with isFeatureEnabled, business, features, theme signals
// createMockAuthStore() -- with isAuthenticated, userEmail, userId signals
// createMockToastController() -- returns mock that creates presentable toast
// createMockModalController() -- returns mock that creates presentable modal with onDidDismiss
// createMockAlertController() -- returns mock that creates presentable alert
// createMockRouter() -- with navigate spy
// createMockTranslocoService() -- passthrough translate
// createMockPreferences() -- in-memory key-value store (for Capacitor Preferences plugin DIRECT mock)
// createMockClearableServices() -- returns array of 11 mock Clearable objects
```

### Unit Test Data Builders (`src/app/testing/test-data-builders.ts`)
```typescript
// buildDevice(overrides?: Partial<Device>): Device
// buildAppConfig(overrides?: Partial<AppConfig>): AppConfig
// buildAuthUser(overrides?: Partial<AuthUser>): AuthUser
// buildCartItem(overrides?: Partial<CartItem>): CartItem
// buildFirestoreTimestamp(date: Date): { seconds: number }
// buildRegistrationData(overrides?: Record<string, unknown>): Record<string, unknown>
// buildInterventionData(overrides?: Record<string, unknown>): Record<string, unknown>
// buildServicer(overrides?: Partial<Servicer>): Servicer
// buildPart(overrides?: Partial<Part>): Part
// buildPartGroup(overrides?: Partial<PartGroup>): PartGroup
// buildDeviceUser(overrides?: Partial<DeviceUser>): DeviceUser
// buildHeatPumpSetup(overrides?: Partial<HeatPumpSetup>): HeatPumpSetup
// buildGasBoilerSetup(overrides?: Partial<GasBoilerSetup>): GasBoilerSetup
```

### E2E Page Objects (`e2e/pages/`)
Svaki Page Object:
- Enkapsulira Ionic-specific selektore (`ion-input[formControlName="x"] input`)
- Provides typed metode za interakciju
- Handles Ionic modal/alert dismiss patterns
- Pattern iz vec videnog `ConfigPage` u `config.spec.ts`

---

## F. Coverage target i exit criteria

### Coverage targets po sloju:
- **Servisi** (core + feature services): **90%+ line coverage, 85%+ branch coverage**
- **Stores** (AuthStore, ConfigStore, TenantStore): **95%+ line coverage**
- **Komponente/Pages**: **75%+ line coverage, 70%+ branch coverage**
- **Shared utilities/models/pipes/directives**: **100% line coverage**
- **Guards**: **100% branch coverage** (svaki if/else)
- **E2E key flows** (14 cross-feature flows): **100% flow coverage** (svaki flow prolazi end-to-end)

### Production-ready exit kriterijumi:
1. Svi P0 Work Units implementirani i PASS (0 failures)
2. Svi P1 Work Units implementirani i PASS
3. Minimum 80% overall line coverage (`ng test --code-coverage`)
4. 0 flaky testova (3 consecutive CI runs bez intermittent failure)
5. Svaki error path (catch blok) ima bar 1 test
6. Svaki `if/else` branch u servisima ima bar 1 test
7. Svaki feature flag ima bar 1 test za enabled i 1 za disabled stanje
8. E2E: Svi 14 cross-feature flows prolaze na Chromium
9. Nema `fdescribe` ili `fit` (fokusiranih testova) u kodu
10. Nema `xdescribe` ili `xit` (preskocenih testova) osim sa dokumentovanim razlogom
11. **0 direct console.log/error/warn calls in production code** (added v2) -- verified by lint rule or grep scan. All logging MUST go through LoggerService.

---

## G. Rizici i otvorena pitanja

### Rizici:

1. **Capacitor plugin testiranje na browser-u**: Camera, BarcodeScanner, EmailComposer, App.getInfo -- ovi pluginovi ne rade u browser okruzenju. Unit testovi moraju kompletno mockovati ove plugin-e. E2E testovi za photo/barcode flow-ove moraju koristiti stub/mock na nivou Playwright-a ili biti oznaceni kao `test.skip` za CI bez device-a.

2. **Firebase Emulator setup za E2E (BLOCKER for Phase Final)**: Trenutno E2E testovi rade bez Firebase-a (testiraju samo unauthenticated flows). Za PHASE FINAL E2E testove (WU-48 do WU-61) potreban je Firebase Emulator setup sa seed podacima ILI alternativa sa Playwright network interceptorima. Ovo zahteva: `firebase.json` konfiguraciju, seed scripts za Firestore/Auth/Storage, i update `e2e/playwright.config.ts` da pokrece emulator pre testova. **BEZ resenja ovog blocker-a, WU-48 do WU-61 ne mogu biti implementirani.** Alternativa: Playwright `page.route()` interceptori za Firebase REST API pozive (manje realisticno ali brze za setup).

3. **Flaky E2E timing**: Ionic animacije, async state updates, i network latencija mogu izazvati flaky testove. Mitigacija: koriscenje `page.waitForLoadState('networkidle')`, Playwright auto-waiting, i explicit `expect().toBeVisible({ timeout: ... })` sa razumnim timeout-ovima.

4. **NgRx SignalStore testing**: SignalStore je relativno nov pattern i nema zreo testing util. Testiranje computed signala zahteva patch state -> read signal -> assert. `TestBed.inject()` radi za singleton store-ove, ali nested composition moze biti problematican.

5. **SignalStore singleton pollution (added v2)**: Svi store-ovi (ConfigStore, AuthStore, TenantStore) su `providedIn: 'root'` singletons. Ovo znaci da stanje iz jednog testa moze "curti" u drugi test ako se ne resetuje. Mitigacija: eksplicitni `store.clear()` u `beforeEach` svakog testa, ili `TestBed.overrideProvider()` za fresh instance. Ovo je OBAVEZNO za sve testove koji koriste store-ove.

6. **Private method access**: Postojeci testovi koriste `(service as any).privateProp = mock` pattern za inject-ovanje mock zavisnosti. Ovo je fragile ali neophodan za servise koji koriste `inject()` a ne constructor injection. Razmotriti kreiranje helper-a `overrideInjection(service, 'fieldName', mock)`.

7. **`src/app/testing/` vs `src/testing/` Angular CLI compatibility (added v2)**: Angular CLI `tsconfig.spec.json` automatski uklucuje fajlove pod `src/app/`. Fajlovi u `src/testing/` (van `src/app/`) zahtevaju manuelno dodavanje u `include` array. Koriscenjem `src/app/testing/` putanje ovo se izbegava. Svi helper fajlovi MORAJU biti u `src/app/testing/`.

8. **Swiper registration verifikacija (added v2)**: `registerSwiperElements()` se poziva na module level u `main.ts` PRE `bootstrapApplication()`. Ovo je side-effect koji se tesko testira u izolaciji. Za WU-65 (main.ts test), moze se verifikovati importom i spy-jem na `register` funkciju, ali rizik je da se Swiper elements registruju globalno i uticu na druge testove.

9. **TranslationCacheService koristi Preferences direktno (added v2)**: `TranslationCacheService` importuje `Preferences` iz `@capacitor/preferences` DIREKTNO -- NE koristi `PreferencesService` wrapper. Ovo znaci da mock-ovanje `PreferencesService` u testovima za `TranslationCacheService` NECE raditi. Mock mora biti na nivou `Preferences` plugina (spy na `Preferences.get`, `Preferences.set`).

10. **Connected device flow test complexity**: Validacija connected device-a u DeviceDetailPage zahteva kompleksan setup (dva razlicita device-a sa connectedDevice flag-om, isti tip ali razlicit model). Test data builder mora podrzavati ove scenarije.

11. **HomePage ima TEMP upload metod**: `uploadTranslations()` i povezani import-i su oznaceni sa `[TEMP:translation-upload]`. Ovi se ne testiraju, ali treba ih ukloniti pre production-a.

---

### Otkriveni bagovi

**BUG-01 (BLOCKER za WU-42): `console.log` u intervention.page.ts**
- Lokacija: `src/app/features/device-management/intervention/intervention.page.ts`, linije 150 i 157
- Opis: `console.log('DEBUG_INT: updatePhotoRequirement intType=' + ...)` i `console.log('DEBUG_INT: photoRequirement=', ...)`
- Krsi konvenciju: "NIKAD direktno console.log" iz CLAUDE.md i angular-conventions.md
- Ozbiljnost: BLOCKER za Phase 3 testiranje InterventionPage (WU-42). Testovi ce biti napisani za OCEKIVANO ponasanje (koristeci LoggerService), sto znaci da ce padati dok se bug ne popravi.
- Preporuka: Ukloniti obe `console.log` linije ili zameniti sa `this.logger.debug(...)`. Mora biti reseno PRE implementacije WU-42 testova.

**BUG-02 (POTENTIAL BUG): `DeviceSearchService.mapToDevice` koristi `undefined!` za type fallback**
- Lokacija: `src/app/features/device-catalog/services/device-search.service.ts`, linija 133
- Opis: `type: (data['Device type'] as Device['type']) ?? undefined!` -- kada `data['Device type']` nije prisutan u Firestore dokumentu, `undefined!` se evaluira kao `undefined` u runtime-u (TypeScript non-null assertion nema runtime efekat). Ovo je RAZLICITO od `DeviceLookupService.mapToDevice` koji koristi `DeviceType.BOILER` kao fallback.
- Posledica: Device objekat sa `type === undefined` prolazi filtraciju (`allowedTypes.includes(undefined)` vraca false, pa se device iskljucuje iz rezultata), ali ako bi se device koristio downstream (npr. prosleden drugom servisu), `type` bi bio `undefined` sto moze izazvati runtime crash.
- Ozbiljnost: POTENCIJALNI BUG -- latentni problem koji radi "slucajno" u trenutnom kodu ali moze crashovati u buducnosti.
- Preporuka: Zameniti `undefined!` sa `DeviceType.BOILER` (kao u DeviceLookupService) ili logicki konzistentnim fallback-om.

---

### Otvorena pitanja (RESOLVED from v1):

1. **features/bugs, features/history, features/service direktorijumi**: CONFIRMED EMPTY -- ne ukljucuj u plan.
2. **features/service/ vs device-management/**: CONFIRMED -- "service" logika je realizovana kroz device-management podstranice (add-device, intervention, annual-service).
3. **Shared pipes, components, utils**: CONFIRMED EMPTY -- ne ukljucuj u plan.
4. **Firebase Emulator**: Ostaje kao BLOCKER za Phase Final -- opcije dokumentovane u WU-48 pre-requisite sekciji.
5. **Report modul** (`src/app/core/report/`): CONFIRMED -- samo prazan `templates/` poddirektorijum, nema servisa. Skip.

---

Relevantni fajlovi koji su procitani i analizirani:
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/app.routes.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/main.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/app.component.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/auth/auth.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/auth/auth.store.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/auth/auth.guard.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/config/config.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/config/config.store.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/config/config.model.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/config/feature.guard.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/firebase/firestore.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/firebase/storage.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/firebase/server-time.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/firebase/firebase-init.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/tenant/tenant.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/tenant/tenant.store.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/session/session.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/session/clearable.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/initializer/app-initializer.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/logger/logger.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/logger/logger.model.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/logger/transports/console.transport.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/storage/preferences.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/http/capacitor-http.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/theme/theme.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/theme/logo-cache.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/i18n/translation.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/i18n/translation-cache.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/i18n/firestore-transloco-loader.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/core/i18n/i18n.model.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/shared/directives/feature-flag.directive.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/shared/services/confirm.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/shared/services/loading-alert.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/shared/models/device.model.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/shared/models/group.model.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/shared/models/intervention.model.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/shared/models/part.model.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/shared/models/servicer.model.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/shared/models/setup.model.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/shared/models/user.model.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/auth/login/login.page.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/home/home.page.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/cart/cart.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/cart/cart.page.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/photo-upload/services/photo.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/photo-upload/services/camera.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/photo-upload/models/photo.model.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/photo-upload/photo-upload.page.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/docs/services/docs.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/docs/list/docs-list.page.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/docs/models/doc.model.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-catalog/services/device-search.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-catalog/services/device-groups.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-catalog/services/device-parts.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-catalog/services/part-detail.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-catalog/search/device-search.page.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/models/intervention.model.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/models/device-env-info.model.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/services/device-lookup.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/services/device-registration.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/services/intervention.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/services/annual-service-eligibility.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/services/device-env-info.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/services/user-search.service.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/device-detail/device-detail.page.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/add-user/add-user.page.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/add-device/add-device.page.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/intervention/intervention.page.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/annual-service/annual-service.page.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/intervention-detail/intervention-detail.page.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/intervention-history/intervention-history.page.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/search-by-user/search-by-user.page.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/features/device-management/components/device-env-info-modal/device-env-info-modal.component.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/layout/menu/menu.component.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/src/app/layout/shell/shell.component.ts`
- `/Users/zlatomirposarac/Projects/serviceAppV2/e2e/playwright.config.ts`
- Svi postojeci E2E spec fajlovi u `e2e/tests/`
- Svi postojeci unit spec fajlovi navedeni u zadatku
