import bpy,bmesh,json,uuid,math,traceback,io
from PIL import Image
import numpy as np
from pathlib import Path
BUNDLE=next(p for p in Path(__file__).resolve().parents if (p/"BUNDLE_ROOT").exists())
from mathutils import Matrix,Vector
BASE=Path(__file__).resolve().parent
SRC=BUNDLE / 'inputs/exports/mira'
OUT=Path(__file__).resolve().parent;OUT.mkdir(exist_ok=True)
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.vrm')
bpy.ops.wm.open_mainfile(filepath=str(BASE/'Mira_KKBP_source.blend'))
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.vrm')
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
# Apply the original separate body alpha mask in image space; keep mesh topology intact.
maskmat=bpy.data.materials['KK cf_m_body']
mask=maskmat.node_tree.nodes['_AM.png'].image
# fallback: если маска — плейсхолдер без данных, берём её из экспортной папки (AM_00 = базовый слот)
if not mask or (not mask.packed_file and not mask.filepath):
    cand=list(SRC.rglob('cf_m_body_AM_00.png'))
    if not cand:
        raise FileNotFoundError('AM mask not in SRC')
    nmask=bpy.data.images.load(str(cand[0]))
    nmask.name='_AM.png'
    maskmat.node_tree.nodes['_AM.png'].image=nmask
    mask=nmask
texdir=OUT/'textures';texdir.mkdir(exist_ok=True)
def pil_image(im):
 if im.packed_file:
  return Image.open(io.BytesIO(bytes(im.packed_file.data)))
 fp=bpy.path.abspath(im.filepath)
 if not fp or not Path(fp).exists():
  # fallback: взять PNG из экспортной папки по имени
  nm=Path(im.name).name.replace('.png','')+'.png'
  cand=list(SRC.rglob(nm))
  if not cand:
   raise FileNotFoundError('no image data and not found in SRC: '+im.name)
  im.filepath=str(cand[0]);im.reload()
  fp=str(cand[0])
 return Image.open(fp)
body_original={slot:pil_image(maskmat.node_tree.nodes[slot].image).convert('RGBA') for slot in ['_light.png','_dark.png']}
maskpil=pil_image(mask).convert('RGBA')
for slot in ['_light.png','_dark.png']:
 old=maskmat.node_tree.nodes[slot].image
 im=pil_image(old).convert('RGBA');ms=maskpil.resize(im.size,Image.Resampling.LANCZOS)
 a=np.array(ms,dtype=np.float32)/255;px=np.array(im);px[:,:,3]=(px[:,:,3].astype(np.float32)*a[:,:,0]*a[:,:,1]*a[:,:,3]).astype('uint8')
 file=texdir/(old.name.replace('.png','')+'_alpha.png');Image.fromarray(px).save(file)
 maskmat.node_tree.nodes[slot].image=bpy.data.images.load(str(file),check_existing=True)
# Keep original vertex geometry and all expression shapes. Replace generated solidify outlines with MToon outlines.
for o in bpy.data.objects:
 if o.type=='MESH':
  if o.name.startswith(('Gag Eyes','Tears')):o.hide_render=True;o.hide_viewport=True
  for mod in list(o.modifiers):
   if mod.type=='SOLIDIFY':o.modifiers.remove(mod)
  if o.data.shape_keys:
   o.data.shape_keys.animation_data_clear()
   for k in o.data.shape_keys.key_blocks:k.value=0
