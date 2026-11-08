---
name: servicer-manual
description: Generiše PDF uputstvo za servisere (mobilna servisna app, Ionic/Capacitor, white-label brendovi) za izabrani brend — sa stvarnim katalogom brenda, izmišljenim kupcima, automatskim snimcima ekrana u iOS izgledu, QR kodovima za App Store/Google Play i automatskim sadržajem. Koristi kad korisnik kaže npr. "generiši uputstvo za servisnu app za brend X", "napravi uputstvo za servisere za ariston-srb", ili traži izmenu postojećeg uputstva za servisere.
---

# Uputstvo za servisere — postupak

Rezultat: PDF istog kvaliteta kao `reference/tiki-manual.html` (Tiki, 17 strana): naslovna sa ikonicom app,
sadržaj u jednoj koloni sa brojevima strana, 12 poglavlja, ~24 snimka telefona, QR kodovi, česta pitanja.

**Pročitaj pre rada:** `reference/style.md` (obavezna pravila korisnika), `reference/screens.md` (ekrani, tekstovi,
šta zavisi od podešavanja), `brands/tiki.json` (primer konfiguracije).

## Bezbednosna pravila (NE PREGOVARA SE)
1. **Produkcija se samo čita** (`kit/prod-read.cjs`) i to samo podešavanja + katalog (devices, Sklopovi, Rezervni delovi, priceList, Storage Photos/Documents/logo). Nikad `users`, intervencije ni drugi lični podaci. Nikad upis.
2. **Repo mobilne app**: korisnik ima svoje necommitovane izmene. Pre bilo kakve izmene `kit/mobile/repo.sh backup`, posle snimanja ODMAH `repo.sh restore` i pokaži korisniku proveru (status/diff/SHA ISTI). Nikad `git stash`, `git checkout` tuđih fajlova, `set-brand`, `cap sync`, build u `www/`, commit.
   Diraju se samo: `src/app/core/initializer/app-initializer.ts` (umetnut blok), novi `src/app/core/firebase/demo-emulators.ts`, generisani (gitignored) `src/environments/environment.prod.ts`.
3. Sve radne datoteke (podaci, snimci, HTML, PDF međufajlovi) idu u **scratchpad** sesije, ne u repo.
4. Pre svake izmene u repou ukratko reci korisniku šta menjaš i da imaš backup.

