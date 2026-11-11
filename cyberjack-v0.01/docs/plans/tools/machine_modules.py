"""Модульные машины Cyberjack: геометрия, функциональные роли и сборки движка.

Все размеры в метрах. Модули строятся на существующем `ink_kit.Frame`; каждая
деталь получает `machine_module` и `module_class`. Розовый назначается только
WORK, молочный — корпусам, графит — направляющим и точкам управления.

Это визуально-механический концепт-кит, не сертифицированная конструкция.
"""
from contextlib import contextmanager
import json
import math

import bpy
from mathutils import Vector


MODULE_DEFS = {
    'structure_base': {
        'class': 'STRUCTURE', 'purpose': 'Нагруженная станина с четырьмя опорами.',
        'connects_to': ['structure_portal', 'motion_linear', 'motion_lift', 'support_cradle'],
        'motion': 'stationary', 'limits': 'floor contact z=0', 'access': 'open underside',
        'visible_evidence': 'four feet; continuous deck', 'material_role': 'BODY_MILK',
        'status': 'specified', 'source_models': ['073', '079', '087'],
    },
    'structure_portal': {
        'class': 'STRUCTURE', 'purpose': 'Открытая двухстоечная рама рабочего узла.',
        'connects_to': ['structure_base', 'motion_lift'], 'motion': 'stationary',
        'limits': 'fixed crossbeam', 'access': 'front and rear open',
        'visible_evidence': 'two columns; top beam', 'material_role': 'BODY_MILK',
        'status': 'specified', 'source_models': ['078', '095'],
    },
    'motion_linear': {
        'class': 'MOTION', 'purpose': 'Двухрельсовая горизонтальная каретка.',
        'connects_to': ['structure_portal', 'work_probe'], 'motion': 'X translation',
        'limits': '±0.22 m; physical end stops', 'access': 'rails exposed',
        'visible_evidence': 'two rails; split carriage; four end blocks', 'material_role': 'STRUCT_SILVER',
        'status': 'specified', 'source_models': ['078', '084', '095', '098'],
    },
    'motion_lift': {
        'class': 'MOTION', 'purpose': 'Вертикальная регулировка рабочей плоскости.',
        'connects_to': ['structure_portal', 'motion_linear', 'work_rotary', 'work_brush_pair'],
        'motion': 'Z translation', 'limits': '±0.12 m; end brackets', 'access': 'front service',
        'visible_evidence': 'twin vertical guides; split carriage', 'material_role': 'STRUCT_SILVER',
        'status': 'specified', 'source_models': ['073', '080', '087'],
    },
    'work_probe': {
        'class': 'WORK', 'purpose': 'Сменный линейный контактный узел с быстросъёмной муфтой.',
        'connects_to': ['motion_linear'], 'motion': 'Y stroke; follows X carriage',
        'limits': '0.12 m nominal visual stroke', 'access': 'front quick release',
        'visible_evidence': 'pink drive cover; metal coupler; rounded contact tip',
        'material_role': 'WORK_BLUSH', 'status': 'specified', 'source_models': ['073', '079', '089', '090'],
    },
    'work_rotary': {
        'class': 'WORK', 'purpose': 'Мягкий ротационный контур с открытой рамкой ограждения.',
        'connects_to': ['motion_lift'], 'motion': 'Y-axis rotation', 'limits': 'continuous; fixed guard',
        'access': 'open front; side service', 'visible_evidence': 'pink drive; pale torus; fixed guard frame',
        'material_role': 'WORK_BLUSH', 'status': 'specified', 'source_models': ['065', '080', '084', '096'],
    },
    'work_brush_pair': {
        'class': 'WORK', 'purpose': 'Два независимо читаемых щёточных контактных узла.',
        'connects_to': ['motion_lift'], 'motion': 'two Y-axis rotors', 'limits': 'continuous; fixed carrier',
        'access': 'front brush replacement', 'visible_evidence': 'two pink motors; radial pale bristles',
        'material_role': 'WORK_BLUSH', 'status': 'specified', 'source_models': ['073', '087', '089'],
    },
    'support_cradle': {
        'class': 'SERVICE', 'purpose': 'Пара регулируемых опор с мягкими съёмными ложементами.',
        'connects_to': ['structure_base'], 'motion': 'Z setup adjustment',
        'limits': '0.48–0.96 m nominal mounting range', 'access': 'front loading; open clamps',
        'visible_evidence': 'two grounded posts; pads; clamp rings', 'material_role': 'WORK_PALE',
        'status': 'specified', 'source_models': ['073', '081', '087', '089'],
    },
    'interface_console': {
        'class': 'INTERFACE', 'purpose': 'Локальный пульт с экраном и физическим стопом.',
        'connects_to': ['utility_routing'], 'motion': 'stationary', 'limits': 'operator side -Y',
        'access': 'front operation; rear service', 'visible_evidence': 'screen; status line; red/yellow stop',
        'material_role': 'BODY_IVORY', 'status': 'specified', 'source_models': ['069', '073', '080', '096'],
    },
    'utility_routing': {
        'class': 'UTILITY', 'purpose': 'Защищённый кабельный контур пульт–станина–привод.',
        'connects_to': ['interface_console', 'motion_linear', 'motion_lift'], 'motion': 'fixed service loop',
        'limits': 'conceptual routing only', 'access': 'rear trunk; visible connectors',
        'visible_evidence': 'rear trunk; two cable runs; connector blocks', 'material_role': 'STRUCT_DARK',
        'status': 'assumed', 'source_models': ['073', '079', '096'],
    },
}


