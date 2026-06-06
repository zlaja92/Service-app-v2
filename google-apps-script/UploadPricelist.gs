/**
 * UploadPricelist.gs
 *
 * Cita cenovnik iz Google Sheet-a (kolona A = code, B = currency, C = price) i
 * upisuje SVE redove sa valutom EUR u pricelist kolekciju u Firestore-u.
 *
 * Putanje su razlicite za staru i novu bazu, pa postoje dve zasebne funkcije:
 *   - uploadPricelistToOldDb() — upisuje u staru bazu na hardkodovanu putanju
 *   - uploadPricelistToNewDb() — upisuje u novu (prod) bazu
 *
 * Document ID se pravi od code-a iz kolone A.
 * Polja u dokumentu: { code, price }. (currency se koristi samo za filter, ne upisuje se.)
 *
 * Pokretanje: izaberi jednu od funkcija u Apps Script editoru i Run.
 */

// ── Konfiguracija Google Sheet-a ─────────────────────────────────────────

/** Ceo URL Google Sheet-a. */
var PRICELIST_SHEET_URL = "OVDE_UNESI_CEO_LINK";

/** Ime sheet tab-a koji sadrzi cenovnik. */
var PRICELIST_SHEET_NAME = "Sheet1";

/** Valuta koja se filtrira (sve ostale se preskacu). */
var PRICELIST_TARGET_CURRENCY = "EUR";

// ── Konfiguracija Firestore putanja ──────────────────────────────────────

/** Putanja kolekcije u STAROJ bazi (FirebaseService.old). */
var PRICELIST_PATH_OLD = "pricelist";

/** Putanja kolekcije u NOVOJ (prod) bazi (FirebaseService.prod). */
var PRICELIST_PATH_NEW = "tenants/arst-srb/pricelist";

// ── Public funkcije ──────────────────────────────────────────────────────

/** Upload cenovnika u STARU bazu. */
function uploadPricelistToOldDb() {
  uploadPricelist_(FirebaseService.old(), PRICELIST_PATH_OLD, "STARA");
}

/** Upload cenovnika u NOVU (prod) bazu. */
function uploadPricelistToNewDb() {
  uploadPricelist_(FirebaseService.prod(), PRICELIST_PATH_NEW, "NOVA");
}

// ── Implementacija ───────────────────────────────────────────────────────

function uploadPricelist_(target, collectionPath, dbLabel) {
  var spreadsheet = SpreadsheetApp.openByUrl(PRICELIST_SHEET_URL);
  var sheet = spreadsheet.getSheetByName(PRICELIST_SHEET_NAME);
  if (!sheet) {
    Logger.log("GRESKA: Sheet '" + PRICELIST_SHEET_NAME + "' nije pronadjen.");
    return;
  }

  var data = sheet.getDataRange().getValues();
  Logger.log("Procitano " + (data.length - 1) + " redova iz sheet-a (bez header-a). Upload u " + dbLabel + " bazu: " + collectionPath);

  // Skupi sve EUR redove u writes listu
  var writes = [];
  var skippedNonEur = 0;
  var skippedInvalid = 0;

  for (var i = 1; i < data.length; i++) {
    var code = data[i][0];
    var currency = data[i][1];
    var priceRaw = data[i][2];

    var codeStr = code != null ? String(code).trim() : "";
    var currencyStr = currency != null ? String(currency).trim().toUpperCase() : "";

    if (codeStr === "" || priceRaw === "" || priceRaw == null) {
      skippedInvalid++;
      continue;
    }
    if (currencyStr !== PRICELIST_TARGET_CURRENCY) {
      skippedNonEur++;
      continue;
    }

    var price = Number(priceRaw);
    if (isNaN(price)) {
      Logger.log("Red " + (i + 1) + ": nevalidna cena '" + priceRaw + "' za code '" + codeStr + "' — preskacem.");
      skippedInvalid++;
      continue;
    }

    writes.push({
      collection: collectionPath,
      documentId: codeStr,
      fields: target.encodeFields({
        code: codeStr,
        price: price
      })
    });
  }

  Logger.log(
    "Za upis: " + writes.length +
    ", preskocene ne-" + PRICELIST_TARGET_CURRENCY + " stavke: " + skippedNonEur +
    ", preskocene nevalidne: " + skippedInvalid
  );

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
    var results = target.batchWriteSets(batch);
    for (var r = 0; r < results.length; r++) {
      if (results[r].success) {
        success++;
      } else {
        errors++;
        Logger.log("GRESKA " + batch[r].documentId + ": " + results[r].error);
      }
    }
    Logger.log("Batch " + (Math.floor(b / BATCH_SIZE) + 1) + ": " + batch.length + " upisa (1 HTTP call)");
  }

  Logger.log("Zavrseno za " + dbLabel + " bazu. Upisano: " + success + ", Gresaka: " + errors);
}
