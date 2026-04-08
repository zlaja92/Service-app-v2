---
name: test-full
description: Full testing pipeline - designs architecture, then implements all tests
---

Kompletni test pipeline — od dizajna arhitekture do implementacije svih testova.

## PRAVILO ZA POZIVANJE AGENATA
Kada pozivas agenta, UVEK koristi `subagent_type` parametar sa tacnim imenom agenta. Ovo automatski ucitava definiciju agenta iz `.claude/agents/{ime}.md` fajla. U `prompt` parametru proslijedi SAMO kontekst zadatka. NIKADA ne prepisuj ulogu, opis ili instrukcije agenta — one su vec definisane u njegovom .md fajlu.

## Korak 1: Test arhitektura

Pokreni skill `/test-plan` sa fajlovima/feature-om koji korisnik zeli da testira.

Sacekaj da se zavrsi i dobij odobrenu test arhitekturu.

## Korak 2: Implementacija testova

Pokreni skill `/test-implement` sa odobrenom test arhitekturom iz Koraka 1.

## Korak 3: Finalni rezultat

Ispisi konsolidovani izvestaj:

### REZIME
- Feature koji je testiran
- Broj iteracija arhitekture
- Broj work unit-a
- Ukupno kreiranih test fajlova
- Ukupno testova

### REZULTATI
- Proslo: X
- Palo: X (sa razlozima)

### OTKRIVENI BAGOVI
Lista bagova u aplikaciji koje su testovi otkrili (ako ih ima)

### KREIRANI FAJLOVI
Kompletna lista svih novih/izmenjenih fajlova

## NAPOMENA
Ovaj pipeline moze trajati duze jer ukljucuje vise iteracija arhitekte/reviewera i implementera/reviewera. Za brze testiranje pojedinacnog fajla, koristi direktno `/test-implement` sa manualnim test case-ovima.
