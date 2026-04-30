/**
 * AccountCreationDates.gs
 * Za listu hardkodovanih email adresa dovlaci datum kreiranja naloga
 * iz Firebase Auth-a.
 *
 * Pokretanje: pozovi getAccountCreationDates() iz Apps Script editora.
 */

var EMAILS = [
  "primer1@gmail.com",
  "primer2@gmail.com"
];

function getAccountCreationDates() {
  var projectId = Config.getProdProjectId();
  var url = "https://identitytoolkit.googleapis.com/v1/projects/" + projectId + "/accounts:lookup";

  // Koristimo FirebaseAuthService token (ima identitytoolkit scope)
  var email = Config.getProdEmail();
  var key = Config.getProdKey();
  var token = getAuthToken_(email, key);

  Logger.log("=== Datum kreiranja naloga ===");
  Logger.log("");

  for (var i = 0; i < EMAILS.length; i++) {
    var target = EMAILS[i].trim().toLowerCase();

    var response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + token },
      payload: JSON.stringify({ email: [target] }),
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    if (code !== 200) {
      Logger.log((i + 1) + ". " + target + " — GRESKA: " + response.getContentText());
      continue;
    }

    var body = JSON.parse(response.getContentText());
    if (!body.users || body.users.length === 0) {
      Logger.log((i + 1) + ". " + target + " — nalog ne postoji");
      continue;
    }

    var user = body.users[0];
    var createdAt = user.createdAt ? new Date(parseInt(user.createdAt, 10)) : null;
    var dateStr = createdAt
      ? createdAt.getDate() + "." + (createdAt.getMonth() + 1) + "." + createdAt.getFullYear()
      : "nepoznat";

    Logger.log((i + 1) + ". " + target + " — kreiran: " + dateStr);

    if (i < EMAILS.length - 1) Utilities.sleep(500);
  }
}

function getAuthToken_(email, key) {
  var now = Math.floor(Date.now() / 1000);
  var header = { alg: "RS256", typ: "JWT" };
  var claimSet = {
    iss: email,
    scope: "https://www.googleapis.com/auth/identitytoolkit",
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
  if (result.error) throw new Error("Auth failed: " + result.error_description);
  return result.access_token;
}
