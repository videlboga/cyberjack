import bpy,json
from pathlib import Path
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'BUNDLE_ROOT').exists())
O=(ROOT/'characters/kai/build')
for i in range(4):
 p=O/f'Kai_outfit_{i:02}.blend';bpy.ops.wm.open_mainfile(filepath=str(p));arm=next(o for o in bpy.data.objects if o.type=='ARMATURE');s=arm.data.vrm_addon_extension.spring_bone1.springs
 for n in reversed(range(len(s))):
  if i and s[n].vrm_name.startswith('cf_j_sk_'):s.remove(n)
 for m in bpy.data.materials:
  if any(x in m.name for x in ['c_m_shadowcast','c_m_silhouette']):
   mt=m.vrm_addon_extension.mtoon1;mt.enabled=True;mt.alpha_mode='BLEND';mt.pbr_metallic_roughness.base_color_texture.index.source=None;mt.pbr_metallic_roughness.base_color_factor=(0,0,0,0);mt.extensions.vrmc_materials_mtoon.outline_width_mode='none'
 bpy.ops.wm.save_as_mainfile(filepath=str(p))
print('OUTFIT_PHYSICS_FIXED')
