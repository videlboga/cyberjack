"""Инк-пайплайн лаборатории: белая заливка, тонкие линии, серые тени.

Стиль снят с рефа `public/backgrounds/laboratory/sex_machine.png`:
почти монохром (белый #EEF1F2 → серый #9CA4A9), контраст свет/тень 0.09,
линии по каждой кромке, цвет только в экранах и мелких приборах.

Использование:
    from ink_lib import Ink
    I = Ink(); I.build()
    I.lights(sc); I.render_setup(sc); I.ink(sc)
    I.apply(obj, 'wall')
"""
import bpy, math, os
from mathutils import Vector

# палитра снята с рефа (значения и доли — docs/plans/visual-language.md)
INK_P = {
    'wall':   (0.965, 0.972, 0.975),   # основной белый
    'wall_c': (0.915, 0.930, 0.940),   # чуть холоднее
    'floor':  (0.950, 0.955, 0.960),
    'metal':  (0.905, 0.920, 0.930),
    'metal_d': (0.760, 0.790, 0.810),
    'dark':   (0.330, 0.360, 0.395),   # тёмные корпуса, ручки
    'mid':    (0.615, 0.650, 0.675),   # серые вставки
    'soft':   (0.880, 0.900, 0.895),
    'screen': (0.760, 0.900, 0.940),   # экраны, холодная бирюза
    'cyan':   (0.640, 0.870, 0.930),   # подсветка, робот
    'pink':   (0.945, 0.560, 0.640),   # акцент: образцы, кнопки
    'orange': (0.975, 0.630, 0.310),   # акцент: колбы, метки
    'space':  (0.120, 0.150, 0.200),
}
SHADOW_TINT = (0.80, 0.82, 0.88)      # тень почти нейтральная, чуть холодная
RIM_COLOR = (1.0, 1.0, 1.0)

INK_ROLES = {
    'wall':   ('wall', 0.0, 0.0),
    'wall_c': ('wall_c', 0.0, 0.0),
    'floor':  ('floor', 0.0, 0.0),
    'metal':  ('metal', 0.0, 0.10),
    'metal_d': ('metal_d', 0.0, 0.06),
    'dark':   ('dark', 0.0, 0.0),
    'mid':    ('mid', 0.0, 0.0),
    'soft':   ('soft', 0.0, 0.0),
    'screen': ('screen', 0.85, 0.0),
    'cyan':   ('cyan', 1.10, 0.0),
    'pink':   ('pink', 0.55, 0.0),
    'orange': ('orange', 0.65, 0.0),
    'space':  ('space', 0.30, 0.0),
}


