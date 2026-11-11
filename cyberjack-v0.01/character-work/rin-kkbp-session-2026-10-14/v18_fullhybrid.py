#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v18 full hybrid: KKBP skeleton + BOTH mmd meshes (body+outfit).
Case-insensitive bone-group remap, drop mmd technical groups, binds, export."""
import bpy, os, traceback, importlib
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BASE = D + "/Rin_Hybrid_v9.blend"
SRC = D + "/Rin_MMD_v5_final.blend"
BLEND_OUT = D + "/Rin_Hybrid_v10.blend"
OUT_VRM = D + "/Rin_Hybrid_v10.vrm"
LOG = D + "/v18.log"

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
TECH = ("mmd_edge_scale", "mmd_vertex_order", "body without", "without tears",
        "without gag", "mmd")


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def main():
    log("=== v18 full hybrid")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BASE)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    lower_bones = {b.name.lower(): b.name for b in arm.data.bones}

    # 1) удалить kkbp тело и всё прочее mеши кроме уже вставленной одежды
    doomed = [o.name for o in bpy.data.objects if o.type == "MESH" and
              o.name.startswith(("Body", "Gag", "Tears", "Tongue"))]
    for nm in doomed:
        ob = bpy.data.objects.get(nm)
        if ob:
            bpy.data.objects.remove(ob, do_unlink=True)
    log("removed kkbp body: %s" % doomed)

    # 2) append mmd body mesh
    before = set(bpy.data.objects.keys())
    with bpy.data.libraries.load(SRC, link=False) as (src, dst):
        dst.objects = ["model_mesh"]
    new = set(bpy.data.objects.keys()) - before
    body_mesh = bpy.data.objects.get("model_mesh")
    if not body_mesh:
        raise RuntimeError("body append failed")
    log("appended: %s" % repr(sorted(new)))

    # линк в коллекцию
    coll = None
    for c in bpy.data.collections:
        if c.name == "Collection":
            coll = c
    if coll is None:
        coll = bpy.context.scene.collection
    coll.objects.link(body_mesh)
    body_mesh.hide_render = False
    body_mesh.hide_viewport = False

    for nm in new:
        ob = bpy.data.objects.get(nm)
        if ob is not None and nm != "model_mesh":
            bpy.data.objects.remove(ob, do_unlink=True)

    meshes = [o for o in bpy.data.objects
              if o.type == "MESH" and o.name.startswith(("model_mesh", "Outfit mmd"))]
    log("hybrid meshes: %s" % [o.name for o in meshes])

    # 3) арматура-модификаторы на kkbp arm + ремап групп
    remap_log = []
    for o in meshes:
        o.parent = arm
        amod = None
        for mmod in o.modifiers:
            if mmod.type == "ARMATURE":
                amod = mmod
        if amod is None:
            amod = o.modifiers.new("Armature", "ARMATURE")
        amod.object = arm
        # ремап
        for vg in list(o.vertex_groups):
            if vg.name in lower_bones:
                continue
            nm = vg.name
            if nm.lower() in lower_bones:
                target = lower_bones[nm.lower()]
                vg.name = target
                remap_log.append(nm + "->" + target)
            elif any(t in nm.lower() for t in TECH):
                o.vertex_groups.remove(vg)  # технические
            else:
                remap_log.append("UNRESOLVED:" + nm)
    log("remap done: mapped=%d unresolved=%s" %
        (len([r for r in remap_log if "->" in r]),
         repr([r for r in remap_log if "UNRESOLVED" in r])[:300]))
    # проверка остатка
    for o in meshes:
        still = [vg.name for vg in o.vertex_groups if vg.name not in lower_bones]
        log("MESH %-24s still-unresolved %d" % (o.name[:24], len(still)))

    # 4) бинды на тело (mmd морфы)
    face = body_mesh
    preset = arm.data.vrm_addon_extension.vrm1.expressions.preset
    bound = 0
    kb = face.data.shape_keys.key_blocks
    names_avail = {k.name for k in kb}
    for pname, names in PRESET_MAP.items():
        p_exp = getattr(preset, pname, None)
        if p_exp is None:
            continue
        while len(p_exp.morph_target_binds) > 0:
            p_exp.morph_target_binds.remove(0)
        for nm2 in names:
            if nm2 not in names_avail:
                continue
            b = p_exp.morph_target_binds.add()
            b.node.mesh_object_name = face.name
            b.index = nm2
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