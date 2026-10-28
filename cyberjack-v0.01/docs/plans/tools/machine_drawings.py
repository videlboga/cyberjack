"""Чертежи станка «ОМНИ-1» (платформа с карданом и выносными креплениями).

Генерирует SVG (мм → px по масштабу) и конвертирует в PNG через rsvg-convert.
Всё в миллиметрах; на листах проставлены размеры и рамка с основной надписью.

Запуск: python3 tools/machine_drawings.py
"""
import os, subprocess

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/drawings'

# --- размеры станка (мм) ------------------------------------------------------
BASE_L, BASE_W = 1400, 1000
COL_D, COL_H = 168, 520
PLAT_L, PLAT_W, PLAT_T = 1900, 640, 80
MAT_L, MAT_W, MAT_T = 1860, 600, 50
SLOT_W = 100
SLOT_L_Y = 210          # ось продольных пазов по Y
SLOT_LEN = 1560
CROSS_X = 700           # поперечные пазы на ножном конце
CROSS_LEN = 410
CROSS_X_HEAD = -700     # поперечные пазы у изголовья
CROSS_LEN_HEAD = 370
RING_WRIST, RING_ANKLE = 90, 120
ROD_D1, ROD_D2 = 32, 22
BOOM_STROKE = 700       # выносная горизонтальная штанга (шпагат, руки в стороны)
Y_SPLIT = 900           # полураствор полного шпагата при ноге 900 мм
Y_ARMS_OUT = 780        # кисти в стороны
CROSS_Y0, CROSS_Y1 = 60, 320   # поперечный паз открыт до кромки платформы


