// Briše i ponovo puni LOKALNI emulator (projekat demo-<brandId>) demo podacima.
// Katalog/config su stvarni (iz prod-read.cjs export), kupci/serviser/intervencije izmišljeni (brand.json → demo).
// Upotreba: node seed.mjs <brand.json> <dataDir>
import fs from "node:fs";
import path from "node:path";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const [brandFile, dataDir] = process.argv.slice(2);
const brand = JSON.parse(fs.readFileSync(brandFile, "utf8"));
const read = (f) => JSON.parse(fs.readFileSync(path.join(dataDir, f), "utf8"));
const PROJECT = `demo-${brand.brandId}`;
const TENANT = brand.tenantId;
const AUTH = "http://127.0.0.1:9099";
const S = brand.demo.servicer;
const config = read("config.json");
const isSplit = config.business?.snType === "split";
const isMode2 = config.business?.appMode === "mode2";
const snOf = (d) => (d.code ? d.code.replace("/", "") : "") + d.ser;
const KIT = path.dirname(new URL(import.meta.url).pathname);
const rules = (f) => fs.readFileSync(path.join(KIT, "emu", f), "utf8");

// 1) reset (auth + firestore + storage)
await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
const env = await initializeTestEnvironment({
  projectId: PROJECT,
  firestore: { rules: rules("firestore.rules"), host: "127.0.0.1", port: 8085 },
  storage: { rules: rules("storage.rules"), host: "127.0.0.1", port: 9199 },
});
await env.clearFirestore();
await env.clearStorage();

// 2) demo serviser u Auth emulatoru (claims kao u produkciji)
{
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: S.email, password: S.password, returnSecureToken: true }),
  }).then((x) => x.json());
  const deviceTypes = [...new Set(read("devices.json").filter((d) => brand.catalog.models.includes(d.id)).map((d) => d.deviceType))];
  await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({ localId: r.localId, displayName: S.displayName,
      customAttributes: JSON.stringify({ approved: true, role: "servicer", tenantId: TENANT, deviceTypes, servicerId: S.servicerId }) }),
  });
  console.log("serviser:", S.email, "deviceTypes:", deviceTypes.join(","));
}

await env.withSecurityRulesDisabled(async (ctx) => {
  const f = ctx.firestore();
  const st = ctx.storage(); // bucket = gs://<PROJECT>  → u app-u storageBucket MORA biti PROJECT
  const t = (p) => doc(f, `tenants/${TENANT}/${p}`);

  // Storage: crteži, dokumenti (stvarni + probni), logo
  const types = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".pdf": "application/pdf" };
  const root = path.join(dataDir, "storage");
  const walk = (d) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
  const logo = read("logo.json").name;
  let logoUrl = "";
  for (const file of walk(root)) {
    const rel = path.relative(root, file);
    const r = ref(st, rel);
    await uploadBytes(r, fs.readFileSync(file), { contentType: types[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
    if (rel === logo) logoUrl = await getDownloadURL(r);
  }

  // Podešavanja (stvarna), logo iz emulatora
  if (logoUrl) config.theme = { ...(config.theme || {}), logoUrl };
  await setDoc(t("settings/config"), config);
  await setDoc(t("settings/version"), read("version.json"));

  // Katalog: svi modeli + sklopovi/delovi za izabrane + cene
  for (const d of read("devices.json")) { const { id, ...data } = d; await setDoc(t(`devices/${id}`), data); }
  for (const [m, groups] of Object.entries(read("catalog.json"))) {
    for (const g of groups) {
      const { id, parts, ...gdata } = g;
      await setDoc(t(`devices/${m}/Sklopovi/${id}`), gdata);
      for (const p of parts) { const { id: pid, ...pdata } = p; await setDoc(t(`devices/${m}/Sklopovi/${id}/Rezervni delovi/${pid}`), pdata); }
    }
  }
  for (const [code, data] of Object.entries(read("prices.json"))) if (data) await setDoc(t(`priceList/${code}`), data);

  // Serviser
  await setDoc(t(`servicers/${S.email}`), { company: S.company, address: S.address, city: S.city, phone: S.phone, email: S.email, pib: S.pib });

  // Registrovani uređaji (izmišljeni kupci)
  const lat = (s) => s.toUpperCase().replace(/Č|Ć/g, "C").replace(/Š/g, "S").replace(/Ž/g, "Z").replace(/Đ/g, "DJ");
  const modelType = Object.fromEntries(read("devices.json").map((d) => [d.id, d.deviceType]));
  const modelLen = config.business?.snModelLength ?? 7, modelStart = config.business?.snModelStart ?? 0;
  const typeOf = (sn) => modelType[sn.slice(modelStart, modelStart + modelLen)] ?? "boiler";
  for (const d of brand.demo.registeredDevices) {
    const sn = snOf(d);
    const dop = d.purchase ? new Date(d.purchase[0], d.purchase[1] - 1, d.purchase[2]) : null;
    await setDoc(t(`users/${sn}`), {
      sn, deviceType: typeOf(sn), addedBy: S.email, addedDate: Timestamp.fromDate(dop ?? new Date(2025, 4, 3, 10)),
      firstName: d.firstName, lastName: d.lastName, streetName: d.streetName, homeNumber: d.homeNumber, city: d.city,
      postCode: d.postCode, phoneNumber: d.phoneNumber, warrantyStatus: d.warranty,
      firstNameSrch: lat(d.firstName), lastNameSrch: lat(d.lastName),
      ...(dop ? { dateOfPurchase: Timestamp.fromDate(dop) } : {}),
    });
  }

  // Intervencije (kolekcija iz config.business.interventionCollections[deviceType])
  const colls = config.business?.interventionCollections ?? {};
  let n = 0;
  for (const it of brand.demo.interventions) {
    const dev = brand.demo.registeredDevices[it.device];
    const sn = snOf(dev); const type = typeOf(sn);
    const coll = colls[type] ?? colls.default ?? "interventions";
    const data = { sn, warrantyStatus: it.warranty, interventionType: "interventionRepair", distance: it.distance,
      addedBy: S.email, addedDate: Timestamp.fromDate(new Date(...[it.date[0], it.date[1] - 1, ...it.date.slice(2)])), exported: false };
    if (isMode2) Object.assign(data, { interventionFault: it.fault, interventionLocation: it.location, visits: it.visits, faultDescription: it.faultDescription, workDescription: it.workDescription });
    else Object.assign(data, { interventionDescription: it.fault, note: it.faultDescription, error: it.error ?? "" });
    it.parts.forEach((p, i) => { data[`sparePart${i + 1}`] = p; });
    await setDoc(t(`${coll}/demo-${++n}`), data);
  }
});
await env.cleanup();
console.log(`Demo podaci ubačeni (projekat ${PROJECT}, tenant ${TENANT}, snType=${isSplit ? "split" : "single"}, mode=${isMode2 ? "mode2" : "standard"}).`);
