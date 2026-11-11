import bpy
from pathlib import Path
BUNDLE=next(p for p in Path(__file__).resolve().parents if (p/"BUNDLE_ROOT").exists())
OUT=Path(__file__).resolve().parent
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.vrm');bpy.ops.wm.open_mainfile(filepath=str(OUT/'Mira_outfit_02.blend'))
mt=bpy.data.materials['KK cf_m_body'].vrm_addon_extension.mtoon1
mt.pbr_metallic_roughness.base_color_texture.index.source=bpy.data.images.load(str(OUT/'textures/mira_body_outfit02_light_outermask.png'),check_existing=True)
mt.extensions.vrmc_materials_mtoon.shade_multiply_texture.index.source=bpy.data.images.load(str(OUT/'textures/mira_body_outfit02_dark_outermask.png'),check_existing=True)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Mira_outfit_02.blend'));print('BODY_MASK_BLEND_SYNCED',flush=True)
