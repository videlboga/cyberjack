#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v47: base = accepted v37 blend.
(1) chest: top -> MT_CT + alphaMode OPAQUE (kill mod see-through alpha)
(2) mouth test: hide Tongue (rigged) object entirely (contours probe)
(3) eyes: keep v37 state (no tint, no re-alpha)"""
import bpy, os, traceback, importlib, json, struct
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_KKBP_v37.blend"
BLEND_OUT = D + "/Rin_KKBP_v47.blend"
OUT_VRM = D + "/Rin_KKBP_v47.vrm"
E = ("/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine "
     "BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/"
     "Export_PMX/20261014190816_春野千佳")
LOG = D + "/v47.log"


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


try:
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    outfit = next(o for o in bpy.data.objects
                  if o.type == "MESH" and o.name.startswith("Outfit"))

    # (1) топ -> MT_CT + OPAQUE
    img = bpy.data.images.get("cm_m_top_inner02 8080_MT_CT.png") or \
        bpy.data.images.load(os.path.join(E, "Outfit 00",
                                          "cm_m_top_inner02 8080_MT_CT.png"))
    for ms in outfit.material_slots:
        m = ms.material
        if m and "top" in m.name and "Outline" not in m.name:
            mt = m.vrm_addon_extension.mtoon1
            if mt and mt.enabled:
                mt.pbr_metallic_roughness.base_color_texture.index.source = img
                mt.pbr_metallic_roughness.base_color_factor = (1, 1, 1, 1)
                mt.alpha_mode = "OPAQUE"
                log("top OPAQUE " + m.name[:30])

    # (2) скрыть Tongue объект
    tongue = next((o for o in bpy.data.objects
                   if o.type == "MESH" and o.name.startswith("Tongue")), None)
    if tongue:
        tongue.hide_render = True
        tongue.hide_viewport = True
        log("hidden " + tongue.name[:30])
    gag = next((o for o in bpy.data.objects
                if o.type == "MESH" and o.name.startswith("Gag")), None)
    if gag:
        gag.hide_render = True
        gag.hide_viewport = True
        log("hidden " + gag.name[:30])

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
        meshes = [n.get("name", "") for n in js["nodes"] if "mesh" in n]
        ops = sum(1 for m in js["materials"]
                  if m.get("alphaMode") == "OPAQUE")
        log("GLB meshes=%s | OPAQUE mats=%d/%d" % (meshes, ops,
                                                   len(js["materials"])))
    log("VRM_EXPORT_OK" if size > 0 else "VRM_EXPORT_FAIL")
    bpy.ops.wm.quit_blender()
except Exception:
    log("EXC:\n" + traceback.format_exc())
    log("VRM_EXPORT_FAIL")