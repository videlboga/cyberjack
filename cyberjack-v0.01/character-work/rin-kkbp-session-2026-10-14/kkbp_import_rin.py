#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Headless KKBP import of a character export folder -> .blend (VRM prep route)."""
import bpy, addon_utils, os, sys, traceback

PMX = ("/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine "
       "BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/"
       "Export_PMX/20261014190816_春野千佳/model.pmx")
OUT_DIR = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND = os.path.join(OUT_DIR, "Rin_KKBP_v1.blend")
os.makedirs(OUT_DIR, exist_ok=True)


def main():
    for mod in ("bl_ext.user_default.mmd_tools", "bl_ext.user_default.kkbp"):
        addon_utils.enable(mod, default_set=True, persistent=True)
        print("enabled:", mod, "ok", flush=True)

    s = bpy.context.scene
    s.kkbp.prep_dropdown = "VRM"
    s.kkbp.simp_dropdown = "B"          # simple polygon reduction, game-friendly
    s.kkbp.atlas_dropdown = "Atlas"
    s.kkbp.use_rigify = False           # simple armature for VRM mapping
    s.kkbp.sfw_mode = False
    s.kkbp.separate_clothes = False
    print("props set:", s.kkbp.prep_dropdown, s.kkbp.simp_dropdown,
          s.kkbp.atlas_dropdown, flush=True)

    bpy.ops.kkbp.kkbpimport("EXEC_DEFAULT", filepath=PMX)
    print("KKBP import chain finished; objects:", len(bpy.data.objects), flush=True)
    for obj in bpy.data.objects:
        if obj.type in ("ARMATURE", "MESH"):
            print("  ", obj.type, obj.name, flush=True)

    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print("saved:", BLEND, flush=True)
    print("KKBP_IMPORT_OK", flush=True)


try:
    main()
except Exception:
    traceback.print_exc()
    print("KKBP_IMPORT_FAIL", flush=True)