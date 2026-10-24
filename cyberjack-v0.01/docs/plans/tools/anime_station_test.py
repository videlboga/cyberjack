"""Аниме-стиль станции: тестовый уголок и три варианта подачи.

Сцена нарочно маленькая (уголок коридора с капсулой, пультом и окном-иллюминатором):
на ней проверяется пайплайн toon-шейдинга, контура и палитры, до того как
перекрашивать комнаты.

Варианты:
  anime_station_a.png — cel 2 тона + чернильный контур (игровой аниме-3D)
  anime_station_b.png — мягкий градиентный toon + bloom (аниме-фон)
  anime_station_c.png — cel без контура, сильные акценты и свечение

Запуск: blender -b --factory-startup -noaudio --python tools/anime_station_test.py
"""
import bpy, sys, os, math

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# --- аниме-палитра станции ---------------------------------------------------
P = {
    'wall':   (0.93, 0.90, 0.84),   # тёплый кремовый пластик
    'wall2':  (0.80, 0.82, 0.90),   # холодная панель-вставка
    'floor':  (0.88, 0.86, 0.82),
    'metal':  (0.72, 0.76, 0.86),
    'dark':   (0.16, 0.18, 0.26),
    'teal':   (0.12, 0.80, 0.72),
    'amber':  (1.00, 0.60, 0.22),
    'glass':  (0.55, 0.85, 0.90),
    'space':  (0.03, 0.05, 0.12),
}
SHADOW_TINT = (0.52, 0.56, 0.78)     # тень в сине-фиолетовый
RIM = (0.75, 0.95, 1.00)