class Sheet:
    def __init__(self, name, w_mm, h_mm, scale=0.42, title='', center=(0, 0), tb='br'):
        self.name, self.scale = name, scale
        self.W, self.H = int(w_mm * scale), int(h_mm * scale)
        self.cx, self.cy = center
        self.tb = tb
        self.bbox = [1e9, 1e9, -1e9, -1e9]   # x0, y0, x1, y1 в мм
        self.parts = []
        self.title = title

    def _track(self, x, y):
        b = self.bbox
        b[0] = min(b[0], x); b[1] = min(b[1], y)
        b[2] = max(b[2], x); b[3] = max(b[3], y)

    def _p(self, x, y):
        """мировые мм → пиксели листа; точка center попадает в центр листа"""
        self._track(x, y)
        return (self.W / 2 + (x - self.cx) * self.scale,
                self.H / 2 - (y - self.cy) * self.scale)

    def line(self, x1, y1, x2, y2, w=1.0, dash=None, color='#111'):
        a, b = self._p(x1, y1), self._p(x2, y2)
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.parts.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" '
                          f'stroke="{color}" stroke-width="{w}"{d}/>')

    def rect(self, x, y, w, h, fill='none', stroke='#111', sw=1.0, dash=None):
        a = self._p(x, y + h)
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.parts.append(f'<rect x="{a[0]:.1f}" y="{a[1]:.1f}" width="{w * self.scale:.1f}" '
                          f'height="{h * self.scale:.1f}" fill="{fill}" stroke="{stroke}" '
                          f'stroke-width="{sw}"{d}/>')

    def circle(self, cx, cy, r, fill='none', stroke='#111', sw=1.0, dash=None, color=None):
        a = self._p(cx, cy)
        d = f' stroke-dasharray="{dash}"' if dash else ''
        st = color or stroke
        self.parts.append(f'<circle cx="{a[0]:.1f}" cy="{a[1]:.1f}" r="{r * self.scale:.1f}" '
                          f'fill="{fill}" stroke="{st}" stroke-width="{sw}"{d}/>')

    def poly(self, pts, fill='none', stroke='#111', sw=1.0, dash=None, color=None):
        st = color or stroke
        d = ' '.join(f'{self._p(x, y)[0]:.1f},{self._p(x, y)[1]:.1f}' for x, y in pts)
        da = f' stroke-dasharray="{dash}"' if dash else ''
        self.parts.append(f'<polygon points="{d}" fill="{fill}" stroke="{st}" '
                          f'stroke-width="{sw}"{da}/>')

    def text(self, x, y, s, size=12, anchor='start', color='#111', weight='normal'):
        a = self._p(x, y)
        self.parts.append(f'<text x="{a[0]:.1f}" y="{a[1]:.1f}" font-family="DejaVu Sans" '
                          f'font-size="{size}" fill="{color}" text-anchor="{anchor}" '
                          f'font-weight="{weight}">{s}</text>')

    def dim(self, x1, y1, x2, y2, label, off=0, vertical=False, size=11):
        """размерная линия с засечками и подписью"""
        self.line(x1, y1, x2, y2, w=0.7, color='#555')
        if vertical:
            self.line(x1 - 60, y1, x1 + 60, y1, w=0.7, color='#555')
            self.line(x2 - 60, y2, x2 + 60, y2, w=0.7, color='#555')
            mx, my = (x1 + x2) / 2 + off, (y1 + y2) / 2
            self.text(mx, my, label, size=size, anchor='middle', color='#333')
        else:
            self.line(x1, y1 - 60, x1, y1 + 60, w=0.7, color='#555')
            self.line(x2, y2 - 60, x2, y2 + 60, w=0.7, color='#555')
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2 + off
            self.text(mx, my, label, size=size, anchor='middle', color='#333')

    def fit_transform(self, pad=26, tb_w=380, tb_h=96):
        """масштаб и сдвиг, чтобы содержимое не лезло под рамку и основную надпись"""
        x0, y0 = self._p(self.bbox[0], self.bbox[3])
        x1, y1 = self._p(self.bbox[2], self.bbox[1])
        # сбрасываем трекинг от служебных вызовов
        safe_x0, safe_y0 = pad, pad
        safe_x1, safe_y1 = self.W - pad, self.H - pad
        if self.tb == 'bl':
            safe_x0 = pad + 380
        w, h = x1 - x0, y1 - y0
        avail_w = safe_x1 - safe_x0
        avail_h = safe_y1 - safe_y0 - tb_h * 0.55
        s = min(1.0, avail_w / w if w else 1.0, avail_h / h if h else 1.0)
        # центр безопасной зоны
        ccx = (safe_x0 + safe_x1) / 2
        ccy = (safe_y0 + safe_y1 - tb_h * 0.55) / 2
        dx = ccx - (x0 + w / 2) * s
        dy = ccy - (y0 + h / 2) * s
        return f'translate({dx:.1f},{dy:.1f}) scale({s:.4f})'

    def render(self):
        frame = (f'<rect x="8" y="8" width="{self.W - 16}" height="{self.H - 16}" fill="#fdfdfb" '
                 f'stroke="#111" stroke-width="1.6"/>')
        tb_w, tb_h = 380, 96
        tx = 16 if self.tb == 'bl' else self.W - 16 - tb_w
        ty = self.H - 16 - tb_h
        tb = (f'<rect x="{tx}" y="{ty}" width="{tb_w}" height="{tb_h}" '
              f'fill="#fdfdfb" stroke="#111" stroke-width="1.2"/>')
        tt = ''.join(
            f'<text x="{tx + 10}" y="{ty + 22 + i * 22}" '
            f'font-family="DejaVu Sans" font-size="12" fill="#111">{t}</text>'
            for i, t in enumerate(self.title.split('|')))
        tf = self.fit_transform()
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.W}" height="{self.H}" '
               f'viewBox="0 0 {self.W} {self.H}">{frame}{tb}{tt}'
               f'<g transform="{tf}">{"".join(self.parts)}</g></svg>')
        return svg

    def save(self):
        os.makedirs(OUT, exist_ok=True)
        svg_path = os.path.join(OUT, self.name + '.svg')
        png_path = os.path.join(OUT, self.name + '.png')
        with open(svg_path, 'w') as f:
            f.write(self.render())
        subprocess.run(['rsvg-convert', '-w', str(self.W * 2), '-o', png_path, svg_path], check=True)
        print('DRAW', svg_path, '->', png_path)


