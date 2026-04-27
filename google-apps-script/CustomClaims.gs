/**
 * CustomClaims.gs
 * Funkcije za upravljanje Firebase Auth custom claimovima.
 */

function setCustomClaims() {
  var uid = "iGJWapDcLUSR7XcptqHhfbyG4lt1";

  var claims = {
    tenantId: "arst1",
    role: "servicer",
    approved:true,
    deviceTypes: ["gas-boiler"]
  };

  if (!uid) {
    Logger.log("UID je obavezan.");
    return;
  }

  var existing = FirebaseAuthService.getCustomAttributes(uid);

  var merged = {};
  for (var key in existing) {
    if (existing.hasOwnProperty(key)) {
      merged[key] = existing[key];
    }
  }
  for (var key in claims) {
    if (claims.hasOwnProperty(key)) {
      if (claims[key] === null) {
        delete merged[key];
      } else {
        merged[key] = claims[key];
      }
    }
  }

  var result = FirebaseAuthService.setCustomAttributes(uid, merged);

  if (result.success) {
    Logger.log("Claims postavljeni: " + JSON.stringify(merged));
  } else {
    Logger.log("Greska: " + result.error);
  }
}

function getCustomClaims() {
  var uid = "iGJWapDcLUSR7XcptqHhfbyG4lt1";

  if (!uid) {
    Logger.log("UID je obavezan.");
    return;
  }

  try {
    var user = FirebaseAuthService.lookupUser(uid);
    var claims = user.customAttributes ? JSON.parse(user.customAttributes) : {};

    Logger.log("Email: " + (user.email || "nema"));
    Logger.log("Claims: " + JSON.stringify(claims, null, 2));
  } catch (e) {
    Logger.log("Greska: " + e.message);
  }
}
