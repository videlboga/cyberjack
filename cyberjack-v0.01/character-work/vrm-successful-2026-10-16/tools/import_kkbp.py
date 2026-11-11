import bpy,addon_utils,argparse,sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("--source",required=True);p.add_argument("--out",required=True)
a=p.parse_args(sys.argv[sys.argv.index("--")+1:])
for mod in ["bl_ext.user_default.mmd_tools","bl_ext.user_default.kkbp"]:addon_utils.enable(mod,default_set=True,persistent=True)
s=bpy.context.scene.kkbp;s.prep_dropdown="VRM";s.simp_dropdown="B";s.atlas_dropdown="Atlas";s.use_rigify=False;s.sfw_mode=False;s.separate_clothes=False
source=Path(a.source).resolve();out=Path(a.out).resolve();out.parent.mkdir(parents=True,exist_ok=True)
r=bpy.ops.kkbp.kkbpimport("EXEC_DEFAULT",filepath=str(source/"model.pmx"));assert r=={"FINISHED"},r
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out))
