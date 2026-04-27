/**
 * FirebaseAuthService.gs
 * Komunikacija sa Firebase Auth (Identity Toolkit) REST API.
 * Koristi service account JWT sa identitytoolkit scopeom.
 */

var FirebaseAuthService = (function () {
  var token_ = null;
  var tokenExpiry_ = 0;

  function getAccessToken_() {
    var now = Math.floor(Date.now() / 1000);
    if (token_ && now < tokenExpiry_ - 60) {
      return token_;
    }

    var email = Config.getProdEmail();
    var key = Config.getProdKey();

    var header = { alg: "RS256", typ: "JWT" };
    var claimSet = {
      iss: email,
      scope: "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase",
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
      throw new Error("Firebase Auth auth failed: " + result.error_description);
    }

    token_ = result.access_token;
    tokenExpiry_ = now + result.expires_in;
    return token_;
  }

  function getBaseUrl_() {
    var projectId = Config.getProdProjectId();
    return "https://identitytoolkit.googleapis.com/v1/projects/" + projectId;
  }

  return {
    /**
     * Vraca informacije o korisniku po UID-u.
     */
    lookupUser: function (uid) {
      var token = getAccessToken_();
      var url = getBaseUrl_() + "/accounts:lookup";

      var response = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + token },
        payload: JSON.stringify({ localId: [uid] }),
        muteHttpExceptions: true
      });

      var code = response.getResponseCode();
      var body = JSON.parse(response.getContentText());

      if (code !== 200) {
        throw new Error("Lookup failed: " + response.getContentText());
      }

      if (!body.users || body.users.length === 0) {
        throw new Error("Korisnik sa UID '" + uid + "' nije pronadjen.");
      }

      return body.users[0];
    },

    /**
     * Postavlja custom attributes (claims) na korisnika.
     * Firebase ogranicenje: customAttributes max 1000 bajtova.
     */
    setCustomAttributes: function (uid, claims) {
      var token = getAccessToken_();
      var url = getBaseUrl_() + "/accounts:update";

      var customAttributes = JSON.stringify(claims);
      if (customAttributes.length > 1000) {
        return {
          success: false,
          error: "Custom claims prelaze Firebase limit od 1000 bajtova (" + customAttributes.length + " B)"
        };
      }

      var response = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + token },
        payload: JSON.stringify({
          localId: uid,
          customAttributes: customAttributes
        }),
        muteHttpExceptions: true
      });

      var code = response.getResponseCode();
      if (code === 200) {
        return { success: true, error: null };
      }

      return { success: false, error: response.getContentText() };
    },

    /**
     * Cita custom claims sa korisnika.
     */
    getCustomAttributes: function (uid) {
      var user = this.lookupUser(uid);
      if (user.customAttributes) {
        return JSON.parse(user.customAttributes);
      }
      return {};
    }
  };
})();
