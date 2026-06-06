/**
 * migrateDatabase.gs
 * Migracija dokumenata iz stare baze u novu (produkcionu) bazu.
 *
 * Svaka migracija je posebna funkcija — sa hardkodovanim:
 *   - putanjom izvorne kolekcije
 *   - putanjom destinacione kolekcije
 *   - dodatnim/preimenovanim poljima
 *
 * Document ID se cuva — isti je u staroj i u novoj bazi.
 *
 * Pokretanje: pozovi konkretnu funkciju (npr. migrateDevices) iz Apps Script editora.
 */

// ── Migracija: device (stara root kolekcija → tenant-scoped devices) ─────

/**
 * Cita SVE device dokumente iz stare baze, prepakuje polja
 * (preimenuje tip, dodaje hardkodovana polja) i upisuje u produkcionu bazu.
 * Document ID se ne menja.
 */
function migrateDevices() {
  // ── HARDKODOVANE VREDNOSTI ─────────────────────────────────────────────
  var SOURCE_COLLECTION = "devices";
  var DEST_COLLECTION = "tenants/arst-srb/devices";

  // Filter — server-side. Placas SAMO dokumente koji odgovaraju (a ne celu kolekciju).
  var FILTER_FIELD = "Device type";
  var FILTER_VALUE = "Gas_boiler";

  // Resume — postavi na ID poslednjeg uspesno migriranog device-a iz prethodnog run-a.
  // Prvi run: ostavi prazno. Posle run-a, na kraju loga pise sledeci START_AFTER_ID.
  var START_AFTER_ID = "";
  // Koliko device-ova povuci u ovom run-u.
  var LIMIT = 100;

  // Polja koja prebrisuju ili dopunjuju polja iz izvornog dokumenta.
  var OVERRIDES = {
    deviceType: "gas-boiler",    // preimenovan tip uredjaja (DeviceType enum value)
    annualService: true,
    commissioning: true,
    connectedDevice: false,
    firstServiceYear: 1,
    serviceWindowStart: 9,
    serviceWindowEnd: 13,
    warrantyMonths: 60
  };

  // ── EXECUTION ──────────────────────────────────────────────────────────
  var source = FirebaseService.old();    // stara baza
  var target = FirebaseService.prod();   // produkciona baza

  // Server-side filter + paginacija (cursor-based, bez naplate preskocenih dokumenata).
  var query = {
    from: [{ collectionId: SOURCE_COLLECTION }],
    where: {
      fieldFilter: {
        field: { fieldPath: quoteFieldPath_(FILTER_FIELD) },
        op: "EQUAL",
        value: { stringValue: FILTER_VALUE }
      }
    },
    orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
    limit: LIMIT
  };

  if (START_AFTER_ID) {
    query.startAt = {
      values: [{ referenceValue: source.buildReferencePath(SOURCE_COLLECTION, START_AFTER_ID) }],
      before: false  // false = startAfter (ekskluzivno), true = startAt (inkluzivno)
    };
  }

  var sliced = source.runQuery("", query);
  Logger.log(
    "Vraceno " + sliced.length + " device-a sa filterom '" + FILTER_FIELD + " == " + FILTER_VALUE + "'" +
    (START_AFTER_ID ? " posle '" + START_AFTER_ID + "'" : " (od pocetka)") +
    " — limit " + LIMIT
  );
  if (sliced.length === 0) {
    Logger.log("Nema vise dokumenata za migraciju.");
    return;
  }

  // Dekodiraj polja izvora — koriste se za camelCase rename + OVERRIDES merge.
  var sourceDataByDocId = {};
  for (var k = 0; k < sliced.length; k++) {
    sourceDataByDocId[sliced[k].id] = source.decodeFields(sliced[k].fields);
  }

  // Skupi sve upise u jednu listu, pa flushuj u batch-evima (paralelni PATCH).
  var writes = [];

  // Brojac upisa po deviceId — sluzi za detektovanje "celokupno prekopiran" status.
  // Format: { deviceId: { total: N, success: M } }
  var deviceStats = {};
  function trackDevice_(deviceId) {
    if (!deviceStats[deviceId]) deviceStats[deviceId] = { total: 0, success: 0 };
    deviceStats[deviceId].total++;
  }

  // 1) Glavni device dokumenti — transformacija + queue
  for (var i = 0; i < sliced.length; i++) {
    var doc = sliced[i];
    var newData = mergeData_(sourceDataByDocId[doc.id], OVERRIDES);
    // deviceCode mora biti string (app interface ga ocekuje kao string,
    // a stari izvor ga ima kao int64 — pa rucno kastujemo).
    if (newData.deviceCode != null) newData.deviceCode = String(newData.deviceCode);
    writes.push({
      collection: DEST_COLLECTION,
      documentId: doc.id,
      fields: target.encodeFields(newData),
      deviceId: doc.id
    });
    trackDevice_(doc.id);
  }

  // 2) Sklopovi (paralelno citanje za sve device-ove odjednom)
  var sklopoviSourcePaths = sliced.map(function (d) { return SOURCE_COLLECTION + "/" + d.id + "/Sklopovi"; });
  var sklopoviResults = source.batchListDocuments(sklopoviSourcePaths);

  // Prikupi (sourcePath, targetPath) za Rezervne delove iz svakog Sklopa
  var rezDeloviTaskList = [];

  for (var s = 0; s < sklopoviResults.length; s++) {
    var sklopRes = sklopoviResults[s];
    if (sklopRes.error) {
      Logger.log("Sklopovi GRESKA " + sklopRes.path + ": " + sklopRes.error);
      continue;
    }
    if (sklopRes.nextPageToken) {
      Logger.log("UPOZORENJE: " + sklopRes.path + " ima >300 dokumenata — paginacija nije implementirana u batch-u.");
    }

    var deviceId = sliced[s].id;
    var targetSklopovi = DEST_COLLECTION + "/" + deviceId + "/Sklopovi";

    for (var sd = 0; sd < sklopRes.docs.length; sd++) {
      var sklopDoc = sklopRes.docs[sd];
      writes.push({
        collection: targetSklopovi,
        documentId: sklopDoc.id,
        fields: sklopDoc.fields,
        deviceId: deviceId
      });
      trackDevice_(deviceId);
      rezDeloviTaskList.push({
        sourcePath: SOURCE_COLLECTION + "/" + deviceId + "/Sklopovi/" + sklopDoc.id + "/Rezervni delovi",
        targetPath: DEST_COLLECTION + "/" + deviceId + "/Sklopovi/" + sklopDoc.id + "/Rezervni delovi",
        deviceId: deviceId
      });
    }
  }

  // 3) Rezervni delovi (paralelno citanje za sve sklopove odjednom)
  if (rezDeloviTaskList.length > 0) {
    var rezSourcePaths = rezDeloviTaskList.map(function (t) { return t.sourcePath; });
    // Batchuj po Config.BATCH_SIZE da ne preopteretis fetchAll
    var READ_BATCH = Config.BATCH_SIZE || 500;
    for (var rb = 0; rb < rezSourcePaths.length; rb += READ_BATCH) {
      var rezPathsBatch = rezSourcePaths.slice(rb, rb + READ_BATCH);
      var rezResults = source.batchListDocuments(rezPathsBatch);
      for (var rr = 0; rr < rezResults.length; rr++) {
        var rezRes = rezResults[rr];
        if (rezRes.error) {
          Logger.log("Rezervni delovi GRESKA " + rezRes.path + ": " + rezRes.error);
          continue;
        }
        if (rezRes.nextPageToken) {
          Logger.log("UPOZORENJE: " + rezRes.path + " ima >300 dokumenata.");
        }
        var rezTask = rezDeloviTaskList[rb + rr];
        for (var rd = 0; rd < rezRes.docs.length; rd++) {
          writes.push({
            collection: rezTask.targetPath,
            documentId: rezRes.docs[rd].id,
            fields: rezRes.docs[rd].fields,
            deviceId: rezTask.deviceId
          });
          trackDevice_(rezTask.deviceId);
        }
      }
    }
  }

  Logger.log("Ukupno upisa za izvrsiti: " + writes.length);

  // Flush u batch-evima — :batchWrite endpoint (do 500 upisa u JEDAN HTTP call).
  // Stedi UrlFetch quota: 500 upisa = 1 call (umesto 500 paralelnih call-ova).
  var BATCH_SIZE = 500;
  var migrated = 0;
  var errors = 0;

  for (var b = 0; b < writes.length; b += BATCH_SIZE) {
    var batch = writes.slice(b, b + BATCH_SIZE);
    var results = target.batchWriteSets(batch);
    for (var r = 0; r < results.length; r++) {
      if (results[r].success) {
        migrated++;
        deviceStats[batch[r].deviceId].success++;
      } else {
        errors++;
        Logger.log("GRESKA " + batch[r].collection + "/" + batch[r].documentId + ": " + results[r].error);
      }
    }
    Logger.log("Batch " + (Math.floor(b / BATCH_SIZE) + 1) + ": " + batch.length + " upisa (1 HTTP call)");
  }

  // Lista celokupno prekopiranih device-ova (svi pratioci uspesni: device + sklopovi + rezervni delovi)
  var fullyCopied = [];
  var partiallyCopied = [];
  for (var i2 = 0; i2 < sliced.length; i2++) {
    var did = sliced[i2].id;
    var st = deviceStats[did];
    if (st && st.success === st.total) {
      fullyCopied.push(did);
    } else if (st) {
      partiallyCopied.push(did + " (" + st.success + "/" + st.total + ")");
    }
  }

  Logger.log("Celokupno prekopirani device-ovi (" + fullyCopied.length + "): " + fullyCopied.join(", "));
  if (partiallyCopied.length > 0) {
    Logger.log("Delimicno prekopirani (" + partiallyCopied.length + "): " + partiallyCopied.join(", "));
  }
  Logger.log("Zavrseno. Migrirano: " + migrated + ", Gresaka: " + errors);

  // Resume cursor — postavi ovaj ID kao START_AFTER_ID za sledeci run.
  var lastId = sliced[sliced.length - 1].id;
  Logger.log("Sledeci START_AFTER_ID = \"" + lastId + "\"");
}

// ── Patch: in-place fix postojecih device dokumenata u prod-u ────────────

/**
 * Prolazi kroz SVE device dokumente u produkcionoj bazi i:
 *   1) konvertuje deviceCode iz number u string (ako vec nije string)
 *   2) postavlja serviceWindowStart na 6
 *
 * Cita iz `tenants/arst-srb/devices` (target = prod), ne iz stare baze.
 * Ostala polja ostaju netaknuta.
 */
