"""ОМНИ-1 v2 — чертежи с нуля (мм). Четыре листа: план, продольный разрез,
поперечный разрез, узел крепления. Вывод: SVG → PNG через rsvg-convert."""
import math, os, subprocess

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/drawings2'
os.makedirs(OUT, exist_ok=True)

# ---------------- геометрия (мм, от пола) ----------------
L, W = 1900, 640             # столешница
TOPZ = 1110                 # плоскость стола
TH = 130                    # толщина столешницы
BOTZ = TOPZ - TH            # 980
COL_D = 170                 # колонна
COL_H0, COL_H1 = 520, 900   # ход колонны
SLOT_W = 160
SLOTS = [                   # (x0, x1, y)
    (-800, -200, 300), (-800, -200, -300),
    (300, 900, 300), (300, 900, -300),
]
PIVOT = [(-520, 300), (-520, -300), (620, 300), (620, -300)]
CUFF_D = {0: 190, 1: 190, 2: 224, 3: 224}   # руки / ноги
ARCH_X, ARCH_R, ARCH_T = -300, 305, 38

CUT = {                     # анатомическое ложе: (тип, x, y, R, глубина)
    'head':  ('sphere', -790, 0, 105, 12),
    'back':  ('cyl',    -350, 0, 165, 18),
    'pelvis':('sphere',  -20, 0, 135, 14),
    'arm_L': ('cyl',    -340, 200, 52, 10),
    'arm_R': ('cyl',    -340, -200, 52, 10),
    'leg_L': ('cyl',     360, 90, 70, 12),
    'leg_R': ('cyl',     360, -90, 70, 12),
    'heel':  ('sphere',  800, 0, 75, 10),
}
BOLSTERS = [                # (x0,x1,y0,y1,h)
    (-830, 830, 268, 318, 26), (-830, 830, -318, -268, 26),
    (-830, -760, -150, 150, 24), (840, 890, -140, 140, 22),
    (300, 860, -15, 15, 12),
]

# ---------------- лист ----------------
class Sheet:
    def __init__(self, w_mm, h_mm, title, scale=0.55, ox=90, oy=170, x_min=0, y_min=0):
        self.w, self.h = w_mm, h_mm
        self.s = scale
        self.ox, self.oy = ox, oy
        self.x_min, self.y_min = x_min, y_min
        self.items = []
        self.items.append(f'<rect width="{w_mm}" height="{h_mm}" fill="#ffffff"/>')
        self.items.append(f'<text x="{ox}" y="64" font-family="DejaVu Sans" font-size="30" '
                          f'font-weight="700" fill="#14171a">{title}</text>')

    def p(self, x, y):
        return (self.ox + (x - self.x_min) * self.s,
                self.oy + (y - self.y_min) * self.s)

    # примитивы в «мировых» мм чертежа (ось Y вниз)
    def rect(self, x0, y0, x1, y1, fill='none', stroke='#242a30', w=1.6, dash=None):
        a, b = self.p(x0, y0), self.p(x1, y1)
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.items.append(f'<rect x="{a[0]:.1f}" y="{a[1]:.1f}" width="{b[0]-a[0]:.1f}" '
                          f'height="{b[1]-a[1]:.1f}" fill="{fill}" stroke="{stroke}" '
                          f'stroke-width="{w}"{d}/>')

    def line(self, x0, y0, x1, y1, stroke='#242a30', w=1.4, dash=None):
        a, b = self.p(x0, y0), self.p(x1, y1)
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.items.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" '
                          f'y2="{b[1]:.1f}" stroke="{stroke}" stroke-width="{w}"{d}/>')

    def circle(self, x, y, r, fill='none', stroke='#242a30', w=1.6, dash=None):
        c = self.p(x, y)
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.items.append(f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="{r*self.s:.1f}" '
                          f'fill="{fill}" stroke="{stroke}" stroke-width="{w}"{d}/>')

    def text(self, x, y, s, size=15, anchor='start', fill='#14171a', weight='400'):
        a = self.p(x, y)
        self.items.append(f'<text x="{a[0]:.1f}" y="{a[1]:.1f}" font-family="DejaVu Sans" '
                          f'font-size="{size}" text-anchor="{anchor}" fill="{fill}" '
                          f'font-weight="{weight}">{s}</text>')

    def dim(self, x0, y0, x1, y1, label, off=26, size=14):
        # горизонтальный или вертикальный размер
        if abs(y1 - y0) < 1e-6:
            yy = y0 + off
            self.line(x0, y0, x0, yy, '#7a8288', 0.9)
            self.line(x1, y1, x1, yy, '#7a8288', 0.9)
            self.line(x0, yy, x1, yy, '#7a8288', 1.0)
            self.text((x0 + x1) / 2, yy - 6, label, size, 'middle', '#4a5258')
        else:
            xx = x0 + off
            self.line(x0, y0, xx, y0, '#7a8288', 0.9)
            self.line(x1, y1, xx, y1, '#7a8288', 0.9)
            self.line(xx, y0, xx, y1, '#7a8288', 1.0)
            self.text(xx + 6, (y0 + y1) / 2, label, size, 'start', '#4a5258')

    def save(self, name):
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
               f'viewBox="0 0 {self.w} {self.h}">' + ''.join(self.items) + '</svg>')
        sp = os.path.join(OUT, name + '.svg')
        open(sp, 'w', encoding='utf-8').write(svg)
        subprocess.run(['rsvg-convert', '-w', str(self.w), '-h', str(self.h), sp,
                        '-o', os.path.join(OUT, name + '.png')], check=True)
        print('SHEET', name)


