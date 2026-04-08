---
name: implement-execute
description: Implements features from an approved architecture plan through iterative spec/review/develop cycles
---

Implementiraj feature na osnovu odobrene implementacione arhitekture kroz koordinisan tim agenata.

## PRAVILO ZA POZIVANJE AGENATA
Kada pozivas agenta, UVEK koristi `subagent_type` parametar sa tacnim imenom agenta (npr. `subagent_type: "implement-lead"`). Ovo automatski ucitava definiciju agenta iz `.claude/agents/{ime}.md` fajla. U `prompt` parametru proslijedi SAMO kontekst zadatka (sta treba uraditi, koji fajlovi, koji feedback). NIKADA ne prepisuj ulogu, opis ili instrukcije agenta — one su vec definisane u njegovom .md fajlu.

## Korak 1: Podela posla

Pokreni **implement-lead** agenta (`subagent_type: "implement-lead"`) sa:
- Odobrenom implementacionom arhitekturom (iz `/implement-plan` ili iz korisnikovog input-a)
- Instrukcijom da podeli posao u work unit-e i prioritizuje ih po zavisnostima

Implement lead ce vratiti listu work unit-a sa prioritetima i zavisnostima.

## Korak 2: Za svaki work unit (redom po prioritetu i zavisnostima)

### Faza A: Specifikacije

1. Pokreni **implement-spec-writer** agenta (`subagent_type: "implement-spec-writer"`) sa:
   - Opisom work unit-a iz arhitekture
   - Putanjama do relevantnih source fajlova (zavisnosti, slicni feature-i)
   - Instrukcijom da napise detaljnu implementacionu specifikaciju

2. Pokreni **implement-spec-reviewer** agenta (`subagent_type: "implement-spec-reviewer"`) sa:
   - Specifikacijom od writera
   - Putanjama do source fajlova zavisnosti

3. Ako je STATUS: REVISION_NEEDED:
   - Pokreni ponovo **implement-spec-writer** (`subagent_type: "implement-spec-writer"`) sa feedback-om reviewera
   - Pokreni ponovo **implement-spec-reviewer** (`subagent_type: "implement-spec-reviewer"`) sa azuriranom specifikacijom
   - Maksimalno **2 iteracije**

### Faza B: Implementacija

1. Pokreni **implement-developer** agenta (`subagent_type: "implement-developer"`) sa:
   - Odobrenom specifikacijom
   - Putanjama do zavisnosti i slicnih feature-a
   - Instrukcijom da implementira i pokrene build

2. Pokreni **implement-code-reviewer** agenta (`subagent_type: "implement-code-reviewer"`) sa:
   - Putanjama do kreiranih/izmenjenih fajlova
   - Odobrenom specifikacijom za poredjenje

3. Ako je STATUS: REVISION_NEEDED:
   - Pokreni ponovo **implement-developer** (`subagent_type: "implement-developer"`) sa feedback-om reviewera
   - Pokreni ponovo **implement-code-reviewer** (`subagent_type: "implement-code-reviewer"`) sa azuriranim kodom
   - Maksimalno **2 iteracije**

## Korak 3: Integracija

Kada su svi work unit-i zavrseni, pokreni **implement-lead** agenta (`subagent_type: "implement-lead"`) sa:
- Listom svih kreiranih/izmenjenih fajlova
- Instrukcijom da pokrene kompletni build i lint i napravi finalni izvestaj

## Korak 4: Verifikacija implementacije (OBAVEZNO)

1. Pokreni **implement-architect** agenta (`subagent_type: "implement-architect"`) sa odobrenom arhitekturom i listom implementiranih fajlova — neka proveri da li je SVE implementirano prema arhitekturi.

2. Pokreni **implement-arch-reviewer** agenta (`subagent_type: "implement-arch-reviewer"`) NEZAVISNO sa istim materijalom.

3. Konsoliduj rezultate:
   - Propust koji OBA agenta potvrde → POTVRDJENI PROPUST (mora se resiti)
   - Propust koji jedan osporava → NEPOTVRDJEN (prikazati odvojeno sa obrazlozenjem)
   - Propust koji oba osporavaju → ODBACEN (prikazati kao napomenu)

## Korak 5: Finalni output

Ispisi konsolidovani izvestaj koji ukljucuje:
- Sve kreirane/izmenjene fajlove
- Build/lint status
- POTVRDJENE propuste (ako ih ima — moraju se resiti pre zavrsetka)
- NEPOTVRDJENE propuste (odvojeno, sa obrazlozenjem)
- Otkrivene probleme u postojecem kodu (sortirane po severity)
- Preporuke za sledece korake (testiranje sa `/test-full`)

## VAZNO
- Svaki work unit MORA proci oba ciklusa (specifikacije + implementacija)
- NIKAD ne preskaci review fazu
- Zavisnosti se implementiraju PRVO (modeli → servisi → store-ovi → komponente → rute)
- Ako developer prijavi problem u specifikaciji — vrati se na Ciklus A
- Build MORA proci na kraju — ako ne prolazi, resi problem
- Agenti se pokrecu SEKVENCIJALNO unutar work unit-a (spec-writer → reviewer → developer → code-reviewer)
- Work unit-i BEZ medjusobnih zavisnosti se mogu raditi paralelno