# --- 1. ПЛАН -----------------------------------------------------------------
def plan():
    s = Sheet('m1_plan', 3000, 2200, scale=0.5, center=(0, 0), tb='bl',
              title='ОМНИ-1 · ПЛАН ПЛАТФОРМЫ|М 1:10 · размеры в мм|лист 1 из 5')
    # платформа
    s.rect(-PLAT_L / 2, -PLAT_W / 2, PLAT_L, PLAT_W, fill='#f2f3f5', sw=1.6)
    s.rect(-MAT_L / 2, -MAT_W / 2, MAT_L, MAT_W, fill='#e9ebee', sw=1.0)
    # продольные пазы
    for sy in (-1, 1):
        s.rect(-SLOT_LEN / 2, sy * SLOT_L_Y - SLOT_W / 2, SLOT_LEN, SLOT_W, fill='#ffffff', sw=1.2)
    # поперечные пазы (ножной конец — шпагат, изголовье — руки вверх)
    for sy in (-1, 1):
        # поперечные пазы открыты до кромки: штанга выходит за габарит
        s.rect(CROSS_X - SLOT_W / 2, sy * CROSS_Y0, SLOT_W, CROSS_Y1 - CROSS_Y0,
               fill='#ffffff', sw=1.2)
        s.rect(CROSS_X_HEAD - SLOT_W / 2, sy * CROSS_Y0, SLOT_W, CROSS_Y1 - CROSS_Y0,
               fill='#ffffff', sw=1.2)
    # кардан под платформой
    s.circle(0, 0, 150, dash='12 8', color='#666')
    s.circle(0, 0, 60, dash='6 6', color='#666')
    # крепления: кольца в двух положениях
    def ring(x, y, r, label, dashed=False):
        s.circle(x, y, r, stroke='#0b6f66' if not dashed else '#7fb3ad',
                 sw=1.6 if not dashed else 1.0, dash=None if not dashed else '8 6')
        if label:
            s.text(x, y - r - 14, label, size=11, anchor='middle',
                   color='#0b6f66' if not dashed else '#7fb3ad')

    for sy, name in ((-1, 'Л'), (1, 'П')):
        # руки: вдоль тела / вверх / в стороны (выносной штангой)
        ring(-40, sy * SLOT_L_Y, RING_WRIST / 2, f'кисть {name}', dashed=True)
        ring(-690, sy * SLOT_L_Y, RING_WRIST / 2, f'кисть {name} вверх')
        s.line(-300, sy * SLOT_L_Y, -300, sy * Y_ARMS_OUT, w=1.2, color='#0b6f66')
        ring(-300, sy * Y_ARMS_OUT, RING_WRIST / 2, f'кисть {name} в стороны')
        # стопы: вместе / полный шпагат на выносной штанге
        ring(CROSS_X, sy * 120, RING_ANKLE / 2, f'стопа {name}', dashed=True)
        s.line(CROSS_X, sy * 120, CROSS_X, sy * Y_SPLIT, w=1.4, color='#b3541e')
        s.rect(CROSS_X - 18, sy * 300 if sy > 0 else -sy * 300 - 0, 36, 0,
               fill='none', sw=0)
        ring(CROSS_X, sy * Y_SPLIT, RING_ANKLE / 2, '', dashed=False)
        s.text(CROSS_X, sy * Y_SPLIT + (95 if sy > 0 else -95),
               f'стопа {name} — шпагат {Y_SPLIT * 2}', size=11, anchor='middle', color='#b3541e')
        s.text(CROSS_X + 130, sy * 640, 'выносная штанга, ход 700', size=10, color='#b3541e')
    # размеры
    s.dim(-PLAT_L / 2, -PLAT_W / 2 - 90, PLAT_L / 2, -PLAT_W / 2 - 90, '1900', off=-14)
    s.dim(PLAT_L / 2 + 90, -PLAT_W / 2, PLAT_L / 2 + 90, PLAT_W / 2, '640', off=-16, vertical=True)
    s.dim(-SLOT_LEN / 2, PLAT_W / 2 + 70, SLOT_LEN / 2, PLAT_W / 2 + 70, '1560', off=-14)
    s.dim(-PLAT_L / 2 - 230, -Y_SPLIT, -PLAT_L / 2 - 230, Y_SPLIT, f'{Y_SPLIT * 2} — шпагат',
          off=-34, vertical=True)
    s.dim(-SLOT_LEN / 2, -PLAT_W / 2 - 130, SLOT_LEN / 2, -PLAT_W / 2 - 130, '1560', off=-14)
    s.text(-PLAT_L / 2 + 20, PLAT_W / 2 + 150,
           'продольные пазы 1560 × 100 при y=±210 · поперечные открыты до кромки (штанга выходит за габарит)', size=12)
    s.text(-PLAT_L / 2 + 20, PLAT_W / 2 + 120,
           'зелёным — кольца в крайних положениях (сплошной — рабочее, штрих — крайнее)', size=11, color='#555')
    return s.save()