class Ink:
    def __init__(self, palette=None, roles=None, shadow=0.80, ink_color=(0.24, 0.26, 0.31)):
        self.P = palette or INK_P
        self.ROLES = roles or INK_ROLES
        self.shadow = shadow
        self.ink_color = ink_color
        self.M = {}

    def _mat(self, name, key, emit, rim):
        color = self.P[key]
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
            return m

        diff = nt.nodes.new('ShaderNodeBsdfDiffuse')
        diff.inputs['Color'].default_value = (1, 1, 1, 1)
        s2 = nt.nodes.new('ShaderNodeShaderToRGB')
        nt.links.new(diff.outputs['BSDF'], s2.inputs['Shader'])

        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.interpolation = 'EASE'
        e = ramp.color_ramp.elements
        dark = tuple(min(1.0, color[i] * SHADOW_TINT[i] * self.shadow) for i in range(3))
        e[0].position, e[0].color = 0.0, (*dark, 1)
        e[1].position, e[1].color = 0.52, (*color, 1)
        nt.links.new(s2.outputs['Color'], ramp.inputs['Fac'])
        col = ramp.outputs['Color']

        # серые «размывки» в стыках — главный признак рефа
        ao = nt.nodes.new('ShaderNodeAmbientOcclusion')
        ao.inputs['Distance'].default_value = 0.35
        ao.samples = 8
        aom = nt.nodes.new('ShaderNodeMixRGB')
        aom.blend_type = 'MULTIPLY'
        aom.inputs['Fac'].default_value = 0.75
        nt.links.new(col, aom.inputs['Color1'])
        nt.links.new(ao.outputs['Color'], aom.inputs['Color2'])
        col = aom.outputs['Color']

        if rim > 0:
            lw = nt.nodes.new('ShaderNodeLayerWeight')
            lw.inputs['Blend'].default_value = 0.30
            rr = nt.nodes.new('ShaderNodeValToRGB')
            rr.color_ramp.interpolation = 'CONSTANT'
            rr.color_ramp.elements[0].position = 0.70
            rr.color_ramp.elements[0].color = (0, 0, 0, 1)
            rr.color_ramp.elements[1].position = 0.78
            rr.color_ramp.elements[1].color = (1, 1, 1, 1)
            nt.links.new(lw.outputs['Facing'], rr.inputs['Fac'])
            add = nt.nodes.new('ShaderNodeMixRGB')
            add.blend_type = 'ADD'
            add.inputs['Fac'].default_value = rim
            add.inputs['Color2'].default_value = (*RIM_COLOR, 1)
            nt.links.new(col, add.inputs['Color1'])
            nt.links.new(rr.outputs['Color'], add.inputs['Fac'])
            col = add.outputs['Color']

        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Strength'].default_value = 1.0
        nt.links.new(col, em.inputs['Color'])
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
        return m

    def build(self):
        for role, (key, emit, rim) in self.ROLES.items():
            self.M[role] = self._mat(f'ink_{role}', key, emit, rim)
        return self.M

    def apply(self, obj, role):
        obj.data.materials.clear()
        obj.data.materials.append(self.M[role])
        return obj

    @staticmethod
    def screen_ui(name='ink_screen_ui'):
        """Экран с UI: светлый фон + тонкие голубые строки."""
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        em = nt.nodes.new('ShaderNodeEmission')
        tc = nt.nodes.new('ShaderNodeTexCoord')
        wave = nt.nodes.new('ShaderNodeTexWave')
        wave.wave_type = 'BANDS'
        wave.bands_direction = 'X'
        wave.inputs['Scale'].default_value = 34.0
        wave.inputs['Distortion'].default_value = 0.0
        nt.links.new(tc.outputs['Generated'], wave.inputs['Vector'])
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.interpolation = 'CONSTANT'
        ramp.color_ramp.elements[0].position = 0.0
        ramp.color_ramp.elements[0].color = (0.94, 0.97, 0.99, 1)
        ramp.color_ramp.elements[1].position = 0.58
        ramp.color_ramp.elements[1].color = (0.62, 0.82, 0.90, 1)
        nt.links.new(wave.outputs['Fac'], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
        em.inputs['Strength'].default_value = 0.70
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
        return m

    # --- свет ---------------------------------------------------------------
    @staticmethod
    def lights(sc, key=1.25, fill=0.55, ambient=0.55,
               key_vec=(0.30, 0.75, -0.60), fill_vec=(-0.50, -0.70, -0.25)):
        def sun(name, energy, vec, color):
            d = bpy.data.lights.new(name, 'SUN')
            d.energy = energy
            d.color = color
            d.angle = math.radians(6)
            d.use_shadow = False
            o = bpy.data.objects.new(name, d)
            o.rotation_euler = Vector(vec).normalized().to_track_quat('-Z', 'Y').to_euler()
            sc.collection.objects.link(o)
        sun('ink_key', key, key_vec, (1.0, 0.99, 0.97))
        sun('ink_fill', fill, fill_vec, (0.86, 0.92, 1.0))
        w = sc.world or bpy.data.worlds.new('W')
        sc.world = w
        w.use_nodes = True
        bg = w.node_tree.nodes.get('Background')
        bg.inputs['Color'].default_value = (0.72, 0.76, 0.80, 1)
        bg.inputs['Strength'].default_value = ambient

    # --- линии ---------------------------------------------------------------
    @staticmethod
    def ink(sc, thickness=1.35, crease=True, angle=152):
        r = sc.render
        r.use_freestyle = True
        r.line_thickness_mode = 'ABSOLUTE'
        r.line_thickness = thickness
        vl = sc.view_layers[0]
        vl.use_freestyle = True
        fs = vl.freestyle_settings
        fs.crease_angle = math.radians(angle)
        ls = fs.linesets[0] if fs.linesets else fs.linesets.new('ink')
        ls.select_silhouette = True
        ls.select_border = True
        ls.select_crease = crease
        ls.select_contour = True
        ls.select_external_contour = False
        ls.select_edge_mark = False
        style = bpy.data.linestyles.get('ink_style') or bpy.data.linestyles.new('ink_style')
        style.color = (0.24, 0.26, 0.31)
        style.thickness = max(1.0, thickness)
        style.caps = 'ROUND'
        ls.linestyle = style

    @staticmethod
    def render_setup(sc, res=(1680, 940), samples=32, exposure=0.0, bloom=(1.6, 3)):
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
        gl.glare_type = 'FOG_GLOW'
        gl.quality = 'HIGH'
        gl.threshold = bloom[0]
        gl.size = bloom[1]
        cp = nt.nodes.new('CompositorNodeComposite')
        nt.links.new(rl.outputs['Image'], gl.inputs['Image'])
        nt.links.new(gl.outputs['Image'], cp.inputs['Image'])