def toon(name, color, steps=None, emit=0.0, soft=False, rim=0.0, shadow=0.55):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    if emit > 0:
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = (*color, 1)
        em.inputs['Strength'].default_value = emit
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
        return m
    diff = nt.nodes.new('ShaderNodeBsdfDiffuse')
    diff.inputs['Color'].default_value = (1, 1, 1, 1)
    s2 = nt.nodes.new('ShaderNodeShaderToRGB')
    nt.links.new(diff.outputs['BSDF'], s2.inputs['Shader'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'EASE' if soft else 'CONSTANT'
    e = ramp.color_ramp.elements
    dark = [color[i] * SHADOW_TINT[i] * shadow for i in range(3)]
    e[0].position, e[0].color = 0.0, (*dark, 1)
    e[1].position, e[1].color = (0.62 if soft else 0.45), (*color, 1)
    if steps:
        for pos, k in steps:
            el = e.new(pos)
            el.color = (*(min(1, color[i] * k) for i in range(3)), 1)
    nt.links.new(s2.outputs['Color'], ramp.inputs['Fac'])
    sh = ramp.outputs['Color']
    if rim > 0:
        lw = nt.nodes.new('ShaderNodeLayerWeight')
        lw.inputs['Blend'].default_value = 0.30
        rr = nt.nodes.new('ShaderNodeValToRGB')
        rr.color_ramp.interpolation = 'CONSTANT'
        rr.color_ramp.elements[0].position = 0.62
        rr.color_ramp.elements[0].color = (0, 0, 0, 1)
        rr.color_ramp.elements[1].position = 0.70
        rr.color_ramp.elements[1].color = (1, 1, 1, 1)
        nt.links.new(lw.outputs['Facing'], rr.inputs['Fac'])
        mixr = nt.nodes.new('ShaderNodeMixRGB')
        mixr.blend_type = 'ADD'
        mixr.inputs['Fac'].default_value = rim
        mixr.inputs['Color2'].default_value = (*RIM, 1)
        nt.links.new(sh, mixr.inputs['Color1'])
        nt.links.new(rr.outputs['Color'], mixr.inputs['Fac'])
        sh = mixr.outputs['Color']
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = 1.0
    nt.links.new(sh, em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m


VARIANTS = {}


def build_materials(variant):
    soft = variant in ('b',)
    rim = 0.55 if variant in ('b', 'c') else 0.25
    steps = None if soft else [(0.22, 0.82)]
    M = {
        'wall': toon(f'w_{variant}', P['wall'], steps=steps, soft=soft, rim=rim, shadow=0.60),
        'wall2': toon(f'w2_{variant}', P['wall2'], steps=steps, soft=soft, rim=rim, shadow=0.55),
        'floor': toon(f'f_{variant}', P['floor'], steps=steps, soft=soft, rim=0.15, shadow=0.45),
        'metal': toon(f'm_{variant}', P['metal'], steps=steps, soft=soft, rim=rim, shadow=0.50),
        'dark': toon(f'd_{variant}', P['dark'], steps=steps, soft=soft, rim=0.30, shadow=0.70),
        'teal': toon(f't_{variant}', P['teal'], emit=1.9),
        'amber': toon(f'a_{variant}', P['amber'], emit=1.4),
        'glass': toon(f'g_{variant}', P['glass'], steps=steps, soft=soft, rim=0.9, shadow=0.5),
        'space': toon(f's_{variant}', P['space'], emit=0.55),
    }
    VARIANTS[variant] = M
    return M


def box(name, x0, x1, y0, y1, z0, z1, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.name = name
    o.scale = (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))
    bpy.ops.object.transform_apply(scale=True)
    o.location = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    bpy.ops.object.transform_apply(location=True)
    o.data.materials.append(mat)
    if bevel > 0:
        m = o.modifiers.new('b', 'BEVEL')
        m.width, m.segments, m.limit_method = bevel, 3, 'ANGLE'
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=m.name)
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    o.data.update()
    return o


def cyl(name, cx, cy, z0, z1, r, mat, verts=40):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=abs(z1 - z0), vertices=verts,
                                        location=(cx, cy, (z0 + z1) / 2))
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    o.data.update()
    return o


def build_scene(M):
    """Уголок станции: стена с иллюминатором, рёбра, капсула, пульт, пол."""
    box('floor', -3.0, 3.0, -0.2, 5.0, -0.10, 0.0, M['floor'], 0.02)
    box('floor_strip', -1.6, -1.4, 0.0, 5.0, 0.0, 0.005, M['teal'])
    box('wall_back', -3.0, 3.0, 4.8, 5.0, 0.0, 2.9, M['wall'], 0.03)
    box('wall_l', -3.2, -3.0, -0.2, 5.0, 0.0, 2.9, M['wall2'], 0.03)
    box('wall_r', 3.0, 3.2, -0.2, 5.0, 0.0, 2.9, M['wall2'], 0.03)
    box('ceil', -3.2, 3.2, -0.2, 5.0, 2.9, 3.0, M['wall2'], 0.02)

    # рёбра-шпангоуты на задней стене
    for i, x in enumerate((-2.2, -0.4, 1.4)):
        box(f'rib_{i}', x, x + 0.12, 4.70, 4.80, 0.0, 2.9, M['metal'], 0.02)
    # иллюминатор: рама + стекло + космос
    box('win_frame', -1.05, 0.55, 4.72, 4.80, 0.95, 2.25, M['metal'], 0.06)
    box('win_glass', -0.98, 0.48, 4.74, 4.78, 1.02, 2.18, M['glass'], 0.03)
    box('win_space', -1.00, 0.50, 4.79, 4.80, 1.00, 2.20, M['space'])
    box('win_sill', -1.12, 0.62, 4.66, 4.76, 0.90, 0.96, M['metal'], 0.02)

    # капсула
    cyl('cap_base', 1.85, 3.55, 0.0, 0.18, 0.62, M['metal'])
    cyl('cap_body', 1.85, 3.55, 0.18, 2.30, 0.55, M['glass'])
    cyl('cap_top', 1.85, 3.55, 2.30, 2.46, 0.62, M['metal'])
    cyl('cap_band', 1.85, 3.55, 1.15, 1.32, 0.565, M['metal'])

    # пульт на стене и трубы под потолком
    box('console', -2.85, -2.55, 1.2, 1.32, 1.05, 1.55, M['metal'], 0.03)
    box('console_scr', -2.80, -2.60, 1.19, 1.20, 1.15, 1.45, M['teal'])
    box('console_amber', -2.80, -2.66, 1.19, 1.20, 1.02, 1.06, M['amber'])
    for i, y in enumerate((0.6, 3.2)):
        cyl(f'pipe_{i}', 0.0, y, 2.62, 2.62, 0.001, M['metal'])
        bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=5.6, vertices=20,
                                            location=(0.0, y, 2.66),
                                            rotation=(0, math.radians(90), 0))
        o = bpy.context.object
        o.data.materials.append(M['metal'])
    # лампа-полоса в потолке
    box('ceiling_light', -1.8, 1.8, 2.05, 2.30, 2.88, 2.892, M['teal'])
    box('light_lip_l', -1.86, -1.80, 2.0, 2.35, 2.86, 2.895, M['metal'])
    box('light_lip_r', 1.80, 1.86, 2.0, 2.35, 2.86, 2.895, M['metal'])

    # шкафчик сбоку
    box('locker', 2.35, 2.95, 4.30, 4.80, 0.0, 1.90, M['wall'], 0.03)
    box('locker_gap', 2.63, 2.67, 4.28, 4.30, 0.05, 1.85, M['dark'])
    box('locker_scr', 2.45, 2.60, 4.27, 4.29, 1.25, 1.55, M['amber'])


