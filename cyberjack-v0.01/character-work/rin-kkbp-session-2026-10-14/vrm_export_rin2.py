#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Manual VRM humanoid mapping + expressions + export (no GUI context needed)."""
import bpy, addon_utils, os

BLEND = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v1.blend"
OUT_VRM = os.path.splitext(BLEND)[0] + ".vrm"

L3 = ["Thumb", "IndexFinger", "MiddleFinger", "RingFinger", "LittleFinger"]
VRM_F = {"Thumb": "thumb", "IndexFinger": "index", "MiddleFinger": "middle",
         "RingFinger": "ring", "LittleFinger": "little"}
D3 = {"0": "Proximal", "1": "Intermediate", "2": "Distal"}

MAP = {
    "hips": "Hips", "spine": "Spine", "chest": "Chest", "upperChest": "Upper Chest",
    "neck": "Neck", "head": "Head",
    "leftShoulder": "Left shoulder", "leftUpperArm": "Left arm",
    "leftLowerArm": "Left elbow", "leftHand": "Left wrist",
    "leftUpperLeg": "Left leg", "leftLowerLeg": "Left knee",
    "leftFoot": "Left ankle", "leftToes": "Left toe",
    "leftEye": "Left Eye", "rightEye": "Right Eye",
    "rightShoulder": "Right shoulder", "rightUpperArm": "Right arm",
    "rightLowerArm": "Right elbow", "rightHand": "Right wrist",
    "rightUpperLeg": "Right leg", "rightLowerLeg": "Right knee",
    "rightFoot": "Right ankle", "rightToes": "Right toe",
}
# fingers
vrm_side = {"L": "left", "R": "right"}
for side in ("L", "R"):
    s = vrm_side[side]
    for base, key in VRM_F.items():
        for i, d in D3.items():
            MAP[f"{s}{key}{d}"] = f"{base}{i}_{side}"

addon_utils.enable("bl_ext.user_default.vrm")
bpy.ops.wm.open_mainfile(filepath=BLEND)
addon_utils.enable("bl_ext.user_default.vrm")

arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
bpy.context.view_layer.objects.active = arm

hb = arm.data.vrm_addon_extension.vrm1.humanoid.human_bones
mapped, missing = [], []
for key, bone in MAP.items():
    pb = arm.pose.bones.get(bone)
    if not pb:
        missing.append((key, bone))
        continue
    setattr(getattr(hb, key), "node", pb)
    mapped.append(key)
print("mapped:", len(mapped), "missing:", missing, flush=True)

# expressions (worked via op before)
import bpy.ops as bops
try:
    with bpy.context.temp_override(object=arm, active_object=arm,
                                   selected_objects=[arm]):
        print("expressions:", bops.vrm.assign_vrm1_expressions_automatically(
            "EXEC_DEFAULT"), flush=True)
except Exception as e:
    print("expressions op err:", repr(e)[:120], flush=True)

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