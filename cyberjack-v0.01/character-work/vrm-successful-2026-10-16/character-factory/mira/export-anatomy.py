"""Run with Blender 5.2+: export original rig's semantic skinning weights."""
import bpy,numpy as np,json,base64, pathlib
HERE=pathlib.Path(__file__).resolve().parent
SOURCE='/home/cyberkitty/Documents/Codex/2026-09-07/new-chat/outputs/evanescia-motion-test/Evanescia_Complex_Motion_Test.blend'
bpy.ops.wm.open_mainfile(filepath=SOURCE)
rig=bpy.data.objects['rig_E'];body=bpy.data.objects['Foot shape-1']
names=['pelvis','waist','abdomen','chest','upperchest','neck','head']+[f'{part}.{s}' for s in ['l','r'] for part in ['shoulder','upperarm','forearm','hand','thigh','shin','foot']]
actual=['root.x','spine_01.x','spine_02.x','spine_03.x','spine_04.x','neck.x','head.x']+[f'{part}.{s}' for s in ['l','r'] for part in ['shoulder','arm','forearm','hand','thigh','leg','foot']]
bones=[dict(name=n,head=list(rig.data.bones[a].head_local),tail=list(rig.data.bones[a].tail_local)) for n,a in zip(names,actual)]
def semantic(n):
 if n in ['root.x','vag0'] or 'vagina' in n.lower() or 'butt' in n.lower() or 'anus' in n.lower():return 'pelvis'
 if n.startswith('spine_'):return {'01':'waist','02':'abdomen','03':'chest','04':'upperchest'}.get(n[6:8])
 if n.startswith('Breast'):return 'chest'
 if n=='neck.x':return 'neck'
 if n in ['head.x','head_scale_fix.x']:return 'head'
 s=n[-1].lower()
 if s not in ['l','r']:return None
 n=n.lower()
 if n.startswith('shoulder.'):p='shoulder'
 elif n.startswith(('arm_','c_arm_twist')):p='upperarm'
 elif n.startswith('forearm'):p='forearm'
 elif n.startswith(('thigh_','thigh.')):p='thigh'
 elif n.startswith(('leg_','leg.')):p='shin'
 elif n.startswith(('foot.','toes_','bigtoe','smalltoe')):p='foot'
 elif any(k in n for k in ['hand.','thumb','index','middle','ring','pinky']):p='hand'
 else:return None
 return p+'.'+s

def pack(o):
 p=np.array([v.co[:] for v in o.data.vertices],dtype=np.float32)
 weights=np.zeros((len(p),len(names)),dtype=np.float64)
 mapping={g.index:semantic(g.name) for g in o.vertex_groups if g.name in rig.data.bones and rig.data.bones[g.name].use_deform}
 for v in o.data.vertices:
  for g in v.groups:
   n=mapping.get(g.group)
   if n:weights[v.index,names.index(n)]+=g.weight
 missing=weights.sum(1)<1e-8
 print(o.name,'missing',missing.sum(),'of',len(p))
 if missing.any():
  for i in np.where(missing)[0]:weights[i,names.index('head' if p[i,2]>1.35 else 'pelvis')]=1
 weights/=weights.sum(1)[:,None]
 # Weld only coincident vertices: normals/material seams must deform identically.
 _,inverse=np.unique(np.round(p,6),axis=0,return_inverse=True)
 edges=np.array([(inverse[e.vertices[0]],inverse[e.vertices[1]]) for e in o.data.edges]);m=inverse.max()+1
 w=np.zeros((m,len(names)));counts=np.bincount(inverse,minlength=m);np.add.at(w,inverse,weights);w/=counts[:,None]
 # Smooth weight transitions over the actual surface, never over nearby limbs.
 for _ in range(8):
  sums=np.zeros_like(w);degree=np.zeros(m)
  np.add.at(sums,edges[:,0],w[edges[:,1]]);np.add.at(sums,edges[:,1],w[edges[:,0]])
  np.add.at(degree,edges[:,0],1);np.add.at(degree,edges[:,1],1)
  w=.65*w+.35*sums/np.maximum(degree,1)[:,None]
 w=w[inverse];w/=w.sum(1)[:,None]
 # A shared head/neck transition replaces stray skin weights at the tiny
 # posterior-neck seam. Above the skull base the entire head moves rigidly.
 f=np.clip((p[:,2]-1.30)/.04,0,1);f=f*f*(3-2*f)
 g=np.clip((p[:,2]-1.33)/.065,0,1);g=g*g*(3-2*g)
 target=np.zeros_like(w);target[:,names.index('neck')]=1-g;target[:,names.index('head')]=g
 w=w*(1-f[:,None])+target*f[:,None]
 return base64.b64encode(w.astype('<f4').tobytes()).decode()
