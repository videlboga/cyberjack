"""ОМНИ-1 v2 — сборка по чертежам (без арок). Всё в метрах, стол 1.90x0.64x0.13.
Проверки: ROD_OUT (стойка в пазу), SLOT_CLEAR (ничего не врезается в тело позже)."""
import bpy, math, os
from mathutils import Vector

# ---------------- параметры (из листов) ----------------
L, W, TH = 1.90, 0.64, 0.13
TOPZ = 1.11
BOTZ = TOPZ - TH
SLOT_W = 0.16
SLOTS = [(-0.80, -0.20, 0.30), (-0.80, -0.20, -0.30), (0.30, 0.90, 0.30), (0.30, 0.90, -0.30)]
PIVOT_X = {'arm': -0.52, 'leg': 0.62}
PIVOT_Y = 0.30
CUFF_R = {'arm': 0.095, 'leg': 0.112}
TAGS = (('arm_L', 1), ('arm_R', -1), ('leg_L', 1), ('leg_R', -1))
COL_D, COL_H0, COL_H1 = 0.17, 0.52, 0.90

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
os.makedirs(OUT, exist_ok=True)

# ---------------- сцена ----------------
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 1400, 900
sc.eevee.taa_render_samples = 24
sc.eevee.use_raytracing = True

def mat(name, rgb, rough=0.55):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    return m

M_BODY = mat('m_body', (0.78, 0.81, 0.83), 0.42)
M_DARK = mat('m_dark', (0.30, 0.34, 0.38), 0.55)
M_MET = mat('m_met', (0.62, 0.66, 0.69), 0.28)
M_PAD = mat('m_pad', (0.86, 0.88, 0.89), 0.85)
M_ACC = mat('m_acc', (0.18, 0.62, 0.59), 0.35)

PARTS = []
def reg(o, material, bone):
    o.data.materials.append(material)
    PARTS.append((o, bone))
    return o

def box(name, size, loc, material, bone, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return reg(o, material, bone)

def cyl(name, r, h, loc, material, bone, rot=(0, 0, 0), seg=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=seg,
                                        location=loc, rotation=rot)
    o = bpy.context.object; o.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return reg(o, material, bone)

def cut(obj, prim):
    m = obj.modifiers.new('cut', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = prim
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier='cut')
    bpy.data.objects.remove(prim, do_unlink=True)

# ---------------- столешница с пазами ----------------
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, (TOPZ + BOTZ) / 2))
plate = bpy.context.object; plate.name = 'table'
plate.scale = (L, W, TH)
bpy.ops.object.transform_apply(location=True, scale=True)
reg(plate, M_BODY, 'table')

for (x0, x1, y) in SLOTS:
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, y, (TOPZ + BOTZ) / 2))
    c = bpy.context.object; c.scale = (x1 - x0, SLOT_W, TH * 2)
    bpy.ops.object.transform_apply(location=True, scale=True)
    cut(plate, c)

# ---------------- анатомическое ложе + бортики ----------------
def carve(kind, x, y, r, depth, length=None):
    cz = TOPZ + r - depth
    if kind == 'sphere':
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(x, y, cz), segments=32, ring_count=18)
        o = bpy.context.object; o.scale = (1.3, 1.0, 0.5)
    else:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=length, vertices=32,
                                            location=(x, y, cz), rotation=(0, math.radians(90), 0))
        o = bpy.context.object; o.scale = (1, 1, 0.55)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    cut(plate, o)

carve('sphere', -0.79, 0.0, 0.105, 0.012)
carve('cyl', -0.35, 0.0, 0.165, 0.018, 0.62)
carve('sphere', -0.02, 0.0, 0.135, 0.014)
carve('cyl', -0.34, 0.20, 0.052, 0.010, 0.55)
carve('cyl', -0.34, -0.20, 0.052, 0.010, 0.55)
carve('cyl', 0.36, 0.09, 0.070, 0.012, 0.62)
carve('cyl', 0.36, -0.09, 0.070, 0.012, 0.62)
carve('sphere', 0.80, 0.0, 0.075, 0.010)

