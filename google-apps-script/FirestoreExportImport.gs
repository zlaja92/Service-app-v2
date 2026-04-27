/**
 * FirestoreExportImport.gs
 * Export/import jednog dokumenta sa svim podkolekcijama rekurzivno.
 * Koristi FirebaseService za sve Firestore operacije.
 */

function exportOneDocDeep(collectionPath, docId) {
  var docs = FirebaseService.prod().listDocuments(collectionPath, 300);
  var doc = null;

  for (var i = 0; i < docs.length; i++) {
    if (docs[i].id === docId) { doc = docs[i]; break; }
  }

  if (!doc) {
    Logger.log("Dokument nije pronadjen: " + collectionPath + "/" + docId);
    return;
  }

  attachSubcollections_(collectionPath + "/" + docId, doc, 0, 10);

  Logger.log("Exportovan " + docId + " — ukupno " + countDeep_([doc]) + " dok.");
  Logger.log("===== EXPORT START =====");
  Logger.log(JSON.stringify(doc));
  Logger.log("===== EXPORT END =====");
}

function importOneDocDeep(collectionPath, jsonString) {
  var doc = JSON.parse(jsonString);
  Logger.log("Importujem " + doc.id + " — ukupno " + countDeep_([doc]) + " dok.");
  writeRecursive_(collectionPath, [doc]);
  Logger.log("Import zavrsen.");
}

// ── Rekurzija ─────────────────────────────────────────────────────────

function attachSubcollections_(docPath, doc, depth, maxDepth) {
  if (depth >= maxDepth) return;

  var subNames = FirebaseService.prod().listCollectionIds(docPath);
  if (!subNames.length) return;

  doc.subcollections = {};
  for (var s = 0; s < subNames.length; s++) {
    var subPath = docPath + "/" + subNames[s];
    var subDocs = FirebaseService.prod().listDocuments(subPath, 300);

    for (var d = 0; d < subDocs.length; d++) {
      attachSubcollections_(subPath + "/" + subDocs[d].id, subDocs[d], depth + 1, maxDepth);
    }

    doc.subcollections[subNames[s]] = subDocs;
  }
}

function writeRecursive_(collectionPath, documents) {
  for (var i = 0; i < documents.length; i++) {
    var doc = documents[i];
    FirebaseService.prod().setDocumentRaw(collectionPath, doc.id, doc.fields);

    if (!doc.subcollections) continue;
    var subNames = Object.keys(doc.subcollections);
    for (var s = 0; s < subNames.length; s++) {
      writeRecursive_(collectionPath + "/" + doc.id + "/" + subNames[s], doc.subcollections[subNames[s]]);
    }
  }

  Logger.log("  " + collectionPath + ": " + documents.length + " dok.");
}

function countDeep_(docs) {
  var count = docs.length;
  for (var i = 0; i < docs.length; i++) {
    if (!docs[i].subcollections) continue;
    var keys = Object.keys(docs[i].subcollections);
    for (var k = 0; k < keys.length; k++) {
      count += countDeep_(docs[i].subcollections[keys[k]]);
    }
  }
  return count;
}

// ── Runner ────────────────────────────────────────────────────────────

function runExport() {
  exportOneDocDeep("tenants/arst1/devices", "3100216");
}

function runImport() {
  var json = '';
  importOneDocDeep("tenants/arst-srb/devices", json);
}
