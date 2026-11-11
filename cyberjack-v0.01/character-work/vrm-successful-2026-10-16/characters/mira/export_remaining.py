import bpy,json,re
from pathlib import Path
BUNDLE=next(p for p in Path(__file__).resolve().parents if (p/"BUNDLE_ROOT").exists())
OUT=Path(__file__).resolve().parent
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.vrm')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'Mira_outfit_00.blend'))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
# In this source all four green-channel body alpha masks are white, and body MTs are identical.
for i in [1,2,3]:
 for o in bpy.data.objects:
  if o.type!='MESH':continue
  match=re.match(r'^(?:Outfit|Hair Outfit) (\d\d) ',o.name);show=o.name.startswith('Body ') or (match is not None and int(match[1])==i)
  o.hide_set(not show);o.hide_viewport=not show;o.hide_render=not show
 arm.data.vrm_addon_extension.vrm1.meta.vrm_name=f'Mira · Outfit {i:02}'
 bpy.context.view_layer.objects.active=arm;arm.select_set(True)
 bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'Mira_outfit_{i:02}.blend'))
 result=bpy.ops.export_scene.vrm(filepath=str(OUT/f'Mira_outfit_{i:02}.vrm'),armature_object_name=arm.name,use_addon_preferences=False,export_invisibles=False,export_only_selections=False,export_all_influences=True,export_try_sparse_sk=True);assert result=={'FINISHED'},result
 (OUT/f'basis_fixed_{i:02}.json').write_text(json.dumps({'outfit':i,'geometry_source':'Mira_outfit_00.blend, corrected Basis','result':'FINISHED'},indent=2));print('FINAL_EXPORT',i,flush=True)
