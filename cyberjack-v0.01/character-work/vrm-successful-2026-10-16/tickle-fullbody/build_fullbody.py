"""Полноростовая симуляция на откалиброванном скелете редактора Cyberjack.

Основа суставов — character-factory/mira/anatomy-rig.js: редактор пересчитывает
старые лодыжки/запястья по коже. Пальцы рук/ног и их исходные веса сохраняются.
Исходники только читаются; пишется новый tickle_fullbody.blend.
"""
import base64
import bpy
import json
import math
import struct
from collections import Counter
from pathlib import Path
import numpy as np
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
BUNDLE = HERE.parent
BASE = BUNDLE / 'character-factory/base-rigged.blend'
HEAD = BUNDLE / 'character-factory/mira/work/exports/Mira-Anatomy.vrm'
ANATOMY = BUNDLE / 'character-factory/mira/anatomy-rig.js'
OUT = HERE / 'tickle_fullbody.blend'
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
FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky']
PARENTS = {
    'pelvis': None, 'waist': 'pelvis', 'abdomen': 'waist', 'chest': 'abdomen',
    'upperchest': 'chest', 'neck': 'upperchest', 'head': 'neck',
}
for side in ('l', 'r'):
    PARENTS.update({f'shoulder.{side}': 'upperchest', f'upperarm.{side}': f'shoulder.{side}',
                    f'forearm.{side}': f'upperarm.{side}', f'hand.{side}': f'forearm.{side}',
                    f'thigh.{side}': 'pelvis', f'shin.{side}': f'thigh.{side}',
                    f'foot.{side}': f'shin.{side}', f'toes_01.{side}': f'foot.{side}'})


def jsdata(path):
    text = Path(path).read_text(encoding='utf-8')
    return json.loads(text[text.index('=') + 1:].strip().rstrip(';'))


def glb_json(path):
    raw = Path(path).read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    return json.loads(raw[20:20 + length])


def transferred_frame(old_bone, new_head, new_tail):
    old_dir = (old_bone.tail_local - old_bone.head_local).normalized()
    new_dir = (Vector(new_tail) - Vector(new_head)).normalized()
    rotation = old_dir.rotation_difference(new_dir).to_matrix()
    return Matrix.Translation(Vector(new_head)) @ rotation.to_4x4() @ Matrix.Translation(-old_bone.head_local)