ASSEMBLY_DEFS = {
    'lab_sex_machine_vaginal': {
        'title': 'M-01 · линейный модуль',
        'function': 'Загрузка на опоры → настройка высоты и положения → линейный контакт → выключение и снятие.',
        'modules': ['structure_base', 'structure_portal', 'motion_lift', 'motion_linear',
                    'work_probe', 'support_cradle', 'interface_console', 'utility_routing'],
        'source_models': ['073', '078', '079', '089', '095'],
        'hazards': 'moving carriage and contact tip; loading is stopped-state only; safety review required',
    },
    'lab_sex_machine_anal': {
        'title': 'M-02 · низкий линейный модуль',
        'function': 'Настройка опор → установка каретки → линейный контакт → стоп и сервисный доступ.',
        'modules': ['structure_base', 'motion_linear', 'work_probe', 'support_cradle',
                    'interface_console', 'utility_routing'],
        'source_models': ['078', '084', '098'],
        'hazards': 'moving carriage; exposed rail pinch points are conceptually stopped before access',
    },
    'lab_sex_machine_tickling': {
        'title': 'M-03 · двойной щёточный модуль',
        'function': 'Установка стоп на опоры → регулировка высоты → два вращающихся контакта → стоп и снятие.',
        'modules': ['structure_base', 'structure_portal', 'motion_lift', 'work_brush_pair',
                    'support_cradle', 'interface_console', 'utility_routing'],
        'source_models': ['073', '087', '089'],
        'hazards': 'rotating brushes and adjustment pinch points; guards/interlocks not engineered',
    },
    'lab_sex_machine_circularsaw': {
        'title': 'M-04 · мягкий ротационный модуль',
        'function': 'Загрузка на опоры → настройка высоты → вращение мягкого контура → стоп и открытие зоны.',
        'modules': ['structure_base', 'structure_portal', 'motion_lift', 'work_rotary',
                    'support_cradle', 'interface_console', 'utility_routing'],
        'source_models': ['065', '080', '084', '096'],
        'hazards': 'rotary contact and fixed guard; no metal saw teeth; guarding requires later safety review',
    },
}


def subframe(F, u=0.0, v=0.0, suffix=''):
    """Дочерняя рамка с тем же yaw; префикс сохраняет уникальность деталей."""
    from ink_kit import Frame
    x, y = F._w(u, v)
    return Frame(F.K, x, y, F.yaw, prefix=F.prefix + suffix)


def _finish(F, before, module_id):
    info = MODULE_DEFS[module_id]
    objects = [o for o in bpy.data.objects if o not in before]
    for obj in objects:
        obj['machine_module'] = module_id
        obj['module_class'] = info['class']
        obj['concept_status'] = info['status']
    return objects


