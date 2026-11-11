import bpy,json,time
from pathlib import Path
from mathutils import Matrix,Vector
P=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/sex-machines-models-vol-03/prepared-2026-10-16');rows=[]
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)));Ci=C.inverted()
while True:
 try:c=json.load(open(P/'catalog.json'))
 except (FileNotFoundError,json.JSONDecodeError):time.sleep(1);continue
 for r in c['models']:
  if any(x['model']==r['id'] for x in rows):continue
  metadata=json.load(open(P/r['metadata']))
  if metadata.get('materialProfile',{}).get('exporterRevision')!=3:continue
  if r['triangles']!=metadata['mechanical']['counts']['triangles']:continue
  t=time.time();bpy.ops.wm.read_homefile(use_empty=True);bpy.context.preferences.filepaths.save_version=0;bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
  bpy.ops.import_scene.gltf(filepath=str(P/r['model']))
  original=list(bpy.context.scene.objects);triangles=sum(len(o.data.polygons) for o in original if o.type=='MESH');assert triangles==r['triangles'],(r['id'],triangles,r['triangles'])
  for ob in original:
   if ob.type=='MESH' and ob.data.polygons and '.stl' in ob.name.lower():raise RuntimeError('Figure geometry remains')
  construction=bpy.data.collections.new('Construction lines · hidden');bpy.context.scene.collection.children.link(construction)
  construction.hide_viewport=True;construction.hide_render=True
  for ob in original:
   if ob.type=='MESH' and not ob.data.polygons and ob.data.edges:
    for collection in list(ob.users_collection):collection.objects.unlink(ob)
    construction.objects.link(ob)
  metadata=json.load(open(P/r['metadata']));col=bpy.data.collections.new('Figure references · no pose');bpy.context.scene.collection.children.link(col)
  for i,ref in enumerate(metadata['figureReferences']):
   ob=bpy.data.objects.new(f'FigureReference_{i:02}',None);col.objects.link(ob);ob.empty_display_type='PLAIN_AXES';ob.empty_display_size=.15
   world=Matrix([ref['worldMatrix'][i:i+4] for i in range(0,16,4)]).transposed();ob.matrix_world=C@world@Ci
   ob['source_reference_id']=ref['id'];ob['source_world_matrix_yup_meters']=json.dumps(ref['worldMatrix']);ob['meaning']='Static source figure reference only; NOT a VRM root transform or skeletal pose.'
  bpy.context.scene['source_skp']=metadata['source'];bpy.context.scene['source_sha256']=metadata['sourceSha256'];bpy.context.scene['units']='metres';bpy.context.scene['export_note']='Prepared mechanical geometry. No demonstration figure meshes or library ghosts. Figure reference empties contain no avatar pose.'
  bpy.ops.file.pack_all();out=P/'blend'/(r['id']+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(out),check_existing=False)
  rows.append({'model':r['id'],'triangles':triangles,'figureReferences':len(metadata['figureReferences']),'objects':len(bpy.context.scene.objects),'images':len(bpy.data.images),'file':str(out.relative_to(P)),'seconds':round(time.time()-t,2)});print('BLEND',rows[-1],flush=True)
 (P/'reports/blender-import.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
 if c['complete'] and len(rows)==len(c['models']):break
 time.sleep(1)
