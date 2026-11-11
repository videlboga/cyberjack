"""Собрать полнотелую симуляцию на готовой текстурированной Mira.

Исходная модель не пересобирается: сохраняются её меши, UV, материалы, волосы,
151 морф и 971-костный скелет. Добавляются только недостающие фаланги пальцев
ног, веса, зоны чувствительности, дыхание, камеры и операторский контроль.
"""
import bpy
import json
import math
import os
from collections import Counter
from pathlib import Path

from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
BUNDLE = HERE.parent
SOURCE = BUNDLE / 'characters/mira/Mira_outfit_03_toes.vrm'
OUT = HERE / 'tickle_ready.blend'
REPORTS = HERE / 'reports'
PREVIEW = HERE / 'preview'
REPORTS.mkdir(exist_ok=True)
PREVIEW.mkdir(exist_ok=True)

ZONE_NAMES = ['heel', 'arch_medial', 'arch_lateral', 'ball', 'toe_pad_1',
              'toe_pad_2_5', 'instep', 'ankle_ring']
ZONE_BASE = {'heel': 0.55, 'arch_medial': 0.95, 'arch_lateral': 0.70,
             'ball': 0.85, 'toe_pad_1': 0.90, 'toe_pad_2_5': 0.80,
             'instep': 0.45, 'ankle_ring': 0.35}
TOE_FACTOR = {1: 1.00, 2: 0.95, 3: 0.90, 4: 0.82, 5: 0.75}
TOES = ['BigToe', 'SmallToe1', 'SmallToe2', 'SmallToe3', 'SmallToe4']


def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH' and (not obj.data.polygons or obj.name.startswith('Icosphere')):
            bpy.data.objects.remove(obj, do_unlink=True)


def find_rig_body():
    rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    body = next(o for o in bpy.data.objects if o.type == 'MESH' and
                any(m and m.name == 'KK cf_m_body' for m in o.data.materials))
    rig.name = 'rig_ready'
    return rig, body


def configure_materials():
    fixed = 0
    for mat in bpy.data.materials:
        if not mat.node_tree:
            continue
        mat.surface_render_method = 'BLENDED'
        mat.use_transparency_overlap = False
        mat.use_transparent_shadow = False
        mat.use_backface_culling = False
        fixed += 1
    return fixed


def weights_of(vertex):
    return {g.group: g.weight for g in vertex.groups if g.weight > 0}


def cluster_1d(values, count, iterations=40):
    values = sorted(values)
    centers = [values[int((i + 0.5) * len(values) / count)] for i in range(count)]
    for _ in range(iterations):
        groups = [[] for _ in range(count)]
        for value in values:
            index = min(range(count), key=lambda i: abs(value - centers[i]))
            groups[index].append(value)
        new = [sum(group) / len(group) if group else centers[i] for i, group in enumerate(groups)]
        if max(abs(a - b) for a, b in zip(centers, new)) < 1e-6:
            centers = new
            break
        centers = new
    return centers


