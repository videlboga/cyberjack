#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v53 REAL bake: copy the closed-morph target vertices into Basis
(previous shape_key_remove was a no-op without mixing).
  Body:  'Mouth Default, Closed'
  Tongue:'eye_face.f00_def_cl'
Everything else = v37."""
import bpy, os, traceback, importlib, json, struct
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_KKBP_v37.blend"
BLEND_OUT = D + "/Rin_KKBP_v53.blend"
OUT_VRM = D + "/Rin_KKBP_v53.vrm"
LOG = D + "/v53.log"


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def real_bake(ob, key_name):
    mesh = ob.data
    sk = mesh.shape_keys
    key = sk.key_blocks.get(key_name)
    if key is None:
        log("no key %r on %s" % (key_name, ob.name[:24]))
        return False
    moved = 0
    for i, v in enumerate(mesh.vertices):
        tgt = key.data[i].co          # абсолютные координаты цели морфа
        if v.co != tgt:
            v.co = tgt
            moved += 1
    ob.active_shape_key_index = sk.key_blocks.find(key.name)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.shape_key_remove(all=False)
    log("baked %s into %s: verts moved=%d"
        % (key_name, ob.name[:24], moved))
    return True


try:
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")

    for ob_name, key_name in (("Body", "Mouth Default, Closed"),
                              ("Tongue", "eye_face.f00_def_cl")):
        ob = next((o for o in bpy.data.objects
                   if o.type == "MESH" and o.name.startswith(ob_name)), None)
        if ob:
            if ob_name == "Tongue":
                ob.hide_render = False
                ob.hide_viewport = False
                for vl in bpy.context.scene.view_layers:
                    try:
                        ob.hide_set(False)
                    except Exception:
                        pass
            real_bake(ob, key_name)

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