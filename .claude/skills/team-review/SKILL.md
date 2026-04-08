---
name: team-review
description: Comprehensive multi-agent code review
---

## PRAVILO ZA POZIVANJE AGENATA
Kada pozivas agenta, UVEK koristi `subagent_type` parametar sa tacnim imenom agenta. Ovo automatski ucitava definiciju agenta iz `.claude/agents/{ime}.md` fajla. U `prompt` parametru proslijedi SAMO kontekst zadatka. NIKADA ne prepisuj ulogu, opis ili instrukcije agenta — one su vec definisane u njegovom .md fajlu.

Pokreni team review u 3 paralelna agenta:

1. Pokreni **code-reviewer** agenta (`subagent_type: "code-reviewer"`) da proveri bezbednost i kvalitet koda
   koji je nedavno menjan (proveri git diff za izmenjene fajlove)

2. Pokreni **architect** agenta (`subagent_type: "architect"`) da evaluira arhitekturne odluke
   u izmenjenim fajlovima

3. Pokreni **test-writer** agenta (`subagent_type: "test-writer"`) da napiše testove za nove/izmenjene
   funkcionalnosti

Pokreni sva tri paralelno. Kada zavrse, napravi konsolidovani izvestaj sa:
- Kriticni problemi (moraju se popraviti)
- Preporuke (trebalo bi popraviti)
- Status: spreman za commit ili treba jos rada
