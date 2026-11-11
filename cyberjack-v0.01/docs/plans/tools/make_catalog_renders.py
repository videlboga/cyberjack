"""Convert transparent 700px preview PNGs into 600x600 WebP for the catalog cards.

Crops to the alpha bbox, fits the object into 86% of the square, keeps the rest
transparent. Usage: python3 make_catalog_renders.py <src_dir> <dst_dir>
"""
import os
import sys
import numpy as np
from PIL import Image

src_dir, dst_dir = sys.argv[1], sys.argv[2]
os.makedirs(dst_dir, exist_ok=True)

SIDE = 600
FILL = 0.86
total = 0
rows = []
for name in sorted(os.listdir(src_dir)):
    if not name.endswith('.png'):
        continue
    cid = name[:-4]
    im = Image.open(os.path.join(src_dir, name)).convert('RGBA')
    a = np.array(im)[..., 3]
    ys, xs = np.where(a > 8)
    if len(xs) == 0:
        print('EMPTY', cid)
        continue
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    crop = im.crop(box)
    cw, ch = crop.size
    scale = (SIDE * FILL) / max(cw, ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    small = crop.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new('RGBA', (SIDE, SIDE), (0, 0, 0, 0))
    canvas.alpha_composite(small, ((SIDE - nw) // 2, (SIDE - nh) // 2))
    out = os.path.join(dst_dir, f'{cid}.webp')
    canvas.save(out, 'WEBP', quality=86, method=6)
    sz = os.path.getsize(out)
    total += sz
    rows.append((cid, sz, nw, nh))

rows.sort(key=lambda r: -r[1])
print(f'{len(rows)} files, total {total/1024/1024:.2f} MB, avg {total/max(1,len(rows))/1024:.1f} KB')
print('largest:', [(r[0], r[1] // 1024) for r in rows[:5]])
print('smallest:', [(r[0], r[1] // 1024) for r in rows[-3:]])
