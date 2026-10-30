"""ОМНИ-1 v2 — читаемые чертежи: штриховка разреза, выноски, легенда.
Листы: план, разрез А-А, узел. Всё в мм, масштаб подгоняется автоматически."""
import math, os, subprocess

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/drawings2'
os.makedirs(OUT, exist_ok=True)

L, W, TH = 1900, 640, 130
TOPZ, BOTZ = 1110, 980
SLOT_W = 160
SLOTS = [(-800, -200, 300), (-800, -200, -300), (300, 900, 300), (300, 900, -300)]
PIVOTS = [(-520, 300), (-520, -300), (620, 300), (620, -300)]
CUFF = [190, 190, 224, 224]
ARCH_X, ARCH_R = -300, 305

INK = '#1b2026'
DIM = '#6b737a'
THIN = '#8f979d'


class Sheet:
    def __init__(self, w, h, title):
        self.w, self.h, self.title = w, h, title
        self.items = []
        self.pts = []

    def _p(self, x, y):
        self.pts.append((x, y)); return x, y

    # --- примитивы ---
    def rect(self, x0, y0, x1, y1, fill='none', stroke=INK, sw=2.4, dash=None):
        self.items.append(('rect', (self._p(x0, y0), self._p(x1, y1)), fill, stroke, sw, dash))

    def line(self, x0, y0, x1, y1, stroke=INK, sw=1.6, dash=None):
        self.items.append(('line', ((self._p(x0, y0)), (self._p(x1, y1))), stroke, sw, dash))

    def circle(self, x, y, r, fill='none', stroke=INK, sw=2.0, dash=None):
        self.items.append(('circle', (self._p(x - r, y - r), self._p(x + r, y + r)), fill, stroke, sw, dash))

    def poly(self, pts, fill='none', stroke=INK, sw=2.0, dash=None):
        for p in pts: self._p(*p)
        self.items.append(('poly', pts, fill, stroke, sw, dash))

    def text(self, x, y, s, size=16, anchor='start', fill=INK, weight='400'):
        self.items.append(('text', (self._p(x, y),), s, size, anchor, fill, weight))

    # --- штриховка разреза ---
    def hatch(self, x0, y0, x1, y1, step=14, stroke=THIN, sw=0.9):
        """диагональная штриховка внутри прямоугольника (классический разрез)"""
        h = y1 - y0
        d = x0 - y0
        k = math.floor((d) / step) * step
        while k < (x1 + h) + step:
            # линия x - y = k
            xs = max(x0, k + y0); ys = xs - k
            xe = min(x1, k + y1); ye = xe - k
            if xs < xe:
                self.line(xs, ys, xe, ye, stroke, sw)
            k += step

    # --- выноска с номером ---
    def callout(self, x, y, tx, ty, num, text, size=15):
        self.line(x, y, tx, ty, INK, 1.0)
        self.circle(x, y, 5, INK, INK, 1.0)
        self.circle(tx, ty, 13, '#ffffff', INK, 1.4)
        self.text(tx, ty + 5, str(num), 14, 'middle', INK, '700')
        anchor = 'start' if tx >= x else 'end'
        self.text(tx + (20 if anchor == 'start' else -20), ty + 5, text, size, anchor, INK)

    # --- размер с засечками ---
    def dim(self, x0, y0, x1, y1, label, size=15):
        self.line(x0, y0, x1, y1, DIM, 1.0)
        for (x, y) in ((x0, y0), (x1, y1)):
            if abs(y1 - y0) < 1e-6:
                self.line(x, y - 6, x, y + 6, DIM, 1.2)
            else:
                self.line(x - 6, y, x + 6, y, DIM, 1.2)
        self.text((x0 + x1) / 2, (y0 + y1) / 2 - 9, label, size, 'middle', DIM)

    def save(self, name):
        xs = [p[0] for p in self.pts]; ys = [p[1] for p in self.pts]
        mnx, mxx, mny, mxy = min(xs), max(xs), min(ys), max(ys)
        top, mx_, my_ = 120, 150, 110
        s = min((self.w - 2 * mx_) / max(1e-6, mxx - mnx),
                (self.h - top - 2 * my_) / max(1e-6, mxy - mny))
        ox = mx_ + (self.w - 2 * mx_ - (mxx - mnx) * s) / 2
        oy = top + (self.h - top - 2 * my_ - (mxy - mny) * s) / 2

        def P(x, y):
            return ox + (x - mnx) * s, oy + (y - mny) * s

        out = [f'<rect width="{self.w}" height="{self.h}" fill="#ffffff"/>',
               f'<text x="80" y="76" font-family="DejaVu Sans" font-size="32" font-weight="700" '
               f'fill="{INK}">{self.title}</text>']
        for it in self.items:
            k = it[0]
            if k == 'rect':
                a, b = P(*it[1][0]), P(*it[1][1])
                d = f' stroke-dasharray="{it[5]}"' if it[5] else ''
                out.append(f'<rect x="{a[0]:.1f}" y="{a[1]:.1f}" width="{b[0]-a[0]:.1f}" '
                           f'height="{b[1]-a[1]:.1f}" fill="{it[2]}" stroke="{it[3]}" '
                           f'stroke-width="{it[4]}"{d}/>')
            elif k == 'line':
                a, b = P(*it[1][0]), P(*it[1][1])
                d = f' stroke-dasharray="{it[4]}"' if it[4] else ''
                out.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" '
                           f'stroke="{it[2]}" stroke-width="{it[3]}"{d} stroke-linecap="square"/>')
            elif k == 'circle':
                a, b = P(*it[1][0]), P(*it[1][1])
                d = f' stroke-dasharray="{it[5]}"' if it[5] else ''
                out.append(f'<circle cx="{(a[0]+b[0])/2:.1f}" cy="{(a[1]+b[1])/2:.1f}" '
                           f'r="{abs(b[0]-a[0])/2:.1f}" fill="{it[2]}" stroke="{it[3]}" '
                           f'stroke-width="{it[4]}"{d}/>')
            elif k == 'poly':
                d = f' stroke-dasharray="{it[5]}"' if it[5] else ''
                pts = ' '.join(f'{P(x,y)[0]:.1f},{P(x,y)[1]:.1f}' for x, y in it[1])
                out.append(f'<polygon points="{pts}" fill="{it[2]}" stroke="{it[3]}" '
                           f'stroke-width="{it[4]}"{d}/>')
            elif k == 'text':
                a = P(*it[1][0])
                out.append(f'<text x="{a[0]:.1f}" y="{a[1]:.1f}" font-family="DejaVu Sans" '
                           f'font-size="{it[3]}" text-anchor="{it[4]}" fill="{it[5]}" '
                           f'font-weight="{it[6]}">{it[2]}</text>')
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
               f'viewBox="0 0 {self.w} {self.h}">' + ''.join(out) + '</svg>')
        sp = os.path.join(OUT, name + '.svg')
        open(sp, 'w', encoding='utf-8').write(svg)
        subprocess.run(['rsvg-convert', '-w', str(self.w), '-h', str(self.h), sp,
                        '-o', os.path.join(OUT, name + '.png')], check=True)
        print('SHEET', name, round(s, 3))


