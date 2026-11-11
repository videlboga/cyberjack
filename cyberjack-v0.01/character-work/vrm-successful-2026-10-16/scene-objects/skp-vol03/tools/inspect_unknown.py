import sys
sys.path.insert(0,'/tmp/skp_wheels311');sys.path.insert(0,'/home/cyberkitty/.config/blender/4.2/extensions/user_default/openskp_import_export/vendor')
from pathlib import Path
import openskp,numpy as np,json,collections
P=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/sex-machines-models-vol-03');allrows=[]
for num in [74,75,76,83,85,86]:
 f=openskp.SkpFile.open(str(P/f'SexMachineModel-{num:03}.skp'));f.parse();s=f.build_instanced_scene();rows=[];counts=collections.Counter()
 def walk(n):
  if n.mesh_resource_id:counts[n.mesh_resource_id]+=1
  for c in n.children:walk(c)
 walk(s.scene_hierarchy)
 for r in s.mesh_resources:
  pts=[np.asarray(pr.positions).reshape(-1,3) for pr in r.primitives if pr.positions];faces=sum(len(pr.indices)//3 for pr in r.primitives)
  if not pts:continue
  pos=np.concatenate(pts);dims=pos.max(0)-pos.min(0);colors=[s.gltf_materials[pr.material_index]['pbrMetallicRoughness'].get('baseColorFactor') for pr in r.primitives]
  rows.append({'id':r.id,'name':r.definition_name,'triangles':faces,'dimensions':dims.tolist(),'colors':colors,'instances':counts[r.id]})
 rows.sort(key=lambda r:-r['triangles']);allrows.append({'model':num,'resources':rows,'usedTextures':len(s.textures)});print(num,json.dumps(rows[:9]),flush=True)
Path('work/skp-rebuild/unknown.json').write_text(json.dumps(allrows,ensure_ascii=False,indent=2))
