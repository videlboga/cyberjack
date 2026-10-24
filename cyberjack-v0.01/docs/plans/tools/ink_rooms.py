"""Три комнаты из одного кита: калибровочная, жилая камера, медблок.

Доказывает универсальность стиля: оболочка одна (Room), модули одни (ink_props),
меняются только размеры, проёмы и расстановка.

Запуск: blender -b --factory-startup -noaudio --python tools/ink_rooms.py
"""
import bpy, sys, os, math

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
from ink_lib import Ink       # noqa: E402
from ink_kit import Kit       # noqa: E402
import ink_props as P         # noqa: E402

HERE_OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'


def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    I = Ink()
    I.build()
    return I, Kit(I, bpy.context.scene)


def wall_frames(room):
    """Кадры для настенных модулей: север/юг/запад/восток."""
    return {
        'N': room.frame(0.0, room.Y1 - 0.02, 0),
        'S': room.frame(0.0, room.Y0 + 0.02, 180),
        'W': room.frame(room.X0 + 0.02, 0.0, 90),
        'E': room.frame(room.X1 - 0.02, 0.0, 270),
    }


# ---------------------------------------------------------------- калибровочная
def room_calibration():
    I, K = fresh()
    from ink_shell import Room
    r = Room(K, 7.6, 5.6, name='cal')
    r.shell().door('S', -1.45).services(panels=2)

    b = r.frame(0.05, 0.35)
    P.bench(b, w=2.60, d=0.90)
    P.machine_drum(r.frame(-0.45, 0.35))
    P.wall_shelf(r.frame(0.0, r.Y1 - 0.02), w=2.80)
    P.monitor_arm(r.frame(-2.35, r.Y1 - 0.02), z=1.62, span=0.85)
    P.cabinet(r.frame(3.10, 1.60, 270), w=0.72, h=2.05)
    P.sink(r.frame(3.05, -0.70, 270))
    P.cart(r.frame(-2.90, -1.70))
    P.stool(r.frame(1.85, -0.75))
    P.iv_stand(r.frame(-1.30, 1.60))
    P.crate(r.frame(2.60, -2.05))
    r.wall_band('N', z=1.20, step=1.15)
    r.wall_band('N', z=1.86, step=1.45, kinds=['terminal', 'cluster'])
    r.wall_band('W', z=1.20, step=1.25, kinds=['cluster', 'terminal'])
    r.wall_band('E', z=1.25, step=1.15)
    P.cable_run(r.frame(-2.60, -2.10), [(-0.4, 0.0, 0.02), (0.6, 0.5, 0.03), (1.8, 0.2, 0.02),
                                       (3.0, 0.9, 0.02)], n=3)
    P.cable_run(r.frame(1.20, -2.35), [(-0.5, 0.0, 0.02), (0.3, 0.7, 0.03), (1.2, 1.4, 0.02)],
                n=2)
    return r, 'cal'


# ------------------------------------------------------------------ жилая камера
def room_cell():
    I, K = fresh()
    from ink_shell import Room
    r = Room(K, 6.2, 4.6, name='cell')
    r.shell().door('S', -0.85).services(panels=1, pipes=True)

    P.bed(r.frame(r.X0 + 0.95, 0.35, 90), l=2.00, w=0.95)
    P.bed(r.frame(r.X1 - 0.95, 0.35, 270), l=2.00, w=0.95)
    P.bench(r.frame(0.0, 0.25), w=1.30, d=0.80, h=0.76)
    P.stool(r.frame(-0.95, -0.55))
    P.stool(r.frame(0.95, -0.55))
    P.wardrobe(r.frame(-2.55, r.Y1 - 0.25))
    P.wardrobe(r.frame(2.55, r.Y1 - 0.25))
    P.sink(r.frame(2.75, 1.35, 270))
    r.wall_band('N', z=1.30, step=1.20, kinds=['cluster', 'terminal', 'cluster'])
    r.wall_band('W', z=1.35, step=1.30, kinds=['terminal', 'cluster'])
    r.wall_band('E', z=1.35, step=1.30, kinds=['cluster', 'terminal'])
    P.cable_run(r.frame(-1.10, -1.30), [(-0.4, 0.0, 0.02), (0.5, 0.6, 0.03), (1.6, 1.1, 0.02)],
                n=2)
    return r, 'cell'


# --------------------------------------------------------------------- медблок
def room_medbay():
    I, K = fresh()
    from ink_shell import Room
    r = Room(K, 6.4, 5.2, name='med')
    r.shell().door('S', -1.10).services(panels=2)

    P.capsule(r.frame(1.55, 1.35), r=0.59, h=2.42)
    P.couch(r.frame(-1.35, 0.55))
    P.monitor_arm(r.frame(-2.55, r.Y1 - 0.02), z=1.60, span=0.85)
    P.wall_shelf(r.frame(-1.60, r.Y1 - 0.02), w=2.20, z=1.50)
    P.cabinet(r.frame(2.95, -1.10, 270), w=0.70, h=1.95)
    P.cart(r.frame(0.85, -1.65))
    P.sink(r.frame(-2.95, -0.55, 90))
    P.iv_stand(r.frame(-2.15, 1.35))
    P.stool(r.frame(-0.45, -0.75))
    r.wall_band('N', z=1.18, step=1.05, kinds=['cluster', 'terminal', 'cluster', 'screen'])
    r.wall_band('E', z=1.30, step=1.25, kinds=['cluster', 'terminal'])
    r.wall_band('W', z=1.30, step=1.25, kinds=['terminal', 'cluster'])
    P.cable_run(r.frame(-2.20, -2.20), [(-0.4, 0.0, 0.02), (0.8, 0.5, 0.03), (2.0, 0.2, 0.02)],
                n=3)
    return r, 'med'


def main():
    scenes = [room_calibration, room_cell, room_medbay]
    outs = []
    for fn in scenes:
        r, tag = fn()
        out = f'rooms_{tag}.png'
        if tag == 'cal':
            cam, aim, lens = (-2.55, -2.20, 1.45), (0.55, 1.20, 1.05), 24
        elif tag == 'cell':
            cam, aim, lens = (-2.30, -1.85, 1.45), (0.35, 0.75, 0.95), 22
        else:
            cam, aim, lens = (-2.45, -2.05, 1.48), (0.55, 1.05, 1.10), 24
        outs.append(r.render(cam=cam, aim=aim, lens=lens, out=out))
        print('DONE', tag)
    print('ALL', outs)


if __name__ == '__main__':
    main()
