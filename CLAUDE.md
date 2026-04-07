# serviceAppV2 — Ariston Service App

## Komande
- Build: `ng build`
- Serve: `ng serve`
- Test: `ng test`
- E2E: `npx playwright test --config=e2e/playwright.config.ts`
- Lint: `ng lint`

## Arhitektura
- Angular 20 + Ionic 8 + Capacitor 8
- Standalone komponente (NIKAD NgModules)
- NgRx SignalStore za state (signals, ne BehaviorSubject)
- Firebase backend (Firestore, Storage, Auth)
- Multi-tenant: putanje `envs/{env}/tenants/{tenantId}/...`

## Konvencije
- Servisi: jedan servis = jedan domen (auth, config, tenant...)
- Komponente: OnPush change detection gde je moguće
- Svaki feature je lazy-loaded kroz routes
- Feature flags kontrolišu vidljivost kroz ConfigStore.isFeatureEnabled()
- i18n ključevi: feature_element format (login_submit, menu_title)
- Logger: koristi LoggerService, nikad direktno console.log

## Kvalitet koda
- Posle implementacije koristi code-reviewer agenta za review
- Posle pisanja koda koristi test-writer agenta za testove
- Za arhitekturne odluke konsultuj architect agenta
