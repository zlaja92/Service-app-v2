---
name: test-plan
description: Designs and reviews test architecture through iterative architect/reviewer collaboration
---

Dizajniraj test arhitekturu za zadati feature/fajlove kroz iterativnu saradnju arhitekte i reviewera.

## PRAVILO ZA POZIVANJE AGENATA
Kada pozivas agenta, UVEK koristi `subagent_type` parametar sa tacnim imenom agenta (npr. `subagent_type: "test-architect"`). Ovo automatski ucitava definiciju agenta iz `.claude/agents/{ime}.md` fajla. U `prompt` parametru proslijedi SAMO kontekst zadatka (sta treba uraditi, koji fajlovi, koji feedback). NIKADA ne prepisuj ulogu, opis ili instrukcije agenta — one su vec definisane u njegovom .md fajlu.

## Korak 1: Test arhitektura

Pokreni **test-architect** agenta (`subagent_type: "test-architect"`) sa sledecim kontekstom:
- Koji fajlovi/feature treba da se testira (iz korisnikovog zahteva)
- Neka procita source kod i postojece testove
- Neka dizajnira kompletnu test strategiju

Sacekaj rezultat — dobices strukturiran dokument sa test arhitekturom.

## Korak 2: Review arhitekture

Pokreni **test-arch-reviewer** agenta (`subagent_type: "test-arch-reviewer"`) sa:
- Kompletnim outputom od test-architect agenta
- Putanjama do source fajlova koji se testiraju

Reviewer ce dati STATUS: APPROVED ili STATUS: REVISION_NEEDED.

## Korak 3: Iteracija (ako je potrebno)

Ako je status REVISION_NEEDED:

1. Pokreni ponovo **test-architect** agenta (`subagent_type: "test-architect"`) sa:
   - Originalnom arhitekturom
   - KONKRETNIM feedback-om od reviewera
   - Instrukcijom da koriguje samo ono sto reviewer trazi

2. Pokreni ponovo **test-arch-reviewer** (`subagent_type: "test-arch-reviewer"`) sa azuriranom arhitekturom

Ponavljaj ovaj ciklus **maksimalno 3 puta**. Ako posle 3 iteracije nije APPROVED, prihvati poslednju verziju sa napomenama reviewera.

## Korak 4: Finalni output

Kada je arhitektura APPROVED (ili posle max iteracija), ispisi:

### ODOBRENA TEST ARHITEKTURA
[kompletna finalna verzija]

### ITERACIJE
- Broj iteracija: X
- Kljucne korekcije: [sta je promenjeno tokom iteracija]

### SLEDECI KORAK
Korisnik moze pokrenuti `/test-implement` sa ovom arhitekturom za implementaciju testova.
