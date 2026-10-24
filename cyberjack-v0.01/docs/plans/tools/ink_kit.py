"""Общие приёмы инк-стиля: боксы, цилиндры, трубы, кабели, экраны, панели.

Отдельно от ink_lib (материалы/свет/линии), чтобы комнаты собирались одинаково:
швы, рамы, экраны с UI, трубы с отводами, кабели с провисом.
"""
import bpy, math


class Kit:
    def __init__(self, ink, scene=None):
        self.I = ink
        self.sc = scene or bpy.context.scene
        self.M = ink.M
        self.n = 0

    # --- примитивы ---------------------------------------------------------
    def box(self, name, x0, x1, y0, y1, z0, z1, role='wall', bevel=0.008, segs=2):
        bpy.ops.mesh.primitive_cube_add(size=1)
        o = bpy.context.object
        o.name = name
        o.scale = (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))
        bpy.ops.object.transform_apply(scale=True)
        o.location = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
        bpy.ops.object.transform_apply(location=True)
        self.I.apply(o, role)
        if bevel > 0:
            m = o.modifiers.new('b', 'BEVEL')
            m.width, m.segments, m.limit_method = bevel, segs, 'ANGLE'
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=m.name)
        o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
        o.data.update()
        return o

    def cyl(self, name, x, y, z0, z1, r, role='metal', verts=24, axis='Z'):
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=abs(z1 - z0), vertices=verts,
                                            location=(x, y, (z0 + z1) / 2))
        o = bpy.context.object
        o.name = name
        if axis == 'X':
            o.rotation_euler = (0, math.pi / 2, 0)
        elif axis == 'Y':
            o.rotation_euler = (math.pi / 2, 0, 0)
        self.I.apply(o, role)
        o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
        o.data.update()
        return o

    def sphere(self, name, x, y, z, r, role='metal', segs=20):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=segs, ring_count=max(6, segs // 2),
                                             location=(x, y, z))
        o = bpy.context.object
        o.name = name
        self.I.apply(o, role)
        o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
        o.data.update()
        return o

    def rbox(self, name, x0, x1, y0, y1, z0, z1, role='wall', r=0.04, segs=4):
        return self.box(name, x0, x1, y0, y1, z0, z1, role, bevel=r, segs=segs)

    # --- трубы и кабели ----------------------------------------------------
    def pipe(self, prefix, pts, r=0.05, role='metal'):
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            dx, dy, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
            length = math.sqrt(dx * dx + dy * dy + dz * dz)
            if length < 1e-4:
                continue
            bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=length, vertices=16,
                                                location=((a[0] + b[0]) / 2, (a[1] + b[1]) / 2,
                                                          (a[2] + b[2]) / 2))
            o = bpy.context.object
            o.name = f'{prefix}_{i}'
            o.rotation_euler = (math.atan2(math.sqrt(dx * dx + dy * dy), dz), 0,
                                math.atan2(dy, dx))
            self.I.apply(o, role)
            o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
            o.data.update()
            self.sphere(f'{prefix}_j{i}', b[0], b[1], b[2], r, role, segs=14)

    def cable(self, prefix, pts, r=0.011, role='dark'):
        cu = bpy.data.curves.new(f'{prefix}_c', 'CURVE')
        cu.dimensions = '3D'
        cu.bevel_depth = r
        cu.bevel_resolution = 2
        sp = cu.splines.new('BEZIER')
        sp.bezier_points.add(len(pts) - 1)
        for p, co in zip(sp.bezier_points, pts):
            p.co = co
            p.handle_left_type = p.handle_right_type = 'AUTO'
        o = bpy.data.objects.new(prefix, cu)
        self.sc.collection.objects.link(o)
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.convert(target='MESH')
        self.I.apply(bpy.context.object, role)
        return bpy.context.object

    # --- экраны ------------------------------------------------------------
    def screen(self, name, x0, x1, y0, y1, z0, z1, face='-Y', ui=True, role='screen'):
        """Экран: корпус + тёмная рамка + панель с UI-линиями на лицевой стороне."""
        self.box(f'{name}_body', x0, x1, y0, y1, z0, z1, 'wall', 0.012)
        if face == '-Y':
            self.box(f'{name}_bezel', x0 + 0.015, x1 - 0.015, y0 - 0.004, y0 + 0.004,
                     z0 + 0.015, z1 - 0.015, 'metal_d', 0.004)
            self.box(f'{name}_face', x0 + 0.03, x1 - 0.03, y0 - 0.006, y0 - 0.002,
                     z0 + 0.03, z1 - 0.03, role, 0.0)
            yy0, yy1 = y0 - 0.008, y0 - 0.006
            w = (x1 - x0) - 0.06
            hgt = (z1 - z0) - 0.06
        else:  # +X
            self.box(f'{name}_bezel', x1 - 0.004, x1 + 0.004, y0 + 0.015, y1 - 0.015,
                     z0 + 0.015, z1 - 0.015, 'metal_d', 0.004)
            self.box(f'{name}_face', x1 + 0.002, x1 + 0.006, y0 + 0.03, y1 - 0.03,
                     z0 + 0.03, z1 - 0.03, role, 0.0)
            yy0, yy1 = x1 + 0.006, x1 + 0.008
            w = (y1 - y0) - 0.06
            hgt = (z1 - z0) - 0.06
        if ui:
            if face == '-Y':
                self.box(f'{name}_uih', x0 + 0.04, x0 + 0.04 + w * 0.5, yy0 - 0.002, yy0,
                         z1 - 0.06, z1 - 0.055, 'cyan', 0.0)
                for k in range(4):
                    zz = z1 - 0.08 - k * hgt * 0.13
                    self.box(f'{name}_uil{k}', x0 + 0.04, x0 + 0.04 + w * (0.8 - k * 0.1),
                             yy0 - 0.002, yy0, zz - hgt * 0.04, zz, 'cyan', 0.0)
            else:
                self.box(f'{name}_uih', yy0 - 0.002, yy0, y0 + 0.04, y0 + 0.04 + w * 0.5,
                         z1 - 0.06, z1 - 0.055, 'cyan', 0.0)
                for k in range(4):
                    zz = z1 - 0.08 - k * hgt * 0.13
                    self.box(f'{name}_uil{k}', yy0 - 0.002, yy0, y0 + 0.04,
                             y0 + 0.04 + w * (0.8 - k * 0.1), zz - hgt * 0.04, zz,
                             'cyan', 0.0)

    # --- стены -------------------------------------------------------------
    def panel_wall(self, prefix, axis, fixed, a0, a1, z0, z1, pw=0.95, ph=1.35, depth=0.028,
                   bolts=True):
        """Панели со швами и крепежом по углам: density — главное отличие рефа."""
        a = a0
        i = 0
        while a < a1 - 0.01:
            w = min(pw, a1 - a)
            z = z0
            j = 0
            while z < z1 - 0.01:
                hh = min(ph, z1 - z)
                if axis == 'X':
                    self.box(f'{prefix}_{i}_{j}', a + 0.007, a + w - 0.007,
                             fixed, fixed + depth, z + 0.007, z + hh - 0.007, 'wall', 0.004)
                    if bolts:
                        for bi, (ba, bz) in enumerate(((a + 0.035, z + 0.035),
                                                       (a + w - 0.035, z + 0.035),
                                                       (a + 0.035, z + hh - 0.035),
                                                       (a + w - 0.035, z + hh - 0.035))):
                            self.bolt(f'{prefix}_b{i}_{j}_{bi}', ba, fixed + depth, bz, 'Y')
                else:
                    self.box(f'{prefix}_{i}_{j}', fixed, fixed + depth,
                             a + 0.007, a + w - 0.007, z + 0.007, z + hh - 0.007, 'wall', 0.004)
                    if bolts:
                        for bi, (ba, bz) in enumerate(((a + 0.035, z + 0.035),
                                                       (a + w - 0.035, z + 0.035),
                                                       (a + 0.035, z + hh - 0.035),
                                                       (a + w - 0.035, z + hh - 0.035))):
                            self.bolt(f'{prefix}_b{i}_{j}_{bi}', fixed + depth, ba, bz, 'X')
                z += hh
                j += 1
            a += pw
            i += 1

    # --- мелкая фурнитура ---------------------------------------------------
    def bolt(self, name, x, y, z, axis='Y', r=0.012):
        if axis == 'Y':
            return self.cyl(name, x, y, z - 0.006, z + 0.006, r, 'metal_d', verts=10, axis='Y')
        return self.cyl(name, x, y, z - 0.006, z + 0.006, r, 'metal_d', verts=10, axis='X')

    def tag(self, name, x0, x1, y0, y1, z0, z1, role='orange'):
        return self.box(name, x0, x1, y0, y1, z0, z1, role, 0.0015)

    def conduit(self, prefix, pts, r=0.018, clamp_every=0.65, role='metal'):
        """Кабельный канал: тонкая труба + хомуты с шагом."""
        self.pipe(prefix, pts, r=r, role=role)
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            length = math.dist(a, b)
            n = max(1, int(length / clamp_every))
            for k in range(n):
                t = (k + 0.5) / n
                cx = a[0] + (b[0] - a[0]) * t
                cy = a[1] + (b[1] - a[1]) * t
                cz = a[2] + (b[2] - a[2]) * t
                self.box(f'{prefix}_cl{i}_{k}', cx - 0.03, cx + 0.03, cy - 0.03, cy + 0.03,
                         cz - 0.035, cz + 0.035, 'metal_d', 0.003)

    def bundle(self, prefix, pts, n=4, spread=0.026, r=0.008, role='dark'):
        """Пучок кабелей: n параллельных линий со сдвигом по нормали."""
        for j in range(n):
            off = (j - (n - 1) / 2) * spread
            shifted = [(p[0] + off * 0.4, p[1] + off, p[2] + abs(off) * 0.2) for p in pts]
            self.cable(f'{prefix}_{j}', shifted, r=r, role=role)

    def wall_device(self, name, x0, x1, y0, y1, z0, z1, led_role='cyan', grille=True):
        """Настенный приборчик: корпус, решётка, светодиод, бирка."""
        self.box(f'{name}_body', x0, x1, y0, y1, z0, z1, 'wall', 0.008)
        if grille:
            self.grille(f'{name}_gr', x0 + 0.03, x1 - 0.03, y0 - 0.006, y0, z0 + 0.05,
                        z0 + 0.16, n=4, role='mid')
        self.led(f'{name}_led', x0 + 0.04, y0 - 0.008, z1 - 0.06, r=0.011, role=led_role)
        self.tag(f'{name}_tag', x0 + 0.09, x0 + 0.19, y0 - 0.004, y0, z1 - 0.075, z1 - 0.045,
                 'orange')

    def grille(self, prefix, x0, x1, y0, y1, z0, z1, n=6, role='mid'):
        for k in range(n):
            zz = z0 + k * (z1 - z0) / n
            self.box(f'{prefix}_{k}', x0, x1, y0, y1, zz, zz + (z1 - z0) / n * 0.55, role, 0.0)

    def led(self, name, x, y, z, r=0.014, role='cyan'):
        return self.cyl(name, x, y, z, z + 0.006, r, role, verts=12, axis='Y')
