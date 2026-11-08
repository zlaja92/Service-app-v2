// Renderuje <manual.html> u <out>-body.pdf (sa brojem strane u podnožju) i <out>-cover.pdf (samo naslovna, bez podnožja).
// Naslovna = sve pre komentara "<!-- ───────────── SADRŽAJ". Upotreba: node render.mjs <manual.html> <outPrefix>
import { chromium } from "playwright-core";
import fs from "node:fs"; import path from "node:path";
const [src, out] = process.argv.slice(2);
const html = fs.readFileSync(src, "utf8");
const marker = "<!-- ───────────── SADRŽAJ";
if (!html.includes(marker)) throw new Error("Nema markera naslovne strane: " + marker);
const coverFile = path.join(path.dirname(src), ".cover-" + path.basename(src));
fs.writeFileSync(coverFile, html.split(marker)[0] + "</body></html>");
const b = await chromium.launch({ channel: "chrome", headless: true });
async function render(file, pdf, footer) {
  const p = await b.newPage();
  await p.goto("file://" + path.resolve(file), { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: pdf, format: "A4", printBackground: true, preferCSSPageSize: true, tagged: true, outline: true,
    displayHeaderFooter: footer, headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font-family:system-ui,sans-serif;font-size:8pt;color:#8a92a6;text-align:center;"><span class="pageNumber"></span></div>` });
  await p.close();
}
await render(src, out + "-body.pdf", true);
await render(coverFile, out + "-cover.pdf", false);
await b.close(); fs.rmSync(coverFile);
console.log("  ✓", out + "-body.pdf,", out + "-cover.pdf");
