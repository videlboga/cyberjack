"""Процедурный исполнитель реакции на rig_E и новой VRM-голове.

Библиотечные Actions не проигрываются. Из них в reference_axes.json взяты только
оси и измеренные амплитуды; зонные рецепты и телесные каналы собираются заново.
"""
import bpy
import json
import math
import struct
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector

HERE = Path(__file__).resolve().parent
BUNDLE = HERE.parent
HEAD_SOURCE = BUNDLE / 'character-factory/mira/work/exports/Mira-Anatomy.vrm'
TOES = ['BigToe', 'SmallToe1', 'SmallToe2', 'SmallToe3', 'SmallToe4']
FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'pinky']
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


class FullBodyRig:
    def __init__(self):
        self.rig = bpy.data.objects['rig_E']
        self.body = bpy.data.objects['Foot shape-original']
        self.control = bpy.data.objects['Tickle_Control']
        self.heads = [bpy.data.objects[n] for n in json.loads(self.control['head_objects'])]
        self.reference = json.loads((HERE / 'reference_axes.json').read_text(encoding='utf-8'))
        self.zone_names = json.loads(self.body['zone_names'])
        self.last_zone = 'arch_medial'
        self.rest_foot = self.rig.data.bones['foot.l'].matrix_local.copy()
        self.axis_cache = {}
        self.expression_targets = set()
        self.expression_doc = glb_json(HEAD_SOURCE)
        self.contact_points = self._find_contact_points()
        self.tool = self._make_tool()
        self._prepare_expressions()
        self.fit_sole_camera()

    def fit_sole_camera(self):
        camera = bpy.data.objects.get('Camera_Sole')
        if camera is None:
            return
        target = (self.rig.data.bones['foot.l'].head_local + self.rig.data.bones['BigToe_2.L'].tail_local) * 0.5
        camera.location = target + Vector((0.12, -0.20, -0.45))
        camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.ortho_scale = 0.34

    def axis_near(self, bone, world_direction):
        key = (bone, tuple(world_direction))
        if key not in self.axis_cache:
            matrix = self.rig.data.bones[bone].matrix_local.to_3x3()
            target = Vector(world_direction).normalized()
            axes = [Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))]
            self.axis_cache[key] = max(axes, key=lambda a: abs((matrix @ a).normalized().dot(target)))
        return self.axis_cache[key].copy()

    def set_world_delta(self, bone, rotation=None, translation=None):
        """Поворот IK-контрола относительно его текущей мировой базы без потери roll."""
        pb = self.rig.pose.bones[bone]
        base = pb.matrix.copy()
        rot = rotation or Quaternion()
        target = Matrix.Translation(base.translation) @ (rot.to_matrix() @ base.to_3x3()).to_4x4()
        if translation is not None:
            target.translation = base.translation + Vector(translation)
        pb.matrix_basis = base.inverted() @ target

    def local_rotation(self, bone, quaternion):
        pb = self.rig.pose.bones[bone]
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = quaternion

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
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.017, radius2=0.006, depth=0.035,
                                      location=(0, 0, 0.0175))
        parts.append(bpy.context.object)
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.003, depth=0.12,
                                          location=(0, 0, 0.095))
        parts.append(bpy.context.object)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in parts:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        bpy.ops.object.join()
        tool = bpy.context.object
        tool.name = 'Tickle_Tool'
        mat = bpy.data.materials.new('Tickle · brush')
        mat.diffuse_color = (0.30, 0.58, 0.68, 1)
        tool.data.materials.append(mat)
        tool.hide_render = True
        return tool

    def _prepare_expressions(self):
        presets = self.expression_doc['extensions']['VRMC_vrm']['expressions']['preset']
        nodes = self.expression_doc['nodes']
        meshes = self.expression_doc['meshes']
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
        # Автоморгание не синхронизировано со стимулом.
        blink_phase = absolute_t % 4.7
        blink = math.exp(-((blink_phase - 0.12) / 0.075) ** 2)
        values = {'happy': clamp(weights.get('face', 0) * 0.90 + weights.get('voice', 0) * 0.10),
                  'aa': clamp(weights.get('mouth', 0) * 0.78),
                  'surprised': clamp(weights.get('flinch', 0) * 0.32),
                  'relaxed': clamp(weights.get('face', 0) * 0.18),
                  'blink': clamp(blink)}
        for obj_name, target in self.expression_targets:
            bpy.data.objects[obj_name].data.shape_keys.key_blocks[target].value = 0.0
        for name, weight in values.items():
            if weight <= 0:
                continue
            for obj, target, bind_weight in self.presets.get(name, []):
                key = obj.data.shape_keys.key_blocks[target]
                key.value = max(key.value, clamp(weight * bind_weight))

    def place_tool(self, zone, visible, override=None):
        self.tool.hide_render = not visible
        if not visible:
            return
        if override is not None:
            point, normal = override
        else:
            point, normal = self.contact_points.get(zone, self.contact_points['arch_medial'])
            bone_name = 'BigToe_2.L' if zone == 'toe_pad_1' else 'foot.l'
            rest = self.rig.data.bones[bone_name].matrix_local
            posed = self.rig.pose.bones[bone_name].matrix
            delta = posed @ rest.inverted()
            point = self.rig.matrix_world @ delta @ self.rig.matrix_world.inverted() @ point
            normal = (self.rig.matrix_world @ delta @ self.rig.matrix_world.inverted()).to_3x3() @ normal
        self.tool.location = point + normal * 0.0185
        self.tool.rotation_mode = 'QUATERNION'
        self.tool.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(normal.normalized())

    def apply(self, state, absolute_t, contact_override=None):
        zone = state.get('family') and state.get('clip', '').split('_fresh')[0]
        if state.get('character') not in {'rest', 'after_release'} and state.get('clip'):
            # Имя зоны восстанавливаем по известному суффиксу характера, без сокращения toe_pad.
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
        local = state.get('local', 0.0) * gain
        body = state.get('body', 0.0)
        phase = state.get('t_contact', 0.0) / 2.0
        pulse = pulse_wave(phase - recipe['lag'], recipe['pulses'])

        # Дистальный канал: стопа через IK, пальцы через собственные кости.
        foot_rest = Matrix(self.reference['rest_world']['foot.l']).to_3x3()
        flex_local = Vector(self.reference['axes']['flex']['foot.l'])
        flex_axis = (foot_rest @ flex_local).normalized()
        roll_axis = (self.rig.data.bones['toes_01.l'].head_local - self.rig.data.bones['foot.l'].head_local).normalized()
        yaw_axis = Vector((0, 0, 1))
        foot_q = Quaternion(flex_axis, math.radians(recipe['flex'] * pulse * local))
        foot_q = Quaternion(roll_axis, math.radians(recipe['twist'] * pulse * local)) @ foot_q
        foot_q = Quaternion(yaw_axis, math.radians(recipe.get('yaw', 0) * pulse * local)) @ foot_q
        withdraw = Vector((0, -0.002 * body, 0.009 * max(local * pulse, state.get('flinch', 0))))
        foot_target = 'c_foot_ik.l' if 'c_foot_ik.l' in self.rig.pose.bones else 'foot.l'
        self.set_world_delta(foot_target, foot_q, withdraw)

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
            kind = 'curl' if mode.startswith('curl') or mode == 'extend' else 'splay'
            for suffix, segment in [('', 1.0), ('_2', 0.72)]:
                bone = f'{toe}{suffix}.L'
                axis = self.reference['axes'].get(kind, {}).get(bone)
                if axis is None:
                    axis = self.reference['axes']['curl'].get(bone)
                if axis is None:
                    continue
                if mode == 'single':
                    local_phase = (phase - index / len(TOES)) % 1.0
                    wave = math.sin(2 * math.pi * local_phase / 0.18) if local_phase < 0.18 else 0.0
                else:
                    wave = pulse
                angle = amp * segment * wave * local
                source_rest = Matrix(self.reference['rest_world'][bone]).to_3x3()
                world_axis = (source_rest @ Vector(axis)).normalized()
                self.set_world_delta(bone, Quaternion(world_axis, math.radians(angle)))

        # Проксимальный канал: небольшие авторские углы, без проигрывания чужого клипа.
        body_pulse = body * (0.40 + 0.60 * abs(math.sin(2 * math.pi * 1.7 * absolute_t)))
        spine_names = [('abdomen', 2.2, 0.0), ('chest', 3.0, 0.7)] if 'abdomen' in self.rig.pose.bones else [('c_spine_02.x', 2.2, 0.0), ('c_spine_03.x', 3.0, 0.7)]
        for bone, degrees, phase_offset in spine_names:
            axis = self.axis_near(bone, (1, 0, 0))
            q = Quaternion(axis, math.radians(degrees) * body_pulse * math.cos(absolute_t * 3.1 + phase_offset))
            self.local_rotation(bone, q)
        for side, sign in [('l', 1), ('r', -1)]:
            arm = f'upperarm.{side}' if f'upperarm.{side}' in self.rig.pose.bones else f'c_arm_fk.{side}'
            axis = self.axis_near(arm, (0, -1, 0))
            self.local_rotation(arm, Quaternion(axis, math.radians(5.0 * sign) * body_pulse))
            if f'c_hand_fk.{side}' in self.rig.pose.bones:
                self.rig.pose.bones[f'c_hand_fk.{side}']['fingers_grasp'] = 0.22 * body
            else:
                for finger in FINGER_NAMES:
                    bone = f'{finger}1.{side}'
                    axis = self.axis_near(bone, (0, 0, 1))
                    self.local_rotation(bone, Quaternion(axis, math.radians(4.0) * body))
        # Отвод стимулируемой ноги: небольшое сгибание бедра/голени поверх локальной стопы.
        if 'thigh.l' in self.rig.pose.bones:
            self.local_rotation('thigh.l', Quaternion(self.axis_near('thigh.l', (1, 0, 0)), math.radians(3.0) * body))
            self.local_rotation('shin.l', Quaternion(self.axis_near('shin.l', (1, 0, 0)), math.radians(6.0) * body))
        head_name = 'head' if 'head' in self.rig.pose.bones else 'c_head.x'
        head_axis = self.axis_near(head_name, (1, 0, 0))
        shake_axis = self.axis_near(head_name, (0, 0, 1))
        head_q = Quaternion(head_axis, math.radians(-5.0) * state.get('face', 0))
        head_q = Quaternion(shake_axis, math.radians(2.2) * state.get('face', 0) * math.sin(absolute_t * 8.3)) @ head_q
        self.local_rotation(head_name, head_q)
        self.body.data.shape_keys.key_blocks['Tickle_Breath'].value = state.get('breath', 0.0)
        self.apply_expressions(state, absolute_t)
        self.place_tool(zone, state.get('family') is not None, contact_override)
        for key in ['stimulus', 'delivered', 'perceived', 'adaptation', 'load', 'expectedness',
                    'face', 'breath', 'voice', 'mouth', 'local', 'body', 'flinch']:
            self.control[key] = float(state.get(key, 0.0))
        self.control['active_zone'] = zone if state.get('family') else ''
        self.control['character'] = character
        self.control['onsets_ms'] = json.dumps(state.get('onsets_ms', {}))
        bpy.context.view_layer.update()
