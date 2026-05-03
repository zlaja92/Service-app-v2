# Build & Release

## Dev build

```bash
npm run build           # Angular build (auto-sync verzije)
npm run cap:sync        # kopira www/ u native + sync verzije
# ▶ Run u Android Studio
```

Watch mode:
```bash
npm run watch           # auto-rebuild na izmene
npm run cap:sync        # u drugom terminalu kad treba
```

## Production release

```bash
# 1. Bumpni verziju (bez commit-a/tag-a)
npm run version:bump:patch    # 1.2.3 → 1.2.4 (bug fix)
npm run version:bump:minor    # 1.2.3 → 1.3.0 (feature)
npm run version:bump:major    # 1.2.3 → 2.0.0 (breaking)

# 2. Build sa proverom (faila ako tag već postoji)
npm run release

# 3. Sync u native projekte
npm run cap:sync

# 4a. Android: AAB
npx cap open android
# Build → Generate Signed App Bundle → Release → upload na Play Console

# 4b. iOS: IPA
npx cap open ios
# Product → Archive → Distribute App → App Store Connect

# 5. Verifikuj kroz TestFlight / Internal Testing

# 6. Commit + tag (TEK kad je sve uspešno)
npm run release:commit        # git add + commit "Release vX.Y.Z" + tag vX.Y.Z

# 7. Push
git push && git push --tags
```

## Rollback (ako pukne pre koraka 6)

```bash
git checkout -- package.json android ios   # vrati sve
```
