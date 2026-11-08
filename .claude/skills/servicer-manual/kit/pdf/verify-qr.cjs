// Dekodira QR kodove sa jedne strane PDF-a (render u PNG radi python skripta) i ispisuje linkove + linkove (anotacije) sa strane.
// Upotreba: node verify-qr.cjs <outPrefix>   (prefiks iz page-to-raw.py; čita .raw i .json)
const jsQR = require("jsqr"); const fs = require("fs");
const pre = process.argv[2];
const [w, h] = JSON.parse(fs.readFileSync(pre + ".json", "utf8"));
const data = new Uint8ClampedArray(fs.readFileSync(pre + ".raw"));
for (const [name, x0, x1] of [["levi", 0, Math.floor(w / 2)], ["desni", Math.floor(w / 2), w]]) {
  const cw = x1 - x0; const crop = new Uint8ClampedArray(cw * h * 4);
  for (let y = 0; y < h; y++) crop.set(data.subarray((y * w + x0) * 4, (y * w + x1) * 4), y * cw * 4);
  const r = jsQR(crop, cw, h); console.log(name, "QR:", r ? r.data : "nije pronađen");
}
