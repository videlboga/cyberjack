import bpy,math,json,sys,argparse,re
from pathlib import Path
from mathutils import Vector,Quaternion
parser=argparse.ArgumentParser(description='KKBP to manga Blender study; input .blend is supplied to Blender -b')
parser.add_argument('--output-dir',required=True)
parser.add_argument('--label',required=True)
parser.add_argument('--skip-baseline',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
if not re.fullmatch(r'[A-Za-z0-9_-]+',args.label):raise ValueError('label: use letters, digits, _ or -')
LABEL=args.label
OUT=Path(args.output_dir).expanduser().resolve();OUT.mkdir(parents=True,exist_ok=True)
if Path(bpy.data.filepath).resolve()==OUT/(LABEL+'_manga_study.blend'):raise ValueError('Input must be the original conversion, not a previously styled study')
scene=bpy.context.scene
# Shader-to-RGB is an Eevee-only material; retain editable source textures.
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=850;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.world.color=(.8,.8,.8)
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
for o in list(scene.objects):
 if o.type in {'CAMERA','LIGHT'}:bpy.data.objects.remove(o,do_unlink=True)
arm=next(o for o in scene.objects if o.type=='ARMATURE');arm.animation_data_clear()
for b in arm.pose.bones:
 if b.name in ['Left arm','Right arm']:
  mat=b.matrix.copy();rot=Quaternion((0,1,0),math.radians(68 if b.bone.head_local.x>0 else -68)).to_matrix().to_4x4();p=mat.translation.copy();mat=rot@mat;mat.translation=p;b.matrix=mat
bpy.context.view_layer.update()
visible=[o for o in scene.objects if o.type=='MESH' and o.visible_get() and not o.hide_render]
points=[o.matrix_world@Vector(p) for o in visible for p in o.bound_box];lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)));center=(lo+hi)/2
camdata=bpy.data.cameras.new('Reference comparison camera');cam=bpy.data.objects.new('Reference comparison camera',camdata);scene.collection.objects.link(cam);cam.location=(0,-5,center.z);cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=max((hi.z-lo.z)*1.12,(hi.x-lo.x)*1.12*1100/850);scene.camera=cam
world=bpy.data.worlds.new('White paper');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(1,1,1,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5;scene.world=world
# White camera background, independent of the illumination strength.
wn=world.node_tree.nodes;wl=world.node_tree.links;path=wn.new('ShaderNodeLightPath');paper=wn.new('ShaderNodeBackground');paper.inputs['Color'].default_value=(1,1,1,1);paper.inputs['Strength'].default_value=1;wm=wn.new('ShaderNodeMixShader');wl.new(path.outputs['Is Camera Ray'],wm.inputs[0]);wl.new(wn['Background'].outputs[0],wm.inputs[1]);wl.new(paper.outputs[0],wm.inputs[2]);wl.new(wm.outputs[0],wn['World Output'].inputs[0])
for name,loc,power,size in [('Key',(-3,-4,5),500,4),('Fill',(3,-2,3),150,5)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(OUT/f'{LABEL}_before.png')
if not args.skip_baseline:bpy.ops.render.render(write_still=True)
# Independent high-resolution camera: no enlargement of the full-body bitmap.
face_data=bpy.data.cameras.new('Face detail camera');face_cam=bpy.data.objects.new('Face detail camera',face_data);scene.collection.objects.link(face_cam);face_cam.location=(0,-5,hi.z-.16);face_cam.rotation_euler=(Vector((0,0,hi.z-.16))-face_cam.location).to_track_quat('-Z','Y').to_euler();face_data.type='ORTHO';face_data.ortho_scale=.46
def render_face(filename):
 scene.camera=face_cam;scene.render.resolution_x=1100;scene.render.resolution_y=1100;scene.render.filepath=str(OUT/filename);bpy.ops.render.render(write_still=True);scene.camera=cam;scene.render.resolution_x=850;scene.render.resolution_y=1100
render_face(f'{LABEL}_face_before.png')
# Make independent material copies; preserve geometry, rig, shape keys and source images.
ink=bpy.data.materials.new('Manga | graphite ink');ink.use_nodes=True;ink.use_backface_culling=True;n=ink.node_tree.nodes;n.clear();em=n.new('ShaderNodeEmission');em.inputs[0].default_value=(.035,.032,.045,1);out=n.new('ShaderNodeOutputMaterial');ink.node_tree.links.new(em.outputs[0],out.inputs[0])
clear=bpy.data.materials.new('Manga | no outline on facial details');clear.use_nodes=True;clear.node_tree.nodes.clear();tr=clear.node_tree.nodes.new('ShaderNodeBsdfTransparent');ot=clear.node_tree.nodes.new('ShaderNodeOutputMaterial');clear.node_tree.links.new(tr.outputs[0],ot.inputs[0]);clear.surface_render_method='DITHERED'
cache={};audit=[]
for obj in visible:
 for slot in obj.material_slots:
  old=slot.material
  if not old or old.name.startswith('Outline'):continue
  if old.name in cache:slot.material=cache[old.name];continue
  img=next((n.image for n in old.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and ('BaseColor' in n.name or n.name=='_light.png')),None) if old.node_tree else None
  if not img:continue
  name=old.name.lower();kind='face' if 'cf_m_face' in old.name.lower() else 'hair' if 'hair' in name else 'skin' if any(s in name for s in ['body','face']) else 'detail' if any(s in name for s in ['eye','hitomi','sirome','mayuge','nose','kuti','tooth','tang']) else 'cloth'
  if kind in ('detail','skin'):continue  # Preserve original skin texture, blush and authored shading.
  m=bpy.data.materials.new('Manga | '+old.name);m.use_nodes=True;m.surface_render_method='DITHERED';m.use_backface_culling=False
  nt=m.node_tree;n=nt.nodes;n.clear();L=nt.links
  tex=n.new('ShaderNodeTexImage');tex.image=img;tex.label='Original base texture (unchanged)';tex.location=(-850,200)
  # Region-specific palette mixing prevents black textures swallowing all form.
  mix=n.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[0].default_value={'hair':.28,'cloth':.16,'skin':.035,'face':.015,'detail':0}[kind];mix.inputs[2].default_value={'hair':(.17,.18,.21,1),'cloth':(.23,.25,.31,1),'skin':(.96,.9,.9,1),'face':(.98,.94,.94,1),'detail':(1,1,1,1)}[kind];L.new(tex.outputs['Color'],mix.inputs[1]);mix.location=(-620,200);mix.label='Graphite palette / separate skin, hair and cloth'
  diffuse=n.new('ShaderNodeBsdfDiffuse');diffuse.inputs[0].default_value=(1,1,1,1);diffuse.location=(-850,-150)
  rgb=n.new('ShaderNodeShaderToRGB');L.new(diffuse.outputs[0],rgb.inputs[0]);rgb.location=(-640,-150)
  ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.interpolation='CONSTANT';ramp.color_ramp.elements[0].position=.0;ramp.color_ramp.elements[0].color={'skin':(.88,.82,.86,1),'face':(.94,.88,.90,1),'hair':(.58,.60,.69,1),'cloth':(.58,.60,.71,1),'detail':(1,1,1,1)}[kind];ramp.color_ramp.elements[1].position=.52;ramp.color_ramp.elements[1].color=(1,1,1,1);ramp.location=(-400,-120);ramp.label='Two deliberate cel-shadow tones';L.new(rgb.outputs[0],ramp.inputs[0])
  normal=n.new('ShaderNodeNewGeometry');normal.location=(-850,-420);dot=n.new('ShaderNodeVectorMath');dot.operation='DOT_PRODUCT';dot.inputs[1].default_value=(-.45,-.65,.6);L.new(normal.outputs['Normal'],dot.inputs[0]);dot.location=(-650,-400);ramp.color_ramp.elements[1].position=.45;L.new(dot.outputs['Value'],ramp.inputs[0])
  if kind=='face':
   ramp.color_ramp.interpolation='EASE';ramp.color_ramp.elements[0].position=.10;ramp.color_ramp.elements[1].position=.75;ramp.label='Face only | pale warm shadow, soft boundary'
  if kind=='skin':
   ramp.color_ramp.interpolation='EASE';ramp.color_ramp.elements[0].position=.15;ramp.color_ramp.elements[1].position=.70;ramp.label='Body skin | soft warm shadow, preserve joint detail'
  mult=n.new('ShaderNodeMixRGB');mult.blend_type='MULTIPLY';mult.inputs[0].default_value=1;L.new(mix.outputs[0],mult.inputs[1]);L.new(ramp.outputs[0],mult.inputs[2]);mult.location=(-120,180)
  emission=n.new('ShaderNodeEmission');L.new(mult.outputs[0],emission.inputs[0]);emission.location=(100,180)
  trans=n.new('ShaderNodeBsdfTransparent');trans.location=(100,-100);alpha=n.new('ShaderNodeMixShader');L.new(tex.outputs['Alpha'],alpha.inputs[0]);L.new(trans.outputs[0],alpha.inputs[1]);L.new(emission.outputs[0],alpha.inputs[2]);alpha.location=(320,180)
  output=n.new('ShaderNodeOutputMaterial');L.new(alpha.outputs[0],output.inputs[0]);output.location=(520,180)
  cache[old.name]=m;slot.material=m;audit.append({'source':old.name,'kind':kind,'image':img.name})
 # Silhouette shell with a restrained width, rather than outlines on every triangle.
 if obj.name.startswith(('Outfit ','Hair Outfit ')):
  base_mats=list(obj.data.materials);count=len(base_mats)
  for base in base_mats:
   omit=obj.name.startswith('Body ') and 'cf_m_body' not in base.name.lower()
   obj.data.materials.append(clear if omit else ink)
  mod=obj.modifiers.new('Manga silhouette | 0.8 mm','SOLIDIFY');mod.thickness=.0008;mod.offset=1;mod.use_flip_normals=True;mod.use_rim=False;mod.material_offset=count
# Pack dependencies for a portable editable experiment.
bpy.ops.file.pack_all()
scene.render.filepath=str(OUT/f'{LABEL}_manga_blender.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{LABEL}_manga_study.blend'),compress=True)
(OUT/'materials.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2))
bpy.ops.render.render(write_still=True)
render_face(f'{LABEL}_face_manga.png')
scene.render.filepath=str(OUT/f'{LABEL}_manga_blender.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{LABEL}_manga_study.blend'),compress=True)
print('STYLE_DONE',len(audit),len(visible),flush=True)
