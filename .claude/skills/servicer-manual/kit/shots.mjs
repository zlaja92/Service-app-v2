// Automatski snima ekrane mobilne app (iPhone 15 Pro širina, viša visina, iOS izgled) iz lokalnog `ng serve`.
// Upotreba: node shots.mjs <brand.json> <dataDir> <outDir> [blok]
// Blokovi: login home device adduser intervention usersearch catalog report docs  (bez bloka = svi redom)
// Pre pokretanja: emulatori rade, seed.mjs urađen, repo.sh apply, `npx ng serve --configuration production --port 8100 --host 127.0.0.1`.
// VAŽNO: posle blokova adduser/intervention podaci su izmenjeni → za ceo ponovni prolaz prvo ponovo seed.mjs.
import { chromium, devices } from "playwright-core";
import fs from "node:fs"; import path from "node:path";

const [brandFile, dataDir, OUT, only] = process.argv.slice(2);
const brand = JSON.parse(fs.readFileSync(brandFile, "utf8"));
const config = JSON.parse(fs.readFileSync(path.join(dataDir, "config.json"), "utf8"));
const F = brand.demo.flows; const S = brand.demo.servicer;
const isSplit = config.business?.snType === "split";
const isMode2 = config.business?.appMode === "mode2";
const feat = (k, def = false) => config.features?.[k] ?? def;
fs.mkdirSync(OUT, { recursive: true });

// Ionic: iOS izgled; isključen scrollAssist/inputShims (inače se forma "pomeri" i vrh ne može da se snimi)
const Q = "?ionic:mode=ios&ionic:scrollAssist=false&ionic:inputShims=false&ionic:hideCaretOnScroll=false";
const BASE = "http://127.0.0.1:8100";
const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ ...devices["iPhone 15 Pro"], viewport: { width: 393, height: 1060 }, locale: "sr-RS", timezoneId: "Europe/Belgrade" });
const p = await ctx.newPage();
p.on("console", (m) => { if (m.type() === "error" && !/404/.test(m.text())) console.log("  [console]", m.text().slice(0, 160)); });

const shot = async (name) => {
  await p.waitForTimeout(700);
  await p.evaluate(() => document.querySelectorAll("#firebase-emulator-warning, .firebase-emulator-warning").forEach((e) => e.remove()));
  await p.screenshot({ path: `${OUT}/${name}.png` }); console.log("✓", name);
};
const run = (name) => !only || only === name;
// Ionic drži prethodne stranice u DOM-u (skrivene) → uvek ciljaj :visible
const btn = (label) => p.locator("ion-button:visible", { hasText: label }).first();
const item = (text) => p.locator("ion-item:visible", { hasText: text }).first();
const scrollAllTop = () => p.evaluate(async () => {
  window.scrollTo(0, 0);
  for (const el of document.querySelectorAll("*")) if (el.scrollTop) el.scrollTop = 0;
  for (const c of document.querySelectorAll("ion-content")) { const se = await c.getScrollElement(); se.scrollTop = 0; }
});
const scrollBottom = () => p.locator("ion-content:visible").last().evaluate(async (c) => { const el = await c.getScrollElement(); el.scrollTop = el.scrollHeight; });
const pickAction = async (select, optionText, shotName) => {
  await select.click();
  const sheet = p.locator("ion-action-sheet").last();
  await sheet.waitFor(); await p.waitForTimeout(500);
  if (shotName) await shot(shotName);
  await sheet.locator("button", { hasText: optionText }).first().click();
  await p.waitForTimeout(500);
};
const SN_CODE = 'input[placeholder="npr. 700278/01"]', SN_SER = 'input[placeholder="0123456789"]', SN_SINGLE = 'input[placeholder="Unesite serijski broj uređaja"]';
const enterSn = async ({ code, ser }) => {
  if (isSplit) { await p.locator(SN_CODE).fill(code); await p.locator(SN_SER).fill(ser); }
  else await p.locator(SN_SINGLE).fill((code ? code.replace("/", "") : "") + ser);
  await p.waitForTimeout(300);
};
const home = async () => {
  // NE koristiti waitUntil:"networkidle" — veza ka Firestore emulatoru je stalno otvorena
  await p.goto(`${BASE}/home${Q}`, { waitUntil: "domcontentloaded" });
  await p.locator(isSplit ? SN_CODE : SN_SINGLE).waitFor({ timeout: 20000 }); await p.waitForTimeout(1500);
};
const openDevice = async (sn) => { await home(); await enterSn(sn); await btn("Pretraži").click(); await p.waitForURL(/device-management/); await p.waitForTimeout(2500); };
const login = async () => {
  await p.goto(`${BASE}/${Q}`, { waitUntil: "networkidle" });
  await p.locator("input[type=email]").fill(S.email);
  await p.locator("input[type=password]").fill(S.password);
  await p.locator("form ion-button").click();
  await p.waitForURL(/home/, { timeout: 20000 }); await p.waitForTimeout(2500);
};

