#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Phase 2: export Rin_KKBP_v2 blend -> vrm (proven direct path)."""
import bpy, os, traceback, importlib

BLEND = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v3.blend"
OUT_VRM = os.path.splitext(BLEND)[0] + ".vrm"
LOG = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/mtoon.log"


def log(msg):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(msg) + "\n")
    print(msg, flush=True)


def main():
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    hb = arm.data.vrm_addon_extension.vrm1.humanoid.human_bones
    log("hips: " + str(hb.hips.node.bone_name if hb.hips.node else "EMPTY"))
    bpy.context.view_layer.objects.active = arm

    exporter = importlib.import_module(
        "bl_ext.user_default.vrm.exporter.export_scene")
    from pathlib import Path

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

    wm = bpy.context.window_manager
    win = wm.windows[0] if wm.windows else None
    area = next(a for a in win.screen.areas if a.type == "VIEW_3D") if win else None
    region = next(r for r in area.regions if r.type == "WINDOW") \
        if area else None
    log("export start")
    with bpy.context.temp_override(window=win, screen=win.screen, area=area,
                                   region=region, object=arm,
                                   active_object=arm, selected_objects=[arm]):
        exporter._export_vrm(Path(OUT_VRM), Shim(), bpy.context,
                             armature_object_name=arm.name)
    log("export size: " + str(os.path.getsize(OUT_VRM) if
                              os.path.exists(OUT_VRM) else -1))
    log("VRM_EXPORT_OK" if os.path.exists(OUT_VRM) else "VRM_EXPORT_FAIL")
    bpy.ops.wm.quit_blender()


try:
    main()
except Exception:
    log("EXC:\n" + traceback.format_exc())
    log("VRM_EXPORT_FAIL")