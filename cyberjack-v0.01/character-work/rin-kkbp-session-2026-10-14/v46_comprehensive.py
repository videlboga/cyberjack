#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v46 COMPREHENSIVE FINAL: everything in one pass from clean v5_final.
Order: dup-layer purge -> hide overlays -> face fixes (BLEND/kage/eyes/mouth)
-> lens -> body raw MT_CT -> hitomi green -> top MT_CT -> export."""
import bpy, os, traceback, importlib, json, struct
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_KKBP_v5_final.blend"
BLEND_OUT = D + "/Rin_KKBP_v46.blend"
OUT_VRM = D + "/Rin_KKBP_v46.vrm"
BASE_E = ("/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine "
          "BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/"
          "Export_PMX/20261014190816_春野千佳")
LOG = D + "/v46.log"
GREEN = (92/255.0, 149/255.0, 109/255.0, 1.0)


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def loadimg(p):
    key = os.path.basename(p)
    img = bpy.data.images.get(key) or bpy.data.images.load(p)
    return img


def main():
    log("=== v46 comprehensive (from clean v5_final)")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    body = next(o for o in bpy.data.objects
                if o.type == "MESH" and o.name.startswith("Body"))
    outfit = next(o for o in bpy.data.objects
                  if o.type == "MESH" and o.name.startswith("Outfit"))

    # 1) скрыть оверлеи
    for nm in ("Gag Eyes", "Tears"):
        ob = next((o for o in bpy.data.objects
                   if o.type == "MESH" and o.name.startswith(nm)), None)
        if ob:
            ob.hide_render = True
            ob.hide_viewport = True
            log("hidden " + ob.name[:26])

    # 2) kage faces
    kages = [m for m in bpy.data.materials if "eyeline_kage" in m.name.lower()]
    kill = [i for i, ms in enumerate(body.material_slots)
            if ms.material and ms.material.name in [k.name for k in kages]]
    if kill:
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="DESELECT")
        for p in body.data.polygons:
            if p.material_index in kill:
                p.select = True
        bpy.ops.mesh.delete(type="VERT")
        bpy.ops.object.mode_set(mode="OBJECT")
        log("kage faces removed")

    def face_fix(m):
        """enable mtoon + alpha per family."""
        low = m.name.lower()
        ext = getattr(m, "vrm_addon_extension", None)
        mt = ext.mtoon1 if ext else None
        if mt is None:
            return "noext"
        mt.enabled = True
        if "tooth" in low or "tang" in low:
            mt.alpha_mode = "OPAQUE"
            return "opaque"
        if any(k in low for k in ("eyeline", "namida", "sirome",
                                  "mayuge", "noseline")):
            mt.alpha_mode = "BLEND"
            return "blend"
        return "skip"

    # 3) face/body fixes
    n_blend = n_op = n_eyes = 0
    for ms in body.material_slots:
        m = ms.material
        if not m or m.name.startswith("Outline"):
            continue
        low = m.name.lower()
        r1 = face_fix(m)
        if r1 == "blend":
            n_blend += 1
        if r1 == "opaque":
            n_op += 1
        if ("hitomi" in low or low.startswith("mt eye") or
                "sirome" in low):
            mt = m.vrm_addon_extension.mtoon1
            if mt and mt.enabled:
                if "sirome" not in low:
                    mt.alpha_mode = "BLEND"   # hitomi рисуется с альфой
                if m.node_tree:
                    n = next((n for n in m.node_tree.nodes
                              if n.type == "BSDF_PRINCIPLED"), None)
                    if n:
                        n.inputs["Metallic"].default_value = 0.0
                        if "Specular IOR Level" in n.inputs:
                            n.inputs["Specular IOR Level"].default_value = 0.2
                        n.inputs["Roughness"].default_value = 0.4
                    for n in m.node_tree.nodes:
                        if n.type == "EMISSION":
                            n.inputs["Strength"].default_value = 0.0
                n_eyes += 1
        try:
            ext = getattr(m, "vrm_addon_extension", None)
            if ext and ext.mtoon1 and "eye" in low:
                ext.mtoon1.khr_materials_emissive_strength.emissive_strength = 0
        except Exception:
            pass
    log("face: blend=%d opaque=%d eyes=%d" % (n_blend, n_op, n_eyes))

    # 4) глаза: зелёная тонировка
    for m in bpy.data.materials:
        if "hitomi" in m.name.lower() or m.name.startswith("MT eye"):
            mt = m.vrm_addon_extension.mtoon1
            if mt and mt.enabled:
                mt.pbr_metallic_roughness.base_color_factor = GREEN
    log("hitomi green")

    # 5) линзы
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
    log("lens ok")

    # 6) тело -> raw MT_CT (без liquid)
    wired = 0
    for ms in body.material_slots:
        m = ms.material
        if not m or m.name.startswith("Outline"):
            continue
        low = m.name.lower()
        if any(k in low for k in ("hitomi", "eye", "sirome", "tooth",
                                  "tang", "namida", "mayuge", "noseline")):
            continue
        base = m.name.split(".")[0]
        short = base.split(" ", 1)[-1]
        p = os.path.join(BASE_E, short + "_MT_CT.png")
        if not os.path.exists(p):
            log("no raw: " + short[:34])
            continue
        mt = m.vrm_addon_extension.mtoon1
        if mt and mt.enabled:
            mt.pbr_metallic_roughness.base_color_texture.index.source = loadimg(p)
            mt.pbr_metallic_roughness.base_color_factor = (1, 1, 1, 1)
            wired += 1
    log("body raw wired=%d" % wired)

    # 7) топ -> MT_CT
    mtct = loadimg(os.path.join(BASE_E, "Outfit 00",
                                "cm_m_top_inner02 8080_MT_CT.png"))
    for ms in outfit.material_slots:
        m = ms.material
        if m and "top" in m.name and "Outline" not in m.name:
            mt = m.vrm_addon_extension.mtoon1
            mt.pbr_metallic_roughness.base_color_texture.index.source = mtct
            mt.pbr_metallic_roughness.base_color_factor = (1, 1, 1, 1)
    log("top MT_CT")

    arm.data.vrm_addon_extension.spec_version = "1.0"
    arm.data.vrm_addon_extension.vrm1.meta.vrm_name = "Рин"
    arm.data.vrm_addon_extension.vrm1.meta.author = "cyberkitty"
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    log("saved " + BLEND_OUT)

    # 8) экспорт
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
    # GLB-верификация
    if os.path.exists(OUT_VRM):
        with open(OUT_VRM, "rb") as f:
            f.read(12)
            clen, _ = struct.unpack("<I4s", f.read(8))
            js = json.loads(f.read(clen))
        nn = [n.get("name", "") for n in js["nodes"] if "mesh" in n]
        bl = sum(1 for m in js["materials"] if m.get("alphaMode") == "BLEND")
        nt = sum(1 for m in js["materials"]
                 if "VRMC_materials_mtoon" in m.get("extensions", {}))
        log("GLB meshes=%s | BLEND mats=%d | mtoon=%d/%d" %
            (nn, bl, nt, len(js["materials"])))
    log("VRM_EXPORT_OK" if size > 0 else "VRM_EXPORT_FAIL")
    bpy.ops.wm.quit_blender()


try:
    main()
except Exception:
    log("EXC:\n" + traceback.format_exc())
    log("VRM_EXPORT_FAIL")