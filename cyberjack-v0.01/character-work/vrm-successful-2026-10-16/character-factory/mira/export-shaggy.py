"""Convert the local Powdur FBX to a head-centred GLB. Original rig/UV retained."""
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath='/home/cyberkitty/Documents/Codex/2026-10-23/home-cyberkitty-projects-cyberjack-cyberjack-v0/work/hair-assets/ShaggyShortHair_Powdur/FREEShaggyShortHair_Powdur.fbx')
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE');head=arm.matrix_world@arm.data.bones['Head'].head_local
# Bake one common head-space transform into BOTH mesh and rest armature.
# A transformed Empty around a skinned FBX can otherwise be baked twice by export.
M=Matrix.Diagonal((.77*1.15,.77*1.3,.77,1));M.translation=-(M.to_3x3()@head)+Vector((0,-.035,0))
objects=[o for o in bpy.context.scene.objects if o.type in {'ARMATURE','MESH'}]
world={o:o.matrix_world.copy() for o in objects}
for o in objects:
 o.parent=None;o.data.transform(M@world[o]);o.matrix_world=Matrix.Identity(4)
mat=bpy.data.materials.new('Powdur Shaggy Hair');mat.use_nodes=True;nodes=mat.node_tree.nodes;bs=nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.8;bs.inputs['Metallic'].default_value=0
tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(Path('assets/hair/shaggy/texture.png').resolve()));mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
for o in bpy.data.objects:
 if o.type=='MESH':o.data.materials.clear();o.data.materials.append(mat)
bpy.ops.export_scene.gltf(filepath=str(Path('assets/hair/shaggy/hair.glb').resolve()),export_format='GLB',export_animations=False,export_yup=True)