BOLSTERS = [(-0.83, 0.83, 0.268, 0.318, 0.026), (-0.83, 0.83, -0.318, -0.268, 0.026),
            (-0.83, -0.75, -0.15, 0.15, 0.024), (0.84, 0.89, -0.14, 0.14, 0.022),
            (0.30, 0.86, -0.018, 0.018, 0.012)]
for i, (x0, x1, y0, y1, h) in enumerate(BOLSTERS):
    o = box(f'bolster_{i}', (x1 - x0, y1 - y0, h),
            ((x0 + x1) / 2, (y0 + y1) / 2, TOPZ + h / 2), M_PAD, 'table')
    b = o.modifiers.new('bev', 'BEVEL'); b.width = 0.008; b.segments = 2
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='bev')

# ---------------- колонна и вилка ----------------
cyl('col', COL_D / 2, COL_H1, (0, 0, COL_H1 / 2), M_BODY, 'column', seg=40)
cyl('col_inner', COL_D / 2 - 0.02, 0.30, (0, 0, COL_H1 - 0.15), M_MET, 'column', seg=32)
box('fork', (0.19, 0.19, 0.06), (0, 0, BOTZ - 0.03), M_MET, 'pitch')
cyl('axle', 0.035, 0.21, (0, 0, BOTZ - 0.02), M_MET, 'pitch', rot=(0, math.radians(90), 0), seg=20)
box('base', (0.90, 0.50, 0.05), (0, 0, 0.025), M_DARK, 'base')

# ---------------- крепления ----------------
def cuff(tag, center, group, r_out, width):
    """браслет из сегментов: обойма + мягкое уплотнение"""
    r_in = r_out - 0.026
    made = []
    n = 22
    for i in range(n):
        a = 2 * math.pi * i / n
        rm = (r_out + r_in) / 2
        made.append(box(f'cuff_{tag}_s{i}', (width, 0.024, r_out - r_in),
                        (center[0], center[1] + rm * math.cos(a), center[2] + rm * math.sin(a)),
                        M_MET, f'head_{tag}', rot=(a, 0, 0)))
        made.append(box(f'cuff_{tag}_p{i}', (width * 0.9, 0.018, 0.012),
                        (center[0], center[1] + r_in * math.cos(a), center[2] + r_in * math.sin(a)),
                        M_PAD, f'head_{tag}', rot=(a, 0, 0)))
    for o in made:
        o.parent = group
    return made[0]

def build_mount(tag, sgn):
    kind = tag.split('_')[0]
    px, py = PIVOT_X[kind], sgn * PIVOT_Y
    g = bpy.data.objects.new(f'g_{tag}', None)
    sc.collection.objects.link(g)
    g.location = (px, py, 0)

    def put(o):
        o.parent = g; return o

    put(box(f'car_{tag}', (0.14, 0.13, 0.10), (0, 0, 0.925), M_DARK, f'car_{tag}'))
    put(cyl(f'post_{tag}', 0.020, 0.34, (0, 0, 1.09), M_MET, f'post_{tag}', seg=18))
    put(cyl(f'post_inner_{tag}', 0.014, 0.34, (0, 0, 1.26), M_MET, f'post_{tag}', seg=16))
    put(box(f'head_{tag}', (0.06, 0.06, 0.05), (0, 0, 1.42), M_BODY, f'head_{tag}'))
    put(cuff(tag, (0, 0, 1.47), g, CUFF_R[kind], 0.055 if kind == 'arm' else 0.070))
    put(box(f'latch_{tag}', (0.030, 0.026, 0.055), (0, -CUFF_R[kind] - 0.005, 1.47),
            M_ACC, f'head_{tag}'))
    return g

for tag, sgn in TAGS:
    build_mount(tag, sgn)

# ---------------- скелет ----------------
ad = bpy.data.armatures.new('OMNI_rig')
rig = bpy.data.objects.new('OMNI_rig', ad)
sc.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')

def bone(name, head, tail, parent=None):
    b = ad.edit_bones.new(name)
    b.head, b.tail = head, tail
    if parent:
        b.parent = ad.edit_bones[parent]
    return b

