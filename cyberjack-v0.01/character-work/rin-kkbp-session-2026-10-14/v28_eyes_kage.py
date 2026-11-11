#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v28: final face pass.
- eyes (sirome/MT eye*/hitomi): metallic 0, mtoon enable (convert if needed)
- eyeline_kage: remove faces (black stripe layer)
- keep: lens alpha, top bake, face-overlay BLEND
- export Rin_KKBP_v28.vrm"""
import bpy, os, traceback, importlib
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND_IN = D + "/Rin_KKBP_v27.blend"
BLEND_OUT = D + "/Rin_KKBP_v28.blend"
OUT_VRM = D + "/Rin_KKBP_v28.vrm"
LOG = D + "/v28.log"


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def main():
    log("=== v28")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    body = next(o for o in bpy.data.objects
                if o.type == "MESH" and o.name.startswith("Body"))

    # 1) глаза: metallic 0 + mtoon
    eye_ok = 0
    for ms in body.material_slots:
        m = ms.material
        if not m:
            continue
        low = m.name.lower()
        if not ("hitomi" in low or low.startswith("mt eye") or
                "sirome" in low):
            continue
        ext = getattr(m, "vrm_addon_extension", None)
        mt = ext.mtoon1 if ext else None
        if mt is None or not mt.enabled:
            try:
                bpy.ops.vrm.convert_material_to_mtoon1(material_name=m.name)
                mt = bpy.data.materials[m.name].vrm_addon_extension.mtoon1
                mt.enabled = True
            except Exception as e:
                log("eye conv err " + m.name[:28] + " " + repr(e)[:70])
        if mt and mt.enabled:
            eye_ok += 1
            log("eye mtoon " + m.name[:34])
        if m.node_tree:
            n = next((n for n in m.node_tree.nodes
                      if n.type == "BSDF_PRINCIPLED"), None)
            if n:
                n.inputs["Metallic"].default_value = 0.0
                if "Specular IOR Level" in n.inputs:
                    n.inputs["Specular IOR Level"].default_value = 0.2
                n.inputs["Roughness"].default_value = 0.4
    log("eyes mtoon=%d" % eye_ok)

    # 2) снести слой kage
    kage = bpy.data.materials.get("KK cf_m_eyeline_kage")
    kage2 = bpy.data.materials.get("KK cf_m_eyeline_kage.001")
    kill = [m for m in (kage, kage2) if m]
    for ob in bpy.data.objects:
        if ob.type != "MESH":
            continue
        slots = ob.material_slots
        kill_idx = [i for i, ms in enumerate(slots)
                    if ms.material and ms.material.name in
                    [k.name for k in kill]]
        if not kill_idx:
            continue
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="DESELECT")
        for p in ob.data.polygons:
            if p.material_index in kill_idx:
                p.select = True
        bpy.ops.mesh.delete(type="VERT")
        bpy.ops.object.mode_set(mode="OBJECT")
        log("kage faces removed on " + ob.name[:30])
    for k in kill:
        try:
            bpy.data.materials.remove(k, do_unlink=True)
        except Exception:
            pass

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