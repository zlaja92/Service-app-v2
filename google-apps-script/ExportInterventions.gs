/**
 * ExportInterventions.gs
 * Eksport heating intervencija (int-heating: heat-pump + gas kotao, exported != true)
 * iz produkcione baze u Google Spreadsheet. HP i gas se upisuju u isti tab.
 *
 * Tok (exportHeatingInterventions → runExport_):
 *   1) Ugasi basic filter u sheet-u ako postoji.
 *   2) Pocetni "Redni broj" = poslednji upisani + 1 (posle gasenja filtera).
 *   3) Povuci stranicu intervencija sa exported == false (server-side, paginirano).
 *   4) Za svaku intervenciju procitaj user (1 doc po sn) i device (1 doc po model kodu) — kesirano.
 *      Prevodi tipa/opisa su hardkodovani; Radni kod i vrednost se citaju iz "Radni kodovi" taba (1 read po run-u).
 *   5) Sastavi redove (32 kolone, TEXT format), upisi na poslednji slobodan red.
 *   6) Procitaj nazad i verifikuj (upisano vs procitano).
 *   7) Tek ako je verifikacija uspela → postavi exported = true u bazi (batch).
 *   8) Bilo koja greska pri UPISU/verifikaciji/update-u → NE menja fleg, loguje i salje mejl, prekida.
 *      (Nedostajuci user/device se NE tretira kao greska — ta polja ostaju prazna.)
 *
 * Optimizovano za cest poziv sa malo intervencija (~10-50): cita samo potrebne user/device dokumente (uz kes).
 * Pokretanje: exportHeatingInterventions() iz editora.
 */

// ── KONFIGURACIJA ─────────────────────────────────────────────────────────

// Spreadsheet ID (iz URL-a: /spreadsheets/d/<OVO>/edit). POPUNI.
var EXPORT_SPREADSHEET_ID = "PASTE_HEATING_SPREADSHEET_ID_HERE";

// Tab. Ako ne postoji → kreira se.
var EXPORT_SHEET_NAME = "Intervencije";

// Mejl na koji se salje obavestenje o gresci.
var EXPORT_ERROR_EMAIL = "posarac.zlatomir@gmail.com";

// (PRIVREMENO, dok se ne unese servicer kolekcija) Tab sa serviserima za "Firma" kolonu:
// kolona 1 = email (= addedBy), kolona 2 = ime firme. Tab mora biti u istom spreadsheet-u.
var EXPORT_SERVISERI_SHEET = "Serviseri";

// Tab sa radnim kodovima: kol 1 = naziv tipa, kol 2 = GARANCIJA/VANGARANCIJA, kol 3 = radni kod, kol 4 = vrednost.
var EXPORT_RADNI_KODOVI_SHEET = "Radni kodovi";

// Tenant.
var EXPORT_TENANT = "tenants/arst-srb";

// Servisni centar — konstante, iste za sve intervencije.
var EXPORT_SC_ID = "7870";
var EXPORT_SC_CODE = "SR0001";
var EXPORT_SC_NAME = "AQUAGASTERM d.o.o";

// Koliko dokumenata po stranici.
var EXPORT_PAGE_SIZE = 300;
var EXPORT_MAX_PAGES = 200;

// Kontekst za poruku o gresci (postavlja runExport_).
var EXPORT_CTX = { collection: "", spreadsheetId: "" };

// Zaglavlje tabele — TACAN redosled/nazivi 32 kolone (upisuje se samo ako je sheet prazan).
var EXPORT_HEADER = [
  "Redni broj", "Godina", "Mesec", "Tip intervencije", "Radni kod", "Zemlja", " Firma",
  "Datum intervencije", "Opis kvara", "Ime ", "Prezime", "ADRESA", "Broj", "Telefon:",
  "Poštanski broj", "Grad", "Model Code", "Naziv modela", "sb", "Datum puštanja",
  "Vrednost intervencije", "Kilometraža", "Šifra rezervnog dela 1", "Šifra rezervnog dela 2",
  "Šifra rezervnog dela 3", "Šifra rezervnog dela 4", "Komentar", "Ime instalatera", "Broj instalatera",
  "S.C. ID", "S.C. code", "S.C. Name"
];

