#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v29: hide Gag Eyes/Tears overlays, kill eye emissive, export Rin_KKBP_v29.vrm."""
import bpy, os, traceback, importlib
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_KKBP_v28.blend"
BLEND_OUT = D + "/Rin_KKBP_v29.blend"
OUT_VRM = D + "/Rin_KKBP_v29.vrm"
LOG = D + "/v29.log"


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def main():
    log("=== v29")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")

    # 1) скрыть оверлеи (morph-triggered слои, в базе не нужны)
    for nm in ("Gag Eyes", "Tears"):
        ob = next((o for o in bpy.data.objects
                   if o.type == "MESH" and o.name.startswith(nm)), None)
        if ob:
            ob.hide_render = True
            ob.hide_viewport = True
            log("hidden " + ob.name[:30])

    # 2) глаза: emissive 0
    body = next(o for o in bpy.data.objects
                if o.type == "MESH" and o.name.startswith("Body"))
    for ms in body.material_slots:
        m = ms.material
        if not m:
            continue
        if not ("eye" in m.name.lower() or "hitomi" in m.name.lower() or
                "sirome" in m.name.lower()):
            continue
        mt = m.vrm_addon_extension.mtoon1
        if mt:
            try:
                mt.emission_color_factor = (0, 0, 0)
            except Exception:
                pass
        if m.node_tree:
            for n in m.node_tree.nodes:
                if n.type == "BSDF_PRINCIPLED":
                    n.inputs["Emission Color"].default_value = (0, 0, 0, 1)
                    n.inputs["Emission Strength"].default_value = 0.0
                if n.type == "EMISSION":
                    for ii in n.inputs:
                        if ii.name == "Strength":
                            ii.default_value = 0.0
        try:
            ext = getattr(m, "vrm_addon_extension", None)
            if ext and ext.mtoon1:
                ext.mtoon1.emissive_texture.index.source = None
                ext.mtoon1.khr_materials_emissive_strength.emissive_strength = 0
        except Exception:
            pass
    log("eyes emissive killed")

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