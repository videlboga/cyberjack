#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54 bake via evaluated mesh (previous attempt moved 0 verts because
the export evaluates live shape values; KKBP left 'Mouth Default'=1).
Steps: values Default=0, Closed=1 -> copy evaluated vertices -> Basis;
remove the now-redundant closed key. Tongue: def_cl=1 -> same."""
import bpy, os, traceback, importlib, struct, json
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_KKBP_v37.blend"
BLEND_OUT = D + "/Rin_KKBP_v54.blend"
OUT_VRM = D + "/Rin_KKBP_v54.vrm"
LOG = D + "/v54.log"


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def bake_via_eval(ob, zero=(), one=(), keep=(), drop=()):
    zero, one, keep, drop = map(list, (zero, one, keep, drop))
    sk = ob.data.shape_keys
    for nm in zero + one + keep:
        if nm in sk.key_blocks:
            sk.key_blocks[nm].value = 1.0 if nm in one else 0.0
    bpy.context.view_layer.objects.active = ob
    deps = bpy.context.evaluated_depsgraph_get()
    ob_eval = ob.evaluated_get(deps)
    eval_mesh = ob_eval.to_mesh()
    moved = 0
    for i, v in enumerate(ob.data.vertices):
        c = eval_mesh.vertices[i].co
        if v.co != c:
            v.co = c
            moved += 1
    ob_eval.to_mesh_clear()
    for nm in drop:
        kb = sk.key_blocks.get(nm)
        if kb is not None:
            ob.active_shape_key_index = sk.key_blocks.find(nm)
            bpy.ops.object.shape_key_remove(all=False)
    log("baked %s: moved=%d" % (ob.name[:20], moved))


try:
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")

    body = next(o for o in bpy.data.objects
                if o.type == "MESH" and o.name.startswith("Body"))
    bake_via_eval(
        body,
        zero=["Mouth Default", "Mouth Open"],
        one=("Mouth Default, Closed",),
        keep=(),
        drop=("Mouth Default, Closed",))

    tong = next((o for o in bpy.data.objects
                 if o.type == "MESH" and o.name.startswith("Tongue")), None)
    if tong:
        tong.hide_render = False
        tong.hide_viewport = False
        for vl in bpy.context.scene.view_layers:
            try:
                tong.hide_set(False)
            except Exception:
                pass
        bake_via_eval(tong,
                      one=("eye_face.f00_def_cl",),
                      drop=("eye_face.f00_def_cl",))

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