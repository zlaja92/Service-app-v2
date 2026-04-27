/**
 * ApprovedSn.gs
 * Trigger funkcija za upload odobrenih serijskih brojeva u Firestore.
 *
 * Koristiti kao onEdit ili installable trigger na spreadsheet-u.
 * Ocekivani sheet: "Approved SN"
 *   Kolona A — serijski broj (21 karakter)
 *   Kolona B — status ("Synced" / error)
 *   Kolona C — potvrda SN-a nakon uspesnog upload-a
 */

const SN_LENGTH = 21;

function uploadNewApprovedSn(e) {
  var sheet = e.range.getSheet();
  if (sheet.getName() !== "Approved SN") return;

  // Reaguj samo na promene u koloni A
  if (e.range.getColumn() > 1) return;

  // Citaj samo izmenjeni opseg (kolone A i B)
  var startRow = e.range.getRow();
  var numRows = e.range.getNumRows();

  // Preskoci header red
  if (startRow === 1) {
    startRow = 2;
    numRows = numRows - 1;
  }
  if (numRows <= 0) return;

  var data = sheet.getRange(startRow, 1, numRows, 2).getValues();
  var collection = Config.APPROVED_DEVICES_COLLECTION;
  var batchSize = Config.BATCH_SIZE;

  // ── 1. Validacija i priprema ────────────────────────────────────────
  var toUpload = [];   // { row, sn }
  var errors = [];     // { row, message }

  for (var i = 0; i < data.length; i++) {
    var row = startRow + i;
    var colA = data[i][0] != null ? data[i][0].toString().trim() : "";
    var colB = data[i][1] != null ? data[i][1].toString().trim() : "";

    if (colA === "" || isSynced(colB)) continue;

    if (colA.length !== SN_LENGTH) {
      errors.push({ row: row, message: "invalid length (" + colA.length + "/" + SN_LENGTH + ")" });
      continue;
    }

    toUpload.push({ row: row, sn: colA });
  }

  // ── 2. Oznaci redove kao "Uploading..." ──────────────────────────────
  toUpload.forEach(function (item) {
    setUploading(sheet, item.row);
  });
  SpreadsheetApp.flush();

  // ── 3. Batch upload (POST — vraca 409 ako SN vec postoji) ──────────
  var count = 0;

  for (var b = 0; b < toUpload.length; b += batchSize) {
    var batch = toUpload.slice(b, b + batchSize);

    var items = batch.map(function (item) {
      return {
        documentId: item.sn,
        data: { date: new Date(), sn: item.sn }
      };
    });

    var results = FirebaseService.prod().batchCreateDocuments(collection, items);

    for (var k = 0; k < results.length; k++) {
      if (results[k].success) {
        batch[k].synced = true;
        count++;
      } else {
        errors.push({ row: batch[k].row, message: results[k].error });
      }
    }
  }

  // ── 4. Upis rezultata u sheet ───────────────────────────────────────
  toUpload.forEach(function (item) {
    if (item.synced) {
      setSynced(sheet, item.row, item.sn);
    }
  });

  errors.forEach(function (err) {
    setError(sheet, err.row, err.message);
  });

  Logger.log("Uploaded " + count + " new rows.");
  SpreadsheetApp.getActiveSpreadsheet().toast("Uploaded " + count + " new rows.");
}