def build_clean_rig(old_rig, body, editor):
    """52-слотовое ядро не нужно: используем 21 сустав редактора + все фаланги."""
    specs = {}
    for bone in editor['bones']:
        specs[bone['name']] = (Vector(bone['head']), Vector(bone['tail']), PARENTS.get(bone['name']))
    for side, suffix in [('l', 'L'), ('r', 'R')]:
        foot = next(b for b in editor['bones'] if b['name'] == f'foot.{side}')
        hand = next(b for b in editor['bones'] if b['name'] == f'hand.{side}')
        foot_frame = transferred_frame(old_rig.data.bones[f'foot.{side}'], foot['head'], foot['tail'])
        hand_frame = transferred_frame(old_rig.data.bones[f'hand.{side}'], hand['head'], hand['tail'])
        old_toes = old_rig.data.bones[f'toes_01.{side}']
        specs[f'toes_01.{side}'] = (foot_frame @ old_toes.head_local,
                                    foot_frame @ old_toes.tail_local, f'foot.{side}')
        for toe in TOES:
            for segment in ('', '_2'):
                name = f'{toe}{segment}.{suffix}'
                old = old_rig.data.bones[name]
                parent = f'toes_01.{side}' if not segment else f'{toe}.{suffix}'
                specs[name] = (foot_frame @ old.head_local, foot_frame @ old.tail_local, parent)
        for finger in FINGERS:
            for number in (1, 2, 3):
                name = f'{finger}{number}.{side}'
                candidates = [name, f'{finger}{number}_ref.{side}', f'c_{finger}{number}.{side}']
                source_name = next(candidate for candidate in candidates if candidate in old_rig.data.bones)
                old = old_rig.data.bones[source_name]
                parent = f'hand.{side}' if number == 1 else f'{finger}{number - 1}.{side}'
                specs[name] = (hand_frame @ old.head_local, hand_frame @ old.tail_local, parent)

    # Лодыжки/запястья редактор калибрует, но исходные фаланги сохраняют старое
    # смещение. Посадим каждую цепь по вершинам её собственных весовых групп.
    group_indices = {g.name: g.index for g in body.vertex_groups}
    point_cache = {}
    def points(name):
        if name not in point_cache:
            gi = group_indices.get(name)
            rows = [(v.co.copy(), g.weight) for v in body.data.vertices for g in v.groups
                    if gi is not None and g.group == gi and g.weight > 0.05]
            point_cache[name] = (np.array([tuple(r[0]) for r in rows]),
                                 np.array([r[1] for r in rows])) if rows else (None, None)
        return point_cache[name]
    def endpoints(name, axis):
        p, _ = points(name)
        if p is None or len(p) < 4:
            return None
        projection = p @ np.array(axis)
        lo, hi = np.percentile(projection, [10, 90])
        return Vector(p[projection <= lo].mean(axis=0)), Vector(p[projection >= hi].mean(axis=0))
    def continuous_chain(names, axis):
        fits = [endpoints(name, axis) for name in names]
        if any(fit is None for fit in fits):
            return None
        result = [fits[0][0]]
        for a, b in zip(fits, fits[1:]):
            result.append((a[1] + b[0]) * 0.5)
        result.append(fits[-1][1])
        return result
    for side, suffix in [('l', 'L'), ('r', 'R')]:
        foot_axis = (specs[f'toes_01.{side}'][0] - specs[f'foot.{side}'][0]).normalized()
        bases, joints = [], []
        for toe in TOES:
            names = [f'{toe}.{suffix}', f'{toe}_2.{suffix}']
            chain = continuous_chain(names, foot_axis)
            if chain:
                specs[names[0]] = (chain[0], chain[1], f'toes_01.{side}')
                specs[names[1]] = (chain[1], chain[2], names[0])
                bases.append(chain[0])
                joints.append(chain[1])
        if bases:
            base = sum(bases, Vector()) / len(bases)
            joint = sum(joints, Vector()) / len(joints)
            specs[f'toes_01.{side}'] = (base, joint, f'foot.{side}')
        for finger in FINGERS:
            names = [f'{finger}{number}.{side}' for number in (1, 2, 3)]
            sources = [names[0], f'c_{finger}2.{side}', f'c_{finger}3.{side}']
            tip_points, _ = points(sources[-1])
            if tip_points is None:
                continue
            axis = (Vector(tip_points.mean(axis=0)) - specs[f'hand.{side}'][0]).normalized()
            chain = continuous_chain(sources, axis)
            if chain:
                for number, name in enumerate(names):
                    parent = f'hand.{side}' if number == 0 else names[number - 1]
                    specs[name] = (chain[number], chain[number + 1], parent)
    arm = bpy.data.armatures.new('Cyberjack calibrated full body')
    rig = bpy.data.objects.new('rig_E', arm)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for name, (head, tail, parent) in specs.items():
        bone = arm.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        if (tail - head).length < 1e-5:
            bone.tail.z += 0.005
        bone.use_deform = True
    for name, (_, _, parent) in specs.items():
        if parent:
            arm.edit_bones[name].parent = arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.select_set(False)
    rig.show_in_front = True
    rig['source'] = 'Cyberjack character-factory calibrated joints + original phalanx channels'
    return rig, specs