# ============================ ЛИСТ 1: ПЛАН ============================
def sheet_plan():
    sh = Sheet(1750, 980, 'ОМНИ-1 v2 — план столешницы (вид сверху), мм', 0.66, 150, 170, -1000, -400)
    x0, y0 = -L / 2, -W / 2
    sh.rect(x0, y0, x0 + L, y0 + W, '#eef1f3', '#242a30', 2.0)

    # пазы
    for (a, b, y) in SLOTS:
        sh.rect(a, y - SLOT_W / 2, b, y + SLOT_W / 2, '#c8d0d6', '#5b636b', 1.4)

    # анатомическое ложе — пунктиром
    for k, (typ, cx, cy, R, d) in CUT.items():
        if typ == 'sphere':
            sh.circle(cx, cy, R, 'none', '#8f979d', 1.1, '6 5')
        else:
            sh.rect(cx - 300, cy - R, cx + 300, cy + R, 'none', '#8f979d', 1.1, '6 5')

    # бортики
    for (a, b, c, d, h) in BOLSTERS:
        sh.rect(a, c, b, d, 'rgba(150,160,168,.35)', '#6b737a', 1.0)

    # опоры и кольца
    for i, (px, py) in enumerate(PIVOT):
        sh.circle(px, py, 60, 'none', '#2f9e97', 2.0)
        sh.circle(px, py, 12, '#2f9e97', '#2f9e97', 1.0)
        sh.text(px + 70, py + 6, f'опора {i + 1}', 13, 'start', '#2a6f6a')

    # габариты
    sh.dim(0, y0 - 60, 0, y0, '')
    sh.dim(x0, y0 + W + 70, x0 + L, y0 + W + 70, '1900')
    sh.dim(x0 - 40, y0, x0 - 40, y0 + W, '640', off=-60)
    sh.dim(-800, y0 - 34, -200, y0 - 34, '600', off=-34)
    sh.dim(300, y0 - 34, 900, y0 - 34, '600', off=-34)

    sh.text(0, y0 + W + 150, 'Пазы сквозные, выходят на кромку. Центр кольца — на оси паза.', 15, 'middle', '#4a5258')
    sh.text(0, y0 + W + 182, 'Пунктир — контур анатомического ложа. Серые поля — бортики.', 15, 'middle', '#4a5258')
    sh.save('v2_plan')


