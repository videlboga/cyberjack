#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v16 hybrid: KKBP v4 blend (good skeleton) + mmd outfit/hair mesh (fit+MT_CT).
Export Rin_Hybrid_v9.vrm."""
import bpy, os, traceback, importlib
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BASE = D + "/Rin_KKBP_v4.blend"
SRC = D + "/Rin_MMD_v5_final.blend"
BLEND_OUT = D + "/Rin_Hybrid_v9.blend"
OUT_VRM = D + "/Rin_Hybrid_v9.vrm"
LOG = D + "/v16.log"


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def main():
    log("=== v16 hybrid")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BASE)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")

    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")

    # 1) удалить KKBP-одежду и волосы + их материалы
    doomed = [o for o in bpy.data.objects if o.type == "MESH" and
              ("Outfit 00" in o.name or "Hair Outfit 00" in o.name)]
    mats_gone = []
    meshes_gone = []
    for o in doomed:
        meshes_gone.append(o.name)
        mats_gone += [ms.material.name for ms in o.material_slots if ms.material]
        bpy.data.objects.remove(o, do_unlink=True)
    log("removed kkbp clothes: %s" % meshes_gone)
    for mn in list(mats_gone):
        m = bpy.data.materials.get(mn)
        if m and m.users == 0:
            bpy.data.materials.remove(m)

    # 2) append mmd outfit mesh
    before = set(bpy.data.objects.keys())
    with bpy.data.libraries.load(SRC, link=False) as (src, dst):
        dst.objects = ["model.001_mesh"]
    new = set(bpy.data.objects.keys()) - before
    log("appended: %s" % repr(sorted(new)))
    out_mesh = bpy.data.objects.get("model.001_mesh")
    if not out_mesh:
        raise RuntimeError("append failed")
    out_mesh.name = "Outfit mmd 春野千佳"
    # линк в коллекцию сцены (append не линкует!)
    for coll in arm.users_collection or bpy.context.scene.collection.children:
        coll.objects.link(out_mesh)
        break
    out_mesh.hide_render = False
    out_mesh.hide_viewport = False
    log("mesh linked to collection")

    # 3) срезать арматуру: удалить все appended-объекты кроме меша
    extra = [nm for nm in new if nm != "model.001_mesh"]
    for mm in out_mesh.modifiers:
        if mm.type == "ARMATURE":
            mm.object = arm
    out_mesh.parent = arm
    for nm in extra:
        ob = bpy.data.objects.get(nm)
        if ob:
            bpy.data.objects.remove(ob, do_unlink=True)
    log("armature re-pointed; extra removed: %s" % extra)

    # 4) чистка пустых мешей mmd (Gag etc нет — model.001_mesh цельный)

    # 5) сохранение + экспорт
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