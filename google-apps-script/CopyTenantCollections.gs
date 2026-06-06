/**
 * CopyTenantCollections.gs
 *
 * Kopira `settings` i `translations` kolekcije unutar produkcione baze sa
 *   tenants/arst-srb/{settings,translations}
 * na
 *   tenants/arst-mk/{settings,translations}
 *
 * Rekurzivno kopira sve podkolekcije i dokumente.
 * Document ID se cuva. Polja se kopiraju 1:1 (raw, bez transformacije).
 *
 * Pokretanje: pozovi copyArstSrbToArstMk() iz Apps Script editora.
 */

// ── Konfiguracija ────────────────────────────────────────────────────────

var COPY_SOURCE_TENANT = "tenants/arst-srb";
var COPY_DEST_TENANT = "tenants/arst-mk";
var COPY_COLLECTIONS = ["settings", "translations"];

// ── Public entry point ───────────────────────────────────────────────────

function copyArstSrbToArstMk() {
  var prod = FirebaseService.prod();
  Logger.log("=== Kopiranje " + COPY_COLLECTIONS.join(", ") + " iz "
             + COPY_SOURCE_TENANT + " u " + COPY_DEST_TENANT + " ===");

  var writes = [];
  var totalDocs = 0;

  for (var c = 0; c < COPY_COLLECTIONS.length; c++) {
    var col = COPY_COLLECTIONS[c];
    var sourcePath = COPY_SOURCE_TENANT + "/" + col;
    var destPath = COPY_DEST_TENANT + "/" + col;

    Logger.log("--- Kolekcija: " + col + " ---");
    var count = collectCollectionWrites_(prod, sourcePath, destPath, writes);
    Logger.log("Skupljeno " + count + " dokumenata iz " + sourcePath);
    totalDocs += count;
  }

  Logger.log("Ukupno upisa: " + totalDocs);
  if (writes.length === 0) {
    Logger.log("Nema sta da se upise.");
    return;
  }

  // Flush kroz :batchWrite (do 500 po HTTP call-u)
  var BATCH_SIZE = 500;
  var success = 0;
  var errors = 0;

  for (var b = 0; b < writes.length; b += BATCH_SIZE) {
    var batch = writes.slice(b, b + BATCH_SIZE);
    var results = prod.batchWriteSets(batch);
    for (var r = 0; r < results.length; r++) {
      if (results[r].success) {
        success++;
      } else {
        errors++;
        Logger.log("GRESKA " + batch[r].collection + "/" + batch[r].documentId + ": " + results[r].error);
      }
    }
    Logger.log("Batch " + (Math.floor(b / BATCH_SIZE) + 1) + ": " + batch.length + " upisa (1 HTTP call)");
  }

  Logger.log("Zavrseno. Upisano: " + success + ", Gresaka: " + errors);
}

// ── Rekurzivni walk source-a, dodavanje u writes listu ───────────────────

/**
 * Lista sve dokumente u sourceCollection, dodaje ih u writes (sa raw fields-ima),
 * pa rekurzivno radi to isto za svaku podkolekciju svakog dokumenta.
 * Vraca ukupan broj dodatih dokumenata.
 */
function collectCollectionWrites_(prod, sourceCollection, destCollection, writes) {
  var docs = prod.listDocuments(sourceCollection);
  var total = 0;

  for (var i = 0; i < docs.length; i++) {
    var doc = docs[i];
    writes.push({
      collection: destCollection,
      documentId: doc.id,
      fields: doc.fields
    });
    total++;

    // Rekurzivno kroz podkolekcije
    var sourceDocPath = sourceCollection + "/" + doc.id;
    var destDocPath = destCollection + "/" + doc.id;
    var subColIds = [];
    try {
      subColIds = prod.listCollectionIds(sourceDocPath);
    } catch (e) {
      Logger.log("  GRESKA pri listanju podkolekcija " + sourceDocPath + ": " + e);
      continue;
    }
    for (var s = 0; s < subColIds.length; s++) {
      total += collectCollectionWrites_(
        prod,
        sourceDocPath + "/" + subColIds[s],
        destDocPath + "/" + subColIds[s],
        writes
      );
    }
  }

  return total;
}
