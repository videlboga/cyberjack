import json,struct
from pathlib import Path
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'BUNDLE_ROOT').exists())
O=(ROOT/'characters/kai/build');report=[]
for i in range(4):
 p=O/f'Kai_outfit_{i:02}.vrm';data=p.read_bytes();n=struct.unpack_from('<I',data,12)[0];j=json.loads(data[20:20+n]);s=j['extensions']['VRMC_springBone'];before=len(s['springs'])
 if i:s['springs']=[x for x in s['springs'] if not x.get('name','').startswith('cf_j_sk_')]
 encoded=json.dumps(j,ensure_ascii=False,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);rest=data[20+n:];p.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(rest))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+rest)
 report.append({'outfit':i,'before':before,'after':len(s['springs'])})
(O/'outfit-physics-audit.json').write_text(json.dumps(report,indent=2));print(report)
