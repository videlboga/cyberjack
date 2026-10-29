"""Создаёт пустышку «ОМНИ-1» со слайдерами (custom properties) и драйверы на кости станка.
Работает без Python-автозапуска: значения крутятся в N → Item → Custom Properties.
"""
import bpy, math

PIVOT_X = {'arm': -0.52, 'leg': 0.62}
PIVOT_Y = 0.30
MODULE_Z = 0.92
LIMBS = ('arm_L', 'arm_R', 'leg_L', 'leg_R')

sc = bpy.context.scene
rig = bpy.data.objects['OMNI_rig']

emp = bpy.data.objects.get('ОМНИ-1')
if emp is None:
    emp = bpy.data.objects.new('ОМНИ-1', None)
    sc.collection.objects.link(emp)
emp.empty_display_type = 'PLAIN_AXES'
emp.empty_display_size = 0.12
emp.location = (0.0, 0.0, 1.45)

for tag in LIMBS:
    kind = tag.split('_')[0]
    emp[f'{tag}_angle'] = 8.0 if kind == 'arm' else 4.0
    emp[f'{tag}_reach'] = 0.58 if kind == 'arm' else 0.82
    emp[f'{tag}_height'] = 1.26 if kind == 'arm' else 1.27
    ui = emp.id_properties_ui(f'{tag}_angle')
    ui.update(min=-30.0, max=95.0, soft_min=-30.0, soft_max=95.0, description='Угол отведения, °')
    ui = emp.id_properties_ui(f'{tag}_reach')
    ui.update(min=0.15, max=1.05, description='Длина штанги, м')
    ui = emp.id_properties_ui(f'{tag}_height')
    ui.update(min=1.15, max=1.45, description='Высота кольца, м')

emp['body_ik'] = 0
ui = emp.id_properties_ui('body_ik')
ui.update(min=0, max=1, description='1 = тело следует за кольцами (нужен запуск omni_panel.py)')


def drv(owner, path, index, expr, vars_):
    fc = owner.driver_add(path, index) if index is not None else owner.driver_add(path)
    d = fc.driver
    d.type = 'SCRIPTED'
    for name, prop in vars_:
        v = d.variables.new()
        v.name = name
        v.type = 'SINGLE_PROP'
        v.targets[0].id = emp
        v.targets[0].data_path = f'["{prop}"]'
    d.expression = expr
    return d


# убираем старые драйверы и ключи на этих костях, иначе они конфликтуют
if rig.animation_data:
    rig.animation_data_clear()

for tag in LIMBS:
    sgn = 1 if tag.endswith('_L') else -1
    sgnf = '1' if sgn == 1 else '(-1)'
    pb = rig.pose.bones[f'boom_{tag}']
    pb.rotation_mode = 'XYZ'
    boom_expr = (f'atan2(-cos(A*pi/180)*{sgnf}, sin(A*pi/180)*{sgnf})')
    drv(pb, 'rotation_euler', 2, boom_expr, [('A', f'{tag}_angle')])
    drv(pb, 'scale', 1, 'R', [('R', f'{tag}_reach')])
    pp = rig.pose.bones[f'post_{tag}']
    drv(pp, 'scale', 1, 'max(0.05, Z-0.92)', [('Z', f'{tag}_height')])

bpy.ops.wm.save_mainfile()
print('DRIVERS_OK', len(rig.animation_data.drivers), 'props', len([k for k in emp.keys() if not k.startswith('_')]))
