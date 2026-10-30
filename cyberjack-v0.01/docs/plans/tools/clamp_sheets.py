"""Три листа фиксатора: 1) план стола, 2) разрез узла со штриховкой + выносной элемент, 3) кинематика."""
import os, subprocess, math

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/drawings'
BG = '#FCFDFD'; INK = '#1E2328'; MID = '#4C545C'; DIM = '#8A9299'
MAT = '#E7EBEE'; MET = '#B9C1C7'; BODY = '#F0DED6'; BODY2 = '#CDB2A7'
CONTOUR = 2.6; CUT = 1.8; HID = 0.9; DIMW = 0.8

class Sheet:
    def __init__(self, w, h, title, sub):
        self.w, self.h, self.s = w, h, []
        self.add(f'<rect width="{w}" height="{h}" fill="{BG}"/>')
        self.add('<defs>'
                 '<pattern id="h45" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
                 '<line x1="0" y1="0" x2="0" y2="9" stroke="#6E767D" stroke-width="1.0"/></pattern>'
                 '<pattern id="h135" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">'
                 '<line x1="0" y1="0" x2="0" y2="9" stroke="#6E767D" stroke-width="1.0"/></pattern>'
                 '<marker id="ar" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">'
                 '<path d="M0,0 L7,3 L0,6 Z" fill="#1E2328"/></marker>'
                 '</defs>')
        self.title(title, sub)
    def add(self, m): self.s.append(m)
    def title(self, t, sub):
        self.add(f'<text x="46" y="52" font-family="DejaVu Sans" font-size="24" font-weight="700" fill="{INK}">{t}</text>')
        self.add(f'<text x="46" y="78" font-family="DejaVu Sans" font-size="12.5" fill="{DIM}">{sub}</text>')
    def rect(self, x, y, w, h, fill='none', stroke=INK, sw=CONTOUR, rx=0, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')
    def path(self, d, fill='none', stroke=INK, sw=CONTOUR, dash=None):
        dd = f' stroke-dasharray="{dash}"' if dash else ''
        self.add(f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{dd}/>')
    def line(self, x1, y1, x2, y2, stroke=INK, sw=CONTOUR, dash=None, cap='butt', arrow=False):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        a = ' marker-end="url(#ar)"' if arrow else ''
        self.add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="{cap}"{d}{a}/>')
    def circ(self, cx, cy, r, fill='none', stroke=INK, sw=CUT, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.add(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')
    def ell(self, cx, cy, rx, ry, fill, stroke, sw=CUT):
        self.add(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
    def text(self, x, y, s, size=13, fill=INK, anchor='start', weight='400', rot=None):
        r = f' transform="rotate({rot} {x:.1f} {y:.1f})"' if rot is not None else ''
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" font-family="DejaVu Sans" font-size="{size}" fill="{fill}" '
                 f'text-anchor="{anchor}" font-weight="{weight}"{r}>{s}</text>')
    def dimh(self, x1, x2, y, label, above=-8):
        self.line(x1, y, x2, y, DIM, DIMW); self.line(x1, y - 5, x1, y + 5, DIM, DIMW); self.line(x2, y - 5, x2, y + 5, DIM, DIMW)
        self.text((x1 + x2) / 2, y + above, label, 12, DIM, 'middle')
    def dimv(self, x, y1, y2, label, side=-8):
        self.line(x, y1, x, y2, DIM, DIMW); self.line(x - 5, y1, x + 5, y1, DIM, DIMW); self.line(x - 5, y2, x + 5, y2, DIM, DIMW)
        self.text(x + side, (y1 + y2) / 2, label, 12, DIM, 'middle', rot=-90)
    def callout(self, cx, cy, tx, ty, n):
        self.line(cx, cy, tx, ty, INK, 0.9)
        self.circ(cx, cy, 3.2, INK, INK, 0.8)
        self.circ(tx, ty, 11, '#FFFFFF', INK, 1.4)
        self.text(tx, ty + 4.5, str(n), 12, INK, 'middle', '700')
    def legend(self, x, y, items, cols=2, dy=26):
        for i, s in enumerate(items):
            c, r = i % cols, i // cols
            cx, cy = x + c * 700, y + r * dy
            self.circ(cx + 11, cy - 4, 10, '#FFFFFF', INK, 1.3)
            self.text(cx + 11, cy, str(i + 1), 11.5, INK, 'middle', '700')
            self.text(cx + 28, cy, s, 12.5, INK)
    def save(self, name):
        self.add('</svg>')
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">' + ''.join(self.s)
        open(os.path.join(OUT, name + '.svg'), 'w', encoding='utf-8').write(svg)
        subprocess.run(['rsvg-convert', '-w', str(int(self.w * 1.6)), '-h', str(int(self.h * 1.6)),
                        os.path.join(OUT, name + '.svg'), '-o', os.path.join(OUT, name + '.png')], check=True)
        print('OK', name)

# ═══════════════ ЛИСТ 1: ПЛАН ═══════════════
sh = Sheet(1560, 1000, 'Фиксатор — лист 1: план стола',
           '1900 × 720 мм · четыре сквозных паза 600 × 140 · один узел прижима показан в рабочем положении · масштаб 1:2')
K = 0.5
OX, OY = 120, 190
def px(X): return OX + (X + 0.95) * 1000 * K
def py(Y): return OY + (0.36 - Y) * 1000 * K

sh.rect(px(-0.95), py(0.36), 1900 * K, 720 * K, MAT, INK, CONTOUR, 6)
sh.text(px(0.0), py(-0.36) + 26, 'столешница', 11.5, DIM, 'middle')
# пазы: отверстия — тонкий внутренний контур
for (x0, x1, yc) in [(-0.80, -0.20, 0.30), (-0.80, -0.20, -0.30), (0.30, 0.90, 0.30), (0.30, 0.90, -0.30)]:
    sh.rect(px(x0), py(yc + 0.07), (x1 - x0) * 1000 * K, 140 * K, BG, INK, CUT, 34)
    sh.path(f'M {px(x0) + 6:.1f} {py(yc):.1f} L {px(x1) - 6:.1f} {py(yc):.1f}', 'none', DIM, 0.7)

# тело
sh.ell(px(-0.79), py(0), 50 * K, 74 * K, BODY, BODY2, 1.3)
sh.path(f'M {px(-0.70):.1f} {py(0.18):.1f} Q {px(-0.40):.1f} {py(0.21):.1f} {px(-0.02):.1f} {py(0.15):.1f} '
        f'L {px(0.10):.1f} {py(0.14):.1f} Q {px(0.16):.1f} {py(0):.1f} {px(0.10):.1f} {py(-0.14):.1f} '
        f'L {px(-0.02):.1f} {py(-0.15):.1f} Q {px(-0.40):.1f} {py(-0.21):.1f} {px(-0.70):.1f} {py(-0.18):.1f} Z',
        BODY, BODY2, 1.3)
for sgn in (1, -1):
    sh.line(px(0.72), py(sgn * 0.10), px(0.80), py(sgn * 0.32), BODY2, 30 * K, cap='round')
    sh.circ(px(0.81), py(sgn * 0.33), 15 * K, BODY2, BODY2, 1.0)

# один узел (левая рука, положение 1)
UX, UY = px(-0.75), py(0.30)
sh.rect(UX - 60 * K, UY - 45 * K, 200 * K, 90 * K, '#FFFFFF', INK, CONTOUR, 3 * K)
sh.circ(UX, UY, 42 * K, BG, INK, CUT)
sh.circ(UX, UY, 6 * K, INK, INK, 0.8)
sh.line(UX, UY, UX, UY + 230 * K, INK, 3.4)                        # консоль к телу
sh.rect(UX - 190 * K, UY + 44 * K, 230 * K, 12, MET, INK, CUT, 2)  # каретка под столом (пунктир)
sh.text(UX + 30, UY + 62, 'каретка', 10.5, DIM)

sh.dimh(px(-0.95), px(0.95), py(-0.36) + 60, '1900')
sh.dimv(px(-0.99), py(0.36), py(-0.36), '720', -14)
sh.dimh(px(-0.80), px(-0.20), py(0.36) - 26, '600', -8)

sh.callout(UX + 30 * K, UY - 45 * K, UX + 130, UY - 130, 1)
sh.callout(px(-0.55), py(0.30) + 34 * K, px(-0.55) + 60, py(0.30) + 150, 2)
sh.callout(px(0.55), py(0.30), px(0.55) + 90, py(0.30) - 80, 3)
sh.callout(px(-0.35), py(0.02), px(-0.35) - 90, py(0.02) + 176, 4)

sh.legend(60, 860, ['узел прижима (каретка + стойка + консоль + винт)',
                    'паз сквозной 600 × 140: стойка проходит сквозь стол',
                    'паз для ног: разведение до 620 мм в сторону',
                    'тело лежит в ложах, конечности — под пятами прижимов',
                    'стол 1900 × 720, столешница 130'], 2, 28)
sh.save('sheet1_plan')

# ═══════════════ ЛИСТ 2: РАЗРЕЗ 1:1 + ВЫНОСНОЙ ЭЛЕМЕНТ ═══════════════
sh = Sheet(1620, 1060, 'Фиксатор — лист 2: разрез узла прижима',
           'разрез по оси паза, масштаб 1:1 · срез показан штриховкой · выносной элемент А — винтовой прижим 2:1')
M = 1.0                      # 1 px = 1 мм
SY = 620                    # плоскость стола
CX = 560                    # ось паза

# столешница как срез с ложем (штриховка)
top = SY
cradle = f'Q {CX - 150} {top} {CX - 140} {top - 6} Q {CX - 120} {top - 46} {CX - 60} {top - 46} ' \
         f'Q {CX} {top - 46} {CX + 20} {top - 6} Q {CX + 30} {top} {CX + 70} {top}'
sh.path(f'M {CX - 460} {top} L {CX - 150} {top} {cradle} L {CX + 70} {top} L {CX + 70} {top + 130} '
        f'L {CX - 460} {top + 130} Z', 'url(#h45)', INK, CUT)
sh.path(f'M {CX + 210} {top} L {CX + 470} {top} L {CX + 470} {top + 130} L {CX + 210} {top + 130} Z',
        'url(#h45)', INK, CUT)
sh.path(f'M {CX + 70} {top} L {CX + 210} {top} L {CX + 210} {top + 130} L {CX + 70} {top + 130} Z',
        'none', INK, 0.7, '7 5')                       # паз — за плоскостью разреза
sh.text(CX - 460, top - 12, 'столешница 130', 11.5, MID)

# каретка (срез)
sh.path(f'M {CX + 40} {top + 138} L {CX + 260} {top + 138} L {CX + 260} {top + 208} L {CX + 40} {top + 208} Z',
        'url(#h135)', INK, CUT)
sh.circ(CX + 150, top + 173, 22, BG, INK, CUT)          # ролик
sh.circ(CX + 150, top + 173, 7, INK, INK, 0.8)
sh.line(CX - 40, top + 218, CX + 430, top + 218, INK, 3.0)   # направляющая
sh.text(CX + 268, top + 178, 'каретка', 11.5, MID)

# стойка (срез) сквозь паз
sh.path(f'M {CX + 110} {SY - 120} L {CX + 150} {SY - 120} L {CX + 150} {top + 138} L {CX + 110} {top + 138} Z',
        'url(#h135)', INK, CUT)
sh.text(CX + 156, SY - 96, 'стойка ⌀40', 11.5, MID)
sh.rect(CX + 100, top - 18, 60, 36, BG, INK, CUT, 3)     # втулка в пазе

# консоль (не срез — контур)
sh.rect(CX - 80, SY - 148, 230, 26, MET, INK, CONTOUR, 8)
sh.circ(CX + 130, SY - 135, 22, MET, INK, CUT)           # шарнир на стойке
sh.circ(CX + 130, SY - 135, 7, BG, INK, 0.9)
sh.text(CX - 78, SY - 158, 'консоль 230', 11.5, MID)

# винт + гайка + маховик
VX = CX - 40
sh.rect(VX - 15, SY - 226, 30, 16, MET, INK, CUT, 2)     # гайка
sh.circ(VX, SY - 240, 24, MET, INK, CONTOUR)             # маховик
sh.circ(VX, SY - 240, 8, BG, INK, 0.9)
sh.rect(VX - 7, SY - 122, 14, 108, MET, INK, CUT)        # винт
for i in range(9):                                        # резьба
    yy = SY - 118 + i * 12
    sh.line(VX - 7, yy, VX + 7, yy + 6, INK, 0.7)

# пята (срез) + подушка
sh.path(f'M {VX - 26} {SY - 66} L {VX + 26} {SY - 66} L {VX + 26} {SY - 52} L {VX - 26} {SY - 52} Z',
        'url(#h45)', INK, CUT)
sh.rect(VX - 22, SY - 52, 44, 12, BODY2, INK, 1.2, 3)

# конечность (не срез)
sh.ell(VX, SY - 22, 44, 30, BODY, BODY2, 1.6)
sh.text(VX - 150, SY - 70, 'голень ⌀80', 11.5, MID)

# размеры
sh.dimv(CX + 300, SY - 120, SY, '120', 12)
sh.dimv(CX + 340, SY, SY + 130, '130', 12)
sh.dimh(CX + 70, CX + 210, SY + 250, '140', -8)
sh.dimv(CX - 120, SY - 240, SY - 226, 'маховик ⌀48', 12)

# выносной элемент А
sh.circ(CX - 120, SY - 260, 120, 'none', DIM, 1.0, '7 5')
sh.text(CX - 250, SY - 380, 'А', 15, INK, 'start', '700')
sh.line(CX - 120 + 84, SY - 260 - 84, 1090, 300, DIM, 0.9)

DX, DY, DK = 1150, 430, 2.0
sh.text(DX - 40, DY - 210, 'ВЫНОСНОЙ ЭЛЕМЕНТ А — винтовой прижим 2:1', 13, INK, 'start', '700')
sh.rect(DX - 34 * DK, DY - 120 * DK, 68 * DK, 24 * DK, 'url(#h135)', INK, CUT, 4)
sh.circ(DX, DY - 132 * DK, 24 * DK, MET, INK, CONTOUR)
sh.circ(DX, DY - 132 * DK, 9 * DK, BG, INK, 0.9)
sh.rect(DX - 7 * DK, DY - 96 * DK, 14 * DK, 40 * DK, MET, INK, CUT)
for i in range(6):
    yy = DY - 92 * DK + i * 8 * DK
    sh.line(DX - 7 * DK, yy, DX + 7 * DK, yy + 4 * DK, INK, 0.8)
sh.rect(DX - 22 * DK, DY - 56 * DK, 44 * DK, 12 * DK, BODY2, INK, 1.4, 6)
sh.ell(DX, DY - 26 * DK, 44 * DK, 28 * DK, BODY, BODY2, 1.6)
sh.dimv(DX + 62 * DK, DY - 56 * DK, DY - 44 * DK, '12', 16)
sh.dimv(DX - 62 * DK, DY - 12 * DK, DY - 56 * DK, '44', 12)
sh.text(DX - 40, DY + 26 * DK, 'пята ⌀44 · подушка 12 · винт М14', 11.5, MID)

sh.legend(60, 900, ['консоль поворотная, сидит на стойке шарнирно',
                    'стойка ⌀40 входит в паз через втулку',
                    'каретка на направляющей под столом',
                    'винт М14 с маховиком, ход пяты 28',
                    'пята с подушкой прижимает конечность к ложу',
                    'ложе: срез столешницы, штриховка — материал'], 2, 28)
sh.save('sheet2_section')

# ═══════════════ ЛИСТ 3: КИНЕМАТИКА ═══════════════
sh = Sheet(1560, 900, 'Фиксатор — лист 3: кинематика узла',
           'три движения на конечность: каретка по пазу, стойка по высоте, консоль поворотом · без деталей, только степени')

BX, BY = 240, 560
def bx(X): return BX + (X + 0.95) * 620
sh.line(bx(-0.95), BY, bx(0.20), BY, INK, CONTOUR)                 # плоскость стола
sh.text(bx(-0.95), BY + 22, 'плоскость стола', 11.5, DIM)
sh.path(f'M {bx(-0.80)} {BY} L {bx(-0.20)} {BY} L {bx(-0.20)} {BY + 46} L {bx(-0.80)} {BY + 46} Z', 'none', MID, 1.2, '8 6')
sh.text(bx(-0.50), BY + 66, 'паз 600 (ось движения каретки)', 11.5, DIM, 'middle')

# ход каретки
sh.line(bx(-0.78), BY - 10, bx(-0.22), BY - 10, MID, 1.6, arrow=True)
sh.line(bx(-0.22), BY - 10, bx(-0.78), BY - 10, MID, 1.6, arrow=True)
sh.text(bx(-0.50), BY - 22, 'ход каретки 520', 12, MID, 'middle')

# три положения каретки
for i, X in enumerate((-0.75, -0.50, -0.25)):
    x = bx(X)
    sh.rect(x - 16, BY - 4, 32, 22, '#FFFFFF', INK, 1.6, 3)
    sh.circ(x, BY + 9, 4, INK, INK, 0.8)
    sh.text(x, BY + 40, f'{i + 1}', 11.5, DIM, 'middle')

# стойка + высота
SXX = bx(-0.25)
sh.line(SXX, BY - 4, SXX, BY - 250, INK, CONTOUR)
sh.line(SXX - 55, BY - 60, SXX - 55, BY - 250, DIM, DIMW)
sh.line(SXX - 60, BY - 60, SXX - 50, BY - 60, DIM, DIMW)
sh.line(SXX - 60, BY - 250, SXX - 50, BY - 250, DIM, DIMW)
sh.text(SXX - 66, BY - 155, 'высота 60…180', 12, DIM, 'middle', rot=-90)

# консоль и поворот
sh.line(SXX, BY - 250, SXX - 230, BY - 250, INK, CONTOUR)
sh.text(SXX - 232, BY - 262, 'консоль 230', 11.5, DIM)
sh.path(f'M {SXX - 230} {BY - 250} A 230 230 0 0 1 {SXX - 160} {BY - 30}', 'none', MID, 1.0, '6 5')
sh.path(f'M {SXX - 230} {BY - 250} A 230 230 0 0 0 {SXX + 160} {BY - 30}', 'none', MID, 1.0, '6 5')
sh.line(SXX, BY - 250, SXX + 230, BY - 250, MID, 1.0, '6 5')
sh.text(SXX + 90, BY - 262, 'поворот 360°', 11.5, MID)

# винт
sh.line(SXX - 190, BY - 250, SXX - 190, BY - 60, MID, 1.4, '4 4')
sh.line(SXX - 202, BY - 62, SXX - 178, BY - 62, INK, 3.4)
sh.text(SXX - 300, BY - 56, 'винт: ход 28', 11.5, DIM)

sh.text(60, 700, 'ТРИ ДВИЖЕНИЯ — ТРИ РУЧКИ', 14, INK, 'start', '700')
rows = [('1', 'каретка', 'вдоль паза, 520 мм, стопор-рычаг снизу'),
        ('2', 'стойка', 'по высоте 60…180, фиксация гайкой'),
        ('3', 'консоль', 'поворот 360° вокруг стойки'),
        ('4', 'винт', 'затяжка пяты, ход 28 мм')]
for i, (n, a, b) in enumerate(rows):
    y = 736 + i * 30
    sh.circ(70, y - 4, 10, '#FFFFFF', INK, 1.3)
    sh.text(70, y, n, 11.5, INK, 'middle', '700')
    sh.text(90, y, a, 12.5, INK, 'start', '700')
    sh.text(190, y, b, 12.5, INK)

sh.text(700, 700, 'ЧЕГО В СХЕМЕ НЕТ', 14, INK, 'start', '700')
for i, s in enumerate(['приводов — все положения выставляет человек',
                       'обратной задачи — конечность не «ведут», её кладут и прижимают',
                       'синхронизации с телом — тело лежит, машина подводится к нему']):
    sh.text(700, 736 + i * 30, f'·  {s}', 12.5, INK)
sh.save('sheet3_kinematics')
