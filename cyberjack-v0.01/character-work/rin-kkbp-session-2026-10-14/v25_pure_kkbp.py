#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v25: PURE KKBP route. Base Rin_KKBP_v4.blend.
- verify/kill any Bonelyfan duplicate layers
- numeric chest poke measurement (no pushes!)
- lens alpha
- export Rin_KKBP_v5_final.vrm"""
import bpy, os, traceback, importlib
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_KKBP_v4.blend"
BLEND_OUT = D + "/Rin_KKBP_v5_final.blend"
OUT_VRM = D + "/Rin_KKBP_v5_final.vrm"
LOG = D + "/v25.log"


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def main():
    log("=== v25 pure KKBP")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")

    # 1) дубли-слои Bonelyfan/hit-shell: удалить поли
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        kill = [i for i, ms in enumerate(o.material_slots)
                if ms.material and ("Bonelyfan" in ms.material.name)]
        if kill:
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.select_all(action="DESELECT")
            for p in o.data.polygons:
                if p.material_index in kill:
                    p.select = True
            bpy.ops.mesh.delete(type="VERT")
            bpy.ops.object.mode_set(mode="OBJECT")
            log("removed dup-layer faces on " + o.name)

    # 2) численный замер груди: тело vs топ
    body = next(o for o in bpy.data.objects
                if o.type == "MESH" and o.name.startswith("Body"))
    outfit = next(o for o in bpy.data.objects
                  if o.type == "MESH" and o.name.startswith("Outfit"))
    wb, wo = body.matrix_world, outfit.matrix_world
    bf = 1e9
    tf = 1e9
    for p in body.data.polygons:
        c = wb @ p.center
        if abs(c.x) < 0.16 and c.y < 0.05 and 1.12 <= c.z <= 1.34:
            mat = body.data.materials[p.material_index].name
            if "body" in mat:
                bf = min(bf, c.y)
    for p in outfit.data.polygons:
        c = wo @ p.center
        if abs(c.x) < 0.16 and c.y < 0.05 and 1.12 <= c.z <= 1.34:
            mat = outfit.data.materials[p.material_index].name
            if "top" in mat:
                tf = min(tf, c.y)
    log("CHEST: body front y=%.4f, top front y=%.4f, poke=%.1f mm" %
        (bf, tf, (bf - tf) * 1000 if tf > bf else 0))

    # 3) линзы
    for m in bpy.data.materials:
        if "lens" in m.name.lower():
            mt = m.vrm_addon_extension.mtoon1
            if mt:
                mt.enabled = True
                mt.alpha_mode = "BLEND"
                mt.pbr_metallic_roughness.base_color_factor = (1, 1, 1, 0.25)
                try:
                    mt.pbr_metallic_roughness.base_color_texture.index.source = None
                except Exception:
                    pass
                log("lens fixed " + m.name)

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


try:
    main()
except Exception:
    log("EXC:\n" + traceback.format_exc())
    log("VRM_EXPORT_FAIL")