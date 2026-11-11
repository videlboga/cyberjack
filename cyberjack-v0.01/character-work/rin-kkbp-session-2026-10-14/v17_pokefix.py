#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v17: chest poke fix on hybrid — push outfit chest verts outside body surface."""
import bpy, os, traceback, importlib
from mathutils import Vector
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_Hybrid_v9.blend"
BLEND_OUT = D + "/Rin_Hybrid_v9b.blend"
OUT_VRM = D + "/Rin_Hybrid_v9.vrm"
LOG = D + "/v17.log"


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def main():
    log("=== v17 chest poke fix")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")

    out_mesh = next((o for o in bpy.data.objects
                     if o.type == "MESH" and "Outfit mmd" in o.name), None)
    body = next((o for o in bpy.data.objects
                 if o.type == "MESH" and o.name.startswith("Body")), None)
    if not out_mesh or not body:
        raise RuntimeError("objects missing")

    wo = out_mesh.matrix_world
    wb = body.matrix_world

    # тело: карта поверхности по столбцам (x,z) -> минимальный y (перед)
    import collections
    colmap = collections.defaultdict(lambda: 1e9)
    for p in body.data.polygons:
        c = wb @ p.center
        if abs(c.x) < 0.30 and c.y < 0.15 and 0.9 <= c.z <= 1.5:
            key = (round(c.x, 2), round(c.z, 2))
            colmap[key] = min(colmap[key], c.y)

    def body_front(x, z, y_hint):
        best = None
        for dx in (-0.02, 0.0, 0.02):
            for dz in (-0.02, 0.0, 0.02):
                k = (round(x + dx, 2), round(z + dz, 2))
                if k in colmap:
                    cy = colmap[k]
                    if best is None or cy < best:
                        best = cy
        return best

    MARGIN = -0.006  # 6 мм перед поверхностью тела
    pushed = 0
    maxy = 0.0
    for v in out_mesh.data.vertices:
        c = wo @ v.co
        if c.y < 0.10 and 1.00 <= c.z <= 1.45 and abs(c.x) < 0.26:
            bf = body_front(c.x, c.z, c.y)
            if bf is None:
                continue
            limit = bf + MARGIN
            if c.y > limit:
                delta = limit - c.y
                # двигаем по Y (перед)
                nv = v.co.copy()
                v_local = out_mesh.matrix_world.inverted() @ Vector(
                    (c.x, c.y + delta, c.z))
                v.co = v_local
                pushed += 1
                maxy = max(maxy, -delta)
    log("chest verts pushed=%d max_shift=%.4f" % (pushed, maxy))
    out_mesh.data.update()

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