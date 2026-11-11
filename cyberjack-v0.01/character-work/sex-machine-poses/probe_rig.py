import bpy, json
from pathlib import Path
blend=Path(bpy.context.blend_data.filepath)
OUT=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/sex-machine-poses/out')
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
res={'file':str(blend),'armature':arm.name,'bones':{},'meshes':[o.name for o in bpy.data.objects if o.type=='MESH'][:10]}
for b in arm.data.bones:
    res['bones'][b.name]={'head':list(b.head_local),'tail':list(b.tail_local),'parent':b.parent.name if b.parent else None,'pose_quat':list(arm.pose.bones[b.name].rotation_quaternion) if b.name in arm.pose.bones else None}
ext=None
try:
    ext=arm.data.vrm_addon_extension
    res['vrm_spec']=ext.spec_version if ext else None
except Exception as e:
    res['vrm_err']=str(e)
res['human_bones']={}
if ext and ext.spec_version:
    hb=ext.vrm1.humanoid.human_bones
    res['human_bones']={k.value:v for k,v in hb.human_bone_name_to_human_bone().items()}
(OUT/(blend.stem+'_rig_probe.json')).write_text(json.dumps(res,indent=1,ensure_ascii=False))
print('BONES',len(res['bones']),'HB',len(res['human_bones']))
for n in ['Hips','Spine','Chest','Neck','Head','Left arm','Left elbow','Left wrist','Right arm','Right elbow','Right wrist','Left leg','Left knee','Left ankle','Left toe','Right leg','Right knee','Right ankle','Right toe','Center','Pelvis','Upper Chest']:
    b=res['bones'].get(n)
    if b: print(n,'head',[round(x,4) for x in b['head']],'parent',b['parent'])
