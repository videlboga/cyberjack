"""Подготовка блок-аута к прогулке камерой (Blender 4.2, GUI-сессия).

Ставит камеру в коридор ветки D на высоту глаз 1.62 м, включает вид из камеры
и «Lock Camera to View», чтобы обычная навигация двигала именно камеру.

Запуск:
  DISPLAY=:0 blender lab_wing_D_blockout.blend --python tools/walk_camera.py

Управление в вьюпорте:
  Shift+` (тильда) — режим ходьбы: WASD/стрелки, мышь — обзор, E/Q — вверх/вниз,
                     Shift — быстрее, Esc — выход
  Shift+F         — полёт камерой
  ЛКМ+MMB/колесо  — орбита/зум (двигают камеру, т.к. включён Lock Camera to View)
  Numpad 0        — вернуться в вид камеры
"""
import bpy
from mathutils import Vector

sc = bpy.context.scene
cam = sc.camera
cam.data.lens = 20
cam.data.clip_start = 0.05
cam.data.clip_end = 300
cam.location = (30.75, 13.30, 1.62)
look = Vector((30.75, 21.0, 1.45))
cam.rotation_euler = (look - cam.location).to_track_quat('-Z', 'Y').to_euler()

for area in bpy.context.screen.areas:
    if area.type != 'VIEW_3D':
        continue
    space = area.spaces[0]
    space.shading.type = 'SOLID'
    space.shading.color_type = 'MATERIAL'
    space.shading.light = 'STUDIO'
    space.shading.show_cavity = True
    space.clip_start = 0.05
    space.clip_end = 300
    for attr in ('lock_camera', 'use_camera_lock'):
        if hasattr(space, attr):
            setattr(space, attr, True)
            break
    space.overlay.show_floor = False
    region = next(r for r in area.regions if r.type == 'WINDOW')
    with bpy.context.temp_override(area=area, region=region):
        bpy.ops.view3d.view_camera()
        try:
            bpy.ops.view3d.view_center_camera()
        except Exception as exc:
            print('center-camera skip:', exc)
    break

print('WALK READY: камера в коридоре ветки D, высота 1.62 м, Shift+` — ходьба')