// Indeks (0-based) "Komentar" kolone — jedina koja se NE pise velikim slovom.
var EXPORT_KOMENTAR_IDX = EXPORT_HEADER.indexOf("Komentar");

// ── HEATING prevodi / kodovi (HP + gas) ────────────────────────────────────
// Tip intervencije po "deviceType|interventionType".
var EXPORT_HEATING_TYPE_TEXT = {
  "heat-pump|commissioning": "Toplotna pumpa puštanje u rad",
  "heat-pump|annual_service": "Toplotna pumpa godišnji servis",
  "heat-pump|interventionRepair": "Popravka toplotne pumpe",
  "gas-boiler|commissioning": "Gasni kotao puštanje u rad",
  "gas-boiler|annual_service": "Gasni kotao redovno održavanje",
  "gas-boiler|interventionRepair": "Popravka gasnog kotla"
};
// Opis kvara — fiksni opisi (commissioning/annual) + common fault opisi (repair).
var EXPORT_HEATING_DESC_TEXT = {
  "intervention_description_commissioning": "PUŠTANJE U RAD",
  "intervention_description_annual_service": "GODIŠNJI SERVIS",
  "fault_common_noise_heating": "BUKA PRILIKOM ZAGREVANJA",
  "fault_common_safety_valve_leak": "CURENJE SIGURNOSNOG VENTILA",
  "fault_common_water_leak": "CURI VODA IZ KOTLA",
  "fault_common_display_faulty": "NEISPRAVAN DISPLEJ",
  "fault_common_gas_valve_faulty": "GASNI VENTIL NEISPRAVAN",
  "fault_common_board_error": "GREŠKA ELEKTRONSKE PLOČE",
  "fault_common_exchanger_blocked": "IZMENJIVAČ NE RADI ZAPUŠEN",
  "fault_common_pump_faulty": "PUMPA NEISPRAVNA",
  "fault_common_manometer": "MANOMETAR NE PRIKAZUJE PRITISAK",
  "fault_common_electrodes_faulty": "NEISPRAVNE ELEKTRODE",
  "fault_common_no_modulation": "NEMA MODULACIJE",
  "fault_common_loose_part": "OLABAVLJEN DEO",
  "fault_common_overheating": "PREGREVA SE VODA",
  "fault_common_air_pressostat": "VAZDUŠNI PRESOSTAT NEISPRAVAN",
  "fault_common_water_pressostat": "VODENI PRESOSTAT NEISPRAVAN",
  "fault_common_refill_valve": "SLAVINA ZA DOPUNU NIJE ISPRAVNA",
  "fault_common_ntc_faulty": "NTC T NEISPRAVAN",
  "fault_common_no_ignition": "UREĐAJ NE PALI",
  "fault_common_fan_faulty": "VENTILATOR NEISPRAVAN",
  "fault_common_servo_motor": "NEISPRAVAN SERVO MOTOR",
  "fault_common_three_way_valve": "NEISPARVAN TROKRAKI VENTIL",
  "fault_common_reed_relay": "NEISPRAVAN REED RELEJ",
  "fault_common_flow_meter": "NEISPRAVAN MERAČ PROTOKA",
  "fault_common_three_way_insert": "NEISPAVAN ULOŽAK TROKRAKOG",
  "fault_gas_boiler_annual_service": "GODIŠNJI SERVIS",
  // boiler fault opisi — mogu se pojaviti zbog fallback-a u migraciji (heating repair → boiler opisi)
  "fault_boiler_no_heat_light_on": "NE GREJE, SIJA SIJALICA",
  "fault_boiler_no_heat_light_off": "NE GREJE, NE SIJA SIJALICA",
  "fault_boiler_trips_breaker": "IZBACUJE SKLOPKA",
  "fault_boiler_rattling": "ZVECKA U BOJLERU",
  "fault_boiler_yellow_water": "VODA IZ BOJLERA ŽUTA",
  "fault_boiler_noise_heating": "BUKA PRILIKOM ZAGREVANJA",
  "fault_boiler_heater_leak": "CURENJE GREJAČA",
  "fault_boiler_safety_valve_leak": "CURENJE SIGURNOSNOG VENTILA",
  "fault_boiler_water_leak": "CURI VODA IZ BOJLERA",
  "fault_boiler_heater_faulty": "GREJAČ NEISPRAVAN",
  "fault_boiler_display_faulty": "DISPLEJ NEISPRAVAN",
  "fault_boiler_board_faulty": "ELEKTRONSKA PLOČA NEISPRAVNA",
  "fault_boiler_smell": "MIRIS PRILIKOM RADA",
  "fault_boiler_loose_part": "OLABAVLJEN DEO",
  "fault_boiler_cover": "POKLOPAC BOJLERA",
  "fault_boiler_overheating": "PREGREVA SE VODA",
  "fault_boiler_pressure_issue": "PROBLEM SA PRITISKOM",
  "fault_boiler_tank_leak": "PROCUREO KAZAN",
  "fault_boiler_thermostat_faulty": "TERMOSTAT NEISPRAVAN",
  "fault_boiler_not_heating": "UREĐAJ NE GREJE",
  "fault_boiler_fast_cooling": "VODA SE BRZO HLADI",
  "fault_boiler_wiring_wrong": "ŽICE GREJAČA VEZANE POGREŠNO",
  "fault_boiler_buzzing": "ZUJANJE-PIŠTANJE PRILKOM RADA"
};
// ── ULAZNA FUNKCIJA ────────────────────────────────────────────────────────

