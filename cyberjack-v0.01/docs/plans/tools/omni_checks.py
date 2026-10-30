"""Проверки позы тела на станке: ориентация, суставы, пересечения по деталям."""
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

MACHINE = 'OMNI_1'
BODY = 'Body-footshape-5'
RIG = 'rig_'


def _deg(a, b):
    if a.length < 1e-6 or b.length < 1e-6:
        return 0.0
    import math
    c = max(-1.0, min(1.0, a.normalized().dot(b.normalized())))
    return math.degrees(math.acos(c))


def orientation(body_rig=None, dbg=False):
    """Стопы: в «на спине» носки смотрят вверх (+Z), ничком — вниз."""
    arm = body_rig or bpy.data.objects[RIG]
    out = {}
    for side in ('l', 'r'):
        toe = arm.pose.bones.get(f'toes_01.{side}')
        foot = arm.pose.bones.get(f'foot.{side}')
        if not toe or not foot:
            continue
        d = (arm.matrix_world @ toe.tail) - (arm.matrix_world @ foot.head)
        out[side] = round(d.normalized().z, 2)
    ok = all(v > 0.45 for v in out.values()) if out else None
    if dbg:
        print('ORIENT toes_z', out, 'on_back', ok)
    return ok, out


def joints(body_rig=None, dbg=True):
    """Угол в локте и колене, колено относительно таза."""
    arm = body_rig or bpy.data.objects[RIG]
    res = {}
    for side in ('l', 'r'):
        up = arm.pose.bones.get(f'upperarm.{side}') or arm.pose.bones.get(f'upper_arm.{side}')
        fo = arm.pose.bones.get(f'forearm.{side}')
        ha = arm.pose.bones.get(f'hand.{side}')
        th = arm.pose.bones.get(f'thigh.{side}')
        ca = arm.pose.bones.get(f'calf.{side}')
        ft = arm.pose.bones.get(f'foot.{side}')
        if up and fo and ha:
            a = (arm.matrix_world @ fo.head) - (arm.matrix_world @ up.head)
            b = (arm.matrix_world @ ha.head) - (arm.matrix_world @ fo.head)
            res[f'elbow_{side}'] = round(180 - _deg(a, b), 1)
        if th and ca and ft:
            a = (arm.matrix_world @ ca.head) - (arm.matrix_world @ th.head)
            b = (arm.matrix_world @ ft.head) - (arm.matrix_world @ ca.head)
            res[f'knee_{side}'] = round(180 - _deg(a, b), 1)
            res[f'knee_up_{side}'] = round((arm.matrix_world @ ca.head).z -
                                           (arm.matrix_world @ th.head).z, 2)
    if dbg:
        print('JOINTS', res)
    return res


def _classify(name):
    if name.startswith('head_'):
        return 'cuff'
    if name.startswith('post_'):
        return 'post'
    if name.startswith('car_'):
        return 'carriage'
    if name.startswith('bolster'):
        return 'bolster'
    if name == 'table':
        return 'table'
    return 'other'


def penetration(machine=None, body=None, dbg=True, every=1):
    """Вершины тела внутри станка, с разбивкой по деталям."""
    m = machine or bpy.data.objects[MACHINE]
    b = body or bpy.data.objects[BODY]
    dg = bpy.context.evaluated_depsgraph_get()
    gi = {g.index: g.name for g in m.vertex_groups}
    ev = m.evaluated_get(dg); me = ev.to_mesh(); mw = ev.matrix_world
    samples = []
    for i, v in enumerate(m.data.vertices):
        if i % 3:
            continue
        g = max(v.groups, key=lambda x: x.weight).group if len(v.groups) else None
        samples.append((mw @ me.vertices[i].co, _classify(gi[g]) if g is not None else 'other'))
    ev.to_mesh_clear()

    bvh = BVHTree.FromObject(m, dg)
    evb = b.evaluated_get(dg); mb = evb.to_mesh(); bw = b.matrix_world
    dirs = [Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))]
    counts, depth = {}, {}
    total = 0
    for k, v in enumerate(mb.vertices):
        if k % every:
            continue
        p = bw @ v.co
        votes = 0
        for d in dirs:
            cnt = 0; o = p.copy()
            for _ in range(8):
                hit = bvh.ray_cast(o, d)
                if hit[0] is None:
                    break
                cnt += 1; o = hit[0] + d * 1e-4
            if cnt % 2 == 1:
                votes += 1
        if votes < 2:
            continue
        total += 1
        part, best = 'other', None
        for q, cl in samples:
            dd = (p - q).length
            if best is None or dd < best:
                best, part = dd, cl
        counts[part] = counts.get(part, 0) + 1
        depth[part] = max(depth.get(part, 0.0), best or 0.0)
    evb.to_mesh_clear()
    res = {'total': total, 'counts': counts,
           'depth': {k: round(v, 3) for k, v in depth.items()}}
    if dbg:
        print('PENETRATION', res)
    return res


def report():
    ok, toes = orientation(dbg=True)
    j = joints(dbg=True)
    p = penetration(dbg=True)
    bad = []
    if ok is not True:
        bad.append('тело не на спине')
    for s in ('l', 'r'):
        if j.get(f'elbow_{s}', 180) < 140:
            bad.append(f'локоть {s} пересогнут')
        if j.get(f'knee_{s}', 180) < 140:
            bad.append(f'колено {s} пересогнуто')
        if j.get(f'knee_up_{s}', 0) < 0:
            bad.append(f'колено {s} ниже таза')
    for part in ('table', 'bolster', 'post', 'carriage'):
        if p['counts'].get(part):
            bad.append(f'тело в детали: {part}')
    print('POSE_BAD', bad)
    return bad
