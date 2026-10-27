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
    """Все машины vol-04 в один ряд с подписями, сцена сохраняется в .blend."""
    I, K = boot()
    models = P.vol04_models()
    if not models:
        print('NO_MODELS')
        return

    step = 3.6
    per_row = 6
    rows = (len(models) + per_row - 1) // per_row
    x0 = -(per_row - 1) * step / 2
    for i, m in enumerate(models):
        x = x0 + (i % per_row) * step
        y = 0.0 if i < per_row else 4.6
        try:
            P.imported_machine(Frame(K, x, y, 0, prefix=f'm{i}_'), m['id'],
                               target_h=1.72, max_span=2.0, target_tris=5000)
            print('PLACED', m['id'])
        except Exception as e:
            print('SKIP_IMPORT', m['id'], type(e).__name__, str(e)[:120])

        # подпись под машиной
        cu = bpy.data.curves.new(f'lbl{i}', 'FONT')
        cu.body = m['id'].split('-')[-1]
        cu.size = 0.20
        cu.align_x = 'CENTER'
        tob = bpy.data.objects.new(f'lbl{i}', cu)
        bpy.context.scene.collection.objects.link(tob)
        tob.location = (x, y - 0.95, 0.02)
        tob.rotation_euler = (math.radians(90), 0, 0)
        tob.data.materials.append(I.M['dark'])

    bpy.ops.mesh.primitive_plane_add(size=40, location=(0.0, 1.6, -0.002))
    floor = bpy.context.object
    floor.name = 'lineup_floor'
    I.apply(floor, 'floor')

    I.lights(bpy.context.scene)
    sc = bpy.context.scene
    cd = bpy.data.cameras.new('cam')
    cd.type = 'ORTHO'
    cd.ortho_scale = (per_row - 1) * step + 4.6
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    cam.location = (0.0, -12.0, 4.2)
    cam.rotation_euler = (math.radians(74), 0, 0)
    sc.camera = cam

    I.render_setup(sc, res=(2400, 1150), samples=8, exposure=-0.02, bloom=(1.6, 2))
    I.ink(sc, thickness=1.4, crease=False, angle=150)
    # сначала сохраняем сцену, рендер — отдельно: Freestyle на 11 машинах идёт долго
    blend = os.path.join(OUT, 'machines_lineup.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    print('SAVED', blend)

    sc.render.filepath = os.path.join(OUT, 'machines_lineup_all.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED machines_lineup_all.png')


# --- комната с машинами ------------------------------------------------------
def room():
    I, K = boot()
    r = Room(K, 7.4, 5.8, name='bay')
    r.shell().door('S', -1.9).services(panels=2)
    r.wall_band('N', z=1.20, step=1.20)
    r.wall_band('W', z=1.25, step=1.30, kinds=['cluster', 'terminal'])
    r.wall_band('E', z=1.25, step=1.30, kinds=['terminal', 'cluster'])

    # отобранные вручную: чистые модели, у которых читается рабочая сторона
    picks = [f'SexMachineModel-{n}' for n in ('089', '092', '099')]
    spots = [(-1.75, 1.35, 150), (0.25, 1.55, 180), (1.95, 1.30, 200)]
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

    # сохраняем сцену: машины уже влиты в меши, внешние ассеты не нужны
    r.render(cam=(-3.05, -2.50, 1.62), aim=(0.15, 1.50, 0.92), lens=17, out='machines_room.png')
    blend = os.path.join(OUT, 'machines_room.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    print('SAVED', blend)


if __name__ == '__main__':
    mode = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'all'
    if mode in ('all', 'lineup'):
        lineup()
    if mode in ('all', 'room'):
        room()
    print('DONE', mode)