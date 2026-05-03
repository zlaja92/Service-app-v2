# Bagovi otkriveni tokom planiranja test arhitekture (v2)

Otkriveni od strane test-architect i test-arch-reviewer agenata. Korisnik je odlučio da se prvo završi testiranje, a ovi bagovi će se rešiti kasnije.

---

## BUG-01: Direct console.log u InterventionPage (krši konvenciju) ✅ FIXED

**Severity:** Medium (krši CLAUDE.md/angular-conventions.md, ali ne uzrokuje crash)
**Status:** ✅ FIXED 2026-05-04 — obrisane obe console.log linije (debug code, ne pravo logovanje)
**Otkriveno:** test-architect tokom analize WU-42
**Popravka:** Linije 150 i 157 obrisane iz intervention.page.ts. WU-42 TC-IP-BUG01 reaktiviran (xit → it).

### Lokacija
- [src/app/features/device-management/intervention/intervention.page.ts:150](src/app/features/device-management/intervention/intervention.page.ts#L150)
- [src/app/features/device-management/intervention/intervention.page.ts:157](src/app/features/device-management/intervention/intervention.page.ts#L157)

### Problem
Direktni pozivi `console.log('DEBUG_INT: ...')` umesto `this.logger.debug(...)`. Krši pravilo iz CLAUDE.md:
> "Logger: koristi LoggerService, nikad direktno console.log"

### Rešenje
Zameniti sa `this.logger.debug('DEBUG_INT: ...')` ili ukloniti potpuno (ako je debug code koji više nije potreban).

### Posledica za testove
WU-42 (InterventionPage component test) ima napomenu da spy-uje `console.log` i verifikuje da NE biva pozvan. Test će padati dok god je console.log u kodu — to je željeno ponašanje (test će proći tek kad se bag popravi).

---

## BUG-02: DeviceSearchService.mapToDevice koristi `undefined!` za type fallback ✅ FIXED

**Severity:** High (potencijalni runtime crash)
**Status:** ✅ FIXED 2026-05-04 — `mapToDevice` sada vraća `null` za device-e bez tipa, filtriraju se u search()/loadMore() sa `logger.warn`
**Otkriveno:** test-arch-reviewer tokom verifikacije v1
**Popravka:** Korisnik je odbacio `BOILER` fallback (smatra ga "lažnim tipom"). Implementirana defensive opcija: skip + warn. WU-31 testovi ažurirani da očekuju novo ponašanje.

### Lokacija
- [src/app/features/device-catalog/services/device-search.service.ts:133](src/app/features/device-catalog/services/device-search.service.ts#L133)

### Problem
```typescript
type: data['Device type'] as DeviceType ?? undefined!,
```

Koristi `undefined!` (TypeScript non-null assertion na `undefined`) kao fallback ako Firestore dokument nema polje "Device type". Ovo je inkonzistentno sa `DeviceLookupService.mapToDevice` koji koristi:
```typescript
type: (data['Device type'] as DeviceType) ?? DeviceType.BOILER,
```

### Posledica
Ako Firestore vrati dokument bez "Device type" polja:
- `device.type` postaje `undefined`
- Downstream kod koji očekuje `DeviceType` enum vrednost može da pukne
- `allowedTypes.includes(undefined)` vraća `false` — feature radi po nesreći (naizgled radi jer se device samo filtrira), ali nema deterministički fallback

### Rešenje
Promeniti na isti fallback kao u `DeviceLookupService`:
```typescript
type: (data['Device type'] as DeviceType) ?? DeviceType.BOILER,
```

### Posledica za testove
WU-31 (device-catalog gap analiza) ima eksplicitan test koji pokriva ovaj scenario. Test će dokumentovati trenutno (pogrešno) ponašanje sve dok se bag ne popravi, posle čega test treba ažurirati da očekuje `DeviceType.BOILER` fallback.

---

---

## BUG-03: Capacitor Proxy incompatible with Jasmine spyOn — ServerTimeService untestable on success path

**Severity:** HIGH (5 od 11 test case-ova za WU-09 ne mogu biti implementirani bez arhitekturne izmene)
**Status:** Otvoren — zahteva ARCH odluku
**Otkriveno:** test-implementer tokom implementacije WU-09 (ServerTimeService), batch B1, FAZA C

### Lokacija
- `src/app/core/firebase/server-time.service.ts` — koristi `FirebaseFunctions` direktno iz `@capacitor-firebase/functions`
- `@capacitor-firebase/functions/dist/esm/index.js` — `FirebaseFunctions = registerPlugin('FirebaseFunctions', { web: ... })`
- `@capacitor/core/dist/index.cjs.js` — `registerPlugin()` vraca `Proxy({}, { get(_, prop) { ... return createPluginMethodWrapper(prop) } })`

### Problem
`FirebaseFunctions` eksportovan iz `@capacitor-firebase/functions` je ES6 Proxy objekat kreiran sa `registerPlugin()` iz `@capacitor/core`. Proxy ima **samo `get` trap** — pri svakom citanju property-ja poziva `createPluginMethodWrapper(prop)` koji lazily ucitava web implementaciju (`FirebaseFunctionsWeb`).

Proxy nema `set` trap, sto znaci da jasmine `spyOn(FirebaseFunctions, 'callByName')`:
- Uspesno assignuje spy na target objekat `{}` (bez greske)
- Ali `get` trap ignorise target i uvek vraca novi wrapper oko `FirebaseFunctionsWeb.callByName`
- Spy nikad nije pozvan — pravi Firebase SDK baca `FirebaseError: No Firebase App '[DEFAULT]'`

Ovo je **identicno problemu sa `firebase/app`** u `firebase-init.service.spec.ts` (BUG bez broja, dokumentovan kao "Infrastructure Issue" u tom fajlu).

### Verifikacija
Potvrdjeno Node.js probom:
```javascript
const proxy = new Proxy({}, { get(_, prop) { return realImpl[prop].bind(realImpl); } });
proxy.callByName = mockFn; // silently ignored
proxy.callByName === mockFn; // false — get trap vraca realImpl.callByName
```

### Pogodjenost
5 od 11 test case-ova za WU-09 ne mogu biti implementirani (`xit`):
- TC-ST01: Successful fetch returns Date
- TC-ST02: Returns Date instance type check
- TC-ST03: No error logged on success
- TC-ST10: callByName called with correct function name
- TC-ST11: timestamp 0 (epoch) treated as falsy

### Moguca resenja (zahteva ARCH odluku)
1. **Injectable adapter** (preporuceno): Kreirati `FirebaseFunctionsService` injectable koji wraps `FirebaseFunctions.callByName()`. U testovima zameniti kroz DI. `ServerTimeService` bi injectovao adapter umesto direktnog poziva Capacitor Proxy-ja.
2. **Jest migracija**: `jest.mock('@capacitor-firebase/functions')` zaobilazi Proxy na module nivou. Zahteva migraciju test runnera.
3. **Karma test setup**: Pre-registered mock u `karma.conf.js` koji zamenjuje `window.Capacitor.Plugins['FirebaseFunctions']` pre ucitavanja modula. Kompleksno i krhko.

### Posledica za testove
`src/app/core/firebase/server-time.service.spec.ts` — 7 testova prolaze (error paths), 5 su `xit` (blocked). Implementirani testovi verifikuju:
- Servis vraca `null` na greski (ne baca exception)
- `loggerService.error` je pozvan sa ispravnim message-om na gresci
- Return type je Promise

---

## BUG-04: ServerTimeService incorrectly rejects timestamp 0 (Unix epoch) as invalid ✅ FIXED

**Severity:** LOW (edge case — Unix epoch timestamp 0 is practically never a valid server time, but the guard logic is semantically wrong)
**Status:** ✅ FIXED 2026-05-04 — guard `typeof !== 'number' || !Number.isFinite(...)` umesto `!timestamp`. Sada `0`, negativni brojevi i validni Unix timestamp-ovi prolaze; `null/undefined/NaN/Infinity` se odbacuju.
**Otkriveno:** test-implementer tokom implementacije WU-09 (TC-ST11)
**Popravka:** TC-ST11 očekivanje ažurirano (timestamp 0 → `new Date(0)`). Test ostaje `xit` jer je blokiran sa BUG-03 (Capacitor Proxy spy).

### Lokacija
- `src/app/core/firebase/server-time.service.ts`, linija 16

### Problem
```typescript
if (!timestamp || typeof timestamp !== 'number') {
```

Uslov `!timestamp` je truthy kada je `timestamp === 0`. To znaci da bi timestamp `0` (Unix epoch, 1. januar 1970.) bio odbijen kao neispravan i metoda bi vratila `null` umesto `new Date(0)`.

Ispravan uslov treba biti:
```typescript
if (timestamp === null || timestamp === undefined || typeof timestamp !== 'number') {
// ili krace:
if (typeof timestamp !== 'number') {
```

### Ocekivano ponasanje
`getServerTime()` sa timestamp `0` treba da vrati `new Date(0)` (validan Date objekat).

### Stvarno ponasanje
`getServerTime()` sa timestamp `0` vraca `null` i loguje grescu `'ServerTimeService: invalid response'`.

### Posledica
U praksi, serverski timestamp nikad nece biti 0, pa ovo necu uzrokovati bug u produkciji. Medjutim, logicki guard je semanticki pogresan i moze sakriti legitimne edge case-ove ako se opseg timestamp-ova prosiri u buducnosti.

---

## BUG-05: CapacitorHttp is also a Capacitor Proxy — spyOn does not work

**Severity:** MEDIUM (testing infrastructure limitation, same root cause as BUG-03)
**Status:** Otvoren — zahteva ARCH odluku
**Otkriveno:** test-implementer tokom implementacije WU-08 (StorageService), batch B1, FAZA D

### Lokacija
- `src/app/core/firebase/storage.service.ts` — metoda `readFoldersFile` poziva `CapacitorHttp.get({ url })`
- `@capacitor/core` — `CapacitorHttp` je eksportovan kao Proxy objekat

### Problem
`CapacitorHttp` eksportovan iz `@capacitor/core` je Proxy objekat. Iako `Object.getOwnPropertyDescriptor(CapacitorHttp, 'get')` vraca `undefined` (nema own property), `CapacitorHttp.get` radi kroz get trap koji delegira na `CapacitorHttpPluginWeb.get()`.

Jasmine `spyOn(CapacitorHttp, 'get')` pokusava da definiše property na Proxy target-u, ali get trap ignorise own properties — uvek poziva pravi `CapacitorHttpPluginWeb.get()`. Spy nikad nije pozvan.

### Pogodjenost
3 test case-a u WU-08 (StorageService) koja testiraju `readFoldersFile` kroz `CapacitorHttp.get` ne mogu biti implementirani direktno. Zaobideno spy-ovanjem private metode `readFoldersFile` direktno:
```typescript
spyOn(service as any, 'readFoldersFile').and.resolveTo(['folder-a', 'folder-b']);
```

### Moguca resenja (zahteva ARCH odluku)
1. **Injectable adapter**: Kreirati `HttpService` injectable koji wraps `CapacitorHttp.get()`. Testovi bi zamenili adapter kroz DI.
2. **Spy na WebPlugin prototype**: `CapacitorHttpPluginWeb.prototype.get` — slicno kao `FirebaseStorageWeb.prototype` pattern.

---

## BUG-06: StorageService.getFileUrl web path ne handluje greske gracefully ✅ FIXED

**Severity:** MEDIUM (inconsistency — native vs web error handling)
**Status:** ✅ FIXED 2026-05-04 — `getFileUrl` sada return `Promise<string | null>` sa try/catch + warn log
**Otkriveno:** test-implementer tokom analize WU-08 (StorageService), batch B1, FAZA D
**Popravka:**
- `getFileUrl` wrap-uje try/catch oko native i web path-a, vraca null + `logger.warn('Storage getFileUrl failed', ...)`
- `resolveFileUrl` interno uklonjen suvišan try/catch (jer `getFileUrl` više ne baca), pattern: `if (url) return url`
- `readFoldersFile` dobio explicit `if (!url) return [];` posle `getFileUrl` poziva
- `DocsService.openFile` ažuriran — odvojen null check (loguje "no URL") od Browser.open try/catch
- 29 testova ažurirano (12 TC-STGFUE-*, 8 TC-STRFE-*, 4 TC-ST30-37, TC-ST03, 4 DocsService.openFile testa)

### Lokacija
- `src/app/core/firebase/storage.service.ts`, linije 17-19

### Problem
`getFileUrl()` na native platformi propagira reject direktno (ne catch). Na web platformi isto — nema catch bloka. Test case-ovi u specifikaciji opisuju "Returns null on error (graceful)" za native path, ali kod NEMA graceful handling — propagira gresku.

Konkretan kod:
```typescript
async getFileUrl(path: string): Promise<string> {
  if (this.isNative) {
    const result = await FirebaseStorage.getDownloadUrl({ path });
    return result.downloadUrl;  // throws na greski — nema catch
  }
  const storage = getStorage();
  const fileRef = ref(storage, path);
  return getDownloadURL(fileRef);  // throws na greski — nema catch
}
```

`resolveFileUrl()` JESTE graceful — koristi try/catch oko poziva `this.getFileUrl()`. Ali sam `getFileUrl()` nije graceful. Specifikacija WU-08 opisuje TC-ST03 kao "Returns null on error" — to ne odgovara stvarnom ponasanju.

### Ocekivano (prema specifikaciji)
`getFileUrl()` treba da vrati `null` na greski.

### Stvarno
`getFileUrl()` baca (reject) na greski.

### Napomena
TC-ST03 u implementiranim testovima je ispravno implementovan kao `toBeRejectedWithError` (odrazava stvarno ponasanje), a ne kao `toBeNull()` (specifikacija). Test ne laze — testira stvarno ponasanje koda.

---

## BUG-07: EmailComposer Capacitor Proxy — business-critical email logika netestabilna

**Severity:** HIGH (blokira 12 testova za WU-26 CartPage onOrder — business-critical email funkcionalnost)
**Status:** Otvoren — zahteva ARCH odluku
**Otkriveno:** test-implementer tokom WU-26 CartPage, batch B3

### Lokacija
- `src/app/features/cart/cart.page.ts` (linija 101): `await EmailComposer.open(...)`
- `capacitor-email-composer` je registrovan kao Capacitor plugin via `registerPlugin('EmailComposer')`

### Problem
EmailComposer je Capacitor Proxy (isti root cause kao BUG-03). Specificno:
- Proxy `get` trap baca `CapacitorException: "EmailComposer" plugin is not implemented on web` na svaki property access u test okruzenju
- `spyOn(EmailComposer, 'open')` ne radi — Proxy `get` trap ignorise spy
- `Object.defineProperty` ne radi — Proxy ignorise target za metode
- Direktna dodjela `(EmailComposer as any).open = spy` — isti razlog

### Pogodjenost
12 od 26 test case-ova za WU-26 CartPage je `xit` (blocked):
- TC-02 do TC-11: email subject, body, items, total, warranty, user info, recipients
- TC-14, TC-15: isHtml flag, currency formatting

### Posledica za production
Email se salje servisima preko EmailComposer plugin-a sa cenama, warranty info, user data. **Bez testova, regresija u email logici (npr. pogrešan recipient za HEAT_PUMP) moze proci u produkciju neprimecena.**

### Preporuka (ARCH odluka)
1. **Injectable wrapper** (preporuceno): Kreirati `EmailComposerService` injectable koji wraps `EmailComposer.open()`. CartPage injectuje wrapper umesto direktnog poziva. U testovima zameniti kroz DI provider.
2. **Karma webpack alias**: `karma.conf.js` mapira `capacitor-email-composer` na stub modul u test okruzenju.

---

## BUG-08: AddUserPage.showDateOfPurchase ne handluje device === null ✅ FIXED

**Severity:** LOW
**Status:** ✅ FIXED 2026-05-04 — dodat eksplicitan null check na pocetku gettera
**Otkriveno:** test-implementer tokom WU-40, batch B6
**Popravka:** Getter sada radi `if (!device) return false;` pre proveravanja `commissioning` i `warrantyStatus`. TC-AU-09b dodat za eksplicitnu verifikaciju null device + in_warranty scenario.

### Lokacija
- `src/app/features/device-management/add-user/add-user.page.ts` linije 63-66

### Problem
`showDateOfPurchase` getter koristi optional chaining (`device?.commissioning`) ali ne pravi explicit null check. Kada je `device === null` i `warrantyStatus === 'in_warranty'`, getter vraca `true` umesto ocekivanog `false`. Razlog: `null?.commissioning` evaluira na `undefined`, a `!undefined === true`.

### Ocekivano
`false` kada nema ucitanog uredjaja.

### Stvarno
`true` (UI pogresno prikazuje date picker).

### Preporuka
Dodati eksplicitan null check: `if (!this.device) return false;` na pocetku gettera.

---

## BUG-09: AnnualServicePage.saveForConnectedDevice koristi lookup() umesto lookupSilent() ✅ FIXED

**Severity:** LOW (state pollution)
**Status:** ✅ FIXED 2026-05-04 — `lookup` zamenjeno sa `lookupSilent` (linija 145)
**Otkriveno:** test-implementer tokom WU-43, batch B6
**Popravka:** Posle annual service save-a za connected device, globalni `lookupService.device` više nije pollute-ovan connected deviceom — ostaje originalni device. Testovi (postojeci + EXP-AS-CONN-SKIP/FOUND matrix) ažurirani.

### Lokacija
- `src/app/features/device-management/annual-service/annual-service.page.ts` linija 145

### Problem
`saveForConnectedDevice` poziva `this.lookupService.lookup(connectedSn)` umesto `lookupSilent`. `lookup()` mutira `service.device` i `service.sn` state. Posle annual service save-a za connected device, globalni `lookupService.device` state je zamenjen connected deviceom umesto da ostane originalni device.

### Ocekivano
`lookupService.lookupSilent(connectedSn)` — ne mutira state.

### Stvarno
`lookupService.lookup(connectedSn)` — pollute state.

### Preporuka
Zameniti sa `lookupSilent` (vec se koristi na drugim mestima za isti scenario, npr. DeviceDetailPage.validateConnectedDevice).

---

## BUG-10: DeviceEnvInfoModalComponent.readOnly ne disable-uje form ✅ FIXED

**Severity:** MEDIUM (UX inkonzistentnost — readOnly mode dozvoljava izmene)
**Status:** ✅ FIXED 2026-05-04 — `this.form.disable()` dodato u `ngOnInit` posle prefill kada je `readOnly === true`
**Otkriveno:** test-implementer tokom WU-47, batch B6
**Popravka:** Sada postoje dva sloja read-only zaštite: (1) Angular FormGroup disabled (programatsko) i (2) template `ion-input readonly` (DOM). Korisnik više ne može modifikovati vrednosti ni preko keyboard-a ni preko JS-a. TC-EIM-15 i EXP-EIM-RO-FORM-DISABLED ažurirani da očekuju `form.disabled === true`.

### Lokacija
- `src/app/features/device-management/components/device-env-info-modal/device-env-info-modal.component.ts` linije 96-102 (`buildForm()` metoda)

### Problem
Kada je `@Input() readOnly = true`, `buildForm()` kreira form-u sa enabled kontrolama. Template koristi `readonly` HTML atribut na `ion-input` elementima, ali Angular `FormControl`-i ostaju enabled. Korisnik moze da koristi keyboard input ili JS da modifikuje vrednosti.

### Ocekivano
`this.form.disable()` pozvan posle `buildForm()` kada je `this.readOnly === true`.

### Stvarno
`form.disabled` je `false` kada je `readOnly=true`; svi form controli ostaju enabled na nivou Angular forms API-ja.

### Preporuka
U ngOnInit dodati:
```typescript
if (this.readOnly) {
  this.form.disable();
}
```

---

## Akcioni plan

1. ✅ Pokrenuti kompletan test pipeline (B1 → B6 done, B7 pending)
2. ✅ Popraviti BUG-01 (obrisane console.log linije 150, 157 — debug code)
3. ✅ Reaktiviran WU-42 TC-IP-BUG01 test (xit → it)
4. ✅ Popraviti BUG-02 (skip + warn umesto BOILER fallback — odluka korisnika)
5. ✅ Ažurirati WU-31 testove za novo ponašanje
6. ✅ Popraviti BUG-04 (guard `typeof !== 'number' || !Number.isFinite`)
7. ✅ Popraviti BUG-08 (eksplicitan null check na pocetku gettera)
8. ✅ Popraviti BUG-09 (lookup → lookupSilent u AnnualServicePage)
9. ✅ Popraviti BUG-06 (try/catch + null return + DocsService.openFile prilagoden)
10. ✅ Popraviti BUG-10 (form.disable() u ngOnInit)
11. ⏳ ARCH odluka: BUG-03 + BUG-05 (Firebase/Capacitor plugin DI adapter pattern)
12. ⏳ ARCH odluka: BUG-07 (EmailComposer DI wrapper) — bitno pre prod release-a

## Statistika otkrivenih bagova

### Ukupno: 10 bagova otkriveno tokom test pipeline-a

### Status: 7 FIXED ✅ / 3 OTVORENO ⏳

#### FIXED (7)
- ✅ **BUG-01** (LOW): console.log obrisane (intervention.page.ts)
- ✅ **BUG-02** (HIGH): DeviceSearchService.mapToDevice — skip + warn umesto undefined!
- ✅ **BUG-04** (LOW): ServerTimeService timestamp 0 sada validan (Number.isFinite check)
- ✅ **BUG-06** (MEDIUM): StorageService.getFileUrl gracefully (try/catch + null return)
- ✅ **BUG-08** (LOW): AddUserPage.showDateOfPurchase eksplicitan null check
- ✅ **BUG-09** (LOW): AnnualServicePage.saveForConnectedDevice lookup → lookupSilent
- ✅ **BUG-10** (MEDIUM): DeviceEnvInfoModalComponent.readOnly sada poziva form.disable()

#### OTVORENO (3)
- ⏳ **BUG-03** (HIGH): Capacitor Proxy + Jasmine spyOn — zahteva ARCH odluku (DI adapter)
- ⏳ **BUG-05** (MEDIUM): CapacitorHttp Proxy — isti root cause kao BUG-03
- ⏳ **BUG-07** (HIGH): EmailComposer Capacitor Proxy — zahteva ARCH odluku (DI wrapper)

### Po severity-ju
- **HIGH (2)**: BUG-03, BUG-07 — oba ARCH odluka (Capacitor adapter pattern), oba blokiraju tests
- **MEDIUM (1)**: BUG-05 (deo BUG-03 root cause)
- **LOW (0)**: svi LOW fix-ovani ✅

### Preostali bagovi imaju isti root cause
**BUG-03, BUG-05, BUG-07** sve potiču od Capacitor `registerPlugin()` Proxy pattern-a koji blokira `jasmine.spyOn`. Ako se uvede DI adapter (npr. `FirebaseFunctionsService`, `CapacitorHttpService` već postoji ali treba ga koristiti svuda, `EmailComposerService`), sva tri se rešavaju istim arhitektonskim pristupom.

### Test status po bug-u
| Bug | Test status |
|---|---|
| BUG-01 | TC-IP-BUG01 reaktiviran (xit → it), prolazi |
| BUG-02 | WU-31 testovi ažurirani sa novim ocekivanjima, prolaze |
| BUG-03 | 5 testova u WU-09 jos uvek xit (čekaju DI adapter) |
| BUG-04 | TC-ST11 ažuriran sa novim ocekivanjima ali ostaje xit (blokiran sa BUG-03) |
| BUG-05 | StorageService testovi rade preko window.fetch workaround |
| BUG-06 | 29 testova ažurirano (TC-STGFUE-*, TC-STRFE-*, TC-ST30-37, DocsService.openFile), prolaze |
| BUG-07 | 12 testova u WU-26 CartPage xit (čekaju EmailComposer wrapper) |
| BUG-08 | TC-AU-09 napomena ažurirana, dodat TC-AU-09b |
| BUG-09 | Postojeci + EXP-AS-CONN testovi ažurirani |
| BUG-10 | TC-EIM-15 i EXP-EIM-RO-FORM-DISABLED ažurirani da očekuju form.disabled === true, prolaze |

### Trenutno stanje testova
- **11,534 testova ukupno**
- **0 FAILED**
- **29 SKIPPED** (svi xit-ovi su dokumentovani sa BUG-XX referencom)
