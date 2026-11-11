#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v10: base textures -> raw MT_CT (keep white shirt), transparent glasses lenses."""
import bpy, os, traceback

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_KKBP_v3.blend"
BLEND_OUT = D + "/Rin_KKBP_v4.blend"
OUT_VRM = D + "/Rin_KKBP_v4.vrm"
EXP = ("/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine "
       "BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/"
       "Export_PMX/20261014190816_春野千佳")
LOG = D + "/mtoon.log"


def log(msg):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(msg) + "\n")
    print(msg, flush=True)


def main():
    log("=== v10 raw-texture pass")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")

    out_mesh = bpy.data.objects.get("Outfit 00 春野千佳")
    swaps = []
    if out_mesh:
        for ms in out_mesh.material_slots:
            m = ms.material
            if not m or not m.name.startswith("KK "):
                continue
            base = m.name[3:]  # e.g. 'cm_m_top_inner02 8080'
            mtct = EXP + "/Outfit 00/" + base + "_MT_CT.png"
            if not os.path.exists(mtct):
                log("no MT_CT for " + base)
                continue
            img = bpy.data.images.get(base + "_MT_CT.png")
            if img is None:
                img = bpy.data.images.load(mtct, check_existing=True)
            mtoon = m.vrm_addon_extension.mtoon1
            info = mtoon.pbr_metallic_roughness.base_color_texture.index
            oldimg = None
            try:
                oldimg = info.source.image.name if info.source else "None"
            except Exception:
                pass
            info.source = img
            swaps.append((base, oldimg, base + "_MT_CT.png", tuple(img.size)))
    log("swapped: " + repr(swaps)[:400])

    # прозрачные линзы очков
    lens = bpy.data.materials.get("KK acs_m_lens 4290")
    if lens:
        mm = lens.vrm_addon_extension.mtoon1
        mm.enabled = True
        try:
            mm.pbr_metallic_roughness.base_color_factor = (1.0, 1.0, 1.0, 0.30)
        except Exception as e:
            log("lens factor err " + repr(e)[:80])
        try:
            mm.alpha_mode = mm.ALPHA_MODE_BLEND
        except Exception:
            try:
                mm.alpha_mode = "BLEND"
            except Exception:
                pass
        # без текстуры: стекло
        info = mm.pbr_metallic_roughness.base_color_texture.index
        try:
            info.source = None
        except Exception as e:
            log("lens clear err " + repr(e)[:80])
        log("lens transparent set")
    log("lens pass done")

    for img in bpy.data.images:
        if img.size[0] > 2048 and img.users and not img.packed_file:
            try:
                img.scale(2048, max(1, int(img.size[1] * 2048 / img.size[0])))
            except Exception:
                pass

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    log("saved " + BLEND_OUT)

    import importlib
    exporter = importlib.import_module(
        "bl_ext.user_default.vrm.exporter.export_scene")
    from pathlib import Path

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
            arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
            self.armature_object_name = arm.name
            self.ignore_warning = True

        def __getattr__(self, name):
            return False

    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    wm = bpy.context.window_manager
    win = wm.windows[0] if wm.windows else None
    area = next(a for a in win.screen.areas if a.type == "VIEW_3D") if win else None
    region = next(r for r in area.regions if r.type == "WINDOW") if area else None
    with bpy.context.temp_override(window=win, screen=win.screen, area=area,
                                   region=region, object=arm,
                                   active_object=arm, selected_objects=[arm]):
        exporter._export_vrm(Path(OUT_VRM), Shim(), bpy.context,
                             armature_object_name=arm.name)
    log("export size: " + str(os.path.getsize(OUT_VRM) if
                              os.path.exists(OUT_VRM) else -1))
    log("VRM_EXPORT_OK" if os.path.exists(OUT_VRM) else "VRM_EXPORT_FAIL")
    bpy.ops.wm.quit_blender()


try:
    main()
except Exception:
    log("EXC:\n" + traceback.format_exc())
    log("VRM_EXPORT_FAIL")