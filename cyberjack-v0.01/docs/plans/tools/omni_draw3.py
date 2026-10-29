"""ОМНИ-1 v2 — чертежи (мм). Автоподгонка масштаба под лист.
Листы: план, разрез вдоль, разрез поперёк, узел."""
import math, os, subprocess

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/drawings2'
os.makedirs(OUT, exist_ok=True)

# ---------------- параметры машины (мм) ----------------
L, W, TH = 1900, 640, 130
TOPZ = 1110
BOTZ = TOPZ - TH
SLOT_W = 160
SLOTS = [(-800, -200, 300), (-800, -200, -300), (300, 900, 300), (300, 900, -300)]
PIVOTS = [(-520, 300), (-520, -300), (620, 300), (620, -300)]
CUFF = [190, 190, 224, 224]
ARCH_X, ARCH_R = -300, 305
CUT_SPHERE = [(-790, 0, 105), (-20, 0, 135), (800, 0, 75)]
CUT_CYL = [(-350, 0, 165), (-340, 200, 52), (-340, -200, 52), (360, 90, 70), (360, -90, 70)]
BOLST = [(-830, 830, 268, 318), (-830, 830, -318, -268),
         (-830, -760, -150, 150), (840, 890, -140, 140), (300, 860, -15, 15)]


class Sheet:
    """Примитивы задаются в мм; масштаб и сдвиг считаются при сохранении."""
    def __init__(self, w, h, title):
        self.w, self.h, self.title = w, h, title
        self.prims = []
        self.pts = []

    def _pt(self, x, y):
        self.pts.append((x, y)); return x, y

    def rect(self, x0, y0, x1, y1, fill='none', stroke='#242a30', w=1.6, dash=None):
        self.prims.append(('rect', (self._pt(x0, y0), self._pt(x1, y1)), fill, stroke, w, dash))

    def line(self, x0, y0, x1, y1, stroke='#242a30', w=1.4, dash=None):
        self.prims.append(('line', (self._pt(x0, y0), self._pt(x1, y1)), stroke, w, dash))

    def circle(self, x, y, r, fill='none', stroke='#242a30', w=1.6, dash=None):
        self.prims.append(('circle', (self._pt(x - r, y - r), self._pt(x + r, y + r)), fill, stroke, w, dash))

    def poly(self, pts, fill='none', stroke='#242a30', w=1.6, dash=None):
        for p in pts: self._pt(*p)
        self.prims.append(('poly', pts, fill, stroke, w, dash))

    def text(self, x, y, s, size=14, anchor='start', fill='#14171a', w='400'):
        self.prims.append(('text', (self._pt(x, y),), s, size, anchor, fill, w))

    def save(self, name):
        xs = [p[0] for p in self.pts]; ys = [p[1] for p in self.pts]
        mnx, mxx, mny, mxy = min(xs), max(xs), min(ys), max(ys)
        top = 110            # место под заголовок
        mx_, my_ = 70, 60
        s = min((self.w - 2 * mx_) / max(1e-6, mxx - mnx),
                (self.h - top - 2 * my_) / max(1e-6, mxy - mny))
        ox = mx_ + (self.w - 2 * mx_ - (mxx - mnx) * s) / 2
        oy = top + (self.h - top - 2 * my_ - (mxy - mny) * s) / 2

        def P(x, y):
            return ox + (x - mnx) * s, oy + (y - mny) * s

        out = [f'<rect width="{self.w}" height="{self.h}" fill="#ffffff"/>',
               f'<text x="70" y="70" font-family="DejaVu Sans" font-size="30" font-weight="700" '
               f'fill="#14171a">{self.title}</text>']
        for p in self.prims:
            kind = p[0]
            if kind == 'rect':
                a, b = P(*p[1][0]), P(*p[1][1])
                d = f' stroke-dasharray="{p[5]}"' if p[5] else ''
                out.append(f'<rect x="{a[0]:.1f}" y="{a[1]:.1f}" width="{b[0]-a[0]:.1f}" '
                           f'height="{b[1]-a[1]:.1f}" fill="{p[2]}" stroke="{p[3]}" '
                           f'stroke-width="{p[4]}"{d}/>')
            elif kind == 'line':
                a, b = P(*p[1][0]), P(*p[1][1])
                d = f' stroke-dasharray="{p[4]}"' if p[4] else ''
                out.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" '
                           f'y2="{b[1]:.1f}" stroke="{p[2]}" stroke-width="{p[3]}"{d}/>')
            elif kind == 'circle':
                a, b = P(*p[1][0]), P(*p[1][1])
                d = f' stroke-dasharray="{p[5]}"' if p[5] else ''
                out.append(f'<circle cx="{(a[0]+b[0])/2:.1f}" cy="{(a[1]+b[1])/2:.1f}" '
                           f'r="{(b[0]-a[0])/2:.1f}" fill="{p[2]}" stroke="{p[3]}" '
                           f'stroke-width="{p[4]}"{d}/>')
            elif kind == 'poly':
                d = f' stroke-dasharray="{p[5]}"' if p[5] else ''
                pts = ' '.join(f'{P(x,y)[0]:.1f},{P(x,y)[1]:.1f}' for x, y in p[1])
                out.append(f'<polygon points="{pts}" fill="{p[2]}" stroke="{p[3]}" '
                           f'stroke-width="{p[4]}"{d}/>')
            elif kind == 'text':
                a = P(*p[1][0])
                out.append(f'<text x="{a[0]:.1f}" y="{a[1]:.1f}" font-family="DejaVu Sans" '
                           f'font-size="{p[3]}" text-anchor="{p[4]}" fill="{p[5]}" '
                           f'font-weight="{p[6]}">{p[2]}</text>')
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
               f'viewBox="0 0 {self.w} {self.h}">' + ''.join(out) + '</svg>')
        sp = os.path.join(OUT, name + '.svg')
        open(sp, 'w', encoding='utf-8').write(svg)
        subprocess.run(['rsvg-convert', '-w', str(self.w), '-h', str(self.h), sp,
                        '-o', os.path.join(OUT, name + '.png')], check=True)
        print('SHEET', name, 'scale', round(s, 3))


