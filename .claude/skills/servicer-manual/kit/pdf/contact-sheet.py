# Pregled: sve strane PDF-a (ili sve PNG snimke iz foldera) na listovima za vizuelnu proveru.
# Upotreba: python contact-sheet.py <pdf|folderSaPNG> <outPrefix>
import sys,os,glob
from PIL import Image, ImageDraw
src,out=sys.argv[1:3]
if src.endswith(".pdf"):
    import pypdfium2 as pdfium
    pdf=pdfium.PdfDocument(src); imgs=[(str(i+1),pdf[i].render(scale=0.5).to_pil()) for i in range(len(pdf))]; per,cols=8,4
else:
    imgs=[]
    for f in sorted(glob.glob(src+"/m*.png")):
        im=Image.open(f).convert("RGB"); im.thumbnail((200,560)); imgs.append((os.path.basename(f)[:-4],im))
    per,cols=8,8
w=max(i.size[0] for _,i in imgs); h=max(i.size[1] for _,i in imgs)
for s in range(0,len(imgs),per):
    chunk=imgs[s:s+per]; rows=(len(chunk)+cols-1)//cols
    sheet=Image.new("RGB",(cols*(w+10)+10,rows*(h+30)+10),"#777"); d=ImageDraw.Draw(sheet)
    for k,(n,im) in enumerate(chunk):
        x=10+(k%cols)*(w+10); y=10+(k//cols)*(h+30); d.text((x,y),n,fill="white"); sheet.paste(im,(x,y+18))
    sheet.save(f"{out}-{s//per+1}.png"); print(f"{out}-{s//per+1}.png")
