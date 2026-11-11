#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v12g: morph diet (keep only VRM-expression-bound shape keys) + texture diet
(idempotent v12f logic) + save + export Rin_MMD_v6.vrm."""
import bpy, os, traceback, importlib
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_MMD_v5_final.blend"
BLEND_OUT = D + "/Rin_MMD_v6_final.blend"
OUT_VRM = D + "/Rin_MMD_v6.vrm"
JPEG_DIR = D + "/jpeg"
ROOT = ("/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine "
        "BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/"
        "Export_PMX/20261014190816_春野千佳")
LOG = D + "/v12g.log"

ALPHA_DOMAIN = ("EYELINE", "NAMIDA", "SIROME", "HITOMI", "GAGEYE",
                "MEGANE", "LENS", "GLSR", "NORMAL", "_NMP", "_NM", "_DM", "_LM")


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def base_img(m):
    try:
        return m.vrm_addon_extension.mtoon1.pbr_metallic_roughness. \
            base_color_texture.index.source
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


def collect_bound_shape_keys(arm):
    """shape key names referenced by vrm1 expressions (preset+custom)."""
    bound = set()
    exprs = arm.data.vrm_addon_extension.vrm1.expressions
    def walk(group, tag):
        for p in dir(group):
            if p.startswith("_"):
                continue
            try:
                v = getattr(group, p)
            except Exception:
                continue
            try:
                binds = v.morph_target_binds
            except Exception:
                continue
            for bn in binds:
                try:
                    node = bn.node
                    idx = bn.index
                except Exception:
                    continue
                mesh = node.data
                if mesh and mesh.shape_keys and idx < len(mesh.shape_keys.key_blocks):
                    bound.add((node.name, mesh.shape_keys.key_blocks[idx].name))
    for holder in (exprs,):
        for p in dir(holder):
            if p.startswith("_"):
                continue
            try:
                v = getattr(holder, p)
            except Exception:
                continue
            # preset group / custom group / single expression
            if hasattr(v, "morph_target_binds"):
                try:
                    for bn in v.morph_target_binds:
                        node = bn.node
                        mesh = node.data
                        if mesh and mesh.shape_keys and bn.index < len(
                                mesh.shape_keys.key_blocks):
                            bound.add((node.name,
                                       mesh.shape_keys.key_blocks[bn.index].name))
                except Exception:
                    pass
                continue
            # group holder: preset/custom
            for q in dir(v):
                if q.startswith("_"):
                    continue
                try:
                    vv = getattr(v, q)
                except Exception:
                    continue
                if hasattr(vv, "morph_target_binds"):
                    try:
                        for bn in vv.morph_target_binds:
                            node = bn.node
                            mesh = node.data
                            if mesh and mesh.shape_keys and bn.index < len(
                                    mesh.shape_keys.key_blocks):
                                bound.add((node.name,
                                           mesh.shape_keys.key_blocks[bn.index].name))
                    except Exception:
                        pass
    return bound


def main():
    log("=== v12g")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    os.makedirs(JPEG_DIR, exist_ok=True)

    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")

    # -- 0. bound shape keys
    bound = collect_bound_shape_keys(arm)
    per_mesh = {}
    for node_name, key_name in bound:
        per_mesh.setdefault(node_name, set()).add(key_name)
    log("bound shape keys: %s" % repr(per_mesh)[:400])

    removed_sk = 0
    for o in bpy.data.objects:
        if o.type != "MESH" or o.data.shape_keys is None:
            continue
        keep = {"Basis"} | per_mesh.get(o.name, set())
        kb = o.data.shape_keys.key_blocks
        for k in list(kb):
            if k.name not in keep:
                o.shape_key_remove(k)
                removed_sk += 1
        o.shape_key_fix_lattice_shapekeys if False else None
        left = [k.name for k in o.data.shape_keys.key_blocks]
        log("MESH %-40s kept: %s" % (o.name, left[:14]))
    log("removed shape keys=%d" % removed_sk)

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

    # -- 2. texture diet
    shared = cleared = 0
    for m in bpy.data.materials:
        ext = getattr(m, "vrm_addon_extension", None)
        mt = ext.mtoon1 if ext else None
        if not mt or not mt.enabled:
            continue
        try:
            infos = list(mt.all_texture_info())
        except Exception:
            infos = []
        b = base_img(m)
        for ti in infos:
            key = ti.__class__.__name__
            if "ShadeMultiply" in key and b is not None:
                try:
                    ti.index.source = b
                    shared += 1
                    continue
                except Exception:
                    pass
            if any(t in key for t in ("UvAnimationMask", "Matcap", "Rim",
                                      "ShadingShift", "Emissive")):
                try:
                    ti.index.source = None
                    cleared += 1
                except Exception:
                    pass
    log("shade shared=%d junk=%d" % (shared, cleared))

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
        stem = nm.lower().rsplit(".", 1)[0]
        jp = os.path.join(JPEG_DIR, stem + ".jpg")
        if os.path.exists(jp):
            imgnew = bpy.data.images.get(stem + "_jpg")
            if imgnew is None:
                imgnew = bpy.data.images.load(jp)
                imgnew.name = stem + "_jpg"
            repl[img] = imgnew
            continue
        try:
            if img.size[0] > 2048:
                img.scale(2048, max(1, int(img.size[1] * 2048 / img.size[0])))
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

    # -- 4. swaps
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
        try:
            for ti in mt.all_texture_info():
                src = ti.index.source
                if src is not None and src in repl:
                    ti.index.source = repl[src]
                    swapped_p += 1
        except Exception:
            pass
    log("swapped nodes=%d ptr=%d" % (swapped_n, swapped_p))

    # -- 5. originals removal
    for old in list(repl.keys()):
        try:
            bpy.data.images.remove(old)
        except Exception:
            pass
    log("originals removed")

    # -- 6. lens
    for m in bpy.data.materials:
        if "lens" in m.name.lower():
            mt = m.vrm_addon_extension.mtoon1
            if mt and mt.enabled:
                try:
                    mt.pbr_metallic_roughness.base_color_factor = (1, 1, 1, 0.25)
                    mt.pbr_metallic_roughness.base_color_texture.index.source = None
                    mt.alpha_mode = "BLEND"
                except Exception as e:
                    log("lens err " + repr(e)[:60])

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    log("saved " + BLEND_OUT)

    # -- 7. export
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