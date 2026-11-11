import bpy, math
from mathutils import Vector
sc = bpy.context.scene
cam = bpy.data.objects['cam']
cam.data.lens = 55
cx = -14.4          # x модели 090 в ряду
sc.render.resolution_x, sc.render.resolution_y = 900, 800
sc.eevee.taa_render_samples = 24
import os
OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
for name, (dx, dy) in {'a': (2.8, -3.0), 'b': (-2.8, -3.0), 'c': (2.4, 3.2), 'd': (-2.4, 3.2)}.items():
    cam.location = (cx + dx, dy, 1.9)
    aim = Vector((cx, 0.0, 0.75))
    cam.rotation_euler = (aim - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, 'turn_090_%s.png' % name)
    bpy.ops.render.render(write_still=True)
    print('SHOT', name)