# ======================= ПЛАН =======================
def plan():
    sh = Sheet(1700, 1000, 'ОМНИ-1 v2 — план стола: пазы и опоры')
    # столешница
    sh.rect(-L / 2, -W / 2, L / 2, W / 2, '#f6f8f9', INK, 3.0)
    # пазы — тёмные каналы со скруглением на конце
    for (a, b, y) in SLOTS:
        sh.rect(a, y - SLOT_W / 2, b, y + SLOT_W / 2, '#c2cad0', '#4a5258', 1.6)
        end = -1 if b < 0 else 1
        sh.circle(b if end > 0 else a, y, SLOT_W / 2, 'none', '#4a5258', 0.0) 
    # контур ложа
    sh.circle(-790, 0, 105, 'none', THIN, 1.4, '10 6')
    sh.circle(-20, 0, 135, 'none', THIN, 1.4, '10 6')
    sh.rect(-650, -165, -50, 165, 'none', THIN, 1.4, '10 6')
    sh.rect(-600, -252, -80, -148, 'none', THIN, 1.4, '10 6')
    sh.rect(-600, 148, -80, 252, 'none', THIN, 1.4, '10 6')
    sh.rect(60, 20, 660, 160, 'none', THIN, 1.4, '10 6')
    sh.rect(60, -160, 660, -20, 'none', THIN, 1.4, '10 6')
    sh.circle(800, 0, 75, 'none', THIN, 1.4, '10 6')

    # опоры
    for i, (x, y) in enumerate(PIVOTS):
        sh.circle(x, y, 58, 'none', '#2f9e97', 2.6)
        sh.circle(x, y, 9, '#2f9e97', 'none', 0)
        sh.text(x, y + 4, '', 12)

    # бортики — светлые полосы
    for (x0, x1, y0, y1) in ((-830, 830, 268, 318), (-830, 830, -318, -268),
                             (-830, -750, -150, 150), (840, 890, -140, 140), (300, 860, -18, 18)):
        sh.rect(x0, y0, x1, y1, 'rgba(150,160,168,.28)', '#6b737a', 1.2)

    # маркеры + легенда (без длинных выносок)
    def mark(x, y, n):
        sh.circle(x, y, 26, '#ffffff', INK, 1.6)
        sh.text(x, y + 6, str(n), 17, 'middle', INK, '700')
    mark(-500, 220, 1)
    mark(-520, 300, 2)
    mark(-300, 120, 3)
    mark(830, 318, 4)
    mark(620, 300, 5)
    sh.text(0, W / 2 + 230, '1 — паз сквозной 160   2 — опора (каретка под столом)   3 — контур ложа',
            16, 'middle', '#333a40')
    sh.text(0, W / 2 + 268, '4 — бортик 26 мм   5 — кольцо ⌀224 на оси паза', 16, 'middle', '#333a40')

    # размеры
    sh.dim(-L / 2, -W / 2 - 90, L / 2, -W / 2 - 90, '1900')
    for (x0, x1, y, t) in ((-800, -200, -W / 2 - 160, '600'), (300, 900, -W / 2 - 160, '600')):
        sh.dim(x0, y, x1, y, t, 14)
    sh.dim(L / 2 + 90, -W / 2, L / 2 + 90, W / 2, '640', 15)
    sh.text(0, W / 2 + 110, 'Стол 1900 × 640 × 130. Паз 160: руки x −800…−200, ноги x 300…900, оси y = ±300.',
            16, 'middle', '#333a40')
    sh.save('v2_plan')


