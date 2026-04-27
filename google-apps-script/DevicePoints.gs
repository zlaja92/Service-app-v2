/**
 * DevicePoints.gs
 * Cita kodove modela i poene iz Google Sheet-a i updateuje "points" polje
 * u Firestore kolekciji devices.
 *
 * Sheet format:
 *   Kolona A — kod modela
 *   Kolona C — poeni
 *
 * Pokretanje: pozovi updateDevicePoints() iz Apps Script editora ili custom menija.
 */

// Prilagodi putanju za svoju kolekciju (tenant-scoped)
var DEVICES_COLLECTION = "envs/prod/tenants/ariston/devices";

// Link do Google Sheet-a (ceo URL)
var DEVICE_POINTS_SHEET_URL = "OVDE_UNESI_CEO_LINK";

// Ime sheet tab-a
var DEVICE_POINTS_SHEET_NAME = "Devices";

function updateDevicePoints() {
  var spreadsheet = SpreadsheetApp.openByUrl(DEVICE_POINTS_SHEET_URL);
  var sheet = spreadsheet.getSheetByName(DEVICE_POINTS_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var collection = DEVICES_COLLECTION;

  var updated = 0;
  var errors = 0;

  // Preskoci header red (i = 1)
  for (var i = 1; i < data.length; i++) {
    var code = data[i][0] != null ? data[i][0].toString().trim() : "";
    var pointsRaw = data[i][2];

    if (code === "" || pointsRaw === "" || pointsRaw == null) continue;

    var points = Number(pointsRaw);
    if (isNaN(points)) {
      Logger.log("Red " + (i + 1) + ": Nevazeca vrednost poena za " + code + " (" + pointsRaw + ")");
      errors++;
      continue;
    }

    // 1. Procitaj trenutni dokument
    var current = FirebaseService.prod().getDocument(collection, code);
    if (!current.success) {
      Logger.log("Red " + (i + 1) + ": Dokument nije pronadjen za '" + code + "' u kolekciji " + collection + " — " + current.error);
      errors++;
      continue;
    }

    var oldPoints = current.data.points != null ? current.data.points : "N/A";

    // 2. Updateuj samo polje "points"
    var result = FirebaseService.prod().patchFields(collection, code, { points: points });
    if (!result.success) {
      Logger.log("Red " + (i + 1) + ": NEUSPEO update za " + code + " — " + result.error);
      errors++;
      continue;
    }

    // 3. Ponovo procitaj radi verifikacije
    var verify = FirebaseService.prod().getDocument(collection, code);
    var newPoints = verify.success ? verify.data.points : "GRESKA_CITANJA";

    var ok = Number(newPoints) === points;
    Logger.log(
      code + ": " + oldPoints + " → " + points +
      (ok ? " ✓ VERIFICIRANO" : " ✗ NEPODUDARANJE (procitano: " + newPoints + ")")
    );

    if (ok) updated++;
    else errors++;
  }

  var summary = "Zavrseno. Updateovano: " + updated + ", Gresaka: " + errors;
  Logger.log(summary);
  spreadsheet.toast(summary);
}

/**
 * Dodaje nove device-ove ili updateuje postojece.
 * Ako dokument postoji — loguje razlike i updateuje.
 * Ako ne postoji — kreira novi dokument.
 *
 * Sheet format (kolone A-F):
 *   A — Model code
 *   B — Model name
 *   C — Points
 *   D — Type
 *   E — SubType
 *   F — Photo URL
 */
function syncDevices() {
  var spreadsheet = SpreadsheetApp.openByUrl(DEVICE_POINTS_SHEET_URL);
  var sheet = spreadsheet.getSheetByName(DEVICE_POINTS_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var collection = DEVICES_COLLECTION;

  var created = 0;
  var updated = 0;
  var unchanged = 0;
  var errors = 0;

  for (var i = 1; i < data.length; i++) {
    var codeRaw = data[i][0];
    if (codeRaw === "" || codeRaw == null) continue;

    var code = Number(codeRaw);
    var codeStr = codeRaw.toString().trim();
    var name = data[i][1] != null ? data[i][1].toString().trim() : "";
    var points = data[i][2] != null ? Number(data[i][2]) : 0;
    var type = data[i][3] != null ? data[i][3].toString().trim() : "";
    var subType = data[i][4] != null ? data[i][4].toString().trim() : "";
    var photoURL = data[i][5] != null ? data[i][5].toString().trim() : "";

    var newData = {
      code: code,
      name: name,
      points: points,
      type: type,
      subType: subType,
      photoURL: photoURL
    };

    // Proveri da li dokument vec postoji
    var current = FirebaseService.prod().getDocument(collection, codeStr);

    if (current.success) {
      // Dokument postoji — uporedi polja i loguj razlike
      var changes = [];
      var fields = ["code", "name", "points", "type", "subType", "photoURL"];
      for (var f = 0; f < fields.length; f++) {
        var field = fields[f];
        var oldVal = current.data[field] != null ? current.data[field] : "N/A";
        var newVal = newData[field] != null ? newData[field] : "N/A";
        if (String(oldVal) !== String(newVal)) {
          changes.push(field + ": " + oldVal + " → " + newVal);
        }
      }

      if (changes.length === 0) {
        Logger.log(codeStr + ": Bez promena");
        unchanged++;
        continue;
      }

      var result = FirebaseService.prod().setDocument(collection, codeStr, newData);
      if (!result.success) {
        Logger.log("Red " + (i + 1) + ": NEUSPEO update za " + codeStr + " — " + result.error);
        errors++;
        continue;
      }

      Logger.log(codeStr + " UPDATEOVAN:");
      for (var c = 0; c < changes.length; c++) {
        Logger.log("  " + changes[c]);
      }
      updated++;

    } else {
      // Dokument ne postoji — kreiraj novi
      var result = FirebaseService.prod().setDocument(collection, codeStr, newData);
      if (!result.success) {
        Logger.log("Red " + (i + 1) + ": NEUSPELO kreiranje za " + codeStr + " — " + result.error);
        errors++;
        continue;
      }

      Logger.log(codeStr + " KREIRAN: " + name + " (" + type + ", " + points + " pts)");
      created++;
    }
  }

  var summary = "Zavrseno. Kreirano: " + created + ", Updateovano: " + updated + ", Nepromenjeno: " + unchanged + ", Gresaka: " + errors;
  Logger.log(summary);
  spreadsheet.toast(summary);
}