def assign_body_weights(body, rig, old_rig, editor, bone_names):
    count = len(body.data.vertices)
    main_names = [b['name'] for b in editor['bones']]
    weights = np.frombuffer(base64.b64decode(editor['body']), dtype='<f4').reshape(count, len(main_names)).astype(np.float64)
    weights = np.pad(weights, ((0, 0), (0, len(bone_names) - len(main_names))))
    index = {name: i for i, name in enumerate(bone_names)}
    original = {g.name: g.index for g in body.vertex_groups}
    arrays = {name: np.zeros(count) for name in original}
    group_names = {g.index: g.name for g in body.vertex_groups}
    for v in body.data.vertices:
        for g in v.groups:
            arrays[group_names[g.group]][v.index] = g.weight
    for side, suffix in [('l', 'L'), ('r', 'R')]:
        families = {
            f'foot.{side}': [(name, [name]) for name in [f'foot.{side}', f'toes_01.{side}'] +
                             [f'{toe}{segment}.{suffix}' for toe in TOES for segment in ('', '_2')]],
            f'hand.{side}': [(f'hand.{side}', [f'hand.{side}'])] +
                            [(f'{finger}{number}.{side}',
                              ([f'{finger}1.{side}', f'c_{finger}1_base.{side}'] if number == 1 else
                               [f'c_{finger}{number}.{side}']))
                             for finger in FINGERS for number in (1, 2, 3)],
        }
        for main, family in families.items():
            total = weights[:, index[main]].copy()
            matrix = np.stack([sum((arrays.get(source, np.zeros(count)) for source in sources), np.zeros(count))
                               for _, sources in family], axis=1)
            sums = matrix.sum(axis=1)
            normalized = matrix / np.maximum(sums[:, None], 1e-12)
            weights[:, index[main]] = 0.0
            for j, (name, _) in enumerate(family):
                weights[:, index[name]] += total * normalized[:, j]
            fallback = sums < 1e-8
            weights[fallback, index[main]] = total[fallback]
    weights /= np.maximum(weights.sum(axis=1)[:, None], 1e-12)
    body.vertex_groups.clear()
    groups = {name: body.vertex_groups.new(name=name) for name in bone_names}
    nonzero = 0
    for i in range(count):
        for j in np.flatnonzero(weights[i] > 1e-5):
            groups[bone_names[j]].add([i], float(weights[i, j]), 'REPLACE')
            nonzero += 1
    for mod in body.modifiers:
        if mod.type == 'ARMATURE':
            mod.object = rig
    return {'weight_assignments': nonzero, 'min_sum': float(weights.sum(1).min()),
            'max_sum': float(weights.sum(1).max()), 'bones_with_weights': int((weights.sum(0) > 1e-6).sum())}


