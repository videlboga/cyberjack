#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v6: export only (mapping already saved in blend)."""
import bpy, os, traceback

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
    log("blend opened, addon enabled")

    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    hb = arm.data.vrm_addon_extension.vrm1.humanoid.human_bones
    log("hips check: " + str(hb.hips.node.bone_name if hb.hips.node else "EMPTY"))
    if not hb.hips.node:
        log("VRM_EXPORT_FAIL (no humanoid mapping)")
        bpy.ops.wm.quit_blender()
        return
    bpy.context.view_layer.objects.active = arm

    meta = arm.data.vrm_addon_extension.vrm1.meta
    log("meta: " + str(meta.vrm_name))

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
    main()
except Exception:
    log("EXCEPTION:\n" + traceback.format_exc())
    log("VRM_EXPORT_FAIL")
    try:
        bpy.ops.wm.quit_blender()
    except Exception:
        pass