function exportHeatingInterventions() {
  runExport_({
    spreadsheetId: EXPORT_SPREADSHEET_ID,
    sheetName: EXPORT_SHEET_NAME,
    collectionId: "int-heating",
    buildRow: buildHeatingRow_
  });
}

// ── TOK ────────────────────────────────────────────────────────────────────

function runExport_(opts) {
  if (!opts.spreadsheetId || opts.spreadsheetId.indexOf("PASTE_") === 0) {
    Logger.log("Spreadsheet ID nije postavljen za kolekciju " + opts.collectionId + " — prekidam.");
    return;
  }

  var fb = FirebaseService.prod();
  var NUM_COLS = EXPORT_HEADER.length;
  var RB_COL = EXPORT_HEADER.indexOf("Redni broj") + 1; // 1-based indeks "Redni broj" (running ordinal)
  var FULL_COLLECTION = EXPORT_TENANT + "/" + opts.collectionId;

  // Kontekst za eventualnu poruku o gresci.
  EXPORT_CTX.collection = FULL_COLLECTION;
  EXPORT_CTX.spreadsheetId = opts.spreadsheetId;

  // ── Otvori spreadsheet i sheet ─────────────────────────────────────────
  var sheet, ss;
  try {
    ss = SpreadsheetApp.openById(opts.spreadsheetId);
    sheet = opts.sheetName ? (ss.getSheetByName(opts.sheetName) || ss.insertSheet(opts.sheetName)) : ss.getSheets()[0];
    if (!sheet) throw new Error("Sheet nije pronadjen.");
  } catch (e) {
    notifyExportError_("Ne mogu da otvorim spreadsheet/sheet (ID=" + opts.spreadsheetId + ")", e);
    return;
  }

  // ── 1) Ugasi basic filter ako postoji ──────────────────────────────────
  try {
    var existingFilter = sheet.getFilter();
    if (existingFilter) existingFilter.remove();
  } catch (e) {
    notifyExportError_("Greska pri uklanjanju filtera iz sheet-a", e);
    return;
  }

  // Header ako je sheet potpuno prazan.
  if (sheet.getLastRow() === 0) {
    try {
      sheet.getRange(1, 1, 1, NUM_COLS).setValues([EXPORT_HEADER]);
      SpreadsheetApp.flush();
    } catch (e) {
      notifyExportError_("Greska pri upisu header reda", e);
      return;
    }
  }

  // ── 2) Pocetni Redni broj = poslednji upisani + 1 ──────────────────────
  var seq = readLastSeq_(sheet, RB_COL) + 1;

  // (PRIVREMENO) Mapa email → ime firme iz "Serviseri" taba (jedan sheet read po run-u).
  var serviserByEmail = loadServiserMap_(ss);

  // Mapa "NAZIV TIPA|GARANCIJA/VANGARANCIJA" → radni kod iz "Radni kodovi" taba (jedan read po run-u).
  var radniKodMap = loadRadniKodMap_(ss);

  // Kes u okviru run-a (da se isti user/device ne cita vise puta).
  var userCache = {};
  var deviceCache = {};

  var totalExported = 0;

  for (var iter = 0; iter < EXPORT_MAX_PAGES; iter++) {
    // ── 3) Povuci stranicu exported == false ──────────────────────────────
    var query = {
      from: [{ collectionId: opts.collectionId }],
      where: {
        fieldFilter: { field: { fieldPath: "exported" }, op: "EQUAL", value: { booleanValue: false } }
      },
      orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
      limit: EXPORT_PAGE_SIZE
    };

    var docs;
    try {
      docs = fb.runQuery(EXPORT_TENANT, query);
    } catch (e) {
      notifyExportError_("Greska pri citanju intervencija iz baze (stranica " + (iter + 1) + ")", e);
      return;
    }

    Logger.log("Stranica " + (iter + 1) + ": vraceno " + docs.length + " intervencija sa exported == false (" + opts.collectionId + ")");
    if (docs.length === 0) break;

    // ── 4) Sastavi redove (po intervenciji: 1 user + 1 device read, kesirano) ──
    var startRow = sheet.getLastRow() + 1;
    var rows = [];
    try {
      for (var i = 0; i < docs.length; i++) {
        var data = fb.decodeFields(docs[i].fields);
        var sn = exportStr_(data["sn"]);
        var modelCode = sn.length >= 7 ? sn.substring(0, 7) : sn;
        var user = getUserCached_(fb, sn, userCache);
        var device = getDeviceCached_(fb, modelCode, deviceCache);
        rows.push(opts.buildRow(data, seq, sn, modelCode, user, device, serviserByEmail, radniKodMap));
        seq++;
      }
    } catch (e) {
      notifyExportError_("Greska pri citanju user/device dokumenata (stranica " + (iter + 1) + ")", e);
      return;
    }

    // ── 5) Upisi (TEXT format da se ne pokvare duge cifre) ────────────────
    try {
      var range = sheet.getRange(startRow, 1, rows.length, NUM_COLS);
      range.setNumberFormat("@");
      range.setValues(rows);
      SpreadsheetApp.flush();
    } catch (e) {
      notifyExportError_("Greska pri upisu u spreadsheet (red " + startRow + ", " + rows.length + " redova)", e);
      return; // ne menjaj fleg u bazi
    }

    // ── 6) Procitaj nazad i verifikuj ─────────────────────────────────────
    try {
      var readBack = sheet.getRange(startRow, 1, rows.length, NUM_COLS).getValues();
      if (!verifyExportRows_(readBack, rows)) {
        notifyExportError_(
          "Verifikacija upisa nije uspela (red " + startRow + "): procitani podaci se ne poklapaju sa upisanim. " +
          "Fleg exported NIJE menjan.",
          new Error("verify mismatch")
        );
        return;
      }
    } catch (e) {
      notifyExportError_("Greska pri verifikaciji upisa (red " + startRow + ")", e);
      return;
    }

    // ── 7) Postavi exported = true (full re-write sa istim poljima) ────────
    var writes = docs.map(function (d) {
      var fields = d.fields;
      fields.exported = { booleanValue: true };
      return { collection: FULL_COLLECTION, documentId: d.id, fields: fields };
    });

    var flagFailures = [];
    for (var b = 0; b < writes.length; b += 500) {
      var batch = writes.slice(b, b + 500);
      var results;
      try {
        results = fb.batchWriteSets(batch);
      } catch (e) {
        notifyExportError_("Greska pri azuriranju exported flega (PODACI SU VEC UPISANI u sheet, red " + startRow + ")", e);
        return;
      }
      for (var r = 0; r < results.length; r++) {
        if (!results[r].success) flagFailures.push(batch[r].documentId + ": " + results[r].error);
      }
    }
    if (flagFailures.length > 0) {
      notifyExportError_(
        "Neki exported flegovi nisu azurirani (podaci SU u sheet-u, ali ce se ponovo eksportovati pri sledecem run-u):\n"
        + flagFailures.join("\n"),
        new Error("flag update partial")
      );
      return;
    }

    totalExported += docs.length;
    Logger.log("Stranica " + (iter + 1) + ": upisano i flag-ovano " + docs.length + " (ukupno " + totalExported + ")");

    if (docs.length < EXPORT_PAGE_SIZE) break;
  }

  Logger.log("Zavrseno (" + opts.collectionId + "). Ukupno eksportovano: " + totalExported);
}

