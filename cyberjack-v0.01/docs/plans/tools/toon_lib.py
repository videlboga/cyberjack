"""Toon-пайплайн лаборатории: cel-шейдинг, инк-контур, аниме-палитра станции.

Рассчитан на EEVEE Next + Freestyle. Материалы плоские (2–3 тона), свет — один
ключевой sun + заливка, контур — линии Freestyle по силуэту и изломам.

Использование:
    from toon_lib import Toon
    T = Toon()
    T.build()                 # материалы в T.M
    T.lights(sc)              # свет
    T.render_setup(sc, outline=True)
    T.apply(obj, 'wall')
"""
import bpy, math, os
from mathutils import Vector

# --- палитра: аниме-станция (Genshin/HSR-подобная) ---------------------------
P = {
    'wall':    (0.92, 0.88, 0.80),   # тёплый кремовый пластик
    'wall_hi': (0.99, 0.97, 0.92),   # верхняя подсвеченная панель
    'wall_c':  (0.78, 0.81, 0.87),   # холодная вставка
    'floor':   (0.90, 0.88, 0.84),
    'floor_d': (0.56, 0.58, 0.62),   # тёмный пол для контраста с белыми стенами
    'metal':   (0.70, 0.76, 0.86),   # шпангоуты, рамки, трубы
    'metal_d': (0.44, 0.48, 0.60),
    'dark':    (0.15, 0.17, 0.24),   # пазы, ручки, тени-детали
    'teal':    (0.14, 0.78, 0.70),   # основной акцент, светится
    'cyan':    (0.45, 0.93, 1.00),   # иллюминатор, голограммы
    'amber':   (1.00, 0.62, 0.20),   # предупреждающие метки
    'rose':    (1.00, 0.55, 0.62),   # редкий второй акцент (аниме-контраст)
    'soft':    (0.66, 0.78, 0.76),   # обивка
    'glass':   (0.58, 0.88, 0.94),   # стекло капсул: плоский циан с контровым
    'space':   (0.04, 0.06, 0.14),
}
# тень уходит в сине-фиолетовый — главный признак аниме-подачи
SHADOW_TINT = (0.70, 0.68, 0.86)
RIM_COLOR = (0.80, 0.95, 1.00)

# роль -> (цвет, тона, свечение, контровой)
ROLES = {
    'wall':    ('wall', 2, 0.0, 0.10),
    'wall_c':  ('wall_c', 2, 0.0, 0.10),
    'floor':   ('floor', 2, 0.0, 0.06),
    'floor_d': ('floor_d', 2, 0.0, 0.08),
    'metal':   ('metal', 3, 0.0, 0.35),
    'metal_d': ('metal_d', 2, 0.0, 0.30),
    'dark':    ('dark', 2, 0.0, 0.25),
    'soft':    ('soft', 2, 0.0, 0.15),
    'teal':    ('teal', 0, 1.9, 0.0),
    'cyan':    ('cyan', 0, 1.6, 0.0),
    'amber':   ('amber', 0, 1.3, 0.0),
    'rose':    ('rose', 0, 1.2, 0.0),
    'space':   ('space', 0, 0.65, 0.0),
    'glass':   ('glass', 2, 0.0, 0.75),
}


