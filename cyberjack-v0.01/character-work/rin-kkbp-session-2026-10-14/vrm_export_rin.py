#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""KKBP blend -> VRM export (Blender VRM add-on 4.10)."""
import bpy, addon_utils, os, traceback

BLEND = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v1.blend"
OUT_VRM = os.path.splitext(BLEND)[0] + ".vrm"

r = addon_utils.enable("bl_ext.user_default.vrm")
print("vrm enable:", r, flush=True)

bpy.ops.wm.open_mainfile(filepath=BLEND)
# re-enable after load (scene load drops addon runtime state? safe to re-enable)
addon_utils.enable("bl_ext.user_default.vrm")

arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
bpy.context.view_layer.objects.active = arm
print("armature:", arm.name, "| bones:", len(arm.data.bones), flush=True)
print("bones:", [b.name for b in arm.data.bones][:18], flush=True)

import bpy.ops as bops
vrmops = [o for o in dir(bops.vrm) if "humanoid" in o or "auto" in o]
print("humanoid ops:", vrmops, flush=True)

for opname in ("assign_vrm1_humanoid_human_bones_automatically",
               "apply_humanoid_t_pose",
               "assign_vrm1_expressions_automatically",
               "assign_spring_bone1_automatically"):
    if hasattr(bops.vrm, opname):
        try:
            with bpy.context.temp_override(object=arm, active_object=arm,
                                           selected_objects=[arm]):
                res = getattr(bops.vrm, opname)("EXEC_DEFAULT")
            print("op:", opname, "->", res, flush=True)
        except Exception as e:
            print("op FAILED:", opname, repr(e)[:150], flush=True)
    else:
        print("op missing:", opname, flush=True)

# humanoid mapping sanity check
try:
    hb = arm.data.vrm_addon_extension.vrm1.humanoid.human_bones
    mapped = {name: getattr(hb, name).node.bone_name
              for name in ("hips", "spine", "chest", "head", "left_upper_arm",
                           "right_lower_leg") if getattr(hb, name).node}
    print("humanoid mapped:", mapped, flush=True)
except Exception as e:
    print("humanoid check err:", repr(e)[:120], flush=True)

meta = arm.data.vrm_addon_extension.vrm1.meta
meta.vrm_name = "Рин"
meta.author = "cyberkitty"
arm.data.vrm_addon_extension.spec_version = "1.0"
print("meta:", meta.vrm_name, flush=True)

bpy.ops.wm.save_as_mainfile(filepath=BLEND)
res = bpy.ops.export_scene.vrm(filepath=OUT_VRM,
                               use_addon_preferences=False,
                               export_invisibles=False,
                               export_only_selections=False,
                               ignore_warning=True)
print("export:", res, flush=True)
ok = os.path.exists(OUT_VRM)
print("exported:", OUT_VRM, os.path.getsize(OUT_VRM) if ok else -1, flush=True)
print("VRM_EXPORT_OK" if ok and res == {"FINISHED"} else "VRM_EXPORT_FAIL", flush=True)