# ======================= РАЗРЕЗ А-А =======================
def sec():
    sh = Sheet(1700, 950, 'ОМНИ-1 v2 — разрез А-А (вдоль стола)')
    def Z(z):      # чертёжная ось: вверх = меньше y
        return -z

    sh.line(-1080, 0, 1080, 0, INK, 3.0)                      # пол
    # колонна + вилка
    sh.rect(-85, Z(900), 85, 0, '#eef2f4', INK, 2.2)
    sh.hatch(-85, Z(900), 85, 0, 26, '#c9d1d6', 0.8)
    sh.rect(-95, Z(940), 95, Z(900), '#eef2f4', INK, 2.2)

    # столешница с ложем (профиль)
    prof = []
    for x in range(-950, 951, 8):
        d = 0.0
        for cx, r, dep in ((-790, 105, 12), (-20, 135, 14), (800, 75, 10)):
            dx = x - cx
            if abs(dx) < r * 1.3:
                d = max(d, dep * math.sqrt(max(0.0, 1 - (dx / (r * 1.3)) ** 2)))
        if -650 <= x <= -50:
            d = max(d, 18)
        if 60 <= x <= 660 or -600 <= x <= -80:
            d = max(d, 12)
        prof.append((x, TOPZ - d))
    body_pts = [(-L / 2, TOPZ)] + prof + [(L / 2, TOPZ), (L / 2, BOTZ), (-L / 2, BOTZ)]
    sh.poly([(x, Z(z)) for x, z in body_pts], '#eef2f4', INK, 2.6)
    # штриховка плиты (между профилем и низом — приблизительно прямоугольником)
    sh.hatch(-L / 2, Z(BOTZ + 6), L / 2, Z(BOTZ - 60), 22, '#c9d1d6', 0.7)

    # паз (правый) — белая полость
    sh.rect(300, Z(TOPZ - 12), 900, Z(BOTZ), '#ffffff', '#4a5258', 1.8)

    # каретка, штанга (в разрезе — окружность), стойка, кольцо
    sh.rect(555, Z(915), 685, Z(838), '#dfe4e7', INK, 2.0)
    sh.circle(620, Z(876), 22, '#ffffff', INK, 1.8)
    sh.line(620, Z(876), 860, Z(876), THIN, 1.0, '6 4')
    sh.line(860, Z(876), 860, Z(1275), '#dfe4e7', 10)
    sh.line(860, Z(876), 860, Z(1275), INK, 1.6)
    sh.circle(860, Z(1275), 112, 'none', '#2f9e97', 4.0)
    sh.circle(860, Z(1275), 95, 'none', '#2f9e97', 1.6, '6 4')

    # арка
    arc = [(ARCH_X + ARCH_R * math.cos(math.radians(a)), Z(TOPZ + ARCH_R * math.sin(math.radians(a))))
           for a in range(4, 177, 6)]
    sh.poly(arc, 'none', INK, 6)

    # тело
    body = [(-930, TOPZ + 35), (-860, TOPZ + 100), (-780, TOPZ + 60), (-680, TOPZ + 155),
            (-540, TOPZ + 180), (-380, TOPZ + 150), (-220, TOPZ + 152), (0, TOPZ + 170),
            (170, TOPZ + 120), (350, TOPZ + 92), (620, TOPZ + 94), (860, TOPZ + 90), (930, TOPZ + 60)]
    sh.poly([(x, Z(z)) for x, z in body], 'none', '#8a6153', 2.4, '9 6')

    # выноски
    sh.callout(-300, Z(TOPZ + ARCH_R), -520, Z(TOPZ + 430), 1, 'арка фиксатора груди R305')
    sh.callout(860, Z(1275), 1020, Z(1400), 2, 'кольцо ⌀224 с замком')
    sh.callout(620, Z(876), 420, Z(700), 3, 'каретка под столом')
    sh.callout(600, Z(TOPZ - 6), 520, Z(760), 4, 'паз 160 сквозной')
    sh.callout(-700, Z(TOPZ - 10), -900, Z(700), 5, 'анатомическое ложе 12–18')

    sh.dim(-1040, Z(TOPZ), -1040, Z(BOTZ), '130', 15)
    sh.dim(-1040, Z(BOTZ), -1040, 0, '980', 15)
    sh.text(0, 110, 'Каретка ниже плоскости стола: тело не встречает деталей, штанга идёт в пазу.',
            16, 'middle', '#333a40')
    sh.save('v2_sec_aa')


