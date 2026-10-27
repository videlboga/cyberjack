"""Правка кадра/света в assets_lineup_plain.blend и перерендер без ink.

Открывает сохранённую сцену, ставит широкий кадр на весь ряд, приглушает свет
и пересохраняет. Запуск:
  blender -b .../assets_lineup_plain.blend --python tools/tweak_plain_lineup.py
"""
import bpy, os, math
from mathutils import Vector

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
sc = bpy.context.scene

# кадр: весь ряд 12 × 2.6 м
cam = bpy.data.objects.get('cam')
cam.data.type = 'PERSP'
cam.data.lens = 26
cam.location = (0.0, -24.0, 5.6)
aim = Vector((0.0, 0.0, 0.75))
cam.rotation_euler = (aim - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam

# свет: мягче, чтобы белые материалы не выжигались
for name, energy in (('key', 1.6), ('fill', 0.5)):
    o = bpy.data.objects.get(name)
    if o:
        o.data.energy = energy
if sc.world and sc.world.use_nodes:
    bg = sc.world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Color'].default_value = (0.55, 0.57, 0.60, 1)
        bg.inputs['Strength'].default_value = 0.55

# пол темнее, чтобы предметы читались
floor = bpy.data.objects.get('Plane')
if floor and floor.data.materials:
    m = floor.data.materials[0]
    if m.use_nodes:
        n = m.node_tree.nodes.get('Principled BSDF')
        if n:
            n.inputs['Base Color'].default_value = (0.62, 0.63, 0.65, 1)

sc.render.resolution_x, sc.render.resolution_y = 3200, 1150
sc.eevee.taa_render_samples = 32
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Base Contrast'
sc.view_settings.exposure = -0.3

blend = os.path.join(OUT, 'assets_lineup_plain.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend)
print('SAVED', blend)

sc.render.filepath = os.path.join(OUT, 'assets_lineup_plain.png')
bpy.ops.render.render(write_still=True)
print('RENDERED assets_lineup_plain.png')
