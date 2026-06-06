/**
 * FirebaseService.gs
 * Direktna komunikacija sa Firestore REST API.
 *
 * Koriscenje:
 *   - FirebaseService.prod()  — instanca za produkcionu bazu (ariston-srb)
 *   - FirebaseService.test()  — instanca za test bazu (aristonboilersmk-af027)
 *   - FirebaseService.old()   — instanca za staru bazu (za migracije)
 *   - FirebaseService.mk()    — instanca za MK bazu
 *   - FirebaseService.forProject(projectId, email, key) — custom instanca
 */

var FirebaseService = (function () {

  // ── Factory za project-specific instance ─────────────────────────────

  function createInstance_(projectId, email, key) {
    var token_ = null;
    var tokenExpiry_ = 0;

    function getAccessToken_() {
      var now = Math.floor(Date.now() / 1000);
      if (token_ && now < tokenExpiry_ - 60) return token_;

      var header = { alg: "RS256", typ: "JWT" };
      var claimSet = {
        iss: email,
        scope: "https://www.googleapis.com/auth/datastore",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600
      };

      var toSign =
        Utilities.base64EncodeWebSafe(JSON.stringify(header)) +
        "." +
        Utilities.base64EncodeWebSafe(JSON.stringify(claimSet));

      var signature = Utilities.computeRsaSha256Signature(toSign, key);
      var jwt = toSign + "." + Utilities.base64EncodeWebSafe(signature);

      var response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
        method: "post",
        contentType: "application/x-www-form-urlencoded",
        payload: {
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwt
        },
        muteHttpExceptions: true
      });

      var result = JSON.parse(response.getContentText());
      if (result.error) {
        throw new Error("Firebase auth failed (" + projectId + "): " + result.error_description);
      }

      token_ = result.access_token;
      tokenExpiry_ = now + result.expires_in;
      return token_;
    }

    function baseUrl_() {
      return "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents/";
    }

    function buildCollectionUrl_(collection, documentId) {
      return baseUrl_() + collection + "?documentId=" + encodeURIComponent(documentId);
    }

    function buildDocumentUrl_(collection, documentId) {
      return baseUrl_() + collection + "/" + encodeURIComponent(documentId);
    }

    function encodeValue_(val) {
      if (val === null || val === undefined) return { nullValue: null };
      if (val instanceof Date) return { timestampValue: val.toISOString() };
      if (Array.isArray(val)) {
        return { arrayValue: { values: val.map(function (item) { return encodeValue_(item); }) } };
      }
      if (typeof val === "object") return { mapValue: { fields: encodeFields_(val) } };
      if (typeof val === "number") {
        return Number.isInteger(val) ? { integerValue: val } : { doubleValue: val };
      }
      if (typeof val === "boolean") return { booleanValue: val };
      return { stringValue: String(val) };
    }

    function encodeFields_(obj) {
      var fields = {};
      for (var k in obj) {
        if (!obj.hasOwnProperty(k)) continue;
        fields[k] = encodeValue_(obj[k]);
      }
      return fields;
    }

    function decodeValue_(val) {
      if (val.stringValue !== undefined) return val.stringValue;
      if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
      if (val.doubleValue !== undefined) return val.doubleValue;
      if (val.booleanValue !== undefined) return val.booleanValue;
      if (val.timestampValue !== undefined) return new Date(val.timestampValue);
      if (val.nullValue !== undefined) return null;
      if (val.arrayValue) {
        return (val.arrayValue.values || []).map(function (v) { return decodeValue_(v); });
      }
      if (val.mapValue) return decodeFields_(val.mapValue.fields || {});
      return val;
    }

    function decodeFields_(fields) {
      var obj = {};
      for (var k in fields) {
        if (!fields.hasOwnProperty(k)) continue;
        obj[k] = decodeValue_(fields[k]);
      }
      return obj;
    }

    // ── Instance public API ────────────────────────────────────────────

    return {
      getProjectId: function () { return projectId; },
      getAccessToken: function () { return getAccessToken_(); },

      createDocument: function (collection, documentId, data) {
        var token = getAccessToken_();
        var url = buildCollectionUrl_(collection, documentId);
        var response = UrlFetchApp.fetch(url, {
          method: "post",
          contentType: "application/json",
          headers: { Authorization: "Bearer " + token },
          payload: JSON.stringify({ fields: encodeFields_(data) }),
          muteHttpExceptions: true
        });
        var code = response.getResponseCode();
        if (code === 200) return { success: true, exists: false, error: null };
        if (code === 409) return { success: false, exists: true, error: "Already exists" };
        return { success: false, exists: false, error: response.getContentText() };
      },

      batchCreateDocuments: function (collection, items) {
        if (!items.length) return [];
        var token = getAccessToken_();
        var requests = items.map(function (item) {
          return {
            url: buildCollectionUrl_(collection, item.documentId),
            method: "post",
            contentType: "application/json",
            headers: { Authorization: "Bearer " + token },
            payload: JSON.stringify({ fields: encodeFields_(item.data) }),
            muteHttpExceptions: true
          };
        });
        var responses = UrlFetchApp.fetchAll(requests);
        return responses.map(function (resp) {
          var code = resp.getResponseCode();
          if (code === 200) return { success: true, exists: false, error: null };
          if (code === 409) return { success: false, exists: true, error: "Already exists" };
          return { success: false, exists: false, error: resp.getContentText() };
        });
      },

      /**
       * Upisuje do 500 dokumenata u JEDAN HTTP poziv preko Firestore :batchWrite endpoint-a.
       * Drasticno stedi UrlFetch quota u poredjenju sa batchSetDocumentsRaw (1 call po dokumentu).
       *
       * @param {Array<{collection: string, documentId: string, fields: Object}>} items — max 500
       * @return {Array<{success: boolean, error: string|null}>}
       */
      batchWriteSets: function (items) {
        if (!items.length) return [];
        if (items.length > 500) {
          throw new Error("batchWriteSets supports max 500 items per call (got " + items.length + ")");
        }
        var token = getAccessToken_();
        var url = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents:batchWrite";

        var writes = items.map(function (item) {
          return {
            update: {
              name: "projects/" + projectId + "/databases/(default)/documents/" + item.collection + "/" + item.documentId,
              fields: item.fields
            }
          };
        });

        var response = UrlFetchApp.fetch(url, {
          method: "post",
          contentType: "application/json",
          headers: { Authorization: "Bearer " + token },
          payload: JSON.stringify({ writes: writes }),
          muteHttpExceptions: true
        });

        var code = response.getResponseCode();
        if (code !== 200) {
          var errText = response.getContentText();
          return items.map(function () {
            return { success: false, error: errText };
          });
        }

        var body = JSON.parse(response.getContentText());
        var statuses = body.status || [];
        return items.map(function (_, i) {
          var st = statuses[i] || {};
          var ok = !st.code || st.code === 0;
          return { success: ok, error: ok ? null : (st.message || JSON.stringify(st)) };
        });
      },

      /**
       * Paralelni upsert (PATCH) sa raw Firestore fields.
       * NAPOMENA: Trosi 1 UrlFetch call po dokumentu — za masovnu migraciju koristi batchWriteSets.
       * @param {Array<{collection: string, documentId: string, fields: Object}>} items
       * @return {Array<{success: boolean, error: string|null}>}
       */
      batchSetDocumentsRaw: function (items) {
        if (!items.length) return [];
        var token = getAccessToken_();
        var requests = items.map(function (item) {
          return {
            url: buildDocumentUrl_(item.collection, item.documentId),
            method: "patch",
            contentType: "application/json",
            headers: { Authorization: "Bearer " + token },
            payload: JSON.stringify({ fields: item.fields }),
            muteHttpExceptions: true
          };
        });
        var responses = UrlFetchApp.fetchAll(requests);
        return responses.map(function (resp) {
          var code = resp.getResponseCode();
          if (code === 200) return { success: true, error: null };
          return { success: false, error: resp.getContentText() };
        });
      },

      setDocument: function (collection, documentId, data) {
        var token = getAccessToken_();
        var url = buildDocumentUrl_(collection, documentId);
        var response = UrlFetchApp.fetch(url, {
          method: "patch",
          contentType: "application/json",
          headers: { Authorization: "Bearer " + token },
          payload: JSON.stringify({ fields: encodeFields_(data) }),
          muteHttpExceptions: true
        });
        var code = response.getResponseCode();
        if (code === 200) return { success: true, error: null };
        return { success: false, error: response.getContentText() };
      },

      /** Upisuje dokument sa vec enkodiranim Firestore fields (raw). */
      setDocumentRaw: function (collection, documentId, rawFields) {
        var token = getAccessToken_();
        var url = buildDocumentUrl_(collection, documentId);
        var response = UrlFetchApp.fetch(url, {
          method: "patch",
          contentType: "application/json",
          headers: { Authorization: "Bearer " + token },
          payload: JSON.stringify({ fields: rawFields }),
          muteHttpExceptions: true
        });
        var code = response.getResponseCode();
        if (code === 200) return { success: true, error: null };
        return { success: false, error: response.getContentText() };
      },

      getDocument: function (collection, documentId) {
        var token = getAccessToken_();
        var url = buildDocumentUrl_(collection, documentId);
        var response = UrlFetchApp.fetch(url, {
          method: "get",
          headers: { Authorization: "Bearer " + token },
          muteHttpExceptions: true
        });
        var code = response.getResponseCode();
        if (code === 200) {
          var doc = JSON.parse(response.getContentText());
          return { success: true, data: doc.fields ? decodeFields_(doc.fields) : {}, error: null };
        }
        if (code === 404) return { success: false, data: null, error: "Document not found" };
        return { success: false, data: null, error: response.getContentText() };
      },

      patchFields: function (collection, documentId, data) {
        var token = getAccessToken_();
        var url = buildDocumentUrl_(collection, documentId);
        var fieldPaths = Object.keys(data);
        var mask = fieldPaths
          .map(function (f) { return "updateMask.fieldPaths=" + encodeURIComponent(f); })
          .join("&");
        url += "?" + mask;
        var response = UrlFetchApp.fetch(url, {
          method: "patch",
          contentType: "application/json",
          headers: { Authorization: "Bearer " + token },
          payload: JSON.stringify({ fields: encodeFields_(data) }),
          muteHttpExceptions: true
        });
        var code = response.getResponseCode();
        if (code === 200) return { success: true, error: null };
        return { success: false, error: response.getContentText() };
      },

      /**
       * Paralelno lista dokumente iz vise kolekcija (jedna stranica po putanji).
       * Koristi UrlFetchApp.fetchAll — sve putanje se citaju paralelno.
       *
       * @param {string[]} paths — niz putanja do kolekcija
       * @param {number} [pageSize=300] — max dokumenata po putanji
       * @return {Array<{path: string, docs: Array<{id: string, fields: Object}>, nextPageToken: string|null, error: string|null}>}
       */
      batchListDocuments: function (paths, pageSize) {
        if (!paths.length) return [];
        var token = getAccessToken_();
        var size = pageSize || 300;
        var requests = paths.map(function (p) {
          // URL-enkoduj svaki segment putanje (npr. "Rezervni delovi" → "Rezervni%20delovi")
          var encoded = p.split("/").map(encodeURIComponent).join("/");
          return {
            url: baseUrl_() + encoded + "?pageSize=" + size,
            method: "get",
            headers: { Authorization: "Bearer " + token },
            muteHttpExceptions: true
          };
        });
        var responses = UrlFetchApp.fetchAll(requests);
        return responses.map(function (resp, i) {
          var code = resp.getResponseCode();
          if (code !== 200) {
            return { path: paths[i], docs: [], nextPageToken: null, error: resp.getContentText() };
          }
          var body = JSON.parse(resp.getContentText());
          var docs = (body.documents || []).map(function (doc) {
            var nameParts = doc.name.split("/");
            return { id: nameParts[nameParts.length - 1], fields: doc.fields || {} };
          });
          return { path: paths[i], docs: docs, nextPageToken: body.nextPageToken || null, error: null };
        });
      },

      /**
       * Lista dokumente iz kolekcije sa paginacijom.
       * @param {string} collection — putanja do kolekcije
       * @param {number} [pageSize] — max dokumenata (default: svi)
       * @return {Array<{id: string, fields: Object}>} — fields u raw Firestore formatu
       */
      listDocuments: function (collection, pageSize) {
        var token = getAccessToken_();
        var all = [];
        var nextPageToken = null;
        var limit = pageSize || 99999;

        do {
          var url = baseUrl_() + collection + "?pageSize=" + Math.min(limit - all.length, 300);
          if (nextPageToken) url += "&pageToken=" + encodeURIComponent(nextPageToken);

          var response = UrlFetchApp.fetch(url, {
            method: "get",
            headers: { Authorization: "Bearer " + token },
            muteHttpExceptions: true
          });

          var code = response.getResponseCode();
          if (code !== 200) throw new Error("listDocuments failed: " + response.getContentText());

          var body = JSON.parse(response.getContentText());
          if (body.documents) {
            body.documents.forEach(function (doc) {
              var nameParts = doc.name.split("/");
              all.push({ id: nameParts[nameParts.length - 1], fields: doc.fields || {} });
            });
          }
          nextPageToken = body.nextPageToken || null;
        } while (nextPageToken && all.length < limit);

        return all;
      },

      /**
       * Izvrsava Firestore StructuredQuery (server-side filter).
       * Naplacuje SAMO dokumente koji odgovaraju filteru, ne sve u kolekciji.
       *
       * @param {string} parent — putanja parent dokumenta (prazno za root)
       * @param {Object} structuredQuery — Firestore StructuredQuery objekat
       * @return {Array<{id: string, fields: Object}>}
       */
      runQuery: function (parent, structuredQuery) {
        var token = getAccessToken_();
        var url = baseUrl_().replace(/\/$/, "");
        if (parent) {
          url += "/" + parent.split("/").map(encodeURIComponent).join("/");
        }
        url += ":runQuery";

        var response = UrlFetchApp.fetch(url, {
          method: "post",
          contentType: "application/json",
          headers: { Authorization: "Bearer " + token },
          payload: JSON.stringify({ structuredQuery: structuredQuery }),
          muteHttpExceptions: true
        });

        var code = response.getResponseCode();
        if (code !== 200) throw new Error("runQuery failed: " + response.getContentText());

        var body = JSON.parse(response.getContentText());
        var results = [];
        for (var i = 0; i < body.length; i++) {
          var item = body[i];
          if (item.document) {
            var nameParts = item.document.name.split("/");
            results.push({ id: nameParts[nameParts.length - 1], fields: item.document.fields || {} });
          }
        }
        return results;
      },

      /**
       * Vraca puni Firestore reference path za dokument (za startAt/startAfter cursor).
       * @param {string} collection — putanja kolekcije
       * @param {string} documentId
       * @return {string}
       */
      buildReferencePath: function (collection, documentId) {
        return "projects/" + projectId + "/databases/(default)/documents/" + collection + "/" + documentId;
      },

      /**
       * Lista subkolekcije dokumenta.
       * @param {string} documentPath — puna putanja (npr. "tenants/xyz/devices/ABC123")
       * @return {string[]}
       */
      listCollectionIds: function (documentPath) {
        var token = getAccessToken_();
        var url = baseUrl_() + documentPath + ":listCollectionIds";
        var response = UrlFetchApp.fetch(url, {
          method: "post",
          contentType: "application/json",
          headers: { Authorization: "Bearer " + token },
          payload: JSON.stringify({}),
          muteHttpExceptions: true
        });
        var code = response.getResponseCode();
        if (code !== 200) throw new Error("listCollectionIds failed: " + response.getContentText());
        var body = JSON.parse(response.getContentText());
        return body.collectionIds || [];
      },

      /** Dekodira Firestore raw fields u JS objekat. */
      decodeFields: function (fields) { return decodeFields_(fields); },

      /** Enkodira JS objekat u Firestore raw fields. */
      encodeFields: function (data) { return encodeFields_(data); }
    };
  }

  // ── Cached instances ──────────────────────────────────────────────────

  var prod_ = null;
  var test_ = null;
  var old_ = null;
  var mk_ = null;

  // ── Module public API ────────────────────────────────────────────────

  return {
    /** Kreira instancu vezanu za konkretan Firebase projekat. */
    forProject: function (projectId, email, key) {
      return createInstance_(projectId, email, key);
    },

    /** Vraca instancu za prod bazu (ariston-srb). Kesira se. */
    prod: function () {
      if (!prod_) {
        prod_ = createInstance_(Config.getProdProjectId(), Config.getProdEmail(), Config.getProdKey());
      }
      return prod_;
    },

    /** Vraca instancu za test bazu (aristonboilersmk-af027). Kesira se. */
    test: function () {
      if (!test_) {
        test_ = createInstance_(Config.getTestProjectId(), Config.getTestEmail(), Config.getTestKey());
      }
      return test_;
    },

    /** Vraca instancu za staru bazu (za migracije). Kesira se. */
    old: function () {
      if (!old_) {
        old_ = createInstance_(Config.getOldProjectId(), Config.getOldEmail(), Config.getOldKey());
      }
      return old_;
    },

    /** Vraca instancu za MK bazu. Kesira se. */
    mk: function () {
      if (!mk_) {
        mk_ = createInstance_(Config.getMkProjectId(), Config.getMkEmail(), Config.getMkKey());
      }
      return mk_;
    }
  };
})();
