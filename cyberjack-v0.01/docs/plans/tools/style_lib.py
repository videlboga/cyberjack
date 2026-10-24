"""Общий визуальный язык лаборатории: материалы, палитра, правила геометрии.

Материалы процедурные: чистый клинический вид без фото-грязи. CC0-текстуры
Poly Haven для этого не подходят (все обветренные), поэтому поверх палитры
добавляется только мелкое процедурное зерно + HDR для отражений.

Использование:
    from style_lib import Style
    S = Style()
    S.world(sc)                      # HDR-окружение для отражений
    S.apply(obj, 'panel')            # повесить материал
"""
import bpy, os, math

ROOT = '/home/cyberkitty/Projects/cyberjack/assets/cc0'
HDR = os.path.join(ROOT, 'hdr')

# --- палитра (линейные 0..1) ------------------------------------------------
PALETTE = {
    'panel':      (0.870, 0.880, 0.872),   # основной белый панелей
    'panel_dim':  (0.640, 0.660, 0.650),   # утопленные плоскости, ниши
    'seam':       (0.190, 0.210, 0.210),   # швы, зазоры, кладка под панелями
    'plinth':     (0.230, 0.240, 0.235),   # цоколь
    'floor':      (0.900, 0.905, 0.900),
    'grout':      (0.520, 0.540, 0.530),
    'ceiling':    (0.900, 0.905, 0.900),
    'accent':     (0.360, 0.550, 0.510),   # минтовая полоса и экраны
    'soft':       (0.520, 0.570, 0.545),   # обивка: матрас, сиденья
    'steel':      (0.720, 0.740, 0.740),
    'dark':       (0.120, 0.130, 0.130),
    'light':      (0.960, 0.955, 0.930),   # светящиеся полотна
    'glass':      (0.780, 0.880, 0.890),
}

# --- правила геометрии ------------------------------------------------------
GEO = {
    'panel_grid': 0.60,      # шаг панелей по стене и потолку
    'panel_seam': 0.02,      # шов между панелями
    'panel_depth': 0.02,     # толщина панели над кладкой
    'plinth_h': 0.09,        # высота плинтуса
    'stripe_z': 1.15,        # низ минтовой полосы
    'stripe_h': 0.12,        # высота полосы
    'kick_h': 0.10,          # цоколь мебели
    'radius_furniture': 0.06,
    'radius_mattress': 0.07,
    'radius_screen': 0.03,
    'radius_edge': 0.004,
    'door_w': 1.30,
    'door_h': 2.25,
    'door_corner': 0.20,
    'niche_depth': 0.58,
    'ceiling_h': 2.75,
}

# материал: (цвет, roughness, metallic, зерно[scale], зерно[bump], пропускание)
MATERIALS = {
    'panel':     (PALETTE['panel'], 0.48, 0.0, 90.0, 0.010, 0.0),
    'panel_dim': (PALETTE['panel_dim'], 0.62, 0.0, 70.0, 0.012, 0.0),
    'floor':     (PALETTE['floor'], 0.055, 0.0, 140.0, 0.004, 0.0),
    'ceiling':   (PALETTE['ceiling'], 0.70, 0.0, 60.0, 0.008, 0.0),
    'soft':      (PALETTE['soft'], 0.78, 0.0, 220.0, 0.030, 0.0),
    'steel':     (PALETTE['steel'], 0.30, 0.85, 300.0, 0.006, 0.0),
    'kick':      (PALETTE['plinth'], 0.52, 0.0, 120.0, 0.010, 0.0),
    'seam':      (PALETTE['seam'], 0.80, 0.0, 0.0, 0.0, 0.0),
    'accent':    (PALETTE['accent'], 0.32, 0.0, 0.0, 0.0, 0.0),
    'dark':      (PALETTE['dark'], 0.50, 0.0, 0.0, 0.0, 0.0),
    'light':     (PALETTE['light'], 0.40, 0.0, 0.0, 0.0, 0.0),
    'glass':     (PALETTE['glass'], 0.06, 0.0, 0.0, 0.0, 0.90),
}