# --- 2. ВИД СБОКУ -------------------------------------------------------------
def side():
    s = Sheet('m1_side', 3100, 3100, scale=0.33, center=(0, 1100),
              title='ОМНИ-1 · ВИД СБОКУ|М 1:10 · размеры в мм|лист 2 из 5')
    z0 = 120
    COL_H = 620
    # основание
    s.rect(-BASE_L / 2, 0, BASE_L, z0, fill='#eef0f2', sw=1.4)
    for x in (-BASE_L / 2 + 80, BASE_L / 2 - 80):
        s.circle(x, 30, 40, fill='#dfe2e5')
    # стойка
    s.rect(-COL_D / 2, z0, COL_D, COL_H, fill='#e4e7ea', sw=1.2)
    z2 = z0 + COL_H
    s.rect(-60, z2, 120, 260, fill='#dfe3e7', sw=1.2)
    # кардан
    zc = z2 + 260
    s.circle(0, zc, 150, dash='10 7', color='#555')
    s.circle(0, zc, 26, fill='#cfd4d8')
    # платформа горизонтально
    s.rect(-PLAT_L / 2, zc, PLAT_L, PLAT_T, fill='#f4f5f7', sw=1.4)
    s.rect(-MAT_L / 2, zc + PLAT_T, MAT_L, MAT_T, fill='#e9ebec', sw=1.0)
    # платформа при 90° — поворот вокруг центра кардана
    s.poly([(-PLAT_T / 2, zc - PLAT_L / 2), (PLAT_T / 2, zc - PLAT_L / 2),
            (PLAT_T / 2, zc + PLAT_L / 2), (-PLAT_T / 2, zc + PLAT_L / 2)],
           dash='10 8', stroke='#9aa2a8', sw=1.2)
    s.circle(0, zc, PLAT_L / 2, dash='3 9', color='#c3c9ce')
    s.text(PLAT_T / 2 + 30, zc + PLAT_L / 2 - 30, 'платформа при 90°', size=11, color='#7b848b')
    s.text(PLAT_T / 2 + 30, zc + PLAT_L / 2 - 55, f'верх {int(zc + PLAT_L / 2)} мм от пола', size=10,
           color='#9aa2a8')
    # телескопы под платформой
    for x in (-620, 620):
        s.rect(x - ROD_D1 / 2, zc - 300, ROD_D1, 300, fill='#d8dce0', sw=1.0)
        s.rect(x - ROD_D2 / 2, zc - 300 - 180, ROD_D2, 180, fill='#cfd4d9', sw=1.0)
        s.circle(x, zc - 300 - 180, 30, stroke='#0b6f66')
        s.text(x + 40, zc - 300 - 180, 'кольцо', size=10, color='#0b6f66')
    # размеры
    s.dim(-BASE_L / 2, -70, BASE_L / 2, -70, '1400', off=-16)
    s.dim(-PLAT_L / 2, zc + PLAT_T + MAT_T + 130, PLAT_L / 2, zc + PLAT_T + MAT_T + 130, '1900', off=16)
    s.dim(-PLAT_L / 2 - 90, 0, -PLAT_L / 2 - 90, zc, f'{zc} — ось кардана', off=-24, vertical=True)
    s.text(-PLAT_L / 2, zc + PLAT_L + 200,
           'кардан: тангаж ±90°, крен ±90° · телескопы: ход 240 мм, шарнир ±75°', size=12)
    return s.save()