# ============================ ЛИСТ 2: ПРОДОЛЬНЫЙ РАЗРЕЗ ============================
def sheet_section_x():
    sh = Sheet(1750, 900, 'ОМНИ-1 v2 — разрез по оси стола (вдоль тела), мм', 0.40, 150, 150, -1050, 0)
    # координаты чертежа: X — вдоль стола, Y — вверх (инвертируем при рисовании)
    def Y(z):
        return -z + 1400

    # пол
    sh.line(-1000, Y(0), 1000, Y(0), '#242a30', 2.2)
    # колонна
    sh.rect(-COL_D / 2, Y(COL_H1), COL_D / 2, Y(0), '#dfe4e7', '#242a30', 1.6)
    # столешница
    sh.rect(-L / 2, Y(TOPZ), L / 2, Y(BOTZ), '#eef1f3', '#242a30', 2.0)

    # анатомическое ложе (упрощённый профиль)
    prof = []
    xs = [x for x in range(-950, 951, 10)]
    for x in xs:
        d = 0.0
        for k, (typ, cx, cy, R, dep) in CUT.items():
            if k in ('arm_L', 'arm_R', 'leg_L', 'leg_R'):
                continue
            if typ == 'sphere':
                dx = x - cx
                if abs(dx) < R * 1.25:
                    d = max(d, dep * math.sqrt(max(0.0, 1 - (dx / (R * 1.25)) ** 2)))
            else:
                dx = x - cx
                if abs(dx) < 300:
                    d = max(d, dep)
        prof.append((x, TOPZ - d))
    for i in range(len(prof) - 1):
        sh.line(prof[i][0], Y(prof[i][1]), prof[i + 1][0], Y(prof[i + 1][1]), '#242a30', 1.8)

    # пазы (сквозные) — по краям, показываем как вырез
    for (a, b, y) in ((300, 900, 300), (300, 900, -300)):
        sh.rect(a, Y(TOPZ), b, Y(BOTZ), '#ffffff', '#5b636b', 1.2)

    # каретка под столом + штанга + стойка + кольцо (для ноги)
    px, py = 620, 300
    sh.rect(px - 70, Y(920), px + 70, Y(830), '#5d666d', '#242a30', 1.4)      # каретка
    sh.line(px, Y(875), 780, Y(875), '#8b949a', 9)                            # штанга
    sh.line(780, Y(875), 780, Y(1270), '#8b949a', 7)                          # стойка
    sh.circle(780, Y(1270), 112, 'none', '#2f9e97', 3.0)                      # кольцо
    sh.text(780, Y(1270) - 130, 'кольцо ⌀224', 13, 'middle', '#2a6f6a')

    # арка на груди
    cx, R = ARCH_X, ARCH_R
    arc = 'M ' + ' L '.join(
        f'{sh.p(cx + R * math.cos(math.radians(a)) , Y(TOPZ + R * math.sin(math.radians(a)))[1] if False else 0)[0]:.1f} {sh.oy + (-(TOPZ + R * math.sin(math.radians(a))) + 1400) * sh.s:.1f}'
        for a in (5, 30, 60, 90, 120, 150, 175))
    sh.items.append(f'<path d="{arc}" fill="none" stroke="#242a30" stroke-width="5"/>')
    sh.text(cx, Y(TOPZ + R) - 26, 'арка фиксатора груди, R305', 13, 'middle', '#4a5258')

    # тело — силуэт пунктиром
    body = 'M ' + ' L '.join(
        f'{sh.p(x, Y(z))[0]:.1f} {sh.p(x, Y(z))[1]:.1f}' for x, z in
        [(-940, TOPZ + 40), (-860, TOPZ + 90), (-760, TOPZ + 60), (-660, TOPZ + 150),
         (-540, TOPZ + 175), (-380, TOPZ + 150), (-200, TOPZ + 150), (0, TOPZ + 165),
         (140, TOPZ + 120), (320, TOPZ + 95), (620, TOPZ + 95), (860, TOPZ + 90),
         (930, TOPZ + 70)])
    sh.items.append(f'<path d="{body}" fill="none" stroke="#8a6153" stroke-width="2" stroke-dasharray="7 5"/>')

    sh.dim(-1000, Y(TOPZ), -1000, Y(BOTZ), '130', off=-70)
    sh.dim(-1000, Y(BOTZ), -1000, Y(0), '980', off=-70)
    # вилка наклона (ось качания) и зажим колонны
    sh.circle(0, Y(COL_H1 + 40), 46, 'none', '#242a30', 1.6)
    sh.rect(-90, Y(COL_H1 + 90), 90, Y(COL_H1 + 40), '#dfe4e7', '#242a30', 1.4)
    sh.text(120, Y(COL_H1 + 62), 'вилка наклона 0…90°, зажим колонны', 13, 'start', '#4a5258')
    sh.text(0, 830, 'Каретка — под столешницей. В паз проходит только стойка. '
                    'Штанга идёт вдоль края, тело не пересекает.', 15, 'middle', '#4a5258')
    sh.save('v2_sec_x')