# ======================= УЗЕЛ =======================
def node():
    sh = Sheet(1250, 950, 'ОМНИ-1 v2 — узел крепления')
    sh.rect(-300, 0, 300, TH, '#eef2f4', INK, 2.6)          # столешница
    sh.hatch(-300, 0, 300, TH, 20, '#c9d1d6', 0.7)
    sh.rect(-80, 0, 80, TH, '#ffffff', '#4a5258', 1.8)      # паз
    sh.rect(-75, TH + 6, 75, TH + 66, '#dfe4e7', INK, 2.2)  # каретка
    sh.rect(-22, 6, 22, TH + 6, '#f0f3f4', INK, 1.8)        # штанга
    sh.rect(-16, -200, 16, 14, '#f0f3f4', INK, 1.8)         # стойка
    sh.circle(0, -300, 95, 'none', '#2f9e97', 4.0)
    sh.circle(0, -300, 112, 'none', '#2f9e97', 1.6, '6 5')
    sh.rect(100, -380, 136, -305, '#eef2f4', INK, 1.8)      # замок

    sh.callout(-40, TH / 2, -230, -10, 1, 'столешница 130, паз 160')
    sh.callout(40, TH + 36, 220, TH + 90, 2, 'каретка')
    sh.callout(0, TH / 2, 210, TH - 30, 3, 'штанга ⌀44, телескоп 700')
    sh.callout(0, -120, 210, -150, 4, 'стойка, подъём 350')
    sh.callout(0, -300, 210, -330, 5, 'кольцо ⌀190 / ⌀224')
    sh.callout(118, -340, 240, -400, 6, 'замок')

    sh.text(0, 240, 'Поворот штанги — до ±60°, вынос — до 700. Кольцо на конце стойки.',
            15, 'middle', '#333a40')
    sh.save('v2_node')


plan(); sec(); node()
print('DONE')
