import sys
from PIL import Image, ImageDraw
files = sys.argv[2:]
out = sys.argv[1]
W, H = 640, 360
cols = 3
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (W * cols, (H + 22) * rows), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((W, H))
    x, y = (i % cols) * W, (i // cols) * (H + 22)
    sheet.paste(im, (x, y + 22))
    d.text((x + 6, y + 4), f.split("/")[-1], fill=(255, 255, 255))
sheet.save(out)
