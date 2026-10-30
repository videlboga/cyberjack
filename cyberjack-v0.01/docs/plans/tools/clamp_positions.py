"""Схема прижима: план + три панели разрезов (по одному положению в каждой)."""
import os, subprocess

W, H = 1740, 1320
BG = '#F5F7F8'; INK = '#23282E'; LINE = '#454B53'; DIM = '#7C848C'
MAT = '#DEE3E6'; MAT2 = '#C3C9CE'; MET = '#97A0A7'; BODY = '#EDDAD2'; BODY2 = '#D8BCB1'
P = {1: '#2B3138', 2: '#3E6E9E', 3: '#9A5B33'}

S = []
def add(m): S.append(m)
def rect(x, y, w, h, fill='none', stroke=LINE, sw=1.4, rx=0):
    add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
def line(x1, y1, x2, y2, stroke=LINE, sw=1.2, cap='butt'):
    add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="{cap}"/>')
def circ(cx, cy, r, fill='none', stroke=LINE, sw=1.3):
    add(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
def ell(cx, cy, rx, ry, fill, stroke, sw=1.5):
    add(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
def text(x, y, s, size=15, fill=INK, anchor='start', weight='400'):
    add(f'<text x="{x:.1f}" y="{y:.1f}" font-family="DejaVu Sans" font-size="{size}" fill="{fill}" text-anchor="{anchor}" font-weight="{weight}">{s}</text>')
def dimh(x1, x2, y, label, above=-9):
    line(x1, y, x2, y, DIM, 1.0)
    line(x1, y - 5, x1, y + 5, DIM, 1.0); line(x2, y - 5, x2, y + 5, DIM, 1.0)
    text((x1 + x2) / 2, y + above, label, 12.5, DIM, 'middle')
def dimv(x, y1, y2, label, side=13):
    line(x, y1, x, y2, DIM, 1.0)
    line(x - 5, y1, x + 5, y1, DIM, 1.0); line(x - 5, y2, x + 5, y2, DIM, 1.0)
    add(f'<text x="{x + side:.1f}" y="{(y1 + y2) / 2:.1f}" font-family="DejaVu Sans" font-size="12.5" fill="{DIM}" text-anchor="middle" transform="rotate(-90 {x + side:.1f} {(y1 + y2) / 2:.1f})">{label}</text>')

add(f'<rect width="{W}" height="{H}" fill="{BG}"/>')
text(44, 50, 'Фиксатор: прижим — положения механизма', 26, INK, 'start', '700')
text(44, 76, 'На каждую конечность: каретка по пазу · стойка по высоте · консоль поворотная · винт с пятой', 13.5, DIM)

# ═════ ПЛАН ═════
OX, OY, K = 120, 160, 0.46
def px(X): return OX + (X + 0.95) * 1000 * K
def py(Y): return OY + (0.36 - Y) * 1000 * K
text(OX, OY - 20, 'ПЛАН: четыре паза, четыре узла, три положения каретки (левая рука)', 14, INK, 'start', '700')
rect(px(-0.95), py(0.36), 1900 * K, 720 * K, MAT, INK, 2.0, 5)
for (x0, x1, yc) in [(-0.80, -0.20, 0.30), (-0.80, -0.20, -0.30), (0.30, 0.90, 0.30), (0.30, 0.90, -0.30)]:
    rect(px(x0), py(yc + 0.07), (x1 - x0) * 1000 * K, 140 * K, BG, INK, 1.5, 32 * K)
ell(px(-0.79), py(0), 50 * K, 74 * K, BODY, BODY2, 1.5)
add(f'<path d="M {px(-0.70):.1f} {py(0.18):.1f} Q {px(-0.40):.1f} {py(0.21):.1f} {px(-0.02):.1f} {py(0.15):.1f} '
    f'L {px(0.10):.1f} {py(0.14):.1f} Q {px(0.16):.1f} {py(0):.1f} {px(0.10):.1f} {py(-0.14):.1f} '
    f'L {px(-0.02):.1f} {py(-0.15):.1f} Q {px(-0.40):.1f} {py(-0.21):.1f} {px(-0.70):.1f} {py(-0.18):.1f} Z" '
    f'fill="{BODY}" stroke="{BODY2}" stroke-width="1.5"/>')
for sgn in (1, -1):
    line(px(0.72), py(sgn * 0.10), px(0.80), py(sgn * 0.32), BODY2, 32 * K, cap='round')
    circ(px(0.81), py(sgn * 0.33), 15 * K, BODY2, BODY2, 1.0)

for i, (X, col, nm) in enumerate([(-0.75, P[1], 'вдоль тела'), (-0.50, P[2], 'отведена'), (-0.30, P[3], 'к голове')]):
    cx, cy = px(X), py(0.30)
    rect(cx - 13, cy - 13, 26, 26, '#FFFFFF', col, 1.8, 5)
    circ(cx, cy, 5.5, MET, col, 1.3)
    rect(cx - 11, cy - 21, 22, 7, col, col, 0.8, 3)
    circ(px(-0.02), py(0.30) - 0, 0.1, col, col)          # точка отсчёта
    text(cx, cy + 34, f'{i + 1}', 12.5, col, 'middle', '700')

text(px(-0.95) + 8, py(-0.36) + 16, 'стол 1900 × 720 · пазы 600 × 140 сквозные · ложе под спину, таз, конечности', 11.5, DIM)

# ═════ ТРИ ПАНЕЛИ ═════
PY0 = 620
PANELS = [
    (1, 'ПОЛОЖЕНИЕ 1 — рука вдоль тела', -0.75, 60, 'каретка у головы · стойка 60 · консоль над ложем · винт 18'),
    (2, 'ПОЛОЖЕНИЕ 2 — рука отведена', -0.50, 110, 'каретка в середине · стойка 110 · консоль повёрнута · винт 18'),
    (3, 'ПОЛОЖЕНИЕ 3 — рука к голове', -0.30, 170, 'каретка у торца · стойка 170 · консоль над ложем · винт 18'),
]
PW, GAP = 520, 40
for idx, (n, title, X, hgt, note) in enumerate(PANELS):
    col = P[n]
    X0 = 60 + idx * (PW + GAP)
    SY = PY0 + 195              # плоскость стола
    k = 0.42                    # px/мм
    def sx(Xm, X0=X0): return X0 + 60 + (Xm + 0.95) * 1000 * k
    def sz(mm, SY=SY, k=k): return SY - mm * k

    rect(X0, PY0 - 30, PW, 350, '#FFFFFF', '#D3D9DD', 1.2, 8)
    text(X0 + 16, PY0 - 6, title, 13.5, col, 'start', '700')
    text(X0 + 16, PY0 + 12, note, 11, DIM)

    # стол с пазом
    rect(sx(-0.95), SY, 0.75 * 1000 * k, 130 * k, MAT, INK, 1.4, 2)
    rect(sx(-0.20), SY, 0.75 * 1000 * k, 130 * k, MAT, INK, 1.4, 2)
    rect(sx(-0.80), SY, 0.60 * 1000 * k, 130 * k, BG, INK, 1.2)
    line(sx(-0.95), SY, sx(0.00), SY, INK, 1.8)
    line(sx(0.00), SY, sx(0.00), SY + 130 * k, INK, 1.4)
    line(sx(-0.95), SY, sx(-0.95), SY + 130 * k, INK, 1.4)
    line(sx(-0.95), SY + 130 * k, sx(0.00), SY + 130 * k, INK, 1.4)

    # ложе
    add(f'<path d="M {sx(X - 0.06):.1f} {SY} q 0 -28 42 -28 q 42 0 42 28 Z" fill="{MAT2}" stroke="{INK}" stroke-width="1.1"/>')

    # каретка
    rect(sx(X) - 50 * k, SY + 130 * k + 4, 200 * k, 70 * k, '#FFFFFF', col, 1.6, 3)
    circ(sx(X), SY + 130 * k + 39 * k, 6, MET, col, 1.2)
    # направляющая
    line(sx(-0.90), SY + 130 * k + 74 * k, sx(-0.05), SY + 130 * k + 74 * k, INK, 4)
    # стойка
    rect(sx(X) - 14, sz(hgt), 28, hgt * k + 130 * k + 4, MET, col, 1.4, 2)
    # консоль
    rect(sx(X) - 120 * k, sz(hgt) - 10, 190 * k, 10, '#FFFFFF', col, 1.6, 3)
    # винт, гайка, маховик, пята
    vx = sx(X) - 40 * k
    rect(vx - 4, sz(hgt), 8, hgt * k - 18 * k, MET, col, 1.2)
    rect(vx - 16, sz(hgt) - 18, 32, 12, '#FFFFFF', col, 1.3, 2)
    line(vx, sz(18), vx, sz(12), col, 3)
    rect(vx - 16, sz(12), 32, 7, MET, col, 1.2, 2)
    # конечность
    ell(vx, sz(6), 34, 15, BODY, BODY2, 1.5)

    dimv(sx(-0.90), SY, sz(hgt), str(hgt))
    dimh(sx(-0.80), sx(-0.20), SY + 190, '600', -8)

# низ — подписи
text(60, 1180, 'ЧТО ДВИГАЕТ ЧЕЛОВЕК (на каждую конечность)', 15, INK, 'start', '700')
for i, s in enumerate(['каретку — вдоль паза, стопор-рычаг снизу',
                       'стойку — по высоте 60…180, фиксация гайкой',
                       'консоль — поворот вокруг стойки на 360°',
                       'винт — затяжка пяты, ход 28 мм']):
    text(60, 1212 + i * 24, f'{i + 1}.  {s}', 13, INK)

text(980, 1180, 'ЧЕГО НЕТ (осознанно)', 15, INK, 'start', '700')
for i, s in enumerate(['нет приводов: положения выставляет человек',
                       'нет синхронной анимации тела и машины',
                       'нет колец: конечность прижата к ложу, а не надета на штангу']):
    text(980, 1212 + i * 24, f'{i + 1}.  {s}', 13, INK)

add('</svg>')
svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">' + ''.join(S)
out = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/drawings'
open(os.path.join(out, 'clamp_positions.svg'), 'w', encoding='utf-8').write(svg)
subprocess.run(['rsvg-convert', '-w', str(int(W * 1.7)), '-h', str(int(H * 1.7)),
                os.path.join(out, 'clamp_positions.svg'), '-o', os.path.join(out, 'clamp_positions.png')], check=True)
print('OK')
