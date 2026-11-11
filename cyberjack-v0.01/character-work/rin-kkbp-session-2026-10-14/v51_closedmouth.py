#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v51 SINGLE FIX: bake 'Mouth Default, Closed' into Basis (closed mouth =
game neutral; teeth/oral-cavity stop poking through lips/chin).
Everything else byte-identical to accepted v37."""
import bpy, os, traceback, importlib, json, struct
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_KKBP_v37.blend"
BLEND_OUT = D + "/Rin_KKBP_v51.blend"
OUT_VRM = D + "/Rin_KKBP_v51.vrm"
LOG = D + "/v51.log"


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


try:
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")

    for target in ("Body", "Tongue"):
        ob = next((o for o in bpy.data.objects
                   if o.type == "MESH" and o.name.startswith(target)), None)
        if not ob or not ob.data.shape_keys:
            log("skipped " + target)
            continue
        sk = ob.data.shape_keys
        key = sk.key_blocks.get("Mouth Default, Closed")
        if key is None:
            log("no key on " + target)
            continue
        bpy.context.view_layer.objects.active = ob
        key.value = 1.0
        key.slider_max = 1.0
        sk.key_blocks["Basis"].value = 0.0
        bpy.ops.object.shape_key_remove(all=False)   # пекает активный key в Basis
        log("baked Closed into " + target)

    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
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
except Exception:
    log("EXC:\n" + traceback.format_exc())
    log("VRM_EXPORT_FAIL")