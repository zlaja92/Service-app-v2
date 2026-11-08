// SAMO ČITANJE iz produkcije (Firestore REST + GCS JSON API) preko naloga ulogovanog u Firebase CLI.
// Nikad ne upisuje u produkciju. Ne čita lične podatke (users, intervencije) — samo podešavanja i katalog.
//
// Upotreba:
//   node prod-read.cjs <brand.json> <dataDir> export        → config, katalog, cene, crteži, dokumenti, logo
//   node prod-read.cjs <brand.json> <dataDir> config        → samo settings/config + version (za brzu proveru funkcija)
//   node prod-read.cjs <brand.json> <dataDir> models        → spisak svih modela (devices) sa tipom
//   node prod-read.cjs <brand.json> <dataDir> rules         → objavljena Firestore/Storage pravila (za info)
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const [brandFile, dataDir, cmd = "export"] = process.argv.slice(2);
if (!brandFile || !dataDir) { console.error("upotreba: node prod-read.cjs <brand.json> <dataDir> [export|config|models|rules]"); process.exit(1); }
const brand = JSON.parse(fs.readFileSync(brandFile, "utf8"));
fs.mkdirSync(dataDir, { recursive: true });

const FT = path.join(execSync("npm root -g").toString().trim(), "firebase-tools");
const conv = (v) => v.mapValue ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, conv(x)]))
  : v.arrayValue ? (v.arrayValue.values || []).map(conv)
  : v.integerValue !== undefined ? Number(v.integerValue)
  : v.doubleValue ?? v.booleanValue ?? v.stringValue ?? v.timestampValue ?? (v.nullValue !== undefined ? null : v.referenceValue ?? null);
const fields = (d) => Object.fromEntries(Object.entries(d.fields || {}).map(([k, x]) => [k, conv(x)]));
const save = (name, obj) => { fs.writeFileSync(path.join(dataDir, name), JSON.stringify(obj, null, 1)); console.log("  ✓", name); };

(async () => {
  const auth = require(FT + "/lib/auth");
  const acct = auth.getGlobalDefaultAccount();
  if (!acct?.tokens?.refresh_token) throw new Error("Firebase CLI nije ulogovan (firebase login).");
  console.log("CLI nalog:", acct.user?.email);
  const t = await auth.getAccessToken(acct.tokens.refresh_token, []);
  const H = { Authorization: "Bearer " + (t.access_token ?? t) };
  const FS = `https://firestore.googleapis.com/v1/projects/${brand.firebaseProject}/databases/(default)/documents/tenants/${brand.tenantId}/`;
  const GCS = `https://storage.googleapis.com/storage/v1/b/${brand.storageBucket}/o`;
  const getDoc = async (p) => { const j = await (await fetch(FS + p, { headers: H })).json(); if (j.error) throw new Error(`${p}: ${j.error.message}`); return fields(j); };
  const getCol = async (p) => {
    const out = []; let token = "";
    do {
      const j = await (await fetch(`${FS}${p}?pageSize=300${token ? "&pageToken=" + token : ""}`, { headers: H })).json();
      if (j.error) throw new Error(`${p}: ${j.error.message}`);
      for (const d of j.documents || []) out.push({ id: decodeURIComponent(d.name.split("/").pop()), ...fields(d) });
      token = j.nextPageToken || "";
    } while (token);
    return out;
  };
  const download = async (name) => {
    const r = await fetch(`${GCS}/${encodeURIComponent(name)}?alt=media`, { headers: H });
    if (!r.ok) { console.log("  ! nije preuzeto:", name, r.status); return; }
    const file = path.join(dataDir, "storage", name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    console.log("  ✓ storage/" + name);
  };

  if (cmd === "rules") {
    const R = `https://firebaserules.googleapis.com/v1/projects/${brand.firebaseProject}`;
    for (const [name, rel] of [["firestore", "cloud.firestore"], ["storage", `firebase.storage/${brand.storageBucket}`]]) {
      const r = await (await fetch(`${R}/releases/${rel}`, { headers: H })).json();
      if (!r.rulesetName) { console.log(name, "— nema objavljenih pravila / nema pristupa"); continue; }
      const rs = await (await fetch(`https://firebaserules.googleapis.com/v1/${r.rulesetName}`, { headers: H })).json();
      fs.writeFileSync(path.join(dataDir, `live-${name}.rules`), rs.source.files.map((f) => f.content).join("\n"));
      console.log("  ✓", `live-${name}.rules`, r.updateTime);
    }
    return;
  }

  console.log("Podešavanja…");
  save("config.json", await getDoc("settings/config"));
  try { save("version.json", await getDoc("settings/version")); } catch { save("version.json", { version: 1 }); }
  if (cmd === "config") return;

  console.log("Modeli…");
  const devices = await getCol("devices");
  save("devices.json", devices);
  const byType = devices.reduce((a, d) => ((a[d.deviceType] = (a[d.deviceType] || 0) + 1), a), {});
  console.log("  tipovi:", JSON.stringify(byType));
  if (cmd === "models") { for (const d of devices) console.log(`  ${d.id}\t${d.deviceType}\t${d.deviceName}\tcommissioning=${d.commissioning} annual=${d.annualService} connected=${d.connectedDevice}`); return; }

  console.log("Katalog za modele:", brand.catalog.models.join(", "));
  const catalog = {}; const codes = new Set(); const photos = new Set();
  for (const m of brand.catalog.models) {
    const groups = await getCol(`devices/${m}/Sklopovi`);
    catalog[m] = [];
    for (const g of groups) {
      const parts = await getCol(`devices/${m}/Sklopovi/${encodeURIComponent(g.id)}/Rezervni delovi`);
      catalog[m].push({ ...g, parts });
      parts.forEach((p) => codes.add(String(p.Code ?? p.id)));
      if (g["Group photo"]) photos.add(String(g["Group photo"]));
    }
    console.log(`  ${m}: ${groups.length} sklop(ova), ${catalog[m].reduce((n, g) => n + g.parts.length, 0)} delova`);
  }
  save("catalog.json", catalog);

  console.log("Cene…");
  const prices = {};
  for (const c of codes) { try { prices[c] = await getDoc(`priceList/${c}`); } catch { prices[c] = null; } }
  save("prices.json", prices);
  console.log(`  cene: ${Object.values(prices).filter(Boolean).length}/${codes.size}`);

  console.log("Storage: crteži, dokumenti, logo…");
  for (const ph of photos) {
    const list = await (await fetch(`${GCS}?prefix=${encodeURIComponent("Photos/" + ph)}`, { headers: H })).json();
    for (const it of list.items || []) await download(it.name);
  }
  const docs = await (await fetch(`${GCS}?prefix=Documents/&fields=items(name,size)`, { headers: H })).json();
  for (const it of docs.items || []) if (!it.name.endsWith("/") && it.size < 15e6) await download(it.name);
  const logoUrl = (await getDoc("settings/config")).theme?.logoUrl || "";
  const m = /\/o\/([^?]+)/.exec(logoUrl);
  if (m) { const name = decodeURIComponent(m[1]); await download(name); save("logo.json", { name }); }
  else save("logo.json", { name: null });
  console.log("Gotovo.");
})().catch((e) => { console.error("GREŠKA:", e.message); process.exit(1); });
