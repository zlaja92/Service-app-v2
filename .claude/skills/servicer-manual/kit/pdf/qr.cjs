// QR kodovi za App Store i Google Play → <outDir>/qr-appstore.svg, qr-play.svg
// Upotreba: node qr.cjs <brand.json> <outDir>
const QR = require("qrcode"); const fs = require("fs");
const [brandFile, out] = process.argv.slice(2);
const brand = JSON.parse(fs.readFileSync(brandFile, "utf8"));
(async () => {
  for (const [k, u] of [["appstore", brand.appStoreUrl], ["play", brand.playStoreUrl]]) {
    if (!u) { console.log("  (nema linka za", k + ")"); continue; }
    fs.writeFileSync(`${out}/qr-${k}.svg`, await QR.toString(u, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1b2130", light: "#ffffff" } }));
    console.log("  ✓ qr-" + k + ".svg →", u);
  }
})();