class Toon:
    def __init__(self, shadow=0.50, ink=(0.09, 0.09, 0.16)):
        self.shadow = shadow
        self.ink = ink
        self.M = {}

    def _mat(self, name, key, tones, emit, rim):
        color = P[key]
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')

        if emit > 0:
            em = nt.nodes.new('ShaderNodeEmission')
            em.inputs['Color'].default_value = (*color, 1)
            em.inputs['Strength'].default_value = emit
            nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
            m['toon_role'] = 'emissive'
            return m

        diff = nt.nodes.new('ShaderNodeBsdfDiffuse')
        diff.inputs['Color'].default_value = (1, 1, 1, 1)
        s2 = nt.nodes.new('ShaderNodeShaderToRGB')
        nt.links.new(diff.outputs['BSDF'], s2.inputs['Shader'])

        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.interpolation = 'EASE'      # мягкая граница тонов, не «вырубка»
        e = ramp.color_ramp.elements
        dark = tuple(min(1.0, color[i] * SHADOW_TINT[i] * self.shadow) for i in range(3))
        mid = tuple(min(1.0, color[i] * (SHADOW_TINT[i] ** 0.45) * 0.74) for i in range(3))
        e[0].position, e[0].color = 0.0, (*dark, 1)
        e[1].position, e[1].color = 0.46, (*color, 1)
        em_ = e.new(0.34)
        em_.color = (*mid, 1)
        nt.links.new(s2.outputs['Color'], ramp.inputs['Fac'])
        col_out = ramp.outputs['Color']
        # AO: тёмные стыки и углы — то, что отличает аниме-рендер от мультика
        ao = nt.nodes.new('ShaderNodeAmbientOcclusion')
        ao.inputs['Distance'].default_value = 0.55
        ao.samples = 8
        ao_mix = nt.nodes.new('ShaderNodeMixRGB')
        ao_mix.blend_type = 'MULTIPLY'
        ao_mix.inputs['Fac'].default_value = 0.8
        nt.links.new(col_out, ao_mix.inputs['Color1'])
        nt.links.new(ao.outputs['Color'], ao_mix.inputs['Color2'])
        col_out = ao_mix.outputs['Color']

        if rim > 0:
            lw = nt.nodes.new('ShaderNodeLayerWeight')
            lw.inputs['Blend'].default_value = 0.28
            rr = nt.nodes.new('ShaderNodeValToRGB')
            rr.color_ramp.interpolation = 'CONSTANT'
            rr.color_ramp.elements[0].position = 0.66
            rr.color_ramp.elements[0].color = (0, 0, 0, 1)
            rr.color_ramp.elements[1].position = 0.74
            rr.color_ramp.elements[1].color = (1, 1, 1, 1)
            nt.links.new(lw.outputs['Facing'], rr.inputs['Fac'])
            add = nt.nodes.new('ShaderNodeMixRGB')
            add.blend_type = 'ADD'
            add.inputs['Fac'].default_value = rim
            add.inputs['Color2'].default_value = (*RIM_COLOR, 1)
            nt.links.new(col_out, add.inputs['Color1'])
            nt.links.new(rr.outputs['Color'], add.inputs['Fac'])
            col_out = add.outputs['Color']

        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Strength'].default_value = 1.0
        nt.links.new(col_out, em.inputs['Color'])
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
        m['toon_role'] = 'flat'
        return m

    def build(self):
        for role, (key, tones, emit, rim) in ROLES.items():
            self.M[role] = self._mat(f'toon_{role}', key, tones, emit, rim)
        self.M['ink'] = self._ink()
        return self.M

    def _ink(self):
        m = bpy.data.materials.get('toon_ink') or bpy.data.materials.new('toon_ink')
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = (*self.ink, 1)
        em.inputs['Strength'].default_value = 1.0
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
        return m

    def apply(self, obj, role):
        obj.data.materials.clear()
        obj.data.materials.append(self.M[role])
        return obj

    # --- свет ---------------------------------------------------------------
    @staticmethod
    def lights(sc, key=1.05, fill=0.30, ambient=0.26,
               key_vec=(0.35, 0.85, -0.55), fill_vec=(-0.45, -0.75, -0.30)):
        """Свет задаётся НАПРАВЛЕНИЕМ луча (куда светит), а не углами Эйлера."""
        def sun(name, energy, vec, color):
            d = bpy.data.lights.new(name, 'SUN')
            d.energy = energy
            d.color = color
            d.angle = math.radians(2)
            d.use_shadow = False      # для cel важна ориентация, а не перекрытия
            o = bpy.data.objects.new(name, d)
            o.rotation_euler = Vector(vec).normalized().to_track_quat('-Z', 'Y').to_euler()
            sc.collection.objects.link(o)
            return o
        sun('toon_key', key, key_vec, (1.0, 0.97, 0.90))
        sun('toon_fill', fill, fill_vec, (0.70, 0.82, 1.0))
        w = sc.world or bpy.data.worlds.new('W')
        sc.world = w
        w.use_nodes = True
        bg = w.node_tree.nodes.get('Background')
        bg.inputs['Color'].default_value = (0.26, 0.30, 0.44, 1)
        bg.inputs['Strength'].default_value = ambient

    # --- контур и рендер -----------------------------------------------------
    @staticmethod
    def freestyle(sc, thickness=1.35):
        """Инк-контур линиями: силуэт, границы объектов, изломы."""
        r = sc.render
        r.use_freestyle = True
        r.line_thickness_mode = 'ABSOLUTE'
        r.line_thickness = thickness
        vl = sc.view_layers[0]
        vl.use_freestyle = True
        fs = vl.freestyle_settings
        fs.crease_angle = math.radians(128)
        ls = fs.linesets[0] if fs.linesets else fs.linesets.new('ink')
        ls.select_silhouette = True
        ls.select_border = True
        ls.select_crease = False
        ls.select_edge_mark = False
        ls.select_contour = True
        style = bpy.data.linestyles.get('toon_ink_style') or bpy.data.linestyles.new('toon_ink_style')
        style.color = (0.13, 0.13, 0.20)
        style.thickness = max(1.0, thickness)
        ls.linestyle = style

    @staticmethod
    def outline_hull(sc, thickness=0.008, skip_prefix=()):
        """Запасной контур: inverted hull (если Freestyle не годится)."""
        mat = bpy.data.materials.get('toon_ink')
        if not mat:
            return
        for o in sc.objects:
            if o.type != 'MESH' or any(o.name.startswith(p) for p in skip_prefix):
                continue
            o.data.materials.append(mat)
            md = o.modifiers.new('ink', 'SOLIDIFY')
            md.thickness = -thickness
            md.offset = 1.0
            md.use_flip_normals = True
            md.use_rim = False
            md.material_offset = len(o.material_slots) - 1

    @staticmethod
    def render_setup(sc, res=(1680, 940), samples=32, exposure=0.0, bloom=(1.05, 4)):
        sc.render.engine = 'BLENDER_EEVEE_NEXT'
        sc.render.resolution_x, sc.render.resolution_y = res
        sc.eevee.taa_render_samples = samples
        sc.eevee.use_raytracing = True
        sc.view_settings.view_transform = 'Standard'
        sc.view_settings.look = 'None'
        sc.view_settings.exposure = exposure
        sc.use_nodes = True
        nt = sc.node_tree
        nt.nodes.clear()
        rl = nt.nodes.new('CompositorNodeRLayers')
        gl = nt.nodes.new('CompositorNodeGlare')
        gl.glare_type = 'BLOOM'
        gl.quality = 'HIGH'
        gl.threshold = bloom[0]
        gl.size = bloom[1]
        cp = nt.nodes.new('CompositorNodeComposite')
        nt.links.new(rl.outputs['Image'], gl.inputs['Image'])
        nt.links.new(gl.outputs['Image'], cp.inputs['Image'])
