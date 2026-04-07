---
paths:
  - "src/**/*.ts"
---

# Angular/Ionic konvencije za ovaj projekat

## Komponente
- Uvek standalone (NIKAD NgModules)
- Koristi Angular signals za reaktivni state
- Preferiraj OnPush change detection
- Ionic komponente importuj direktno (IonHeader, IonContent, itd.)

## Servisi
- Jedan servis = jedan domen
- Koristi `inject()` umesto constructor injection
- State servis koristi NgRx SignalStore sa `signalStore()`
- Business logika ide u servise, NIKAD u komponente

## Firebase
- Svi tenant-scoped upiti idu kroz FirestoreService.getTenantDocument/queryTenantCollection
- NIKAD hardkodovati putanje do kolekcija
- Koristi StorageService za Firebase Storage operacije

## Error handling
- Uvek loguj greske kroz LoggerService
- NIKAD koristi console.log/error/warn direktno
- Servisi vracaju fallback vrednosti umesto da bacaju greske u UI

## i18n
- Svi UI stringovi moraju koristiti Transloco (transloco pipe ili direktivu)
- Kljucevi: feature_element format (npr. login_submit, cart_empty)
- NIKAD hardkodovati tekst u templateima
