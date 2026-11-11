import bpy,sys,json
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:];out=Path(args[0]);out.parent.mkdir(parents=True,exist_ok=True)
tongue=next(o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('Tongue (rigged)'));arm=next(m.object for m in tongue.modifiers if m.type=='ARMATURE');a=arm.copy();a.data=arm.data.copy();a.name='TongueRig';bpy.context.collection.objects.link(a);a.animation_data_clear();a.hide_viewport=False;a.hide_render=False;a.hide_set(False);a.data.pose_position='REST'
mesh=tongue.copy();mesh.data=tongue.data.copy();mesh.name='RiggedTongue';bpy.context.collection.objects.link(mesh);matrix=tongue.matrix_world.copy();mesh.parent=a;mesh.matrix_world=matrix;mesh.hide_viewport=False;mesh.hide_render=False;mesh.hide_set(False);mesh.animation_data_clear()
for mod in list(mesh.modifiers):
 if mod.type=='ARMATURE':mod.object=a
 else:mesh.modifiers.remove(mod)
used={mesh.vertex_groups[g.group].name for v in mesh.data.vertices for g in v.groups if g.weight>1e-6};keep=set(used)
for name in used:
 bone=a.data.bones.get(name)
 while bone:keep.add(bone.name);bone=bone.parent
bpy.ops.object.select_all(action='DESELECT');a.select_set(True);bpy.context.view_layer.objects.active=a;bpy.ops.object.mode_set(mode='EDIT')
for bone in list(a.data.edit_bones):
 if bone.name not in keep:a.data.edit_bones.remove(bone)
bpy.ops.object.mode_set(mode='OBJECT')
for p in a.pose.bones:
 p.matrix_basis.identity()
 for c in list(p.constraints):p.constraints.remove(c)
for g in list(mesh.vertex_groups):
 if g.name not in used:mesh.vertex_groups.remove(g)
bpy.ops.object.select_all(action='DESELECT');a.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=a
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=False,export_materials='NONE',export_skins=True,export_def_bones=False,export_yup=True,export_extras=True)
report={'source':bpy.data.filepath,'vertices':len(mesh.data.vertices),'usedBones':sorted(used),'skeleton':sorted(keep),'materials':[m.name for m in tongue.data.materials if m]};out.with_suffix('.json').write_text(json.dumps(report,indent=2));print('TONGUE_EXPORTED',report,flush=True)