@contextmanager
def _building(F, module_id):
    before = set(bpy.data.objects)
    yield
    _finish(F, before, module_id)


def _world(F, p):
    x, y = F._w(p[0], p[1])
    return Vector((x, y, p[2]))


def joint(F, key, a, b):
    """Явно декларирует ровно один intended contact между двумя объектами."""
    if a is None or b is None or a == b:
        raise ValueError(f'Invalid joint {key}: {a}, {b}')
    full_key = F.prefix + key
    for obj in (a, b):
        keys = set(json.loads(obj.get('joint_keys', '[]')))
        keys.add(full_key)
        obj['joint_keys'] = json.dumps(sorted(keys))


def joint_named(F, key, name_a, name_b):
    joint(F, key, bpy.data.objects.get(F._n(name_a)), bpy.data.objects.get(F._n(name_b)))


def rod(F, name, a, b, radius=0.018, role='metal_d', vertices=20):
    """Цилиндр между локальными точками; в отличие от Kit.cyl ось не меняет z."""
    pa, pb = _world(F, a), _world(F, b)
    delta = pb - pa
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=delta.length,
                                       location=(pa + pb) * 0.5)
    obj = bpy.context.object
    obj.name = F._n(name)
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    F.K.I.apply(obj, role)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def torus(F, name, center, major=0.12, minor=0.02, role='soft', normal=(0, -1, 0)):
    c = _world(F, center)
    n_local = Vector(normal).normalized()
    a = math.radians(F.yaw)
    n_world = Vector((n_local.x * math.cos(a) - n_local.y * math.sin(a),
                      n_local.x * math.sin(a) + n_local.y * math.cos(a), n_local.z))
    bpy.ops.mesh.primitive_torus_add(major_segments=40, minor_segments=10,
                                    location=c, major_radius=major, minor_radius=minor)
    obj = bpy.context.object
    obj.name = F._n(name)
    obj.rotation_euler = Vector((0, 0, 1)).rotation_difference(n_world).to_euler()
    F.K.I.apply(obj, role)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def structure_base(F):
    with _building(F, 'structure_base'):
        for ix, u in enumerate((-0.52, 0.52)):
            for iy, v in enumerate((-0.32, 0.32)):
                F.rbox(f'foot_{ix}_{iy}', u - 0.09, u + 0.09, v - 0.09, v + 0.09,
                       0.0, 0.12, 'dark', r=0.025)
        F.rbox('deck', -0.64, 0.64, -0.42, 0.42, 0.12, 0.24, 'wall', r=0.045, segs=4)
        F.rbox('service_recess', -0.28, 0.28, -0.425, -0.421, 0.15, 0.21,
               'metal_d', r=0.008)


def structure_portal(F):
    with _building(F, 'structure_portal'):
        for side, u in (('L', -0.55), ('R', 0.55)):
            column = F.rbox(f'column_{side}', u - 0.05, u + 0.05, 0.16, 0.30,
                            0.24, 1.55, 'wall', r=0.025)
            guide = F.rbox(f'column_guide_{side}', u - 0.025, u + 0.025, 0.145, 0.16,
                           0.40, 1.42, 'metal_d', r=0.006)
            joint(F, f'column_guide_mount_{side}', column, guide)
        F.rbox('crossbeam', -0.60, 0.60, 0.16, 0.30, 1.55, 1.67,
               'wall', r=0.03)


