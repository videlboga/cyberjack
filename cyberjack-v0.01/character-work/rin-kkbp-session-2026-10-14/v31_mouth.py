#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v27: enable+alpha for face overlay materials (eyeline/namida/sirome/gag/tears),
alpha_mode via enum, verify in GLB, export Rin_KKBP_v27.vrm."""
import bpy, os, traceback, importlib
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_KKBP_v30.blend"
BLEND_OUT = D + "/Rin_KKBP_v31.blend"
OUT_VRM = D + "/Rin_KKBP_v31.vrm"
LOG = D + "/v31.log"

FACE_KEYS = ("eyeline", "namida", "sirome", "gageye", "tang", "tooth", "noseline", "mayuge")


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def main():
    log("=== v27 face overlays")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")

    done = 0
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        for ms in o.material_slots:
            m = ms.material
            if not m:
                continue
            low = m.name.lower()
            if not any(k in low for k in FACE_KEYS):
                continue
            ext = getattr(m, "vrm_addon_extension", None)
            mt = ext.mtoon1 if ext else None
            if mt is None:
                log("no ext " + m.name[:30])
                continue
            mt.enabled = True
            try:
                mt.alpha_mode = mt.ALPHA_MODE_BLEND
            except Exception:
                mt.alpha_mode = "BLEND"
            done += 1
            log("face-mat %s enabled+BLEND" % m.name[:34])
    log("face mats processed=%d" % done)

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
    if os.path.exists(OUT_VRM):
        import struct, json
        with open(OUT_VRM, "rb") as f:
            f.read(12)
            clen, _ = struct.unpack("<I4s", f.read(8))
            js = json.loads(f.read(clen))
        for m in js["materials"]:
            n = m.get("name", "")
            if any(k in n.lower() for k in FACE_KEYS):
                print("GLB %s | %s" % (n[:40], m.get("alphaMode", "OPAQUE")))
    log("VRM_EXPORT_OK" if size > 0 else "VRM_EXPORT_FAIL")
    bpy.ops.wm.quit_blender()


try:
    main()
except Exception:
    log("EXC:\n" + traceback.format_exc())
    log("VRM_EXPORT_FAIL")