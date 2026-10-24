"""Оболочка комнаты в инк-стиле: одна и та же для всех помещений.

Room сам строит пол со швами, панельные стены, плинтусы, потолок, углы-тени,
потолочные коммуникации, проёмы — и отдаёт Frame для расстановки модулей
из ink_props. Рендер и линии — тоже здесь, чтобы все комнаты выглядели одинаково.

Пример:
    room = Room(K, 7.6, 5.6, name='cal')
    room.shell(); room.door('S', -1.45); room.services()
    props.bench(room.frame(0.0, 0.0))
    room.render(cam=(-2.4, -2.2, 1.5), aim=(0.4, 1.2, 1.0), out='room.png')
"""
import bpy, os, math
from mathutils import Vector

from ink_kit import Frame

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'


class Room:
    def __init__(self, kit, W, D, H=2.80, name='room'):
        self.K = kit
        self.W, self.D, self.H = W, D, H
        self.name = name
        self.X0, self.X1 = -W / 2, W / 2
        self.Y0, self.Y1 = -D / 2, D / 2
        self.doors = []

    # --- оболочка ----------------------------------------------------------
    def shell(self, panel_w=0.72, panel_h=1.10, plinth=0.16):
        K, X0, X1, Y0, Y1, H = self.K, self.X0, self.X1, self.Y0, self.Y1, self.H
        p = self.name
        K.box(f'{p}_floor', X0, X1, Y0, Y1, -0.10, 0.0, 'floor', 0.012)
        K.box(f'{p}_ceil', X0 - 0.2, X1 + 0.2, Y0 - 0.2, Y1 + 0.2, H, H + 0.10, 'wall_c', 0.01)
        K.box(f'{p}_wall_n', X0 - 0.2, X1 + 0.2, Y1, Y1 + 0.2, 0.0, H, 'wall', 0.01)
        K.box(f'{p}_wall_s', X0 - 0.2, X1 + 0.2, Y0 - 0.2, Y0, 0.0, H, 'wall_c', 0.01)
        K.box(f'{p}_wall_w', X0 - 0.2, X0, Y0, Y1, 0.0, H, 'wall_c', 0.01)
        K.box(f'{p}_wall_e', X1, X1 + 0.2, Y0, Y1, 0.0, H, 'wall_c', 0.01)

        K.panel_wall(f'{p}_pn', 'X', Y1 - 0.03, X0, X1, 0.0, H, pw=panel_w, ph=panel_h)
        K.panel_wall(f'{p}_ps', 'X', Y0 + 0.004, X0, X1, 0.0, H, pw=panel_w, ph=panel_h)
        K.panel_wall(f'{p}_pw', 'Y', X0 + 0.004, Y0, Y1, 0.0, H, pw=panel_w, ph=panel_h)
        K.panel_wall(f'{p}_pe', 'Y', X1 - 0.03, Y0, Y1, 0.0, H, pw=panel_w, ph=panel_h)

        for side, a0, a1, fixed in (('n', X0, X1, Y1 - 0.06), ('s', X0, X1, Y0 + 0.006),
                                    ('w', Y0, Y1, X0 + 0.006), ('e', Y0, Y1, X1 - 0.06)):
            if side in ('n', 's'):
                K.box(f'{p}_plinth_{side}', a0, a1, fixed, fixed + 0.05, 0.0, plinth,
                      'metal_d', 0.006)
            else:
                K.box(f'{p}_plinth_{side}', fixed, fixed + 0.05, a0, a1, 0.0, plinth,
                      'metal_d', 0.006)

        step = 0.85
        n = 0
        x = X0 + step
        while x < X1 - 0.05:
            n += 1
            K.box(f'{p}_fseam_x{n}', x, x + 0.014, Y0, Y1, 0.0, 0.003, 'metal_d', 0.0)
            x += step
        y = Y0 + step
        while y < Y1 - 0.05:
            n += 1
            K.box(f'{p}_fseam_y{n}', X0, X1, y, y + 0.014, 0.0, 0.003, 'metal_d', 0.0)
            y += step

        K.corner(f'{p}_cor_n', 'X', Y1 - 0.03, X0, X1, w=0.20)
        K.corner(f'{p}_cor_s', 'X', Y0 + 0.006, X0, X1, w=0.20)
        K.corner(f'{p}_cor_w', 'Y', X0 + 0.006, Y0, Y1, w=0.20)
        K.corner(f'{p}_cor_e', 'Y', X1 - 0.03, Y0, Y1, w=0.20)
        return self

    def door(self, side='S', offset=0.0, w=1.30, h=2.25, frame=True):
        """Проём в стене: side — S/N/W/E, offset — сдвиг от центра стены."""
        K, X0, X1, Y0, Y1 = self.K, self.X0, self.X1, self.Y0, self.Y1
        p = self.name
        self.doors.append((side, offset, w, h))
        if side in ('S', 'N'):
            cx = (X0 + X1) / 2 + offset
            a0, a1 = cx - w / 2, cx + w / 2
            y = Y0 if side == 'S' else Y1
            K.box(f'{p}_door_cut', a0, a1, y - 0.03, y + 0.02, 0.0, h, 'wall_c', 0.006)
            if frame:
                K.box(f'{p}_door_l', a0 - 0.07, a0, y - 0.07, y + 0.03, 0.0, h + 0.07,
                      'metal', 0.010)
                K.box(f'{p}_door_r', a1, a1 + 0.07, y - 0.07, y + 0.03, 0.0, h + 0.07,
                      'metal', 0.010)
                K.box(f'{p}_door_t', a0 - 0.07, a1 + 0.07, y - 0.07, y + 0.03, h, h + 0.07,
                      'metal', 0.010)
            ymark = y - 0.05 if side == 'S' else y + 0.03
            K.box(f'{p}_door_mark', a0 - 0.05, a0, ymark, ymark + 0.02, 0.0, 0.16, 'orange',
                  0.004)
        else:
            cy = (Y0 + Y1) / 2 + offset
            a0, a1 = cy - w / 2, cy + w / 2
            x = X0 if side == 'W' else X1
            K.box(f'{p}_door_cut', x - 0.02, x + 0.03, a0, a1, 0.0, h, 'wall_c', 0.006)
            if frame:
                K.box(f'{p}_door_l', x - 0.07, x + 0.03, a0 - 0.07, a0, 0.0, h + 0.07,
                      'metal', 0.010)
                K.box(f'{p}_door_r', x - 0.07, x + 0.03, a1, a1 + 0.07, 0.0, h + 0.07,
                      'metal', 0.010)
                K.box(f'{p}_door_t', x - 0.07, x + 0.03, a0 - 0.07, a1 + 0.07, h, h + 0.07,
                      'metal', 0.010)
        return self

    def services(self, panels=2, pipes=True, tray=True, conduits=True):
        """Потолочные коммуникации и кабельные каналы по стенам."""
        K, X0, X1, Y0, Y1, H = self.K, self.X0, self.X1, self.Y0, self.Y1, self.H
        p = self.name
        if tray:
            K.box(f'{p}_tray', X0 + 0.3, X1 - 0.3, 0.55, 0.85, H - 0.14, H - 0.02, 'metal', 0.01)
        if pipes:
            for i, y in enumerate((-1.20, -0.75, 1.20, 1.65)):
                K.pipe(f'{p}_cp{i}', [(X0 + 0.1, y, H - 0.10), (X1 - 0.1, y, H - 0.10)], 0.035)
        for i in range(panels):
            u = X0 + 0.9 + i * 2.2
            K.box(f'{p}_lp{i}', u, u + 1.5, -0.35, 0.35, H - 0.06, H - 0.03, 'screen', 0.004)
            K.box(f'{p}_lpc{i}', u - 0.06, u + 1.56, -0.41, 0.41, H - 0.07, H - 0.02, 'metal',
                  0.006)
        if conduits:
            K.conduit(f'{p}_cd_n', [(X0 + 0.10, Y1 - 0.10, 2.52), (X1 - 0.10, Y1 - 0.10, 2.52)],
                      r=0.018)
            K.conduit(f'{p}_cd_w', [(X0 + 0.10, Y0 + 0.10, 2.46), (X0 + 0.10, Y1 - 0.10, 2.46)],
                      r=0.018)
        return self

    def wall_band(self, side='N', z=1.25, step=1.10, kinds=None, skip_doors=True):
        """Пояс приборов вдоль стены: одинаковый ритм во всех комнатах.

        side — N/S/W/E, z — низ пояса, step — шаг модулей, kinds — список типов
        ('cluster', 'terminal', 'screen', 'coil') по кругу.
        """
        import ink_props as props
        K = self.K
        kinds = kinds or ['cluster', 'terminal', 'cluster', 'screen']
        is_x = side in ('N', 'S')
        if is_x:
            a0, a1 = self.X0 + 0.35, self.X1 - 0.35
            y = self.Y1 - 0.02 if side == 'N' else self.Y0 + 0.02
            x = 0.0
            yaw = 0 if side == 'N' else 180
        else:
            a0, a1 = self.Y0 + 0.35, self.Y1 - 0.35
            x = self.X0 + 0.02 if side == 'W' else self.X1 - 0.02
            y = 0.0
            yaw = 90 if side == 'W' else 270

        # исключаем зону проёма на этой стене
        blocked = []
        if skip_doors:
            for (dside, off, w, h) in self.doors:
                if dside != side:
                    continue
                c = off if side in ('N', 'S') else off
                blocked.append((c - w / 2 - 0.25, c + w / 2 + 0.25))

        n = 0
        a = a0
        while a + 0.4 < a1:
            centre = a + 0.25
            if any(b0 <= centre <= b1 for (b0, b1) in blocked):
                a += 0.45
                continue
            kind = kinds[n % len(kinds)]
            if is_x:
                F = Frame(K, centre, y, yaw, prefix=f'{self.name}_{side}{n}_')
            else:
                F = Frame(K, x, centre, yaw, prefix=f'{self.name}_{side}{n}_')
            drop_y = (y - 0.02) if side == 'N' else (y + 0.02)
            if kind == 'cluster':
                props.wall_cluster(F, w=0.48, h=0.38,
                                   led=('cyan', 'pink', 'orange', 'cyan')[n % 4])
                if is_x:
                    K.drop(f'{self.name}_{side}{n}_dp', centre - 0.28, centre + 0.28,
                           drop_y, z, h=0.18)
            elif kind == 'terminal':
                props.terminal(F)
                if is_x:
                    K.drop(f'{self.name}_{side}{n}_dp', centre - 0.20, centre + 0.20,
                           drop_y, z, h=0.14)
            elif kind == 'screen':
                props.wall_cluster(F, w=0.52, h=0.40, led='cyan')
                if is_x:
                    K.drop(f'{self.name}_{side}{n}_dp', centre - 0.30, centre + 0.30,
                           drop_y, z, h=0.20)
            else:
                props.hose_coil(F, z=z + 0.25, r=0.16)
            n += 1
            a += step
        return n

    def frame(self, x, y, yaw=0, prefix=''):
        return Frame(self.K, x, y, yaw, prefix=f'{self.name}_{prefix}')

    def blob(self, name, x0, x1, y0, y1, pad=0.2):
        self.K.blob(f'{self.name}_{name}', x0, x1, y0, y1, layers=6, pad=pad)

    # --- камера и рендер ----------------------------------------------------
    def render(self, cam, aim, lens=24, out='room.png', exposure=-0.04, thickness=1.5,
               res=(1680, 945), samples=32):
        sc = bpy.context.scene
        self.K.I.lights(sc)
        cd = bpy.data.cameras.new(f'{self.name}_cam')
        cd.lens = lens
        co = bpy.data.objects.new(f'{self.name}_cam', cd)
        sc.collection.objects.link(co)
        co.location = cam
        d = Vector(aim) - Vector(cam)
        co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.camera = co

        for cname in ('near', 'far'):
            if bpy.data.collections.get(cname):
                bpy.data.collections.remove(bpy.data.collections[cname])
        near = bpy.data.collections.new('near')
        far = bpy.data.collections.new('far')
        sc.collection.children.link(near)
        sc.collection.children.link(far)
        cams = Vector(cam)
        for o in list(sc.objects):
            if o.type not in {'MESH', 'CURVE'}:
                continue
            if any(t in o.name for t in ('_sh', '_dz', '_cz')):
                continue
            (near if (o.matrix_world.translation - cams).length < 3.1 else far).objects.link(o)

        self.K.I.render_setup(sc, res=res, samples=samples, exposure=exposure, bloom=(1.9, 3))
        self.K.I.ink(sc, thickness=thickness, crease=True, angle=150,
                     collections=('near', 'far'))
        path = out if os.path.isabs(out) else os.path.join(OUT, out)
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print('RENDERED', os.path.basename(path))
        return path