def add_toe_bones(rig, body, side):
    sign = 1 if side == 'L' else -1
    suffix = '.L' if side == 'L' else '.R'
    ankle_name = 'Left ankle' if side == 'L' else 'Right ankle'
    toe_name = 'Left toe' if side == 'L' else 'Right toe'
    ankle = rig.matrix_world @ rig.data.bones[ankle_name].head_local
    ball = rig.matrix_world @ rig.data.bones[toe_name].head_local
    forward = Vector((ball.x - ankle.x, ball.y - ankle.y, 0))
    forward.normalize()
    medial = Vector((-sign, 0, 0))
    old_names = [toe_name] + [f'k_f_toe{side}_{i:02d}' for i in range(4)]
    old_indices = {body.vertex_groups[n].index for n in old_names if n in body.vertex_groups}
    selected = []
    for vertex in body.data.vertices:
        w = weights_of(vertex)
        if sum(w.get(i, 0.0) for i in old_indices) < 0.05:
            continue
        p = body.matrix_world @ vertex.co
        s = (p - ball).dot(forward)
        if s >= -0.014 and p.z < 0.15 and p.x * sign > 0:
            selected.append((vertex.index, p, s))
    if not selected:
        raise RuntimeError(f'no toe vertices for {side}')
    lateral = [((p - ball).dot(medial)) for _, p, _ in selected]
    centers = sorted(cluster_1d(lateral, 5), reverse=(side == 'L'))
    clusters = [[] for _ in range(5)]
    for item, lat in zip(selected, lateral):
        clusters[min(range(5), key=lambda i: abs(lat - centers[i]))].append((item, lat))

    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    created = []
    bone_segments = {}
    toe_bounds = {}
    for ti, cluster in enumerate(clusters):
        toe = 'BigToe' if ti == 0 else f'SmallToe{ti}'
        values = [p for (_, p, s), _ in cluster]
        ss = [s for (_, p, s), _ in cluster]
        lat_center = sum(lat for _, lat in cluster) / len(cluster)
        z_center = sorted(p.z for p in values)[len(values) // 2]
        s0 = max(-0.001, min(ss))
        s1 = max(s0 + 0.012, max(ss) * 0.96)
        length = s1 - s0
        boundaries = [0.0, 0.55, 1.0] if ti == 0 else [0.0, 0.38, 0.72, 1.0]
        names = []
        for segment in range(len(boundaries) - 1):
            name = toe + suffix if segment == 0 else f'{toe}_{segment + 1}{suffix}'
            a = ball + forward * (s0 + length * boundaries[segment]) + medial * lat_center
            b = ball + forward * (s0 + length * boundaries[segment + 1]) + medial * lat_center
            a.z = z_center
            b.z = z_center
            bone = eb.new(name)
            bone.head = rig.matrix_world.inverted() @ a
            bone.tail = rig.matrix_world.inverted() @ b
            bone.align_roll(Vector((0, 0, 1)))
            bone.use_deform = True
            bone.parent = eb[toe_name] if segment == 0 else eb[names[-1]]
            bone.use_connect = segment > 0
            names.append(name)
            created.append(name)
        bone_segments[toe] = names
        toe_bounds[toe] = (s0, s1)
    bpy.ops.object.mode_set(mode='OBJECT')

    for name in created:
        if name not in body.vertex_groups:
            body.vertex_groups.new(name=name)
    for cluster, toe in zip(clusters, TOES):
        names = bone_segments[toe]
        s0, s1 = toe_bounds[toe]
        for (vi, p, s), _ in cluster:
            t = max(0.0, min(1.0, (s - s0) / max(0.001, s1 - s0)))
            weights = {}
            if t < 0.16:
                weights[toe_name] = 0.30 * (1.0 - t / 0.16)
            rest = 1.0 - sum(weights.values())
            if len(names) == 2:
                if t < 0.48:
                    weights[names[0]] = rest
                elif t < 0.60:
                    u = (t - 0.48) / 0.12
                    weights[names[0]] = rest * (1 - u)
                    weights[names[1]] = rest * u
                else:
                    weights[names[1]] = rest
            else:
                if t < 0.34:
                    weights[names[0]] = rest
                elif t < 0.44:
                    u = (t - 0.34) / 0.10
                    weights[names[0]] = rest * (1 - u)
                    weights[names[1]] = rest * u
                elif t < 0.66:
                    weights[names[1]] = rest
                elif t < 0.76:
                    u = (t - 0.66) / 0.10
                    weights[names[1]] = rest * (1 - u)
                    weights[names[2]] = rest * u
                else:
                    weights[names[2]] = rest
            for group_index in old_indices:
                try:
                    body.vertex_groups[group_index].remove([vi])
                except RuntimeError:
                    pass
            for name, weight in weights.items():
                if weight > 1e-5:
                    body.vertex_groups[name].add([vi], weight, 'REPLACE')
    return {'side': side, 'vertices': len(selected), 'bones': created,
            'cluster_sizes': [len(c) for c in clusters],
            'cluster_x': [round(c, 5) for c in centers],
            'old_groups': old_names}


def normalize_weights(body):
    for vertex in body.data.vertices:
        total = sum(g.weight for g in vertex.groups)
        if total <= 1e-8:
            continue
        for g in list(vertex.groups):
            body.vertex_groups[g.group].add([vertex.index], g.weight / total, 'REPLACE')


def mark_zones(body, rig):
    me = body.data
    bones = rig.data.bones
    ankle = rig.matrix_world @ bones['Left ankle'].head_local
    ball = rig.matrix_world @ bones['Left toe'].head_local
    axis = (ball - ankle).normalized()
    medial = Vector((-1 if ankle.x > 0 else 1, 0, 0))
    ball_dist = (ball - ankle).length
    left_groups = {g.index for g in body.vertex_groups
                   if g.name.lower().startswith('left') or g.name.lower().endswith('.l')}
    toe_tips, toe_centers = [], []
    for i in range(1, 6):
        name = 'BigToe.L' if i == 1 else f'SmallToe{i - 1}.L'
        toe_tips.append(rig.matrix_world @ bones[name].tail_local)
        toe_centers.append(rig.matrix_world @ ((bones[name].head_local + bones[name].tail_local) * 0.5))

    def toe_zone(center):
        nearest = min(range(5), key=lambda i: (center - toe_tips[i]).length)
        return 4 if nearest == 0 else 5

    def is_left(poly):
        votes = 0
        for vi in poly.vertices:
            if any(g.group in left_groups and g.weight > 0.2 for g in me.vertices[vi].groups):
                votes += 1
        return votes * 2 >= len(poly.vertices)

    def classify(center, normal):
        rel = center - ankle
        s = rel.dot(axis)
        m = rel.dot(medial)
        if center.z > ankle.z - 0.002:
            return -1
        sole = normal.dot(Vector((0, 0, -1))) > 0.35
        if s < 0:
            return 0
        if sole:
            if s < 0.55 * ball_dist:
                return 1 if m > 0 else 2
            if s < 0.98 * ball_dist:
                return 3
            return toe_zone(center)
        if center.z > ankle.z - 0.014 and rel.length < 0.045:
            return 7
        if s < 0.92 * ball_dist:
            return 6
        return toe_zone(center)

    zones = []
    for p in me.polygons:
        center = body.matrix_world @ p.center
        normal = (body.matrix_world.to_3x3() @ p.normal).normalized()
        zones.append(classify(center, normal) if is_left(p) else -1)
    toe_index, sens = {}, []
    for p in me.polygons:
        z = zones[p.index]
        value = ZONE_BASE[ZONE_NAMES[z]] if z >= 0 else 0.0
        if z in {4, 5}:
            center = body.matrix_world @ p.center
            ti = min(range(5), key=lambda i: (center - toe_tips[i]).length)
            toe_index[p.index] = ti
            value *= TOE_FACTOR[ti + 1]
        sens.append(value)
    edge_faces = {}
    for p in me.polygons:
        for edge in p.edge_keys:
            edge_faces.setdefault(edge, []).append(p.index)
    adjacency = [set() for _ in me.polygons]
    for faces in edge_faces.values():
        for a in faces:
            adjacency[a].update(b for b in faces if b != a)
    for _ in range(3):
        new = sens[:]
        for i, value in enumerate(sens):
            if zones[i] < 0:
                continue
            neighbors = [sens[j] for j in adjacency[i] if zones[j] >= 0]
            if neighbors:
                new[i] = (value * 2 + sum(neighbors)) / (2 + len(neighbors))
        sens = new
    inter = [0] * len(me.polygons)
    for p in me.polygons:
        ti = toe_index.get(p.index)
        if ti is None:
            continue
        nb = ti + 1 if ti < 4 else ti - 1
        center = body.matrix_world @ p.center
        lat = (center - toe_centers[ti]).dot(medial)
        toward = toe_centers[nb] - toe_centers[ti]
        toward = (toward - toward.dot(Vector((0, 0, 1))) * Vector((0, 0, 1))).normalized()
        normal = (body.matrix_world.to_3x3() @ p.normal).normalized()
        if (lat < 0 if ti < nb else lat > 0) and normal.dot(toward) > 0.35:
            inter[p.index] = ti + 1
    for name in ['zone_id', 'sensitivity', 'intertoe_side']:
        if name in me.attributes:
            me.attributes.remove(me.attributes[name])
    me.attributes.new(name='zone_id', type='INT', domain='FACE')
    me.attributes.new(name='sensitivity', type='FLOAT', domain='FACE')
    me.attributes.new(name='intertoe_side', type='INT', domain='FACE')
    me.attributes['zone_id'].data.foreach_set('value', zones)
    me.attributes['sensitivity'].data.foreach_set('value', sens)
    me.attributes['intertoe_side'].data.foreach_set('value', inter)
    body['zone_names'] = json.dumps(ZONE_NAMES)
    counts = Counter(z for z in zones if z >= 0)
    areas = {z: 0.0 for z in range(8)}
    for p in me.polygons:
        if zones[p.index] >= 0:
            areas[zones[p.index]] += p.area
    return {'counts': {ZONE_NAMES[k]: v for k, v in counts.items()},
            'areas_cm2': {ZONE_NAMES[k]: round(v * 10000, 2) for k, v in areas.items()}}


def add_breath(body):
    if 'Tickle_Breath' in body.data.shape_keys.key_blocks:
        return
    basis = body.data.shape_keys.key_blocks[0]
    key = body.shape_key_add(name='Tickle_Breath', from_mix=False)
    groups = {g.name: g.index for g in body.vertex_groups}
    chest = {groups.get(n) for n in ['Chest', 'Upper Chest', 'Spine'] if n in groups}
    for vertex in body.data.vertices:
        w = sum(g.weight for g in vertex.groups if g.group in chest)
        if w > 0.02:
            co = basis.data[vertex.index].co.copy()
            co += vertex.normal * (0.0035 * min(1.0, w))
            key.data[vertex.index].co = co


def make_cameras():
    scene = bpy.context.scene
    cams = {}

    def camera(name, location, target, scale, ortho=True):
        data = bpy.data.cameras.new(name)
        data.type = 'ORTHO' if ortho else 'PERSP'
        if ortho:
            data.ortho_scale = scale
        else:
            data.lens = scale
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = location
        obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()
        cams[name] = obj
        return obj

    camera('Camera_Full', (0.0, -3.2, 0.92), (0.0, 0.0, 0.88), 1.88)
    camera('Camera_Face', (0.16, -0.72, 1.49), (0.0, -0.015, 1.455), 0.40)
    camera('Camera_Sole', (0.16, -0.16, -0.34), (0.078, -0.015, 0.06), 0.32)
    return cams


def make_lights():
    scene = bpy.context.scene
    for name, loc, energy, size in [('Key', (-2.2, -3.2, 3.1), 650, 4.0),
                                    ('Fill', (2.6, -1.4, 2.0), 280, 3.2),
                                    ('Rim', (0.2, 2.6, 2.8), 520, 3.0)]:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy = energy
        data.shape = 'DISK'
        data.size = size
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = loc
        obj.rotation_euler = (Vector((0, 0, 1.0)) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def configure_scene():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = 16
    scene.render.resolution_x = 1080
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.fps = 15
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    world = bpy.data.worlds.new('Tickle World')
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (0.035, 0.035, 0.045, 1)
    bg.inputs['Strength'].default_value = 0.8
    scene.world = world
    make_lights()


def main():
    clean_scene()
    rig, body = find_rig_body()
    materials = configure_materials()
    toe_reports = [add_toe_bones(rig, body, 'L'), add_toe_bones(rig, body, 'R')]
    normalize_weights(body)
    zones = mark_zones(body, rig)
    add_breath(body)
    configure_scene()
    make_cameras()
    control = bpy.data.objects.new('Tickle_Control', None)
    bpy.context.scene.collection.objects.link(control)
    control.empty_display_type = 'SPHERE'
    control.empty_display_size = 0.03
    control.hide_render = True
    control['rig_name'] = rig.name
    control['body_name'] = body.name
    control['source_vrm'] = str(SOURCE)
    control['morphs'] = len(body.data.shape_keys.key_blocks) if body.data.shape_keys else 0
    control['active_zone'] = ''
    for key in ['stimulus', 'delivered', 'perceived', 'adaptation', 'load', 'expectedness',
                'face', 'breath', 'voice', 'mouth', 'local', 'body', 'flinch']:
        control[key] = 0.0
    control['onsets_ms'] = '{}'
    control['character'] = 'rest'
    # Мягкая рабочая поза: руки не в T-позе, колени слегка согнуты.
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    for poly in body.data.polygons:
        poly.use_smooth = True
    report = {
        'source': str(SOURCE),
        'rig_bones_before': 971,
        'rig_bones_after': len(rig.data.bones),
        'mesh_objects': [{'name': o.name, 'vertices': len(o.data.vertices), 'materials': [m.name for m in o.data.materials],
                          'morphs': len(o.data.shape_keys.key_blocks) if o.data.shape_keys else 0}
                         for o in bpy.data.objects if o.type == 'MESH' and o.data.polygons],
        'materials': materials,
        'body_vertices': len(body.data.vertices),
        'body_polygons': len(body.data.polygons),
        'zones': zones,
        'toes': toe_reports,
        'expressions': 18,
        'shape_keys': len(body.data.shape_keys.key_blocks) if body.data.shape_keys else 0,
        'deforming_bones': sum(1 for b in rig.data.bones if b.use_deform),
        'weighted_vertices': sum(1 for v in body.data.vertices if v.groups),
    }
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT), compress=True)
    (REPORTS / 'build_ready.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('READY_BUILD_OK=' + json.dumps({k: report[k] for k in ['rig_bones_after', 'body_vertices', 'body_polygons', 'shape_keys', 'weighted_vertices']}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
