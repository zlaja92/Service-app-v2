---
name: implement-plan
description: Designs and reviews implementation architecture through iterative architect/reviewer collaboration
---

Dizajniraj implementacionu arhitekturu za zadati feature/zahtev kroz iterativnu saradnju arhitekte i reviewera.

## PRAVILO ZA POZIVANJE AGENATA
Kada pozivas agenta, UVEK koristi `subagent_type` parametar sa tacnim imenom agenta (npr. `subagent_type: "implement-architect"`). Ovo automatski ucitava definiciju agenta iz `.claude/agents/{ime}.md` fajla. U `prompt` parametru proslijedi SAMO kontekst zadatka (sta treba uraditi, koji fajlovi, koji feedback). NIKADA ne prepisuj ulogu, opis ili instrukcije agenta — one su vec definisane u njegovom .md fajlu.

## Korak 1: Implementaciona arhitektura

Pokreni **implement-architect** agenta (`subagent_type: "implement-architect"`) sa sledecim kontekstom:
- Koji feature/funkcionalnost treba implementirati (iz korisnikovog zahteva)
- Neka procita source kod, postojece patterne i slicne feature-e
- Neka dizajnira kompletnu implementacionu arhitekturu

Sacekaj rezultat — dobices strukturiran dokument sa implementacionom arhitekturom.

## Korak 2: Review arhitekture

Pokreni **implement-arch-reviewer** agenta (`subagent_type: "implement-arch-reviewer"`) sa:
- Kompletnim outputom od implement-architect agenta
- Putanjama do relevantnih source fajlova

Reviewer ce dati STATUS: APPROVED ili STATUS: REVISION_NEEDED.

## Korak 3: Iteracija (ako je potrebno)

Ako je status REVISION_NEEDED:

1. Pokreni ponovo **implement-architect** agenta (`subagent_type: "implement-architect"`) sa:
   - Originalnom arhitekturom
   - KONKRETNIM feedback-om od reviewera
   - Instrukcijom da koriguje samo ono sto reviewer trazi

2. Pokreni ponovo **implement-arch-reviewer** (`subagent_type: "implement-arch-reviewer"`) sa azuriranom arhitekturom

Ponavljaj ovaj ciklus **maksimalno 3 puta**. Ako posle 3 iteracije nije APPROVED, prihvati poslednju verziju sa napomenama reviewera.

## Korak 4: Finalni output

Kada je arhitektura APPROVED (ili posle max iteracija), ispisi:

### ODOBRENA IMPLEMENTACIONA ARHITEKTURA
[kompletna finalna verzija]

### ITERACIJE
- Broj iteracija: X
- Kljucne korekcije: [sta je promenjeno tokom iteracija]

### SLEDECI KORAK
Korisnik moze pokrenuti `/implement-execute` sa ovom arhitekturom za implementaciju.
