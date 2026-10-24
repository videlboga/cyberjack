"""Общий конструктив комнат: стены, панели, проём, типовые предметы, свет, рендер.

Согласованный набор: панель 1.20 × 1.20 со швом 20 мм, плинтус 0.10, бирюзовая
полоса #5FA39A h 0.12 на 1.15, пол плитка 0.60, потолок 2.70, профиль в углах,
проём 1.10 × 2.10 с наличниками и тамбуром 1.6 м.

Класс RoomKit создаёт комнату с центром в (0, 0): при открытии .blend всё перед глазами.
"""
import bpy, os, math, bmesh
from mathutils import Vector, Matrix

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'

PALETTE = {
    'panel': (0.80, 0.80, 0.78),
    'panel_dim': (0.62, 0.62, 0.61),
    'seam': (0.16, 0.17, 0.18),
    'plinth': (0.13, 0.14, 0.15),
    'stripe': (0.155, 0.36, 0.33),
    'floor': (0.82, 0.82, 0.80),
    'grout': (0.35, 0.36, 0.35),
    'ceiling': (0.76, 0.76, 0.74),
    'light': (0.95, 0.95, 0.92),
    'steel': (0.60, 0.62, 0.64),
    'paint': (0.16, 0.18, 0.19),
    'soft': (0.30, 0.31, 0.32),
    'strap': (0.07, 0.07, 0.08),
    'accent': (0.13, 0.38, 0.35),
    'white': (0.90, 0.90, 0.88),
    'glass': (0.70, 0.82, 0.84),
}


