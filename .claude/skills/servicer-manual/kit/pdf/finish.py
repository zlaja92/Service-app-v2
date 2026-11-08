# Brojevi strana u sadržaju + spajanje naslovne (bez broja) i ostatka u konačni PDF.
# Sadržaj u HTML-u: <li><span class="n">N</span><span><a href="#id">Naslov</a>…</span><span class="pg" data-pg="id"></span></li>
# a naslov poglavlja: <h2 id="id"><span class="num">N</span>Naslov</h2>
# Upotreba: python finish.py <manual.html> <outPrefix> <final.pdf> "<PDF naslov>"
#   Izlazni kod 2 = sadržaj je ažuriran → ponovo render.mjs pa finish.py (dok ne prođe sa 0).
import sys,re,html as H
import pypdfium2 as pdfium
from pypdf import PdfReader, PdfWriter
src,out,final,title=sys.argv[1:5]
doc=open(src,encoding="utf-8").read()
items=[(a,re.sub(r"<[^>]+>","",t)) for a,t in re.findall(r'<li><span class="n">\d+</span><span><a href="#([^"]+)">(.*?)</a>',doc)]
pdf=pdfium.PdfDocument(out+"-body.pdf")
lines=[[re.sub(r"\s+","",l) for l in pdf[i].get_textpage().get_text_range().splitlines()] for i in range(len(pdf))]
found={}
for n,(a,t) in enumerate(items,1):
    key=f"{n}{H.unescape(t).replace(' ','')}"   # veliki naslovi se izvlače BEZ razmaka
    for i in range(2,len(lines)):
        if key in lines[i]: found[a]=i+1; break
missing=[a for a,_ in items if a not in found]
print("strana:",len(pdf),"| poglavlja:",found, "| NEDOSTAJE:" if missing else "", missing or "")
cur=dict(re.findall(r'<span class="pg" data-pg="([^"]+)">(\d*)</span>',doc))
if any(str(found.get(a,""))!=cur.get(a,"") for a,_ in items):
    doc=re.sub(r'(<span class="pg" data-pg="([^"]+)">)[^<]*(</span>)',lambda x:x.group(1)+str(found.get(x.group(2),""))+x.group(3),doc)
    open(src,"w",encoding="utf-8").write(doc); print("SADRŽAJ AŽURIRAN → ponovi render"); sys.exit(2)
body=PdfReader(out+"-body.pdf"); cover=PdfReader(out+"-cover.pdf")
w=PdfWriter(); w.add_page(cover.pages[0])
for pg in body.pages[1:]: w.add_page(pg)
w.add_metadata({"/Title":title})
w.write(final); print("PDF gotov:",final,"| strana:",len(w.pages))
