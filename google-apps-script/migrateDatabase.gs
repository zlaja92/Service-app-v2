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
function findUsersWithoutCommissioning() {
  // ── HARDKODOVANE VREDNOSTI ─────────────────────────────────────────────
  // Sve se cita iz STARE baze — pre bilo kakve migracije.
  var SOURCE_INTERVENTIONS = "intervencije"; // PROVERI tacno ime root kolekcije
  var SOURCE_USERS = "korisnici";
  var SOURCE_DEVICES = "devices";

  var SN_FIELD = "Bar_code";
  var DESC_FIELD = "Opis_kvara";
  var COMMISSIONING_VALUE = "PUŠTANJE U RAD";

  // U staroj bazi polje za tip ima razmak ("Device type") i vrednosti su sa
  // underscore-om ("gas_boiler", "heat_pump"). Compare-ujemo case-insensitive.
  var DEVICE_TYPE_FIELD = "Device type";
  var TARGET_DEVICE_TYPES = ["gas_boiler", "heat_pump"];

  var INTERVENTION_PAGE_SIZE = 1000;
  var USER_PAGE_SIZE = 1000;
  var MAX_PAGES = 50; // sigurnosni cap (50 × 1000 = 50k docs po fazi)

  // Filter: useri sa dateOfPurchase >= ovog datuma (rest se ignorise)
  var DATE_CUTOFF = new Date(2021, 5, 1); // 1. jun 2021 (mesec je 0-indeksiran)

  // ── EXECUTION ──────────────────────────────────────────────────────────
  var source = FirebaseService.old();

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
  Logger.log("Ucitano " + deviceDocs.length + " device-a iz stare baze.");

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
function migrateUsers() {
  // ── HARDKODOVANE VREDNOSTI ─────────────────────────────────────────────
  var SOURCE_COLLECTION = "users";
  var DEST_COLLECTION = "tenants/arst-srb/users";

  // Resume — postavi ako je prethodni run zavrsio sa nedovrsenom listom.
  var START_AFTER_ID = "";
  // Stranica — koliko usera povuci po runQuery-ju (max ~5MB po pozivu).
  var PAGE_SIZE = 1000;
  // Sigurnosni cap — nikad nece nastaviti duze od ovoliko stranica u jednom run-u.
  var MAX_ITERATIONS = 100;

  // ── EXECUTION ──────────────────────────────────────────────────────────
  var source = FirebaseService.old();
  var target = FirebaseService.prod();

  // Predobijaj sve devices iz prod-a u jednom pozivu i napravi map: modelCode → deviceType.
  // Sluzi za resolvanje deviceType iz prvih 7 cifara SN-a svakog usera.
  var deviceTypeByCode = {};
  var deviceDocs = target.runQuery("tenants/arst-srb", {
    from: [{ collectionId: "devices" }],
    orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
    limit: 1000
  });
  for (var dd = 0; dd < deviceDocs.length; dd++) {
    var devData = target.decodeFields(deviceDocs[dd].fields);
    deviceTypeByCode[deviceDocs[dd].id] = devData.deviceType || "";
  }
  Logger.log("Ucitano " + deviceDocs.length + " device-a u memoriju za lookup deviceType-a.");

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
