"""Рендер короткого прохода камерой по ветке D: коридор → комната 071.

Workbench, 960×540, 24 fps, 120 кадров (~5 с). Кадры в /tmp/walk, mp4 рядом.
Запуск: blender -b blockout/lab_wing_D_blockout.blend --python tools/render_walkthrough.py
"""
import bpy, os, math
from mathutils import Vector

OUT_DIR = '/tmp/walk'
os.makedirs(OUT_DIR, exist_ok=True)
MP4 = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout/walkthrough_wingD.mp4'

sc = bpy.context.scene
cam = sc.camera
cam.data.lens = 20
cam.data.clip_start = 0.05
cam.data.clip_end = 300
cam.animation_data_clear()

sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'MATERIAL'
sc.display.shading.show_cavity = True
sc.display.render_aa = '8'
sc.render.resolution_x, sc.render.resolution_y = 960, 540
sc.render.fps = 24
sc.frame_start, sc.frame_end = 1, 120

# поза камеры: позиция + точка взгляда на кадр
KEYS = [
    (1,   (30.75, 13.30, 1.62), (30.75, 21.00, 1.45)),
    (30,  (30.75, 16.20, 1.62), (30.75, 22.00, 1.45)),
    (55,  (30.70, 18.10, 1.62), (29.60, 18.60, 1.35)),
    (75,  (30.20, 18.45, 1.60), (27.60, 18.55, 1.15)),
    (100, (28.80, 18.50, 1.58), (26.60, 18.50, 1.05)),
    (120, (28.20, 18.50, 1.58), (26.40, 18.55, 1.00)),
]

for frame, pos, look in KEYS:
    sc.frame_set(frame)
    cam.location = pos
    cam.rotation_euler = (Vector(look) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
    cam.keyframe_insert('location', frame=frame)
    cam.keyframe_insert('rotation_euler', frame=frame)

# плавная интерполяция
action = cam.animation_data.action
for fc in action.fcurves:
    for kp in fc.keyframe_points:
        kp.interpolation = 'BEZIER'
        kp.easing = 'AUTO'

sc.render.filepath = os.path.join(OUT_DIR, 'f')
bpy.ops.render.render(animation=True)
print('FRAMES DONE', sc.frame_end)
