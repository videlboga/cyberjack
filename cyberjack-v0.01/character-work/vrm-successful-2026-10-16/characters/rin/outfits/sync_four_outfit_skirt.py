import bpy,json,struct,uuid
from pathlib import Path
BUNDLE=next(p for p in Path(__file__).resolve().parents if (p/"BUNDLE_ROOT").exists())
from mathutils import Vector,Quaternion,Matrix
OUT=Path(__file__).resolve().parent
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.vrm')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'Rin_outfit_00.blend'))
b= (OUT/'Rin_outfit_00.vrm').read_bytes();length=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+length]);nodes=d['nodes'];parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])};cache={}
def world(i):
 if i not in cache:
  n=nodes[i]
  if 'matrix' in n:m=Matrix([n['matrix'][j:j+4] for j in range(0,16,4)]).transposed()
  else:
   q=n.get('rotation',[0,0,0,1]);m=Matrix.Translation(Vector(n.get('translation',[0,0,0])))@Quaternion((q[3],*q[:3])).to_matrix().to_4x4()@Matrix.Diagonal(Vector((*n.get('scale',[1,1,1]),1)))
  cache[i]=(world(parents[i]) if i in parents else Matrix.Identity(4))@m
 return cache[i]
def to_blender(v):return Vector((v[0],-v[2],v[1]))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE');ext=arm.data.vrm_addon_extension;sb=ext.spring_bone1
for c in sb.colliders:
 if c.bpy_object:
  for child in list(c.bpy_object.children):bpy.data.objects.remove(child,do_unlink=True)
  bpy.data.objects.remove(c.bpy_object,do_unlink=True)
sb.springs.clear();sb.collider_groups.clear();sb.colliders.clear();phys=d['extensions']['VRMC_springBone'];uuids=[]
for spec in phys['colliders']:
 c=sb.colliders.add();c.uuid=uuid.uuid4().hex;uuids.append(c.uuid);name=nodes[spec['node']]['name'];assert name in arm.data.bones,name;c.node.bone_name=name
 typ=next(iter(spec['shape']));shape=spec['shape'][typ];mat=world(spec['node']);inv=arm.data.bones[name].matrix_local.inverted();point=lambda v: inv@to_blender(mat@Vector(v));c.shape_type='Capsule' if typ=='capsule' else 'Sphere';c.reset_bpy_object(bpy.context,arm);dst=c.shape.capsule if typ=='capsule' else c.shape.sphere;dst.offset=point(shape['offset']);dst.radius=shape['radius']*max(mat.to_scale())
 if typ=='capsule':dst.tail=point(shape['tail'])
groups=[]
for spec in phys['colliderGroups']:
 g=sb.collider_groups.add();g.uuid=uuid.uuid4().hex;g.vrm_name=spec.get('name','Collider group');groups.append(g.uuid)
 for i in spec['colliders']:g.colliders.add().collider_uuid=uuids[i]
for spec in phys['springs']:
 s=sb.springs.add();s.vrm_name=spec['name'];s.center.bone_name=nodes[spec['center']]['name'] if 'center' in spec else ''
 for ref in spec.get('colliderGroups',[]):s.collider_groups.add().collider_group_uuid=groups[ref]
 for specj in spec['joints']:
  j=s.joints.add();j.node.bone_name=nodes[specj['node']]['name'];j.hit_radius=specj.get('hitRadius',0);j.stiffness=specj.get('stiffness',1);j.drag_force=specj.get('dragForce',.4);j.gravity_power=specj.get('gravityPower',0);j.gravity_dir=to_blender(specj.get('gravityDir',[0,-1,0]))
ext.vrm1.meta.version=d['extensions']['VRMC_vrm']['meta']['version'];bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Rin_outfit_00.blend'));print('FINAL_PHYSICS_SYNCED',len(sb.colliders),sum(len(s.joints) for s in sb.springs),flush=True)
