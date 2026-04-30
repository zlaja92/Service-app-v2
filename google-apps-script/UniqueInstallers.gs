/**
 * UniqueInstallers.gs
 * Prebraja koliko razlicitih email adresa (addedBy) ima u installedDevices
 * kolekciji, filtrirano po godini (addedDate).
 *
 * Deli upit po mesecima da ne predje bandwidth kvotu.
 *
 * Pokretanje: pozovi countUniqueInstallers() iz Apps Script editora.
 */

var INSTALLED_DEVICES_COLLECTION = "installedDevices";

/** Godina za koju se filtrira. */
var TARGET_YEAR = 2024;

/** Pauza izmedju mesecnih upita (ms). */
var MONTH_DELAY_MS = 10000;

function countUniqueInstallers() {
  var fb = FirebaseService.prod();
  var queryUrl = "https://firestore.googleapis.com/v1/projects/" + fb.getProjectId() +
    "/databases/(default)/documents:runQuery";

  var token = fb.getAccessToken();
  var uniqueEmails = {};
  var totalDocs = 0;

  for (var month = 0; month < 12; month++) {
    var startDate = new Date(Date.UTC(TARGET_YEAR, month, 1)).toISOString();
    var endDate = new Date(Date.UTC(TARGET_YEAR, month + 1, 1)).toISOString();

    var query = {
      structuredQuery: {
        from: [{ collectionId: INSTALLED_DEVICES_COLLECTION }],
        select: { fields: [{ fieldPath: "addedBy" }] },
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: "addedDate" },
                  op: "GREATER_THAN_OR_EQUAL",
                  value: { timestampValue: startDate }
                }
              },
              {
                fieldFilter: {
                  field: { fieldPath: "addedDate" },
                  op: "LESS_THAN",
                  value: { timestampValue: endDate }
                }
              }
            ]
          }
        },
        limit: 5000
      }
    };

    var response = UrlFetchApp.fetch(queryUrl, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + token },
      payload: JSON.stringify(query),
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    if (code !== 200) {
      Logger.log("Mesec " + (month + 1) + ": GRESKA — " + response.getContentText());
      Logger.log("Sacekaj par minuta i pokreni ponovo.");
      return;
    }

    var results = JSON.parse(response.getContentText());
    var monthDocs = 0;

    for (var i = 0; i < results.length; i++) {
      var doc = results[i].document;
      if (!doc) continue;

      monthDocs++;
      var fields = doc.fields || {};
      var addedByField = fields.addedBy;
      if (!addedByField || !addedByField.stringValue) continue;

      var email = addedByField.stringValue.toLowerCase().trim();
      if (email === "") continue;

      uniqueEmails[email] = (uniqueEmails[email] || 0) + 1;
    }

    totalDocs += monthDocs;
    Logger.log("Mesec " + (month + 1) + ": " + monthDocs + " dokumenata");

    if (month < 11) Utilities.sleep(MONTH_DELAY_MS);
  }

  var emails = Object.keys(uniqueEmails).sort();

  Logger.log("");
  Logger.log("=== Rezultat za " + TARGET_YEAR + ". godinu ===");
  Logger.log("Ukupno dokumenata: " + totalDocs);
  Logger.log("Razlicitih email adresa: " + emails.length);
  Logger.log("");

  for (var j = 0; j < emails.length; j++) {
    Logger.log((j + 1) + ". " + emails[j] + " (" + uniqueEmails[emails[j]] + " uredjaja)");
  }
}