## 0. Pitaj korisnika (ako nije rekao)
- Brend (folder `brands/<id>/` u repou) i **tenant** (`tenants/<tenantId>`; jedan Firebase projekat može imati više tenanata, npr. srb/slo/hr).
- Naziv app za uputstvo, šta se kuca u pretrazi prodavnice, **App Store i Google Play link** (za QR).
- Kako se zove kontakt osoba (podrazumevano „osoba koja upravlja servisnom mrežom").
- Gde da sačuva PDF (podrazumevano SAMO `serviceAppV2/docs/Uputstvo-<Naziv-App>-serviseri.pdf`; admin repo čuva samo admin uputstvo).
- Firebase CLI mora biti ulogovan nalogom koji ima pristup projektu brenda (`firebase login:list`, `firebase projects:list`).

## 1. Radni folder
```bash
REPO=/Users/zlatomirposarac/Projects/Ariston/serviceAppV2
SKILL=$REPO/.claude/skills/servicer-manual
W=<scratchpad>/manual-<brand>          # npr. .../scratchpad/manual-ariston-srb
mkdir -p $W && cp -R $SKILL/kit/. $W/ && cd $W && npm i --no-audit --no-fund
python3 -m venv $W/py && $W/py/bin/pip -q install pypdfium2 pypdf pillow
BR=$W/brand.json; D=$W/data; O=$W/mshots
cp $SKILL/brands/<brand>.json $BR 2>/dev/null || cp $SKILL/brands/tiki.json $BR   # pa izmeni (korak 2)
```
Potrebno na mašini: Node, Firebase CLI (`firebase`), Java (emulatori), Google Chrome (Playwright `channel: chrome`), python3.
Komande sa `sleep` u petlji su OK; za duge procese koristi `run_in_background`.

## 2. Podešavanja brenda → brand.json
```bash
node prod-read.cjs $BR $D config     # config.json, version.json
node prod-read.cjs $BR $D models     # spisak modela sa tipom i commissioning/annual/connected
```
Iz `config.json` utvrdi i zapiši (biće potrebno za tekst): `business.snType`, `snModelStart/Length`, `appMode`,
`interventionCollections`, `features.*`, `theme.appTitle` (proveri tipfelere — kod Tiki „Tiki Servs"), `startInfo`, `minAppVersion`.
Popuni `brand.json`:
- `firebaseProject`, `tenantId`, `storageBucket` (iz `brands/<id>/google-services.json` → `project_info`), `accentColor` (`brands/<id>/brand.json` → `primaryColor`), linkovi, nazivi.
- `catalog.models`: 2–3 modela istog (najčešćeg) tipa; `searchTerm`/`searchResultModelName` da pretraga pogodi model.
- `demo.registeredDevices`: SN mora odgovarati formatu (split: `code` = `<model 6 cifara>/<2 cifre>`, `ser` = 10 cifara; single: `code: null`, `ser` = ceo SN dužine snMin..snMax, a model kod na poziciji snModelStart/Length).
- `demo.interventions`: `fault`/`location` ključevi iz `config.interventionFaultOptions[tip]` / `interventionLocationOptions[tip]` (proveri da postoje u `src/app/core/i18n/translations/sr.ts`, inače se vidi sirov ključ); delove uzmi iz kataloga posle exporta (korak 3).
- `demo.flows`: tekstovi opcija kako se PRIKAZUJU (prevod iz sr.ts, npr. „KRATAK SPOJ", „GREJAČ"); `newCustomer` SN koji NIJE među registrovanima; `historyDevice.openRowDate` = datum jedne seed intervencije tog uređaja (dd.mm.yyyy).
- Ako uređaji brenda imaju commissioning/annualService/connectedDevice ili su heat-pump/gas-boiler: ti tokovi NISU pokriveni skriptom → dodaj blokove u `shots.mjs` (vidi screens.md 9, 13) ili ih opiši bez slike.

## 3. Izvoz kataloga i probni dokumenti
```bash
node prod-read.cjs $BR $D export     # devices, catalog (Sklopovi+delovi), prices, Storage (crteži, Documents, logo)
node make-docs.mjs $BR $D            # probni PDF-ovi iz demo.extraDocuments (ako brend ima malo dokumenata)
```
Proveri `catalog.json` (nazivi delova za `partNameToOpen`/`secondPartName`, šifre za `interventions.parts`) i da su crteži preuzeti (`data/storage/Photos`).

## 4. Emulator + demo podaci
```bash
cd $W/emu && firebase emulators:start --only auth,firestore,storage --project demo-<brand>   # run_in_background
# čekaj da 8085, 9099, 9199 odgovaraju (curl petlja), pa:
cd $W && node seed.mjs $BR $D        # briše i puni emulator (može se ponavljati)
```
Emulator koristi otvorena pravila (`emu/*.rules`) — samo za snimke. Projekat je `demo-<brand>` (nikad ne ide na prave servere).

## 5. Privremeno povezivanje mobilne app sa emulatorom
```bash
bash $W/mobile/repo.sh backup  $REPO $W/backup          # pokaži korisniku ispis
bash $W/mobile/repo.sh apply   $REPO $W/backup <brand>
cd $REPO && npx ng serve --configuration production --port 8100 --host 127.0.0.1    # run_in_background
# čekaj http://127.0.0.1:8100 → 200
```
Ne koristi se native build ni simulator: app radi u Chrome-u (Playwright, iPhone viewport, `?ionic:mode=ios`), a
`@capacitor-firebase/*` web implementacije se povezuju na emulator (`demo-emulators.ts`).

## 6. Snimci
```bash
cd $W && node shots.mjs $BR $D $O              # svi blokovi; ili jedan: ... $O intervention
$W/py/bin/python -I pdf/contact-sheet.py $O $W/sheet-shots   # pa Read sheet-shots-*.png i pregledaj
```
Pre ponovnog CELOG prolaza: `node seed.mjs $BR $D` (adduser/intervention menjaju podatke). Pojedinačne slike pregledaj Read-om.

## 7. ODMAH vrati repo
```bash
pkill -f "ng serve --configuration production --port 8100"
bash $W/mobile/repo.sh restore $REPO $W/backup       # mora: status ISTI, diff ISTI, SHA OK, env ISTI, brend i grana isti
pkill -f "emulators:start --only auth,firestore,storage"   # kad više ne trebaju novi snimci
```
(Ako kasnije trebaju novi snimci: ponovo backup → apply → serve → shots → restore.)

## 8. Tekst uputstva
```bash
cp $SKILL/reference/tiki-manual.html $W/manual.html
cp $REPO/brands/<brand>/assets/icon.png $O/app-icon.png
node pdf/qr.cjs $BR $O                                  # qr-appstore.svg, qr-play.svg
```
Prilagodi `manual.html` (Edit) po brendu i config-u:
- `<title>`, naslovna (naziv, podnaslov, 3 snimka, **današnji datum**), `--accent`/`--accent-soft` boja, ikonica.
- Poglavlje 1: naziv za pretragu prodavnice, QR blok (sakriveni linkovi u dugmadima), nalog, napomena o slikama.
- Poglavlje 3: tekst o unosu SN po `snType` (split: Code 9 zn. + Ser.No. 10 cifara; single: jedno polje + skeniranje barkoda).
- Poglavlje 6: tabela polja po `appMode` (mode2 vs standard — vidi screens.md 11); kilometraža „u oba smera".
- Ukloni poglavlja/rečenice za isključene funkcije (katalog, korpa, Moje intervencije, Dokumentacija, Izveštaj/Auto prikaz) i dodaj za uključene (potpis, puštanje u rad, godišnji servis, instalacija).
- Sadržaj (`.toc`): stavka za svako poglavlje — `<li><span class="n">N</span><span><a href="#id">Naslov</a><span class="d">opis</span></span><span class="pg" data-pg="id"></span></li>`, a poglavlje `<h2 id="id"><span class="num">N</span>Naslov</h2>` (naslov identičan!). Brojeve strana NE upisuj ručno.
- Proveri da nigde nema „održava aplikaciju", „super-admin", Firebase, URL-ova.

## 9. PDF
```bash
cd $W
node pdf/render.mjs manual.html out && $W/py/bin/python -I pdf/finish.py manual.html out final.pdf "<Naziv> — Uputstvo za servisere"
# izlaz 2 = sadržaj ažuriran → ponovi oba koraka dok finish.py ne završi sa 0
$W/py/bin/python -I pdf/contact-sheet.py final.pdf $W/sheet-pdf     # Read i pregledaj svaku stranu
# QR provera (strana sa QR-om, obično 3):
$W/py/bin/python -I pdf/page-to-raw.py final.pdf 3 $W/p3 && node pdf/verify-qr.cjs $W/p3   # ispisuje i linkove dugmadi
```
Proveri: nema praznih strana / usamljenih naslova, opisi ispod slika, svi brojevi u sadržaju popunjeni, QR = tačni linkovi.
Sačuvaj `final.pdf` na dogovoreno mesto i javi korisniku šta je urađeno + uočene probleme u podešavanjima/app (tipfeleri, bagovi iz screens.md).

## Zamke (rešene — ne ponavljaj)
- **Storage bucket u emulatoru = projectId** (`demo-<brand>`, jer rules-unit-testing puni `gs://<projectId>`); ako app traži `*.appspot.com` → crteži i dokumenti „nestanu" („Nema dostupnih dokumenata", nema crteža).
- `page.goto(..., {waitUntil:"networkidle"})` posle prijave visi (Firestore veza otvorena) → `domcontentloaded` + čekaj element.
- Ionic drži skrivene stranice u DOM-u → `ion-button:visible`, `ion-item:visible`, polja po `placeholder`.
- Ionic `scrollAssist/inputShims` pomeraju formu posle unosa → URL `&ionic:scrollAssist=false&ionic:inputShims=false`.
- Spisak delova prikazuje redni broj, ne šifru → deo biraj po nazivu.
- Firebase Auth emulator dodaje natpis na dno → ukloni pre svakog snimka (`#firebase-emulator-warning`).
- Viewport visina 1060 (korisnik tražio da se vide sva polja); 1180 je predugačko.
- zsh: `echo ======` puca (`=` ekspanzija) → koristi navodnike.
- Veliki naslovi u PDF tekstu se izvlače bez razmaka → finish.py poredi bez razmaka (naslovi u TOC i h2 moraju biti isti).
- Naslovna se renderuje posebno (bez podnožja) i spaja sa ostatkom (pypdf) da strana 1 nema broj.
- Python skripte pokreći sa `-I`.
- `@capacitor-firebase/*` imaju `useEmulator` i na webu; native-only Firebase app radi u Chrome-u samo uz `initializeApp` iz demo-emulators.ts.
- Funkcija `getServerTime` (godišnji servis) nije u emulatoru — za brendove sa godišnjim servisom pokreni i functions emulator (`$REPO/functions`, port 5001, dodaj `FirebaseFunctions.useEmulator`) ili opiši bez slike.
