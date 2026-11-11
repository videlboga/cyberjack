"""Предполётная проверка модульной библиотеки машин.

Сохранение сцены выполняется ДО вызова. Все пересечения печатаются; разрешённых
пар по умолчанию нет. Кинематика проверяется на крайних положениях генераторов.
Глубина проникновения и реальная безопасность механизма остаются UNTESTED.
"""
import itertools
import json
import math
import os

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from machine_modules import ASSEMBLY_DEFS, MODULE_DEFS, build_module, subframe


def bounds(objects):
    points = [obj.matrix_world @ v.co for obj in objects if obj.type == 'MESH'
              for v in obj.data.vertices]
    if not points:
        return None
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    return {'min': lo, 'max': hi, 'size': [hi[i] - lo[i] for i in range(3)]}


def bvh(obj):
    obj.data.calc_loop_triangles()
    verts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    faces = [tuple(t.vertices) for t in obj.data.loop_triangles]
    return BVHTree.FromPolygons(verts, faces)


def overlap_report(objects, allow_named_joints=False):
    """Возвращает неразрешённые и явно названные стыки; по умолчанию исключений нет."""
    trees = {obj.name: bvh(obj) for obj in objects if obj.type == 'MESH'}
    hits = []
    allowed = []
    for a, b in itertools.combinations(objects, 2):
        if a.type != 'MESH' or b.type != 'MESH':
            continue
        overlaps = trees[a.name].overlap(trees[b.name])
        if not overlaps:
            continue
        keys_a = set(json.loads(a.get('joint_keys', '[]')))
        keys_b = set(json.loads(b.get('joint_keys', '[]')))
        shared = sorted(keys_a & keys_b)
        record = {'a': a.name, 'b': b.name, 'trianglePairs': len(overlaps)}
        if shared and allow_named_joints:
            record['jointKey'] = shared[0]
            allowed.append(record)
        else:
            hits.append(record)
    return hits, allowed


def delete_objects(objects):
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)


def travel_checks(F):
    results = []
    for slide in (-0.22, 0.0, 0.22):
        objects = build_module('motion_linear', F, slide=slide)
        objects += build_module('work_probe', F, slide=slide, stroke=0.5)
        cover = next(o for o in objects if o.name.endswith('drive_cover'))
        center_x = sum((cover.matrix_world @ v.co).x for v in cover.data.vertices) / len(cover.data.vertices)
        results.append({'drive': 'X', 'requested': slide, 'measured': center_x,
                        'pass': abs(center_x - slide) < 1e-5})
        delete_objects(objects)
    for lift in (-0.12, 0.0, 0.12):
        objects = build_module('motion_lift', F, lift=lift)
        objects += build_module('work_rotary', F, lift=lift)
        cover = next(o for o in objects if o.name.endswith('drive_cover'))
        center_z = sum((cover.matrix_world @ v.co).z for v in cover.data.vertices) / len(cover.data.vertices)
        expected = 1.15 + lift
        results.append({'drive': 'Z', 'requested': expected, 'measured': center_z,
                        'pass': abs(center_z - expected) < 1e-5})
        delete_objects(objects)
    for module_id, key, bad in (('motion_linear', 'slide', 0.23),
                                ('motion_lift', 'lift', 0.13),
                                ('support_cradle', 'height', 1.0),
                                ('work_probe', 'stroke', 1.1)):
        try:
            build_module(module_id, F, **{key: bad})
            results.append({'limit': module_id, 'pass': False, 'error': 'limit accepted'})
        except ValueError:
            results.append({'limit': module_id, 'pass': True})
    return results


