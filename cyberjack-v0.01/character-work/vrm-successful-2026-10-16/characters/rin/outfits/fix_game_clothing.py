import bpy,bmesh,json,io
from pathlib import Path
BUNDLE=next(p for p in Path(__file__).resolve().parents if (p/"BUNDLE_ROOT").exists())
from PIL import Image
import numpy as np
OUT=Path(__file__).resolve().parent
SRC=BUNDLE / 'inputs/exports/rin-four-outfits'
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.vrm')
def pil_image(im):return Image.open(io.BytesIO(bytes(im.packed_file.data))) if im.packed_file else Image.open(bpy.path.abspath(im.filepath))
def game_clothing_visibility():
 o=next(o for o in bpy.data.objects if o.name.startswith('Outfit 00 '))
 indices={i for i,m in enumerate(o.data.materials) if m and 'cf_m_bra_01' in m.name}
 if indices:
  hidden=o.copy();hidden.data=o.data.copy();hidden.name='Game hidden · NotBra · Outfit 00';o.users_collection[0].objects.link(hidden)
  for obj,remove_selected in [(o,True),(hidden,False)]:
   bm=bmesh.new();bm.from_mesh(obj.data);faces=[f for f in bm.faces if (f.material_index in indices)==remove_selected];bmesh.ops.delete(bm,geom=faces,context='FACES_ONLY');bm.to_mesh(obj.data);bm.free();obj.data.update()
  hidden.hide_set(True);hidden.hide_viewport=True;hidden.hide_render=True
 # Respect source underwear alpha instead of rendering transparent texels black.
 for mat in bpy.data.materials:
  if not any(x in mat.name for x in ['cf_m_bra_','cf_m_shorts_']):continue
  mt=mat.vrm_addon_extension.mtoon1
  if not mt.enabled:continue
  mt.alpha_mode='MASK';mt.alpha_cutoff=.35
  maskfile=SRC/'Outfit 02'/(mat.name.removeprefix('KK ')+'_AM.png')
  if not maskfile.exists():continue
  mask=Image.open(maskfile).convert('RGBA')
  for label,tex in [('light',mt.pbr_metallic_roughness.base_color_texture),('dark',mt.extensions.vrmc_materials_mtoon.shade_multiply_texture)]:
   if not tex.index.source:continue
   im=pil_image(tex.index.source).convert('RGBA');px=np.array(im);a=np.array(mask.resize(im.size,Image.Resampling.LANCZOS),dtype=np.float32)/255;px[:,:,3]=(px[:,:,3].astype(np.float32)*a[:,:,1]*a[:,:,3]).astype('uint8')
   file=OUT/'textures'/f'{mat.name}_{label}_gamealpha.png';Image.fromarray(px).save(file);tex.index.source=bpy.data.images.load(str(file),check_existing=True)
for outfit in [0,2]:
 bpy.ops.wm.open_mainfile(filepath=str(OUT/f'Rin_outfit_{outfit:02}.blend'))
 game_clothing_visibility()
 arm=next(o for o in bpy.data.objects if o.type=='ARMATURE');bpy.context.view_layer.objects.active=arm;arm.select_set(True)
 bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'Rin_outfit_{outfit:02}.blend'))
 res=bpy.ops.export_scene.vrm(filepath=str(OUT/f'Rin_outfit_{outfit:02}.vrm'),armature_object_name=arm.name,use_addon_preferences=False,export_invisibles=False,export_only_selections=False,export_all_influences=True,export_try_sparse_sk=True)
 assert res=={'FINISHED'},res
 print('GAME_CLOTHING_FIXED',outfit,flush=True)