def clean_base():
    bpy.ops.wm.open_mainfile(filepath=str(BASE))
    old_rig = bpy.data.objects['rig_E']
    body = bpy.data.objects['Foot shape-original']
    hair = bpy.data.objects['Hair']
    old_rig.name = 'rig_E_legacy_source'
    body.parent = None
    body.matrix_world = Matrix.Identity(4)
    old_rig.matrix_world = Matrix.Identity(4)
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and obj.name in bpy.context.view_layer.objects:
            visible = obj in {body, hair}
            obj.hide_render = not visible
            obj.hide_set(not visible)
    for mod in body.modifiers:
        if mod.type in {'MASK', 'SOLIDIFY', 'NODES'}:
            mod.show_viewport = False
            mod.show_render = False
        elif mod.type == 'SUBSURF':
            mod.show_viewport = False
            mod.show_render = True
            mod.levels = mod.render_levels = 1
    if body.data.shape_keys:
        for key in body.data.shape_keys.key_blocks:
            key.value = 0.0
    skin = bpy.data.materials.new('Tickle · anime skin')
    skin.diffuse_color = (0.94, 0.82, 0.80, 1.0)
    skin.use_nodes = True
    bsdf = skin.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (0.94, 0.82, 0.80, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.58
    body.data.materials.clear()
    body.data.materials.append(skin)
    for poly in body.data.polygons:
        poly.material_index = 0
    editor = jsdata(ANATOMY)
    rig, specs = build_clean_rig(old_rig, body, editor)
    weight_report = assign_body_weights(body, rig, old_rig, editor, list(specs))
    # Волосы следуют голове; старая runtime-физика в этом прототипе не имитируется.
    hair.vertex_groups.clear()
    group = hair.vertex_groups.new(name='head')
    group.add(list(range(len(hair.data.vertices))), 1.0, 'REPLACE')
    for mod in hair.modifiers:
        if mod.type == 'ARMATURE':
            mod.object = rig
        elif mod.type in {'NODES', 'SUBSURF'}:
            mod.show_render = False
            mod.show_viewport = False
    bpy.data.objects.remove(old_rig, do_unlink=True)
    for obj in list(bpy.data.objects):
        if obj not in {body, hair, rig}:
            bpy.data.objects.remove(obj, do_unlink=True)
    return rig, body, weight_report


def evaluated_points(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    pts = [obj.matrix_world @ v.co.copy() for v in me.vertices]
    ev.to_mesh_clear()
    return pts


def import_head(rig):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(HEAD))
    imported = set(bpy.data.objects) - before
    meshes = [o for o in imported if o.type == 'MESH' and len(o.data.polygons) > 0]
    heads = [o for o in meshes if o.name != 'Anatomy body with complete neck' and not o.name.startswith('Icosphere')]
    source_arm = next(o for o in imported if o.type == 'ARMATURE')
    if 'leftEye' in source_arm.data.bones and 'leftEye' not in rig.data.bones:
        bpy.context.view_layer.objects.active = rig
        rig.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        for name in ('leftEye', 'rightEye'):
            source = source_arm.data.bones[name]
            bone = rig.data.edit_bones.new(name)
            bone.head = source_arm.matrix_world @ source.head_local
            bone.tail = source_arm.matrix_world @ source.tail_local
            bone.parent = rig.data.edit_bones['head']
            bone.use_deform = True
        bpy.ops.object.mode_set(mode='OBJECT')
        rig.select_set(False)
    report = {'objects': [], 'rest_max_delta_mm': 0.0}
    for obj in heads:
        baseline = evaluated_points(obj)
        obj.hide_render = False
        obj.hide_set(False)
        for mod in list(obj.modifiers):
            obj.modifiers.remove(mod)
        mod = obj.modifiers.new('Calibrated full body', 'ARMATURE')
        mod.object = rig
        bpy.context.view_layer.update()
        after = evaluated_points(obj)
        delta = max((a - b).length for a, b in zip(baseline, after)) if len(after) == len(baseline) else 999
        report['rest_max_delta_mm'] = max(report['rest_max_delta_mm'], 1000 * delta)
        report['objects'].append({'name': obj.name, 'vertices': len(obj.data.vertices),
                                  'shape_keys': len(obj.data.shape_keys.key_blocks) if obj.data.shape_keys else 0,
                                  'rest_delta_mm': round(1000 * delta, 8)})
    for obj in imported:
        if obj not in heads:
            bpy.data.objects.remove(obj, do_unlink=True)
    return heads, report


def mark_zones(body, rig):
    me = body.data
    bones = rig.data.bones
    ankle = rig.matrix_world @ bones['foot.l'].head_local
    ball = rig.matrix_world @ bones['toes_01.l'].head_local
    axis = (ball - ankle).normalized()
    medial = Vector((-1 if ankle.x > 0 else 1, 0, 0))
    ball_dist = (ball - ankle).length
    left_groups = {g.index for g in body.vertex_groups if g.name.lower().endswith('.l')}
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
    for name, typ in [('zone_id', 'INT'), ('sensitivity', 'FLOAT'), ('intertoe_side', 'INT')]:
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
            areas[zones[p.index]] += p.area * 1e4
    values = [v for v in sens if v > 0]
    return {'method': 'recomputed on calibrated full rest mesh', 'faces': len(zones),
            'marked_faces': len(values),
            'zones': {ZONE_NAMES[z]: {'faces': counts[z], 'area_cm2': round(areas[z], 2)} for z in counts},
            'sensitivity_minmax': [round(min(values, default=0), 4), round(max(values, default=0), 4)],
            'intertoe_faces': sum(bool(v) for v in inter)}


def add_breath_shape(body, rig):
    keys = body.data.shape_keys
    base = keys.key_blocks.get('Base') or keys.key_blocks[0]
    key = keys.key_blocks.get('Tickle_Breath') or body.shape_key_add(name='Tickle_Breath')
    chest = rig.matrix_world @ rig.data.bones['chest'].head_local
    inv = body.matrix_world.inverted().to_3x3()
    for i, vertex in enumerate(body.data.vertices):
        p = body.matrix_world @ vertex.co
        zmask = max(0.0, 1.0 - (abs(p.z - chest.z) / 0.12) ** 2)
        side_mask = max(0.0, 1.0 - (abs(p.x) / 0.22) ** 4)
        delta = Vector((p.x * 0.10, 0.65 if p.y < chest.y else -0.25, 0.0)).normalized() * (0.0018 * zmask * side_mask)
        key.data[i].co = base.data[i].co + inv @ delta
    key.slider_min = 0
    key.slider_max = 1
    key.value = 0


def point_camera(name, target, offset, ortho):
    data = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = Vector(target) + Vector(offset)
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    data.type = 'ORTHO'
    data.ortho_scale = ortho
    return obj


def setup_scene(rig, heads):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.studiolight_rotate_z = 0.35
    scene.display.shading.color_type = 'TEXTURE'
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = 'BOTH'
    scene.display.shading.background_type = 'WORLD'
    if scene.world is None:
        scene.world = bpy.data.worlds.new('Tickle World')
    scene.world.color = (0.16, 0.16, 0.18)
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.fps = 30
    scene.frame_start = 1
    scene.frame_end = 360
    control = bpy.data.objects.new('Tickle_Control', None)
    scene.collection.objects.link(control)
    control.empty_display_type = 'PLAIN_AXES'
    control.empty_display_size = 0.08
    control.hide_render = True
    for key in ['stimulus', 'delivered', 'perceived', 'adaptation', 'load', 'expectedness',
                'face', 'breath', 'voice', 'mouth', 'local', 'body', 'flinch']:
        control[key] = 0.0
        control.id_properties_ui(key).update(min=0.0, max=1.0)
    control['active_zone'] = ''
    control['character'] = 'rest'
    control['head_objects'] = json.dumps([o.name for o in heads])
    doc = glb_json(HEAD)
    control['vrm_expression_map'] = json.dumps(doc['extensions']['VRMC_vrm']['expressions'], ensure_ascii=False)
    control['evidence'] = 'Proelss et al. 2022 doi:10.1098/rstb.2021.0185; Kilteni 2025 doi:10.1126/sciadv.adt0350'
    full = point_camera('Camera_Full', (0, 0, 0.88), (0, -3.1, 0.12), 1.90)
    point_camera('Camera_Face', (0, -0.01, 1.47), (0.12, -0.72, 0.035), 0.29)
    foot = rig.matrix_world @ rig.data.bones['foot.l'].head_local
    point_camera('Camera_Feet', foot + Vector((0, -0.025, -0.025)), (0.20, -0.52, 0.16), 0.36)
    point_camera('Camera_Sole', foot + Vector((0, -0.04, 0.0)), (0.12, -0.20, -0.45), 0.36)
    point_camera('Camera_Side', (0, 0, 0.88), (2.8, 0, 0.08), 1.88)
    scene.camera = full
    return control


def render_previews():
    scene = bpy.context.scene
    for name, label, x, y in [('Camera_Full', 'full', 800, 1000), ('Camera_Face', 'face', 800, 800),
                              ('Camera_Feet', 'feet', 900, 700), ('Camera_Sole', 'sole', 900, 700),
                              ('Camera_Side', 'side', 800, 1000)]:
        scene.camera = bpy.data.objects[name]
        scene.render.resolution_x = x
        scene.render.resolution_y = y
        scene.render.filepath = str(PREVIEW / f'build_{label}.png')
        bpy.ops.render.render(write_still=True)
    scene.camera = bpy.data.objects['Camera_Full']


def main():
    rig, body, weights = clean_base()
    zones = mark_zones(body, rig)
    heads, head_report = import_head(rig)
    add_breath_shape(body, rig)
    control = setup_scene(rig, heads)
    report = {'base': str(BASE), 'head': str(HEAD), 'anatomy': str(ANATOMY),
              'rig_bones': len(rig.data.bones), 'rig_deform_bones': sum(b.use_deform for b in rig.data.bones),
              'body_vertices': len(body.data.vertices), 'body_shape_keys': len(body.data.shape_keys.key_blocks),
              'weights': weights, 'head_objects': head_report, 'zones': zones, 'control': control.name}
    (REPORTS / 'build.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('FULLBODY_BUILD=' + json.dumps(report, ensure_ascii=False), flush=True)
    render_previews()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT), check_existing=False, compress=False)
    print('FULLBODY_SAVED=' + str(OUT), flush=True)


main()
