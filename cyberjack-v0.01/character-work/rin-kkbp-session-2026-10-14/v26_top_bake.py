#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v26: top -> pre_light bake (folds), eyeline/tears -> BLEND, export Rin_KKBP_v26.vrm."""
import bpy, os, traceback, importlib
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_KKBP_v5_final.blend"
BLEND_OUT = D + "/Rin_KKBP_v26.blend"
OUT_VRM = D + "/Rin_KKBP_v26.vrm"
TOP_BAKE = ("/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine "
            "BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/"
            "Export_PMX/20261014190816_春野千佳/Outfit 00/pre_light/"
            "cm_m_top_inner02 8080_light.png")
LOG = D + "/v26.log"


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def main():
    log("=== v26")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")

    outfit = next(o for o in bpy.data.objects
                  if o.type == "MESH" and o.name.startswith("Outfit"))
    # 1) топ -> запекалка
    for ms in outfit.material_slots:
        m = ms.material
        if m and "top" in m.name:
            mt = m.vrm_addon_extension.mtoon1
            img = bpy.data.images.get(os.path.basename(TOP_BAKE))
            if img is None:
                img = bpy.data.images.load(TOP_BAKE)
            mt.pbr_metallic_roughness.base_color_texture.index.source = img
            mt.pbr_metallic_roughness.base_color_factor = (1, 1, 1, 1)
            log("top -> bake")

    # 2) eyeline/слёзы/белки: BLEND (их текстуры с альфой)
    out_mesh = next((o for o in bpy.data.objects
                     if o.type == "MESH" and o.name.startswith("Body")), None)
    if out_mesh:
        for ms in out_mesh.material_slots:
            m = ms.material
            if not m:
                continue
            low = m.name.lower()
            if not any(k in low for k in ("eyeline", "namida", "sirome")):
                continue
            mt = m.vrm_addon_extension.mtoon1
            if mt and mt.enabled:
                mt.alpha_mode = "BLEND"
                log("blend " + m.name[:34])

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
    log("VRM_EXPORT_OK" if size > 0 else "VRM_EXPORT_FAIL")
    bpy.ops.wm.quit_blender()


try:
    main()
except Exception:
    log("EXC:\n" + traceback.format_exc())
    log("VRM_EXPORT_FAIL")