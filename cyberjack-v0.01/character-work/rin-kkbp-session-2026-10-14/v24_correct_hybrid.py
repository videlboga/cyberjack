#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v24: correct hybrid.
- base: Rin_Hybrid_v11.blend (no push!)
- convert all mmd mats to real MToon
- BODY/face materials -> pre_light baked textures (game skin tone)
- outfit chest -> SHRINKWRAP onto actual body surface (apply, offset 4mm)
- lens alpha, export Rin_Hybrid_v15.vrm"""
import bpy, os, traceback, importlib
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_Hybrid_v11.blend"
BLEND_OUT = D + "/Rin_Hybrid_v15.blend"
OUT_VRM = D + "/Rin_Hybrid_v15.vrm"
ROOT = ("/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine "
        "BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/"
        "Export_PMX/20261014190816_春野千佳")
LOG = D + "/v24.log"


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def find_img(paths):
    for p in paths:
        if os.path.exists(p):
            key = os.path.basename(p)
            img = bpy.data.images.get(key)
            if img is None:
                img = bpy.data.images.load(p)
                try:
                    img.name = key
                except Exception:
                    pass
            return img
    return None


def main():
    log("=== v24")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    body = next(o for o in bpy.data.objects
                if o.type == "MESH" and "model_mesh" in o.name)
    outfit = next((o for o in bpy.data.objects
                   if o.type == "MESH" and "Outfit mmd" in o.name), None)

    # --- 1) mtoon на все материалы обоих мешей
    mats = []
    for o in (body, outfit):
        for ms in o.material_slots:
            if ms.material and not ms.material.name.startswith("Outline"):
                mats.append(ms.material)
    mats = sorted(set(mats), key=lambda m: m.name)
    conv = 0
    for m in mats:
        ext = getattr(m, "vrm_addon_extension", None)
        mt = ext.mtoon1 if ext else None
        if mt is None or not mt.enabled:
            try:
                bpy.ops.vrm.convert_material_to_mtoon1(material_name=m.name)
                bpy.data.materials[m.name].vrm_addon_extension.mtoon1.enabled = True
                conv += 1
            except Exception as e:
                log("conv err " + m.name[:30] + " " + repr(e)[:70])
                continue
    log("mtoon converted %d" % conv)

    # --- 2) тело/лицо -> pre_light бэйки
    PRE = ROOT + "/pre_light/"
    body_swapped = 0
    for ms in body.material_slots:
        m = ms.material
        if not m or m.name.startswith("Outline"):
            continue
        base = m.name.split(".")[0]
        img = find_img([PRE + base + "_light.png"])
        if img is None:
            log("no bake for " + base[:30])
            continue
        mt = m.vrm_addon_extension.mtoon1
        if mt and mt.enabled:
            mt.pbr_metallic_roughness.base_color_texture.index.source = img
            mt.pbr_metallic_roughness.base_color_factor = (1, 1, 1, 1)
            body_swapped += 1
    log("body mats wired=%d" % body_swapped)

    # --- 3) ShrinkWrap груди одежды на тело (по-настоящему)
    sc = outfit.modifiers.new("ChestWrap", "SHRINKWRAP")
    sc.target = body
    sc.wrap_method = "PROJECT"
    sc.use_negative_direction = True
    sc.use_positive_direction = False
    sc.offset = -0.004
    sc.subsurf_levels = 0
    # ограничить по вершинной группе: грудная полоса
    vg = outfit.vertex_groups.new(name="chest_zone")
    wo = outfit.matrix_world
    import mathutils
    for v in outfit.data.vertices:
        c = wo @ v.co
        if abs(c.x) < 0.26 and 1.04 <= c.z <= 1.38 and c.y < 0.12:
            vg.add([v.index], 1.0, "REPLACE")
    sc.vertex_group = "chest_zone"
    sc.invert_vertex_group = False
    bpy.context.view_layer.objects.active = outfit
    # пустые shape keys мешают apply
    if outfit.data.shape_keys:
        for k in list(outfit.data.shape_keys.key_blocks):
            try:
                outfit.shape_key_remove(k)
            except Exception:
                pass
    bpy.ops.object.modifier_apply(modifier=sc.name)
    log("shrinkwrap applied (chest band)")

    # --- 4) линзы
    for m in mats:
        if "lens" in m.name.lower():
            mt = m.vrm_addon_extension.mtoon1
            if mt and mt.enabled:
                mt.pbr_metallic_roughness.base_color_factor = (1, 1, 1, 0.25)
                mt.pbr_metallic_roughness.base_color_texture.index.source = None
                mt.alpha_mode = "BLEND"
    log("lens ok")

    arm.data.vrm_addon_extension.spec_version = "1.0"
    arm.data.vrm_addon_extension.vrm1.meta.vrm_name = "Рин"
    arm.data.vrm_addon_extension.vrm1.meta.author = "cyberkitty"

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