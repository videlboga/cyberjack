#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v5: schedule work via app.timers (context ready) + preferences.addon_enable."""
import bpy, os, traceback

BLEND = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v1.blend"
OUT_VRM = os.path.splitext(BLEND)[0] + ".vrm"
LOG = os.path.splitext(BLEND)[0] + "_export.log"


def log(msg):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(msg) + "\n")
    print(msg, flush=True)


def main():
    log("timer tick")
    r = bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    log("addon_enable: " + str(r))
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    log("blend opened")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    log("addon re-enabled")

    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.context.view_layer.update()
    log("armature selected: " + arm.name)

    for opname in ("assign_vrm1_humanoid_human_bones_automatically",
                   "assign_vrm1_expressions_automatically",
                   "apply_humanoid_t_pose",
                   "assign_spring_bone1_automatically"):
        op = getattr(bpy.ops.vrm, opname, None)
        if op is None:
            log(f"op missing: {opname}")
            continue
        try:
            res = op("EXEC_DEFAULT", armature_object_name=arm.name)
            log(f"op: {opname} -> {res}")
        except Exception as e:
            log(f"op err: {opname} " + repr(e)[:200])

    try:
        hb = arm.data.vrm_addon_extension.vrm1.humanoid.human_bones
        log("hips: " + (hb.hips.node.bone_name if hb.hips.node else "EMPTY"))
    except Exception as e:
        log("check err: " + repr(e)[:200])

    meta = arm.data.vrm_addon_extension.vrm1.meta
    meta.vrm_name = "Рин"
    meta.author = "cyberkitty"
    arm.data.vrm_addon_extension.spec_version = "1.0"

    try:
        bpy.ops.wm.save_as_mainfile(filepath=BLEND)
        log("blend saved")
    except Exception:
        log("save err (dirty skip)")

    res = bpy.ops.export_scene.vrm(filepath=OUT_VRM,
                                   use_addon_preferences=False,
                                   export_invisibles=False,
                                   export_only_selections=False,
                                   ignore_warning=True)
    ok = res == {"FINISHED"} and os.path.exists(OUT_VRM)
    log("export: " + str(res) + " size: " +
        str(os.path.getsize(OUT_VRM) if os.path.exists(OUT_VRM) else -1))
    log("VRM_EXPORT_OK" if ok else "VRM_EXPORT_FAIL")
    bpy.ops.wm.quit_blender()


try:
    bpy.app.timers.register(main, first_interval=2)
except Exception:
    log("EXC register:\n" + traceback.format_exc())
    log("VRM_EXPORT_FAIL")
    bpy.ops.wm.quit_blender()