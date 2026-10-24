"""Тест аниме-подачи на готовой комнате: три варианта стиля.

Открывает blockout/room_cell.blend, переводит все материалы в toon-схему
(Shader to RGB + ColorRamp), при необходимости добавляет контур (inverted hull),
ставит Glare в композитор и рендерит три варианта:

  anime_a.png — cel-shading + чёрный контур (аниме-сериал)
  anime_b.png — мягкая живописная заливка без контура, сильное свечение
                (аниме-фон, «Синкай»)
  anime_c.png — cel без контура + сильный контровой свет (игровой toon)

Запуск: blender -b blockout/room_cell.blend -noaudio --python tools/anime_test.py
"""
import bpy, sys, os, math

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'

sc = bpy.context.scene

# --- палитра аниме-станции ---------------------------------------------------
WARM = (1.00, 0.97, 0.92)      # белые поверхности, тёплые
SHADOW = (0.40, 0.47, 0.62)    # тени уходят в сине-фиолетовый
TEAL = (0.20, 0.85, 0.78)      # акцент: минт/бирюза, светится
AMBER = (1.00, 0.62, 0.25)     # второй акцент: аварийные метки
DARK = (0.12, 0.14, 0.20)


def base_color(mat):
    if not mat or not mat.use_nodes:
        return (0.8, 0.8, 0.8)
    b = mat.node_tree.nodes.get('Principled BSDF')
    if not b:
        return (0.8, 0.8, 0.8)
    c = b.inputs['Base Color'].default_value
    return (c[0], c[1], c[2])


def is_light(mat):
    return bool(mat) and ('light' in mat.name or 'accent' in mat.name)


def toon_material(src_mat, steps=3, soft=False, rim=0.35):
    """Плоская заливка: diffuse -> shader to rgb -> ramp -> цвет + контровой."""
    name = f'toon_{src_mat.name if src_mat else "default"}'
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    col = base_color(src_mat)

    diff = nt.nodes.new('ShaderNodeBsdfDiffuse')
    diff.inputs['Color'].default_value = (1, 1, 1, 1)
    s2rgb = nt.nodes.new('ShaderNodeShaderToRGB')
    nt.links.new(diff.outputs['BSDF'], s2rgb.inputs['Shader'])

    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'EASE' if soft else 'CONSTANT'
    e = ramp.color_ramp.elements
    # тона: тень 0.42, полутон 0.72, свет 1.0 — плоско, но читаемо
    e[0].position, e[0].color = 0.0, (0.32, 0.32, 0.32, 1)
    e[1].position, e[1].color = 0.62 if soft else 0.50, (1, 1, 1, 1)
    if not soft:
        el = e.new(0.30)
        el.color = (0.72, 0.72, 0.72, 1)
    nt.links.new(s2rgb.outputs['Color'], ramp.inputs['Fac'])

    # цвет: тень уходит в сине-фиолетовый, свет — в тёплый белый
    mix_sh = nt.nodes.new('ShaderNodeMixRGB')
    mix_sh.blend_type = 'MIX'
    mix_sh.inputs['Color1'].default_value = (SHADOW[0] * col[0] + col[0] * 0.25,
                                             SHADOW[1] * col[1] + col[1] * 0.25,
                                             SHADOW[2] * col[2] + col[2] * 0.25, 1)
    mix_sh.inputs['Color2'].default_value = (min(1, col[0] * WARM[0]),
                                             min(1, col[1] * WARM[1]),
                                             min(1, col[2] * WARM[2]), 1)
    nt.links.new(ramp.outputs['Color'], mix_sh.inputs['Fac'])

    # контровой: тонкая светлая кромка по силуэту
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.35
    rim_ramp = nt.nodes.new('ShaderNodeValToRGB')
    rim_ramp.color_ramp.interpolation = 'CONSTANT'
    rim_ramp.color_ramp.elements[0].position = 0.72
    rim_ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    rim_ramp.color_ramp.elements[1].position = 0.80
    rim_ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    nt.links.new(lw.outputs['Facing'], rim_ramp.inputs['Fac'])
    rim_mix = nt.nodes.new('ShaderNodeMixRGB')
    rim_mix.blend_type = 'SCREEN'
    rim_mix.inputs['Fac'].default_value = rim
    nt.links.new(mix_sh.outputs['Color'], rim_mix.inputs['Color1'])
    rim_mix.inputs['Color2'].default_value = (0.55, 0.75, 1.0, 1)
    nt.links.new(rim_ramp.outputs['Color'], rim_mix.inputs['Fac'])

    emis = nt.nodes.new('ShaderNodeEmission')
    emis.inputs['Strength'].default_value = 1.0
    nt.links.new(rim_mix.outputs['Color'], emis.inputs['Color'])
    nt.links.new(emis.outputs['Emission'], out.inputs['Surface'])

    # светящиеся элементы: чистый emissive, без рампы
    if is_light(src_mat):
        for n in list(nt.nodes):
            if n.type in {'BSDF_DIFFUSE', 'SHADER_TO_RGB', 'VALTORGB', 'MIX_RGB', 'LAYER_WEIGHT'}:
                nt.nodes.remove(n)
        em2 = nt.nodes.new('ShaderNodeEmission')
        tint = TEAL if 'accent' in (src_mat.name or '') else (1.0, 0.98, 0.94)
        em2.inputs['Color'].default_value = (*tint, 1)
        em2.inputs['Strength'].default_value = 1.6 if 'accent' in src_mat.name else 1.25
        nt.links.new(em2.outputs['Emission'], out.inputs['Surface'])
    return m


