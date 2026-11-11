#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v19: diet body morphs on Hybrid_v10 + rebuild binds + export v10.vrm final."""
import bpy, os, traceback, importlib
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_Hybrid_v10.blend"
BLEND_OUT = D + "/Rin_Hybrid_v10_final.blend"
OUT_VRM = D + "/Rin_Hybrid_v10_final.vrm"
LOG = D + "/v19.log"

PRESET_MAP = {
    "blink": ["eye_face.f00_def_cl"],
    "blink_left": ["eye_face.f00_winkl_op"],
    "blink_right": ["eye_face.f00_winkr_op"],
    "aa": ["kuti_face.f00_a_l_op"],
    "ih": ["kuti_face.f00_i_l_op"],
    "ou": ["kuti_face.f00_u_l_op"],
    "ee": ["kuti_face.f00_e_l_op"],
    "oh": ["kuti_face.f00_o_l_op"],
    "happy": ["eye_face.f00_egao_op", "kuti_face.f00_egao_op"],
    "angry": ["eye_face.f00_ikari_op", "kuti_face.f00_ikari_op"],
    "sad": ["eye_face.f00_kanasi_op", "kuti_face.f00_sabisi_op"],
    "relaxed": ["eye_face.f00_tere_op"],
    "surprised": ["eye_face.f00_aseri_op", "kuti_face.f00_odoro_op"],
    "neutral": ["eye_face.f00_def_op", "kuti_face.f00_def_op"],
}


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def main():
    log("=== v19 diet on hybrid")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    face = next(o for o in bpy.data.objects
                if o.type == "MESH" and o.name.startswith("model_mesh"))
    need = {nm for nms in PRESET_MAP.values() for nm in nms}
    removed = 0
    for o in bpy.data.objects:
        if o.type != "MESH" or o.data.shape_keys is None:
            continue
        for k in list(o.data.shape_keys.key_blocks):
            if k.name == "Basis":
                continue
            base = k.name.rsplit(".00", 1)[0]
            if k.name in need or (base in need and k.name != base):
                continue
            o.shape_key_remove(k)
            removed += 1
        left = len([k for k in o.data.shape_keys.key_blocks]) if o.data.shape_keys else 0
        log("MESH %-26s kept %d" % (o.name[:26], left))
    log("removed=%d" % removed)

    preset = arm.data.vrm_addon_extension.vrm1.expressions.preset
    bound = 0
    kb = face.data.shape_keys.key_blocks
    avail = {k.name for k in kb}
    for pname, names in PRESET_MAP.items():
        p_exp = getattr(preset, pname, None)
        if p_exp is None:
            continue
        while len(p_exp.morph_target_binds) > 0:
            p_exp.morph_target_binds.remove(0)
        for nm in names:
            if nm not in avail:
                continue
            b = p_exp.morph_target_binds.add()
            b.node.mesh_object_name = face.name
            b.index = nm
            b.weight = 1.0
            bound += 1
    log("binds=%d" % bound)

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