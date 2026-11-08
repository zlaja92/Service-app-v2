# Pravila stila i formulacija (zadao korisnik — obavezno)

## Sadržaj i formulacije
- Jezik: srpski latinica, obraćanje na „ti" (Upiši, Dodirni, Proveri). Za mobilnu app: **dodirni**, ne „klikni" (osim za PDF dugmad za preuzimanje: „klikneš na dugme").
- Kontakt osoba za servisere: **„osoba koja upravlja servisnom mrežom"** (genitiv „osobe koja…", dativ „osobi koja…"). NIKAD „osoba koja održava aplikaciju", „super-admin", „administrator".
- Ne pominjati super-admina, podešavanja kolona, Firebase, emulator, nazive kolekcija, tehničke detalje.
- Nalog: „Email i lozinka koje dobiješ od osobe koja upravlja servisnom mrežom".
- Preuzimanje: šta se kuca u pretrazi prodavnice (`storeSearchName`, npr. „Tiki Servis RS"), App Store (iPhone) i Google Play (Android); **QR kod + dugme** „Preuzmi iz App Store-a" / „Preuzmi sa Google Play-a" — link sakriven iza dugmeta (ne prikazivati URL). Iz Play linka izbaciti `&hl=…` (i reći korisniku).
- Kilometraža: „Ukupno pređeni kilometri u oba smera (do kupca i nazad), do tri cifre. Unapred je upisano 30."
- Napomena o slikama: „Slike u uputstvu napravljene su sa probnim podacima o kupcima, na iPhone-u. Na Android telefonima izgled može malo da se razlikuje, ali su polja i dugmad isti."
- Opisivati samo ono što je uključeno za brend; ne opisivati poznate bagove kao funkcije (vidi screens.md).
- Datum izrade = današnji datum („8. novembar 2026.").

## Izgled PDF-a
- A4, font Plus Jakarta Sans, akcent = boja brenda (`accentColor`).
- **Naslovna**: centrirano — ikonica app (`brands/<id>/assets/icon.png`, zaobljeni uglovi, tanka ivica, BEZ senke), „UPUTSTVO ZA SERVISERE", naziv app, podnaslov, 3 snimka telefona, dole samo „Datum izrade: …". **Bez broja strane i bez teksta u podnožju.**
- **Strana 2 = samo sadržaj**, u jednoj koloni: veliki plavi broj, naslov + kratak opis, broj strane desno (automatski). Uvod počinje na strani 3.
- Podnožje ostalih strana: samo broj strane (centrirano), bez rečenice.
- Slike: **bez senke**, tanka svetla ivica, zaobljeni uglovi; opis ispod slike („Slika N — …") nikad preko slike.
- Telefonski snimci 2–3 u redu (`.phones`, `.phones.two`) ili tekst + slika (`.side`).
- Obrisati prazne strane / naslove koji ostaju sami (h2/h3 break-after: avoid; figure break-inside: avoid).
- Dokument što sažetiji (Tiki: 17 strana sa QR blokom).

## Snimci
- Samo izmišljeni podaci o kupcima/serviserima (GDPR). Uređaji, delovi, cene, crteži, šifarnici = stvarni podaci brenda.
- Viewport 393×1060 (iPhone 15 Pro širina, viša visina da se vide sva polja i dugmad), DPR 3, iOS izgled.
- Bez Firebase natpisa „Running in emulator mode" (skripta ga uklanja).
- Dokumentacija: ako brend ima malo dokumenata, dodati probne dokumente po fasciklama (`demo.extraDocuments`).