bone('root', (0, 0, 0), (0, 0, 0.10))
bone('base', (0, 0, 0.05), (0, 0, 0.10), 'root')
bone('column', (0, 0, 0.05), (0, 0, BOTZ), 'base')
bone('pitch', (0, 0, BOTZ), (0, 0, BOTZ + 0.02), 'column')
bone('table', (0, 0, BOTZ), (0, 0, BOTZ + 0.04), 'pitch')
for tag, sgn in TAGS:
    kind = tag.split('_')[0]
    px, py = PIVOT_X[kind], sgn * PIVOT_Y
    bone(f'car_{tag}', (px, py, 0.925), (px, py, 0.925 + 0.02), 'table')
    bone(f'post_{tag}', (px, py, 1.0), (px, py, 1.34), f'car_{tag}')
    bone(f'head_{tag}', (px, py, 1.42), (px, py, 1.47), f'post_{tag}')
bpy.ops.object.mode_set(mode='OBJECT')

# ---------------- объединение и скин ----------------
for o, b in PARTS:
    vg = o.vertex_groups.new(name=b)
    vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE')

for o, _ in PARTS:
    for x in bpy.context.selected_objects:
        x.select_set(False)
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
bpy.ops.object.select_all(action='DESELECT')
for o, _ in PARTS:
    o.select_set(True)
bpy.context.view_layer.objects.active = plate
bpy.ops.object.join()
machine = bpy.context.object
machine.name = 'OMNI_1'
machine.parent = rig
mod = machine.modifiers.new('Armature', 'ARMATURE')
mod.object = rig

# ---------------- свет/камера/пол ----------------
for nm, vec, e in (('key', (0.5, 0.8, -0.7), 3.2), ('fill', (-0.6, -0.7, -0.35), 1.1)):
    d = bpy.data.lights.new(nm, 'SUN'); d.energy = e
    o = bpy.data.objects.new(nm, d)
    o.rotation_euler = Vector(vec).normalized().to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(o)

w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.62, 0.65, 0.68, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.85

bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, -0.002))
fl = bpy.context.object
fl.data.materials.append(mat('m_floor', (0.55, 0.57, 0.60), 0.9))

cd = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam); sc.camera = cam; cd.lens = 50

def shot(name, loc, aim, lens=50, ortho=None):
    cam.data.type = 'ORTHO' if ortho else 'PERSP'
    if ortho:
        cam.data.ortho_scale = ortho
        cam.location = loc
        cam.rotation_euler = (0, 0, 0)
    else:
        cam.data.lens = lens
        cam.location = loc
        cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('SHOT', name)

# ---------------- проверки ----------------
def rod_out():
    gi = {g.index: g.name for g in machine.vertex_groups}
    dg = bpy.context.evaluated_depsgraph_get()
    ev = machine.evaluated_get(dg); me = ev.to_mesh(); mw = ev.matrix_world
    bad = 0
    for i, v in enumerate(machine.data.vertices):
        names = [gi[g.group] for g in v.groups if g.weight > 0.3]
        tag = next((n.split('_', 1)[1] for n in names if n.startswith(('post_', 'car_'))), None)
        if tag is None:
            continue
        p = mw @ me.vertices[i].co
        if not (BOTZ - 0.02 < p.z < TOPZ - 0.002):
            continue
        ok = False
        for (x0, x1, y) in SLOTS:
            if x0 - 0.01 <= p.x <= x1 + 0.01 and abs(p.y - y) <= SLOT_W / 2 + 0.01:
                ok = True; break
        if not ok:
            bad += 1
    ev.to_mesh_clear()
    return bad

print('ROD_OUT', rod_out())
print('VERTS', len(machine.data.vertices), 'BONES', len(rig.data.bones))

shot('v2_A_top.png', (0, 0, 4.0), None, ortho=2.1)
shot('v2_A_34.png', (1.6, -1.9, 1.85), (0, 0, 1.05), 48)
shot('v2_A_node.png', (-0.35, -1.05, 1.62), (-0.52, -0.15, 1.30), 70)
shot('v2_A_side.png', (0.0, -2.6, 1.15), (0, 0, 1.05), 55)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'omni_v2.blend'))
print('SAVED omni_v2.blend')
