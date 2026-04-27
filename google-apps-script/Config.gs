/**
 * Config.gs
 * Centralizovana konfiguracija — cita kredencijale iz Script Properties.
 *
 * Setup (jednom):
 *   1. Open Google Apps Script editor
 *   2. Project Settings > Script Properties
 *   3. Dodaj sledece property-je:
 *
 *      Prod baza (ariston-srb):
 *        - PROD_PROJECT_ID
 *        - PROD_SERVICE_EMAIL
 *        - PROD_PRIVATE_KEY  (ceo PEM string, ukljucujuci -----BEGIN/END-----)
 *
 *      Test baza (aristonboilersmk-af027):
 *        - TEST_PROJECT_ID
 *        - TEST_SERVICE_EMAIL
 *        - TEST_PRIVATE_KEY
 */

var Config = (function () {
  var props_ = null;

  function getProps_() {
    if (!props_) {
      props_ = PropertiesService.getScriptProperties();
    }
    return props_;
  }

  function getKey_(propName) {
    var key = getProps_().getProperty(propName);
    return key ? key.replace(/\\n/g, "\n") : null;
  }

  return {
    // ── Prod projekat (ariston-srb) ──────────────────────────────────
    getProdProjectId: function () { return getProps_().getProperty("PROD_PROJECT_ID"); },
    getProdEmail: function () { return getProps_().getProperty("PROD_SERVICE_EMAIL"); },
    getProdKey: function () { return getKey_("PROD_PRIVATE_KEY"); },

    // ── Test projekat (aristonboilersmk-af027) ───────────────────────
    getTestProjectId: function () { return getProps_().getProperty("TEST_PROJECT_ID"); },
    getTestEmail: function () { return getProps_().getProperty("TEST_SERVICE_EMAIL"); },
    getTestKey: function () { return getKey_("TEST_PRIVATE_KEY"); },

    /** Kolekcija u koju se upisuju odobreni SN-ovi */
    APPROVED_DEVICES_COLLECTION: "approvedLoyaltyDevices",

    /** Kolekcija u koju se upisuju odobreni secret kodovi */
    APPROVED_CHECK_CODES_COLLECTION: "approvedCheckCodes",

    /** Maksimalan broj paralelnih HTTP poziva u jednom fetchAll batch-u */
    BATCH_SIZE: 500
  };
})();
