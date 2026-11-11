"""Сборка и экспорт библиотеки модульных машин Cyberjack.

Запуск из корня проекта:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_machine_modules.py

Выход:
  public/models/machine-modules/{modules,assemblies}/*.glb
  public/models/machine-modules/machine_modules.blend
  public/models/machine-modules/catalog.json
  docs/plans/blockout/machine-modules/{preflight.json,*.png}
"""
from pathlib import Path
import copy
import hashlib
import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
sys.path.insert(0, str(HERE))

from ink_lib import Ink, INK_P, INK_ROLES  # noqa: E402
from ink_kit import Kit, Frame  # noqa: E402
from machine_modules import (  # noqa: E402
    ASSEMBLY_DEFS, MODULE_DEFS, build_machine, build_module,
)
from preflight_machine_modules import run_preflight  # noqa: E402

OUT = PROJECT / 'public/models/machine-modules'
REVIEW = PROJECT / 'docs/plans/blockout/machine-modules'
for directory in (OUT / 'modules', OUT / 'assemblies', REVIEW):
    directory.mkdir(parents=True, exist_ok=True)


def palette_ink():
    palette = copy.deepcopy(INK_P)
    palette.update({
        'wall': (0.945, 0.937, 0.918),       # BODY_MILK #F1EFEA
        'wall_c': (0.980, 0.973, 0.957),     # BODY_IVORY #FAF8F4
        'floor': (0.935, 0.940, 0.945),
        'metal': (0.725, 0.729, 0.718),      # STRUCT_SILVER #B9BAB7
        'metal_d': (0.330, 0.341, 0.353),    # STRUCT_DARK #54575A
        'dark': (0.204, 0.212, 0.231),       # INTERFACE #34363B
        'mid': (0.50, 0.52, 0.54),
        'soft': (0.949, 0.843, 0.851),       # WORK_PALE #F2D7D9
        'work_pale': (0.949, 0.843, 0.851),
        'pink': (0.910, 0.725, 0.749),       # WORK_BLUSH #E8B9BF
        'screen': (0.894, 0.957, 0.961),     # STATUS #E4F4F5
        'cyan': (0.75, 0.90, 0.92),
        'safety_red': (0.72, 0.07, 0.06),
        'safety_yellow': (0.96, 0.72, 0.08),
    })
    roles = copy.deepcopy(INK_ROLES)
    roles.update({
        'work_pale': ('work_pale', 0.0, 0.0),
        'safety_red': ('safety_red', 0.0, 0.0),
        'safety_yellow': ('safety_yellow', 0.0, 0.0),
    })
    ink = Ink(palette=palette, roles=roles, shadow=0.88, ink_color=(0.24, 0.26, 0.30))
    ink.build()
    for role, mat in ink.M.items():
        key = roles[role][0]
        mat.diffuse_color = (*palette[key], 1.0)
        mat['palette_role'] = role
    return ink


def pbr_material(source, cache):
    if source.name in cache:
        return cache[source.name]
    role = source.get('palette_role', source.name.removeprefix('ink_'))
    mat = bpy.data.materials.new(source.name + '_gltf')
    mat.use_nodes = True
    mat.diffuse_color = source.diffuse_color
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = source.diffuse_color
    bsdf.inputs['Roughness'].default_value = 0.68
    bsdf.inputs['Metallic'].default_value = 0.18 if role in ('metal', 'metal_d') else 0.0
    if role in ('screen', 'cyan'):
        bsdf.inputs['Emission Color'].default_value = source.diffuse_color
        bsdf.inputs['Emission Strength'].default_value = 0.35
    cache[source.name] = mat
    return mat


def export_glb(objects, path, ink):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    replacements = []
    cache = {}
    for obj in objects:
        if obj.type != 'MESH':
            continue
        for i, slot in enumerate(obj.material_slots):
            if slot.material:
                replacements.append((obj.data, i, slot.material))
                slot.material = pbr_material(slot.material, cache)
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_extras=True,
        export_cameras=False, export_lights=False,
    )
    for mesh, index, original in replacements:
        mesh.materials[index] = original
    if not path.is_file() or path.stat().st_size < 1000:
        raise RuntimeError(f'GLB export failed: {path}')
    print('EXPORTED', path.name, path.stat().st_size, flush=True)


