/**
 * FirebaseService.gs
 * Direktna komunikacija sa Firestore REST API.
 *
 * Koriscenje:
 *   - FirebaseService.prod()  — instanca za produkcionu bazu (ariston-srb)
 *   - FirebaseService.test()  — instanca za test bazu (aristonboilersmk-af027)
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
      decodeFields: function (fields) { return decodeFields_(fields); }
    };
  }

  // ── Cached instances ──────────────────────────────────────────────────

  var prod_ = null;
  var test_ = null;

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
    }
  };
})();
