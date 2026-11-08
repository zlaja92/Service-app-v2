#!/bin/bash
# Privremene izmene u repou mobilne aplikacije za snimke uputstva — sa obaveznim backup-om i proverom.
#   repo.sh backup  <repo> <backupDir>            snimi stanje (git status/diff, kopije izmenjenih fajlova, SHA, env, brend)
#   repo.sh apply   <repo> <backupDir> <brandId>  dodaj demo hook + generisani environment.prod.ts za brend (gitignored)
#   repo.sh restore <repo> <backupDir>            ukloni hook, vrati environment.prod.ts, proveri da je stanje identično
# Pravila: NIKAD git stash/checkout tuđih izmena; dira se SAMO app-initializer.ts (vraća se git checkout-om tog fajla,
# a pre toga se proverava da on nije bio izmenjen od strane korisnika), novi fajl demo-emulators.ts i environment.prod.ts.
set -euo pipefail
CMD=$1; REPO=$2; B=$3
KIT="$(cd "$(dirname "$0")" && pwd)"
INIT=src/app/core/initializer/app-initializer.ts
HOOK=src/app/core/firebase/demo-emulators.ts
ENVP=src/environments/environment.prod.ts
cd "$REPO"
case "$CMD" in
  backup)
    mkdir -p "$B/files"
    git rev-parse --abbrev-ref HEAD > "$B/branch.txt"
    git status --short > "$B/git-status-before.txt"
    git diff > "$B/git-diff-before.patch"
    cp .active-brand "$B/active-brand-before" 2>/dev/null || true
    while read -r st f; do [ -f "$f" ] && mkdir -p "$B/files/$(dirname "$f")" && cp -p "$f" "$B/files/$f"; done < "$B/git-status-before.txt"
    [ -f "$ENVP" ] && mkdir -p "$B/files/$(dirname $ENVP)" && cp -p "$ENVP" "$B/files/$ENVP"
    awk '{print $2}' "$B/git-status-before.txt" | while read -r f; do [ -f "$f" ] && shasum -a 256 "$f"; done > "$B/sha-before.txt" || true
    if grep -q " $INIT\$" "$B/git-status-before.txt"; then echo "!!! $INIT je već izmenjen od strane korisnika — NE nastavljaj sa apply bez dogovora"; exit 2; fi
    echo "Backup u $B:"; cat "$B/git-status-before.txt"; echo "brend: $(cat .active-brand 2>/dev/null)";;
  apply)
    BRAND=$4; PROJECT="demo-$BRAND"
    [ -f "$B/git-status-before.txt" ] || { echo "Prvo backup!"; exit 1; }
    sed "s/__PROJECT__/$PROJECT/g" "$KIT/demo-emulators.ts.tpl" > "$HOOK"
    python3 - "$INIT" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
anchor="  // Step 1: Initialize Firebase\n"
if "connectDemoEmulators" in s: sys.exit(0)
assert s.count(anchor)==1, "anchor nije pronađen u app-initializer.ts — proveri kod"
block="""  // PRIVREMENO (snimci uputstva): lokalni Firebase emulator — briše se posle snimanja
  if ((environment as Record<string, unknown>)['useEmulators']) {
    const { connectDemoEmulators } = await import('../firebase/demo-emulators');
    await connectDemoEmulators();
  }

"""
open(p,"w").write(s.replace(anchor, block+anchor))
PY
    # generisani (gitignored) prod environment za brend + prekidač za emulator
    python3 - "brands/$BRAND/environment.ts" "$ENVP" <<'PY'
import sys,re
src,dst=sys.argv[1:3]; s=open(src).read()
s=re.sub(r"(\n};\s*)$", "\n  useEmulators: true,\n};\n", s.rstrip()+"\n")
open(dst,"w").write(s)
PY
    grep -n "brand:\|useEmulators" "$ENVP"; git status --short;;
  restore)
    git checkout -- "$INIT"
    rm -f "$HOOK"
    [ -f "$B/files/$ENVP" ] && cp -p "$B/files/$ENVP" "$ENVP"
    echo "--- provera:"
    git status --short | diff - "$B/git-status-before.txt" && echo "git status: ISTI"
    git diff | diff -q - "$B/git-diff-before.patch" >/dev/null && echo "git diff: ISTI"
    [ -s "$B/sha-before.txt" ] && shasum -a 256 -c "$B/sha-before.txt"
    [ -f "$B/files/$ENVP" ] && cmp "$ENVP" "$B/files/$ENVP" && echo "environment.prod.ts: ISTI"
    echo "brend: $(cat .active-brand 2>/dev/null) (pre: $(cat "$B/active-brand-before" 2>/dev/null))"
    echo "grana: $(git rev-parse --abbrev-ref HEAD) (pre: $(cat "$B/branch.txt"))";;
  *) echo "nepoznata komanda"; exit 1;;
esac