# =============== 1. ПЛАН ===============
def plan():
    sh = Sheet(1700, 950, 'ОМНИ-1 v2 — план столешницы (вид сверху), мм')
    sh.rect(-L / 2, -W / 2, L / 2, W / 2, '#eef1f3', '#242a30', 2.4)
    for (a, b, y) in SLOTS:
        sh.rect(a, y - SLOT_W / 2, b, y + SLOT_W / 2, '#c8d0d6', '#5b636b', 1.6)
    for (x, y, r) in CUT_SPHERE:
        sh.circle(x, y, r, 'none', '#8f979d', 1.2, '7 5')
    for (x, y, r) in CUT_CYL:
        sh.rect(x - 300, y - r, x + 300, y + r, 'none', '#8f979d', 1.2, '7 5')
    for (a, b, c, d) in BOLST:
        sh.rect(a, c, b, d, 'rgba(150,160,168,.30)', '#6b737a', 1.1)
    for i, (x, y) in enumerate(PIVOTS):
        sh.circle(x, y, 60, 'none', '#2f9e97', 2.4)
        sh.circle(x, y, 10, '#2f9e97', 'none', 1)
        sh.text(x, y - 74, f'опора {i + 1}', 13, 'middle', '#2a6f6a')

    # размеры
    sh.line(-L / 2, -W / 2 - 90, L / 2, -W / 2 - 90, '#7a8288', 1.0)
    sh.text(0, -W / 2 - 104, '1900', 14, 'middle', '#4a5258')
    sh.line(L / 2 + 90, -W / 2, L / 2 + 90, W / 2, '#7a8288', 1.0)
    sh.text(L / 2 + 104, 0, '640', 14, 'start', '#4a5258')
    sh.line(-800, W / 2 + 46, -200, W / 2 + 46, '#7a8288', 1.0)
    sh.text(-500, W / 2 + 34, '600', 13, 'middle', '#4a5258')
    sh.line(300, W / 2 + 46, 900, W / 2 + 46, '#7a8288', 1.0)
    sh.text(600, W / 2 + 34, '600', 13, 'middle', '#4a5258')

    sh.text(0, W / 2 + 128, 'Пазы сквозные, выходят на кромку; ширина 160. Пунктир — контур анатомического ложа.',
            14, 'middle', '#4a5258')
    sh.text(0, W / 2 + 152, 'Серые поля — бортики, держат тело. Кольца опор — на осях пазов.', 14, 'middle', '#4a5258')
    sh.save('v2_plan')


