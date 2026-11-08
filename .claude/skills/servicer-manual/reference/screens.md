# Mapa ekrana mobilne aplikacije (za pisanje uputstva)

Izvor: pregled koda (novembar 2026, grana `feature/no-device-catalog-implementing`) + provereno u aplikaciji
za brend **tiki** (mode2, snType split). **Pre pisanja za novi brend ponovo proveri** delove koji zavise od
podešavanja (`tenants/{tenant}/settings/config`) i, ako se kod menjao, i same tekstove u
`src/app/core/i18n/translations/sr.ts`.

Uputstvo opisuje SAMO ono što je za brend uključeno (features) i stvarno vidljivo.

## Šta zavisi od podešavanja (config)

| Podešavanje | Uticaj na uputstvo |
|---|---|
| `business.snType = "split"` | Početni ekran ima **Code** (9 zn., npr. 700278/01) i **Ser.No.** (10 zn.), **bez skenera**. SN = Code bez "/" + Ser.No. |
| `snType` nije split | Jedno polje „Unesite serijski broj uređaja" (dužina `snMinLength`–`snMaxLength`, podrazumevano 21) + dugme **Skeniraj barkod**. |
| `business.appMode = "mode2"` | Forma intervencije: Garantni status, **Kvar**, **Lokacija kvara**, **Broj izlazaka na teren** (1–3), Kilometraža, Datum, Šifre delova 1–4, **Opis kvara**, **Opis posla tehničara**. Nema „Tip intervencije", „Greška", „Napomena". |
| standardni režim | Garantni status, **Tip intervencije**, **Opis kvara** (lista), **Greška** (lista, prvo „BEZ GREŠKE"), Kilometraža, Datum, Šifre delova, **Napomena**. |
| `features.deviceCatalog` | „Pretraži po nazivu uređaja", Sklopovi, Rezervni delovi, dugme „Sklopni crtež" u intervenciji. Ako je false: uređaj se prepoznaje po registraciji, a za neregistrovan SN bira se **Tip uređaja**. |
| `features.cart` | „Dodaj u korpu", ikona korpe sa brojem (samo na ekranu delova), Korpa, „Poruči" (otvara email app). |
| `features.pdfReports` | Dugme „Izveštaj" na detaljima intervencije; meni „Auto prikaz izveštaja". |
| `features.servicerReport` | Meni „Moje intervencije" (izveštaj + „Izvezi PDF" — PDF ne zavisi od pdfReports). |
| `features.documentation` | Dugme „Dokumentacija" (Storage folder `Documents`). |
| `features.signatureCapture` + `business.signature.intervention` | Potpis kupca pre čuvanja intervencije (ekran se okreće položeno). |
| `features.bugReport` | Meni „Prijavi grešku" — **pokvaren link (/bugs)**, ne opisivati. |
| `devices/{model}.commissioning` | Dugme „Puštanje u rad" + upozorenje; datum kupovine se tada ne unosi. |
| `devices/{model}.annualService` | Dugme „Godišnji servis" (koristi Cloud funkciju `getServerTime`). |
| `devices/{model}.connectedDevice` | Polje „Povezana jedinica" na detaljima neregistrovanog uređaja. |
| `heat-pump` / `gas-boiler` | Pre čuvanja intervencije otvara se „Informacije o instalaciji" (sva polja obavezna). |
| `business.startInfo` | Obaveštenje pri ulasku — tekst iz prevoda; ako brend ne koristi remote prevode, prikazuje se privremeni tekst (prijavi korisniku). |
| `business.minAppVersion` | Blokirajuće „Aplikacija je zastarela". |
| `theme.appTitle` | Naslov na početnom ekranu (kod Tiki je bilo „Tiki Servs" — tipfeler, prijavljeno). |

Zakucano u kodu (ignoriše config): max 4 dela po intervenciji; pretraga korisnika 20 po strani, min 2 slova; jezici iz brand environment-a.

## Ekrani i tekstovi (srpski)

### 1. Prijava (`/login`)
- Gore desno jezik (kodovi SR / EN / HR / SL po brendu). Ikona naloga, bez loga i naslova.
- „Email" (mora biti ispravan format), „Lozinka". Dugme je **plava strelica bez teksta**, aktivno kad su oba polja ispravna.
- Greške: „Pogrešan email ili lozinka", „Previše pokušaja. Pokušajte ponovo kasnije.", „Nema internet konekcije", „Greška prilikom prijave. Pokušajte ponovo."
- Nema „zaboravljena lozinka" ni registracije. Prijava se pamti.

### 2. Meni (☰ gore desno, naslov „Meni")
„Prijavi grešku" (bugReport, pokvareno) · „Odjavi se" · jezik („Srpski"…) · „Tamni režim" · „Auto prikaz izveštaja" (pdfReports) · „Moje intervencije" (servicerReport). Dno: „Verzija vX.Y.Z" (samo native). Nema stavke „Početna".

### 3. Početni ekran (`/home`)
- Naslov = `theme.appTitle`, logo iz config-a.
- Split: kartice „Code" (placeholder „npr. 700278/01") i „Ser.No." („0123456789"); „Pretraži" aktivno tek kad su oba puna.
- Single: „Unesite serijski broj uređaja" + „Skeniraj barkod" (sken samo popunjava polje; greška „Greška pri skeniranju barkoda").
- Dugmad: „Dokumentacija", „Pretraži po nazivu uređaja", „Pretraži po korisniku".
- Poruke (žuti toast): „Serijski broj ne sme da sadrži razmake", „Serijski broj ne sme da sadrži kosu crtu (/)", „Uređaj nije pronađen u bazi", „Tip uređaja nije dozvoljen" (bez kataloga).

### 4. Pretraga po nazivu uređaja (`/search-by-device`)
„Pretraži po uređaju", polje „Unesite naziv ili kod uređaja" (min 2 zn., početak naziva/koda), rezultati „Naziv" + „Code: …", 20 po strani + „Učitaj još". Nema poruke za prazan rezultat.

### 5. Sklopovi → 6. Rezervni delovi
- „Sklopovi" (npr. „SVI DELOVI"); prazno: „Nema pronađenih sklopova za ovaj uređaj."
- „Rezervni delovi": sklopni crtež (Storage `Photos/<Group photo>.PNG|png|jpg|jpeg`, zum sa dva prsta) + redovi **„<redni broj> - <naziv>"** (NE šifra!). Prazno: „Nema pronađenih rezervnih delova za ovaj sklop."
- Popup dela: naziv, „Kod", „Cena" (= Price × exchangeRate + currency; „Cena nije dostupna"), napomena `partNote` (npr. „*Cene su informativnog karaktera."), „Dodaj u korpu", „Zatvori".
- Ulazak u Sklopove prazni korpu (osim pri povratku sa delova).

