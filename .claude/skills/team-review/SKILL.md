---
name: team-review
description: Comprehensive multi-agent code review
---

Pokreni team review u 3 paralelna agenta:

1. Pokreni **code-reviewer** agenta da proveri bezbednost i kvalitet koda
   koji je nedavno menjan (proveri git diff za izmenjene fajlove)

2. Pokreni **architect** agenta da evaluira arhitekturne odluke
   u izmenjenim fajlovima

3. Pokreni **test-writer** agenta da napiše testove za nove/izmenjene
   funkcionalnosti

Pokreni sva tri paralelno. Kada zavrse, napravi konsolidovani izvestaj sa:
- Kriticni problemi (moraju se popraviti)
- Preporuke (trebalo bi popraviti)
- Status: spreman za commit ili treba jos rada
