---
name: test-implement
description: Implements tests from an approved test plan through iterative write/review cycles
---

Implementiraj testove na osnovu odobrene test arhitekture kroz koordinisan tim agenata.

## PRAVILO ZA POZIVANJE AGENATA
Kada pozivas agenta, UVEK koristi `subagent_type` parametar sa tacnim imenom agenta (npr. `subagent_type: "test-lead"`). Ovo automatski ucitava definiciju agenta iz `.claude/agents/{ime}.md` fajla. U `prompt` parametru proslijedi SAMO kontekst zadatka (sta treba uraditi, koji fajlovi, koji feedback). NIKADA ne prepisuj ulogu, opis ili instrukcije agenta — one su vec definisane u njegovom .md fajlu.

## Korak 1: Podela posla

Pokreni **test-lead** agenta (`subagent_type: "test-lead"`) sa:
- Odobrenom test arhitekturom (iz `/test-plan` ili iz korisnikovog input-a)
- Instrukcijom da podeli posao u work unit-e i prioritizuje ih

Test lead ce vratiti listu work unit-a sa prioritetima.

## Korak 2: Za svaki work unit (redom po prioritetu)

### Faza A: Test case-ovi

1. Pokreni **test-case-writer** agenta (`subagent_type: "test-case-writer"`) sa:
   - Opisom work unit-a
   - Putanjama do source fajlova koji se testiraju
   - Instrukcijom da napise detaljne test case-ove

2. Pokreni **test-case-reviewer** agenta (`subagent_type: "test-case-reviewer"`) sa:
   - Test case-ovima od writera
   - Putanjama do source fajlova

3. Ako je STATUS: REVISION_NEEDED:
   - Pokreni ponovo **test-case-writer** (`subagent_type: "test-case-writer"`) sa feedback-om reviewera
   - Pokreni ponovo **test-case-reviewer** (`subagent_type: "test-case-reviewer"`) sa azuriranim case-ovima
   - Maksimalno **2 iteracije**

### Faza B: Implementacija

1. Pokreni **test-implementer** agenta (`subagent_type: "test-implementer"`) sa:
   - Odobrenim test case-ovima
   - Putanjama do source fajlova
   - Instrukcijom da implementira i pokrene testove

2. Pokreni **test-code-reviewer** agenta (`subagent_type: "test-code-reviewer"`) sa:
   - Putanjama do kreiranih test fajlova
   - Odobrenim test case-ovima za poredjenje

3. Ako je STATUS: REVISION_NEEDED:
   - Pokreni ponovo **test-implementer** (`subagent_type: "test-implementer"`) sa feedback-om reviewera
   - Pokreni ponovo **test-code-reviewer** (`subagent_type: "test-code-reviewer"`) sa azuriranim testovima
   - Maksimalno **2 iteracije**

## Korak 3: Finalni izvestaj

Kada su svi work unit-i zavrseni, pokreni **test-lead** agenta (`subagent_type: "test-lead"`) sa:
- Listom svih kreiranih test fajlova
- Instrukcijom da pokrene SVE testove i napravi finalni izvestaj

## Korak 4: Verifikacija bagova

Ako su otkriveni bagovi u aplikaciji, OBAVEZNO:

1. Pokreni **test-architect** agenta (`subagent_type: "test-architect"`) sa listom prijavljenih bagova i instrukcijom da proveri svaki — da li je to ZAISTA bug ili halucinacija/lazni pozitiv? Neka procita source kod i potvrdi ili ospori.

2. Pokreni **test-arch-reviewer** agenta (`subagent_type: "test-arch-reviewer"`) NEZAVISNO sa istom listom bagova i istom instrukcijom.

3. Konsoliduj rezultate:
   - Bug koji OBA agenta potvrde → POTVRĐEN BUG (ide u finalni izvestaj)
   - Bug koji jedan ospori → NEPOTVRDJEN (prikazati odvojeno sa obrazlozenjem)
   - Bug koji oba ospore → ODBACEN (prikazati kao napomenu)

## Korak 5: Finalni output

Ispisi konsolidovani izvestaj koji ukljucuje:
- Sve kreirane fajlove
- Pass/fail status svakog testa
- POTVRDJENE bagove (sortirane po severity: CRITICAL → HIGH → MEDIUM → LOW)
- NEPOTVRDJENE bagove (odvojeno, sa obrazlozenjem)
- Ukupnu pokrivenost

## VAZNO
- Svaki work unit MORA proci oba ciklusa (case-ovi + implementacija)
- NIKAD ne preskaci review fazu
- Ako test pada zbog buga u aplikaciji — dokumentuj bug, NE menjaj test
- Agenti se pokrecu SEKVENCIJALNO unutar work unit-a (case-writer → reviewer → implementer → code-reviewer)
- Work unit-i se mogu raditi sekvencijalno ili paralelno zavisno od zavisnosti
