import bpy,json,time
from pathlib import Path
P=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/sex-machines-models-vol-03')
bpy.ops.wm.read_homefile(use_empty=True)
try:bpy.ops.preferences.addon_enable(module='bl_ext.user_default.openskp_import_export')
except Exception:pass
bpy.ops.import_scene.openskp(filepath=str(P/'SexMachineModel-065.skp'))
collections=[]
def walk(c):
 collections.append({'name':c.name,'exclude':c.exclude,'hide_viewport':c.hide_viewport,'objects':len(c.collection.objects)})
 for ch in c.children:walk(ch)
walk(bpy.context.view_layer.layer_collection)
r={'blenderVersion':bpy.app.version_string,'objects':len(bpy.data.objects),'meshObjects':sum(o.type=='MESH' for o in bpy.data.objects),'armatures':sum(o.type=='ARMATURE' for o in bpy.data.objects),'actions':len(bpy.data.actions),'collectionInstances':sum(o.instance_type=='COLLECTION' for o in bpy.data.objects),'collections':collections,'originalGlbExporterOptions':'/tmp/skp_glb.py: export_format=GLB, export_yup=True; visibility/export collection filters not set'}
(P/'analysis/import-audit-blender.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print('AUDIT_DONE',r['blenderVersion'],r['objects'],r['collectionInstances'])
