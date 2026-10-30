"""Чертёж узла прижима: план 1:2 (0.5 px/мм) + разрез 1:1 (1 px/мм)."""
import os, subprocess

W, H = 1720, 1560
BG = '#F4F6F7'; INK = '#2A2F35'; LINE = '#4A5058'; DIM = '#79818A'
MAT = '#DDE2E5'; MAT2 = '#C4CACF'; MET = '#98A1A8'; BODY = '#EBD8D0'; BODY2 = '#DCC3B9'

S = []
def add(m): S.append(m)
def rect(x, y, w, h, fill='none', stroke=LINE, sw=1.4, rx=0, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ''
    add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')
def line(x1, y1, x2, y2, stroke=LINE, sw=1.2, dash=None, cap='butt'):
    d = f' stroke-dasharray="{dash}"' if dash else ''
    add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="{cap}"{d}/>')
def circ(cx, cy, r, fill='none', stroke=LINE, sw=1.3):
    add(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
def text(x, y, s, size=15, fill=INK, anchor='start', weight='400'):
    add(f'<text x="{x:.1f}" y="{y:.1f}" font-family="DejaVu Sans" font-size="{size}" fill="{fill}" text-anchor="{anchor}" font-weight="{weight}">{s}</text>')
def dimh(x1, x2, y, label, above=-9, size=13):
    line(x1, y, x2, y, DIM, 1.0)
    line(x1, y - 5, x1, y + 5, DIM, 1.0); line(x2, y - 5, x2, y + 5, DIM, 1.0)
    text((x1 + x2) / 2, y + above, label, size, DIM, 'middle')
def dimv(x, y1, y2, label, side=-9):
    line(x, y1, x, y2, DIM, 1.0)
    line(x - 5, y1, x + 5, y1, DIM, 1.0); line(x - 5, y2, x + 5, y2, DIM, 1.0)
    add(f'<text x="{x + side:.1f}" y="{(y1 + y2) / 2:.1f}" font-family="DejaVu Sans" font-size="13" fill="{DIM}" '
        f'text-anchor="middle" transform="rotate(-90 {x + side:.1f} {(y1 + y2) / 2:.1f})">{label}</text>')
def callout(cx, cy, tx, ty, n, r=12):
    line(cx, cy, tx, ty, INK, 1.1)
    circ(cx, cy, 3.4, INK, INK)
    circ(tx, ty, r, '#FFFFFF', INK, 1.5)
    text(tx, ty + 5, str(n), 13, INK, 'middle', '700')

add(f'<rect width="{W}" height="{H}" fill="{BG}"/>')
text(44, 48, 'Фиксатор: узел прижима', 28, INK, 'start', '700')
text(44, 74, 'Стол 1900 × 720 · столешница 130 · четыре сквозных паза 140 · план 1:2, разрез 1:1', 14, DIM)

# ═════════════ ПЛАН 1:2 ═════════════
K = 0.5
OX, OY = 150, 170
def px(X): return OX + (X + 0.95) * 500
def py(Y): return OY + (0.36 - Y) * 500

text(OX, OY - 22, 'ПЛАН СТОЛА 1:2', 15, INK, 'start', '700')
rect(px(-0.95), py(0.36), 950, 360, MAT, LINE, 2.0, 4)
text(px(-0.95) + 470, py(-0.36) + 26, 'столешница 1900 × 720', 12.5, DIM, 'middle')

SLOTS = {'Руки Л': (-0.80, -0.20, 0.30), 'Руки П': (-0.80, -0.20, -0.30),
         'Ноги Л': (0.30, 0.90, 0.30), 'Ноги П': (0.30, 0.90, -0.30)}
for nm, (x0, x1, yc) in SLOTS.items():
    x, y = px(x0), py(yc + 0.07)
    w, h = (x1 - x0) * 500, 70
    rect(x, y, w, h, BG, INK, 1.6, h / 2)
    text(x + w / 2, y - 7, nm, 12, DIM, 'middle')

# силуэт тела: голова, торс, таз, конечности
add(f'<ellipse cx="{px(-0.79):.1f}" cy="{py(0):.1f}" rx="50" ry="74" fill="{BODY}" stroke="{BODY2}" stroke-width="1.6"/>')
add(f'<path d="M {px(-0.70):.1f} {py(0.18):.1f} Q {px(-0.40):.1f} {py(0.21):.1f} {px(-0.02):.1f} {py(0.15):.1f} '
    f'L {px(0.10):.1f} {py(0.14):.1f} Q {px(0.16):.1f} {py(0):.1f} {px(0.10):.1f} {py(-0.14):.1f} '
    f'L {px(-0.02):.1f} {py(-0.15):.1f} Q {px(-0.40):.1f} {py(-0.21):.1f} {px(-0.70):.1f} {py(-0.18):.1f} Z" '
    f'fill="{BODY}" stroke="{BODY2}" stroke-width="1.6"/>')
for sgn in (1, -1):
    line(px(-0.06), py(sgn * 0.16), px(-0.04), py(sgn * 0.30), BODY2, 30, cap='round')
    line(px(0.72), py(sgn * 0.10), px(0.80), py(sgn * 0.32), BODY2, 34, cap='round')
    circ(px(-0.03), py(sgn * 0.31), 12, BODY2, BODY2, 1.0)
    circ(px(0.81), py(sgn * 0.33), 16, BODY2, BODY2, 1.0)

for nm, (x0, x1, yc) in SLOTS.items():
    cx, cy = px(x1 - 0.12), py(yc)
    rect(cx - 34, cy - 34, 68, 68, '#FFFFFF', INK, 1.8, 8)
    circ(cx, cy, 13, MET, INK, 1.4)
    circ(cx, cy, 4, '#FFFFFF', INK, 1.0)
    oy = -1 if yc > 0 else 1
    line(cx, cy, cx, cy + oy * 40, INK, 4.0)
    rect(cx - 30, cy + oy * 46 - (7 if oy < 0 else 0), 60, 14, INK, INK, 1.0, 7)

callout(px(0.78), py(0.30), px(0.78) + 210, py(0.30) + 96, 1)
callout(px(-0.55), py(0.36) - 4, px(-0.55) - 150, py(0.36) - 60, 2)
callout(px(0.30) + 6, py(-0.30), px(0.30) + 150, py(-0.30) + 120, 3)
callout(px(-0.35), py(0.02), px(-0.35) - 40, py(0.02) + 236, 4)

# ═════════════ РАЗРЕЗ 1:1 ═════════════
SY = 900                 # плоскость стола
CX = 470                 # ось разреза
text(OX, 566, 'РАЗРЕЗ А–А ПО УЗЛУ 1:1', 15, INK, 'start', '700')
text(OX, 588, 'поперёк стола, по оси паза; конечность (голень ⌀80) лежит в ложе', 12.5, DIM)

# столешница
rect(CX - 380, SY, 760, 130, MAT, INK, 2.0, 3)
rect(CX + 70, SY - 1, 140, 132, BG, INK, 1.6)
line(CX + 70, SY, CX + 70, SY + 130, INK, 1.6)
line(CX + 210, SY, CX + 210, SY + 130, INK, 1.6)
# ложе
add(f'<path d="M {CX - 150} {SY} q 0 -52 92 -52 q 92 0 92 52 Z" fill="{MAT2}" stroke="{INK}" stroke-width="1.4"/>')

# каретка + направляющая под столом
rect(CX + 10, SY + 138, 230, 74, 'none', INK, 1.8, 6)
rect(CX + 26, SY + 138, 74, 74, MET, INK, 1.4, 4)
circ(CX + 63, SY + 175, 11, '#FFFFFF', INK, 1.4)
rect(CX - 40, SY + 206, 320, 18, 'none', INK, 1.6, 8)
circ(CX + 63, SY + 215, 9, MET, INK, 1.2)

# стойка сквозь паз
rect(CX + 105, SY - 120, 40, 258, MET, INK, 1.6, 3)
line(CX + 105, SY - 120, CX + 105, SY + 138, INK, 1.3)
line(CX + 145, SY - 120, CX + 145, SY + 138, INK, 1.3)
rect(CX + 96, SY - 16, 58, 32, 'none', INK, 1.6, 4)     # втулка в пазу

# консоль, винт, пята
rect(CX - 100, SY - 132, 230, 24, 'none', INK, 1.8, 5)
rect(CX - 96, SY - 148, 26, 48, INK, INK, 1.0, 5)
rect(CX - 62, SY - 78, 14, 122, MET, INK, 1.6, 2)
rect(CX - 84, SY - 214, 58, 18, 'none', INK, 1.6, 4)
circ(CX - 55, SY - 232, 20, '#FFFFFF', INK, 1.8)
circ(CX - 55, SY - 232, 6, INK, INK, 1.0)
line(CX - 75, SY - 232, CX - 35, SY - 232, MET, 5)
rect(CX - 88, SY - 60, 62, 16, MET, INK, 1.6, 4)        # пята
rect(CX - 78, SY - 48, 42, 12, '#B9A39A', INK, 1.2, 4)  # подушка пяты

# конечность
add(f'<ellipse cx="{CX - 57:.1f}" cy="{SY - 24:.1f}" rx="44" ry="30" fill="{BODY}" stroke="{BODY2}" stroke-width="1.8"/>')

# размеры
dimh(CX - 62, CX - 48, SY - 96, '14', -8, 12)          # винт
dimv(CX + 290, SY - 120, SY, '120', 14)
dimv(CX + 340, SY, SY + 130, '130', 16)
dimv(CX + 380, SY + 138, SY + 212, '74', 16)
dimh(CX + 70, CX + 210, SY + 250, '140', 20)
dimh(CX - 380, CX + 380, SY + 300, '760 (участок стола)', 20)
dimv(CX - 210, SY - 60, SY - 4, '~50', -12)
dimh(CX - 100, CX + 130, SY - 176, 'консоль 230', -10)

callout(CX + 130, SY - 100, CX + 430, SY - 160, 5)
callout(CX + 63, SY + 175, CX + 470, SY + 120, 6)
callout(CX - 55, SY - 232, CX - 300, SY - 290, 7)
callout(CX - 57, SY - 24, CX - 330, SY - 40, 8)

# ═════════════ ЛЕГЕНДА ═════════════
LY = 1300
text(44, LY, 'ОБОЗНАЧЕНИЯ', 15, INK, 'start', '700')
items = [
    'каретка: едет по пазу вдоль стола, стопор-рычаг снизу',
    'паз сквозной 140: стойка проходит сквозь столешницу',
    'паз в столе — отверстие, не выемка на поверхности',
    'тело лежит в ложах (спина, таз, голени, предплечья)',
    'консоль поворотная: подводит прижим над конечностью',
    'стойка ⌀40: задаёт высоту консоли, ход 120',
    'винтовой прижим с маховиком: опускает пяту на конечность',
    'пята с подушкой: прижимает конечность к ложу, не кольцо',
]
for i, s in enumerate(items):
    col, row = i % 2, i // 2
    cx = 44 + col * 830; cy = LY + 34 + row * 30
    circ(cx + 12, cy - 5, 11, '#FFFFFF', INK, 1.4)
    text(cx + 12, cy, str(i + 1), 12.5, INK, 'middle', '700')
    text(cx + 32, cy, s, 13.5, INK)

add('</svg>')
svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">' + ''.join(S)
out = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/drawings'
open(os.path.join(out, 'clamp_unit.svg'), 'w', encoding='utf-8').write(svg)
subprocess.run(['rsvg-convert', '-w', str(int(W * 1.8)), '-h', str(int(H * 1.8)),
                os.path.join(out, 'clamp_unit.svg'), '-o', os.path.join(out, 'clamp_unit.png')], check=True)
print('OK')