// ── ROW BUILDER ──────────────────────────────────────────────────────────

/** Heating red (HP + gas) — tip/opis/Radni kod/vrednost zavise od deviceType. */
function buildHeatingRow_(data, seq, sn, modelCode, user, device, serviserByEmail, radniKodMap) {
  var deviceType = device ? device.type : "";
  var tip = EXPORT_HEATING_TYPE_TEXT[deviceType + "|" + data["interventionType"]] || exportStr_(data["interventionType"]);
  var opis = EXPORT_HEATING_DESC_TEXT[data["interventionDescription"]] || exportStr_(data["interventionDescription"]);
  var rk = lookupRadniKodEntry_(radniKodMap, deviceType, data["interventionType"], data["warrantyStatus"]);
  return assembleExportRow_(seq, data, sn, modelCode, device, user, serviserByEmail, tip, opis, rk.kod, rk.vrednost);
}

/**
 * Sklapa red od 32 kolone i upper-case-uje sve sem Komentara.
 * tip/opis/radniKod/vrednost su vec razreseni; ostalo je zajednicko.
 */
function assembleExportRow_(seq, data, sn, modelCode, device, user, serviserByEmail, tip, opis, radniKod, vrednost) {
  var dt = (data["addedDate"] instanceof Date) ? data["addedDate"] : null;
  var datumIntervencije = dt ? exportFmtDate_(dt) : "";
  var godina = dt ? String(dt.getFullYear()) : "";
  var mesec = dt ? String(dt.getMonth() + 1) : "";

  var dop = (user.dateOfPurchase instanceof Date) ? user.dateOfPurchase : null;
  var datumPustanja = dop ? exportFmtDate_(dop) : "";

  // Firma — ime firme iz "Serviseri" taba po addedBy emailu; fallback na sam email.
  var addedBy = exportStr_(data["addedBy"]);
  var firma = (serviserByEmail && serviserByEmail[addedBy.toLowerCase()]) || addedBy;

  var deviceName = device ? device.name : "";

  var row = [
    String(seq),                                 // 1  Redni broj
    godina,                                      // 2  Godina
    mesec,                                       // 3  Mesec
    tip,                                         // 4  Tip intervencije
    radniKod,                                    // 5  Radni kod
    "SR",                                        // 6  Zemlja
    firma,                                       // 7   Firma
    datumIntervencije,                           // 8  Datum intervencije
    opis,                                        // 9  Opis kvara
    exportStr_(user.firstName),                  // 10 Ime
    exportStr_(user.lastName),                   // 11 Prezime
    exportStr_(user.streetName),                 // 12 ADRESA
    exportStr_(user.homeNumber),                 // 13 Broj
    exportStr_(user.phoneNumber),                // 14 Telefon:
    exportStr_(user.postCode),                   // 15 Poštanski broj
    exportStr_(user.city),                       // 16 Grad
    modelCode,                                   // 17 Model Code
    exportStr_(deviceName),                      // 18 Naziv modela
    sn,                                          // 19 sb (= sn)
    datumPustanja,                               // 20 Datum puštanja
    vrednost,                                    // 21 Vrednost intervencije
    exportStr_(data["distance"]),                // 22 Kilometraža
    exportStr_(data["sparePart1"]),              // 23 Šifra rezervnog dela 1
    exportStr_(data["sparePart2"]),              // 24 Šifra rezervnog dela 2
    exportStr_(data["sparePart3"]),              // 25 Šifra rezervnog dela 3
    exportStr_(data["sparePart4"]),              // 26 Šifra rezervnog dela 4
    exportStr_(data["note"]),                    // 27 Komentar
    exportStr_(data["installerName"]),           // 28 Ime instalatera
    exportStr_(data["installerPhoneNumber"]),    // 29 Broj instalatera
    EXPORT_SC_ID,                                // 30 S.C. ID
    EXPORT_SC_CODE,                              // 31 S.C. code
    EXPORT_SC_NAME                               // 32 S.C. Name
  ];

  // Sve velikim slovom osim Komentara.
  for (var c = 0; c < row.length; c++) {
    if (c !== EXPORT_KOMENTAR_IDX) row[c] = row[c].toUpperCase();
  }
  return row;
}