# Preserve collection visibility from initial KKBP import, including disabled special-expression layers.
used={m for o in bpy.data.objects if o.type=='MESH' for m in o.data.materials if m}
report={'disabled_physics':[], 'materials':[],'physics':[],'source':str(SRC),'blend_source':str(BASE/'Mira_KKBP_source.blend')}
for mat in used:
 print('MATERIAL',mat.name,flush=True)
 if mat.name.startswith('Outline'):continue
 nt=mat.node_tree
 light=nt.nodes.get('_light.png')
 dark=nt.nodes.get('_dark.png')
 normal=nt.nodes.get('_NMP_CNV.png')
 li=light.image if light else None;di=dark.image if dark else None;ni=normal.image if normal else None
 if not li:
  # Special effects use the explicit corresponding base texture.
  for n in nt.nodes:
   if n.type=='GROUP' and n.node_tree:
    li=next((x.image for x in n.node_tree.nodes if x.type=='TEX_IMAGE' and x.image and '_MT_CT.png' in x.name),None)
    if li:break
 if not li:continue
 mt=mat.vrm_addon_extension.mtoon1;mt.enabled=True
 pbr=mt.pbr_metallic_roughness;pbr.base_color_factor=(1,1,1,1);pbr.base_color_texture.index.source=li
 mt.extensions.vrmc_materials_mtoon.shade_multiply_texture.index.source=di or li
 toon=mt.extensions.vrmc_materials_mtoon
 toon.shade_color_factor=(1,1,1);toon.shading_shift_factor=0;toon.shading_toony_factor=0.9
 toon.outline_width_mode='worldCoordinates';toon.outline_width_factor=0.00045;toon.outline_color_factor=(0.1,0.12,0.15)
 mt.double_sided=False
 # Opaque surfaces must not become transparent because of unused alpha channels.
 n=mat.name.lower()
 mt.alpha_mode='MASK' if any(s in n for s in ['hair','eyeline','mayuge','noseline','hitomi','sirome']) else 'OPAQUE'
 mt.alpha_cutoff=0.35
 if any(t in n for t in ['bra','short','panties','puffer','socks','stocking']):
  try:
   low,high=pil_image(li).convert('RGBA').getchannel('A').getextrema()
   if low<high:mt.alpha_mode='MASK'
  except Exception:pass
 if mat.name=='KK cf_m_body':mt.alpha_mode='MASK';mt.alpha_cutoff=0.5
 if ni and not ni.name.startswith('Template:'):
  mt.normal_texture.index.source=ni;mt.normal_texture.scale=0.35
 if 'lens' in n:
  mt.alpha_mode='BLEND';pbr.base_color_texture.index.source=None;pbr.base_color_factor=(1,1,1,0.12);toon.outline_width_mode='none'
 if 'kage' in n:
  mt.alpha_mode='BLEND';toon.outline_width_mode='none'
 # Extract/pack the actual source images without resizing.
 report['materials'].append({'name':mat.name,'base':li.name,'shade':di.name if di else None,'size':list(li.size),'alpha':mt.alpha_mode})
# Dynamics sidecars are the authoritative source; roots are unreliable for right buttock, use ParticleBones.
sb=arm.data.vrm_addon_extension.spring_bone1
sb.springs.clear();sb.colliders.clear();sb.collider_groups.clear()
info={x['boneName']:x for x in json.loads((SRC/'KK_EditBoneInfo.json').read_text())}
cd=[x for x in json.loads((SRC/'KK_DynamicBoneColliderData.json').read_text()) if x['CoordinateType']==0]
# JSON edit matrices are already in the PMX/Blender coordinate frame. Unity local offsets need Y/Z swap.
def local(v):return Vector((v['x'],v['z'],v['y']))
refs={}
# Restore collider helpers pruned by the KKBP simplification.
bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='EDIT')
for d in [x for x in json.loads((SRC/'KK_DynamicBoneData.json').read_text()) if x['CoordinateType']==0]:
 if d['Weight']<=0:continue
 if d['ParticleBones'][-1]=='NULL':
  last=d['ParticleBones'][-2];tipname=last+'_vrm_end';b=arm.data.edit_bones.new(tipname)
  w=info[last]['worldTransform'];wm=Matrix([w[i:i+4] for i in range(0,16,4)])
  b.head=wm @ local(d['ParticleEndOffset'][-1]);b.tail=b.head+Vector((0,0,-.02));b.parent=arm.data.edit_bones[last];b.use_deform=False
for d in cd:
 name=d['Name']
 if name not in arm.data.edit_bones and name in info:
  b=arm.data.edit_bones.new(name);b.head=info[name]['worldPosition'];b.tail=b.head+Vector((0,0,.05));b.parent=arm.data.edit_bones.get('Center') or arm.data.edit_bones.get('Hips')
bpy.ops.object.mode_set(mode='OBJECT')
for d in cd:
 name=d['Name']
 if name not in arm.data.bones or name not in info:raise RuntimeError('Missing collider '+name)
 if d['Bound']!=0:raise RuntimeError('Unsupported inside collider '+name)
 w=info[name]['worldTransform'];world=Matrix([w[i:i+4] for i in range(0,16,4)])
 center=world @ local(d['Center'])
 # Radius uses the maximum perpendicular scale for conservative nonuniform capsule conversion.
 axis={0:0,1:2,2:1}[d['Direction']]
 scales=list(world.to_scale());rad=d['Radius']*max(scales[k] for k in range(3) if k!=axis)
 half=max(0,d['Height']*scales[axis]/2-rad)
 vec=world.to_quaternion() @ Vector(tuple(half if k==axis else 0 for k in range(3)))
 inv=arm.data.bones[name].matrix_local.inverted()
 c=sb.colliders.add();c.uuid=uuid.uuid4().hex;c.node.bone_name=name;c.shape_type='Capsule' if half>1e-6 else 'Sphere'
 c.reset_bpy_object(bpy.context,arm)
 shape=c.shape.capsule if half>1e-6 else c.shape.sphere
 shape.offset=inv @ (center-vec);shape.radius=rad
 if half>1e-6:shape.tail=inv @ (center+vec)
 group=sb.collider_groups.add();group.uuid=uuid.uuid4().hex;group.vrm_name=name
 group.colliders.add().collider_uuid=c.uuid;refs[name]=group.uuid