# --- 3. РАЗРЕЗ А-А ----------------------------------------------------------
def section():
    s = Sheet('m1_section', 1750, 1900, scale=0.7, center=(0, -240),
              title='ОМНИ-1 · РАЗРЕЗ А-А|М 1:5 · узел крепления|лист 3 из 5')
    # платформа в разрезе
    s.rect(-400, 0, 800, PLAT_T, fill='#f2f3f5', sw=1.4)
    s.rect(-390, PLAT_T, 780, MAT_T, fill='#e9ebec', sw=1.0)
    # паз
    s.rect(-SLOT_W / 2, 0, SLOT_W, PLAT_T + MAT_T, fill='#ffffff', sw=1.2)
    s.text(SLOT_W / 2 + 16, PLAT_T + MAT_T + 26, 'паз 100', size=11)
    # каретка под пазом
    s.rect(-110, -70, 220, 70, fill='#dfe3e7', sw=1.2)
    s.circle(0, -110, 34, fill='#cfd4d8')
    s.text(130, -90, 'каретка (ход по X)', size=11)
    # штанга телескоп + кольцо
    s.rect(-ROD_D1 / 2, -300, ROD_D1, 230, fill='#e1e5e9', sw=1.1)
    s.rect(-ROD_D2 / 2, -300 + 230, ROD_D2, 0, fill='none', sw=0)
    s.rect(-ROD_D2 / 2, -540, ROD_D2, 240, fill='#d6dade', sw=1.1)
    s.circle(0, -590, RING_WRIST / 2 + 6, stroke='#0b6f66', sw=1.6)
    s.circle(0, -590, RING_WRIST / 2, stroke='#0b6f66', sw=1.0, dash='6 5')
    s.text(RING_WRIST / 2 + 20, -560, 'кольцо 90 (запястье)', size=11, color='#0b6f66')
    s.text(ROD_D1 / 2 + 14, -380, 'штанга ⌀32/⌀22', size=11)
    # шарнир
    s.circle(0, -300, 30, stroke='#b3541e', sw=1.4)
    s.text(40, -296, 'шарнир ±75°', size=11, color='#b3541e')
    # размеры
    s.dim(-ROD_D1 / 2 - 120, -300, -ROD_D1 / 2 - 120, -540, '240 (ход)', off=-22, vertical=True)
    s.dim(RING_WRIST / 2 + 90, -590, RING_WRIST / 2 + 90, 0, '590..330', off=26, vertical=True)
    s.dim(-SLOT_W / 2, PLAT_T + MAT_T + 70, SLOT_W / 2, PLAT_T + MAT_T + 70, '100', off=14)
    s.text(-400, -700, 'кольцо выходит над плоскостью на 20..300 мм; штанга проходит через паз',
           size=12)
    s.text(-400, -740, 'ниже паза — каретка на направляющей 30×30, ход 1560 мм по X и 460 мм по Y',
           size=12)
    return s.save()


