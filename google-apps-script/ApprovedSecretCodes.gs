/**
 * ApprovedSecretCodes.gs
 * Trigger funkcija za upload odobrenih secret kodova u Firestore.
 *
 * Koristiti kao onEdit ili installable trigger na spreadsheet-u.
 * Ocekivani sheet: "Approved secret codes"
 *   Kolona A — secret code (8 karaktera)
 *   Kolona B — status ("Synced" / error)
 *   Kolona C — potvrda koda nakon uspesnog upload-a
 */

const SECRET_CODE_LENGTH = 8;

function uploadNewApprovedSecretCodes(e) {
  var sheet = e.range.getSheet();
  if (sheet.getName() !== "Approved secret codes") return;

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
  var collection = Config.APPROVED_CHECK_CODES_COLLECTION;
  var batchSize = Config.BATCH_SIZE;

  // ── 1. Validacija i priprema ────────────────────────────────────────
  var toUpload = [];   // { row, code }
  var errors = [];     // { row, message }

  for (var i = 0; i < data.length; i++) {
    var row = startRow + i;
    var colA = data[i][0] != null ? data[i][0].toString().trim() : "";
    var colB = data[i][1] != null ? data[i][1].toString().trim() : "";

    if (colA === "" || isSynced(colB)) continue;

    if (colA.length !== SECRET_CODE_LENGTH) {
      errors.push({ row: row, message: "invalid length (" + colA.length + "/" + SECRET_CODE_LENGTH + ")" });
      continue;
    }

    toUpload.push({ row: row, code: colA });
  }

  // ── 2. Oznaci redove kao "Uploading..." ──────────────────────────────
  toUpload.forEach(function (item) {
    setUploading(sheet, item.row);
  });
  SpreadsheetApp.flush();

  // ── 3. Batch upload (POST — vraca 409 ako kod vec postoji) ─────────
  var count = 0;

  for (var b = 0; b < toUpload.length; b += batchSize) {
    var batch = toUpload.slice(b, b + batchSize);

    var items = batch.map(function (item) {
      return {
        documentId: item.code,
        data: { date: new Date(), sn: item.code }
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
      setSynced(sheet, item.row, item.code);
    }
  });

  errors.forEach(function (err) {
    setError(sheet, err.row, err.message);
  });

  Logger.log("Uploaded " + count + " new secret codes.");
  SpreadsheetApp.getActiveSpreadsheet().toast("Uploaded " + count + " new secret codes.");
}
