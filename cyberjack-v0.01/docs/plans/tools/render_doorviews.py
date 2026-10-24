"""Виды от двери в каждую станционную комнату: проверка, что станок смотрит
рабочей стороной к проходу.

Запуск: blender -b blockout/lab_wing_D_blockout.blend -noaudio --python tools/render_doorviews.py
Выход: /tmp/doorviews/<room>.png и blockout/doorviews.png
"""
import bpy, json, os
from mathutils import Vector

PLAN = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/lab-floorplan.json'
OUT = '/tmp/doorviews'
os.makedirs(OUT, exist_ok=True)

d = json.load(open(PLAN, encoding='utf-8'))
rooms = {r['id']: r for r in d['rooms']}
machines = {o['room']: o for o in d['objects'] if o['kind'] == 'machine'}

sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'MATERIAL'
sc.display.shading.show_cavity = True
sc.display.shading.background_type = 'VIEWPORT'
sc.display.shading.background_color = (0.16, 0.18, 0.20)
sc.render.resolution_x, sc.render.resolution_y = 700, 520

cd = bpy.data.cameras.new('DoorCam')
cd.lens = 22
cam = bpy.data.objects.new('DoorCam', cd)
sc.collection.objects.link(cam)
sc.camera = cam

targets = [rid for rid in rooms if rooms[rid].get('kind') == 'station' and rid in machines]
print('rooms:', len(targets))
for rid in sorted(targets, key=lambda r: rooms[r].get('station') or ''):
    r = rooms[rid]
    # точка у двери: за стеной с проёмом, внутри соседнего коридора
    if r.get('sector') and rooms.get(f'room_wing_{r["sector"]}'):
        wing = rooms[f'room_wing_{r["sector"]}']
        door_x = wing['x0'] + wing['w'] / 2 if r['x0'] > wing['x0'] + wing['w'] / 2 else wing['x0'] + wing['w'] / 2
    m = machines[rid]
    # камера в проёме комнаты (на 0.9 м внутрь от стены с дверью)
    door_side_east = (m['x'] - r['x0']) < (r['x1'] - m['x'])  # станок ближе к западной стене → дверь на востоке
    # камера СНАРУЖИ комнаты, в коридоре-ветке: видно, открыт ли проём
    cam_x = r['x1'] + 1.20 if door_side_east else r['x0'] - 1.20
    cam_y = (r['y0'] + r['y1']) / 2
    cam.location = (cam_x, cam_y, 1.55)
    tgt = Vector((m['x'], m['y'], min(1.1, m['h'] * 0.55)))
    cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, f'{rid}.png')
    bpy.ops.render.render(write_still=True)
    print('shot', rid, 'cam', round(cam_x, 2), round(cam_y, 2))
print('DOORVIEWS DONE')
