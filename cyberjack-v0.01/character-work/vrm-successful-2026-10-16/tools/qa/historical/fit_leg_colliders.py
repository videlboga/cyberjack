exec(open('work/check_collisions.py').read().split("sb=d['extensions']")[0])
raw=b[28+l:];types={5126:np.dtype('<f4'),5123:np.dtype('<u2'),5125:np.dtype('<u4'),5121:np.dtype('u1')};width={'VEC3':3,'VEC4':4,'SCALAR':1}
def acc(i):
 a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];dt=types[a['componentType']];w=width[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0);return np.ndarray((a['count'],w),dt,buffer=raw,offset=off,strides=(v.get('byteStride',w*dt.itemsize),dt.itemsize)).astype(float)
verts=[]
for i,node in enumerate(nodes):
 if 'mesh' not in node:continue
 for prim in d['meshes'][node['mesh']]['primitives']:
  if d['materials'][prim['material']]['name']=='KK cf_m_body':
   x=acc(prim['attributes']['POSITION']);verts.append((world(i)@np.concatenate([x,np.ones((len(x),1))],axis=1).T).T[:,:3])
v=np.concatenate(verts);ix={n.get('name'):i for i,n in enumerate(nodes)};result=[]
print('body range',v.min(0),v.max(0))
for side in ['Left','Right']:
 for section,b0,b1 in [('thigh',side+' leg',side+' knee'),('calf',side+' knee',side+' ankle')]:
  a=pos(ix[b0]);z=pos(ix[b1]);axis=z-a;unit=axis/np.linalg.norm(axis);t=(v-a)@axis/np.dot(axis,axis);rad=np.linalg.norm((v-a)-np.outer((v-a)@unit,unit),axis=1);sign=1 if side=='Left' else -1;sel=(t>.15)&(t<.85)&(v[:,0]*sign>.005)&(rad<.17)
  print(side,section,'axis',a,z,'rad percentiles',np.quantile(rad[sel],[.5,.8,.9,.95,.98]),'count',sum(sel))
  r=float(np.quantile(rad[sel],.95));result.append({'side':side,'section':section,'bone':b0,'a':a.tolist(),'b':z.tolist(),'radius':r})
Path('work/fitted_legs.json').write_text(json.dumps(result,indent=2))
