"""
ОМНИ-1 — панель управления креплениями (вшита в файл).
Открывается в 3D-вьюпорте: N → вкладка «ОМНИ-1».

Крутилки на каждую конечность: угол (отведение), вынос (длина штанги), высота кольца.
Галочка «тело следует (IK)» переключает ARP в IK и привязывает контролы к кольцам.
"""
import bpy
import math
from mathutils import Vector, Matrix

LIMBS = ('arm_L', 'arm_R', 'leg_L', 'leg_R')
NAMES = {'arm_L': 'Левая рука', 'arm_R': 'Правая рука',
         'leg_L': 'Левая нога', 'leg_R': 'Правая нога'}
PIVOT_X = {'arm': -0.52, 'leg': 0.62}
PIVOT_Y = 0.30
MODULE_Z = 0.92
SURFACE = 1.11


def _rig(name):
    return bpy.data.objects.get(name)


def _cuff_target(tag):
    s = bpy.context.scene
    a = math.radians(getattr(s, f'omni_{tag}_angle'))
    r = getattr(s, f'omni_{tag}_reach')
    z = getattr(s, f'omni_{tag}_height')
    kind = tag.split('_')[0]
    sgn = 1 if tag.endswith('_L') else -1
    x0 = PIVOT_X[kind]
    y0 = sgn * PIVOT_Y
    return Vector((x0 + r * math.cos(a), y0 + sgn * r * math.sin(a), z))


def place_limb(tag):
    """штанга от каретки к цели + стойка; ARP-IK тянет конечность за кольцом"""
    rig = _rig('OMNI_rig')
    if rig is None:
        return
    t = _cuff_target(tag)
    kind = tag.split('_')[0]
    sgn = 1 if tag.endswith('_L') else -1
    x0 = PIVOT_X[kind]
    y0 = sgn * PIVOT_Y
    dx, dy = t.x - x0, t.y - y0
    r = max(0.06, math.hypot(dx, dy))
    pb = rig.pose.bones.get(f'boom_{tag}')
    if pb:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, math.atan2(-dx * sgn, dy * sgn))
        pb.scale = (1.0, r / 1.0, 1.0)
    pp = rig.pose.bones.get(f'post_{tag}')
    if pp:
        pp.scale = (1.0, max(0.05, t.z - MODULE_Z), 1.0)
    bpy.context.view_layer.update()

    # тело: ARP в IK, контрол — на кольцо
    if not bpy.context.scene.omni_body_ik:
        return
    arm = _rig('rig_')
    if arm is None:
        return
    ctl_name = f'c_hand_ik.{"l" if tag.endswith("_L") else "r"}' if kind == 'arm' \
        else f'c_foot_ik.{"l" if tag.endswith("_L") else "r"}'
    ctl = arm.pose.bones.get(ctl_name)
    if ctl is None:
        return
    if 'ik_fk_switch' in ctl.keys():
        ctl['ik_fk_switch'] = 0.0          # 0 = IK
    head = rig.matrix_world @ rig.pose.bones[f'head_{tag}'].head
    local = arm.matrix_world.inverted() @ head
    m = ctl.matrix.copy()
    m.translation = local
    ctl.matrix = m
    bpy.context.view_layer.update()


def update_all():
    for t in LIMBS:
        place_limb(t)


# ---------- свойства ----------
def _mk(tag):
    def cb(self, context):
        place_limb(tag)
    kind = tag.split('_')[0]
    setattr(bpy.types.Scene, f'omni_{tag}_angle',
            bpy.props.FloatProperty(name='Угол', default=8.0 if kind == 'arm' else 4.0,
                                    min=-30.0, max=95.0, subtype='FACTOR', update=cb))
    setattr(bpy.types.Scene, f'omni_{tag}_reach',
            bpy.props.FloatProperty(name='Вынос', default=0.58 if kind == 'arm' else 0.82,
                                    min=0.15, max=1.05, update=cb))
    setattr(bpy.types.Scene, f'omni_{tag}_height',
            bpy.props.FloatProperty(name='Высота', default=1.26 if kind == 'arm' else 1.27,
                                    min=1.15, max=1.45, update=cb))


for _t in LIMBS:
    _mk(_t)

bpy.types.Scene.omni_body_ik = bpy.props.BoolProperty(
    name='Тело следует (IK)', default=False,
    description='Переключить ARP в IK и привязать контролы к кольцам')


# ---------- панель ----------
class OMNI_PT_panel(bpy.types.Panel):
    bl_label = 'ОМНИ-1: крепления'
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'ОМНИ-1'

    def draw(self, context):
        s = context.scene
        lay = self.layout
        lay.prop(s, 'omni_body_ik')
        for tag in LIMBS:
            box = lay.box()
            box.label(text=NAMES[tag])
            box.prop(s, f'omni_{tag}_angle', slider=True)
            box.prop(s, f'omni_{tag}_reach', slider=True)
            box.prop(s, f'omni_{tag}_height', slider=True)
        lay.operator('omni.update_pose', icon='FILE_REFRESH')


class OMNI_OT_update(bpy.types.Operator):
    bl_idname = 'omni.update_pose'
    bl_label = 'Пересчитать позу'

    def execute(self, context):
        update_all()
        return {'FINISHED'}


def register():
    try:
        bpy.utils.register_class(OMNI_PT_panel)
    except ValueError:
        pass
    try:
        bpy.utils.register_class(OMNI_OT_update)
    except ValueError:
        pass


if __name__ == '__main__' or True:
    register()