def motion_lift(F, lift=0.0):
    if not -0.12 <= lift <= 0.12:
        raise ValueError('motion_lift outside ±0.12 m')
    z = 1.15 + lift
    with _building(F, 'motion_lift'):
        for side, u in (('L', -0.055), ('R', 0.055)):
            guide = rod(F, f'guide_{side}', (u, 0.18, 0.32), (u, 0.18, 1.55), 0.016, 'metal')
            for end, zz in (('low', 0.32), ('high', 1.55)):
                bracket = F.rbox(f'end_{side}_{end}', u - 0.03, u + 0.03, 0.15, 0.21,
                                 zz - 0.025, zz + 0.025, 'metal_d', r=0.006)
                joint(F, f'guide_socket_{side}_{end}', guide, bracket)
        # Две боковые щёки и перемычка: направляющие не «запечены» в сплошной блок.
        cheeks = []
        for side, u in (('L', -0.105), ('R', 0.105)):
            cheeks.append(F.rbox(f'carriage_cheek_{side}', u - 0.025, u + 0.025, 0.145, 0.20,
                                 z - 0.11, z + 0.11, 'metal_d', r=0.008))
        bridge = F.rbox('carriage_bridge', -0.08, 0.08, 0.12, 0.145,
                        z - 0.11, z + 0.11, 'metal', r=0.008)
        for side, cheek in zip(('L', 'R'), cheeks):
            joint(F, f'lift_carriage_joint_{side}', bridge, cheek)


def motion_linear(F, slide=0.0, z=1.15):
    if not -0.22 <= slide <= 0.22:
        raise ValueError('motion_linear outside ±0.22 m')
    with _building(F, 'motion_linear'):
        rails = {}
        for side, v in (('F', -0.055), ('B', 0.055)):
            rails[side] = rod(F, f'rail_{side}', (-0.52, v, z), (0.52, v, z), 0.018, 'metal')
        for side, u in (('L', -0.57), ('R', 0.57)):
            end = F.rbox(f'end_{side}', u - 0.05, u + 0.05, -0.12, 0.12,
                         z - 0.11, z + 0.11, 'wall', r=0.016)
            for rail_side, rail in rails.items():
                joint(F, f'rail_socket_{side}_{rail_side}', end, rail)
            post = F.rbox(f'mount_post_{side}', u - 0.035, u + 0.035, -0.06, 0.06,
                          0.24, z - 0.11, 'wall', r=0.012)
            joint(F, f'linear_end_post_{side}', end, post)
        for side, u in (('L', -0.43), ('R', 0.43)):
            # Упор стоит за рельсами и встречает заднюю щёку, а не пронизывает направляющую.
            F.rbox(f'stop_{side}', u - 0.015, u + 0.015, 0.145, 0.17,
                   z - 0.08, z + 0.08, 'metal_d', r=0.004)
        F.rbox('carriage_bottom', slide - 0.13, slide + 0.13, -0.12, 0.12,
               z - 0.13, z - 0.10, 'metal_d', r=0.006)
        F.rbox('carriage_top', slide - 0.13, slide + 0.13, -0.12, 0.12,
               z + 0.10, z + 0.13, 'metal_d', r=0.006)
        for side, v in (('F', -0.125), ('B', 0.125)):
            F.rbox(f'carriage_cheek_{side}', slide - 0.13, slide + 0.13,
                   v - 0.012, v + 0.012, z - 0.10, z + 0.10, 'metal_d', r=0.005)


def work_probe(F, slide=0.0, z=1.15, stroke=0.0):
    if not 0.0 <= stroke <= 1.0:
        raise ValueError('work_probe stroke outside 0..1')
    with _building(F, 'work_probe'):
        cover = F.rbox('drive_cover', slide - 0.11, slide + 0.11, -0.38, -0.14,
                       z - 0.10, z + 0.10, 'pink', r=0.035, segs=4)
        mount = F.rbox('carriage_mount', slide - 0.08, slide + 0.08, -0.15, -0.11,
                       z - 0.06, z + 0.06, 'metal_d', r=0.008)
        joint(F, 'probe_carriage_mount', cover, mount)
        F.rbox('service_seam', slide - 0.08, slide + 0.08, -0.30, -0.20,
               z + 0.101, z + 0.103, 'work_pale', r=0.002)
        coupler = rod(F, 'quick_release', (slide, -0.38, z), (slide, -0.45, z), 0.048, 'metal_d')
        end = -0.60 - 0.12 * stroke
        shaft = rod(F, 'output_shaft', (slide, -0.45, z), (slide, end + 0.02, z), 0.022, 'metal')
        tip = F.sphere('contact_tip', slide, end - 0.025, z, 0.045, 'work_pale', segs=24)
        joint(F, 'cover_coupler_socket', cover, coupler)
        joint(F, 'coupler_shaft_socket', coupler, shaft)
        joint(F, 'shaft_tip_socket', shaft, tip)