class RoomKit:
    def __init__(self, W, D, H=2.70, T=0.20, door_at=0.0, door_w=1.10, door_h=2.10,
                 palette=None, prefix=''):
        self.W, self.D, self.H, self.T = W, D, H, T
        self.X0, self.X1 = -W / 2, W / 2
        self.Y0, self.Y1 = -D / 2, D / 2
        self.door_at, self.door_w, self.door_h = door_at, door_w, door_h
        self.prefix = prefix
        self.M = {}
        for key, col in {**PALETTE, **(palette or {})}.items():
            rough = 0.12 if key == 'floor' else 0.62 if key.startswith('panel') else 0.5
            metal = 0.55 if key == 'steel' else 0.0     # 0.9 в тёмной сцене даёт чёрный металл
            emit = (1.0, 0.97, 0.90) if key == 'light' else None
            m = self.mat(f'{prefix}{key}', col, rough, metal, emit,
                         10.0 if key == 'light' else 1.0)
            if key == 'glass':
                # в EEVEE Next проще и надёжнее полупрозрачность через alpha-blend,
                # transmission без экранных рефракций даёт непрозрачный цилиндр
                b = m.node_tree.nodes['Principled BSDF']
                b.inputs['Alpha'].default_value = 0.30
                b.inputs['Roughness'].default_value = 0.10
                m.surface_render_method = 'BLENDED'
                m.use_backface_culling = False
            self.M[key] = m
        self.sc = bpy.context.scene

    # --- материалы и примитивы -------------------------------------------
    @staticmethod
    def mat(name, color, rough=0.55, metal=0.0, emit=None, emit_strength=1.0):
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*color, 1)
        b.inputs['Roughness'].default_value = rough
        b.inputs['Metallic'].default_value = metal
        if emit:
            b.inputs['Emission Color'].default_value = (*emit, 1)
            b.inputs['Emission Strength'].default_value = emit_strength
        return m

    def _add(self, o, mat):
        o.data.materials.append(self.M[mat] if isinstance(mat, str) else mat)
        return o

    def box(self, name, x0, x1, y0, y1, z0, z1, mat):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
        o = bpy.context.object
        o.name = self.prefix + name
        o.data.transform(Matrix.Diagonal((max(abs(x1 - x0), 0.001), max(abs(y1 - y0), 0.001),
                                          max(abs(z1 - z0), 0.001), 1)))
        o.data.transform(Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)))
        return self._add(o, mat)

    def cyl(self, name, x, y, z0, z1, r, mat, verts=20):
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=abs(z1 - z0),
                                            location=(x, y, (z0 + z1) / 2), vertices=verts)
        o = bpy.context.object
        o.name = self.prefix + name
        return self._add(o, mat)

    def taper(self, name, x0, x1, y0, y1, z0, z1, mat, shrink=0.12):
        me = bpy.data.meshes.new(name)
        bm = bmesh.new()
        dx, dy = (x1 - x0) * shrink, (y1 - y0) * shrink
        top = [bm.verts.new(v) for v in ((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
        bot = [bm.verts.new(v) for v in ((x0 + dx, y0 + dy, z0), (x1 - dx, y0 + dy, z0),
                                         (x1 - dx, y1 - dy, z0), (x0 + dx, y1 - dy, z0))]
        bm.faces.new(top[::-1])
        bm.faces.new(bot)
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((top[i], top[j], bot[j], bot[i]))
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new(self.prefix + name, me)
        self.sc.collection.objects.link(o)
        return self._add(o, mat)

    # --- форма ------------------------------------------------------------
    def bevel_all(self):
        for o in bpy.data.objects:
            if o.type != 'MESH' or not o.name.startswith(self.prefix):
                continue
            n = o.name.lower()
            if 'tile_' in n:
                w, s = 0.004, 1
            elif 'pillow' in n:
                w, s = 0.050, 6
            elif any(k in n for k in ('mattress', 'headrest')):
                w, s = 0.030, 4
            elif any(k in n for k in ('panel_', 'stripe_', 'plinth_')):
                w, s = 0.004, 1
            elif any(k in n for k in ('couch_frame', 'cabinet', 'cart', 'sink_body', 'slot_',
                                      'monitor_', 'jamb', 'door_', 'corr_', 'wall_', 'light_',
                                      'ceiling', 'floor_base', 'corner_post', 'capsule')):
                w, s = 0.012, 2
            elif any(k in n for k in ('strap', 'handle', 'bag', 'bin', 'dispenser', 'basin')):
                w, s = 0.005, 2
            else:
                w, s = 0.008, 2
            m = o.modifiers.new('bevel', 'BEVEL')
            m.width, m.segments = w, s
            m.limit_method, m.angle_limit = 'ANGLE', 0.62
            m.miter_outer = 'MITER_ARC'
            bpy.context.view_layer.objects.active = o
            o.select_set(True)
            try:
                bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
            except Exception:
                pass
            o.select_set(False)

    # --- оболочка ---------------------------------------------------------
    def shell(self):
        X0, X1, Y0, Y1, H, T = self.X0, self.X1, self.Y0, self.Y1, self.H, self.T
        self.box('floor_base', X0, X1, Y0, Y1, -0.10, -0.005, 'grout')
        n = 0
        x = X0
        while x < X1 - 0.01:
            y = Y0
            while y < Y1 - 0.01:
                self.box(f'tile_{n}', x + 0.005, min(x + 0.605, X1), y + 0.005,
                         min(y + 0.605, Y1), -0.005, 0.0, 'floor')
                n += 1
                y += 0.61
            x += 0.61
        self.box('ceiling', X0, X1, Y0, Y1, H, H + 0.06, 'ceiling')

        s = 0.05
        for i, (px, py) in enumerate(((X0, Y0), (X1, Y0), (X0, Y1), (X1, Y1))):
            cx = px + s if px < 0 else px - s
            cy = py + s if py < 0 else py - s
            self.box(f'corner_post_{i}', min(px, cx), max(px, cx), min(py, cy), max(py, cy),
                     0.0, H, 'steel')

        walls = {'south': (Y0, -1, True), 'north': (Y1, 1, True),
                 'west': (X0, -1, False), 'east': (X1, 1, False)}
        for side, (f, out, horiz) in walls.items():
            a0, a1 = (X0, X1) if horiz else (Y0, Y1)
            dl, dr = self.door_at - self.door_w / 2, self.door_at + self.door_w / 2
            if side == 'north':
                self.box('wall_north_l', X0, dl, f, f + out * T, 0, H, 'seam')
                self.box('wall_north_r', dr, X1, f, f + out * T, 0, H, 'seam')
                self.box('wall_north_lintel', dl, dr, f, f + out * T, self.door_h, H, 'seam')
            elif horiz:
                self.box(f'wall_{side}', a0, a1, f, f + out * T, 0, H, 'seam')
            else:
                self.box(f'wall_{side}', f, f + out * T, a0, a1, 0, H, 'seam')
            if horiz:
                self.box(f'plinth_{side}', a0, a1, min(f, f - out * 0.02),
                         max(f, f - out * 0.02) + 0.02, 0, PLINTH_T, 'plinth')
            else:
                self.box(f'plinth_{side}', min(f, f - out * 0.02), max(f, f - out * 0.02) + 0.02,
                         a0, a1, 0, PLINTH_T, 'plinth')
            a, i = a0, 0
            while a < a1 - 0.02:
                pa = min(a + PANEL_W, a1)
                z, j = PLINTH_T, 0
                while z < H - 0.02:
                    pz = min(z + PANEL_W, H)
                    in_door = (side == 'north'
                               and not (pa <= dl or a >= dr) and z < self.door_h)
                    if not in_door:
                        if horiz:
                            self.box(f'panel_{side}_{i}_{j}', a + SEAM_W / 2, pa - SEAM_W / 2,
                                     f - out * 0.004, f - out * 0.024, z + SEAM_W / 2,
                                     pz - SEAM_W / 2, 'panel')
                        else:
                            self.box(f'panel_{side}_{i}_{j}', f - out * 0.004, f - out * 0.024,
                                     a + SEAM_W / 2, pa - SEAM_W / 2, z + SEAM_W / 2,
                                     pz - SEAM_W / 2, 'panel')
                    z = pz + SEAM_W
                    j += 1
                a = pa + SEAM_W
                i += 1
            if horiz:
                self.box(f'stripe_{side}', a0, a1, f - out * 0.018, f - out * 0.006,
                         STRIPE_Z, STRIPE_Z + STRIPE_H, 'stripe')
            else:
                self.box(f'stripe_{side}', f - out * 0.018, f - out * 0.006, a0, a1,
                         STRIPE_Z, STRIPE_Z + STRIPE_H, 'stripe')

    def doorway(self):
        X0, X1, Y0, Y1, T = self.X0, self.X1, self.Y0, self.Y1, self.T
        dl, dr = self.door_at - self.door_w / 2, self.door_at + self.door_w / 2
        for name, x in (('jamb_l', dl), ('jamb_r', dr)):
            self.box(name, x - 0.04, x + 0.04, Y1 - 0.08, Y1 + T + 0.08, 0.0, self.door_h,
                     'steel')
        self.box('door_head', dl - 0.04, dr + 0.04, Y1 - 0.08, Y1 + T + 0.08,
                 self.door_h - 0.08, self.door_h, 'steel')
        y0, y1 = Y1 + T, Y1 + T + 1.60
        x0, x1 = self.door_at - 1.20, self.door_at + 1.20
        self.box('corr_floor', x0, x1, y0, y1, -0.06, 0.0, 'floor')
        self.box('corr_ceil', x0, x1, y0, y1, 2.55, 2.60, 'ceiling')
        self.box('corr_wall_l', x0 - T, x0, y0, y1, 0.0, 2.55, 'panel_dim')
        self.box('corr_wall_r', x1, x1 + T, y0, y1, 0.0, 2.55, 'panel_dim')
        self.box('corr_wall_end', x0 - T, x1 + T, y1, y1 + T, 0.0, 2.55, 'panel_dim')
        self.box('corr_plinth', x0 - T, x1 + T, y1 - 0.02, y1, 0.0, PLINTH_T, 'plinth')
        cl = self.mat(f'{self.prefix}corr_light', (0.45, 0.45, 0.43), 0.6, 0.0,
                      (1.0, 0.95, 0.85), 0.55)
        self.box('corr_light', x0 + 0.3, x1 - 0.3, y0 + 0.4, y1 - 0.3, 2.52, 2.55, cl)

    def ceiling_lights(self, panels):
        """panels: [(x0, x1, y0, y1), ...]"""
        for i, (lx0, lx1, ly0, ly1) in enumerate(panels):
            self.box(f'light_lip_l_{i}', lx0 - 0.04, lx0, ly0 - 0.04, ly1 + 0.04,
                     self.H - 0.05, self.H - 0.005, 'steel')
            self.box(f'light_lip_r_{i}', lx1, lx1 + 0.04, ly0 - 0.04, ly1 + 0.04,
                     self.H - 0.05, self.H - 0.005, 'steel')
            self.box(f'light_lip_s_{i}', lx0, lx1, ly0 - 0.04, ly0,
                     self.H - 0.05, self.H - 0.005, 'steel')
            self.box(f'light_lip_n_{i}', lx0, lx1, ly1, ly1 + 0.04,
                     self.H - 0.05, self.H - 0.005, 'steel')
            self.box(f'light_{i}', lx0, lx1, ly0, ly1, self.H - 0.02, self.H - 0.005, 'light')

    # --- типовые предметы -------------------------------------------------
    def couch(self, name, cx, cy, L=2.00, Wd=0.80, h=0.78, headrest=True, straps=2):
        x0, x1 = cx - L / 2, cx + L / 2
        y0, y1 = cy - Wd / 2, cy + Wd / 2
        self.taper(f'{name}_frame', x0 + 0.04, x1 - 0.04, y0 + 0.04, y1 - 0.04,
                   h - 0.20, h - 0.04, 'paint', 0.14)
        for i, (lx, ly) in enumerate(((x0 + 0.12, y0 + 0.12), (x1 - 0.12, y0 + 0.12),
                                      (x0 + 0.12, y1 - 0.12), (x1 - 0.12, y1 - 0.12))):
            self.cyl(f'{name}_leg_{i}', lx, ly, 0.06, h - 0.16, 0.025, 'steel')
            self.cyl(f'{name}_wheel_{i}', lx, ly, 0.0, 0.06, 0.045, 'paint')
        self.box(f'{name}_skirt', x0 - 0.02, x1 + 0.02, y0 - 0.02, y1 + 0.02,
                 h - 0.10, h + 0.02, 'soft')
        self.box(f'{name}_mattress', x0, x1, y0, y1, h + 0.02, h + 0.13, 'soft')
        if headrest:
            hx0, hx1 = x0, x0 + 0.42
            self.box(f'{name}_headrest', hx0, hx1, y0 + 0.02, y1 - 0.02,
                     h + 0.13, h + 0.20, 'soft')
            self.box(f'{name}_pillow', hx0 + 0.05, hx0 + 0.39, cy - 0.29, cy + 0.29,
                     h + 0.20, h + 0.30, 'white')
            pivot = Vector((hx1, cy, h + 0.13))
            rot = (Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(12), 4, 'Y')
                   @ Matrix.Translation(-pivot))
            for n in (f'{name}_headrest', f'{name}_pillow'):
                bpy.data.objects[self.prefix + n].data.transform(rot)
        for i in range(straps):
            xc = cx - 0.10 + i * 0.52
            self.box(f'{name}_strap_{i}', xc - 0.035, xc + 0.035, y0 - 0.01, y1 + 0.01,
                     h + 0.12, h + 0.145, 'strap')
        for i, xx in enumerate((x0 + 0.10, x1 - 0.10)):
            self.cyl(f'{name}_rail_{i}', xx, cy, h - 0.30, h - 0.26, 0.018, 'steel')

    def cabinet(self, name, x0, x1, y0, y1, h=2.0, glass=False):
        self.box(f'{name}_body', x0, x1, y0, y1, 0.06, h - 0.02, 'paint')
        self.box(f'{name}_cap', x0 - 0.02, x1 + 0.02, y0 - 0.02, y1 + 0.02,
                 h - 0.02, h + 0.04, 'paint')
        self.box(f'{name}_toe', x0, x1 - 0.02, y0, y1, 0.0, 0.06, 'plinth')
        ym = (y0 + y1) / 2
        face = x0 if abs(x0) < abs(x1) else x1      # сторона, обращённая в комнату
        sgn = 1 if face > 0 else -1
        for i, (ya, yb) in enumerate(((y0 + 0.015, ym - 0.006), (ym + 0.006, y1 - 0.015))):
            m = 'glass' if glass and i == 0 else 'paint'
            self.box(f'{name}_door_{i}', face - sgn * 0.018, face - sgn * 0.002, ya, yb,
                     0.10, h - 0.06, m)
            self.box(f'{name}_handle_{i}', face + sgn * 0.002, face + sgn * 0.026, ya + 0.04,
                     ya + 0.06, h * 0.55, h * 0.68, 'steel')
        self.box(f'{name}_vent', face + sgn * 0.002, face + sgn * 0.006, y0 + 0.10, y1 - 0.10,
                 h - 0.30, h - 0.14, 'seam')

    def sink(self, name, x0, x1, y0, y1):
        self.box(f'{name}_body', x0, x1, y0, y1, 0.0, 0.85, 'white')
        self.box(f'{name}_basin', x0 + 0.08, x1 - 0.08, y0 + 0.10, y1 - 0.10, 0.85, 0.88, 'steel')
        self.cyl(f'{name}_tap', x0 + 0.30, y1 - 0.06, 0.88, 1.12, 0.018, 'steel')
        self.box(f'{name}_dispenser', x0 + 0.10, x0 + 0.26, y0 + 0.04, y0 + 0.14,
                 0.88, 1.14, 'white')
        face = x0 if abs(x0) < abs(x1) else x1      # фронт мойки смотрит в комнату
        sgn = 1 if face > 0 else -1
        for i, (za, zb) in enumerate(((0.10, 0.42), (0.46, 0.80))):
            self.box(f'{name}_drawer_{i}', face - sgn * 0.008, face + sgn * 0.004,
                     y0 + 0.04, y1 - 0.04, za, zb, 'white')
            self.cyl(f'{name}_handle_{i}', face + sgn * 0.02, (y0 + y1) / 2, zb - 0.06,
                     zb - 0.03, 0.010, 'steel')

    def monitor(self, name, mx, my, h=1.44):
        self.cyl(f'{name}_pole', mx, my, 0.06, h, 0.028, 'steel')
        self.cyl(f'{name}_base', mx, my, 0.0, 0.06, 0.22, 'paint')
        self.box(f'{name}_screen', mx - 0.17, mx + 0.17, my - 0.03, my + 0.03,
                 h - 0.24, h, 'paint')
        self.box(f'{name}_glass', mx - 0.15, mx + 0.15, my - 0.035, my - 0.03,
                 h - 0.22, h - 0.02, 'accent')
        self.box(f'{name}_arm', mx - 0.03, mx + 0.03, my - 0.03, my + 0.03,
                 h - 0.24, h - 0.20, 'steel')

    def stool(self, name, cx, cy, h=0.48, r=0.175):
        self.cyl(f'{name}_seat', cx, cy, h - 0.04, h, r, 'soft')
        for i, (dx, dy) in enumerate(((-0.13, -0.13), (0.13, -0.13), (-0.13, 0.13), (0.13, 0.13))):
            self.cyl(f'{name}_leg_{i}', cx + dx, cy + dy, 0.0, h - 0.04, 0.012, 'steel')

    def iv(self, name, cx, cy, h=1.85):
        self.cyl(f'{name}_pole', cx, cy, 0.0, h, 0.018, 'steel')
        self.cyl(f'{name}_base', cx, cy, 0.0, 0.05, 0.20, 'paint')
        self.box(f'{name}_bag', cx - 0.07, cx + 0.07, cy - 0.04, cy + 0.04,
                 h - 0.40, h - 0.17, 'white')
        self.box(f'{name}_hanger', cx - 0.10, cx + 0.10, cy - 0.01, cy + 0.01,
                 h - 0.02, h, 'steel')

    def lights(self, key, fill, rim, extra=()):
        def area(name, loc, size, energy, rot=(0, 0, 0), color=(1.0, 0.96, 0.90)):
            d = bpy.data.lights.new(name, 'AREA')
            d.size, d.size_y = size[0], size[1]
            d.energy, d.color = energy, color
            o = bpy.data.objects.new(name, d)
            o.location = loc
            o.rotation_euler = rot
            self.sc.collection.objects.link(o)
        area('key', key[0], key[1], key[2])
        area('fill', fill[0], fill[1], fill[2], rot=(math.radians(90), 0, 0))
        area('rim', rim[0], rim[1], rim[2], rot=(0, math.radians(-80), 0),
             color=(0.75, 0.85, 0.95))
        for e in extra:
            area(e[0], e[1], e[2], e[3], rot=e[4] if len(e) > 4 else (0, 0, 0))

    # --- рендер -----------------------------------------------------------
    def render_setup(self, res=(1500, 940), samples=48):
        sc = self.sc
        sc.render.engine = 'BLENDER_EEVEE_NEXT'
        sc.eevee.taa_render_samples = samples
        sc.eevee.use_raytracing = True
        sc.view_settings.look = 'AgX - Medium High Contrast'
        sc.render.resolution_x, sc.render.resolution_y = res
        w = bpy.data.worlds.new('W')
        sc.world = w
        w.use_nodes = True
        w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.055, 0.06, 0.065, 1)
        cd = bpy.data.cameras.new('CAM')
        self.cam = bpy.data.objects.new('CAM', cd)
        sc.collection.objects.link(self.cam)
        sc.camera = self.cam
        self.cd = cd

    def shot(self, name, loc, target, lens=22.0):
        self.cd.type = 'PERSP'
        self.cd.lens = lens
        self.cam.location = Vector(loc)
        self.cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        self.sc.render.filepath = os.path.join(OUT, name)
        bpy.ops.render.render(write_still=True)

    def shot_top(self, name, scale=None, center=(0.0, 0.3)):
        hidden = []
        for o in bpy.data.objects:
            if o.name.startswith((self.prefix + 'ceiling', self.prefix + 'light_',
                                  self.prefix + 'corr_ceil')) or 'light_lip' in o.name:
                if o.hide_render is False:
                    o.hide_render = True
                    hidden.append(o)
        self.cd.type = 'ORTHO'
        self.cd.ortho_scale = scale or (self.W + 1.2)
        self.cam.location = (center[0], center[1], 9.0)
        self.cam.rotation_euler = (0, 0, 0)
        self.sc.render.filepath = os.path.join(OUT, name)
        bpy.ops.render.render(write_still=True)
        for o in hidden:
            o.hide_render = False

    def save(self, name):
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, name))


PANEL_W, SEAM_W, PLINTH_T = 1.20, 0.02, 0.10
STRIPE_Z, STRIPE_H = 1.15, 0.12
