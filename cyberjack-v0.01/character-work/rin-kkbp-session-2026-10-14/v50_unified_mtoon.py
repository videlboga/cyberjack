#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v50: unified MToon. Base = v37.
- ALL visible mats -> mtoon enabled (body/face/eyes/teeth/tongue/outfit)
- Outline shells -> disabled everywhere
- megane frames reverted to disabled
- lens untouched (BLEND)
- tongue visible again (it was NOT the mouth culprit)
- top OPAQUE"""
import bpy, os, traceback, importlib, json, struct
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_KKBP_v37.blend"
BLEND_OUT = D + "/Rin_KKBP_v50.blend"
OUT_VRM = D + "/Rin_KKBP_v50.vrm"
E = ("/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine "
     "BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/"
     "Export_PMX/20261014190816_春野千佳")
LOG = D + "/v50.log"


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


try:
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    body = next(o for o in bpy.data.objects
                if o.type == "MESH" and o.name.startswith("Body"))
    outfit = next(o for o in bpy.data.objects
                  if o.type == "MESH" and o.name.startswith("Outfit"))

    on = off = 0
    for ob in (body, outfit):
        for ms in ob.material_slots:
            m = ms.material
            if not m:
                continue
            mt = getattr(m, "vrm_addon_extension", None)
            mt = mt.mtoon1 if mt else None
            if mt is None:
                continue
            if m.name.startswith("Outline"):
                mt.enabled = False
                off += 1
            else:
                low = m.name.lower()
                if "megane" in low:
                    mt.enabled = False   # откат оправы (регресс v49)
                    off += 1
                    continue
                if not mt.enabled:
                    mt.enabled = True
                    on += 1
                if "top" in low:
                    mt.alpha_mode = "OPAQUE"
                if "tooth" in low or "tang" in low:
                    mt.alpha_mode = "OPAQUE"
            try:
                mt.khr_materials_emissive_strength.emissive_strength = 0.0
            except Exception:
                pass
    log("mtoon on=%d off=%d" % (on, off))

    gag = next((o for o in bpy.data.objects
                if o.type == "MESH" and o.name.startswith("Gag")), None)
    tears = next((o for o in bpy.data.objects
                  if o.type == "MESH" and o.name.startswith("Tears")), None)
    for ob in (gag, tears):
        if ob:
            ob.hide_render = True
            ob.hide_viewport = True
    log("gag/tears hidden, tongue visible")

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    log("saved " + BLEND_OUT)

    wm2 = bpy.context.window_manager
    win = wm2.windows[0] if wm2.windows else bpy.context.window
    area = next(a for a in win.screen.areas if a.type == "VIEW_3D")
    region = next(r for r in area.regions if r.type == "WINDOW")
    ctx = dict(window=win, screen=win.screen, area=area, region=region,
               object=arm, active_object=arm, selected_objects=[arm])
    exporter = importlib.import_module(
        "bl_ext.user_default.vrm.exporter.export_scene")

    class Shim:
        def __init__(self):
            self.use_addon_preferences = False
            self.export_invisibles = False
            self.export_only_selections = False
            self.enable_advanced_preferences = True
            self.export_fb_ngon_encoding = False
            self.export_all_influences = False
            self.export_lights = False
            self.export_gltf_animations = False
            self.export_try_sparse_sk = False
            self.errors = {}
            self.armature_object_name = arm.name
            self.ignore_warning = True

        def __getattr__(self, name):
            return False

    with bpy.context.temp_override(**ctx):
        exporter._export_vrm(Path(OUT_VRM), Shim(), bpy.context,
                             armature_object_name=arm.name)
    size = os.path.getsize(OUT_VRM) if os.path.exists(OUT_VRM) else -1
    log("export size %.1f MB" % (size / 1e6))
    if os.path.exists(OUT_VRM):
        with open(OUT_VRM, "rb") as f:
            f.read(12)
            clen, _ = struct.unpack("<I4s", f.read(8))
            js = json.loads(f.read(clen))
        tot = len(js["materials"])
        mtoon = sum(1 for m in js["materials"]
                    if "VRMC_materials_mtoon" in m.get("extensions", {}))
        log("GLB mtoon=%d/%d size=%.1fMB" % (mtoon, tot, size / 1e6))
    log("VRM_EXPORT_OK" if size > 0 else "VRM_EXPORT_FAIL")
    bpy.ops.wm.quit_blender()
except Exception:
    log("EXC:\n" + traceback.format_exc())
    log("VRM_EXPORT_FAIL")