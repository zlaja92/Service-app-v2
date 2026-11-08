// Pravi probne PDF dokumente (brand.json → demo.extraDocuments) u <dataDir>/storage/Documents/…
// Upotreba: node make-docs.mjs <brand.json> <dataDir>
import { chromium } from "playwright-core";
import fs from "node:fs"; import path from "node:path";
const [brandFile, dataDir] = process.argv.slice(2);
const brand = JSON.parse(fs.readFileSync(brandFile, "utf8"));
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage();
for (const [rel, kind, title] of brand.demo.extraDocuments ?? []) {
  await p.setContent(`<html><body style="font-family:system-ui;padding:40px"><p style="color:${brand.accentColor};font-weight:700;letter-spacing:.1em">${kind.toUpperCase()}</p><h1>${title}</h1><p>Probni dokument (demo sadržaj za uputstvo).</p></body></html>`);
  const file = path.join(dataDir, "storage", "Documents", rel); fs.mkdirSync(path.dirname(file), { recursive: true });
  await p.pdf({ path: file, format: "A4" }); console.log("  ✓", rel);
}
await b.close();