def work_rotary(F, lift=0.0):
    z = 1.15 + lift
    with _building(F, 'work_rotary'):
        cover = F.rbox('drive_cover', -0.16, 0.16, -0.23, -0.06,
                       z - 0.16, z + 0.16, 'pink', r=0.035, segs=4)
        mount = rod(F, 'lift_mount', (0, 0.12, z), (0, -0.06, z), 0.045, 'metal_d')
        joint(F, 'rotary_lift_mount', cover, mount)
        spindle = rod(F, 'spindle', (0, -0.23, z), (0, -0.28, z), 0.035, 'metal_d')
        joint(F, 'rotary_spindle_socket', cover, spindle)
        rotor = torus(F, 'soft_rotor', (0, -0.30, z), 0.125, 0.027, 'work_pale')
        for i in range(12):
            a = i * math.tau / 12
            u, zz = 0.125 * math.cos(a), z + 0.125 * math.sin(a)
            lobe = F.sphere(f'soft_lobe_{i:02d}', u, -0.30, zz, 0.030, 'work_pale', segs=12)
            joint(F, f'rotor_lobe_{i:02d}', rotor, lobe)
        # Открытая рамка: ограждение читается, но не прячет рабочий контур.
        sides = []
        for side, u in (('L', -0.205), ('R', 0.205)):
            sides.append(F.rbox(f'guard_side_{side}', u - 0.015, u + 0.015, -0.35, -0.25,
                                z - 0.22, z + 0.22, 'metal_d', r=0.008))
        top = F.rbox('guard_top', -0.22, 0.22, -0.35, -0.25, z + 0.205, z + 0.22,
                     'metal_d', r=0.008)
        for index, guard in enumerate(sides):
            side = 'L' if index == 0 else 'R'
            sign = -1 if index == 0 else 1
            joint(F, f'guard_top_joint_{side}', top, guard)
            mount_guard = rod(F, f'guard_mount_{side}',
                              (sign * 0.15, -0.22, z + 0.17),
                              (sign * 0.205, -0.27, z + 0.17), 0.016, 'metal_d')
            joint(F, f'guard_mount_cover_{side}', cover, mount_guard)
            joint(F, f'guard_mount_frame_{side}', guard, mount_guard)


def work_brush_pair(F, lift=0.0):
    z = 0.78 + lift
    with _building(F, 'work_brush_pair'):
        carrier = F.rbox('carrier', -0.45, 0.45, -0.18, 0.12, z - 0.04, z + 0.04,
                         'metal_d', r=0.012)
        for index, u in enumerate((-0.28, 0.28)):
            motor = rod(F, f'motor_{index}', (u, -0.18, z), (u, -0.37, z), 0.085, 'pink', vertices=28)
            rotor = rod(F, f'rotor_{index}', (u, -0.37, z), (u, -0.405, z), 0.035, 'metal_d')
            joint(F, f'brush_motor_mount_{index}', carrier, motor)
            joint(F, f'brush_rotor_socket_{index}', motor, rotor)
            ring = torus(F, f'brush_ring_{index}', (u, -0.42, z), 0.055, 0.015, 'work_pale')
            for k in range(8):
                a = k * math.tau / 8
                p0 = (u + 0.025 * math.cos(a), -0.43, z + 0.025 * math.sin(a))
                p1 = (u + 0.085 * math.cos(a), -0.43, z + 0.085 * math.sin(a))
                bristle = rod(F, f'bristle_{index}_{k}', p0, p1, 0.009, 'work_pale', vertices=10)
                joint(F, f'bristle_socket_{index}_{k}', ring, bristle)