// ── RADNI KOD (iz "Radni kodovi" taba) ──────────────────────────────────────

/**
 * Naziv tipa za "Radni kodovi" tab (kolona 1), iz deviceType + interventionType + warrantyStatus.
 * Gas godisnji ima dva naziva (REDOVNO ODRŽAVANJE = garancija, ODRŽAVANJE U VANGARANCIJI);
 * ostali tipovi imaju jedan naziv (garancija/vangarancija se razresava kolonom 2 u tabu).
 */
function radniKodTypeName_(deviceType, interventionType, warrantyStatus) {
  if (deviceType === "heat-pump") {
    if (interventionType === "commissioning") return "PUŠTANJE U RAD TOPLOTNA PUMPA";
    if (interventionType === "annual_service") return "TOPLOTNA PUMPA - GODIŠNJI SERVIS";
    if (interventionType === "interventionRepair") return "POPRAVKA - TOPLOTNA PUMPA";
  } else if (deviceType === "gas-boiler") {
    if (interventionType === "commissioning") return "PUŠTANJE U RAD GASNI KOTAO";
    if (interventionType === "annual_service") {
      return (warrantyStatus === "in-warranty") ? "GASNI KOTAO REDOVNO ODRŽAVANJE" : "GASNI KOTAO ODRŽAVANJE U VANGARANCIJI";
    }
    if (interventionType === "interventionRepair") return "POPRAVKA - GASNI KOTAO";
  }
  return "";
}