# ============================ ЛИСТ 3: ПОПЕРЕЧНЫЙ РАЗРЕЗ ============================
def sheet_section_y():
    sh = Sheet(1300, 900, 'ОМНИ-1 v2 — поперечный разрез (по опоре руки), мм', 0.42, 200, 150, -420, 90)
    def Y(z):
        return -z + 1500

    sh.line(-400, Y(0), 400, Y(0), '#242a30', 2.2)
    sh.rect(-W / 2, Y(TOPZ), W / 2, Y(BOTZ), '#eef1f3', '#242a30', 2.0)

    # бортики
    for (a, b, c, d, h) in BOLSTERS[:2]:
        sh.rect(c, Y(TOPZ + h), d, Y(TOPZ), 'rgba(150,160,168,.35)', '#6b737a', 1.2)

    # паз и штанга
    sh.rect(300 - SLOT_W / 2, Y(TOPZ), 300 + SLOT_W / 2, Y(BOTZ), '#ffffff', '#5b636b', 1.4)
    sh.rect(-70, Y(920), 70, Y(830), '#5d666d', '#242a30', 1.4)
    sh.circle(0, Y(875), 22, '#8b949a', '#242a30', 1.0)
    sh.line(0, Y(875), 0, Y(1270), '#8b949a', 9)
    sh.circle(0, Y(1270), 95, 'none', '#2f9e97', 3.0)
    sh.text(0, Y(1270) - 120, 'кольцо ⌀190', 13, 'middle', '#2a6f6a')

    sh.dim(-W / 2, Y(TOPZ), W / 2, Y(TOPZ), '640', off=70)
    sh.dim(W / 2, Y(TOPZ), W / 2, Y(BOTZ), '130', off=40)
    sh.text(0, 830, 'Паз 160 сквозной. Бортики держат тело и не дают ему утонуть.', 15, 'middle', '#4a5258')
    sh.save('v2_sec_y')


# ============================ ЛИСТ 4: УЗЕЛ ============================
def sheet_node():
    sh = Sheet(1400, 950, 'ОМНИ-1 v2 — узел крепления (вид сбоку), мм', 4.2, 260, 420, -160, -140)
    # фрагмент столешницы и паза
    sh.rect(-120, 40, 120, 170, '#eef1f3', '#242a30', 2.0)
    sh.rect(-80, 40, 80, 170, '#ffffff', '#5b636b', 1.4)
    sh.text(0, 26, 'столешница 130, паз 160', 13, 'middle', '#4a5258')

    # рельс и каретка под столом
    sh.rect(-120, 176, 120, 196, '#8b949a', '#242a30', 1.4)
    sh.rect(-60, 200, 60, 250, '#5d666d', '#242a30', 1.6)
    sh.text(0, 272, 'каретка', 13, 'middle', '#3a4248')

    # штанга-телескоп
    sh.rect(-24, 150, 24, 210, '#c7ced3', '#242a30', 1.4)
    sh.rect(-14, 120, 14, 170, '#e6eaec', '#242a30', 1.2)
    sh.text(84, 196, 'штанга ⌀44, телескоп 700', 13, 'start', '#4a5258')

    # стойка и кольцо
    sh.rect(-14, 20, 14, 130, '#c7ced3', '#242a30', 1.4)
    sh.circle(0, 10, 95, 'none', '#2f9e97', 3.4)
    sh.circle(0, 10, 112, 'none', '#2f9e97', 1.6, '5 4')
    sh.text(0, -110, 'кольцо ⌀190 / ⌀224', 13, 'middle', '#2a6f6a')

    # замок
    sh.rect(96, -30, 130, 30, '#5aa8a2', '#2a6f6a', 1.2)
    sh.text(150, 0, 'замок', 13, 'start', '#2a6f6a')

    sh.text(0, 300, 'Ход: поворот ±, вынос до 700, подъём стойки до 350. '
                    'Каретка ниже плоскости стола, поэтому тело не встречает деталей.',
            14, 'middle', '#4a5258')
    sh.save('v2_node')


sheet_plan()
sheet_section_x()
sheet_section_y()
sheet_node()
print('DONE', OUT)
