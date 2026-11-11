#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Stage A: raw PMX import via mmd_tools + full inventory."""
import bpy, os, traceback

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
PMX = ("/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine "
       "BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/"
       "Export_PMX/20261014190816_春野千佳/model.pmx")
OUT = D + "/Rin_PMX_raw.blend"
LOG = D + "/pmx_inventory.log"


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


try:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.mmd_tools")
    bpy.ops.mmd_tools.import_model(filepath=PMX)
    log("IMPORT_OK")
    for o in bpy.data.objects:
        if o.type == "ARMATURE":
            log("ARM %s bones=%d" % (o.name, len(o.data.bones)))
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    log("MESHES: %d" % len(meshes))
    for m in meshes:
        log("OBJ %s | mats %d | verts %d" %
            (m.name, len(m.material_slots), len(m.data.vertices)))
        for ms in m.material_slots:
            mat = ms.material
            if mat is None:
                continue
            imgs = []
            try:
                for n in mat.node_tree.nodes:
                    if n.type == "TEX_IMAGE" and n.image:
                        imgs.append(n.image.name)
            except Exception:
                imgs = ["<no-nodes>"]
            log("   MAT %s | imgs %s" % (mat.name, ",".join(imgs[:5])[:150]))
    log("INVENTORY_DONE")
    bpy.ops.wm.save_as_mainfile(filepath=OUT)
    log("SAVED " + OUT)
except Exception:
    log("EXC:\n" + traceback.format_exc())
    log("STAGE_A_FAIL")