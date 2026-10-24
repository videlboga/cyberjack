"""Стартовый скрипт для GUI-сессии: ставит камеру на обзор ветки D и включает
вид из камеры в 3D-вьюпорте. Запускается через `blender file.blend --python`.
"""
import bpy
from mathutils import Vector

cam = bpy.context.scene.camera
cam.data.lens = 32
cam.location = (25.6, 11.2, 7.4)
tgt = Vector((30.2, 18.7, 1.1))
cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()

for area in bpy.context.screen.areas:
    if area.type != 'VIEW_3D':
        continue
    space = area.spaces[0]
    space.shading.type = 'SOLID'          # в 4.2 нет MATERIAL как типа затенения
    space.shading.color_type = 'MATERIAL'
    space.shading.light = 'STUDIO'
    space.shading.show_cavity = True
    space.clip_end = 300
    region = next(r for r in area.regions if r.type == 'WINDOW')
    with bpy.context.temp_override(area=area, region=region):
        bpy.ops.view3d.view_camera()
    break

print('VIEW READY', cam.location[:])