payload={'bones':bones,'body':pack(body),'face':pack(bpy.data.objects['Face']),'source':SOURCE}
# The source mesh has sculpted proportions which no longer match the old rest
# bones (notably ankles). Refit shared joint centres from skin-weight interfaces.
p=np.array([v.co[:] for v in body.data.vertices]);skin=np.frombuffer(base64.b64decode(payload['body']),dtype='<f4').reshape(len(p),len(names))
def joint(a,b):
 q=skin[:,names.index(a)]*skin[:,names.index(b)]
 return (p*q[:,None]).sum(0)/q.sum()
lookup={b['name']:b for b in bones}
for side in ['l','r']:
 chain=[('pelvis','thigh.'+side),('thigh.'+side,'shin.'+side),('shin.'+side,'foot.'+side)]
 hip,knee,ankle=[joint(a,b) for a,b in chain]
 shoulder=joint('shoulder.'+side,'upperarm.'+side)
 elbow=joint('upperarm.'+side,'forearm.'+side);wrist=joint('forearm.'+side,'hand.'+side)
 for name,h,t in [('thigh',hip,knee),('shin',knee,ankle),('upperarm',shoulder,elbow),('forearm',elbow,wrist)]:
  lookup[name+'.'+side]['head']=h.tolist();lookup[name+'.'+side]['tail']=t.tolist()
 for name,h in [('foot',ankle),('hand',wrist)]:
  b=lookup[name+'.'+side];delta=np.array(b['tail'])-np.array(b['head']);b['head']=h.tolist();b['tail']=(h+delta).tolist()
 lookup['shoulder.'+side]['tail']=shoulder.tolist()
# Sculpt deltas act on soft tissue; joints remain unchanged. They are ordinary
# shape-key displacement fields, separate from the length/attachment rig.
def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def fields(obj,part):
 pts=np.array([v.co[:] for v in obj.data.vertices]);W=np.frombuffer(base64.b64decode(payload[part]),dtype='<f4').reshape(len(pts),len(names))
 out={}
 if part=='face':return out
 core=W[:,:5].sum(1);z=pts[:,2]
 def save(name,delta):out[name]=base64.b64encode(delta.astype('<f4').tobytes()).decode()
 for side in ['l','r']:
  for part_,wn,dn in [('thigh','thigh_w','thigh_d'),('shin','calf_w','calf_d'),('upperarm','arm_w','arm_w'),('forearm','arm_w','arm_w')]:
   b=lookup[part_+'.'+side];h=np.array(b['head']);axis=np.array(b['tail'])-h;length=np.linalg.norm(axis);u=axis/length
   v=np.cross([0,1,0],u);v/=np.linalg.norm(v);d=np.cross(u,v)
   rel=pts-h;t=rel@u/length
   envelope=smooth(.02,.24,t)*(1-smooth(.72,.99,t))
   mask=W[:,names.index(part_+'.'+side)]*envelope
   dx=mask[:,None]*(rel@v)[:,None]*v
   dy=mask[:,None]*(rel@d)[:,None]*d
   if wn==dn:
    out.setdefault(wn,np.zeros_like(pts));out[wn]+=dx+dy
   else:
    out.setdefault(wn,np.zeros_like(pts));out.setdefault(dn,np.zeros_like(pts));out[wn]+=dx;out[dn]+=dy
 for name in list(out):save(name,out[name])
 def bell(center,width):return np.exp(-.5*((z-center)/width)**2)*core
 # Broad overlapping soft-tissue profiles, with continuous falloffs across the
 # pelvis, abdomen, ribs and shoulder girdle; limbs use their own local fields.
 for name,center,width in [('hip_w',.91,.13),('waist_w',1.065,.085),('chest_w',1.205,.09),('shoulder_w',1.285,.07)]:
  delta=np.zeros_like(pts);delta[:,0]=pts[:,0]*bell(center,width);save(name,delta)
 axisY=np.interp(z,[.85,1.01,1.15,1.26,1.35],[.005,-.013,-.013,.036,.034])
 for name,center,width in [('torso_d',1.09,.17),('bust_d',1.20,.085),('glute_d',.86,.11)]:
  delta=np.zeros_like(pts);mask=bell(center,width)
  if name=='bust_d':mask*=1-smooth(-.025,.015,pts[:,1]-axisY)
  if name=='glute_d':mask*=smooth(-.015,.025,pts[:,1]-axisY)
  delta[:,1]=(pts[:,1]-axisY)*mask;save(name,delta)
 return out
payload['fields']={'body':fields(body,'body'),'face':{}}
payload['calibration']='Surface sculpt fields with protected joints; calibrated semantic skeleton'

(HERE/'anatomy-rig.js').write_text('window.ANATOMY_RIG='+json.dumps(payload)+';\n')
print('exported',len(bones),'segments')