/**
 * Trazi { kod, vrednost } u mapi iz "Radni kodovi" taba po kljucu (NAZIV TIPA | GARANCIJA/VANGARANCIJA).
 * Vraca { kod: "", vrednost: "" } ako naziv nije poznat ili red nije pronadjen u tabu.
 */
function lookupRadniKodEntry_(radniKodMap, deviceType, interventionType, warrantyStatus) {
  var typeName = radniKodTypeName_(deviceType, interventionType, warrantyStatus);
  if (!typeName) return { kod: "", vrednost: "" };
  var marker = (warrantyStatus === "in-warranty") ? "GARANCIJA" : "VANGARANCIJA";
  var entry = radniKodMap[typeName.toUpperCase().trim() + "|" + marker];
  return entry || { kod: "", vrednost: "" };
}

// ── PER-INTERVENCIJA LOOKUP (1 doc, kesirano) ────────────────────────────

/** Cita user po sn (1 getDocument), kesirano. Vraca {} ako nije nadjen. */
function getUserCached_(fb, sn, cache) {
  if (sn === "") return {};
  if (cache.hasOwnProperty(sn)) return cache[sn];
  var res = fb.getDocument(EXPORT_TENANT + "/users", sn);
  var u = (res.success && res.data) ? res.data : {};
  cache[sn] = u;
  return u;
}

/** Cita device po model kodu (1 getDocument), kesirano. Vraca { name, type } ("" ako nije nadjen). */
function getDeviceCached_(fb, modelCode, cache) {
  if (modelCode === "") return { name: "", type: "" };
  if (cache.hasOwnProperty(modelCode)) return cache[modelCode];
  var res = fb.getDocument(EXPORT_TENANT + "/devices", modelCode);
  var d = (res.success && res.data) ? res.data : {};
  var dev = {
    name: (d.deviceName != null) ? String(d.deviceName) : "",
    type: (d.deviceType != null) ? String(d.deviceType) : ""
  };
  cache[modelCode] = dev;
  return dev;
}

// ── HELPERI ──────────────────────────────────────────────────────────────

/**
 * (PRIVREMENO) Ucitava "Serviseri" tab → mapa { email (lowercase): ime firme }.
 * Kolona 1 = email, kolona 2 = ime firme. Vraca {} ako tab ne postoji / pri gresci.
 */
