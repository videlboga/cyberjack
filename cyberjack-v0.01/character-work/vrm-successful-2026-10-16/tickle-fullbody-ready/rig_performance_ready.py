"""Процедурная полнотелая реакция на готовой текстурированной Mira.

Библиотека клипов не проигрывается. Из неё взяты только ориентиры амплитуд;
суставные оси считаются по анатомическим сегментам текущего скелета.
"""
import bpy
import json
import math
import struct
from pathlib import Path

from mathutils import Quaternion, Vector

HERE = Path(__file__).resolve().parent
BUNDLE = HERE.parent
SOURCE = BUNDLE / 'characters/mira/Mira_outfit_03_toes.vrm'
TOES = ['BigToe', 'SmallToe1', 'SmallToe2', 'SmallToe3', 'SmallToe4']
TOE_SCALE = {'BigToe': 1.0, 'SmallToe1': 0.92, 'SmallToe2': 0.86,
             'SmallToe3': 0.78, 'SmallToe4': 0.68}
RECIPES = {
    'heel': {'flex': -22, 'twist': 4, 'toes': ('splay', 13), 'pulses': 2, 'lag': 0.10},
    'arch_medial': {'flex': 6, 'twist': -7, 'toes': ('curl', 24), 'pulses': 2, 'lag': 0.12},
    'arch_lateral': {'flex': 4, 'twist': 9, 'toes': ('splay', 10), 'pulses': 2, 'lag': 0.08},
    'ball': {'flex': 9, 'twist': -5, 'toes': ('extend', 17), 'pulses': 3, 'lag': 0.06},
    'toe_pad_1': {'flex': 3, 'twist': 3, 'toes': ('curl_big', 27), 'pulses': 3, 'lag': 0.05},
    'toe_pad_2_5': {'flex': 4, 'twist': 4, 'toes': ('curl_small', 21), 'pulses': 3, 'lag': 0.05},
    'instep': {'flex': 20, 'twist': -6, 'toes': ('splay', 6), 'pulses': 1, 'lag': 0.15},
    'ankle_ring': {'flex': 2, 'twist': 13, 'yaw': 6, 'toes': ('splay', 4), 'pulses': 2, 'lag': 0.0},
    'intertoe': {'flex': 2, 'twist': 3, 'toes': ('single', 15), 'pulses': 2, 'lag': 0.0},
}
CHARACTER_GAIN = {'fresh': 1.0, 'oversensitive': 1.25, 'adapted': 0.62,
                  'fatigued': 0.40, 'rest': 0.0, 'after_release': 0.40}


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def glb_json(path):
    raw = Path(path).read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    return json.loads(raw[20:20 + length])


def pulse_wave(phase, pulses):
    pos = (phase % 1.0) * pulses
    index = int(pos)
    u = pos - index
    if u < 0.22:
        value = math.sin(0.5 * math.pi * u / 0.22)
    else:
        value = math.cos(0.5 * math.pi * (u - 0.22) / 0.78)
    return value * (1.55 if index == 0 else 0.92)