# =============== 2. РАЗРЕЗ ВДОЛЬ ===============
def sec_x():
    sh = Sheet(1700, 900, 'ОМНИ-1 v2 — разрез вдоль стола, мм')
    # ось Y чертежа: Y = -z, чтобы «вверх» было вверх
    def sec_poly(pts, **kw):
        sh.poly([(x, -z) for x, z in pts], **kw)

    sh.line(-1050, 0, 1050, 0, '#242a30', 2.2)                       # пол
    sh.rect(-85, -900, 85, 0, '#dfe4e7', '#242a30', 1.6)            # колонна
    sh.rect(-90, -940, 90, -900, '#eef1f3', '#242a30', 1.4)         # вилка наклона

    # столешница с ложем
    prof = []
    for x in range(-950, 951, 10):
        d = 0.0
        for (cx, cy, r), dep in zip(CUT_SPHERE, (12, 14, 10)):
            dx = x - cx
            if abs(dx) < r * 1.3:
                d = max(d, dep * math.sqrt(max(0.0, 1 - (dx / (r * 1.3)) ** 2)))
        for (cx, cy, r), dep in zip(CUT_CYL[:1], (18,)):
            if abs(x - cx) < 300:
                d = max(d, dep)
        prof.append((x, TOPZ - d))
    pts = [(-L / 2, TOPZ)] + prof + [(L / 2, TOPZ), (L / 2, BOTZ), (-L / 2, BOTZ)]
    sec_poly(pts, fill='#eef1f3', stroke='#242a30', w=2.0)

    # паз (сквозной) в правой части
    sh.rect(300, -TOPZ, 900, -BOTZ, '#ffffff', '#5b636b', 1.2)

    # каретка, штанга, стойка, кольцо
    sh.rect(550, -920, 690, -830, '#5d666d', '#242a30', 1.4)
    sh.line(620, -875, 860, -875, '#8b949a', 10)
    sh.line(860, -875, 860, -1270, '#8b949a', 8)
    sh.circle(860, -1270, 112, 'none', '#2f9e97', 4.0)
    sh.text(860, -1400, 'кольцо ⌀224', 13, 'middle', '#2a6f6a')

    # арка
    arc = [(ARCH_X + ARCH_R * math.cos(math.radians(a)), TOPZ + ARCH_R * math.sin(math.radians(a)))
           for a in range(3, 178, 6)]
    sec_poly(arc, fill='none', stroke='#242a30', w=5)
    sh.text(ARCH_X, -1470, 'арка фиксатора груди, R305', 13, 'middle', '#4a5258')

    # тело
    body = [(-940, TOPZ + 30), (-860, TOPZ + 95), (-780, TOPZ + 55), (-680, TOPZ + 150),
            (-540, TOPZ + 175), (-380, TOPZ + 148), (-220, TOPZ + 150), (0, TOPZ + 168),
            (160, TOPZ + 120), (340, TOPZ + 90), (620, TOPZ + 92), (860, TOPZ + 88), (930, TOPZ + 60)]
    sec_poly(body, fill='none', stroke='#8a6153', w=2.2, dash='8 5')

    # размеры
    sh.line(-1010, -TOPZ, -1010, -BOTZ, '#7a8288', 1.0)
    sh.text(-1030, -(TOPZ + BOTZ) / 2, '130', 13, 'end', '#4a5258')
    sh.line(-1010, -BOTZ, -1010, 0, '#7a8288', 1.0)
    sh.text(-1030, -(BOTZ) / 2, '980', 13, 'end', '#4a5258')

    sh.text(0, 90, 'Каретка под столешницей, в паз проходит только стойка. Штанга идёт вдоль края.',
            14, 'middle', '#4a5258')
    sh.save('v2_sec_x')


