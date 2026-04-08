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

## Pravila za pozivanje agenata (KRITICNO)
- Kada pozivas agenta, UVEK koristi `subagent_type` parametar sa tacnim imenom agenta (npr. `subagent_type: "test-architect"`)
- Ovo automatski ucitava definiciju agenta iz `.claude/agents/{ime}.md` fajla
- U `prompt` parametru Agent tool-a proslijedi SAMO kontekst zadatka (sta treba uraditi, koji fajlovi, koji feedback od reviewera)
- NIKADA ne prepisuj ulogu, opis, osobine ili instrukcije agenta u prompt-u — one su vec definisane u njegovom .md fajlu
- Ovo pravilo vazi za SVE koji pozivaju agente: skill-ove, lead agente, i glavnog Claude-a

## Hijerarhija agenata i eskalacija (KRITICNO)

### Nivoi autoriteta (od najvišeg ka najnižem):
1. **ARCH agenti** (najviši nivo) — architect, implement-architect, implement-arch-reviewer, test-architect, test-arch-reviewer
   - Donose finalne arhitekturne odluke
   - Njihova odluka se NAJVIŠE ceni i ima najvecu tezinu
   - Jedini koji mogu odobriti promene u aplikacijskom kodu
2. **LEAD agenti** (srednji nivo) — test-lead, implement-lead
   - Koordiniraju rad tima
   - Donose operativne odluke u okviru odobrene arhitekture
3. **WRITER/IMPLEMENTER agenti** (najniži nivo) — test-writer, test-implementer, test-case-writer, implement-developer, implement-spec-writer
   - Izvršavaju zadatke prema specifikacijama i arhitekturi
   - NEMAJU autoritet da samostalno menjaju aplikacijski kod ili odstupaju od zadatka

### Pravila eskalacije:
- Agenti nižeg nivoa MORAJU tražiti mišljenje ARCH agenta kada:
  - Test pada i nije jasno da li je bug u testu ili u aplikaciji
  - Imaju bilo kakvu dilemu oko implementacije
  - Smatraju da treba izmeniti aplikacijski kod
  - Nešto nije pokriveno specifikacijom/arhitekturom
- **NIKADA** agent nižeg nivoa ne sme sam menjati aplikacijski kod — to UVEK zahteva odluku ARCH agenta
- **NIKADA** agent nižeg nivoa ne sme sam donositi odluke van svog zadatka — sve nesigurnosti eskalirati na ARCH nivo
- REVIEWER agenti (test-code-reviewer, implement-code-reviewer, test-case-reviewer, implement-spec-reviewer) mogu samo prijaviti probleme i tražiti reviziju — ne smeju sami menjati kod

## Test tim (agenti)
- `/test-full` — kompletni pipeline: arhitektura → implementacija → review
- `/test-plan` — dizajnira test arhitekturu (test-architect ←→ test-arch-reviewer, iterativno)
- `/test-implement` — implementira testove (test-lead koordinira test-case-writer/reviewer + test-implementer/code-reviewer)
- Pravilo: NIKAD ne menjati test da bi prošao — ako pada, utvrditi da li je bug u testu ili u aplikaciji

## Implementacioni tim (agenti)
- `/implement-full` — kompletni pipeline: arhitektura → specifikacije → implementacija → review
- `/implement-plan` — dizajnira implementacionu arhitekturu (implement-architect ←→ implement-arch-reviewer, iterativno)
- `/implement-execute` — implementira feature (implement-lead koordinira implement-spec-writer/reviewer + implement-developer/code-reviewer)
- Pravilo: zavisnosti se implementiraju PRVO (modeli → servisi → store-ovi → komponente → rute)