class Style:
    def __init__(self):
        self.M = {}
        for name, spec in MATERIALS.items():
            self.M[name] = self._mat(f'lab_{name}', *spec)

    def _mat(self, name, color, rough, metal, noise_scale, bump, transmission):
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        bsdf = nt.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (*color, 1)
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Metallic'].default_value = metal
        if transmission:
            bsdf.inputs['Transmission Weight'].default_value = transmission
            bsdf.inputs['IOR'].default_value = 1.45
            m.blend_method = 'BLEND'
        if name.endswith('light'):
            bsdf.inputs['Emission Color'].default_value = (1.0, 0.975, 0.94, 1)
            bsdf.inputs['Emission Strength'].default_value = 2.2
        if noise_scale > 0 and bump > 0:
            tex = nt.nodes.new('ShaderNodeTexNoise')
            tex.inputs['Scale'].default_value = noise_scale
            tex.inputs['Detail'].default_value = 4.0
            tex.inputs['Roughness'].default_value = 0.55
            tex.location = (-620, -260)
            bmp = nt.nodes.new('ShaderNodeBump')
            bmp.inputs['Strength'].default_value = bump
            bmp.inputs['Distance'].default_value = 0.02
            bmp.location = (-360, -260)
            nt.links.new(tex.outputs['Fac'], bmp.inputs['Height'])
            nt.links.new(bmp.outputs['Normal'], bsdf.inputs['Normal'])
            # микро-разброс цвета: убирает «пластиковую» однотонность
            rnd = nt.nodes.new('ShaderNodeTexNoise')
            rnd.inputs['Scale'].default_value = noise_scale * 0.22
            rnd.inputs['Detail'].default_value = 2.0
            rnd.location = (-620, 200)
            mix = nt.nodes.new('ShaderNodeMixRGB')
            mix.blend_type = 'MIX'
            mix.inputs['Fac'].default_value = 0.06
            mix.inputs['Color1'].default_value = (*color, 1)
            mix.inputs['Color2'].default_value = (min(1, color[0] * 1.12),
                                                  min(1, color[1] * 1.12),
                                                  min(1, color[2] * 1.12), 1)
            mix.location = (-380, 200)
            nt.links.new(rnd.outputs['Fac'], mix.inputs['Fac'])
            nt.links.new(mix.outputs['Color'], bsdf.inputs['Base Color'])
        return m

    def world(self, sc, hdr='studio_small_09', strength=0.55, bg=(0.055, 0.060, 0.065)):
        """HDR-окружение: мягкие отражения на панелях, полу и стекле."""
        w = sc.world or bpy.data.worlds.new('W')
        sc.world = w
        w.use_nodes = True
        nt = w.node_tree
        nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputWorld')
        mix = nt.nodes.new('ShaderNodeMixShader')
        bg_node = nt.nodes.new('ShaderNodeBackground')
        bg_node.inputs['Color'].default_value = (*bg, 1)
        bg_node.inputs['Strength'].default_value = 1.0
        path = os.path.join(HDR, f'{hdr}_1k.hdr')
        if os.path.exists(path):
            env = nt.nodes.new('ShaderNodeTexEnvironment')
            env.image = bpy.data.images.load(path, check_existing=True)
            env_bg = nt.nodes.new('ShaderNodeBackground')
            env_bg.inputs['Strength'].default_value = strength
            nt.links.new(env.outputs['Color'], env_bg.inputs['Color'])
            nt.links.new(env_bg.outputs['Background'], mix.inputs[1])
            mix.inputs['Fac'].default_value = 0.85
        else:
            mix.inputs['Fac'].default_value = 0.0
        nt.links.new(bg_node.outputs['Background'], mix.inputs[2])
        nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
        return w

    def apply(self, obj, key):
        obj.data.materials.clear()
        obj.data.materials.append(self.M[key])
        return obj


def area(sc, name, loc, size, power, rot=(0, 0, 0), color=(1.0, 0.97, 0.93)):
    """Площадной светильник единой схемы: ключ / заливка / контровой / ниши."""
    d = bpy.data.lights.new(name, 'AREA')
    d.size, d.size_y = size
    d.energy = power
    d.color = color
    o = bpy.data.objects.new(name, d)
    o.location = loc
    o.rotation_euler = rot
    sc.collection.objects.link(o)
    return o