# =============== 3. РАЗРЕЗ ПОПЕРЁК ===============
def sec_y():
    sh = Sheet(1200, 900, 'ОМНИ-1 v2 — поперечный разрез по опоре, мм')
    sh.line(-420, 0, 420, 0, '#242a30', 2.2)
    sh.rect(-W / 2, -TOPZ, W / 2, -BOTZ, '#eef1f3', '#242a30', 2.2)
    for (a, b, c, d) in BOLST[:2]:
        sh.rect(c, -TOPZ - 26, d, -TOPZ, 'rgba(150,160,168,.30)', '#6b737a', 1.2)
    sh.rect(300 - SLOT_W / 2, -TOPZ, 300 + SLOT_W / 2, -BOTZ, '#ffffff', '#5b636b', 1.4)

    sh.rect(-70, -920, 70, -830, '#5d666d', '#242a30', 1.4)
    sh.circle(0, -875, 22, '#8b949a', '#242a30', 1.0)
    sh.line(0, -875, 0, -1270, '#8b949a', 10)
    sh.circle(0, -1270, 95, 'none', '#2f9e97', 4.0)
    sh.text(0, -1410, 'кольцо ⌀190', 13, 'middle', '#2a6f6a')

    sh.text(0, 90, 'Паз 160 сквозной. Бортики по краям держат тело и не дают утонуть.',
            14, 'middle', '#4a5258')
    sh.save('v2_sec_y')


# =============== 4. УЗЕЛ ===============
def node():
    sh = Sheet(1300, 950, 'ОМНИ-1 v2 — узел крепления (вид сбоку), мм')
    # стол 0..130 по толщине, вниз от 0
    sh.rect(-280, 0, 280, TH, '#eef1f3', '#242a30', 2.2)
    sh.rect(-80, 0, 80, TH, '#ffffff', '#5b636b', 1.4)

    sh.rect(-70, TH + 8, 70, TH + 68, '#5d666d', '#242a30', 1.6)      # каретка
    sh.rect(-22, 10, 22, TH + 8, '#c7ced3', '#242a30', 1.4)           # штанга в пазу
    sh.rect(-16, -190, 16, 20, '#c7ced3', '#242a30', 1.4)             # стойка

    sh.circle(0, -285, 95, 'none', '#2f9e97', 4.0)                    # кольцо
    sh.circle(0, -285, 112, 'none', '#2f9e97', 1.4, '6 5')
    sh.rect(100, -370, 134, -300, '#5aa8a2', '#2a6f6a', 1.2)          # замок

    sh.text(-292, -14, 'столешница 130', 13, 'start', '#4a5258')
    sh.text(-292, TH + 100, 'каретка (ниже стола)', 13, 'start', '#3a4248')
    sh.text(56, TH - 40, 'штанга ⌀44, телескоп 700', 13, 'start', '#4a5258')
    sh.text(150, -330, 'замок', 13, 'start', '#2a6f6a')
    sh.text(0, -440, 'кольцо ⌀190 / ⌀224', 13, 'middle', '#2a6f6a')

    sh.text(0, 220, 'Поворот штанги ±, вынос до 700, подъём стойки до 350. '
                    'Каретка ниже плоскости стола.', 14, 'middle', '#4a5258')
    sh.save('v2_node')


plan(); sec_x(); sec_y(); node()
print('DONE', OUT)
