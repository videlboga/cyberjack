# Called within the converter after creating physics in the source pose.
import numpy as np
from mathutils import Matrix,Vector,Quaternion
bank=json.loads((Path(__file__).parent/'rig-rest.json').read_text())
base={n['name']:n for n in bank['sourceRig']}
parents=json.loads((Path(__file__).parent/'source_parents.json').read_text())
for n,d in base.items():
 if n in info and d['parent'] in info:parents[n]=d['parent']
current={n:Matrix([d['worldTransform'][i:i+4] for i in range(0,16,4)]) for n,d in info.items()}
posture={t['bone'] for c in bank['clips'] for t in c['tracks'] if t['bone'].startswith('cf_') and 'sk_' not in t['bone'] and 'hair' not in t['bone']}
C=Matrix(((-1,0,0),(0,0,-1),(0,1,0)))
neutral={};visiting=set()
def rest(n):
 if n in neutral:return neutral[n]
 assert n not in visiting,n
 visiting.add(n);parent=parents.get(n);pcur=current.get(parent,Matrix.Identity(4));local=pcur.inverted_safe()@current[n]
 if n in posture and n in base:
  q=base[n]['rotation'];rot=C@Quaternion((q[3],*q[:3])).to_matrix()@C.inverted()
  oldrot=local.to_quaternion().to_matrix();stretch=oldrot.inverted()@local.to_3x3();local=(rot@stretch).to_4x4()
  local.translation=pcur.inverted_safe()@current[n].translation
  if n in ['cf_j_root','cf_j_hips']:local.translation=C@Vector(base[n]['position'])
 neutral[n]=(rest(parent) if parent in current else Matrix.Identity(4))@local
 visiting.remove(n);return neutral[n]
for n in current:rest(n)
rename=json.loads((Path(__file__).parent/'bone-map.json').read_text());reverse={v:k for k,v in rename.items()}
def native(name):return reverse.get(name,name)
D={n:neutral[n]@current[n].inverted_safe() for n in current}
forward={n:np.array(current[n]@neutral[n].inverted_safe(),dtype=np.float64) for n in current}
pose_audit={'method':'inverse weighted affine skinning from exported current pose to prefab posture, retaining per-character local stretch and offsets','posture_bones':len(posture),'meshes':[]}
for o in [o for o in bpy.data.objects if o.type=='MESH']:
 assert np.max(np.abs(np.array(o.matrix_world)-np.eye(4)))<1e-4,(o.name,'nonidentity object')
 count=len(o.data.vertices);A=np.zeros((count,4,4));total=np.zeros(count);bygroup={}
 for v in o.data.vertices:
  for g in v.groups:
   name=native(o.vertex_groups[g.group].name)
   if name not in forward or g.weight<=0:continue
   bygroup.setdefault(name,[]).append((v.index,g.weight));total[v.index]+=g.weight
 for name,entries in bygroup.items():
  ids=np.array([x[0] for x in entries]);weights=np.array([x[1] for x in entries]);A[ids]+=weights[:,None,None]*forward[name]
 valid=total>1e-8;A[valid]/=total[valid,None,None];A[~valid]=np.eye(4);singular=np.abs(np.linalg.det(A[:,:3,:3]))<1e-10
 if np.any(singular):
  print('NONINVERTIBLE_SKIN',o.name,int(singular.sum()),flush=True);A[singular]=np.eye(4)
 inv=np.linalg.inv(A)
 old=np.array([v.co[:] for v in o.data.vertices]);roundtrip=0
 normals=np.empty(len(o.data.loops)*3,dtype=np.float64);o.data.corner_normals.foreach_get('vector',normals);loopids=np.empty(len(o.data.loops),dtype=np.int32);o.data.loops.foreach_get('vertex_index',loopids);normals=np.einsum('nji,nj->ni',A[loopids,:3,:3],normals.reshape(-1,3));normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-12)
 def transform(points):return np.einsum('nij,nj->ni',inv[:,:3,:3],points)+inv[:,:3,3]
 if o.data.shape_keys:
  for shape in o.data.shape_keys.key_blocks:
   points=np.empty(count*3,dtype=np.float64);shape.data.foreach_get('co',points);points=transform(points.reshape(-1,3));shape.data.foreach_set('co',points.astype(np.float32).ravel())
 o.data.vertices.foreach_set('co',transform(old).astype(np.float32).ravel())
 new=transform(old);roundtrip=float(np.max(np.abs(np.einsum('nij,nj->ni',A[:,:3,:3],new)+A[:,:3,3]-old)))
 o.data.update();o.data.normals_split_custom_set(normals.tolist());pose_audit['meshes'].append({'name':o.name,'verts':count,'roundtrip_error_m':roundtrip,'bounds':[new.min(axis=0).tolist(),new.max(axis=0).tolist()]})
# Preserve KKBP bone axes while carrying their heads and orientations into neutral posture.
bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
old_bones={b.name:(b.matrix.copy(),b.length) for b in arm.data.edit_bones}
for b in arm.data.edit_bones:
 name=native(b.name);delta=D.get(name)
 if delta is None:
  parent=b.parent
  while parent and delta is None:delta=D.get(native(parent.name));parent=parent.parent
 if delta is None:continue
 mat,length=old_bones[b.name];b.matrix=delta@mat;b.length=length
bpy.ops.object.mode_set(mode='OBJECT')
for b in arm.pose.bones:b.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
pose_audit['core_positions']={name:list(arm.data.bones[name].head_local) for name in ['Hips','Head','Left arm','Left elbow','Left wrist','Left leg','Left knee','Left ankle','Right wrist'] if name in arm.data.bones}
report['neutral_pose']=pose_audit
(OUT/'neutral_pose_audit.json').write_text(json.dumps(pose_audit,ensure_ascii=False,indent=2))
print('NEUTRAL_POSE_DONE',pose_audit['core_positions'],flush=True)
