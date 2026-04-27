/**
 * Utils.gs
 * Zajednicke helper funkcije za rad sa sheet-om.
 */

const STATUS_UPLOADING = "⏳ Uploading...";
const STATUS_SYNCED = "Synced";
const STATUS_ERROR_PREFIX = "Error: ";

/**
 * Proverava da li je red vec uspesno sincronizovan.
 * @param {string} colB — vrednost iz kolone B
 * @return {boolean}
 */
function isSynced(colB) {
  return colB === STATUS_SYNCED;
}

/**
 * Upisuje "Uploading..." status u kolonu B datog reda.
 * @param {Sheet} sheet
 * @param {number} row  — 1-based row number
 */
function setUploading(sheet, row) {
  var cell = sheet.getRange(row, 2);
  cell.setValue(STATUS_UPLOADING);
  cell.setFontColor("#666666");
}

/**
 * Upisuje error poruku u kolonu B datog reda, obojen crveno.
 * @param {Sheet} sheet
 * @param {number} row  — 1-based row number
 * @param {string} message
 */
function setError(sheet, row, message) {
  var cell = sheet.getRange(row, 2);
  cell.setValue(STATUS_ERROR_PREFIX + message);
  cell.setFontColor("#cc0000");
}

/**
 * Upisuje "Synced" status u kolonu B i SN u kolonu C.
 * @param {Sheet} sheet
 * @param {number} row  — 1-based row number
 * @param {string} sn
 */
function setSynced(sheet, row, sn) {
  var cell = sheet.getRange(row, 2);
  cell.setValue(STATUS_SYNCED);
  cell.setFontColor("#000000");
  sheet.getRange(row, 3).setValue(sn);
}
