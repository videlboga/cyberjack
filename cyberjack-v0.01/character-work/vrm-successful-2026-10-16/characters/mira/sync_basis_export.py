import bpy,numpy as np,time,json
from pathlib import Path
BUNDLE=next(p for p in Path(__file__).resolve().parents if (p/"BUNDLE_ROOT").exists())
OUT=Path(__file__).resolve().parent
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.vrm');report=[]
for i in range(4):
 deadline=time.monotonic()+480
 while not (OUT/f'Mira_outfit_{i:02}.vrm').exists():
  assert time.monotonic()<deadline,'Missing base export';time.sleep(1)
 bpy.ops.wm.open_mainfile(filepath=str(OUT/f'Mira_outfit_{i:02}.blend'))
 meshes=[]
 for o in bpy.data.objects:
  if o.type!='MESH' or not o.data.shape_keys:continue
  co=np.empty(len(o.data.vertices)*3);o.data.shape_keys.key_blocks[0].data.foreach_get('co',co)
  normals=np.empty(len(o.data.loops)*3);o.data.corner_normals.foreach_get('vector',normals)
  o.data.vertices.foreach_set('co',co);o.data.update();o.data.normals_split_custom_set(normals.reshape(-1,3).tolist());meshes.append(o.name)
 arm=next(o for o in bpy.data.objects if o.type=='ARMATURE');bpy.context.view_layer.objects.active=arm;arm.select_set(True)
 bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'Mira_outfit_{i:02}.blend'))
 res=bpy.ops.export_scene.vrm(filepath=str(OUT/f'Mira_outfit_{i:02}.vrm'),armature_object_name=arm.name,use_addon_preferences=False,export_invisibles=False,export_only_selections=False,export_all_influences=True,export_try_sparse_sk=True);assert res=={'FINISHED'},res
 report.append({'outfit':i,'meshes_synced':meshes});(OUT/f'basis_fixed_{i:02}.json').write_text(json.dumps(report[-1],ensure_ascii=False,indent=2));print('BASIS_FIXED',i,flush=True)
(OUT/'basis_sync_audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