class ReadyRig:
    def __init__(self):
        self.rig = bpy.data.objects['rig_ready']
        for pb in self.rig.pose.bones:
            pb.matrix_basis.identity()
        bpy.context.view_layer.update()
        self.body = next(o for o in bpy.data.objects if o.type == 'MESH' and
                         any(m and m.name == 'KK cf_m_body' for m in o.data.materials))
        self.control = bpy.data.objects['Tickle_Control']
        self.zone_names = json.loads(self.body['zone_names'])
        self.expression_doc = glb_json(SOURCE)
        self.heads = [o for o in bpy.data.objects if o.type == 'MESH' and o.data.shape_keys]
        self.last_zone = 'arch_medial'
        self.expression_targets = set()
        self.touched = set()
        self.smooth = {key: 0.0 for key in
                       ['local', 'body', 'flinch', 'face', 'breath', 'voice', 'mouth']}
        self.last_t = None
        self.contact_points = self._find_contact_points()
        self.tool = self._make_tool()
        self._prepare_expressions()
        self.fit_sole_camera()
        self.forward = self._forward()
        self.left_segments = self._segments('L')

    def _forward(self):
        ankle = self.rig.data.bones['Left ankle'].head_local
        ball = self.rig.data.bones['Left toe'].head_local
        v = Vector((ball.x - ankle.x, ball.y - ankle.y, 0))
        return v.normalized()

    def _segments(self, side):
        suffix = '.L' if side == 'L' else '.R'
        return {
            'thigh': 'Left leg' if side == 'L' else 'Right leg',
            'shin': 'Left knee' if side == 'L' else 'Right knee',
            'foot': 'Left ankle' if side == 'L' else 'Right ankle',
            'toe_base': 'Left toe' if side == 'L' else 'Right toe',
            'suffix': suffix,
        }

    def fit_sole_camera(self):
        camera = bpy.data.objects.get('Camera_Sole')
        if camera is None:
            return
        target = (self.rig.data.bones['Left ankle'].head_local +
                  self.rig.data.bones['BigToe_2.L'].tail_local) * 0.5
        camera.location = target + Vector((0.09, -0.13, -0.38))
        camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.ortho_scale = 0.36

    def _find_contact_points(self):
        me = self.body.data
        attr = me.attributes['zone_id']
        sens = me.attributes['sensitivity']
        points = {}
        for zone in range(8):
            candidates = [p for p in me.polygons if attr.data[p.index].value == zone]
            if not candidates:
                continue
            centers = [self.body.matrix_world @ p.center for p in candidates]
            center = sum(centers, Vector()) / len(centers)

            def score(p):
                c = self.body.matrix_world @ p.center
                normal = (self.body.matrix_world.to_3x3() @ p.normal).normalized()
                downward = max(0.0, normal.dot(Vector((0, 0, -1))))
                return sens.data[p.index].value + 0.15 * downward - 2.0 * (c - center).length

            poly = max(candidates, key=score)
            points[self.zone_names[zone]] = (self.body.matrix_world @ poly.center,
                                              (self.body.matrix_world.to_3x3() @ poly.normal).normalized())
        return points

    def _make_tool(self):
        existing = bpy.data.objects.get('Tickle_Tool')
        if existing:
            return existing
        parts = []
        bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=0.015, radius2=0.006, depth=0.030,
                                      location=(0, 0, 0.015))
        parts.append(bpy.context.object)
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.0028, depth=0.11,
                                          location=(0, 0, 0.085))
        parts.append(bpy.context.object)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in parts:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        bpy.ops.object.join()
        tool = bpy.context.object
        tool.name = 'Tickle_Tool'
        mat = bpy.data.materials.new('Tickle · brush')
        mat.diffuse_color = (0.18, 0.62, 0.72, 1)
        mat.surface_render_method = 'DITHERED'
        tool.data.materials.append(mat)
        tool.hide_render = True
        return tool

    def _prepare_expressions(self):
        presets = self.expression_doc['extensions']['VRMC_vrm']['expressions']['preset']
        nodes = self.expression_doc['nodes']
        self.presets = {}
        for name, preset in presets.items():
            binds = []
            for bind in preset.get('morphTargetBinds', []):
                node = nodes[bind['node']]
                obj = bpy.data.objects.get(node.get('name', ''))
                if obj not in self.heads or not obj.data.shape_keys:
                    continue
                target = bind['index'] + 1
                if target >= len(obj.data.shape_keys.key_blocks):
                    continue
                binds.append((obj, target, bind.get('weight', 1.0)))
                self.expression_targets.add((obj.name, target))
            self.presets[name] = binds

    def apply_expressions(self, weights, absolute_t):
        blink_phase = absolute_t % 4.7
        blink = math.exp(-((blink_phase - 0.12) / 0.075) ** 2)
        values = {'happy': clamp(weights.get('face', 0) * 0.95 + weights.get('voice', 0) * 0.12),
                  'aa': clamp(weights.get('mouth', 0) * 0.82),
                  'surprised': clamp(weights.get('flinch', 0) * 0.45),
                  'relaxed': clamp(weights.get('face', 0) * 0.20),
                  'blink': clamp(blink)}
        for obj_name, target in self.expression_targets:
            bpy.data.objects[obj_name].data.shape_keys.key_blocks[target].value = 0.0
        for name, weight in values.items():
            if weight <= 0:
                continue
            for obj, target, bind_weight in self.presets.get(name, []):
                key = obj.data.shape_keys.key_blocks[target]
                key.value = max(key.value, clamp(weight * bind_weight))

    def reset_pose(self):
        for name in self.touched:
            pb = self.rig.pose.bones.get(name)
            if pb:
                pb.matrix_basis.identity()
        self.touched.clear()

    def rotate_world(self, bone, world_axis, degrees):
        if abs(degrees) < 1e-6:
            return
        pb = self.rig.pose.bones[bone]
        rest = self.rig.data.bones[bone].matrix_local.to_3x3()
        axis = (rest.inverted() @ Vector(world_axis)).normalized()
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = pb.rotation_quaternion @ Quaternion(axis, math.radians(degrees))
        self.touched.add(bone)

    def axis_to_move(self, bone, target_world):
        rest = self.rig.data.bones[bone]
        direction = (rest.tail_local - rest.head_local).normalized()
        axis = direction.cross(Vector(target_world))
        if axis.length < 1e-5:
            return Vector((1, 0, 0))
        return axis.normalized()

    def toe_curl_axis(self, bone):
        rest = self.rig.data.bones[bone]
        direction = (rest.tail_local - rest.head_local).normalized()
        axis = direction.cross(Vector((0, 0, -1)))
        if axis.length < 1e-5:
            return Vector((1, 0, 0))
        return axis.normalized()

    def apply_base_pose(self):
        # Руки опущены из T-позы, локти мягко согнуты, голова в нейтрали.
        self.rotate_world('Left arm', (0, 1, 0), 62)
        self.rotate_world('Right arm', (0, 1, 0), -62)
        self.rotate_world('Left elbow', (0, 0, 1), -12)
        self.rotate_world('Right elbow', (0, 0, 1), 12)
        self.rotate_world('Left wrist', (0, 0, 1), 3)
        self.rotate_world('Right wrist', (0, 0, 1), -3)
        self.rotate_world('Neck', (1, 0, 0), 2)
        self.rotate_world('Head', (1, 0, 0), -1)
        self.rotate_world('Left knee', self.axis_to_move('Left knee', (0, 0, -1)), 2)
        self.rotate_world('Right knee', self.axis_to_move('Right knee', (0, 0, -1)), 2)

    def apply_body_reaction(self, channels, absolute_t):
        body = channels.get('body', 0.0)
        flinch = channels.get('flinch', 0.0)
        face = channels.get('face', 0.0)
        breath = channels.get('breath', 0.0)
        # Медленные слои: перенос веса, дыхание и усталость не синхронны стимулу.
        sway = math.sin(2 * math.pi * 0.31 * absolute_t + 0.4)
        shift = math.sin(2 * math.pi * 0.19 * absolute_t + 1.2)
        slow = math.sin(2 * math.pi * 0.53 * absolute_t + 0.7)
        effort = body * (0.72 + 0.28 * math.sin(2 * math.pi * 0.44 * absolute_t + 0.2))
        tremor = math.sin(2 * math.pi * 3.05 * absolute_t)
        # Корпус: основная реакция идёт от медленного effort, а не от общего качания.
        self.rotate_world('Spine', (1, 0, 0), 4.6 * effort + 1.4 * flinch - 0.35 * breath)
        self.rotate_world('Spine', (0, 1, 0), 1.25 * effort * sway + 0.35 * shift)
        self.rotate_world('Chest', (0, 0, 1), 2.4 * effort * slow + 0.5 * shift)
        self.rotate_world('Upper Chest', (0, 1, 0), 1.2 * effort * sway - 0.25 * breath)
        self.rotate_world('Neck', (1, 0, 0), -4.6 * face - 2.0 * flinch + 0.35 * breath)
        # Голова отстаёт от корпуса; при щекотке отворачивается, а не трясётся всем телом.
        self.rotate_world('Head', (1, 0, 0), -8.2 * face - 3.5 * flinch + 0.25 * breath)
        self.rotate_world('Head', (0, 1, 0), 2.5 * effort * math.sin(2 * math.pi * 0.47 * absolute_t + 0.8))
        self.rotate_world('Head', (0, 0, 1), 1.8 * effort * slow + 0.9 * flinch * tremor)
        gaze = 4.2 * face * math.sin(2 * math.pi * 0.61 * absolute_t + 0.5) + 1.6 * flinch
        self.rotate_world('Left Eye', (0, 0, 1), gaze)
        self.rotate_world('Right Eye', (0, 0, 1), gaze)
        # Асимметрия рук: стимулируемая сторона отводится, опорная рука лишь балансирует.
        self.rotate_world('Left arm', (0, 1, 0), -8.0 * effort - 2.0 * flinch)
        self.rotate_world('Right arm', (0, 1, 0), 3.2 * effort)
        self.rotate_world('Left elbow', (0, 0, 1), -11.0 * effort)
        self.rotate_world('Right elbow', (0, 0, 1), 6.0 * effort)
        self.rotate_world('Left wrist', (0, 0, 1), -3.0 * effort * sway)
        self.rotate_world('Right wrist', (0, 0, 1), 2.0 * effort * sway)
        for side, sign in [('L', 1), ('R', -1)]:
            for index, (finger, amount) in enumerate([('IndexFinger1', 7), ('MiddleFinger1', 9),
                                                      ('RingFinger1', 8), ('LittleFinger1', 6), ('Thumb1', 5)]):
                name = f'{finger}_{side}'
                if name in self.rig.pose.bones:
                    wave = math.sin(2 * math.pi * (0.75 * absolute_t + index * 0.06))
                    self.rotate_world(name, (0, 0, 1), sign * amount * effort * (0.7 + 0.3 * wave))
        # Стимулируемая нога отводится с запаздыванием; опорная остаётся на месте.
        thigh_axis = self.axis_to_move('Left leg', self.forward)
        shin_axis = self.axis_to_move('Left knee', -self.forward)
        lift = 14.0 * effort + 4.0 * flinch + 0.6 * sway
        self.rotate_world('Left leg', thigh_axis, lift)
        self.rotate_world('Left knee', shin_axis, 10.0 * effort + 3.0 * flinch)
        self.rotate_world('Left ankle', (1, 0, 0), -4.0 * effort)
        self.rotate_world('Left ankle', (0, 0, 1), 1.2 * effort * sway)
        self.rotate_world('Right knee', self.axis_to_move('Right knee', (0, 0, -1)), 1.0)

    def place_tool(self, zone, visible, override=None):
        self.tool.hide_render = not visible
        if not visible:
            return
        if override is not None:
            point, normal = override
        else:
            point, normal = self.contact_points.get(zone, self.contact_points['arch_medial'])
            bone_name = 'BigToe_2.L' if zone == 'toe_pad_1' else 'Left ankle'
            rest = self.rig.data.bones[bone_name].matrix_local
            posed = self.rig.pose.bones[bone_name].matrix
            delta = posed @ rest.inverted()
            point = self.rig.matrix_world @ delta @ self.rig.matrix_world.inverted() @ point
            normal = (self.rig.matrix_world @ delta @ self.rig.matrix_world.inverted()).to_3x3() @ normal
        self.tool.location = point + normal.normalized() * 0.016
        self.tool.rotation_mode = 'QUATERNION'
        self.tool.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(normal.normalized())

    def apply(self, state, absolute_t, contact_override=None):
        raw = {key: float(state.get(key, 0.0)) for key in self.smooth}
        if self.last_t is None or absolute_t <= self.last_t or absolute_t - self.last_t > 0.35:
            self.smooth = dict(raw)
        else:
            dt = min(0.2, max(0.001, absolute_t - self.last_t))
            tau = {'local': 0.045, 'body': 0.16, 'flinch': 0.055, 'face': 0.12,
                   'breath': 0.18, 'voice': 0.11, 'mouth': 0.055}
            for key in self.smooth:
                alpha = 1.0 - math.exp(-dt / tau[key])
                self.smooth[key] += (raw[key] - self.smooth[key]) * alpha
        self.last_t = absolute_t
        self.reset_pose()
        self.apply_base_pose()
        zone = self.last_zone
        if state.get('clip'):
            for candidate in RECIPES:
                if state['clip'].startswith(candidate + '_'):
                    zone = candidate
                    break
        if zone in RECIPES:
            self.last_zone = zone
        zone = self.last_zone
        recipe = RECIPES[zone]
        character = state.get('character', 'rest')
        gain = CHARACTER_GAIN.get(character, 1.0) * state.get('tier', 1.0)
        local = self.smooth['local'] * gain
        phase = state.get('t_contact', 0.0) / 2.0
        pulse = pulse_wave(phase - recipe['lag'], recipe['pulses'])

        self.apply_body_reaction(self.smooth, absolute_t)

        flex = recipe['flex'] * pulse * local
        self.rotate_world('Left ankle', (1, 0, 0), -flex * 0.55)
        self.rotate_world('Left ankle', (0, 0, 1), recipe['twist'] * pulse * local * 0.45)
        self.rotate_world('Left ankle', (0, 0, 1), recipe.get('yaw', 0) * pulse * local * 0.35)

        mode, base_amp = recipe['toes']
        for index, toe in enumerate(TOES):
            if mode in {'curl', 'splay', 'extend'}:
                amp = base_amp * TOE_SCALE[toe]
            elif mode == 'curl_big':
                amp = base_amp * (1.0 if toe == 'BigToe' else 0.15)
            elif mode == 'curl_small':
                amp = base_amp * (0.15 if toe == 'BigToe' else TOE_SCALE[toe])
            else:
                slot = index / len(TOES)
                local_phase = (phase - slot) % 1.0
                amp = base_amp if local_phase < 0.18 else base_amp * 0.08
            if mode == 'extend':
                amp = -amp
            if mode == 'single':
                local_phase = (phase - index / len(TOES)) % 1.0
                wave = math.sin(2 * math.pi * local_phase / 0.18) if local_phase < 0.18 else 0.0
            else:
                wave = pulse_wave(phase - recipe['lag'] - index * 0.010, recipe['pulses'])
            names = [f'{toe}.L'] + ([f'{toe}_2.L', f'{toe}_3.L'] if toe != 'BigToe' else [])
            if mode in {'splay', 'extend'}:
                side_sign = 1 if self.rig.data.bones['Left ankle'].head_local.x > 0 else -1
                spread = (-1 if index == 0 else 1) * side_sign
                self.rotate_world(names[0], (0, 0, 1), amp * 0.55 * spread * wave * local)
            else:
                for segment, name in enumerate(names):
                    axis = self.toe_curl_axis(name)
                    scale = [1.0, 0.72, 0.55][segment]
                    segment_wave = pulse_wave(phase - recipe['lag'] - index * 0.010 - segment * 0.014,
                                              recipe['pulses'])
                    self.rotate_world(name, axis, amp * scale * segment_wave * local)

        idle_breath = 0.10 + 0.14 * (0.5 + 0.5 * math.sin(2 * math.pi * 0.23 * absolute_t))
        self.body.data.shape_keys.key_blocks['Tickle_Breath'].value = clamp(idle_breath + 0.80 * self.smooth['breath'])
        self.apply_expressions(self.smooth, absolute_t)
        bpy.context.view_layer.update()
        self.place_tool(zone, state.get('family') is not None, contact_override)
        for key in ['stimulus', 'delivered', 'perceived', 'adaptation', 'load', 'expectedness',
                    'face', 'breath', 'voice', 'mouth', 'local', 'body', 'flinch']:
            self.control[key] = float(state.get(key, 0.0))
        self.control['active_zone'] = zone if state.get('family') else ''
        self.control['character'] = character
        self.control['onsets_ms'] = json.dumps(state.get('onsets_ms', {}))
