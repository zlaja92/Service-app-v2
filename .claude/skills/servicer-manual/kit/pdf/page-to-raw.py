# Renderuje jednu stranu PDF-a: PNG (pregled) + RGBA raw (za verify-qr.cjs) i ispisuje URI anotacije te strane.
# Upotreba: python page-to-raw.py <pdf> <brojStrane(1..)> <outPrefix>   → <outPrefix>.png/.raw/.json
import sys
import pypdfium2 as pdfium
from pypdf import PdfReader
f,n,out=sys.argv[1],int(sys.argv[2]),sys.argv[3]
im=pdfium.PdfDocument(f)[n-1].render(scale=3).to_pil().convert("RGBA")
im.save(out+".png"); open(out+".raw","wb").write(im.tobytes())
import json; json.dump(list(im.size),open(out+".json","w")); print("render:", out+".png", im.size)
pg=PdfReader(f).pages[n-1]
uris=[a.get_object()["/A"]["/URI"] for a in pg.get("/Annots",[]) if "/A" in a.get_object() and "/URI" in a.get_object()["/A"]]
print("linkovi na strani:", uris, file=sys.stderr)
