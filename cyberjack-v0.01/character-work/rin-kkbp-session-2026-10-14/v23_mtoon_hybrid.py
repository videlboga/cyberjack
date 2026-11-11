#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v23: hybrid materials -> real MToon (enable + convert op) + soften shade + export v14."""
import bpy, os, traceback, importlib
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_Hybrid_v13.blend"
BLEND_OUT = D + "/Rin_Hybrid_v14.blend"
OUT_VRM = D + "/Rin_Hybrid_v14.vrm"
LOG = D + "/v23.log"


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def main():
    log("=== v23 mtoon re-enable + convert")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")

    meshes = [o for o in bpy.data.objects if o.type == "MESH" and
              (o.name.startswith("model_mesh") or "Outfit mmd" in o.name)]
    mats = []
    for o in meshes:
        for ms in o.material_slots:
            if ms.material and not ms.material.name.startswith("Outline"):
                mats.append(ms.material)
    mats = sorted(set(mats), key=lambda m: m.name)
    ok, bad = 0, []
    for m in mats:
        ext = getattr(m, "vrm_addon_extension", None)
        mt = ext.mtoon1 if ext else None
        if mt is None or not mt.enabled:
            try:
                bpy.ops.vrm.convert_material_to_mtoon1(material_name=m.name)
                m2m = bpy.data.materials[m.name].vrm_addon_extension.mtoon1
                if not m2m.enabled:
                    m2m.enabled = True
                ok += 1
            except Exception as e:
                bad.append((m.name, repr(e)[:80]))
                continue
        else:
            ok += 1
    log("mtoon enabled/converted %d / bad %s" % (ok, repr(bad)[:200]))

    soft = 0
    for m in mats:
        mt = m.vrm_addon_extension.mtoon1
        if not mt or not mt.enabled:
            continue
        try:
            mt.shading_toony_factor = 0.0
            mt.vrmc_materials_mtoon.shade_color_factor = (0.85, 0.80, 0.85)
            soft += 1
        except Exception as e:
            if soft == 0:
                log("shade err first: " + m.name[:24] + " " + repr(e)[:100])
    log("shade softened=%d" % soft)

    # линзы прозрачные заново (конверт перезатёр)
    for m in mats:
        if "lens" in m.name.lower():
            mt = m.vrm_addon_extension.mtoon1
            if mt and mt.enabled:
                try:
                    mt.pbr_metallic_roughness.base_color_factor = (1, 1, 1, 0.25)
                    mt.pbr_metallic_roughness.base_color_texture.index.source = None
                    mt.alpha_mode = "BLEND"
                except Exception as e:
                    log("lens err " + repr(e)[:60])
    log("lens ok")

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