def support_cradle(F, height=0.62, spread=0.32):
    if not 0.48 <= height <= 0.96:
        raise ValueError('support_cradle outside 0.48..0.96 m')
    with _building(F, 'support_cradle'):
        for index, u in enumerate((-spread, spread)):
            foot = F.rbox(f'foot_{index}', u - 0.12, u + 0.12, -0.70, -0.48,
                          0.0, 0.10, 'dark', r=0.025)
            post = F.rbox(f'post_{index}', u - 0.035, u + 0.035, -0.61, -0.54,
                          0.10, height, 'metal', r=0.012)
            adjuster = F.rbox(f'adjuster_{index}', u - 0.05, u + 0.05, -0.625, -0.61,
                              height - 0.16, height - 0.08, 'metal_d', r=0.008)
            pad = F.rbox(f'pad_{index}', u - 0.13, u + 0.13, -0.68, -0.47,
                         height, height + 0.055, 'work_pale', r=0.025)
            joint(F, f'cradle_foot_post_{index}', foot, post)
            joint(F, f'cradle_adjuster_post_{index}', adjuster, post)
            joint(F, f'cradle_pad_post_{index}', pad, post)
            clamp = torus(F, f'clamp_{index}', (u, -0.575, height + 0.06),
                          0.065, 0.012, 'dark', normal=(0, 0, 1))
            joint(F, f'cradle_clamp_pad_{index}', pad, clamp)


def interface_console(F):
    with _building(F, 'interface_console'):
        foot = F.rbox('foot', -0.14, 0.14, -0.14, 0.14, 0.0, 0.10, 'dark', r=0.03)
        pedestal = F.rbox('pedestal', -0.10, 0.10, -0.10, 0.10, 0.10, 0.91, 'wall', r=0.03)
        head = F.rbox('head', -0.19, 0.19, -0.13, 0.13, 0.91, 1.12, 'wall', r=0.035, segs=4)
        before_screen = set(bpy.data.objects)
        F.screen('display', -0.15, 0.08, -0.145, -0.13, 0.97, 1.075, face='-Y')
        screen_parts = {o.name: o for o in bpy.data.objects if o not in before_screen}
        body = screen_parts[F._n('display_body')]
        bezel = screen_parts[F._n('display_bezel')]
        face = screen_parts[F._n('display_face')]
        joint(F, 'console_display_body_bezel', body, bezel)
        joint(F, 'console_display_bezel_face', bezel, face)
        collar = rod(F, 'stop_collar', (0.135, -0.13, 1.00), (0.135, -0.155, 1.00),
                     0.035, 'safety_yellow', vertices=20)
        button = rod(F, 'stop_button', (0.135, -0.155, 1.00), (0.135, -0.175, 1.00),
                     0.025, 'safety_red', vertices=20)
        joint(F, 'console_foot_pedestal', foot, pedestal)
        joint(F, 'console_pedestal_head', pedestal, head)
        joint(F, 'console_stop_mount', head, collar)
        joint(F, 'console_stop_button', collar, button)


def utility_routing(F, lift=0.0, work_drop=0.0):
    with _building(F, 'utility_routing'):
        trunk = F.rbox('rear_trunk', -0.45, 0.45, 0.34, 0.39, 0.24, 0.31,
                       'metal_d', r=0.01)
        connector = F.rbox('drive_connector', -0.025, 0.025, 0.21, 0.24,
                           1.04 + lift, 1.12 + lift, 'dark', r=0.006)
        mount = F.rbox('connector_mount', -0.025, 0.025, 0.137, 0.21,
                       1.06 + lift, 1.10 + lift, 'metal_d', r=0.004)
        supply = F.cable('console_supply', [(0.82, 0.02, 0.88), (0.76, 0.26, 0.52),
                                            (0.48, 0.36, 0.30), (0.40, 0.36, 0.28)], r=0.012)
        loop = F.cable('drive_service_loop', [(0.0, 0.36, 0.28), (0.0, 0.32, 0.58),
                                              (0.0, 0.28, 0.94 + lift),
                                              (0.0, 0.24, 1.08 + lift)], r=0.012)
        joint(F, 'utility_supply_trunk', supply, trunk)
        joint(F, 'utility_loop_trunk', loop, trunk)
        joint(F, 'utility_loop_connector', loop, connector)
        joint(F, 'utility_connector_mount', connector, mount)
        if work_drop > 0:
            brush = F.cable('brush_supply', [(0.0, 0.24, 1.08 + lift),
                                             (0.14, 0.24, 0.98 + lift),
                                             (0.20, 0.12, 1.08 + lift - work_drop)], r=0.010)
            joint(F, 'utility_brush_supply', connector, brush)
            joint(F, 'utility_shared_junction', loop, brush)