for idx,d in enumerate(x for x in json.loads((SRC/'KK_DynamicBoneData.json').read_text()) if x['CoordinateType']==0):
 if d['Weight']<=0:
  report['disabled_physics'].append(d);continue
 names=[n if n!='NULL' else d['ParticleBones'][-2]+'_vrm_end' for n in d['ParticleBones']]
 if any(n not in arm.data.bones for n in names):raise RuntimeError('Missing spring bones '+str(names))
 # Split branching trees into independent paths, never animate one node twice.
 s=sb.springs.add();s.vrm_name=names[0];s.center.bone_name='Hips'
 for i,name in enumerate(names):
  # DynamicBone stiffness=1 pins these particles; their original hierarchy remains kinematic.
  if i<len(d['ParticleStiffness']) and d['ParticleStiffness'][i]>=.999:continue
  if i and names[i-1] not in [p.name for p in arm.data.bones[name].parent_recursive]:raise RuntimeError('Non-contiguous chain '+name)
  j=s.joints.add();j.node.bone_name=name
  def value(k,default):return d[k][i] if len(d.get(k,[]))>i else d.get(default,0)
  stiff=value('ParticleStiffness','Stiffness');elastic=value('ParticleElasticity','Elasticity')
  j.stiffness=max(0,stiff*4+elastic*2)
  j.drag_force=min(1,max(0,value('ParticleDamping','Damping')))
  j.hit_radius=max(0,value('ParticleRadius','Radius')*d.get('ObjectScale',1))
  force=local(d['Force'])+local(d['Gravity']);j.gravity_dir=force.normalized() if force.length else (0,0,-1)
  j.gravity_power=force.length*60
 for cname in d['Colliders']:
  if cname not in refs:raise RuntimeError('Missing collider reference '+cname)
  s.collider_groups.add().collider_group_uuid=refs[cname]
 report['physics'].append({'name':s.vrm_name,'source_particles':names,'joints':[j.node.bone_name for j in s.joints],'colliders':len(d['Colliders'])})
ext=arm.data.vrm_addon_extension
body=next(o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('Body'))
# Preserve all morph targets, and expose standard VRM expressions with explicit bindings.
mapping={
 'blink':['Eye 両目閉じ'], 'blink_left':['Eye 左目ぎゅっと閉じ'], 'blink_right':['Eye 右目ぎゅっと閉じ'],
 'aa':['Mouth あ　大'],'ih':['Mouth い　大'],'ou':['Mouth う　大'],'ee':['Mouth え　大'],'oh':['Mouth お　大'],
 'happy':['Eye 笑顔','Mouth 笑顔, Closed'], 'angry':['Eye 怒り','Eyebrow 怒り','Mouth 怒り, Closed'],
 'sad':['Eye 悲しい','Eyebrow 困り','Mouth 寂しい, Closed'], 'relaxed':['Eye 微笑'],
 'surprised':['Eyebrow 驚き','Mouth 驚き']}
expr=ext.vrm1.expressions
for name,keys in mapping.items():
 e=getattr(expr.preset,name);e.morph_target_binds.clear()
 for key in keys:
  assert key in body.data.shape_keys.key_blocks,key
  bind=e.morph_target_binds.add();bind.node.mesh_object_name=body.name;bind.index=key;bind.weight=1
# Map the actual pupil bones for look-at support.
for attr,bone in [('left_eye','Left Eye'),('right_eye','Right Eye')]:
 if bone in arm.data.bones:getattr(ext.vrm1.humanoid.human_bones,attr).node.bone_name=bone
# Explicit parent for skins keeps the hierarchy unambiguous to glTF exporters.
for o in bpy.data.objects:
 if o.type=='MESH':
  world=o.matrix_world.copy();o.parent=arm;o.matrix_world=world
# Do not draw outlines around mouth interior or thin decal planes.
for mat in bpy.data.materials:
 if any(t in mat.name.lower() for t in ['tooth','tang','noseline','eyeline','mayuge','hitomi','sirome']):
  mat.vrm_addon_extension.mtoon1.extensions.vrmc_materials_mtoon.outline_width_mode='none'

