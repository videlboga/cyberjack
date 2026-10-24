"""Разбор реф-картинки: палитра, распределение тонов, цвет тени и света.

Нужен, чтобы повторять чужой кадр не на глаз: скрипт вытаскивает доминирующие
цвета, строит полосу-палитру, считает среднюю яркость света и тени и печатает
готовые HEX для toon_lib.P.

Запуск:
    python3 tools/ref_palette.py <картинка.png> [--k 8] [--out blockout]
"""
import sys, os, argparse
from collections import Counter

from PIL import Image

OUT_DEFAULT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'


def quantize(img, k=8):
    small = img.convert('RGB').resize((160, 160))
    q = small.quantize(colors=k, method=Image.MEDIANCUT)
    pal = q.getpalette()[:k * 3]
    counts = Counter(q.getdata())
    total = sum(counts.values())
    out = []
    for idx, cnt in counts.most_common():
        r, g, b = pal[idx * 3:idx * 3 + 3]
        out.append(((r, g, b), cnt / total))
    return out


def tone_stats(img):
    """Средняя яркость верхней половины (свет) и нижней (тень) + насыщенность."""
    rgb = img.convert('RGB')
    w, h = rgb.size
    top = rgb.crop((0, 0, w, h // 2)).resize((80, 40))
    bot = rgb.crop((0, h // 2, w, h)).resize((80, 40))

    def avg(im):
        px = list(im.getdata())
        n = len(px)
        r = sum(p[0] for p in px) / n
        g = sum(p[1] for p in px) / n
        b = sum(p[2] for p in px) / n
        mx, mn = max(r, g, b), min(r, g, b)
        sat = 0 if mx == 0 else (mx - mn) / mx
        return (r, g, b), (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, sat

    return avg(top), avg(bot)


def hexs(c):
    return '#%02X%02X%02X' % tuple(int(max(0, min(255, v))) for v in c)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('image')
    ap.add_argument('--k', type=int, default=8)
    ap.add_argument('--out', default=OUT_DEFAULT)
    a = ap.parse_args()

    img = Image.open(a.image)
    print(f'FILE {a.image}  {img.size[0]}x{img.size[1]}')
    cols = quantize(img, a.k)
    print('PALETTE')
    for c, share in cols:
        print(f'  {hexs(c)}  {share*100:5.1f}%  rgb{tuple(int(v) for v in c)}')

    (ct, lt, st), (cb, lb, sb) = tone_stats(img)
    print(f'LIGHT half: {hexs(ct)}  L={lt:.2f}  sat={st:.2f}')
    print(f'SHADOW half: {hexs(cb)}  L={lb:.2f}  sat={sb:.2f}')
    print(f'CONTRAST L light-shadow = {lt - lb:.2f}')
    print(f'HINT key/fill ratio ~ {max(0.2, lt / max(lb, 0.03)):.1f}x, shadow sat {sb:.2f}')

    # полоса-палитра
    strip = Image.new('RGB', (len(cols) * 120, 120))
    for i, (c, _) in enumerate(cols):
        for x in range(i * 120, (i + 1) * 120):
            for y in range(120):
                strip.putpixel((x, y), tuple(int(v) for v in c))
    os.makedirs(a.out, exist_ok=True)
    name = os.path.splitext(os.path.basename(a.image))[0]
    path = os.path.join(a.out, f'ref_palette_{name}.png')
    strip.save(path)
    print('SWATCH', path)


if __name__ == '__main__':
    main()
