"""Bake the actual library dance on seven proportion variants; compare DQS
skinning in Blender against viewer snapshots, then save an inspectable scene."""
import bpy,json,base64,numpy as np,math,os
from pathlib import Path
from mathutils import Vector,Quaternion,Matrix
HERE=Path(__file__).resolve().parent
D=json.loads((HERE/'work/dance-scene.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.fps=D['clip']['fps'];scene.frame_start=1;scene.frame_end=D['clip']['frames']
maxerror=0;objects=[]
visible=['base','plus30','minus30','curvy'];colors=[(.72,.78,.86,1),(.76,.83,.77,1),(.85,.77,.73,1),(.8,.74,.85,1)]
for fi,figure in enumerate(D['figures']):
 name=figure['name'];arm=bpy.data.armatures.new(name+' rest');rig=bpy.data.objects.new(name+' · dance',arm);scene.collection.objects.link(rig)
 bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 for i,b in enumerate(D['bones']):
  bone=arm.edit_bones.new(b['name']);bone.head=figure['heads'][i];t=Vector(figure['tails'][i]);bone.tail=t if (t-bone.head).length>.001 else bone.head+Vector((0,0,.05))
  if D['parents'][i]>=0:bone.parent=arm.edit_bones[D['bones'][D['parents'][i]]['name']]
 bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True;arm.display_type='STICK'
 rig['figure_parameters']=json.dumps(figure['weights']);rig['native_shape_keys']=json.dumps(figure['natives']);rig['source_clip']=D['clip']['name'];rig['source_id']='c78368db619cb915c7122f78'
 rest=[arm.bones[b['name']].matrix_local.copy() for b in D['bones']]
 # Create the standard layered Blender action, then populate curves in bulk.
 first=rig.pose.bones[0];first.rotation_mode='QUATERNION';first.keyframe_insert('rotation_quaternion',frame=1)
 action=rig.animation_data.action;action.name=name+' · Acto_Aerobic Dance';bag=action.layers[0].strips[0].channelbag(rig.animation_data.action_slot)
 for fc in list(bag.fcurves):bag.fcurves.remove(fc)
 channels={(i,kind,k):[] for i in range(len(rest)) for kind,n in [('location',3),('rotation_quaternion',4)] for k in range(n)}
 previous={}
 for f,pose in enumerate(figure['poses']):
  world=[]
  for i,b in enumerate(D['bones']):
   q=Quaternion((pose['q'][i][3],*pose['q'][i][:3]));mat=Matrix.LocRotScale(Vector(pose['heads'][i]),q@rest[i].to_quaternion(),Vector((1,1,1)));world.append(mat)
   p=D['parents'][i];basis=rest[i].inverted()@(rest[p]@world[p].inverted() if p>=0 else Matrix.Identity(4))@mat
   loc,rot,scale=basis.decompose()
   if i in previous and rot.dot(previous[i])<0:rot.negate()
   previous[i]=rot.copy()
   for k,v in enumerate(loc):channels[i,'location',k].append((f+1,v))
   for k,v in enumerate(rot):channels[i,'rotation_quaternion',k].append((f+1,v))
 for (i,kind,k),values in channels.items():
  pb=rig.pose.bones[D['bones'][i]['name']];pb.rotation_mode='QUATERNION'
  fc=bag.fcurves.new(f'pose.bones["{pb.name}"].{kind}',index=k);fc.keyframe_points.add(len(values));fc.keyframe_points.foreach_set('co',np.array(values,dtype=np.float32).ravel())
  for point in fc.keyframe_points:point.interpolation='LINEAR'
  fc.update()
 mat=bpy.data.materials.new(name+' clay');mat.diffuse_color=colors[visible.index(name)] if name in visible else (.75,.75,.8,1)
 meshes={}
 for part,idxkey in [('body','index'),('face','faceIndex')]:
  coords=np.array(figure[part]).reshape(-1,3);tris=np.array(D[idxkey]).reshape(-1,3)
  mesh=bpy.data.meshes.new(name+' '+part);mesh.from_pydata(coords.tolist(),[],tris.tolist());mesh.update();obj=bpy.data.objects.new(name+' '+part,mesh);scene.collection.objects.link(obj);obj.parent=rig
  mesh.materials.append(mat)
  for p in mesh.polygons:p.use_smooth=True
  skin=np.frombuffer(base64.b64decode(D['skin'][part]),dtype='<f4').reshape(len(coords),-1)
  for i,b in enumerate(D['bones']):
   vg=obj.vertex_groups.new(name=b['name'])
   for vertex in np.where(skin[:,i]>1e-9)[0]:vg.add([int(vertex)],float(skin[vertex,i]),'REPLACE')
  mod=obj.modifiers.new('Dance · preserve joint volume','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True;meshes[part]=obj
 # Compare the actual evaluated Blender mesh, not just joint transforms.
 for sample in figure['snapshots']:
  scene.frame_set(sample['frame']+1);dg=bpy.context.evaluated_depsgraph_get()
  for part,obj in meshes.items():
   ev=obj.evaluated_get(dg);m=ev.to_mesh();p=np.array([list(v.co) for v in m.vertices]);ev.to_mesh_clear();err=float(abs(p-np.array(sample[part]).reshape(-1,3)).max());maxerror=max(maxerror,err)
   if err>2e-4:
    ind=np.argmax(abs(p-np.array(sample[part]).reshape(-1,3)))//3
    matrixErr=0
    for bi,b in enumerate(D['bones']):
     pp=figure['poses'][sample['frame']];q=Quaternion((pp['q'][bi][3],*pp['q'][bi][:3]));want=Matrix.LocRotScale(Vector(pp['heads'][bi]),q@rest[bi].to_quaternion(),Vector((1,1,1)))
     matrixErr=max(matrixErr,max(abs(a-b) for ra,rb in zip(rig.pose.bones[b['name']].matrix,want) for a,b in zip(ra,rb)))
    print('DEBUG',name,part,sample['frame'],err,'vertex',ind,'point',p[ind], 'wanted',np.array(sample[part]).reshape(-1,3)[ind],'matrixErr',matrixErr,flush=True)
   assert err<2e-4,(name,part,sample['frame'],err)
 print('DANCE MATCH',name,maxerror,flush=True)
 objects.append((rig,meshes,name))
 rig.location.x=(visible.index(name)-1.5)*1.45 if name in visible else (fi+1)*3
 if name not in visible:
  rig.hide_render=True;rig.hide_set(True)
  for o in meshes.values():o.hide_render=True;o.hide_set(True)
 else:
  curve=bpy.data.curves.new('label '+name,'FONT');curve.body=name;curve.align_x='CENTER';curve.size=.11;label=bpy.data.objects.new('label '+name,curve);scene.collection.objects.link(label);label.location=(rig.location.x,-.35,-.18);label.rotation_euler=(math.pi/2,0,0)
 rig.select_set(False)
scene.frame_set(97)
camdata=bpy.data.cameras.new('Dance review');cam=bpy.data.objects.new('Dance review',camdata);scene.collection.objects.link(cam);cam.location=(0,-8,.85);cam.rotation_euler=(math.pi/2,0,0);camdata.type='ORTHO';camdata.ortho_scale=6.4;scene.camera=cam
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.background_type='WORLD';scene.world=bpy.data.worlds.new('Review background');scene.world.color=(.035,.04,.055)
scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
scene['validation']='7 figures × 455 frames from the local native dance clip. DQS skinning; original game IK, fingers, clothing and collisions are outside this test.'
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'anatomy-dance-test.blend'))
(HERE/'work/dance-blender-validation.json').write_text(json.dumps({'figures':len(objects),'comparedSnapshots':sum(len(f['snapshots']) for f in D['figures']),'viewerBlenderMaxCoordinateError':maxerror,'clip':D['clip']},indent=2))
scene.render.filepath=str(HERE/'work/dance-review.png');bpy.ops.render.render(write_still=True)
if os.environ.get('RENDER_DANCE')=='1':
 target=HERE/'work/dance-frames';target.mkdir(exist_ok=True)
 for f in range(1,scene.frame_end+1,2):
  scene.frame_set(f);scene.render.filepath=str(target/f'{(f-1)//2:04d}.png');bpy.ops.render.render(write_still=True)
print('DANCE SCENE SAVED; max coordinate error',maxerror,flush=True)