function fixDeviceFields() {
  var COLLECTION_PARENT = "tenants/arst-srb";
  var COLLECTION_ID = "devices";
  var FULL_COLLECTION = COLLECTION_PARENT + "/" + COLLECTION_ID;

  var target = FirebaseService.prod();

  // Povuci sve dokumente jednim runQuery-jem (376 << 5MB limit).
  var query = {
    from: [{ collectionId: COLLECTION_ID }],
    orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
    limit: 1000
  };

  var docs = target.runQuery(COLLECTION_PARENT, query);
  Logger.log("Pronadjeno " + docs.length + " device dokumenata u " + FULL_COLLECTION);
  if (docs.length === 0) return;

  // Pripremi izmene — citamo polja, modifikujemo, pa ih vracamo
  var writes = [];
  var changed = 0;
  var unchanged = 0;

  for (var i = 0; i < docs.length; i++) {
    var doc = docs[i];
    var data = target.decodeFields(doc.fields);

    var needsUpdate = false;
    if (data.deviceCode != null && typeof data.deviceCode !== "string") {
      data.deviceCode = String(data.deviceCode);
      needsUpdate = true;
    }
    if (data.serviceWindowStart !== 6) {
      data.serviceWindowStart = 6;
      needsUpdate = true;
    }

    if (!needsUpdate) {
      unchanged++;
      continue;
    }

    writes.push({
      collection: FULL_COLLECTION,
      documentId: doc.id,
      fields: target.encodeFields(data)
    });
    changed++;
  }

  Logger.log("Za update: " + changed + ", vec ispravnih: " + unchanged);
  if (writes.length === 0) {
    Logger.log("Nema sta da se ispravlja.");
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

  Logger.log("Zavrseno. Updateovano: " + success + ", Gresaka: " + errors);
}

// ── Migracija: intervencije bojlera (parametrizovano po tipu) ────────────

/**
 * Migracija tipa "BUKA-ZAMENA OBA GREJACA VLS" → intervention_noise (Radni_kod B899003 = in-warranty).
 * Pokreni ovu funkciju iz editora. Za resume prekopiraj ispisani ID u startAfterId.
 */
function migrateBoilerInterventionsNoise() {
  migrateBoilerInterventions_({
    filterValue: "BUKA-ZAMENA OBA GREJACA VLS",
    interventionType: "intervention_noise",
    warrantyByCode: { "B899003": "in-warranty" },
    startAfterId: "",
    limit: 500
  });
}

/**
 * Migracija tipa "ZAMENA ELEKTRIČNOG BOJLERA" → intervention_replace (Radni_kod C899001 = in-warranty).
 * Pokreni ovu funkciju iz editora. Za resume prekopiraj ispisani ID u startAfterId.
 *
 * NAPOMENA: filterValue mora biti TACNO kako stoji u staroj bazi (EQUAL filter je egzaktan).
 * Ako prvi run vrati 0 rezultata, najverovatnije se dijakritici razlikuju
 * (npr. "ELEKTRICNOG" umesto "ELEKTRIČNOG") — proveri vrednost u izvornom dokumentu.
 */
function migrateBoilerInterventionsReplace() {
  migrateBoilerInterventions_({
    filterValue: "ZAMENA ELEKTRIČNOG BOJLERA",
    interventionType: "intervention_replace",
    warrantyByCode: { "C899001": "in-warranty" },
    startAfterId: "",
    limit: 500
  });
}

/**
 * Migracija tipa "POPRAVKA ELEKTRIČNOG BOJLERA" → interventionRepair.
 * Radni_kod B899001 = in-warranty, D899001 = out-of-warranty (oba poznata — bez log-a).
 * Bilo koji drugi kod → out-of-warranty + log.
 * Pokreni ovu funkciju iz editora. Za resume prekopiraj ispisani ID u startAfterId.
 *
 * NAPOMENA: filterValue mora biti TACNO kako stoji u staroj bazi (EQUAL filter je egzaktan).
 * Ako prvi run vrati 0 rezultata, proveri dijakritike u izvornom dokumentu.
 */
function migrateBoilerInterventionsRepair() {
  migrateBoilerInterventions_({
    filterValue: "POPRAVKA ELEKTRIČNOG BOJLERA",
    interventionType: "interventionRepair",
    warrantyByCode: { "B899001": "in-warranty", "D899001": "out-of-warranty" },
    startAfterId: "",
    limit: 500
  });
}

/**
 * Cita intervencije iz stare root kolekcije `intervencije` (server-side filter
 * Tip_intervencije == opts.filterValue), prepakuje polja u ciljni model i upisuje
 * u tenants/arst-srb/int-boilers. Document ID se cuva (idempotentan re-run).
 *
 * Mapiranje polja (samo ova se upisuju — ostala izvorna se ignorisu):
 *   sn                      ← Bar_code
 *   addedBy                 ← Servisni_centar
 *   addedDate               ← Datum (timestamp)
 *   distance                ← Kilometraza
 *   error                   ← Greska (preko ERROR_MAP; "BEZ GREŠKE" → error_no_error)
 *   exported                ← Zaveden (boolean)
 *   interventionDescription ← Opis_kvara (preko FAULT_MAP, boiler)
 *   interventionType        = opts.interventionType (hardkodovano — filter garantuje tip)
 *   note                    ← Komentar
 *   warrantyStatus          ← Radni_kod (preko opts.warrantyByCode; nepoznat kod → out-of-warranty + log)
 *   sparePart1..4           ← Sifra_rezervnog_dela_1..4 (samo NEPRAZNI se upisuju)
 *
 * Pravila:
 *   - Nepoznat Opis_kvara (nije u FAULT_MAP) → log + NE kopira se (obavezno polje).
 *   - Nepoznata Greska (nije u ERROR_MAP) → log + NE kopira se (kontrolisan vokabular).
 *   - Radni_kod van opts.warrantyByCode → log (i dalje se kopira sa out-of-warranty).
 *   - Prazan rezervni deo → polje sparePartN se uopste ne upisuje.
 *
 * @param {Object} opts
 *   filterValue       — vrednost Tip_intervencije za server-side filter (TACNO kako stoji u staroj bazi)
 *   interventionType  — ciljni interventionType za sve rezultate filtera
 *   warrantyByCode    — mapa Radni_kod → warrantyStatus (npr. { "B899001": "in-warranty", "D899001": "out-of-warranty" })
 *   startAfterId      — resume cursor (prazno za prvi run)
 *   limit             — broj dokumenata po run-u
 */
function migrateBoilerInterventions_(opts) {
  // ── HARDKODOVANE VREDNOSTI ─────────────────────────────────────────────
  var SOURCE_COLLECTION = "intervencije";
  var DEST_COLLECTION = "tenants/arst-srb/int-boilers";

  // Filter — server-side. Vrednost je TACNO kako stoji u staroj bazi.
  var FILTER_FIELD = "Tip_intervencije";
  var FILTER_VALUE = opts.filterValue;

  // Svi rezultati ovog filtera su isti tip intervencije.
  var INTERVENTION_TYPE = opts.interventionType;

  // Mapa Radni_kod → warrantyStatus. Nepoznat kod → out-of-warranty + log.
  var WARRANTY_BY_CODE = opts.warrantyByCode || {};

  // Resume — postavi na ID poslednjeg uspesno migriranog dokumenta iz prethodnog run-a.
  var START_AFTER_ID = opts.startAfterId || "";
  // Koliko dokumenata povuci u ovom run-u (runQuery max ~5MB po pozivu).
  var LIMIT = opts.limit || 500;

  // Opis_kvara (boiler) → interventionDescription i18n kljuc. Nepoznat opis → log + skip.
  var FAULT_MAP = boilerFaultMap_();

  // Greska → error i18n kljuc. Primarno bojler/gas mapa, fallback heat-pump mapa (greske iz druge
  // kategorije). Ako nema ni u jednoj → log + skip.
  var ERROR_MAP = boilerErrorMap_();
  var ERROR_MAP_FALLBACK = heatPumpErrorMap_();

  // ── EXECUTION ──────────────────────────────────────────────────────────
  var source = FirebaseService.old();    // stara baza
  var target = FirebaseService.prod();   // produkciona baza

  var query = {
    from: [{ collectionId: SOURCE_COLLECTION }],
    where: {
      fieldFilter: {
        field: { fieldPath: quoteFieldPath_(FILTER_FIELD) },
        op: "EQUAL",
        value: { stringValue: FILTER_VALUE }
      }
    },
    orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
    limit: LIMIT
  };

  if (START_AFTER_ID) {
    query.startAt = {
      values: [{ referenceValue: source.buildReferencePath(SOURCE_COLLECTION, START_AFTER_ID) }],
      before: false  // false = startAfter (ekskluzivno)
    };
  }

  var sliced = source.runQuery("", query);
  Logger.log(
    "Vraceno " + sliced.length + " intervencija sa filterom '" + FILTER_FIELD + " == " + FILTER_VALUE + "'" +
    (START_AFTER_ID ? " posle '" + START_AFTER_ID + "'" : " (od pocetka)") +
    " — limit " + LIMIT
  );
  if (sliced.length === 0) {
    Logger.log("Nema vise dokumenata za migraciju.");
    return;
  }

  var writes = [];
  var skipped = [];               // { id, reason } — nije kopirano
  var workingCodeAnomalies = [];  // { id, code }   — Radni_kod != B899003 (i dalje kopirano)
  var missingDate = [];           // [id, ...]      — Datum nije timestamp (polje izostavljeno)

  for (var i = 0; i < sliced.length; i++) {
    var doc = sliced[i];
    var data = source.decodeFields(doc.fields);

    // interventionDescription — nepoznat opis → skip
    var rawFault = data["Opis_kvara"];
    var interventionDescription = FAULT_MAP[rawFault];
    if (!interventionDescription) {
      skipped.push({ id: doc.id, reason: "nepoznat Opis_kvara: '" + rawFault + "'" });
      continue;
    }

    // error — UNIVERZALNO: kopira se ako Greska postoji (neprazna). Prazna → izostavljeno; nemapirana → log + skip.
    var rawError = normalizeStringField_(data["Greska"]);
    var error = null;
    if (rawError !== "") {
      error = ERROR_MAP[rawError] || ERROR_MAP_FALLBACK[rawError];
      if (!error) {
        skipped.push({ id: doc.id, reason: "nepoznata Greska: '" + rawError + "'" });
        continue;
      }
    }

    // warrantyStatus — iz Radni_kod preko mape. Nepoznat kod → out-of-warranty + log.
    var workingCode = data["Radni_kod"];
    var warrantyStatus = WARRANTY_BY_CODE[workingCode];
    if (warrantyStatus === undefined) {
      warrantyStatus = "out-of-warranty";
      workingCodeAnomalies.push({ id: doc.id, code: workingCode });
    }

    var out = {
      sn: normalizeStringField_(data["Bar_code"]),
      interventionType: INTERVENTION_TYPE,
      interventionDescription: interventionDescription,
      warrantyStatus: warrantyStatus,
      distance: normalizeStringField_(data["Kilometraza"]),
      note: normalizeStringField_(data["Komentar"]),
      addedBy: normalizeStringField_(data["Servisni_centar"]),
      exported: data["Zaveden"] === true
    };
    if (error !== null) out.error = error;

    // sparePart1..4 — UNIVERZALNO: upisi samo NEPRAZNE (prazan string se izostavlja iz dokumenta)
    var spareSources = [
      "Sifra_rezervnog_dela_1",
      "Sifra_rezervnog_dela_2",
      "Sifra_rezervnog_dela_3",
      "Sifra_rezervnog_dela_4"
    ];
    for (var sp = 0; sp < spareSources.length; sp++) {
      var spareVal = normalizeStringField_(data[spareSources[sp]]);
      if (spareVal !== "") {
        out["sparePart" + (sp + 1)] = spareVal;
      }
    }

    // addedDate — samo ako je validan timestamp (dekoder vraca Date instancu)
    var addedDate = toDateOrNull_(data["Datum"]);
    if (addedDate) {
      out.addedDate = addedDate;
    } else {
      missingDate.push(doc.id);
    }

    writes.push({
      collection: DEST_COLLECTION,
      documentId: doc.id,
      fields: target.encodeFields(out)
    });
  }

  Logger.log("Za upis: " + writes.length + ", preskoceno: " + skipped.length);

  // Flush kroz :batchWrite (do 500 upisa po HTTP call-u)
  var BATCH_SIZE = 500;
  var migrated = 0;
  var errors = 0;

  for (var b = 0; b < writes.length; b += BATCH_SIZE) {
    var batch = writes.slice(b, b + BATCH_SIZE);
    var results = target.batchWriteSets(batch);
    for (var r = 0; r < results.length; r++) {
      if (results[r].success) {
        migrated++;
      } else {
        errors++;
        Logger.log("GRESKA " + batch[r].collection + "/" + batch[r].documentId + ": " + results[r].error);
      }
    }
    Logger.log("Batch " + (Math.floor(b / BATCH_SIZE) + 1) + ": " + batch.length + " upisa (1 HTTP call)");
  }

  // ── REZIME ─────────────────────────────────────────────────────────────
  Logger.log("Zavrseno. Migrirano: " + migrated + ", Gresaka: " + errors + ", Preskoceno: " + skipped.length);

  if (skipped.length > 0) {
    Logger.log("");
    Logger.log("--- PRESKOCENO (nije kopirano) (" + skipped.length + ") ---");
    for (var s = 0; s < skipped.length; s++) {
      Logger.log("  • " + skipped[s].id + " → " + skipped[s].reason);
    }
  }
  if (workingCodeAnomalies.length > 0) {
    Logger.log("");
    Logger.log("--- Nepoznat Radni_kod (nije u " + JSON.stringify(Object.keys(WARRANTY_BY_CODE))
               + ", kopirano kao out-of-warranty) (" + workingCodeAnomalies.length + ") ---");
    for (var w = 0; w < workingCodeAnomalies.length; w++) {
      Logger.log("  • " + workingCodeAnomalies[w].id + " → Radni_kod='" + workingCodeAnomalies[w].code + "'");
    }
  }
  if (missingDate.length > 0) {
    Logger.log("");
    Logger.log("--- Datum nije validan timestamp (addedDate izostavljeno) (" + missingDate.length + ") ---");
    for (var m = 0; m < missingDate.length; m++) {
      Logger.log("  • " + missingDate[m]);
    }
  }

  // Resume cursor — postavi ovaj ID kao START_AFTER_ID za sledeci run.
  var lastId = sliced[sliced.length - 1].id;
  Logger.log("Sledeci START_AFTER_ID = \"" + lastId + "\"");
}

// ── Mapa za bojler/gas/klima intervencije (error kodovi) ─────────────────

/**
 * Greska (opis sa kodom) → error i18n kljuc za bojler/gas/klima (error_* + error_no_error).
 * ODVOJENA od heat-pump error mape. Koristi se kao primarna u bojler migracijama
 * i kao fallback u heat-pump migracijama (greske iz druge kategorije).
 */
function boilerErrorMap_() {
  return {
    "BEZ GREŠKE": "error_no_error",
    "101 - Pregrevanje": "error_101",
    "103 - Nedovoljna cirkulacija": "error_103",
    "104 - Nedovoljna cirkulacija": "error_104",
    "105 - Nedovoljna cirkulacija": "error_105",
    "106 - Nedovoljna cirkulacija": "error_106",
    "107 - Nedovoljna cirkulacija": "error_107",
    "108 - Potrebno dopunjavanje": "error_108",
    "110 - Otvoreni str. krug ili kratki spoj sonde na ulazu u m sistem": "error_110",
    "112 - Otvoreni strujni krug ili kratki spoj povratne sonde grejanja": "error_112",
    "114 - Otvoreni strujni krug ili kratki spoj spoljne sonde": "error_114",
    "116 - Termostat podnog grejanja otvoren": "error_116",
    "1P1 - Dojava nedostatne cirkulacije": "error_1p1",
    "1P2 - Dojava nedostatne cirkulacije": "error_1p2",
    "1P3 - Dojava nedostatne cirkulacije": "error_1p3",
    "1P4 - Nedovoljna količina vode u sistemu (zahtev punjenja)": "error_1p4",
    "203 - Prekid kruga senzora rezervoara GENUS ONE SYSTEM": "error_203",
    "205 - Senzor na ulazu PTV-a u prekidu za bojler sa spojenim solarnim sistemom": "error_205",
    "209 - Pregrejan rezervoar GENUS ONE SYSTEM": "error_209",
    "301 - Greška EEPROM display": "error_301",
    "302 - Greška komunikacije": "error_302",
    "303 - Greška na glavnoj kartici": "error_303",
    "305 - Greška na glavnoj kartici": "error_305",
    "306 - Greška na glavnoj kartici": "error_306",
    "307 - Greška na glavnoj kartici": "error_307",
    "313 - Greška niskog napona": "error_313",
    "3P9 - Redovno održavanje - zvati Servis": "error_3p9",
    "411 - Sobni senzor Z1 nije dostupan (ako je ugrađena)": "error_411",
    "412 - Sobni senzor Z2 nije dostupan (ako je ugrađena)": "error_412",
    "413 - Sonbi senzor Z3 nije dostupan (ako je ugrađena)": "error_413",
    "501 - Izostanak plamena (Nakon 5 puta sa P6)": "error_501",
    "502 - Dojava plamena dok je zatvoren gasni ventil": "error_502",
    "503 - Dojava plamena dok je zatvoren gasni ventil (Nakon 20 sekundi sa 502)": "error_503",
    "504 - Nema plamena": "error_504",
    "5P3 - Podizanje plamena": "error_5p3",
    "5P5 - Greška niskog pritiska gasa": "error_5p5",
    "5P6 - Prvo paljenje neuspešno": "error_5p6",
    "611 - Upozorenje na ventilatoru - anomalija na ulazu vazduha i/ili odvodu dimnih gasova": "error_611",
    "612 - Greška ventilatora (brzina veća ili manja od postavljenih vrednosti)": "error_612",
    "701 - Senzor polaska zone 1 neispravan": "error_701",
    "702 - Senzor polaska zone 2 neispravan": "error_702",
    "703 - Senzor polaska zone 3 neispravan": "error_703",
    "711 - Senzor povratka zone 1 neispravan": "error_711",
    "712 - Senzor povratka zone 2 neispravan": "error_712",
    "713 - Senzor povratka zone 3 neispravan": "error_713",
    "722 - Pregrevanje zone 2": "error_722",
    "723 - Pregrevanje zone 3": "error_723",
    "750 - Hidraulička šema nije definisana": "error_750",
    "801 - Greška prilikom kalibracije": "error_801",
    "802 - Detektovan plamen sa zatvorenim gasnim ventilom": "error_802",
    "803 - Pogrešna snaga kW (parametar 229)": "error_803",
    "804 - Potrebna spojnica za razdvajanje, potrebno je ugraditi spojnicu koja je dostavljena sa kodom 3319171.": "error_804"
  };
}

/**
 * Opis_kvara → interventionDescription i18n kljuc za bojler (fault_boiler_*).
 * Koristi se kao primarna u bojler migracijama i kao fallback u heat-pump/gas repair migracijama.
 */
function boilerFaultMap_() {
  return {
    "NE GREJE, SIJA SIJALICA": "fault_boiler_no_heat_light_on",
    "NE GREJE, NE SIJA SIJALICA": "fault_boiler_no_heat_light_off",
    "IZBACUJE SKLOPKA": "fault_boiler_trips_breaker",
    "ZVECKA U BOJLERU": "fault_boiler_rattling",
    "VODA IZ BOJLERA ŽUTA": "fault_boiler_yellow_water",
    "BUKA PRILIKOM ZAGREVANJA": "fault_boiler_noise_heating",
    "CURENJE GREJAČA": "fault_boiler_heater_leak",
    "CURENJE SIGURNOSNOG VENTILA": "fault_boiler_safety_valve_leak",
    "CURI VODA IZ BOJLERA": "fault_boiler_water_leak",
    "GREJAČ NEISPRAVAN": "fault_boiler_heater_faulty",
    "DISPLEJ NEISPRAVAN": "fault_boiler_display_faulty",
    "ELEKTRONSKA PLOČA NEISPRAVNA": "fault_boiler_board_faulty",
    "MIRIS PRILIKOM RADA": "fault_boiler_smell",
    "OLABAVLJEN DEO": "fault_boiler_loose_part",
    "POKLOPAC BOJLERA": "fault_boiler_cover",
    "PREGREVA SE VODA": "fault_boiler_overheating",
    "PROBLEM SA PRITISKOM": "fault_boiler_pressure_issue",
    "PROCUREO KAZAN": "fault_boiler_tank_leak",
    "TERMOSTAT NEISPRAVAN": "fault_boiler_thermostat_faulty",
    "UREĐAJ NE GREJE": "fault_boiler_not_heating",
    "VODA SE BRZO HLADI": "fault_boiler_fast_cooling",
    "ŽICE GREJAČA VEZANE POGREŠNO": "fault_boiler_wiring_wrong",
    "ZUJANJE-PIŠTANJE PRILKOM RADA": "fault_boiler_buzzing"
  };
}

// ── Mape za heat-pump intervencije (fault opisi + error kodovi) ──────────

/**
 * Opis_kvara → interventionDescription i18n kljuc za heat-pump (common fault opisi).
 * Koristi se za interventionRepair (POPRAVKA - TOPLOTNA PUMPA).
 */
function commonFaultMap_() {
  return {
    "BUKA PRILIKOM ZAGREVANJA": "fault_common_noise_heating",
    "CURENJE SIGURNOSNOG VENTILA": "fault_common_safety_valve_leak",
    "CURI VODA IZ KOTLA": "fault_common_water_leak",
    "NEISPRAVAN DISPLEJ": "fault_common_display_faulty",
    "GASNI VENTIL NEISPRAVAN": "fault_common_gas_valve_faulty",
    "GREŠKA ELEKTRONSKE PLOČE": "fault_common_board_error",
    "IZMENJIVAČ NE RADI ZAPUŠEN": "fault_common_exchanger_blocked",
    "PUMPA NEISPRAVNA": "fault_common_pump_faulty",
    "MANOMETAR NE PRIKAZUJE PRITISAK": "fault_common_manometer",
    "NEISPRAVNE ELEKTRODE": "fault_common_electrodes_faulty",
    "NEMA MODULACIJE": "fault_common_no_modulation",
    "OLABAVLJEN DEO": "fault_common_loose_part",
    "PREGREVA SE VODA": "fault_common_overheating",
    "VAZDUŠNI PRESOSTAT NEISPRAVAN": "fault_common_air_pressostat",
    "VODENI PRESOSTAT NEISPRAVAN": "fault_common_water_pressostat",
    "SLAVINA ZA DOPUNU NIJE ISPRAVNA": "fault_common_refill_valve",
    "NTC T NEISPRAVAN": "fault_common_ntc_faulty",
    "UREĐAJ NE PALI": "fault_common_no_ignition",
    "VENTILATOR NEISPRAVAN": "fault_common_fan_faulty",
    "NEISPRAVAN SERVO MOTOR": "fault_common_servo_motor",
    "NEISPARVAN TROKRAKI VENTIL": "fault_common_three_way_valve",
    "NEISPRAVAN REED RELEJ": "fault_common_reed_relay",
    "NEISPRAVAN MERAČ PROTOKA": "fault_common_flow_meter",
    "NEISPAVAN ULOŽAK TROKRAKOG": "fault_common_three_way_insert",
    "GODIŠNJI SERVIS": "fault_gas_boiler_annual_service"
  };
}

/**
 * Greska (opis sa kodom) → error i18n kljuc za heat-pump (error_hp_* + error_no_error).
 * ODVOJENA od bojler/gas error mape — heat-pump ima svoj skup gresaka.
 */
function heatPumpErrorMap_() {
  return {
    "BEZ GREŠKE": "error_no_error",
    "1 - Greška TD senzora": "error_hp_1",
    "905 - Greška kompresora": "error_hp_905",
    "906 - Greška ventlatora": "error_hp_906",
    "907 - Greška četvorokrakog ventila": "error_hp_907",
    "908 - Greška ekspanzijskog ventila": "error_hp_908",
    "909 - Nulta brzina ventilatora TP": "error_hp_909",
    "910 - Greška u komunikaciji invertora - TDM": "error_hp_910",
    "911 - Greška senzora temperature na isparivaču (TE - par.17.10.3)": "error_hp_911",
    "912 - Greška četvorokrakog ventila": "error_hp_912",
    "913 - Greška senzora polazne temperature vode (LWT -par.17.10.1)": "error_hp_913",
    "914 - Greška senzora izlazne temperature kondenzatora (TR - par.17.10.6)": "error_hp_914",
    "915 - Greška komunikacije TDM ploče": "error_hp_915",
    "916 - Greška senzora izlazne temperature na isparivaču (TEO - par.17.10.0)": "error_hp_916",
    "917 - Greška smrzavanja DT Freeze": "error_hp_917",
    "918 - Greška pumpe": "error_hp_918",
    "919 - Previsoka temperatura na izlazu iz kompresora (TD -par.17.10.5)": "error_hp_919",
    "922 - Greška smrzavanja DT Freeze": "error_hp_922",
    "931 - Greška inverter ploče": "error_hp_931",
    "947 - Greška četvorokrakog ventila": "error_hp_947",
    "948 - Greška senzora temperature na izlazu iz kompresora (TD -par.17.10.5)": "error_hp_948",
    "949 - Greška senzora temperature na ulazu u kompresor (TS -par.17.10.4)": "error_hp_949",
    "950 - Previsoka temperatura na izlazu iz kompresora (TD -par.17.10.5)": "error_hp_950",
    "951 - Previsoka temperatura na izlazu iz kompresora (TD -par.17.10.5)": "error_hp_951",
    "952 - Greška senzora spoljašnje temperature zraka (TO -par.17.10.0)": "error_hp_952",
    "953 - Greška kompresora": "error_hp_953",
    "954 - Greška baznog grejača": "error_hp_954",
    "956 - Neadekvatan model kompresora": "error_hp_956",
    "957 - Neadenkatan model ventilatora": "error_hp_957",
    "960 - HP EWT Greška - Greška senzora povratne temperature vode (EWT)": "error_hp_960",
    "962 - Greška odmrzavanja": "error_hp_962",
    "968 - Greška u komunikaciji ATGBUS TDM - EM": "error_hp_968",
    "989 - Greška mašina prazna": "error_hp_989",
    "997 - Prekomerna struja kompresora": "error_hp_997",
    "998 - Prekomerna struja kompresora": "error_hp_998",
    "9E5 - Intervencija presostata visokog pritiska": "error_hp_9e5",
    "9E8 - Greška presostata niskog pritiska s kompresorom OFF": "error_hp_9e8",
    "9E9 - Greška klixon s kompresorom OFF": "error_hp_9e9",
    "9E18 - Greška sigurnosnog termostata ST1": "error_hp_9e18",
    "9E21 - Greška mala količina rashladnog sredstva": "error_hp_9e21",
    "9E22 - Greška mašina prazna": "error_hp_9e22",
    "9E24 - Greška EXV blokiran": "error_hp_9e24",
    "9E25 - Greška EXV blokiran": "error_hp_9e25",
    "9E28 - Zaštita visokog pritiska": "error_hp_9e28",
    "9E29 - Zaštita visokog pritiska": "error_hp_9e29",
    "9E31 - Zaštita termostata kompresora": "error_hp_9e31",
    "9E32 - Zaštita termostata kompresora": "error_hp_9e32",
    "9E34 - Zaštita od niskog pritiska": "error_hp_9e34",
    "9E35 - Zaštita od niskog pritiska": "error_hp_9e35",
    "9E36 - Debalans struje faza kompresora": "error_hp_9e36",
    "9E37 - Debalans struje faza kompresora": "error_hp_9e37",
    "9E38 - Promena struje kompresora suviše velika": "error_hp_9e38",
    "9E39 - Promena struje kompresora suviše velika": "error_hp_9e39",
    "114 - Spoljašnja temperatura nedostupna": "error_hp_114",
    "730 - Greška kod bafera visoke sonde": "error_hp_730",
    "731 - Previsoka temperatura bafera": "error_hp_731",
    "732 - Greška kod bafera niske sonde": "error_hp_732",
    "902 - Senzor protoka sistema oštećen": "error_hp_902",
    "923 - Greška pritiska grejanja": "error_hp_923",
    "924 - Greška komunikacije TP": "error_hp_924",
    "927 - Greška u poklapanju pomoćnih ulaza": "error_hp_927",
    "928 - Greška u konfiguraciji bloka isporuke energije": "error_hp_928",
    "933 - Prevelika temperatura sonde polaznog voda": "error_hp_933",
    "934 - Oštećen senzor spremnika PTV": "error_hp_934",
    "935 - Prekoračenje temp. spremnika": "error_hp_935",
    "936 - Podni termostat 1-greška": "error_hp_936",
    "937 - Greška nestanka cirkulacije": "error_hp_937",
    "938 - Greška anode": "error_hp_938",
    "940 - Hidraulična shema nedefinisana": "error_hp_940",
    "955 - Protok vode Provera Greške": "error_hp_955",
    "970 - EM Split/Mono nedef. parametar": "error_hp_970",
    "2P2 - Antilegionela nekompletna": "error_hp_2p2",
    "2P3 - Zadana vrednost nije dostignuta": "error_hp_2p3",
    "2P4 - Drugi termostat grejača (ručno)": "error_hp_2p4",
    "2P5 - Prvi termostat grejača (auto)": "error_hp_2p5",
    "2P7 - Greška predcirkulacije": "error_hp_2p7",
    "2P8 - Upozorenje o niskom pritisku": "error_hp_2p8",
    "2P9 - SG spremna. Greška konfiguracije": "error_hp_2p9"
  };
}

// ── envInfo config (polja po uredjaju + deljena value mapa) ──────────────

/**
 * Heat-pump envInfo polja: { key (model key), source (staro polje), select }.
 * indoorWire/outdoorWire izvori su namerno ukrsteni jer tako stoji u staroj bazi.
 */
function heatPumpEnvFields_() {
  return [
    // Electrical
    { key: "outdoorFuse", source: "Osigurac_spoljasnje_jed", select: true },
    { key: "indoorFuse", source: "Osigurac_unutrasnje_jed", select: true },
    { key: "indoorWire", source: "Napajanje_spoljasnje_jed", select: true },
    { key: "outdoorWire", source: "Napajanje_unutrasnje_jed", select: true },
    { key: "modbusCable", source: "Modbus_kabal", select: true },
    { key: "modbusSeparated", source: "Modbus_odvojen", select: true },
    { key: "indoorFID", source: "FID_unutrasnje_jed", select: true },
    { key: "outdoorFID", source: "FID_spoljasnje_jed", select: true },
    // Hydraulic
    { key: "cooling", source: "Hladjenje", select: true },
    { key: "sanitaryBoiler", source: "Sanitarni_bojler", select: true },
    { key: "buffer", source: "Bafer", select: true },
    { key: "zoneNumber", source: "Broj_zona", select: true },
    { key: "hydraulicSwitch", source: "Hidraulicna_skretnica", select: true },
    { key: "magneticFilter", source: "Magnetni_filter", select: true },
    { key: "additionalExpansionTank", source: "Expanziona_posuda", select: true },
    { key: "additionalExpansionTankPTV", source: "Expanziona_posuda_PTV", select: true },
    // Freon
    { key: "freonSysTested", source: "Ispitivanje_pritiska", select: true },
    { key: "sysVacuumed", source: "Sistem_je_vakumiran", select: true },
    { key: "pipeLength", source: "Duzina_instalacije", select: false },
    { key: "additionalFreon", source: "Dodatno_punjenje_freona", select: false },
    // System Operation
    { key: "sysWaterPressure", source: "Pritisak_vode_u_sistemu", select: false },
    { key: "outdoorTemp", source: "Spoljasnja_temperatura", select: false },
    { key: "waterTempOnStart", source: "Polazna_t_vode", select: false },
    { key: "returnWaterTemp", source: "Povratna_t_vode", select: false },
    { key: "evaporatorTemp", source: "Temperatura_isparivaca", select: false },
    { key: "compressorTemp", source: "Temperatura_kompresora", select: false },
    { key: "evaporatorPressure", source: "Pritisak_isparivaca", select: false },
    { key: "condensationPressure", source: "Pritisak_kondenzatora", select: false },
    { key: "waterFlow", source: "Protok_vode", select: false }
  ];
}

/**
 * Gas-boiler envInfo polja: { key (model key), source (staro polje), select }.
 * Number polja se cuvaju kao string (bez mapiranja); select se mapiraju preko envValueToKey_.
 */
function gasBoilerEnvFields_() {
  return [
    { key: "gasType", source: "Vrsta_gasa", select: true },
    { key: "voltage", source: "Napon", select: false },
    { key: "inputGasPressure", source: "Pritisak_gasa", select: false },
    { key: "minGasPressure", source: "Min_pritisak_gasa", select: false },
    { key: "maxGasPressure", source: "Max_pritisak_gasa", select: false },
    { key: "minGasBoilerPower", source: "Min_snaga_kotla", select: false },
    { key: "maxGasBoilerPower", source: "Max_snaga_kotla", select: false },
    { key: "expansionPressure", source: "Pritisak_ekspanzije", select: false },
    { key: "sysPressure", source: "Pritisak_sistema", select: false },
    { key: "testedOnGasLeakage", source: "Testiranje_na_curenje", select: true },
    { key: "gasHoseReplaced", source: "Gasno_crevo_zamenjeno", select: true },
    { key: "accordingManufacturerInstalled", source: "Pusten_po_upustvu", select: true },
    { key: "readyForUse", source: "Tehnicki_ispravan", select: true }
  ];
}

/**
 * Srpska vrednost → i18n kljuc za envInfo select polja. Deljena mapa za sve uredjaje
 * (HP + gas). Sve vrednosti su globalno jedinstvene.
 */
function envValueToKey_() {
  return {
    // Fuse
    "C-2 (4A max)": "env_info_opt_c2_4a",
    "C-10 A": "env_info_opt_c10a",
    "C-13 A": "env_info_opt_c13a",
    "C-16 A": "env_info_opt_c16a",
    "C-20 A": "env_info_opt_c20a",
    "C-25 A": "env_info_opt_c25a",
    "C-32 A": "env_info_opt_c32a",
    "Nema posebne osigurače": "env_info_opt_no_fuse",
    // Wire
    "3x0,75 mm2": "env_info_opt_3x0_75",
    "3x1,5 mm2": "env_info_opt_3x1_5",
    "3x2,5 mm2": "env_info_opt_3x2_5",
    "3x4 mm2": "env_info_opt_3x4",
    "3x6 mm2": "env_info_opt_3x6",
    "5x2,5 mm2": "env_info_opt_5x2_5",
    "5x4 mm2": "env_info_opt_5x4",
    "5x6 mm2": "env_info_opt_5x6",
    "Ništa od navedenog": "env_info_opt_none_listed",
    // MODBUS
    "Oklopljeni kabal 2 x 0,75": "env_info_opt_shielded_2x075",
    "Oklopljeni kabal 2 x 1,5": "env_info_opt_shielded_2x15",
    "Oklopljeni kabal 3 x 0,75": "env_info_opt_shielded_3x075",
    "Oklopljeni kabal 3 x 1,5": "env_info_opt_shielded_3x15",
    "Neoklopljeni kabal 2 x 0,75": "env_info_opt_unshielded_2x075",
    "Neoklopljeni kabal 2 x 1,5": "env_info_opt_unshielded_2x15",
    "Neoklopljeni kabal 3 x 0,75": "env_info_opt_unshielded_3x075",
    "Neoklopljeni kabal 3 x 1,5": "env_info_opt_unshielded_3x15",
    // FID
    "A-30": "env_info_opt_a30",
    "B-30": "env_info_opt_b30",
    "F-30": "env_info_opt_f30",
    "Nema FID sklopku": "env_info_opt_no_fid",
    // Yes/No
    "DA": "env_info_opt_yes",
    "NE": "env_info_opt_no",
    // Zones
    "1": "env_info_opt_zone_1",
    "2": "env_info_opt_zone_2",
    "3": "env_info_opt_zone_3",
    "4": "env_info_opt_zone_4",
    "5": "env_info_opt_zone_5",
    "6": "env_info_opt_zone_6",
    // Gas type (gas boiler)
    "ZEMNI": "env_info_opt_gas_natural",
    "TNG": "env_info_opt_gas_lpg"
  };
}

// ── Migracija: heat-pump servisi (commissioning / godisnji servis / popravka) ──

/**
 * Migracija "TOPLOTNA PUMPA - GODIŠNJI SERVIS" → annual_service (Radni_kod M853001 = in-warranty).
 * Pokreni iz editora. Za resume prekopiraj ispisani ID u startAfterId.
 */
function migrateHeatPumpAnnualService() {
  migrateHeatingServiceIntervention_({
    filterValue: "TOPLOTNA PUMPA - GODIŠNJI SERVIS",
    interventionType: "annual_service",
    interventionDescription: "intervention_description_annual_service",
    warrantyByCode: { "M853001": "in-warranty" },
    startAfterId: "",
    limit: 500
  });
}

/**
 * Migracija "PUŠTANJE U RAD TOPLOTNA PUMPA" → commissioning (Radni_kod A853001 = in-warranty).
 * Pokreni iz editora. Za resume prekopiraj ispisani ID u startAfterId.
 */
function migrateHeatPumpCommissioning() {
  migrateHeatingServiceIntervention_({
    filterValue: "PUŠTANJE U RAD TOPLOTNA PUMPA",
    interventionType: "commissioning",
    interventionDescription: "intervention_description_commissioning",
    warrantyByCode: { "A853001": "in-warranty" },
    startAfterId: "",
    limit: 500
  });
}

/**
 * Migracija "POPRAVKA - TOPLOTNA PUMPA" → interventionRepair.
 * Radni_kod B853005 = in-warranty, D853005 = out-of-warranty (oba poznata — bez log-a).
 * interventionDescription se MAPIRA iz Opis_kvara (common fault mapa; nemapirano → log + skip).
 * error se mapira iz Greska (heat-pump error mapa; nemapirano → log + skip), dodaje 'error' polje.
 * Ukljucuje sparePart1..4 (neprazni) i envInfo (isto kao ostale HP funkcije).
 * Pokreni iz editora. Za resume prekopiraj ispisani ID u startAfterId.
 */
function migrateHeatPumpRepair() {
  migrateHeatingServiceIntervention_({
    filterValue: "POPRAVKA - TOPLOTNA PUMPA",
    interventionType: "interventionRepair",
    faultMap: commonFaultMap_(),
    faultMapFallback: boilerFaultMap_(),
    warrantyByCode: { "B853005": "in-warranty", "D853005": "out-of-warranty" },
    startAfterId: "",
    limit: 500
  });
}

/**
 * Migracija "GASNI KOTAO ODRŽAVANJE U VANGARANCIJI" → annual_service (gas kotao, kolekcija int-heating).
 * Radni_kod V799002 = out-of-warranty (uvek vangarancija). Bilo koji drugi kod → out-of-warranty + log.
 * interventionDescription = intervention_description_annual_service (fiksno).
 * envInfo = gasna polja (gasBoilerEnvFields_); error primarno bojler/gas mapa, fallback heat-pump.
 * Pokreni iz editora. Za resume prekopiraj ispisani ID u startAfterId.
 *
 * NAPOMENA: filterValue mora biti TACNO kako stoji u staroj bazi (EQUAL filter je egzaktan).
 * Ako prvi run vrati 0 rezultata, proveri dijakritike (npr. "ODRZAVANJE"/"VANGARANCIJI").
 */
function migrateGasBoilerAnnualOutOfWarranty() {
  migrateHeatingServiceIntervention_({
    filterValue: "GASNI KOTAO ODRŽAVANJE U VANGARANCIJI",
    interventionType: "annual_service",
    interventionDescription: "intervention_description_annual_service",
    warrantyByCode: { "V799002": "out-of-warranty" },
    envFields: gasBoilerEnvFields_(),
    errorMap: boilerErrorMap_(),
    errorMapFallback: heatPumpErrorMap_(),
    startAfterId: "",
    limit: 500
  });
}

/**
 * Migracija "PUŠTANJE U RAD GASNI KOTAO" → commissioning (gas kotao, kolekcija int-heating).
 * Radni_kod A799001 = in-warranty. Bilo koji drugi kod → out-of-warranty + log.
 * interventionDescription = intervention_description_commissioning (fiksno).
 * envInfo = gasna polja (gasBoilerEnvFields_); error primarno bojler/gas mapa, fallback heat-pump.
 * installerName/installerPhoneNumber se kopiraju (jer je commissioning), ako postoje.
 * Pokreni iz editora. Za resume prekopiraj ispisani ID u startAfterId.
 *
 * NAPOMENA: filterValue mora biti TACNO kako stoji u staroj bazi (EQUAL filter je egzaktan).
 * Ako prvi run vrati 0 rezultata, proveri dijakritike (npr. "PUSTANJE").
 */
function migrateGasBoilerCommissioning() {
  migrateHeatingServiceIntervention_({
    filterValue: "PUŠTANJE U RAD GASNI KOTAO",
    interventionType: "commissioning",
    interventionDescription: "intervention_description_commissioning",
    warrantyByCode: { "A799001": "in-warranty" },
    envFields: gasBoilerEnvFields_(),
    errorMap: boilerErrorMap_(),
    errorMapFallback: heatPumpErrorMap_(),
    startAfterId: "",
    limit: 500
  });
}

/**
 * Migracija "POPRAVKA - GASNI KOTAO" → interventionRepair (gas kotao, kolekcija int-heating).
 * Radni_kod B799001 = in-warranty, D799001 = out-of-warranty (oba poznata — bez log-a).
 * Bilo koji drugi kod → out-of-warranty + log.
 * interventionDescription se MAPIRA iz Opis_kvara (common fault mapa; nemapirano → log + skip).
 * envInfo = gasna polja (gasBoilerEnvFields_; izostavljen ako repair nema env podataka).
 * error primarno bojler/gas mapa, fallback heat-pump.
 * Pokreni iz editora. Za resume prekopiraj ispisani ID u startAfterId.
 *
 * NAPOMENA: filterValue mora biti TACNO kako stoji u staroj bazi (EQUAL filter je egzaktan).
 * Ako prvi run vrati 0 rezultata, proveri dijakritike u izvornom dokumentu.
 */
function migrateGasBoilerRepair() {
  migrateHeatingServiceIntervention_({
    filterValue: "POPRAVKA - GASNI KOTAO",
    interventionType: "interventionRepair",
    faultMap: commonFaultMap_(),
    faultMapFallback: boilerFaultMap_(),
    warrantyByCode: { "B799001": "in-warranty", "D799001": "out-of-warranty" },
    envFields: gasBoilerEnvFields_(),
    errorMap: boilerErrorMap_(),
    errorMapFallback: heatPumpErrorMap_(),
    startAfterId: "",
    limit: 500
  });
}

/**
 * Migracija "GASNI KOTAO REDOVNO ODRŽAVANJE" → annual_service (gas kotao, kolekcija int-heating).
 * Radni_kod M799001 = in-warranty. Bilo koji drugi kod → out-of-warranty + log.
 * interventionDescription = intervention_description_annual_service (fiksno).
 * envInfo = gasna polja (gasBoilerEnvFields_); error primarno bojler/gas mapa, fallback heat-pump.
 * Pokreni iz editora. Za resume prekopiraj ispisani ID u startAfterId.
 *
 * NAPOMENA: filterValue mora biti TACNO kako stoji u staroj bazi (EQUAL filter je egzaktan).
 * Ako prvi run vrati 0 rezultata, proveri dijakritike (npr. "ODRZAVANJE").
 */
function migrateGasBoilerAnnualInWarranty() {
  migrateHeatingServiceIntervention_({
    filterValue: "GASNI KOTAO REDOVNO ODRŽAVANJE",
    interventionType: "annual_service",
    interventionDescription: "intervention_description_annual_service",
    warrantyByCode: { "M799001": "in-warranty" },
    envFields: gasBoilerEnvFields_(),
    errorMap: boilerErrorMap_(),
    errorMapFallback: heatPumpErrorMap_(),
    startAfterId: "",
    limit: 500
  });
}

/**
 * Cita grejne servise (heat-pump i gas kotao) iz stare kolekcije `intervencije` (server-side filter
 * Tip_intervencije == opts.filterValue), prepakuje u commissioning/annual_service oblik
 * (sa envInfo nested map-om) i upisuje u tenants/arst-srb/int-heating.
 * Document ID se cuva (idempotentan re-run).
 *
 * Bazna polja:
 *   sn                      ← Bar_code
 *   addedBy                 ← Servisni_centar
 *   addedDate               ← Datum (timestamp)
 *   distance                ← Kilometraza
 *   note                    ← Komentar
 *   exported                ← Zaveden (boolean)
 *   interventionType        = opts.interventionType
 *   interventionDescription = opts.interventionDescription (fiksno) ili mapirano iz Opis_kvara (opts.faultMap, repair)
 *   warrantyStatus          ← Radni_kod (preko opts.warrantyByCode; nepoznat kod → out-of-warranty + log)
 *   error                   ← Greska (UNIVERZALNO; opts.errorMap pa opts.errorMapFallback; prazno → izostavljeno, nemapirano → log + skip)
 *   sparePart1..4           ← Sifra_rezervnog_dela_1..4 (UNIVERZALNO; samo neprazni)
 *   installerName/Phone     ← Ime_instalatera / Telefon_instalatera (SAMO commissioning; neprazni)
 *
 * envInfo (nested map):
 *   - select polja: izvorna srpska vrednost → i18n kljuc preko ENV_VALUE_TO_KEY
 *   - number/free-text polja: cuvaju se kao string (bez mapiranja)
 *   - Pravilo (sva-ili-nijedno): ako su SVA izvorna env polja prazna → envInfo se NE upisuje
 *     (dokument se svejedno migrira). Ako je bar jedno popunjeno → upisuju se SVA polja,
 *     a prazna/nedostajuca kao "".
 *   - Nemapirana select vrednost → log + upisuje se kao "".
 *
 * NAPOMENA: filterValue mora biti TACNO kako stoji u staroj bazi (EQUAL filter je egzaktan).
 * Ako prvi run vrati 0 rezultata, proveri dijakritike (npr. "GODISNJI" / "PUSTANJE").
 *
 * @param {Object} opts
 *   filterValue             — vrednost Tip_intervencije za server-side filter (TACNO kako stoji u staroj bazi)
 *   interventionType        — ciljni interventionType za sve rezultate filtera
 *   interventionDescription — fiksni interventionDescription i18n kljuc (ako nema faultMap)
 *   faultMap                — (opc.) Opis_kvara → interventionDescription; nemapirano → log + skip
 *   warrantyByCode          — mapa Radni_kod → warrantyStatus (npr. { "M853001": "in-warranty" })
 *   envFields               — (opc.) env config po uredjaju (default heatPumpEnvFields_())
 *   errorMap                — (opc.) primarna error mapa (default heatPumpErrorMap_())
 *   errorMapFallback        — (opc.) fallback error mapa (default boilerErrorMap_())
 *   startAfterId            — resume cursor (prazno za prvi run)
 *   limit                   — broj dokumenata po run-u
 */
function migrateHeatingServiceIntervention_(opts) {
  // ── HARDKODOVANE VREDNOSTI ─────────────────────────────────────────────
  var SOURCE_COLLECTION = "intervencije";
  var DEST_COLLECTION = "tenants/arst-srb/int-heating";

  var FILTER_FIELD = "Tip_intervencije";
  var FILTER_VALUE = opts.filterValue;

  var INTERVENTION_TYPE = opts.interventionType;
  var INTERVENTION_DESCRIPTION = opts.interventionDescription;

  // Radni_kod → warrantyStatus. Nepoznat kod → out-of-warranty + log.
  var WARRANTY_BY_CODE = opts.warrantyByCode || {};

  // Resume — postavi na ID poslednjeg uspesno migriranog dokumenta iz prethodnog run-a.
  var START_AFTER_ID = opts.startAfterId || "";
  // Koliko dokumenata povuci u ovom run-u.
  var LIMIT = opts.limit || 500;

  // FAULT_MAP (opciono, za repair): Opis_kvara → interventionDescription. Primarno opts.faultMap,
  // fallback opts.faultMapFallback (npr. bojler opisi). Nema ni u jednoj → log + skip.
  // Commissioning/annual koriste fiksni opts.interventionDescription.
  var FAULT_MAP = opts.faultMap || null;
  var FAULT_MAP_FALLBACK = opts.faultMapFallback || null;
  // error je UNIVERZALAN. Primarna/fallback mapa po uredjaju (default: heat-pump primarno,
  // bojler/gas fallback). Gas boiler prosledjuje obrnuto. Ako nema ni u jednoj → log + skip.
  var ERROR_MAP = opts.errorMap || heatPumpErrorMap_();
  var ERROR_MAP_FALLBACK = opts.errorMapFallback || boilerErrorMap_();

  // envInfo polja — config po uredjaju (default heat-pump). Gas boiler prosledjuje opts.envFields.
  var ENV_FIELDS = opts.envFields || heatPumpEnvFields_();

  // Srpska vrednost → i18n kljuc (deljena mapa za sve uredjaje; samo za select polja).
  var ENV_VALUE_TO_KEY = envValueToKey_();

  // ── EXECUTION ──────────────────────────────────────────────────────────
  var source = FirebaseService.old();
  var target = FirebaseService.prod();

  var query = {
    from: [{ collectionId: SOURCE_COLLECTION }],
    where: {
      fieldFilter: {
        field: { fieldPath: quoteFieldPath_(FILTER_FIELD) },
        op: "EQUAL",
        value: { stringValue: FILTER_VALUE }
      }
    },
    orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
    limit: LIMIT
  };

  if (START_AFTER_ID) {
    query.startAt = {
      values: [{ referenceValue: source.buildReferencePath(SOURCE_COLLECTION, START_AFTER_ID) }],
      before: false
    };
  }

  var sliced = source.runQuery("", query);
  Logger.log(
    "Vraceno " + sliced.length + " intervencija sa filterom '" + FILTER_FIELD + " == " + FILTER_VALUE + "'" +
    (START_AFTER_ID ? " posle '" + START_AFTER_ID + "'" : " (od pocetka)") +
    " — limit " + LIMIT
  );
  if (sliced.length === 0) {
    Logger.log("Nema vise dokumenata za migraciju.");
    return;
  }

  var writes = [];
  var skipped = [];               // { id, reason }     — nemapiran Opis_kvara ili Greska (nije kopirano)
  var workingCodeAnomalies = [];  // { id, code }       — Radni_kod nepoznat (out-of-warranty + log)
  var missingDate = [];           // [id, ...]          — Datum nije timestamp
  var envUnmapped = [];           // { id, key, value } — select vrednost bez mapiranja
  var noEnvInfo = [];             // [id, ...]          — sva env polja prazna, envInfo izostavljen

  for (var i = 0; i < sliced.length; i++) {
    var doc = sliced[i];
    var data = source.decodeFields(doc.fields);

    // interventionDescription — fiksno (commissioning/annual) ili mapirano iz Opis_kvara (repair)
    var interventionDescription;
    if (FAULT_MAP) {
      var rawFault = data["Opis_kvara"];
      interventionDescription = FAULT_MAP[rawFault]
        || (FAULT_MAP_FALLBACK ? FAULT_MAP_FALLBACK[rawFault] : undefined);
      if (!interventionDescription) {
        skipped.push({ id: doc.id, reason: "nepoznat Opis_kvara: '" + rawFault + "'" });
        continue;
      }
    } else {
      interventionDescription = INTERVENTION_DESCRIPTION;
    }

    // error — UNIVERZALNO: kopira se ako Greska postoji (neprazna). Prazna → izostavljeno; nemapirana → log + skip.
    var rawError = normalizeStringField_(data["Greska"]);
    var error = null;
    if (rawError !== "") {
      error = ERROR_MAP[rawError] || ERROR_MAP_FALLBACK[rawError];
      if (!error) {
        skipped.push({ id: doc.id, reason: "nepoznata Greska: '" + rawError + "'" });
        continue;
      }
    }

    // warrantyStatus — iz Radni_kod preko mape
    var workingCode = data["Radni_kod"];
    var warrantyStatus = WARRANTY_BY_CODE[workingCode];
    if (warrantyStatus === undefined) {
      warrantyStatus = "out-of-warranty";
      workingCodeAnomalies.push({ id: doc.id, code: workingCode });
    }

    var out = {
      sn: normalizeStringField_(data["Bar_code"]),
      interventionType: INTERVENTION_TYPE,
      interventionDescription: interventionDescription,
      warrantyStatus: warrantyStatus,
      distance: normalizeStringField_(data["Kilometraza"]),
      note: normalizeStringField_(data["Komentar"]),
      addedBy: normalizeStringField_(data["Servisni_centar"]),
      exported: data["Zaveden"] === true
    };
    if (error !== null) out.error = error;

    // sparePart1..4 — UNIVERZALNO: upisi samo NEPRAZNE (prazan string se izostavlja)
    var spareSources = [
      "Sifra_rezervnog_dela_1",
      "Sifra_rezervnog_dela_2",
      "Sifra_rezervnog_dela_3",
      "Sifra_rezervnog_dela_4"
    ];
    for (var sp = 0; sp < spareSources.length; sp++) {
      var spareVal = normalizeStringField_(data[spareSources[sp]]);
      if (spareVal !== "") out["sparePart" + (sp + 1)] = spareVal;
    }

    // installerName / installerPhoneNumber — SAMO za commissioning; nepostojece/prazno se ne kopira
    if (INTERVENTION_TYPE === "commissioning") {
      var installerName = normalizeStringField_(data["Ime_instalatera"]);
      if (installerName !== "") out.installerName = installerName;
      var installerPhone = normalizeStringField_(data["Telefon_instalatera"]);
      if (installerPhone !== "") out.installerPhoneNumber = installerPhone;
    }

    // envInfo — sva-ili-nijedno
    var envOut = {};
    var anyFilled = false;
    for (var f = 0; f < ENV_FIELDS.length; f++) {
      var fld = ENV_FIELDS[f];
      var raw = normalizeStringField_(data[fld.source]);
      if (raw !== "") anyFilled = true;

      if (fld.select) {
        if (raw === "") {
          envOut[fld.key] = "";
        } else {
          var mapped = ENV_VALUE_TO_KEY[raw];
          if (mapped === undefined) {
            envUnmapped.push({ id: doc.id, key: fld.key, value: raw });
            envOut[fld.key] = "";
          } else {
            envOut[fld.key] = mapped;
          }
        }
      } else {
        // number / free-text — cuva se kao string bez mapiranja
        envOut[fld.key] = raw;
      }
    }
    if (anyFilled) {
      out.envInfo = envOut;
    } else {
      noEnvInfo.push(doc.id);
    }

    // addedDate — samo ako je validan timestamp
    var addedDate = toDateOrNull_(data["Datum"]);
    if (addedDate) {
      out.addedDate = addedDate;
    } else {
      missingDate.push(doc.id);
    }

    writes.push({
      collection: DEST_COLLECTION,
      documentId: doc.id,
      fields: target.encodeFields(out)
    });
  }

  Logger.log("Za upis: " + writes.length + ", preskoceno: " + skipped.length);

  // Flush kroz :batchWrite (do 500 upisa po HTTP call-u)
  var BATCH_SIZE = 500;
  var migrated = 0;
  var errors = 0;

  for (var b = 0; b < writes.length; b += BATCH_SIZE) {
    var batch = writes.slice(b, b + BATCH_SIZE);
    var results = target.batchWriteSets(batch);
    for (var r = 0; r < results.length; r++) {
      if (results[r].success) {
        migrated++;
      } else {
        errors++;
        Logger.log("GRESKA " + batch[r].collection + "/" + batch[r].documentId + ": " + results[r].error);
      }
    }
    Logger.log("Batch " + (Math.floor(b / BATCH_SIZE) + 1) + ": " + batch.length + " upisa (1 HTTP call)");
  }

  // ── REZIME ─────────────────────────────────────────────────────────────
  Logger.log("Zavrseno. Migrirano: " + migrated + ", Gresaka: " + errors + ", Preskoceno: " + skipped.length);

  if (skipped.length > 0) {
    Logger.log("");
    Logger.log("--- PRESKOCENO (nije kopirano) (" + skipped.length + ") ---");
    for (var s = 0; s < skipped.length; s++) {
      Logger.log("  • " + skipped[s].id + " → " + skipped[s].reason);
    }
  }
  if (workingCodeAnomalies.length > 0) {
    Logger.log("");
    Logger.log("--- Nepoznat Radni_kod (nije u " + JSON.stringify(Object.keys(WARRANTY_BY_CODE))
               + ", kopirano kao out-of-warranty) (" + workingCodeAnomalies.length + ") ---");
    for (var w = 0; w < workingCodeAnomalies.length; w++) {
      Logger.log("  • " + workingCodeAnomalies[w].id + " → Radni_kod='" + workingCodeAnomalies[w].code + "'");
    }
  }
  if (envUnmapped.length > 0) {
    Logger.log("");
    Logger.log("--- Nemapirana envInfo select vrednost (upisano kao \"\") (" + envUnmapped.length + ") ---");
    for (var u = 0; u < envUnmapped.length; u++) {
      Logger.log("  • " + envUnmapped[u].id + " → " + envUnmapped[u].key + " = '" + envUnmapped[u].value + "'");
    }
  }
  if (noEnvInfo.length > 0) {
    Logger.log("");
    Logger.log("--- Bez ijednog env polja (envInfo izostavljen, dokument migriran) (" + noEnvInfo.length + ") ---");
    for (var n = 0; n < noEnvInfo.length; n++) {
      Logger.log("  • " + noEnvInfo[n]);
    }
  }
  if (missingDate.length > 0) {
    Logger.log("");
    Logger.log("--- Datum nije validan timestamp (addedDate izostavljeno) (" + missingDate.length + ") ---");
    for (var m = 0; m < missingDate.length; m++) {
      Logger.log("  • " + missingDate[m]);
    }
  }

  // Resume cursor — postavi ovaj ID kao START_AFTER_ID za sledeci run.
  var lastId = sliced[sliced.length - 1].id;
  Logger.log("Sledeci START_AFTER_ID = \"" + lastId + "\"");
}

// ── Migracija: listPrice (flat copy, bez transformacije i podkolekcija) ──

/**
 * Cita dokumente iz listPrice kolekcije stare baze i upisuje ih u produkcionu bazu.
 * Polja se prepisuju 1:1 (raw fields, bez camelCase rename-a i bez OVERRIDES).
 * Document ID se cuva.
 *
 * 3k dokumenata, bez podkolekcija — sve staje u jedan run sa LIMIT = 3000.
 */
function migrateListPrice() {
  // ── HARDKODOVANE VREDNOSTI ─────────────────────────────────────────────
  var SOURCE_COLLECTION = "listPrice";
  var DEST_COLLECTION = "tenants/arst-srb/listPrice";

  // Resume — postavi na ID poslednjeg uspesno migriranog dokumenta iz prethodnog run-a.
  // Prvi run: ostavi prazno.
  var START_AFTER_ID = "";
  // Koliko dokumenata povuci u ovom run-u (Firestore runQuery max ~5MB po pozivu).
  var LIMIT = 3000;

  // ── EXECUTION ──────────────────────────────────────────────────────────
  var source = FirebaseService.old();
  var target = FirebaseService.prod();

  var query = {
    from: [{ collectionId: SOURCE_COLLECTION }],
    orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
    limit: LIMIT
  };

  if (START_AFTER_ID) {
    query.startAt = {
      values: [{ referenceValue: source.buildReferencePath(SOURCE_COLLECTION, START_AFTER_ID) }],
      before: false
    };
  }

  var docs = source.runQuery("", query);
  Logger.log(
    "Vraceno " + docs.length + " dokumenata iz " + SOURCE_COLLECTION +
    (START_AFTER_ID ? " posle '" + START_AFTER_ID + "'" : " (od pocetka)") +
    " — limit " + LIMIT
  );
  if (docs.length === 0) {
    Logger.log("Nema vise dokumenata za migraciju.");
    return;
  }

  // Queue upisa — raw fields, bez transformacije
  var writes = docs.map(function (doc) {
    return {
      collection: DEST_COLLECTION,
      documentId: doc.id,
      fields: doc.fields
    };
  });

  // Flush kroz :batchWrite (do 500 upisa po HTTP call-u)
  var BATCH_SIZE = 500;
  var migrated = 0;
  var errors = 0;

  for (var b = 0; b < writes.length; b += BATCH_SIZE) {
    var batch = writes.slice(b, b + BATCH_SIZE);
    var results = target.batchWriteSets(batch);
    for (var r = 0; r < results.length; r++) {
      if (results[r].success) {
        migrated++;
      } else {
        errors++;
        Logger.log("GRESKA " + batch[r].documentId + ": " + results[r].error);
      }
    }
    Logger.log("Batch " + (Math.floor(b / BATCH_SIZE) + 1) + ": " + batch.length + " upisa (1 HTTP call)");
  }

  Logger.log("Zavrseno. Migrirano: " + migrated + ", Gresaka: " + errors);
  Logger.log("Sledeci START_AFTER_ID = \"" + docs[docs.length - 1].id + "\"");
}

// ── Audit: provera tipova postCode i homeNumber za listu ID-ova ─────────

/**
 * Cita zadatu listu user dokumenata iz prod baze i pretvara svaki u red
 * sa SN-om i tipom polja postCode i homeNumber. Prikazuje koji su number,
 * a koji string. Ne menja podatke.
 *
 * Strategija: jedan po jedan dokument kroz runQuery sa __name__ == id.
 * Za ~100 ID-ova trajanje je 5-10s.
 */
function checkPostCodeAndHomeNumberTypes() {
  // ── HARDKODOVANE VREDNOSTI ─────────────────────────────────────────────
  var TARGET_PARENT = "tenants/arst-srb";
  var TARGET_USERS = "users";

  var IDS = [
    "330070923170730001632",
    "330073023181380000219",
    "330086423171980001363",
    "330086423191420000218",
    "330086423192830000923",
    "330086423192830000931",
    "330086423192840001622",
    "330086423192870001980",
    "330086423193310001953",
    "330086423200210001659",
    "330086423201400001258",
    "330086423201780000268",
    "330086423202100000182",
    "330086423202100000216",
    "330086423202100000242",
    "330086423202510000618",
    "330086423202510000645",
    "33008642320251000505",
    "330086423202590000581",
    "330086423202750000145",
    "330086423203370000406",
    "330086423203370000417",
    "330086423203370000466",
    "330086423203370000468",
    "330086423203370000491",
    "330086423203370000492",
    "330086423203370000502",
    "330086523192100001155",
    "330086523192970001300",
    "330086523192970001301",
    "330086523193160000798",
    "330086523193160000816",
    "330086523193160000822",
    "330086523193160000824",
    "330086523200480001981",
    "330086523200480001985",
    "330086523200480001993",
    "330086523201190000942",
    "330086523201190000947",
    "330086523201190000994",
    "330086523201190001003",
    "330086523202530000830",
    "330086523202530000839",
    "330086523202530000867",
    "330086523202530000872",
    "330086523202530000879",
    "330086523203450002212",
    "330086523203450002245",
    "330086523203450002274",
    "330086623193040001805",
    "330086623203390000186",
    "330087123200140001095",
    "330087123202040000203",
    "330088523190740000142",
    "330088523192890001409",
    "330088523192940001344",
    "330088523192960001096",
    "330088523193090001357",
    "330088523193090001360",
    "330088523193090001397",
    "330088523200100000486",
    "330088523200490001013",
    "330088523202550000997",
    "330088523202550001013",
    "330088523202550001032",
    "330088523202550001051",
    "330088523202550001085",
    "33008852320255000999",
    "330088523202790000471",
    "330088523202790000499",
    "330088523210150000700",
    "330101723181620001945",
    "330101723191350000587",
    "330101723193080000443",
    "330101723200990000497",
    "330101723202590000884",
    "330101723202590000927",
    "330101723202670001510",
    "330101723202670001535",
    "330101723202740001632",
    "330101723202740001737",
    "330102123172010000238",
    "330102123172010000298",
    "330102123172010000870",
    "330102123172010001048",
    "330102123172010001054",
    "330102123172010001060",
    "330102123172010001068",
    "330102123202610002107",
    "330102123202660001799",
    "330103723193290001385",
    "362614583210500038902"
  ];

  // ── EXECUTION ──────────────────────────────────────────────────────────
  var target = FirebaseService.prod();

  var notFound = [];
  var allString = [];
  var postCodeNumber = [];
  var homeNumberNumber = [];
  var bothNumber = [];

  for (var i = 0; i < IDS.length; i++) {
    var rawId = IDS[i];
    var id = String(rawId).replace(/\s+/g, ""); // trim sve whitespace

    var query = {
      from: [{ collectionId: TARGET_USERS }],
      where: {
        fieldFilter: {
          field: { fieldPath: "__name__" },
          op: "EQUAL",
          value: { referenceValue: target.buildReferencePath(TARGET_PARENT + "/" + TARGET_USERS, id) }
        }
      },
      limit: 1
    };
    var docs = target.runQuery(TARGET_PARENT, query);
    if (docs.length === 0) {
      notFound.push(id);
      continue;
    }

    var data = target.decodeFields(docs[0].fields);
    var postCodeType = typeof data.postCode;
    var homeNumberType = typeof data.homeNumber;

    var entry = {
      sn: id,
      postCode: data.postCode,
      postCodeType: postCodeType,
      homeNumber: data.homeNumber,
      homeNumberType: homeNumberType
    };

    var pNumber = postCodeType === "number";
    var hNumber = homeNumberType === "number";

    if (pNumber && hNumber) {
      bothNumber.push(entry);
    } else if (pNumber) {
      postCodeNumber.push(entry);
    } else if (hNumber) {
      homeNumberNumber.push(entry);
    } else {
      allString.push(entry);
    }
  }

  // ── REZIME ─────────────────────────────────────────────────────────────
  Logger.log("=== REZIME ===");
  Logger.log("Pretrazeno ID-ova: " + IDS.length);
  Logger.log("Nadjeno: " + (IDS.length - notFound.length));
  Logger.log("Nije nadjeno: " + notFound.length);
  Logger.log("Oba string (OK): " + allString.length);
  Logger.log("Samo postCode je number: " + postCodeNumber.length);
  Logger.log("Samo homeNumber je number: " + homeNumberNumber.length);
  Logger.log("Oba su number: " + bothNumber.length);

  if (notFound.length > 0) {
    Logger.log("");
    Logger.log("--- NIJE NADJENO U PROD-U (" + notFound.length + ") ---");
    for (var n = 0; n < notFound.length; n++) {
      Logger.log("  • " + notFound[n]);
    }
  }
  if (bothNumber.length > 0) {
    Logger.log("");
    Logger.log("--- OBA NUMBER (" + bothNumber.length + ") ---");
    for (var b = 0; b < bothNumber.length; b++) Logger.log("  • " + formatTypeEntry_(bothNumber[b]));
  }
  if (postCodeNumber.length > 0) {
    Logger.log("");
    Logger.log("--- SAMO postCode JE NUMBER (" + postCodeNumber.length + ") ---");
    for (var p = 0; p < postCodeNumber.length; p++) Logger.log("  • " + formatTypeEntry_(postCodeNumber[p]));
  }
  if (homeNumberNumber.length > 0) {
    Logger.log("");
    Logger.log("--- SAMO homeNumber JE NUMBER (" + homeNumberNumber.length + ") ---");
    for (var h = 0; h < homeNumberNumber.length; h++) Logger.log("  • " + formatTypeEntry_(homeNumberNumber[h]));
  }
}

function formatTypeEntry_(e) {
  return e.sn
    + "  |  postCode=" + JSON.stringify(e.postCode) + " (" + e.postCodeType + ")"
    + "  |  homeNumber=" + JSON.stringify(e.homeNumber) + " (" + e.homeNumberType + ")";
}

// ── Audit: gas-boiler/heat-pump useri bez commissioning intervencije ─────

/**
 * Pronalazi sve gas-boiler i heat-pump usere koji nemaju commissioning intervenciju
 * u staroj bazi. Strategija O(N+M):
 *   1. Jedan prolaz kroz intervencije — server-side filter Opis_kvara == "PUŠTANJE U RAD",
 *      cuvamo samo Bar_code u in-memory Set-u.
 *   2. Drugi prolaz kroz usere, filter po deviceType (gas-boiler/heat-pump),
 *      provera membership-a u Set-u.
 *
 * Ne menja podatke — samo loguje SN-ove. Pokreni pre migrateUsers da vidis stanje.
 *
 * Procena: 30k intervencija + 20k usera = ~25s, ispod Apps Script 6-min limita.
 */
/** Audit nad STAROM bazom (FirebaseService.old). */
function findUsersWithoutCommissioning() {
  findUsersWithoutCommissioning_(FirebaseService.old(), "STARA");
}

/** Audit nad MK bazom (FirebaseService.mk). */
function findUsersWithoutCommissioningMk() {
  findUsersWithoutCommissioning_(FirebaseService.mk(), "MK");
}

function findUsersWithoutCommissioning_(source, dbLabel) {
  // ── HARDKODOVANE VREDNOSTI ─────────────────────────────────────────────
  var SOURCE_INTERVENTIONS = "intervencije"; // PROVERI tacno ime root kolekcije
  var SOURCE_USERS = "korisnici";
  var SOURCE_DEVICES = "devices";

  var SN_FIELD = "Bar_code";
  var DESC_FIELD = "Opis_kvara";
  var COMMISSIONING_VALUE = "PUŠTANJE U RAD";

  // Polje za tip uredjaja ima razmak ("Device type") i vrednosti su sa
  // underscore-om ("gas_boiler", "heat_pump"). Compare-ujemo case-insensitive.
  var DEVICE_TYPE_FIELD = "Device type";
  var TARGET_DEVICE_TYPES = ["gas_boiler", "heat_pump"];

  var INTERVENTION_PAGE_SIZE = 1000;
  var USER_PAGE_SIZE = 1000;
  var MAX_PAGES = 50; // sigurnosni cap (50 × 1000 = 50k docs po fazi)

  // Filter: useri sa dateOfPurchase >= ovog datuma (rest se ignorise)
  var DATE_CUTOFF = new Date(2021, 5, 1); // 1. jun 2021 (mesec je 0-indeksiran)

  Logger.log("=== Audit nad " + dbLabel + " bazom (project: " + source.getProjectId() + ") ===");

  // ── 1. Map modelCode → deviceType iz STARE baze ────────────────────────
  var deviceTypeByCode = {};
  var deviceDocs = source.runQuery("", {
    from: [{ collectionId: SOURCE_DEVICES }],
    orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
    limit: 1000
  });
  for (var dd = 0; dd < deviceDocs.length; dd++) {
    var devData = source.decodeFields(deviceDocs[dd].fields);
    var rawType = devData[DEVICE_TYPE_FIELD];
    deviceTypeByCode[deviceDocs[dd].id] = (typeof rawType === "string" ? rawType : "").toLowerCase();
  }
  Logger.log("Ucitano " + deviceDocs.length + " device-a iz " + dbLabel + " baze.");

  // ── 2. Set SN-ova sa commissioning intervencijom ───────────────────────
  var commissionedSns = {};
  var lastInterventionId = "";
  var totalCommissioning = 0;

  for (var iter = 0; iter < MAX_PAGES; iter++) {
    var query = {
      from: [{ collectionId: SOURCE_INTERVENTIONS }],
      where: {
        fieldFilter: {
          field: { fieldPath: DESC_FIELD },
          op: "EQUAL",
          value: { stringValue: COMMISSIONING_VALUE }
        }
      },
      orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
      limit: INTERVENTION_PAGE_SIZE
    };
    if (lastInterventionId) {
      query.startAt = {
        values: [{ referenceValue: source.buildReferencePath(SOURCE_INTERVENTIONS, lastInterventionId) }],
        before: false
      };
    }

    var docs = source.runQuery("", query);
    Logger.log("Intervencije iter " + (iter + 1) + ": " + docs.length + " sa Opis_kvara = '" + COMMISSIONING_VALUE + "'");
    if (docs.length === 0) break;

    totalCommissioning += docs.length;
    for (var i = 0; i < docs.length; i++) {
      var data = source.decodeFields(docs[i].fields);
      var sn = data[SN_FIELD];
      if (typeof sn === "string" && sn !== "") {
        commissionedSns[sn] = true;
      }
    }

    lastInterventionId = docs[docs.length - 1].id;
    if (docs.length < INTERVENTION_PAGE_SIZE) break;
  }

  var uniqueCommissionedCount = 0;
  for (var k in commissionedSns) {
    if (commissionedSns.hasOwnProperty(k)) uniqueCommissionedCount++;
  }
  Logger.log("Commissioning intervencije procitane: " + totalCommissioning
             + " (unikatnih SN-ova: " + uniqueCommissionedCount + ")");

  // ── 3. Iteriraj usere, filtriraj po deviceType, proveri membership ────
  var missingGasBoiler = [];
  var missingHeatPump = [];
  var totalUsers = 0;
  var skippedOtherTypes = 0;
  var unknownModelCount = 0;
  var lastUserId = "";

  for (var iter2 = 0; iter2 < MAX_PAGES; iter2++) {
    var userQuery = {
      from: [{ collectionId: SOURCE_USERS }],
      orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
      limit: USER_PAGE_SIZE
    };
    if (lastUserId) {
      userQuery.startAt = {
        values: [{ referenceValue: source.buildReferencePath(SOURCE_USERS, lastUserId) }],
        before: false
      };
    }

    var userDocs = source.runQuery("", userQuery);
    Logger.log("Useri iter " + (iter2 + 1) + ": " + userDocs.length + " procitano");
    if (userDocs.length === 0) break;

    totalUsers += userDocs.length;
    for (var u = 0; u < userDocs.length; u++) {
      var userDoc = userDocs[u];
      var userSn = userDoc.id;
      var modelCode = userSn.substring(0, 7);
      var deviceType = deviceTypeByCode[modelCode];

      if (deviceType === undefined) {
        unknownModelCount++;
        continue;
      }
      if (TARGET_DEVICE_TYPES.indexOf(deviceType) === -1) {
        skippedOtherTypes++;
        continue;
      }
      if (commissionedSns[userSn]) continue;

      // Bez commissioning — proveri datum kupovine i dodaj u listu sa addedBy.
      var userData = source.decodeFields(userDoc.fields);
      var dateOfPurchase = toDateOrNull_(userData.dateOfPurchase);
      if (!dateOfPurchase || dateOfPurchase < DATE_CUTOFF) continue;

      var entry = {
        sn: userSn,
        dateOfPurchase: dateOfPurchase,
        addedBy: typeof userData.addedBy === "string" ? userData.addedBy : ""
      };
      if (deviceType === "gas_boiler") {
        missingGasBoiler.push(entry);
      } else {
        missingHeatPump.push(entry);
      }
    }

    lastUserId = userDocs[userDocs.length - 1].id;
    if (userDocs.length < USER_PAGE_SIZE) break;
  }

  // ── 4. Rezime ──────────────────────────────────────────────────────────
  Logger.log("");
  Logger.log("=== REZIME ===");
  Logger.log("Useri procitani: " + totalUsers);
  Logger.log("Preskocno (drugi deviceType): " + skippedOtherTypes);
  Logger.log("Preskoceno (modelCode nije nadjen u devices): " + unknownModelCount);
  Logger.log("Gas-boiler bez commissioning: " + missingGasBoiler.length);
  Logger.log("Heat-pump bez commissioning: " + missingHeatPump.length);

  if (missingGasBoiler.length > 0) {
    Logger.log("");
    Logger.log("--- GAS-BOILER bez commissioning (" + missingGasBoiler.length + ") ---");
    for (var g = 0; g < missingGasBoiler.length; g++) {
      Logger.log("  • " + formatMissingEntry_(missingGasBoiler[g]));
    }
  }
  if (missingHeatPump.length > 0) {
    Logger.log("");
    Logger.log("--- HEAT-PUMP bez commissioning (" + missingHeatPump.length + ") ---");
    for (var h = 0; h < missingHeatPump.length; h++) {
      Logger.log("  • " + formatMissingEntry_(missingHeatPump[h]));
    }
  }
}

function formatMissingEntry_(e) {
  var d = e.dateOfPurchase;
  var dateStr = Utilities.formatDate(d, "Europe/Belgrade", "yyyy-MM-dd");
  return e.sn + "  |  " + dateStr + "  |  " + e.addedBy;
}

// ── Migracija: users (~20k dokumenata, auto-paginacija unutar run-a) ─────

/**
 * Cita usere iz stare baze i upisuje ih u produkcionu bazu.
 * Polja su vec u camelCase (firstName, lastName, addedDate, itd.) — kopiraju se 1:1.
 * Document ID se cuva.
 *
 * Auto-paginira unutar jednog run-a — povlaci stranicu po stranicu sve dok ne potrosi
 * sve usere ili ne dostigne MAX_ITERATIONS (sigurnosni limit). Apps Script ima
 * 6-min time limit, sto je sasvim dovoljno za ~20k dokumenata kroz batchWrite.
 */
/** Migracija usera iz STARE baze u tenants/arst-srb/users. */
function migrateUsers() {
  migrateUsers_(FirebaseService.old(), "STARA", "tenants/arst-srb");
}

/** Migracija usera iz MK baze u tenants/arst-mk/users. */
function migrateUsersFromMk() {
  migrateUsers_(FirebaseService.mk(), "MK", "tenants/arst-mk");
}

/**
 * @param {Object} source — FirebaseService instanca izvora
 * @param {string} dbLabel — "STARA" / "MK" (samo za log)
 * @param {string} tenantPath — npr. "tenants/arst-srb" ili "tenants/arst-mk"
 *                              (koristi se i kao parent za devices i kao prefix za users dest)
 */
function migrateUsers_(source, dbLabel, tenantPath) {
  // ── HARDKODOVANE VREDNOSTI ─────────────────────────────────────────────
  var SOURCE_COLLECTION = "users";
  var DEST_COLLECTION = tenantPath + "/users";

  // Resume — postavi ako je prethodni run zavrsio sa nedovrsenom listom.
  var START_AFTER_ID = "";
  // Stranica — koliko usera povuci po runQuery-ju (max ~5MB po pozivu).
  var PAGE_SIZE = 1000;
  // Sigurnosni cap — nikad nece nastaviti duze od ovoliko stranica u jednom run-u.
  var MAX_ITERATIONS = 100;

  // ── EXECUTION ──────────────────────────────────────────────────────────
  var target = FirebaseService.prod();
  Logger.log("=== migrateUsers iz " + dbLabel + " baze (project: " + source.getProjectId() + ") → " + DEST_COLLECTION + " ===");

  // Predobijaj sve devices iz prod-a u jednom pozivu i napravi map: modelCode → deviceType.
  // Sluzi za resolvanje deviceType iz prvih 7 cifara SN-a svakog usera.
  var deviceTypeByCode = {};
  var deviceDocs = target.runQuery(tenantPath, {
    from: [{ collectionId: "devices" }],
    orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
    limit: 1000
  });
  for (var dd = 0; dd < deviceDocs.length; dd++) {
    var devData = target.decodeFields(deviceDocs[dd].fields);
    deviceTypeByCode[deviceDocs[dd].id] = devData.deviceType || "";
  }
  Logger.log("Ucitano " + deviceDocs.length + " device-a iz " + tenantPath + "/devices za lookup deviceType-a.");

  // Ocekivani format polja u izvornom dokumentu (pre transformacije).
  // Polje lastWarrantyExtension nema validaciju — uvek se brise.
  // connectedDeviceSn je opciono: ako ne postoji ili je "" → OK; ako postoji s vrednoscu mora biti string.
  var EXPECTED_USER_FIELDS = [
    { name: "addedBy", type: "string", required: true },
    { name: "addedDate", type: "timestamp", required: true },
    { name: "additionType", type: "string", required: true },
    { name: "city", type: "string", required: true },
    { name: "connectedDeviceSn", type: "string", required: false, length: 21 },
    { name: "dateOfPurchase", type: "timestamp", required: false }, // required samo za commis (poseban check)
    { name: "firstName", type: "string", required: true },
    { name: "firstNameSrch", type: "string", required: true },
    { name: "homeNumber", type: "string", required: true },
    { name: "lastName", type: "string", required: true },
    { name: "lastNameSrch", type: "string", required: true },
    { name: "phoneNumber", type: "string", required: true },
    { name: "postCode", type: "string", required: true },
    { name: "streetName", type: "string", required: true }
  ];

  var totalRead = 0;
  var totalMigrated = 0;
  var totalErrors = 0;
  var unknownModelCount = 0;
  var lastIdSeen = START_AFTER_ID;
  var validationIssues = [];          // [{ sn, issues: ["..."] }]
  var commisMissingDate = [];         // [sn, ...] — commis useri bez dateOfPurchase
  var autoFixedSrch = [];             // [{ sn, fields: ["firstNameSrch", ...] }]
  var normalizedFields = [];          // [{ sn, fields: [{name, fromType, toValue}] }]
  // Commis useri kojima nije pronadjena commissioning intervencija — split po datumu kupovine.
  var missingCommisBeforeCutoff = []; // [sn, ...]
  var missingCommisAfterCutoff = [];  // [sn, ...]
  var missingCommisUnknownDate = []; // [sn, ...]

  // Pre-fetch SN set za sve commissioning intervencije (jednom, na pocetku).
  var commissionedSns = fetchCommissionedSnSet_(source);

  // Cutoff: dateOfPurchase pre ovog datuma znaci automatski out-of-warranty.
  var WARRANTY_CUTOFF = new Date(2021, 5, 1); // 1. jun 2021 (mesec je 0-indeksiran)

  for (var iter = 0; iter < MAX_ITERATIONS; iter++) {
    var query = {
      from: [{ collectionId: SOURCE_COLLECTION }],
      orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
      limit: PAGE_SIZE
    };

    if (lastIdSeen) {
      query.startAt = {
        values: [{ referenceValue: source.buildReferencePath(SOURCE_COLLECTION, lastIdSeen) }],
        before: false
      };
    }

    var docs = source.runQuery("", query);
    Logger.log(
      "Iter " + (iter + 1) + ": vraceno " + docs.length + " usera" +
      (lastIdSeen ? " posle '" + lastIdSeen + "'" : " (od pocetka)")
    );
    if (docs.length === 0) {
      Logger.log("Nema vise dokumenata — kraj.");
      break;
    }

    totalRead += docs.length;

    // Pripremi upise — dekodiraj, validiraj, ukloni lastWarrantyExtension,
    // dodaj sn = doc.id, deviceType iz lookup mape (prvih 7 cifara SN-a = modelCode),
    // i preimenuj additionType u warrantyStatus uz mapiranje:
    //   commis   → in-warranty
    //   bilo sta drugo (uklj. noCommis i nepoznate vrednosti) → out-of-warranty
    // Preimenuj connectedDeviceSn u connectedDevice — samo ako je popunjen string;
    // ako je null/undefined/"" polje se uopste ne upisuje u destinaciju.
    // dateOfPurchase: ako je "" ne migrira se. Ako je commis bez datuma — flag-uj SN.
    var writes = docs.map(function (doc) {
      var data = source.decodeFields(doc.fields);

      // ── AUTO-FIX *Srch polja pre validacije ───────────────────
      // Ako fali firstNameSrch/lastNameSrch ali postoji firstName/lastName,
      // generisi ih i prijavi u "note" listi (validator ne flag-uje).
      var autoFixed = [];
      if ((data.firstNameSrch == null || data.firstNameSrch === "")
          && typeof data.firstName === "string" && data.firstName !== "") {
        data.firstNameSrch = toLatinUpperCase_(data.firstName);
        autoFixed.push("firstNameSrch");
      }
      if ((data.lastNameSrch == null || data.lastNameSrch === "")
          && typeof data.lastName === "string" && data.lastName !== "") {
        data.lastNameSrch = toLatinUpperCase_(data.lastName);
        autoFixed.push("lastNameSrch");
      }
      if (autoFixed.length > 0) {
        autoFixedSrch.push({ sn: doc.id, fields: autoFixed });
      }

      // ── AUTO-FIX postCode i homeNumber: number → string, drugo → "" ──
      var fieldFixes = [];
      var rawPostCode = data.postCode;
      if (typeof rawPostCode !== "string") {
        var fromType = typeof rawPostCode;
        data.postCode = normalizeStringField_(rawPostCode);
        fieldFixes.push({ name: "postCode", fromType: fromType, toValue: data.postCode });
      }
      var rawHomeNumber = data.homeNumber;
      if (typeof rawHomeNumber !== "string") {
        var fromTypeH = typeof rawHomeNumber;
        data.homeNumber = normalizeStringField_(rawHomeNumber);
        fieldFixes.push({ name: "homeNumber", fromType: fromTypeH, toValue: data.homeNumber });
      }
      if (fieldFixes.length > 0) {
        normalizedFields.push({ sn: doc.id, fields: fieldFixes });
      }

      // ── VALIDACIJA pre bilo kakve transformacije ──────────────
      var issues = validateUserDoc_(data, EXPECTED_USER_FIELDS);
      if (doc.id.length !== 21) {
        issues.push("'sn' (doc.id) duzina " + doc.id.length + " (ocekivano 21)");
      }
      if (issues.length > 0) {
        validationIssues.push({ sn: doc.id, issues: issues });
      }
      if (data.additionType === "commis" && !toDateOrNull_(data.dateOfPurchase)) {
        commisMissingDate.push(doc.id);
      }

      // ── TRANSFORMACIJA ────────────────────────────────────────
      delete data.lastWarrantyExtension;
      data.sn = doc.id;
      var modelCode = doc.id.substring(0, 7);
      var deviceType = deviceTypeByCode[modelCode];
      if (deviceType === undefined) {
        unknownModelCount++;
        deviceType = "";
      }
      data.deviceType = deviceType;
      var addition = data.additionType;
      delete data.additionType;

      // warrantyStatus pravila:
      //   - additionType != "commis" → out-of-warranty (univerzalno)
      //   - additionType == "commis":
      //       - boiler / air-condition / nepoznat tip → veruje se additionType → in-warranty
      //       - gas-boiler / heat-pump → cross-reference sa commissioning intervencijama:
      //           ima intervenciju → in-warranty
      //           nema → out-of-warranty + log u kategoriji po datumu
      if (addition !== "commis") {
        data.warrantyStatus = "out-of-warranty";
      } else if (deviceType === "gas-boiler" || deviceType === "heat-pump") {
        if (commissionedSns[doc.id]) {
          data.warrantyStatus = "in-warranty";
        } else {
          data.warrantyStatus = "out-of-warranty";
          // Log u jednu od tri kategorije zavisno od dateOfPurchase
          var purchaseDate = toDateOrNull_(data.dateOfPurchase);
          if (!purchaseDate) {
            missingCommisUnknownDate.push(doc.id);
          } else if (purchaseDate < WARRANTY_CUTOFF) {
            missingCommisBeforeCutoff.push(doc.id);
          } else {
            missingCommisAfterCutoff.push(doc.id);
          }
        }
      } else {
        // boiler, air-condition (i nepoznati tipovi) — bez cross-reference-a
        data.warrantyStatus = "in-warranty";
      }

      var connectedSn = data.connectedDeviceSn;
      delete data.connectedDeviceSn;
      if (typeof connectedSn === "string" && connectedSn !== "") {
        data.connectedDevice = connectedSn;
      }

      // dateOfPurchase: ne migrira se ako je prazan string
      if (data.dateOfPurchase === "") {
        delete data.dateOfPurchase;
      }

      return {
        collection: DEST_COLLECTION,
        documentId: doc.id,
        fields: target.encodeFields(data)
      };
    });

    // Flush kroz :batchWrite (do 500 po HTTP call-u)
    var BATCH_SIZE = 500;
    for (var b = 0; b < writes.length; b += BATCH_SIZE) {
      var batch = writes.slice(b, b + BATCH_SIZE);
      var results = target.batchWriteSets(batch);
      for (var r = 0; r < results.length; r++) {
        if (results[r].success) {
          totalMigrated++;
        } else {
          totalErrors++;
          Logger.log("GRESKA " + batch[r].documentId + ": " + results[r].error);
        }
      }
    }

    lastIdSeen = docs[docs.length - 1].id;

    // Ako je stranica vratila manje od PAGE_SIZE, nema vise dokumenata.
    if (docs.length < PAGE_SIZE) {
      Logger.log("Poslednja stranica nije puna — kraj.");
      break;
    }
  }

  Logger.log("Zavrseno. Procitano: " + totalRead + ", Migrirano: " + totalMigrated + ", Gresaka: " + totalErrors);
  if (unknownModelCount > 0) {
    Logger.log("UPOZORENJE: " + unknownModelCount + " usera ima SN ciji modelCode (prvih 7 cifara) nije u devices kolekciji — deviceType je postavljen na prazan string.");
  }

  // ── VALIDACIJA: prikazi listu usera sa nedostajucim/pogresnim poljima ──
  if (autoFixedSrch.length > 0) {
    Logger.log("NAPOMENA — auto-popunjena search polja u " + autoFixedSrch.length + " usera:");
    for (var ai = 0; ai < autoFixedSrch.length; ai++) {
      Logger.log("  • " + autoFixedSrch[ai].sn + " → " + autoFixedSrch[ai].fields.join(", "));
    }
  }
  if (normalizedFields.length > 0) {
    Logger.log("NAPOMENA — normalizovana postCode/homeNumber polja u "
               + normalizedFields.length + " usera:");
    for (var ni = 0; ni < normalizedFields.length; ni++) {
      var entry = normalizedFields[ni];
      var parts = entry.fields.map(function (f) {
        return f.name + " (" + f.fromType + " → \"" + f.toValue + "\")";
      });
      Logger.log("  • " + entry.sn + " → " + parts.join(", "));
    }
  }
  if (missingCommisBeforeCutoff.length > 0) {
    Logger.log("");
    Logger.log("--- COMMIS BEZ COMMISSIONING INTERVENCIJE — PRE 01.06.2021. ("
               + missingCommisBeforeCutoff.length + ") ---");
    for (var mb = 0; mb < missingCommisBeforeCutoff.length; mb++) {
      Logger.log("  • " + missingCommisBeforeCutoff[mb]);
    }
  }
  if (missingCommisAfterCutoff.length > 0) {
    Logger.log("");
    Logger.log("--- COMMIS BEZ COMMISSIONING INTERVENCIJE — POSLE 01.06.2021. ("
               + missingCommisAfterCutoff.length + ") ---");
    for (var ma = 0; ma < missingCommisAfterCutoff.length; ma++) {
      Logger.log("  • " + missingCommisAfterCutoff[ma]);
    }
  }
  if (missingCommisUnknownDate.length > 0) {
    Logger.log("");
    Logger.log("--- COMMIS BEZ COMMISSIONING INTERVENCIJE — NEPOZNAT DATUM ("
               + missingCommisUnknownDate.length + ") ---");
    for (var mu = 0; mu < missingCommisUnknownDate.length; mu++) {
      Logger.log("  • " + missingCommisUnknownDate[mu]);
    }
  }
  if (commisMissingDate.length > 0) {
    Logger.log("");
    Logger.log("KRITICNO — commis useri bez dateOfPurchase (" + commisMissingDate.length + "):");
    for (var ci = 0; ci < commisMissingDate.length; ci++) {
      Logger.log("  • " + commisMissingDate[ci]);
    }
  }
  if (validationIssues.length > 0) {
    Logger.log("UPOZORENJE — validacijski problemi u " + validationIssues.length + " usera:");
    for (var vi = 0; vi < validationIssues.length; vi++) {
      var entry = validationIssues[vi];
      Logger.log("  • " + entry.sn + " → " + entry.issues.join("; "));
    }
  }

  if (lastIdSeen) {
    Logger.log("Poslednji obradjen ID = \"" + lastIdSeen + "\"" +
               " (postavi kao START_AFTER_ID ako treba ponovo da pokrenes)");
  }
}

// ── Helperi ──────────────────────────────────────────────────────────────

/**
 * Validira dokument prema spec-u { name, type, required }.
 * Vraca array stringova sa opisom problema (prazno = sve ok).
 *
 * Tipovi koje proverava:
 *   - "string"    → typeof === "string", ako required onda i !== ""
 *   - "timestamp" → ne sme biti null/undefined/string, mora biti objekat (Date ili decoded timestamp)
 */
function validateUserDoc_(data, spec) {
  var issues = [];
  for (var i = 0; i < spec.length; i++) {
    var f = spec[i];
    var value = data[f.name];

    if (value === undefined) {
      if (f.required) issues.push("nedostaje '" + f.name + "'");
      continue;
    }
    if (value === null) {
      if (f.required) issues.push("'" + f.name + "' je null");
      continue;
    }

    if (f.type === "string") {
      if (typeof value !== "string") {
        issues.push("'" + f.name + "' nije string (typeof=" + typeof value + ")");
      } else if (f.required && value === "") {
        issues.push("'" + f.name + "' je prazan");
      } else if (f.length != null && value !== "" && value.length !== f.length) {
        issues.push("'" + f.name + "' duzina " + value.length + " (ocekivano " + f.length + ")");
      }
    } else if (f.type === "timestamp") {
      // Prazan string tretiramo kao "nije unet" — flag samo ako je polje required.
      if (value === "") {
        if (f.required) issues.push("'" + f.name + "' je prazan");
        continue;
      }
      // decoded timestamp je obicno Date instanca; string ili broj nisu validni
      if (typeof value === "string" || typeof value === "number") {
        issues.push("'" + f.name + "' nije timestamp (typeof=" + typeof value + ", value='" + value + "')");
      }
    }
  }
  return issues;
}

/**
 * Cita sve commissioning intervencije iz stare baze (server-side filter
 * Opis_kvara == "PUŠTANJE U RAD") i vraca map { sn: true } za O(1) membership check.
 *
 * Koristi se i u migrateUsers (za odredjivanje warrantyStatus) i u
 * findUsersWithoutCommissioning (za audit). Strategija identicna — paginirano,
 * server-side filter, in-memory Set.
 */
function fetchCommissionedSnSet_(source) {
  var SOURCE_INTERVENTIONS = "intervencije";
  var SN_FIELD = "Bar_code";
  var DESC_FIELD = "Opis_kvara";
  var COMMISSIONING_VALUE = "PUŠTANJE U RAD";
  var PAGE_SIZE = 1000;
  var MAX_PAGES = 50;

  var commissionedSns = {};
  var lastInterventionId = "";
  var totalRead = 0;

  for (var iter = 0; iter < MAX_PAGES; iter++) {
    var query = {
      from: [{ collectionId: SOURCE_INTERVENTIONS }],
      where: {
        fieldFilter: {
          field: { fieldPath: DESC_FIELD },
          op: "EQUAL",
          value: { stringValue: COMMISSIONING_VALUE }
        }
      },
      orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
      limit: PAGE_SIZE
    };
    if (lastInterventionId) {
      query.startAt = {
        values: [{ referenceValue: source.buildReferencePath(SOURCE_INTERVENTIONS, lastInterventionId) }],
        before: false
      };
    }

    var docs = source.runQuery("", query);
    Logger.log("Commissioning intervencije iter " + (iter + 1) + ": " + docs.length);
    if (docs.length === 0) break;

    totalRead += docs.length;
    for (var i = 0; i < docs.length; i++) {
      var data = source.decodeFields(docs[i].fields);
      var sn = data[SN_FIELD];
      if (typeof sn === "string" && sn !== "") commissionedSns[sn] = true;
    }

    lastInterventionId = docs[docs.length - 1].id;
    if (docs.length < PAGE_SIZE) break;
  }

  var unique = 0;
  for (var k in commissionedSns) if (commissionedSns.hasOwnProperty(k)) unique++;
  Logger.log("Commissioning intervencije procitane: " + totalRead + " (unikatnih SN: " + unique + ")");
  return commissionedSns;
}

/**
 * Pretvara dekodovanu vrednost iz Firestore-a u JS Date ili null.
 * Dekoder moze da vrati Date instancu, objekat oblika
 * { __type__: "timestamp", seconds, nanoseconds }, ili ISO string —
 * helper sve to prepoznaje.
 */
function toDateOrNull_(val) {
  if (val == null || val === "") return null;
  if (val instanceof Date) return val;
  if (typeof val === "object" && typeof val.seconds === "number") {
    return new Date(val.seconds * 1000);
  }
  if (typeof val === "string") {
    var d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Normalizuje vrednost u string:
 *   - string → unmodifikovan
 *   - number → String(value)
 *   - sve ostalo (null, undefined, object, boolean, array...) → ""
 */
function normalizeStringField_(val) {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return "";
}

/**
 * Konvertuje string u Latin uppercase, transliterujuci cirilicu i dijakritike.
 * Poklapa logiku iz add-user.page.ts toLatinUpperCase().
 *
 * Primeri:
 *   "Marko" → "MARKO"
 *   "Стефан" → "STEFAN"
 *   "Đorđe" → "DJORDJE"
 */
function toLatinUpperCase_(value) {
  var map = {
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Ђ': 'DJ', 'Е': 'E',
    'Ж': 'Z', 'З': 'Z', 'И': 'I', 'Ј': 'J', 'К': 'K', 'Л': 'L', 'Љ': 'LJ',
    'М': 'M', 'Н': 'N', 'Њ': 'NJ', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S',
    'Т': 'T', 'Ћ': 'C', 'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'C', 'Ч': 'C',
    'Џ': 'DZ', 'Ш': 'S',
    'а': 'A', 'б': 'B', 'в': 'V', 'г': 'G', 'д': 'D', 'ђ': 'DJ', 'е': 'E',
    'ж': 'Z', 'з': 'Z', 'и': 'I', 'ј': 'J', 'к': 'K', 'л': 'L', 'љ': 'LJ',
    'м': 'M', 'н': 'N', 'њ': 'NJ', 'о': 'O', 'п': 'P', 'р': 'R', 'с': 'S',
    'т': 'T', 'ћ': 'C', 'у': 'U', 'ф': 'F', 'х': 'H', 'ц': 'C', 'ч': 'C',
    'џ': 'DZ', 'ш': 'S',
    'Č': 'C', 'č': 'C', 'Ć': 'C', 'ć': 'C', 'Đ': 'DJ', 'đ': 'DJ',
    'Š': 'S', 'š': 'S', 'Ž': 'Z', 'ž': 'Z'
  };
  var out = [];
  for (var i = 0; i < value.length; i++) {
    var ch = value.charAt(i);
    out.push(map[ch] != null ? map[ch] : ch.toUpperCase());
  }
  return out.join('');
}

/**
 * Spaja polja iz izvornog dokumenta (sa kljucevima preimenovanim u camelCase)
 * sa hardkodovanim override-ima. Override-i imaju prednost.
 */
function mergeData_(sourceData, overrides) {
  var merged = {};
  for (var k in sourceData) {
    if (sourceData.hasOwnProperty(k)) merged[toCamelCase_(k)] = sourceData[k];
  }
  for (var o in overrides) {
    if (overrides.hasOwnProperty(o)) merged[o] = overrides[o];
  }
  return merged;
}

/**
 * Wrapuje field path sa backtick-ovima ako sadrzi specijalne karaktere
 * (razmaci, tacke izvan nesting-a, itd.). Firestore field path syntax.
 *
 * Primeri:
 *   "code"         → "code"
 *   "Device type"  → "`Device type`"
 */
function quoteFieldPath_(fp) {
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fp)) return fp;
  return "`" + String(fp).replace(/`/g, "\\`") + "`";
}

/**
 * Konvertuje string sa razmacima u camelCase.
 * Prva rec — prvo slovo malo (ostatak nepromenjen).
 * Svaka naredna rec — prvo slovo veliko (ostatak nepromenjen).
 *
 * Primeri:
 *   "Device Name"      → "deviceName"
 *   "Device added ID"  → "deviceAddedID"
 *   "Document name"    → "documentName"
 */
function toCamelCase_(s) {
  if (s == null) return s;
  var parts = String(s).split(/\s+/).filter(function (p) { return p.length > 0; });
  if (parts.length === 0) return s;
  var head = parts[0].charAt(0).toLowerCase() + parts[0].slice(1);
  var tail = parts.slice(1).map(function (p) {
    return p.charAt(0).toUpperCase() + p.slice(1);
  });
  return head + tail.join("");
}