def run_preflight(F, report_path):
    report = {
        'format': 'cyberjack-machine-preflight-v1',
        'allowedIntersectionPairs': [],
        'penetrationDepth': 'UNTESTED: BVH reports overlap, not depth; FCL query not run',
        'safetyCertification': 'UNTESTED: visual concept only',
        'modules': [], 'assemblies': [], 'kinematics': [],
    }
    for module_id, info in MODULE_DEFS.items():
        coll = bpy.data.collections.get('MOD_' + module_id)
        errors = []
        if not coll:
            errors.append('missing collection')
            objects = []
        else:
            objects = list(coll.all_objects)
            if not objects:
                errors.append('empty module')
            if coll.asset_data is None:
                errors.append('collection is not an asset')
        report['modules'].append({'id': module_id, 'objects': len(objects), 'errors': errors,
                                  'pass': not errors})
    for asset_id, info in ASSEMBLY_DEFS.items():
        coll = bpy.data.collections.get('ASM_' + asset_id)
        objects = list(coll.all_objects) if coll else []
        errors = []
        actual = {o.get('machine_module') for o in objects}
        missing = sorted(set(info['modules']) - actual)
        unexpected = sorted(actual - set(info['modules']))
        if missing:
            errors.append('missing modules: ' + ','.join(missing))
        if unexpected:
            errors.append('unexpected modules: ' + ','.join(unexpected))
        untagged = [o.name for o in objects if not o.get('machine_module')]
        if untagged:
            errors.append(f'untagged objects: {len(untagged)}')
        unmaterialed = [o.name for o in objects if o.type == 'MESH' and not o.data.materials]
        if unmaterialed:
            errors.append(f'no material: {len(unmaterialed)}')
        bb = bounds(objects)
        if not bb:
            errors.append('empty geometry')
        elif abs(bb['min'][2]) > 1e-5:
            errors.append(f"ground contact mismatch: {bb['min'][2]}")
        elif bb['size'][0] > 2.4 or bb['size'][1] > 2.0 or bb['size'][2] > 2.1:
            errors.append('outside concept envelope 2.4x2.0x2.1 m')
        joint_members = {}
        for obj in objects:
            for key in json.loads(obj.get('joint_keys', '[]')):
                joint_members.setdefault(key, set()).add(obj.name)
        malformed_joints = {key: sorted(names) for key, names in joint_members.items() if len(names) != 2}
        if malformed_joints:
            errors.append(f'joint keys not exactly two objects: {len(malformed_joints)}')
        overlaps, allowed = overlap_report(objects, allow_named_joints=True)
        if overlaps:
            errors.append(f'unreviewed intersections: {len(overlaps)}')
        report['allowedIntersectionPairs'].extend({'assembly': asset_id, **pair} for pair in allowed)
        report['assemblies'].append({
            'id': asset_id, 'objects': len(objects), 'bounds': bb,
            'triangles': sum(len(o.data.loop_triangles) for o in objects if o.type == 'MESH'),
            'intersections': overlaps, 'allowedContacts': allowed,
            'malformedJoints': malformed_joints, 'errors': errors, 'pass': not errors,
        })
    report['kinematics'] = travel_checks(F)
    failed_kinematics = [r for r in report['kinematics'] if not r.get('pass')]
    report['summary'] = {
        'modulesPassed': sum(r['pass'] for r in report['modules']),
        'modulesTotal': len(report['modules']),
        'assembliesPassed': sum(r['pass'] for r in report['assemblies']),
        'assembliesTotal': len(report['assemblies']),
        'kinematicsPassed': len(report['kinematics']) - len(failed_kinematics),
        'kinematicsTotal': len(report['kinematics']),
    }
    report['pass'] = (not failed_kinematics and all(r['pass'] for r in report['modules'])
                      and all(r['pass'] for r in report['assemblies']))
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print('PREFLIGHT', json.dumps(report['summary']), 'PASS' if report['pass'] else 'FAIL', flush=True)
    for assembly in report['assemblies']:
        print('ASSEMBLY', assembly['id'], 'objects', assembly['objects'],
              'intersections', len(assembly['intersections']),
              'allowedContacts', len(assembly['allowedContacts']),
              'errors', assembly['errors'], flush=True)
    return report
