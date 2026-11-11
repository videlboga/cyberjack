# Модель и скелет источника в одном ракурсе: чтобы сравнивать позу, а не впечатление.
#   blender -b posed.blend --python compare-with-source.py -- frame.json out.png outsource.png
import bpy, sys, json, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
frame_path, out_model, out_skel = argv[0], argv[1], argv[2]
d = json.load(open(frame_path))
names, par, fr = d['names'], d['parents'], d['frame']
arm = bpy.data.objects['rig_H']
B = arm.data.bones

same = (fr[names.index('cf_j_foot_L')][0] < fr[names.index('cf_j_foot_R')][0]) != \
       (B['leftFoot'].head_local.x < B['rightFoot'].head_local.x)
conv = (lambda p: Vector((-p[0], -p[2], p[1]))) if same else (lambda p: Vector((p[0], -p[2], p[1])))
S = [conv(p) for p in fr]
_tgt = [B[n].head_local for n in ('hips', 'head', 'leftFoot', 'rightFoot', 'leftHand', 'rightHand', 'leftToes')]
scale = max(max(p[i] for p in _tgt) - min(p[i] for p in _tgt) for i in range(3))
shift = B['hips'].head_local - S[names.index('cf_j_hips')] * scale
S = [p * scale + shift for p in S]

sc = bpy.context.scene
for o in bpy.data.objects:
    if o.type == 'MESH' and (o.name.startswith('cs_') or 'Review ground' in o.name):
        o.hide_render = True
cam_data = bpy.data.cameras.new('C')
cam = bpy.data.objects.new('C', cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
sc.render.resolution_x = 380
sc.render.resolution_y = 520
target = Vector((0, 0, 0.95))
cam.location = Vector((0, -3.3, 1.0))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.render.filepath = out_model
bpy.ops.render.render(write_still=True)
print('MODEL_OK')

# скелет: скрыть меши, нарисовать цилиндры по точкам источника
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in meshes:
    o.hide_render = True
mat = bpy.data.materials.new('sk')
mat.diffuse_color = (0.1, 0.6, 1.0, 1)
for i, p in enumerate(S):
    if par[i] is None:
        continue
    a = S[par[i]]
    L = (p - a).length
    if L < 1e-4:
        continue
    bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=L, location=(a + p) / 2)
    ob = bpy.context.object
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((p - a).normalized())
    ob.data.materials.append(mat)
sc.render.filepath = out_skel
bpy.ops.render.render(write_still=True)
print('SKEL_OK')
