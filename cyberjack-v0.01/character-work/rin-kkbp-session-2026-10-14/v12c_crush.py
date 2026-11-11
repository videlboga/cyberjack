#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v12c: hair/megane/tongue/tears albedo fix + JPEG-crush opaque textures,
export Rin_MMD_v6.vrm (target <=50MB)."""
import bpy, os, traceback, importlib
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND = D + "/Rin_MMD_v5_final.blend"
OUT_VRM = D + "/Rin_MMD_v6.vrm"
JPEG_DIR = D + "/jpeg"
ROOT = ("/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine "
        "BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/"
        "Export_PMX/20261014190816_春野千佳")
LOG = D + "/v12c.log"

ALPHA_DOMAIN = ("eyeline", "namida", "sirome", "hitomi", "gageye",
                "megane", "lens", "GLSR", "normal", "_NMP")


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def find_image(cands):
    for p in cands:
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
    log("=== v12c")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    os.makedirs(JPEG_DIR, exist_ok=True)

    # ---- 1. добить недостающие albedo (hair/megane/tang/namida/sirome)
    fixed = []
    for m in bpy.data.materials:
        if m.name.startswith("Outline"):
            continue
        low = m.name.lower()
        if not any(k in low for k in ("hair", "megane", "tang", "namida", "sirome")):
            continue
        base = m.name.split(".")[0].replace(" ", "_")
        img = find_image([
            D + "/baked/" + base + "_light.png",
            ROOT + "/pre_light/" + base + "_light.png",
        ])
        if img is None:
            continue
        try:
            mt = m.vrm_addon_extension.mtoon1
            if mt.enabled:
                mt.pbr_metallic_roughness.base_color_texture.index.source = img
                fixed.append(m.name)
        except Exception as e:
            log("wire err " + m.name + " " + repr(e)[:80])
    log("fixed albedo: " + repr(fixed)[:250])

    # ---- 2. JPEG-crush (opaque domain only), собрать карту замен
    repl = {}
    scene = bpy.context.scene
    scene.render.image_settings.quality = 85
    for img in list(bpy.data.images):
        if img.users == 0 or img.size[0] <= 600:
            continue
        nm = img.name
        if any(a in nm.upper() for a in map(str.upper, ALPHA_DOMAIN)):
            continue
        try:
            if img.size[0] > 2048:
                img.scale(2048, max(1, int(img.size[1] * 2048 / img.size[0])))
            stem = nm.lower().rsplit(".", 1)[0]
            jp = os.path.join(JPEG_DIR, stem + ".jpg")
            img.filepath_raw = jp
            img.file_format = "JPEG"
            img.save()
            imgnew = bpy.data.images.load(jp)
            imgnew.name = stem + "_jpg"
            repl[img] = imgnew
        except Exception as e:
            log("crush err " + nm + " " + repr(e)[:80])
    log("crushed %d images" % len(repl))

    # ---- 3. применить карту замен: ноды + mtoon-пойнтеры
    def swap(info):
        try:
            src = info.index.source
        except Exception:
            return 0
        n = 0
        old = src
        while old is not None and old in repl:
            info.index.source = repl[old]
            n += 1
            break
        return n

    swapped_nodes = swapped_ptr = 0
    for m in bpy.data.materials:
        if m.node_tree:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image in repl:
                    n.image = repl[n.image]
                    swapped_nodes += 1
        ext = getattr(m, "vrm_addon_extension", None)
        mt = ext.mtoon1 if ext else None
        if not mt or not mt.enabled:
            continue
        for attr in ("base_color_texture", "emission_texture",
                     "matcap_texture", "roughness_multiplier_texture",
                     "base_color_multiply_texture", "shade_multiply_texture"):
            info = getattr(mt, attr, None)
            if info is None:
                continue
            try:
                src = info.index.source
            except Exception:
                continue
            if src in repl:
                info.index.source = repl[src]
                swapped_ptr += 1
            swapped_nodes += swap(info) if src is None else 0
    log("swapped: nodes=%d ptr=%d" % (swapped_nodes, swapped_ptr))

    # ---- 4. линзы
    for m in bpy.data.materials:
        if "lens" in m.name.lower():
            mt = m.vrm_addon_extension.mtoon1
            if mt and mt.enabled:
                try:
                    mt.pbr_metallic_roughness.base_color_factor = (1, 1, 1, 0.25)
                    mt.pbr_metallic_roughness.base_color_texture.index.source = None
                    mt.alpha_mode = "BLEND"
                except Exception as e:
                    log("lens err " + repr(e)[:80])

    # ---- 5. экспорт
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    wm = bpy.context.window_manager
    win = wm.windows[0] if wm.windows else bpy.context.window
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