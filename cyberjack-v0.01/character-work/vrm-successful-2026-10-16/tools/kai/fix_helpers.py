import json,struct
from pathlib import Path
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'BUNDLE_ROOT').exists())
O=(ROOT/'characters/kai/build');report=[]
for p in sorted(O.glob('Kai_outfit_*.vrm')):
 d=p.read_bytes();n=struct.unpack_from('<I',d,12)[0];j=json.loads(d[20:20+n]);removed=[]
 for m in j['meshes']:
  keep=[]
  for prim in m['primitives']:
   name=j['materials'][prim['material']]['name']
   if any(x in name for x in ['c_m_shadowcast','c_m_silhouette']):removed.append(name)
   else:keep.append(prim)
  m['primitives']=keep
 encoded=json.dumps(j,ensure_ascii=False,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);rest=d[20+n:];p.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(rest))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+rest);report.append({'file':p.name,'removed_render_helpers':removed})
(O/'helper-surfaces-audit.json').write_text(json.dumps(report,indent=2));print(report)
