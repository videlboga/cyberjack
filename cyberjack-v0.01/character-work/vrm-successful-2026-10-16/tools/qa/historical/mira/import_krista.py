import bpy,addon_utils,json
from pathlib import Path
SRC=Path('/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/Export_PMX/20261016013030_KamiwataKrista')
OUT=Path('/home/cyberkitty/Documents/Codex/2026-10-15/x20/outputs/krista_four_outfits');OUT.mkdir(exist_ok=True)
for mod in ['bl_ext.user_default.mmd_tools','bl_ext.user_default.kkbp']:addon_utils.enable(mod,default_set=True,persistent=True)
s=bpy.context.scene.kkbp;s.prep_dropdown='VRM';s.simp_dropdown='B';s.atlas_dropdown='Atlas';s.use_rigify=False;s.sfw_mode=False;s.separate_clothes=False
res=bpy.ops.kkbp.kkbpimport('EXEC_DEFAULT',filepath=str(SRC/'model.pmx'));assert res=={'FINISHED'},res
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE');assert any(o.type=='MESH' and o.name.startswith('Body') for o in bpy.data.objects)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Krista_KKBP_source.blend'))
(OUT/'import_inventory.json').write_text(json.dumps({'objects':[{'name':o.name,'type':o.type,'visible':o.visible_get(),'vertices':len(o.data.vertices) if o.type=='MESH' else None,'materials':[m.name if m else None for m in o.data.materials] if o.type=='MESH' else []} for o in bpy.data.objects],'bones':[b.name for b in arm.data.bones]},ensure_ascii=False,indent=2))
print('KRISTA_IMPORT_DONE',flush=True)
