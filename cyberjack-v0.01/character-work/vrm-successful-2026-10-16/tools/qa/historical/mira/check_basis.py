import bpy,numpy as np
bpy.ops.wm.open_mainfile(filepath='/home/cyberkitty/Documents/Codex/2026-10-15/x20/outputs/mira_four_outfits/Mira_outfit_00.blend')
for o in bpy.data.objects:
 if o.type!='MESH' or not o.data.shape_keys:continue
 a=np.array([v.co[:] for v in o.data.vertices]);b=np.array([v.co[:] for v in o.data.shape_keys.key_blocks[0].data]);print(o.name,'keys',len(o.data.shape_keys.key_blocks),'basis diff',abs(a-b).max(),flush=True)
