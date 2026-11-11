import sys
sys.path.insert(0,'/tmp/skp_wheels311');sys.path.insert(0,'/home/cyberkitty/.config/blender/4.2/extensions/user_default/openskp_import_export/vendor')
from pathlib import Path
import openskp,json,time
P=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/sex-machines-models-vol-03');rows=[]
for p in sorted(P.glob('*.skp')):
 f=openskp.SkpFile.open(str(p));f.parse();materials=f._parsed['materials'];items=materials.values() if isinstance(materials,dict) else materials;textures=[]
 for m in items:
  if isinstance(m,dict):
   t=m.get('texture')
   if t:textures.append({'name':m.get('name'),'filename':t.get('filename'),'bytes':len(t.get('data') or b'')})
 rows.append({'model':p.stem,'materials':len(materials),'textures':textures})
(P/'analysis/import-audit-materials.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));print('models',len(rows),'texturedMaterials',sum(len(r['textures']) for r in rows))