function loadServiserMap_(ss) {
  try {
    var sh = ss.getSheetByName(EXPORT_SERVISERI_SHEET);
    if (!sh) return {};
    var lastRow = sh.getLastRow();
    if (lastRow < 1) return {};
    var values = sh.getRange(1, 1, lastRow, 2).getValues();
    var map = {};
    for (var i = 0; i < values.length; i++) {
      var email = String(values[i][0] == null ? "" : values[i][0]).trim().toLowerCase();
      var firma = String(values[i][1] == null ? "" : values[i][1]).trim();
      if (email) map[email] = firma;
    }
    return map;
  } catch (e) {
    Logger.log("Upozorenje: ne mogu da ucitam '" + EXPORT_SERVISERI_SHEET + "' tab: " + e);
    return {};
  }
}

/**
 * Ucitava "Radni kodovi" tab → mapa { "NAZIV TIPA|GARANCIJA/VANGARANCIJA": { kod, vrednost } }.
 * Kol 1 = naziv tipa, kol 2 = GARANCIJA/VANGARANCIJA, kol 3 = radni kod, kol 4 = vrednost.
 * Kljucevi su uppercase+trim radi robusnog poklapanja. Vraca {} ako tab ne postoji / pri gresci.
 */
function loadRadniKodMap_(ss) {
  try {
    var sh = ss.getSheetByName(EXPORT_RADNI_KODOVI_SHEET);
    if (!sh) return {};
    var lastRow = sh.getLastRow();
    if (lastRow < 1) return {};
    var values = sh.getRange(1, 1, lastRow, 4).getValues();
    var map = {};
    for (var i = 0; i < values.length; i++) {
      var name = String(values[i][0] == null ? "" : values[i][0]).trim().toUpperCase();
      var marker = String(values[i][1] == null ? "" : values[i][1]).trim().toUpperCase();
      var kod = String(values[i][2] == null ? "" : values[i][2]).trim();
      var vrednost = String(values[i][3] == null ? "" : values[i][3]).trim();
      if (name && marker) map[name + "|" + marker] = { kod: kod, vrednost: vrednost };
    }
    return map;
  } catch (e) {
    Logger.log("Upozorenje: ne mogu da ucitam '" + EXPORT_RADNI_KODOVI_SHEET + "' tab: " + e);
    return {};
  }
}

/** String vrednost ("" za null/undefined). */
function exportStr_(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** Formatira Date u "yyyy-MM-dd HH:mm:ss" (Europe/Belgrade). */
function exportFmtDate_(d) {
  return Utilities.formatDate(d, "Europe/Belgrade", "yyyy-MM-dd HH:mm:ss");
}

/** Cita poslednji upisani "Redni broj"; vraca 0 ako nema podataka (samo header ili prazno). */
function readLastSeq_(sheet, col1Based) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var val = sheet.getRange(lastRow, col1Based).getValue();
  var n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

/** Verifikuje upis: broj redova + svaka celija (kao string) mora da se poklapa. */
function verifyExportRows_(readBack, rows) {
  if (!readBack || readBack.length !== rows.length) return false;
  for (var i = 0; i < rows.length; i++) {
    if (readBack[i].length !== rows[i].length) return false;
    for (var j = 0; j < rows[i].length; j++) {
      if (String(readBack[i][j]) !== String(rows[i][j])) return false;
    }
  }
  return true;
}

/** Loguje gresku i salje mejl. */
function notifyExportError_(context, err) {
  var detail = (err && err.message) ? err.message : String(err);
  var body =
    "Eksport intervencija je prekinut.\n\n" +
    "Kontekst: " + context + "\n" +
    "Greska: " + detail + "\n\n" +
    "Kolekcija: " + EXPORT_CTX.collection + "\n" +
    "Spreadsheet ID: " + EXPORT_CTX.spreadsheetId + "\n" +
    "Vreme: " + Utilities.formatDate(new Date(), "Europe/Belgrade", "yyyy-MM-dd HH:mm:ss");

  Logger.log("EXPORT GRESKA — " + context + ": " + detail);

  try {
    MailApp.sendEmail(EXPORT_ERROR_EMAIL, "[Export intervencija] Greska", body);
  } catch (mailErr) {
    Logger.log("Ne mogu da posaljem mejl o gresci: " + mailErr);
  }
}
