"""Диагностика сборки: зазоры по геометрии (не по костям) + ортокадры.

Печатает:
  • низ тела против плоскости матраса,
  • верх рельса против низа плиты,
  • центр каждого кольца (по вершинам группы) против сустава,
  • высоту стойки и длину штанги по факту.
Рендерит ортоспереди и ортосбоку — на них зазоры видно без домыслов.

Запуск: blender -b blockout/omni_rig.blend -noaudio --python tools/omni_check.py
"""
import bpy, os, math
from mathutils import Vector

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
sc = bpy.context.scene
mach = bpy.data.objects['OMNI_1']
rig = bpy.data.objects['OMNI_rig']
dg = bpy.context.evaluated_depsgraph_get()
me = mach.evaluated_get(dg).to_mesh()
mw = mach.matrix_world

gi = {g.name: g.index for g in mach.vertex_groups}


def group_verts(name):
    idx = [v.index for v in mach.data.vertices
           if any(g.group == gi[name] for g in v.groups)]
    return [mw @ me.vertices[i].co for i in idx]


def bbox(pts):
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


# плоскость матраса и плиты
mat_lo, mat_hi = bbox(group_verts('roll'))
print('ROLL_BBOX z', round(mat_lo.z, 3), round(mat_hi.z, 3))

plat = group_verts('roll')
print('RAIL? (в группе roll всё вместе — платформа+матрас+рельс)')

# кольца против суставов
body = None
for o in bpy.data.objects:
    if o.type == 'ARMATURE' and o.name != 'OMNI_rig':
        body = o
if body:
    dgb = bpy.context.evaluated_depsgraph_get()
    joints = {}
    for side in ('L', 'R'):
        for jn, kn in ((f'J_Bip_{side}_Hand', 'arm'), (f'J_Bip_{side}_Foot', 'leg')):
            pb = body.pose.bones.get(jn)
            if pb:
                joints[f'{kn}_{side}'] = body.matrix_world @ pb.head
    for k, j in joints.items():
        pts = group_verts(f'head_{k}')
        lo, hi = bbox(pts)
        c = (lo + hi) / 2
        print('RING', k, 'center', [round(v, 3) for v in c], 'joint', [round(v, 3) for v in j],
              'gap', round((c - j).length, 3))

    # связность узла: каретка / штанга / стойка / голова по высоте
    for k in ('arm_L', 'leg_L'):
        for gname in (f'car_{k}', f'boom_{k}', f'post_{k}', f'head_{k}'):
            lo, hi = bbox(group_verts(gname))
            print('PART', gname, 'z', round(lo.z, 3), round(hi.z, 3),
                  'x', round(lo.x, 2), round(hi.x, 2), 'y', round(lo.y, 2), round(hi.y, 2))

    # тело: низ против матраса
    bpts = []
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.name in ('Body', 'Face', 'Hair'):
            ev = o.evaluated_get(dgb)
            m2 = ev.to_mesh()
            m3 = ev.matrix_world
            bpts += [m3 @ v.co for v in m2.vertices]
            ev.to_mesh_clear()
    if bpts:
        print('BODY min z', round(min(p.z for p in bpts), 3))

# ортокадры
cam = bpy.data.objects['cam']
sc.render.resolution_x, sc.render.resolution_y = 1400, 1000


def ortho(name, loc, rot, scale):
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = scale
    cam.location = loc
    cam.rotation_euler = tuple(math.radians(a) for a in rot)
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('SHOT', name)


ortho('chk_side.png', (4.0, 0, 1.0), (90, 0, 90), 2.6)
ortho('chk_front.png', (0, -4.0, 1.0), (90, 0, 0), 2.6)
print('CHECK_DONE')