def add_outline(mat, thickness=0.008):
    for o in sc.objects:
        if o.type != 'MESH' or o.name.startswith('win_space'):
            continue
        o.data.materials.append(mat)
        md = o.modifiers.new('ink', 'SOLIDIFY')
        md.thickness = -thickness
        md.offset = 1.0
        md.use_flip_normals = True
        md.use_rim = False
        md.material_offset = len(o.material_slots) - 1


def ink_material():
    m = bpy.data.materials.new('ink')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (0.05, 0.06, 0.11, 1)
    em.inputs['Strength'].default_value = 1.0
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m


def lights():
    d = bpy.data.lights.new('sun', 'SUN')
    d.energy = 1.05
    d.angle = math.radians(8)
    o = bpy.data.objects.new('sun', d)
    o.rotation_euler = (math.radians(48), 0, math.radians(-32))
    sc.collection.objects.link(o)
    d2 = bpy.data.lights.new('fill', 'SUN')
    d2.energy = 0.35
    d2.color = (0.75, 0.85, 1.0)
    o2 = bpy.data.objects.new('fill', d2)
    o2.rotation_euler = (math.radians(70), 0, math.radians(150))
    sc.collection.objects.link(o2)
    w = sc.world or bpy.data.worlds.new('W')
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (0.30, 0.34, 0.46, 1)
    bg.inputs['Strength'].default_value = 0.40


def camera():
    cd = bpy.data.cameras.new('cam')
    cd.lens = 28
    c = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(c)
    c.location = (-0.7, -3.9, 1.52)
    c.rotation_euler = (math.radians(87), 0, math.radians(-7))
    sc.camera = c


def glaze(threshold, size):
    sc.use_nodes = True
    nt = sc.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new('CompositorNodeRLayers')
    gl = nt.nodes.new('CompositorNodeGlare')
    gl.glare_type = 'BLOOM'
    gl.quality = 'HIGH'
    gl.threshold = threshold
    gl.size = size
    cp = nt.nodes.new('CompositorNodeComposite')
    nt.links.new(rl.outputs['Image'], gl.inputs['Image'])
    nt.links.new(gl.outputs['Image'], cp.inputs['Image'])


def render(name, exposure=0.0, res=(1680, 900)):
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.eevee.taa_render_samples = 48
    sc.eevee.use_raytracing = False
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = exposure
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('RENDERED', name)


def clear_scene():
    for o in list(sc.objects):
        if o.type == 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)


def run(variant, name, outline=False, exposure=0.0, bloom=(1.2, 4)):
    clear_scene()
    M = build_materials(variant)
    build_scene(M)
    for o in sc.objects:
        if o.type == 'MESH' and o.name.startswith('win_space'):
            continue
    if outline:
        add_outline(ink_material(), 0.007 if variant != 'b' else 0.005)
    glaze(*bloom)
    render(name, exposure)


lights()
camera()
run('b', 'anime_station_b.png', outline=False, exposure=-0.05, bloom=(1.15, 5))
run('c', 'anime_station_c.png', outline=False, exposure=-0.15, bloom=(1.3, 4))
print('DONE')