if (run("login")) {
  await p.goto(`${BASE}/${Q}`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
  await shot("m01-login");
  await p.locator("input[type=email]").fill(S.email);
  await p.locator("input[type=password]").fill("pogresna-lozinka");
  await p.locator("form ion-button").click(); await p.waitForTimeout(2500);
  await shot("m02-login-error");
}
await login();

if (run("home")) {
  await shot("m03-home");
  await enterSn(F.homeExample); await shot("m04-home-filled");
  await p.locator("ion-menu-button").first().click(); await p.waitForTimeout(900);
  await shot("m05-menu");
  await p.locator("ion-menu").first().evaluate((m) => m.close()); await p.waitForTimeout(600);
  await enterSn(F.notFound); await btn("Pretraži").click(); await p.waitForTimeout(1200);
  await shot("m06-sn-not-found");
}

if (run("device")) {
  await openDevice(F.historyDevice);
  await shot("m10-device");
  await btn("Istorija").click(); await p.waitForURL(/history/); await p.waitForTimeout(2000);
  await shot("m12-history");
  await item(F.historyDevice.openRowDate).click(); await p.waitForURL(/history\/.+/); await p.waitForTimeout(2000);
  await shot("m13-int-detail");
  await scrollBottom(); await shot("m14-int-detail-bottom");
}

if (run("adduser")) {
  const c = F.newCustomer;
  await openDevice(c);
  await shot("m20-device-unregistered");
  await btn("Dodaj korisnika").click(); await p.waitForURL(/add-user/); await p.waitForTimeout(1500);
  for (const k of ["firstName", "lastName", "streetName", "homeNumber", "city", "postCode", "phoneNumber"]) await p.locator(`ion-input[formcontrolname=${k}] input`).fill(c[k]);
  await pickAction(p.locator("ion-select[formcontrolname=warrantyStatus]"), c.warrantyOption, "m21-adduser-warranty-sheet");
  const dop = p.locator("ion-input[formcontrolname=dateOfPurchase] input");
  if (await dop.count()) await dop.fill(c.purchaseDate);
  await p.evaluate(() => document.activeElement?.blur()); await scrollAllTop();
  await shot("m22-adduser-form");
  await btn("Sačuvaj").click(); await p.locator("ion-alert").waitFor(); await p.waitForTimeout(500);
  await shot("m23-adduser-confirm");
  await p.locator("ion-alert button", { hasText: "Sačuvaj" }).click(); await p.waitForTimeout(1500);
  await shot("m24-adduser-saved");
}

if (run("intervention")) {
  const it = F.intervention;
  await openDevice(it);
  await btn("Intervencija").click(); await p.waitForURL(/intervention/); await p.waitForTimeout(1500);
  await shot("m30-intervention-empty");
  await pickAction(p.locator("ion-select[formcontrolname=warrantyStatus]"), it.warrantyOption, "m31-int-warranty-sheet");
  if (isMode2) {
    await pickAction(p.locator("ion-select[formcontrolname=interventionFault]"), it.faultOption, "m32-int-fault-sheet");
    await pickAction(p.locator("ion-select[formcontrolname=interventionLocation]"), it.locationOption);
    await pickAction(p.locator("ion-select[formcontrolname=visits]"), it.visits);
    await p.locator("ion-textarea[formcontrolname=faultDescription] textarea").fill(it.faultDescription);
    await p.locator("ion-textarea[formcontrolname=workDescription] textarea").fill(it.workDescription);
  } else {
    // NETESTIRANO na stvarnom brendu — proveri selektore i tekstove opcija (vidi reference/screens.md, odeljak 11)
    if (it.typeOption) await pickAction(p.locator("ion-select[formcontrolname=interventionType]"), it.typeOption);
    await pickAction(p.locator("ion-select[formcontrolname=interventionFault]"), it.faultOption, "m32-int-fault-sheet");
    if (it.errorOption) await pickAction(p.locator("ion-select[formcontrolname=error]"), it.errorOption);
    if (it.note) await p.locator("ion-textarea[formcontrolname=note] textarea").fill(it.note);
  }
  await p.locator("ion-input[formcontrolname=distance] input").fill(it.distance);
  const partInputs = p.locator("ion-input[maxlength='21'] input:visible");
  for (let i = 0; i < it.parts.length; i++) {
    if (i > 0) { await p.locator(".part-button:visible").last().click(); await p.waitForTimeout(300); }
    await partInputs.nth(i).fill(it.parts[i]);
  }
  await p.evaluate(() => document.activeElement?.blur()); await p.waitForTimeout(300);
  await scrollAllTop(); await shot("m33-int-form-top");
  await scrollBottom(); await shot("m35-int-form-bottom");
  await btn("Sačuvaj").click(); await p.locator("ion-alert").waitFor(); await p.waitForTimeout(500);
  await shot("m36-int-confirm");
  await p.locator("ion-alert button", { hasText: "Sačuvaj" }).click(); await p.waitForTimeout(2500);
  await shot("m37-int-saved");
}

if (run("usersearch") && feat("deviceManagement", true)) {
  await home(); await btn("Pretraži po korisniku").click(); await p.waitForURL(/search-by-user/); await p.waitForTimeout(1200);
  await p.locator('input[placeholder="Unesite ime"]').fill(F.userSearchName);
  await btn("Pretraži").click(); await p.waitForTimeout(2000);
  await shot("m40-user-search");
}

if (run("catalog") && feat("deviceCatalog", true)) {
  const C = brand.catalog;
  await home(); await btn("Pretraži po nazivu uređaja").click(); await p.waitForURL(/search-by-device/); await p.waitForTimeout(1200);
  await p.locator('input[placeholder="Unesite naziv ili kod uređaja"]').fill(C.searchTerm); await p.waitForTimeout(2000);
  await shot("m50-catalog-search");
  await item(C.searchResultModelName).click(); await p.waitForURL(/device-groups/); await p.waitForTimeout(1500);
  await shot("m51-groups");
  await p.locator("ion-item[button]:visible").first().click(); await p.waitForURL(/device-parts/); await p.waitForTimeout(2500);
  await shot("m52-parts");
  // Spisak delova prikazuje "<redni broj> - <naziv>", ne šifru → biraj po NAZIVU
  await item(C.partNameToOpen).click(); await p.locator("ion-modal").waitFor(); await p.waitForTimeout(1500);
  await shot("m53-part-detail");
  if (feat("cart")) {
    await p.locator("ion-modal ion-button", { hasText: "Dodaj u korpu" }).click(); await p.waitForTimeout(800);
    if (C.secondPartName) {
      await item(C.secondPartName).click(); await p.locator("ion-modal").last().waitFor(); await p.waitForTimeout(1200);
      await p.locator("ion-modal ion-button", { hasText: "Dodaj u korpu" }).last().click(); await p.waitForTimeout(800);
    }
    await shot("m54-parts-cart-badge");
    await p.locator("ion-header ion-button:visible").last().click(); await p.waitForURL(/cart/); await p.waitForTimeout(1500);
    await shot("m55-cart");
  }
}

if (run("report") && feat("servicerReport")) {
  await home();
  await p.locator("ion-menu-button").first().click(); await p.waitForTimeout(800);
  await p.locator("ion-menu ion-item", { hasText: "Moje intervencije" }).click(); await p.waitForURL(/servicer-report/); await p.waitForTimeout(1500);
  await shot("m60-report-empty");
  await btn("Pretraži").click(); await p.waitForTimeout(2500);
  await shot("m61-report-results");
}

if (run("docs") && feat("documentation")) {
  await home(); await btn("Dokumentacija").click(); await p.waitForURL(/docs/); await p.waitForTimeout(2500);
  await shot("m70-docs");
  if (F.docsFolderToOpen) { await item(F.docsFolderToOpen).click(); await p.waitForTimeout(2000); await shot("m71-docs-folder"); }
}

await b.close();
