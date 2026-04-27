/**
 * SyncProdToTest.gs
 * Sinhronizuje podatke iz produkcione baze (ariston-srb) u test bazu (aristonboilersmk-af027).
 *
 * Sta se kopira:
 *   - settings (svi dokumenti i podkolekcije)
 *   - translations (svi dokumenti i podkolekcije)
 *   - devices (prvih DEVICES_PER_TYPE po tipu uredjaja)
 *
 * Sta se NE kopira:
 *   - users (privatni podaci korisnika)
 *   - interventions (podaci intervencija)
 *
 * Setup:
 *   U Script Properties dodaj za oba projekta:
 *     - PROD_PROJECT_ID, PROD_SERVICE_EMAIL, PROD_PRIVATE_KEY
 *     - TEST_PROJECT_ID, TEST_SERVICE_EMAIL, TEST_PRIVATE_KEY
 */

// ── Konfiguracija ──────────────────────────────────────────────────────

/** Tenant ID koji se sinhronizuje. */
var TENANT_ID = "ariston_srb";

/** Broj uredjaja po tipu koji se kopiraju. */
var DEVICES_PER_TYPE = 10;

/** Kolekcije koje se kopiraju u celosti (svi dokumenti + podkolekcije). */
var FULL_SYNC_COLLECTIONS = ["settings", "translations"];

// ── Kopiranje kolekcije (rekurzivno sa podkolekcijama) ─────────────────

/**
 * Kopira sve dokumente iz kolekcije + rekurzivno sve podkolekcije.
 * @param {Object} source — FirebaseService instanca (prod)
 * @param {Object} target — FirebaseService instanca (test)
 * @param {string} collectionPath — putanja kolekcije (npr. "tenants/xyz/settings")
 * @param {number} [limit] — max dokumenata (opciono)
 * @return {number} — ukupan broj kopiranih dokumenata
 */
function copyCollection_(source, target, collectionPath, limit) {
  var docs = source.listDocuments(collectionPath, limit);
  var copied = 0;

  for (var i = 0; i < docs.length; i++) {
    var doc = docs[i];

    // Kopiraj dokument (raw fields — bez re-enkodiranja)
    var result = target.setDocumentRaw(collectionPath, doc.id, doc.fields);
    if (result.success) {
      copied++;
    } else {
      Logger.log("GRESKA pri kopiranju " + collectionPath + "/" + doc.id + ": " + result.error);
    }

    // Rekurzivno kopiraj podkolekcije
    var docPath = collectionPath + "/" + doc.id;
    var subCollections = [];
    try {
      subCollections = source.listCollectionIds(docPath);
    } catch (e) {
      // Nema podkolekcija — nije greska
    }

    for (var j = 0; j < subCollections.length; j++) {
      var subPath = docPath + "/" + subCollections[j];
      copied += copyCollection_(source, target, subPath);
    }
  }

  return copied;
}

// ── Kopiranje devices po tipu ──────────────────────────────────────────

/**
 * Kopira prvih N uredjaja po tipu.
 * Citamo sve uredjaje, grupišemo po tipu, uzimamo po DEVICES_PER_TYPE iz svake grupe.
 */
function copyDevices_(source, target, tenantPath) {
  var devicesPath = tenantPath + "/devices";
  var allDocs = source.listDocuments(devicesPath);

  Logger.log("Pronadjeno ukupno " + allDocs.length + " uredjaja u produkciji");

  // Grupisanje po tipu
  var byType = {};
  for (var i = 0; i < allDocs.length; i++) {
    var doc = allDocs[i];
    var typeField = doc.fields.type;
    var type = typeField ? (typeField.stringValue || "UNKNOWN") : "UNKNOWN";

    if (!byType[type]) byType[type] = [];
    byType[type].push(doc);
  }

  var copied = 0;
  var types = Object.keys(byType);

  for (var t = 0; t < types.length; t++) {
    var type = types[t];
    var docs = byType[type];
    var toSync = docs.slice(0, DEVICES_PER_TYPE);

    Logger.log("Tip " + type + ": " + docs.length + " ukupno, kopiram " + toSync.length);

    for (var d = 0; d < toSync.length; d++) {
      var doc = toSync[d];
      var result = target.setDocumentRaw(devicesPath, doc.id, doc.fields);
      if (result.success) {
        copied++;
      } else {
        Logger.log("GRESKA devices/" + doc.id + ": " + result.error);
      }

      // Podkolekcije uredjaja
      var docPath = devicesPath + "/" + doc.id;
      var subColls = [];
      try {
        subColls = source.listCollectionIds(docPath);
      } catch (e) { /* nema */ }

      for (var s = 0; s < subColls.length; s++) {
        copied += copyCollection_(source, target, docPath + "/" + subColls[s]);
      }
    }
  }

  return copied;
}

// ── Glavna funkcija ────────────────────────────────────────────────────

/**
 * Pokreni ovu funkciju iz Apps Script editora.
 * Sinhronizuje prod → test bazu.
 */
function syncProdToTest() {
  var source = FirebaseService.prod();
  var target = FirebaseService.test();

  Logger.log("=== SYNC START ===");
  Logger.log("Prod: " + source.getProjectId());
  Logger.log("Test: " + target.getProjectId());
  Logger.log("Tenant: " + TENANT_ID);
  Logger.log("Devices per type: " + DEVICES_PER_TYPE);

  var tenantPath = "tenants/" + TENANT_ID;
  var totalCopied = 0;

  // 1. Full sync kolekcije (settings, translations)
  for (var i = 0; i < FULL_SYNC_COLLECTIONS.length; i++) {
    var collName = FULL_SYNC_COLLECTIONS[i];
    var collPath = tenantPath + "/" + collName;
    Logger.log("--- Kopiram " + collName + " ---");
    var count = copyCollection_(source, target, collPath);
    Logger.log(collName + ": kopirano " + count + " dokumenata");
    totalCopied += count;
  }

  // 2. Devices (po tipu, limitirano)
  Logger.log("--- Kopiram devices ---");
  var devCount = copyDevices_(source, target, tenantPath);
  Logger.log("devices: kopirano " + devCount + " dokumenata");
  totalCopied += devCount;

  Logger.log("=== SYNC COMPLETE: " + totalCopied + " dokumenata kopirano ===");
}