def convert_scene(soft=False):
    cache = {}
    for o in sc.objects:
        if o.type != 'MESH':
            continue
        for slot in o.material_slots:
            src = slot.material
            key = src.name if src else 'none'
            if key not in cache:
                cache[key] = toon_material(src, soft=soft)
            slot.material = cache[key]
    return cache


def add_outline(thickness=0.010):
    om = bpy.data.materials.get('toon_outline')
    if not om:
        om = bpy.data.materials.new('toon_outline')
        om.use_nodes = True
        nt = om.node_tree
        nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = (0.045, 0.055, 0.085, 1)
        em.inputs['Strength'].default_value = 1.0
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    for o in sc.objects:
        if o.type != 'MESH':
            continue
        if any(m.type == 'SOLIDIFY' and m.name == 'toon_line' for m in o.modifiers):
            continue
        o.data.materials.append(om)
        mod = o.modifiers.new('toon_line', 'SOLIDIFY')
        mod.thickness = -thickness
        mod.offset = 1.0
        mod.use_flip_normals = True
        mod.use_rim = False
        mod.material_offset = len(o.material_slots) - 1


def remove_outline():
    for o in sc.objects:
        if o.type != 'MESH':
            continue
        for m in [m for m in o.modifiers if m.name == 'toon_line']:
            o.modifiers.remove(m)


def glaze(threshold=1.0, size=7):
    sc.use_nodes = True
    nt = sc.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new('CompositorNodeRLayers')
    gl = nt.nodes.new('CompositorNodeGlare')
    gl.glare_type = 'BLOOM' if hasattr(gl, 'glare_type') else 'FOG_GLOW'
    gl.quality = 'HIGH'
    gl.threshold = threshold
    gl.size = size
    comp = nt.nodes.new('CompositorNodeComposite')
    nt.links.new(rl.outputs['Image'], gl.inputs['Image'])
    nt.links.new(gl.outputs['Image'], comp.inputs['Image'])


def dim_lights(k=0.18):
    for o in sc.objects:
        if o.type == 'LIGHT':
            o.data.energy *= k


def setup_render(res=(1680, 860), exposure=0.0):
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.eevee.taa_render_samples = 48
    sc.eevee.use_raytracing = False
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = exposure


def render(name):
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('RENDERED', name)


CAM = bpy.data.objects.get('Camera')
if CAM is None:
    cams = [o for o in sc.objects if o.type == 'CAMERA']
    CAM = cams[0] if cams else None
if CAM:
    CAM.data.type = 'PERSP'
    CAM.data.lens = 18
    CAM.location = (0.0, -2.35, 1.55)
    CAM.rotation_euler = (math.radians(88), 0, 0)
    sc.camera = CAM

dim_lights(0.16)

# A: cel + контур
convert_scene(soft=False)
add_outline(0.004)
glaze(1.4, 4)
setup_render(exposure=0.0)
render('anime_a.png')

# B: мягкая живописная заливка, без контура, сильный bloom
remove_outline()
convert_scene(soft=True)
glaze(1.6, 5)
setup_render(exposure=0.0)
render('anime_b.png')

# C: cel без контура
convert_scene(soft=False)
glaze(1.5, 4)
setup_render(exposure=0.0)
render('anime_c.png')
print('DONE')
