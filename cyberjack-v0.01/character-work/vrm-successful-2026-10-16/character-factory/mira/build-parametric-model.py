"""Build a standalone editable Blender anatomy rig matching anatomy.js.
Run work/rig-samples.cjs first, then Blender 5.2 --background --python this file.
"""
import bpy,json,base64,numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
HERE=Path(__file__).resolve().parent
payload=json.loads((HERE/'anatomy-rig.js').read_text().split('=',1)[1].strip().rstrip(';'))
training=json.loads((HERE/'work/rig-samples.json').read_text())
bpy.ops.wm.open_mainfile(filepath=payload['source'])
body=bpy.data.objects['Foot shape-1'];face=bpy.data.objects['Face']
for o in list(bpy.data.objects):
 if o not in (body,face):bpy.data.objects.remove(o,do_unlink=True)
arm=bpy.data.armatures.new('Anatomy rest skeleton');rig=bpy.data.objects.new('Anatomy — параметры фигуры',arm);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for b in payload['bones']:
 bone=arm.edit_bones.new(b['name']);h=Vector(b['head']);bone.head=h
 if b['name'].startswith(('upperarm.','forearm.','thigh.','shin.')):
  u=(Vector(b['tail'])-h).normalized();v=Vector((0,1,0)).cross(u).normalized();w=u.cross(v).normalized();bone.tail=h+u*.08;bone.align_roll(-w)
 else:bone.tail=h+Vector((0,0,.06));bone.roll=0
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True;arm.display_type='STICK'
for c in training['controls']:
 name=c['name'];rig[name]=0.;rig.id_properties_ui(name).update(min=-1.,max=1.,soft_min=-1.,soft_max=1.,description=c['nameRu']+f" (×{c['lo']} … ×{c['hi']})")
 ratio=name+'_ratio';arm[ratio]=1.;fc=arm.driver_add('["'+ratio+'"]');dr=fc.driver;v=dr.variables.new();v.name='w';v.targets[0].id=rig;v.targets[0].data_path='["'+name+'"]';dr.expression=f"pow({c['hi']},max(0,w*(.35+.65*w*w)))*pow({c['lo']},max(0,-w*(.35+.65*w*w)))"
# A small explicit basis exactly represents all transforms, including products.
# Fit only coefficients, with a residual check on 121 independently varied states.
features=['1','hip_w','waist_w','chest_w','shoulder_w*sqrt(chest_w)','torso_d','torso_d*bust_d','glute_d','head_size','head_size*head_w','leg_len','arm_len','arm_w','hand_size','foot_size','torso_len','sqrt(chest_w*shoulder_w)','thigh_w','calf_w','thigh_d','calf_d']
X=np.array([s['features'] for s in training['samples']]);maxres=0.
def driver_for(path,channel,values):
 global maxres
 coef=np.linalg.lstsq(X,np.array(values),rcond=None)[0];res=np.abs(X@coef-values).max();maxres=max(maxres,res)
 assert res<2e-6,(path,res)
 terms=[(float(c),f) for c,f in zip(coef,features) if abs(c)>1e-7]
 fc=rig.driver_add(path,channel);d=fc.driver
 used=set()
 for c,f in terms:
  for control in training['controls']:
   n=control['name']
   if n in f.replace('sqrt','').replace('*',' ').replace('(',' ').replace(')',' ').split():used.add(n)
 for n in sorted(used):
  v=d.variables.new();v.name=n;v.targets[0].id_type='ARMATURE';v.targets[0].id=arm;v.targets[0].data_path='["'+n+'_ratio"]'
 d.expression='+'.join(f'({c:.9g})' if f=='1' else f'({c:.9g})*({f})' for c,f in terms) or '0'
 assert len(d.expression)<=255,(path,d.expression)
for j,b in enumerate(payload['bones']):
 bone=arm.bones[b['name']];R=np.array(bone.matrix_local.to_3x3());h=np.array(b['head']);locs=[];scales=[]
 for sample in training['samples']:
  tr=sample['transforms'][j];A=np.array(tr['A']).reshape(3,3);t=np.array(tr['t']);localA=R.T@A@R
  assert abs(localA-np.diag(np.diag(localA))).max()<2e-6
  locs.append(R.T@(A@h+t-h));scales.append(np.diag(localA))
 locs=np.array(locs);scales=np.array(scales)
 for channel in range(3):
  driver_for(f'pose.bones["{b["name"]}"].location',channel,locs[:,channel])
  driver_for(f'pose.bones["{b["name"]}"].scale',channel,scales[:,channel])