def label(text, at, ink, size=0.12):
    curve = bpy.data.curves.new('label_' + text, 'FONT')
    curve.body = text
    curve.size = size
    curve.align_x = 'CENTER'
    obj = bpy.data.objects.new('label_' + text, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = at
    curve.materials.append(ink.M['dark'])
    return obj


def register_collection(name, objects, description, at, export_path, ink, module_ids):
    scene = bpy.context.scene
    coll = bpy.data.collections.new(name)
    scene.collection.children.link(coll)
    for obj in objects:
        for old in list(obj.users_collection):
            old.objects.unlink(obj)
        coll.objects.link(obj)
    coll.asset_mark()
    coll.asset_data.description = description
    coll.asset_data.author = 'Cyberjack'
    for tag in ('machine', 'concept', *module_ids):
        coll.asset_data.tags.new(tag)
    export_glb(objects, export_path, ink)
    scene.collection.children.unlink(coll)
    inst = bpy.data.objects.new('VIEW_' + name, None)
    inst.instance_type = 'COLLECTION'
    inst.instance_collection = coll
    inst.location = at
    scene.collection.objects.link(inst)
    return coll, inst


def camera():
    data = bpy.data.cameras.new('review_camera')
    data.type = 'ORTHO'
    obj = bpy.data.objects.new('review_camera', data)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.scene.camera = obj
    return obj


def aim(cam, target, direction, scale):
    target = Vector(target)
    cam.location = target + Vector(direction).normalized() * (scale * 2.8 + 1.0)
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.ortho_scale = scale


def render(name):
    scene = bpy.context.scene
    scene.render.filepath = str(REVIEW / name)
    bpy.ops.render.render(write_still=True)
    print('RENDERED', name, flush=True)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    ink = palette_ink()
    kit = Kit(ink, scene)
    root = Frame(kit, 0, 0)
    module_instances = []
    assembly_instances = []
    catalog = {
        'format': 'cyberjack-machine-modules-v1',
        'units': 'metres', 'upAxis': 'Y (GLB); Z (Blender)',
        'status': 'visual-mechanical concept; not safety or manufacturing certified',
        'reference_policy': 'actual GLB/SKP geometry under public/models only; no bitmap references',
        'palette': {
            'BODY_MILK': '#F1EFEA', 'BODY_IVORY': '#FAF8F4',
            'WORK_BLUSH': '#E8B9BF', 'WORK_PALE': '#F2D7D9',
            'STRUCT_SILVER': '#B9BAB7', 'STRUCT_DARK': '#54575A',
            'INTERFACE': '#34363B', 'STATUS': '#E4F4F5',
        },
        'modules': [], 'assemblies': [],
    }

    for i, (module_id, info) in enumerate(MODULE_DEFS.items()):
        F = Frame(kit, 0, 0, prefix=module_id + '__')
        objects = build_module(module_id, F)
        at = ((i % 5 - 2) * 1.75, (i // 5) * 2.15, 0)
        coll, inst = register_collection(
            'MOD_' + module_id, objects, info['purpose'], at,
            OUT / 'modules' / f'{module_id}.glb', ink, [module_id],
        )
        module_instances.append(inst)
        label(module_id, (at[0], at[1] - 0.87, 0.015), ink, 0.105)
        catalog['modules'].append({'id': module_id, **info, 'file': f'modules/{module_id}.glb'})

    for i, (asset_id, info) in enumerate(ASSEMBLY_DEFS.items()):
        F = Frame(kit, 0, 0, prefix=asset_id + '__')
        objects = build_machine(asset_id, F)
        at = ((i % 2 - 0.5) * 3.2, 6.0 + (i // 2) * 3.0, 0)
        coll, inst = register_collection(
            'ASM_' + asset_id, objects, info['function'], at,
            OUT / 'assemblies' / f'{asset_id}.glb', ink, info['modules'],
        )
        assembly_instances.append(inst)
        label(f'M-{i + 1:02d}', (at[0], at[1] - 1.05, 0.015), ink, 0.17)
        catalog['assemblies'].append({
            'id': asset_id, **info, 'file': f'assemblies/{asset_id}.glb',
            'blendCollection': coll.name,
        })

    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 4.2, -0.006))
    floor = bpy.context.object
    floor.name = 'PRESENTATION_FLOOR'
    ink.apply(floor, 'floor')
    ink.lights(scene)
    ink.render_setup(scene, res=(1800, 1100), samples=16, exposure=-0.08, bloom=(1.8, 3))
    ink.ink(scene, thickness=1.1, crease=True, angle=150)
    cam = camera()

    blend_path = OUT / 'machine_modules.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    print('SAVED', blend_path, 'mtime', blend_path.stat().st_mtime, flush=True)

    preflight_path = REVIEW / 'preflight.json'
    preflight = run_preflight(root, preflight_path)

    # Общий каталог модулей и четырёх сборок.
    for inst in assembly_instances:
        inst.hide_render = True
    for obj in scene.objects:
        if obj.type == 'FONT' and obj.data.body.startswith('M-'):
            obj.hide_render = True
    aim(cam, (0, 1.0, 0.55), (1.2, -2.0, 1.35), 10.5)
    render('modules_atlas.png')
    for inst in assembly_instances:
        inst.hide_render = False
    for obj in scene.objects:
        if obj.type == 'FONT':
            obj.hide_render = False
    for inst in module_instances:
        inst.hide_render = True
    aim(cam, (0, 7.5, 0.75), (1.3, -2.1, 1.35), 8.2)
    render('assemblies_atlas.png')

    # Четыре свежих ракурса каждой сборки, без персонажей и внешних референсов.
    for obj in scene.objects:
        if obj.type == 'FONT':
            obj.hide_render = True
    for i, (asset_id, info) in enumerate(ASSEMBLY_DEFS.items()):
        for other in assembly_instances:
            other.hide_render = other != assembly_instances[i]
        at = assembly_instances[i].location.copy()
        views = (
            ('front3q', (1.2, -1.8, 1.0), 2.65, 0.85),
            ('front', (0.0, -2.2, 0.20), 2.35, 0.88),
            ('side', (2.2, 0.0, 0.65), 2.35, 0.88),
            ('work_closeup', (0.75, -1.9, 0.65), 1.45, 1.12),
        )
        for view, direction, scale, height in views:
            if view == 'work_closeup' and asset_id == 'lab_sex_machine_tickling':
                height = 0.76
            aim(cam, at + Vector((0, 0, height)), direction, scale)
            render(f'{asset_id}_{view}.png')
        assembly_instances[i].hide_render = False

    (OUT / 'catalog.json').write_text(json.dumps(catalog, indent=2, ensure_ascii=False))
    hashes = {str(path.relative_to(OUT)): sha(path)
              for path in sorted(OUT.rglob('*.glb'))}
    (REVIEW / 'asset-hashes.json').write_text(json.dumps(hashes, indent=2))
    print('DONE', json.dumps(preflight['summary']), 'PASS', preflight['pass'], flush=True)
    if not preflight['pass']:
        raise RuntimeError('Preflight failed; inspect preflight.json')


if __name__ == '__main__':
    main()