### 7. Korpa (`/cart`)
„Korpa", prazno: „Vaša korpa je prazna.", stavke sa −/+, „Ukupno", „Poruči" → email app (naslov „Narudžbina rezervnih delova", primaoci `orderEmailRecipients[deviceType]`). Greške: „Na uređaju nije podešen nalog za e-poštu. Podesite nalog pa pokušajte ponovo.", „Nije moguće otvoriti aplikaciju za e-poštu." Korpa samo u memoriji (gubi se pri odjavi/restartu). cartNote se NE šalje (bug).

### 8. Pretraga po korisniku (`/search-by-user`)
„Ime" / „Prezime" (placeholder „Unesite ime"/„Unesite prezime"), „Pretraži" aktivno kad bar jedno ima ≥2 slova; rezultati „Ime Prezime", „Ulica broj, Grad", SN; „Učitaj još"; „Nema pronađenih korisnika."

### 9. Detalji uređaja (`/device-management/:sn`)
Naslov „Detalji uređaja"; SN + model. Registrovan: „Ime i prezime", „Adresa", „Grad" (poštanski broj + grad), „Broj telefona", „Datum kupovine", „Garancija do" (ako warrantyMonths).
Dugmad: „Dodaj korisnika" (samo neregistrovan) · „Puštanje u rad" · „Godišnji servis" · „Intervencija" · „Produžena garancija" · „Istorija". Intervencija/Istorija aktivne kad je uređaj registrovan (i pušten u rad ako treba).

### 10. Dodaj korisnika (`/…/add-user`)
„Dodaj korisnika", kartica „Podaci o korisniku": Ime, Prezime, Ulica, Kućni broj, Grad, Poštanski broj, Broj telefona, Garancija („Uređaj u garanciji"/„Uređaj van garancije", action sheet sa „CANCEL"), Datum kupovine (samo u garanciji i bez puštanja u rad).
Nedostaje: „Popunite obavezna polja: …". Potvrda „Potvrda" / „Nakon čuvanja nećete moći da menjate podatke. Da li želite da nastavite?" („Odustani"/„Sačuvaj"). Uspeh „Korisnik je uspešno sačuvan", greška „Greška pri čuvanju korisnika". Upisuje `users/{sn}` (sa `firstNameSrch`/`lastNameSrch`).

### 11. Intervencija (`/…/intervention`)
Naslov uvek „Intervencija u garanciji" (i van garancije). Polja po režimu — vidi tabelu gore. Kilometraža podrazumevano **30**, max 3 cifre (u uputstvu: kilometri u **oba smera** do kupca). Datum = danas (ne menja se, čuva se serversko vreme). Šifre delova 1–4 (+/−, max 21 zn.). Opisi do 1000 znakova.
Poruke: „Izaberite garantni status", „Izaberite tip intervencije", „Izaberite opis kvara", mode2: „Izaberite kvar", „Izaberite lokaciju kvara", „Izaberite broj izlazaka na teren", „Unesite opis kvara", „Unesite opis posla tehničara".
„Sklopni crtež" (deviceCatalog) — traži garantni status, otvara sklopove i pamti kupca/garanciju za email porudžbine.
Čuvanje: „Upozorenje" / „Nakon što sačuvate, nećete moći da menjate podatke. Da li želite da nastavite?" → „Intervencija je uspešno sačuvana" / „Greška pri čuvanju intervencije". Kolekcija = `interventionCollections[deviceType]`.

### 12. Istorija i detalji intervencije
„Istorija": prvi red „dd.mm.yyyy. Kupovina" (ili Puštanje u rad), zatim „dd.mm.yyyy. Popravka"/„Godišnje održavanje"; prazno „Nema zabeleženih intervencija."
„Detalji intervencije": Kvar, Lokacija kvara, Broj izlazaka na teren, Garancija, Šifra zamenjenog dela N, Servisni centar (`servicers.company`), Mail servisera, Datum, Opis kvara, Opis posla tehničara (mode2). **Kilometraža se NE prikazuje** (bug) — ne tvrditi suprotno. Dugme „Izveštaj" (pdfReports).

### 13. Informacije o instalaciji (heat-pump / gas-boiler) — vidi `sr.ts` (sekcije ELEKTRIČNI/HIDRAULIČNI/FREONSKI DEO/RAD SISTEMA; gas: „Gasni kotlovi zapisnik"). Sva polja obavezna: „Popunite sva obavezna polja".

### 14. Potpis — „Potpis korisnika", „Obriši"/„Potvrdi", „Potpis je obavezan", „Otpremanje potpisa...".

### 15. Moje intervencije (`/servicer-report`)
„Izveštaj servisera": „Datum od" (1. u mesecu), „Datum do" (danas), (ne-mode2: „Tip intervencije" višestruki izbor). Provere: „Unesite oba datuma", „Datum OD mora biti pre datuma DO", „Period ne sme biti duži od 365 dana". Lista sa čekboksovima + „Sve" (x/y), „Izvezi PDF" („Izveštaj o urađenim intervencijama servisera"). „Nema rezultata za zadati period."

### 16. Dokumentacija (`/docs`)
Fascikle i fajlovi iz Storage `Documents`. **Na telefonu (native) fascikle se vide samo ako u folderu postoji `_folders.txt` sa spiskom fascikli** (web/demo ih vidi preko listAll). Prazno: „Nema dostupnih dokumenata."

### Ostalo
- Ionic iOS podrazumevani tekstovi: „Back" u zaglavlju, „CANCEL" u action sheet-u (tako i u pravoj app).
- Isključena funkcija → ruta vraća na početni ekran.
- Offline: nema posebnog režima; config i jezik se keširaju.
