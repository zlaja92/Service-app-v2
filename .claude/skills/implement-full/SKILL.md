---
name: implement-full
description: Full implementation pipeline - designs architecture, then implements all code with review cycles
---

Kompletni implementacioni pipeline — od dizajna arhitekture do implementacije kompletnog koda sa review ciklusima.

## PRAVILO ZA POZIVANJE AGENATA
Kada pozivas agenta, UVEK koristi `subagent_type` parametar sa tacnim imenom agenta. Ovo automatski ucitava definiciju agenta iz `.claude/agents/{ime}.md` fajla. U `prompt` parametru proslijedi SAMO kontekst zadatka. NIKADA ne prepisuj ulogu, opis ili instrukcije agenta — one su vec definisane u njegovom .md fajlu.

## Korak 1: Implementaciona arhitektura

Pokreni skill `/implement-plan` sa feature-om/zahtevom koji korisnik zeli da implementira.

Sacekaj da se zavrsi i dobij odobrenu implementacionu arhitekturu.

## Korak 2: Implementacija koda

Pokreni skill `/implement-execute` sa odobrenom implementacionom arhitekturom iz Koraka 1.

## Korak 3: Finalni rezultat

Ispisi konsolidovani izvestaj:

### REZIME
- Feature koji je implementiran
- Broj iteracija arhitekture
- Broj work unit-a
- Ukupno kreiranih fajlova
- Ukupno izmenjenih fajlova

### BUILD STATUS
- Build: PASS / FAIL
- Lint: PASS / FAIL

### KREIRANI FAJLOVI
Kompletna lista svih novih fajlova sa opisom

### IZMENJENI FAJLOVI
Kompletna lista svih izmenjenih fajlova sa opisom promena

### OTKRIVENI PROBLEMI
Problemi u postojecem kodu otkriveni tokom implementacije (ako ih ima)

### SLEDECI KORACI
- Preporuka za testiranje: `/test-full` ili `/test-plan`
- Eventualna konfiguracija ili deployment koraci

## NAPOMENA
Ovaj pipeline moze trajati duze jer ukljucuje vise iteracija arhitekte/reviewera, spec writera/reviewera i developera/code reviewera. Za brzu implementaciju pojedinacnog fajla bez celokupnog pipeline-a, koristi direktno agente.

Pipeline tok:
```
Korisnikov zahtev
    ↓
/implement-plan
    ├─ implement-architect (dizajnira arhitekturu)
    └─ implement-arch-reviewer (review, max 3 iteracije)
    ↓
ODOBRENA ARHITEKTURA
    ↓
/implement-execute
    ├─ implement-lead (deli posao u work unit-e)
    │
    └─ ZA SVAKI WORK UNIT:
        ├─ CIKLUS A (Specifikacije):
        │   ├─ implement-spec-writer
        │   └─ implement-spec-reviewer (max 2 iteracije)
        │
        └─ CIKLUS B (Implementacija):
            ├─ implement-developer
            └─ implement-code-reviewer (max 2 iteracije)
    ↓
VERIFIKACIJA:
    ├─ implement-architect (provera kompletnosti)
    └─ implement-arch-reviewer (nezavisna provera)
    ↓
FINALNI IZVESTAJ
```
