#!/usr/bin/env python3
import bpy, os, traceback, importlib
from pathlib import Path
D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN  = D + "/Rin_KKBP_v36.blend"
BLEND_OUT = D + "/Rin_Hybrid_v44_FINAL.blend" if False else D + "/Rin_KKBP_v44.blend"
OUT_VRM   = D + "/Rin_KKBP_v44.vrm"
LOG       = D + "/v44.log"
E = ("/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine "
     "BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/"
     "Export_PMX/20261014190816_\u6625\u91ce\u5343\u4f73")
GREEN = (92/255.0, 149/255.0, 109/255.0, 1.0)
def log(m):
    with open(LOG, "a") as f: f.write(str(m)+"\n")
    print(m, flush=True)
def loadimg(p):
    key = os.path.basename(p)
    img = bpy.data.images.get(key) or bpy.data.images.load(p)
    return img
try:
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    body = next(o for o in bpy.data.objects
                if o.type == "MESH" and o.name.startswith("Body"))
    wired = 0
    for ms in body.material_slots:
        m = ms.material
        if not m or m.name.startswith("Outline"): 
            continue
        base = m.name.split(".")[0]
        short = base.split(" ", 1)[-1]              # снимаем "KK "
        p = os.path.join(E, short + "_MT_CT.png")
        if not os.path.exists(p):
            log("no raw: " + short[:34])
            continue
        img = loadimg(p)
        mt = m.vrm_addon_extension.mtoon1
        if mt and mt.enabled:
            mt.pbr_metallic_roughness.base_color_texture.index.source = img
            mt.pbr_metallic_roughness.base_color_factor = (1,1,1,1)
            wired += 1
    log("body raw wired=%d" % wired)
    for m in bpy.data.materials:
        if "hitomi" in m.name.lower():
            mt = m.vrm_addon_extension.mtoon1
            if mt and mt.enabled:
                mt.pbr_metallic_roughness.base_color_factor = GREEN
    log("hitomi green ok")
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    log("saved " + BLEND_OUT)
    wm2 = bpy.context.window_manager
    win = wm2.windows[0] if wm2.windows else bpy.context.window
    area = next(a for a in win.screen.areas if a.type == "VIEW_3D")
    region = next(r for r in area.regions if r.type == "WINDOW")
    ctx = dict(window=win, screen=win.screen, area=area, region=region,
               object=arm, active_object=arm, selected_objects=[arm])
    exporter = importlib.import_module("bl_ext.user_default.vrm.exporter.export_scene")
    class Shim:
        def __init__(self):
            self.use_addon_preferences=False; self.export_invisibles=False
            self.export_only_selections=False; self.enable_advanced_preferences=True
            self.export_fb_ngon_encoding=False; self.export_all_influences=False
            self.export_lights=False; self.export_gltf_animations=False
            self.export_try_sparse_sk=False; self.errors={}
            self.armature_object_name=arm.name; self.ignore_warning=True
        def __getattr__(self, name): return False
    with bpy.context.temp_override(**ctx):
        exporter._export_vrm(Path(OUT_VRM), Shim(), bpy.context,
                             armature_object_name=arm.name)
    log("export size %.1f MB" % (os.path.getsize(OUT_VRM)/1e6 if os.path.exists(OUT_VRM) else -1))
    log("VRM_EXPORT_OK" if os.path.exists(OUT_VRM) else "VRM_EXPORT_FAIL")
    bpy.ops.wm.quit_blender()
except Exception:
    import traceback
    log("EXC:\n"+traceback.format_exc()); log("VRM_EXPORT_FAIL")
