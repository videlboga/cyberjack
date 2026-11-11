#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""KKBP blend -> VRM under Xvfb; all steps logged to file; guaranteed quit."""
import bpy, addon_utils, os, traceback, sys

BLEND = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v1.blend"
OUT_VRM = os.path.splitext(BLEND)[0] + ".vrm"
LOG = os.path.splitext(BLEND)[0] + "_export.log"


def log(msg):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(msg) + "\n")
    print(msg, flush=True)


try:
    os.remove(LOG)
except OSError:
    pass
log("start")

try:
    addon_utils.enable("bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    addon_utils.enable("bl_ext.user_default.vrm")
    log("blend opened")

    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    bpy.context.view_layer.objects.active = arm
    log("armature selected")

    for opname in ("assign_vrm1_humanoid_human_bones_automatically",
                   "assign_vrm1_expressions_automatically",
                   "apply_humanoid_t_pose",
                   "assign_spring_bone1_automatically"):
        op = getattr(bpy.ops.vrm, opname, None)
        if op is None:
            log(f"op missing: {opname}")
            continue
        try:
            res = op("EXEC_DEFAULT")
            log(f"op: {opname} -> {res}")
        except Exception as e:
            log(f"op err: {opname} {repr(e)[:200]}")

    try:
        hb = arm.data.vrm_addon_extension.vrm1.humanoid.human_bones
        log("hips node: " + (hb.hips.node.bone_name if hb.hips.node else "EMPTY"))
    except Exception as e:
        log("check err: " + repr(e)[:200])

    meta = arm.data.vrm_addon_extension.vrm1.meta
    meta.vrm_name = "Рин"
    meta.author = "cyberkitty"
    arm.data.vrm_addon_extension.spec_version = "1.0"
    log("meta set")

    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    log("blend saved")
    res = bpy.ops.export_scene.vrm(filepath=OUT_VRM,
                                   use_addon_preferences=False,
                                   export_invisibles=False,
                                   export_only_selections=False,
                                   ignore_warning=True)
    ok = res == {"FINISHED"} and os.path.exists(OUT_VRM)
    log("export result: " + str(res) + " size: " +
        str(os.path.getsize(OUT_VRM) if os.path.exists(OUT_VRM) else -1))
    log("VRM_EXPORT_OK" if ok else "VRM_EXPORT_FAIL")
except Exception:
    log("EXCEPTION:\n" + traceback.format_exc())
    log("VRM_EXPORT_FAIL")
finally:
    try:
        bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    except Exception:
        pass
    bpy.ops.wm.quit_blender()