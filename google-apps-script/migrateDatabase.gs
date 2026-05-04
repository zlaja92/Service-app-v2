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

// ── Helperi ──────────────────────────────────────────────────────────────

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