report['expressions']=mapping
arm.data.vrm_addon_extension.spec_version='1.0'
meta=arm.data.vrm_addon_extension.vrm1.meta;meta.vrm_name='Mira';meta.version='1.0 restored';meta.authors.clear();meta.authors.add().value='cyberkitty'
# Assign actual KKBP names through VRM enum keys, then validate before any output.
m={'hips':'Hips','spine':'Spine','chest':'Chest','upperChest':'Upper Chest','neck':'Neck','head':'Head','leftEye':'Left Eye','rightEye':'Right Eye'}
for side in ['left','right']:
 for key,bone in [('Shoulder','shoulder'),('UpperArm','arm'),('LowerArm','elbow'),('Hand','wrist'),('UpperLeg','leg'),('LowerLeg','knee'),('Foot','ankle'),('Toes','toe')]:m[side+key]=side.capitalize()+' '+bone
 for finger,prefix in [('Thumb','Thumb'),('Index','IndexFinger'),('Middle','MiddleFinger'),('Ring','RingFinger'),('Little','LittleFinger')]:
  for part,num in [('Proximal',1),('Intermediate',2),('Distal',3)]:
   if finger=='Thumb':
    part={'Proximal':'Metacarpal','Intermediate':'Proximal','Distal':'Distal'}[part];num-=1
   m[side+finger+part]=prefix+str(num)+'_'+side[0].upper()
hb={k.value:v for k,v in ext.vrm1.humanoid.human_bones.human_bone_name_to_human_bone().items()}
for k,v in m.items():
 if k in hb and v in arm.data.bones:hb[k].node.bone_name=v
errors=list(ext.vrm1.humanoid.human_bones.error_messages());assert not errors,errors
print('HUMANOID_VALID',len(m),flush=True)
exec((Path(__file__).parent/'neutralize_pose.py').read_text())
# Base outfits are exported separately so standard VRM clients display one complete outfit.
# Each file has its corresponding body alpha mask; alternative clothing-shift meshes stay hidden.
import re
meshes=[o for o in bpy.data.objects if o.type=='MESH']
for c in bpy.data.collections:c.hide_viewport=False;c.hide_render=False

def enable_layers(layer):
 layer.exclude=False;layer.hide_viewport=False
 for child in layer.children:enable_layers(child)
enable_layers(bpy.context.view_layer.layer_collection)
report['outfits']=[]
# Source dynamics and colliders are identical across all four coordinates.
# Keep common definitions, serialize only the source coordinate's active chains per export.
spring_specs=[]
for spring in sb.springs:
 spring_specs.append(spring.vrm_name)
for outfit in range(4):
 for o in meshes:
  mtch=re.match(r'^(?:Hair Outfit|Outfit) (\d\d) ',o.name)
  show=o.name.startswith('Body ') or (mtch is not None and int(mtch[1])==outfit)
  o.hide_set(not show);o.hide_viewport=not show;o.hide_render=not show
 # Material texture slots must be changed through MToon after conversion.
 maskpil=Image.open(SRC/f'cf_m_body_AM_{outfit:02}.png').convert('RGBA')
 for slot in ['_light.png','_dark.png']:
  im=body_original[slot].copy();ms=maskpil.resize(im.size,Image.Resampling.LANCZOS)
  a=np.array(ms,dtype=np.float32)/255;px=np.array(im);px[:,:,3]=(px[:,:,3].astype(np.float32)*a[:,:,0]*a[:,:,1]*a[:,:,3]).astype('uint8')
  file=texdir/f'body_outfit_{outfit:02}{slot}';Image.fromarray(px).save(file)
  img=bpy.data.images.load(str(file),check_existing=True)
  if slot=='_light.png':maskmat.vrm_addon_extension.mtoon1.pbr_metallic_roughness.base_color_texture.index.source=img
  else:maskmat.vrm_addon_extension.mtoon1.extensions.vrmc_materials_mtoon.shade_multiply_texture.index.source=img
 meta.vrm_name=f'Mira · Outfit {outfit:02}';meta.version='2.0 four outfits'
 bpy.context.view_layer.objects.active=arm;arm.hide_set(False);arm.select_set(True)
 bpy.ops.file.pack_all()
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'Mira_outfit_{outfit:02}.blend'))
 res=bpy.ops.export_scene.vrm(filepath=str(OUT/f'Mira_outfit_{outfit:02}.vrm'),armature_object_name=arm.name,use_addon_preferences=False,export_invisibles=False,export_only_selections=False,export_all_influences=True,export_try_sparse_sk=True)
 print('OUTFIT_EXPORT',outfit,res,flush=True)
 assert res=={'FINISHED'},(outfit,res)
 report['outfits'].append({'id':outfit,'visible_meshes':[o.name for o in meshes if not o.hide_render],'mask':f'cf_m_body_AM_{outfit:02}.png'})
(OUT/'conversion_audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('FOUR_OUTFITS_DONE',flush=True)