BUILDERS = {
    'structure_base': structure_base,
    'structure_portal': structure_portal,
    'motion_lift': motion_lift,
    'motion_linear': motion_linear,
    'work_probe': work_probe,
    'work_rotary': work_rotary,
    'work_brush_pair': work_brush_pair,
    'support_cradle': support_cradle,
    'interface_console': interface_console,
    'utility_routing': utility_routing,
}


def build_module(module_id, F, **kwargs):
    if module_id not in BUILDERS:
        raise KeyError(module_id)
    before = set(bpy.data.objects)
    BUILDERS[module_id](F, **kwargs)
    return [o for o in bpy.data.objects if o not in before]


def build_machine(asset_id, F, slide=0.0, lift=0.0, stroke=0.5):
    if asset_id not in ASSEMBLY_DEFS:
        raise KeyError(asset_id)
    before = set(bpy.data.objects)
    structure_base(F)
    if asset_id == 'lab_sex_machine_anal':
        motion_linear(F, slide=slide, z=1.15)
        work_probe(F, slide=slide, z=1.15, stroke=stroke)
        support_cradle(F, height=0.72, spread=0.36)
    elif asset_id == 'lab_sex_machine_tickling':
        structure_portal(F)
        motion_lift(F, lift=lift)
        work_brush_pair(F, lift=lift)
        support_cradle(F, height=0.52, spread=0.30)
    elif asset_id == 'lab_sex_machine_circularsaw':
        structure_portal(F)
        motion_lift(F, lift=lift)
        work_rotary(F, lift=lift)
        support_cradle(F, height=0.62, spread=0.34)
    else:
        structure_portal(F)
        motion_lift(F, lift=lift)
        motion_linear(F, slide=slide, z=1.15 + lift)
        work_probe(F, slide=slide, z=1.15 + lift, stroke=stroke)
        support_cradle(F, height=0.82, spread=0.38)
    interface_console(subframe(F, 0.82, -0.02, 'console__'))
    utility_routing(F, lift=lift, work_drop=0.37 if asset_id == 'lab_sex_machine_tickling' else 0.0)

    # Межмодульные стыки перечислены по точным именам деталей и попадут в отчёт.
    joint_named(F, 'base_utility_trunk', 'deck', 'rear_trunk')
    joint_named(F, 'console_supply_socket', 'console_supply', 'console__pedestal')
    if asset_id in ('lab_sex_machine_vaginal', 'lab_sex_machine_anal'):
        for side in ('L', 'R'):
            joint_named(F, f'linear_base_mount_{side}', f'mount_post_{side}', 'deck')
        joint_named(F, 'probe_linear_mount', 'carriage_mount', 'carriage_cheek_F')
        joint_named(F, 'linear_utility_connector', 'connector_mount', 'carriage_cheek_B')
    if asset_id != 'lab_sex_machine_anal':
        for side in ('L', 'R'):
            joint_named(F, f'portal_base_mount_{side}', f'column_{side}', 'deck')
            joint_named(F, f'portal_lift_top_{side}', 'crossbeam', f'end_{side}_high')
        joint_named(F, 'lift_utility_connector', 'connector_mount', 'carriage_bridge')
    if asset_id == 'lab_sex_machine_vaginal':
        joint_named(F, 'lift_linear_mount', 'carriage_bridge', 'carriage_cheek_B')
    elif asset_id == 'lab_sex_machine_circularsaw':
        joint_named(F, 'lift_rotary_mount', 'carriage_bridge', 'lift_mount')
    elif asset_id == 'lab_sex_machine_tickling':
        joint_named(F, 'lift_brush_mount', 'carriage_bridge', 'carrier')
        joint_named(F, 'brush_utility_connector', 'brush_supply', 'carrier')
    objects = [o for o in bpy.data.objects if o not in before]
    for obj in objects:
        obj['asset_id'] = asset_id
    return objects
