/**
 * CreateServicerAccounts.gs
 *
 * Kreira Firebase Auth naloge za servisere (email + password) i postavlja custom claims:
 *   tenantId: "arst-srb"
 *   role: "servicer"
 *   approved: true
 *   deviceTypes: [...]  ← razlikuje se po nalogu
 *
 * Idempotentno: ako email vec postoji, samo se osvezavaju custom claims.
 *
 * Pokretanje: pozovi createServicerAccounts() iz Apps Script editora.
 *
 * Trosak po nalogu: 1-2 HTTP poziva (createUser, eventualno lookup) + 1 setCustomAttributes.
 *
 * Ako pukne timeout (Apps Script ima 6 min limit), postavi START_INDEX na poziciju
 * gde je stalo (loguje se posle svake stavke) i pokreni ponovo.
 *
 * VAZNO: NE cuvaj prave lozinke u ovom fajlu pod verzionisanjem. Popuni
 * SERVICER_ACCOUNTS listu lokalno pre pokretanja i ne commit-uj prave kredencijale.
 */

// ── Konstante za deviceType pakete ───────────────────────────────────────
var DTYPES_ALL = ["heat-pump", "gas-boiler", "boiler"];
var DTYPES_BOILER = ["boiler"];
var DTYPES_HEAT_GAS = ["heat-pump", "gas-boiler"];
var DTYPES_NONE = [];

// ── Lista naloga (email, password, deviceTypes) ───────────────────────────
// Popuni listu lokalno pre pokretanja. Po jedan objekat po nalogu.
// deviceTypes opcije: DTYPES_ALL | DTYPES_BOILER | DTYPES_HEAT_GAS | DTYPES_NONE
var SERVICER_ACCOUNTS = [
  { email: "primer@example.com", password: "PROMENI_ME", deviceTypes: DTYPES_ALL },
];

// ── Glavni run ───────────────────────────────────────────────────────────

function createServicerAccounts() {
  // Resume — preskoci prvih N stavki ako je prethodni run pukao na pola.
  var START_INDEX = 0;
  // Max za jedan run (0 = bez limita). Ako Apps Script timeout-uje, smanji.
  var LIMIT = 0;

  var TENANT_ID = "arst-srb";
  var ROLE = "servicer";

  var endIndex = LIMIT > 0 ? Math.min(SERVICER_ACCOUNTS.length, START_INDEX + LIMIT) : SERVICER_ACCOUNTS.length;
  Logger.log(
    "Procesujem [" + START_INDEX + ".." + (endIndex - 1) + "] = " + (endIndex - START_INDEX) +
    " naloga (ukupno u listi: " + SERVICER_ACCOUNTS.length + ")"
  );

  var created = 0;
  var existed = 0;
  var claimsUpdated = 0;
  var errors = 0;

  for (var i = START_INDEX; i < endIndex; i++) {
    var acc = SERVICER_ACCOUNTS[i];
    var label = "[" + (i + 1) + "/" + SERVICER_ACCOUNTS.length + "] " + acc.email;

    // 1) Kreiraj nalog (ili reuse ako vec postoji)
    var uid = null;
    var createRes = FirebaseAuthService.createUser(acc.email, acc.password);

    if (createRes.success) {
      uid = createRes.uid;
      created++;
      Logger.log(label + " ✓ kreiran (uid=" + uid + ")");
    } else if (createRes.alreadyExists) {
      try {
        var existing = FirebaseAuthService.lookupUserByEmail(acc.email);
        if (!existing) {
          errors++;
          Logger.log(label + " GRESKA: EMAIL_EXISTS ali lookup vraca null");
          continue;
        }
        uid = existing.localId;
        existed++;
        Logger.log(label + " ⚠ vec postoji (uid=" + uid + ")");
      } catch (e) {
        errors++;
        Logger.log(label + " GRESKA pri lookup: " + e.message);
        continue;
      }
    } else {
      errors++;
      Logger.log(label + " GRESKA pri createUser: " + createRes.error);
      continue;
    }

    // 2) Postavi custom claims
    var claims = {
      tenantId: TENANT_ID,
      role: ROLE,
      approved: true,
      deviceTypes: acc.deviceTypes
    };
    var claimsRes = FirebaseAuthService.setCustomAttributes(uid, claims);
    if (claimsRes.success) {
      claimsUpdated++;
    } else {
      errors++;
      Logger.log(label + " GRESKA pri setCustomAttributes: " + claimsRes.error);
    }
  }

  Logger.log(
    "Zavrseno. Kreirano: " + created +
    ", vec postojalo: " + existed +
    ", claims updateovani: " + claimsUpdated +
    ", gresaka: " + errors
  );
}
