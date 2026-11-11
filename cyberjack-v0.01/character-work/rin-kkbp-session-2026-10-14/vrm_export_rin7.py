#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v7: pull the REAL export error — run addon validator + exporter internals directly."""
import bpy, os, traceback, sys, importlib

BLEND = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v1.blend"
OUT_VRM = os.path.splitext(BLEND)[0] + ".vrm"
LOG = os.path.splitext(BLEND)[0] + "_export.log"


def log(msg):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(msg) + "\n")
    print(msg, flush=True)


def main():
    import addon_utils
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    log("prefs.addons keys: " +
        str([k for k in bpy.context.preferences.addons.keys() if "vrm" in k]))

    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    hb = arm.data.vrm_addon_extension.vrm1.humanoid.human_bones
    log("hips: " + str(hb.hips.node.bone_name if hb.hips.node else "EMPTY"))

    # import addon internals
    modnames = [n for n in sys.modules if "vrm" in n and "editor" in n][:5]
    log("sys.modules vrm-ish: " + str(modnames))
    try:
        validation = importlib.import_module(
            "bl_ext.user_default.vrm.editor.validation")
        log("validation module imported")
        errors = []
        try:
            res = validation.detect_errors(
                bpy.context, errors, arm.name, execute_migration=True)
            log("detect_errors -> " + str(res))
        except Exception:
            log("detect_errors EXC:\n" + traceback.format_exc())
        for e in errors[:40]:
            log("ERROR ITEM: " + str(e)[:180])
    except Exception:
        log("import validation EXC:\n" + traceback.format_exc())

    # direct exporter call, bypassing the operator & dialog
    try:
        exporter = importlib.import_module(
            "bl_ext.user_default.vrm.exporter.export_scene")
        from pathlib import Path

        class _Shim:
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
        area = next((a for a in win.screen.areas if a.type == "VIEW_3D"),
                    None) if win else None
        region = next((r for r in area.regions if r.type == "WINDOW"),
                      None) if area else None
        if not (win and area and region):
            log("NO WINDOW CONTEXT — cannot export")
            raise RuntimeError("no window/area 3d context")
        log("context target: win/area=VIEW_3D ok")
        arm.select_set(True)
        bpy.context.view_layer.update()
        with bpy.context.temp_override(window=win, screen=win.screen,
                                       area=area, region=region,
                                       object=arm, active_object=arm,
                                       selected_objects=[arm]):
            glb = exporter._export_vrm(Path(OUT_VRM), _Shim(), bpy.context,
                                       armature_object_name=arm.name)
        log("direct export -> " + str(type(glb)) + " " +
            str(os.path.getsize(OUT_VRM) if os.path.exists(OUT_VRM) else -1))
        log("VRM_EXPORT_OK" if os.path.exists(OUT_VRM) else "VRM_EXPORT_FAIL")
    except Exception:
        log("direct export EXC:\n" + traceback.format_exc())
        log("VRM_EXPORT_FAIL")
    bpy.ops.wm.quit_blender()


try:
    main()
except Exception:
    log("EXCEPTION:\n" + traceback.format_exc())
    log("VRM_EXPORT_FAIL")