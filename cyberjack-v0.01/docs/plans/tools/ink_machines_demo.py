"""Импортированные машины в ките: линейка моделей и комната с тремя машинами.

Проверяет, что SKP vol-04 после конвертации ставится как обычный модуль:
нормализация габаритов, инк-материалы по яркости, контактная тень.

Запуск: blender -b --factory-startup -noaudio --python tools/ink_machines_demo.py
"""
import bpy, sys, os, math
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
from ink_lib import Ink        # noqa: E402
from ink_kit import Kit, Frame  # noqa: E402
from ink_shell import Room     # noqa: E402
import ink_props as P          # noqa: E402

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'


def boot():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    I = Ink()
    I.build()
    return I, Kit(I, bpy.context.scene)


# --- линейка моделей ---------------------------------------------------------
def lineup():
    I, K = boot()
    models = P.vol04_models()
    if not models:
        print('NO_MODELS')
        return
    x = 0.0
    for i, m in enumerate(models):
        row = 0 if i < 6 else 1
        y = 0.0 if row == 0 else 3.2
        if i in (0, 6):
            x = 0.0
        try:
            P.imported_machine(Frame(K, x, y, 0, prefix=f'm{i}_'), m['id'],
                               target_h=1.75, max_span=2.0)
        except Exception as e:
            print('SKIP_IMPORT', m['id'], type(e).__name__, str(e)[:120])
        x += 2.5
        print('PLACED', m['id'])

    bpy.ops.mesh.primitive_plane_add(size=40, location=(9.0, 1.6, -0.001))
    floor = bpy.context.object
    floor.name = 'lineup_floor'
    I.apply(floor, 'floor')

    I.lights(bpy.context.scene)
    sc = bpy.context.scene
    cd = bpy.data.cameras.new('cam')
    cd.type = 'ORTHO'
    cd.ortho_scale = 34
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    cam.location = (14.0, -22.0, 14.0)
    d = Vector((14.0, 1.6, 0.9)) - Vector(cam.location)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam

    I.render_setup(sc, res=(2600, 1100), samples=24, exposure=-0.05, bloom=(2.2, 2))
    I.ink(sc, thickness=1.3, crease=True, angle=150)
    sc.render.filepath = os.path.join(OUT, 'machines_lineup.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED machines_lineup.png')


# --- комната с машинами ------------------------------------------------------
def room():
    I, K = boot()
    r = Room(K, 7.4, 5.8, name='bay')
    r.shell().door('S', -1.9).services(panels=2)
    r.wall_band('N', z=1.20, step=1.20)
    r.wall_band('W', z=1.25, step=1.30, kinds=['cluster', 'terminal'])
    r.wall_band('E', z=1.25, step=1.30, kinds=['terminal', 'cluster'])

    models = P.vol04_models()
    picks = [m['id'] for m in models][:3]
    spots = [(-1.9, 1.0, 0), (0.5, 1.2, 0), (2.4, 0.7, 0)]
    for (x, y, yaw), mid in zip(spots, picks):
        try:
            P.imported_machine(r.frame(x, y, yaw), mid, target_h=1.72, max_span=2.0)
            print('PLACED', mid)
        except Exception as e:
            print('SKIP_IMPORT', mid, type(e).__name__, str(e)[:120])

    P.bench(r.frame(-2.6, -1.9), w=1.8, d=0.85)
    P.cart(r.frame(1.6, -1.9))
    P.stool(r.frame(-0.7, -0.9))
    P.crate(r.frame(3.0, -0.4))
    P.cable_run(r.frame(-3.0, -2.6), [(-0.3, 0.0, 0.02), (1.2, 0.5, 0.03), (2.6, 0.2, 0.02)],
                n=3)

    r.render(cam=(-2.9, -2.5, 1.55), aim=(0.6, 1.2, 1.05), lens=24, out='machines_room.png')


if __name__ == '__main__':
    lineup()
    room()
    print('DONE')