for channel in range(3):
 fc=rig.driver_add('scale',channel);v=fc.driver.variables.new();v.name='height';v.targets[0].id_type='ARMATURE';v.targets[0].id=arm;v.targets[0].data_path='["height_ratio"]';fc.driver.expression='height'
clay=bpy.data.materials.new('Anatomy clay');clay.diffuse_color=(.72,.76,.82,1)
for obj,part in [(body,'body'),(face,'face')]:
 obj.parent=rig;obj.matrix_parent_inverse=Matrix.Identity(4);obj.matrix_basis=Matrix.Identity(4)
 for mod in list(obj.modifiers):obj.modifiers.remove(mod)
 obj.vertex_groups.clear();skin=np.frombuffer(base64.b64decode(payload[part]),dtype='<f4').reshape(len(obj.data.vertices),-1)
 for i,b in enumerate(payload['bones']):
  vg=obj.vertex_groups.new(name=b['name'])
  for vertex in np.where(skin[:,i]>1e-9)[0]:vg.add([int(vertex)],float(skin[vertex,i]),'REPLACE')
 mod=obj.modifiers.new('Anatomy parametric skin','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=False
 if obj.data.shape_keys:
  obj.data.shape_keys.animation_data_clear()
  for k in obj.data.shape_keys.key_blocks:k.value=0;k.mute=False
 # Native-style soft-tissue shape keys precede the length/attachment rig.
 basis=np.array([v.co[:] for v in obj.data.shape_keys.reference_key.data],dtype=np.float32)
 for field,encoded in payload.get('fields',{}).get(part,{}).items():
  delta=np.frombuffer(base64.b64decode(encoded),dtype='<f4').reshape(-1,3)
  key=obj.shape_key_add(name='Anatomy::'+field);key.data.foreach_set('co',(basis+delta).ravel());key.slider_min=-1.;key.slider_max=1.
  fc=key.driver_add('value');v=fc.driver.variables.new();v.name='ratio';v.targets[0].id_type='ARMATURE';v.targets[0].id=arm;v.targets[0].data_path='["'+field+'_ratio"]';fc.driver.expression='ratio-1'
 obj.data.materials.clear();obj.data.materials.append(clay)
 obj.hide_render=False;obj.hide_set(False)
 for poly in obj.data.polygons:poly.use_smooth=True
rig['README']='Use Object Properties > Custom Properties: normalized -1..1 anatomy controls. Internal ratios are on armature data. Native shape keys remain on body and face. This is a modelling rig; the source animation rig is retained in the original file.'
# Validate the evaluated Blender geometry against actual viewer output.
errors=[]
for file in sorted((HERE/'work').glob('expected-*.json')):
 expected=json.loads(file.read_text())
 for c in training['controls']:rig[c['name']]=expected['weights'].get(c['name'],0.)
 rig.update_tag();bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
 for obj,part in [(body,'body'),(face,'face')]:
  ev=obj.evaluated_get(dg);mesh=ev.to_mesh();p=np.array([list(ev.matrix_world@v.co) for v in mesh.vertices]);ev.to_mesh_clear()
  target=np.array(expected[part]).reshape(-1,3);err=float(abs(p-target).max());errors.append(err)
  if err>=2e-5:
   vi=int(np.abs(p-target).argmax()//3)
   print('DEBUG',file.name,part,vi,'actual',p[vi],'wanted',target[vi],flush=True)
   print('DEBUG GROUPS',[(g.group,g.weight) for g in obj.data.vertices[vi].groups],flush=True)
   print('DEBUG HEAD',list(rig.pose.bones['head'].location),list(rig.pose.bones['head'].scale),list(rig.pose.bones['head'].matrix),flush=True)
   print('DEBUG RATIOS',[(c['name'],arm[c['name']+'_ratio']) for c in training['controls']],flush=True)
  assert err<2e-5,(file.name,part,err)
 print('MATCH',file.name,max(errors))
for c in training['controls']:rig[c['name']]=0.
rig.update_tag();bpy.context.view_layer.update()
# Remove source scene assets no longer used by the standalone modelling file.
for o in bpy.context.selected_objects:o.select_set(False)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.outliner.orphans_purge(do_recursive=True)
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.region_3d.view_distance=2.7;area.spaces.active.region_3d.view_location=(0,0,.8)
bpy.context.scene.render.engine='BLENDER_WORKBENCH'
out=HERE/'anatomy-parametric.blend';bpy.ops.wm.save_as_mainfile(filepath=str(out))
(HERE/'work/model-validation.json').write_text(json.dumps({'maxDriverFitResidual':maxres,'viewerBlenderMaxCoordinateError':max(errors),'cases':len(errors)//2,'file':str(out)},indent=2))
print('SAVED',out,'max error',max(errors))
