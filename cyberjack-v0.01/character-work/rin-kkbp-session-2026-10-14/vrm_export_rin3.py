#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""KKBP blend -> VRM export via VRM add-on operators, run under Xvfb (window ctx)."""
import bpy, addon_utils, os

BLEND = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v1.blend"
OUT_VRM = os.path.splitext(BLEND)[0] + ".vrm"

addon_utils.enable("bl_ext.user_default.vrm")
bpy.ops.wm.open_mainfile(filepath=BLEND)
addon_utils.enable("bl_ext.user_default.vrm")

arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
bpy.context.view_layer.objects.active = arm
bpy.context.view_layer.objects.link = bpy.context.view_layer.objects.link

import bpy.ops as bops
for opname in ("assign_vrm1_humanoid_human_bones_automatically",
               "assign_vrm1_expressions_automatically",
               "apply_humanoid_t_pose",
               "assign_spring_bone1_automatically"):
    op = getattr(bops.vrm, opname, None)
    if op is None:
        print("op missing:", opname, flush=True)
        continue
    try:
        res = op("EXEC_DEFAULT")
        print("op:", opname, "->", res, flush=True)
    except Exception as e:
        print("op err:", opname, repr(e)[:150], flush=True)

try:
    hb = arm.data.vrm_addon_extension.vrm1.humanoid.human_bones
    print("hips node:", hb.hips.node.bone_name if hb.hips.node else "EMPTY", flush=True)
except Exception as e:
    print("check err:", repr(e)[:120], flush=True)

meta = arm.data.vrm_addon_extension.vrm1.meta
meta.vrm_name = "Рин"
meta.author = "cyberkitty"
arm.data.vrm_addon_extension.spec_version = "1.0"

bpy.ops.wm.save_as_mainfile(filepath=BLEND)
res = bpy.ops.export_scene.vrm(filepath=OUT_VRM,
                               use_addon_preferences=False,
                               export_invisibles=False,
                               export_only_selections=False,
                               ignore_warning=True)
ok = res == {"FINISHED"} and os.path.exists(OUT_VRM)
print("export:", res, os.path.getsize(OUT_VRM) if os.path.exists(OUT_VRM) else -1,
      flush=True)
print("VRM_EXPORT_OK" if ok else "VRM_EXPORT_FAIL", flush=True)
bpy.ops.wm.quit_blender()