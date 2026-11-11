#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v12f: idempotent final diet from v5_final.
hair/megane albedo; shade share via extensions.vrmc_materials_mtoon;
generic all_texture_info swaps; remove replaced originals; export v6."""
import bpy, os, traceback, importlib
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND = D + "/Rin_MMD_v5_final.blend"
OUT_VRM = D + "/Rin_MMD_v6.vrm"
JPEG_DIR = D + "/jpeg"
ROOT = ("/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine "
        "BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/"
        "Export_PMX/20261014190816_春野千佳")
LOG = D + "/v12f.log"

ALPHA_DOMAIN = ("EYELINE", "NAMIDA", "SIROME", "HITOMI", "GAGEYE",
                "MEGANE", "LENS", "GLSR", "NORMAL", "_NMP", "_NM", "_DM", "_LM")


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def base_img(m):
    try:
        s = m.vrm_addon_extension.mtoon1.pbr_metallic_roughness. \
            base_color_texture.index.source
        return s
    except Exception:
        return None


def find_image(paths):
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
    log("=== v12f")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    os.makedirs(JPEG_DIR, exist_ok=True)

    # -- 1. hair/megane albedo (idempotent)
    fixed = 0
    for m in bpy.data.materials:
        if m.name.startswith("Outline") or not m.use_nodes:
            continue
        low = m.name.lower()
        if not any(k in low for k in ("hair", "megane", "tang", "namida", "sirome")):
            continue
        mt = m.vrm_addon_extension.mtoon1
        if not mt:
            continue
        if not mt.enabled:
            mt.enabled = True
        if base_img(m) is not None:
            continue
        base = m.name.split(".")[0].replace(" ", "_")
        img = find_image([D + "/baked/" + base + "_light.png",
                          ROOT + "/pre_light/" + base + "_light.png"])
        if img is None:
            log("NOFIX " + m.name)
            continue
        mt.pbr_metallic_roughness.base_color_texture.index.source = img
        fixed += 1
    log("fixed=%d" % fixed)

    # -- 2. текстурная диета: все texture_info через all_texture_info()
    shared_shade = cleared_junk = 0
    texture_infos = []
    for m in bpy.data.materials:
        ext = getattr(m, "vrm_addon_extension", None)
        mt = ext.mtoon1 if ext else None
        if not mt or not mt.enabled:
            continue
        try:
            infos = list(mt.all_texture_info())
        except Exception as e:
            log("ti err " + m.name + " " + repr(e)[:60])
            infos = []
        b = base_img(m)
        for ti in infos:
            key = ti.__class__.__name__
            if "ShadeMultiply" in key and b is not None:
                try:
                    ti.index.source = b
                    shared_shade += 1
                    continue
                except Exception:
                    pass
            if key not in ("Mtoon1BaseColorTextureInfoPropertyGroup",):
                if "UvAnimationMask" in key or "Matcap" in key or "Rim" in key \
                        or "ShadingShift" in key:
                    try:
                        ti.index.source = None
                        cleared_junk += 1
                    except Exception:
                        pass
            texture_infos.append((m.name, key, ti))
    log("shade shared=%d junk cleared=%d infos=%d" %
        (shared_shade, cleared_junk, len(texture_infos)))

    # -- 3. JPEG-crush
    repl = {}
    scene = bpy.context.scene
    scene.render.image_settings.quality = 85
    for img in list(bpy.data.images):
        if img.users == 0 or img.size[0] <= 600:
            continue
        nm = img.name
        if any(a in nm.upper() for a in ALPHA_DOMAIN):
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
            log("CRUSH %s -> %sKB" % (nm, os.path.getsize(jp) // 1024))
        except Exception as e:
            log("crush err " + nm + " " + repr(e)[:80])
    log("crushed=%d" % len(repl))

    # -- 4. замены
    swapped_n = swapped_p = 0
    for m in bpy.data.materials:
        if m.node_tree:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image in repl:
                    n.image = repl[n.image]
                    swapped_n += 1
        ext = getattr(m, "vrm_addon_extension", None)
        mt = ext.mtoon1 if ext else None
        if not mt or not mt.enabled:
            continue
        for _name, _key, ti in []:
            pass
        try:
            for ti in mt.all_texture_info():
                src = ti.index.source
                if src in repl:
                    ti.index.source = repl[src]
                    swapped_p += 1
        except Exception:
            pass
    log("swapped nodes=%d ptr=%d" % (swapped_n, swapped_p))

    # -- 5. удалить оригиналы
    removed = []
    for old in list(repl.keys()):
        try:
            bpy.data.images.remove(old)
            removed.append(old.name)
        except Exception as e:
            log("rm err " + repr(e)[:60])
    log("removed originals=%d" % len(removed))

    # -- 6. линзы
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

    # -- 7. экспорт
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