# --- 4. КАРДАН ---------------------------------------------------------------
def gimbal():
    s = Sheet('m1_gimbal', 1650, 1650, scale=0.8, center=(0, 10),
              title='ОМНИ-1 · УЗЕЛ КАРДАНА|М 1:5 · две оси, фиксация секторами|лист 4 из 5')
    s.circle(0, 0, 150, sw=1.6)
    s.circle(0, 0, 130, sw=1.0, dash='8 6', color='#888')
    # ось крена (X) — горизонтальная
    s.line(-210, 0, 210, 0, w=1.4, color='#0b6f66')
    s.circle(-150, 0, 26, fill='#dfe3e7')
    s.circle(150, 0, 26, fill='#dfe3e7')
    s.text(180, 26, 'крен ±90°', size=12, color='#0b6f66')
    # ось тангажа (Y) — вертикальная
    s.line(0, -210, 0, 210, w=1.4, color='#b3541e')
    s.circle(0, -150, 22, fill='#e6e9ec')
    s.circle(0, 150, 22, fill='#e6e9ec')
    s.text(14, 205, 'тангаж ±90°', size=12, color='#b3541e')
    # секторы фиксации
    for a0 in (200, 340):
        pts = []
        import math
        for k in range(13):
            a = math.radians(a0 + 100 * k / 12)
            pts.append((118 * math.cos(a), 118 * math.sin(a)))
        s.poly(pts, stroke='#555', sw=1.0, dash='5 4')
    s.text(-380, -260, 'сектор с насечкой + рукоятка-фиксатор на каждой оси', size=12)
    s.text(-380, -300, 'подшипники 6206 · осевой люфт ≤0.3 мм · стопорение шариковым фиксатором',
           size=11, color='#555')
    return s.save()


# --- 5. ДИАПАЗОНЫ ------------------------------------------------------------
def ranges():
    s = Sheet('m1_ranges', 2700, 1800, scale=0.5, center=(0, 0),
              title='ОМНИ-1 · СХЕМА ДИАПАЗОНОВ|М 1:12 · крайние положения креплений|лист 5 из 5')
    s.rect(-PLAT_L / 2, -PLAT_W / 2, PLAT_L, PLAT_W, fill='#f7f8f9', sw=1.4)
    s.rect(-MAT_L / 2, -MAT_W / 2, MAT_L, MAT_W, fill='#eef0f2', sw=0.8)
    # силуэт человека (спиной на платформе): голова -X
    import math
    s.circle(-620, 0, 95, fill='#dfe6e9')
    s.rect(-540, -160, 480, 320, fill='#dfe6e9')
    s.rect(60, -110, 520, 220, fill='#e6ecef')
    s.text(-620, 0, 'голова', size=10, anchor='middle', color='#666')
    # зоны
    for sy in (-1, 1):
        s.line(-40, sy * SLOT_L_Y, -690, sy * SLOT_L_Y, w=1.0, color='#0b6f66', dash='8 6')
        s.text(-380, sy * (SLOT_L_Y + 45), 'рука: вдоль тела → вверх', size=11,
               anchor='middle', color='#0b6f66')
        s.line(-300, sy * SLOT_L_Y, -300, sy * Y_ARMS_OUT, w=1.0, color='#0b6f66', dash='8 6')
        s.line(700, sy * 120, 700, sy * Y_SPLIT, w=1.2, color='#b3541e', dash='8 6')
        s.text(760, sy * 700, 'нога: шпагат до 1800', size=11, color='#b3541e')
    s.text(-PLAT_L / 2 + 20, PLAT_W / 2 + 190,
           'пределы кистей: X −40…−690 · Y ±210…±780 (в стороны)', size=12)
    s.text(-PLAT_L / 2 + 20, PLAT_W / 2 + 155,
           'пределы стоп: X +600…+740 · Y ±120…±900 — шпагат 1800 на выносных штангах', size=12)
    s.text(-PLAT_L / 2 + 20, PLAT_W / 2 + 120,
           'кольцо над плоскостью 20…300 мм · телескоп 240 · шарнир ±75° · вынос 700', size=12)
    s.text(-PLAT_L / 2 + 20, PLAT_W / 2 + 85,
           'платформа: тангаж ±90°, крен ±90°, рабочая высота 820…1220 мм', size=12)
    return s.save()


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    plan(); side(); section(); gimbal(); ranges()
    print('ALL_DRAWINGS_DONE')