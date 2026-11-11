#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v12a: raw mmd_tools import (Body pmx + Outfit pmx), join clothes onto body
armature, wire MToon-ready albedo (MT_CT), save v5 blend."""
import bpy, os, traceback

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
ROOT_DIR = ("/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine "
            "BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/"
            "Export_PMX/20261014190816_春野千佳")
OUT_BLEND = D + "/Rin_MMD_v5.blend"
LOG = D + "/v12a.log"


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def import_pmx(path):
    bpy.ops.mmd_tools.import_model('EXEC_DEFAULT', filepath=path, scale=1,
                                   clean_model=False,
                                   types={'MESH', 'ARMATURE', 'MORPHS'})


def main():
    log("=== v12a mmd raw import")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.mmd_tools")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")

    obj_before = set(bpy.data.objects.keys())
    import_pmx(ROOT_DIR + "/model.pmx")
    body_objects = set(bpy.data.objects.keys()) - obj_before
    log("body import objs: " + repr(sorted(body_objects))[:300])
    obj_before = set(bpy.data.objects.keys())
    import_pmx(ROOT_DIR + "/Outfit 00/model.pmx")
    outfit_objs = set(bpy.data.objects.keys()) - obj_before
    log("outfit import objs: " + repr(sorted(outfit_objs))[:300])

    out_mesh = next((o for o in bpy.data.objects
                     if o.type == "MESH" and o.name in outfit_objs), None)
    body_mesh = next((o for o in bpy.data.objects
                      if o.type == "MESH" and o.name in body_objects), None)
    body_arm = next((o for o in bpy.data.objects
                     if o.type == "ARMATURE" and o.name in body_objects), None)
    out_arm = next((o for o in bpy.data.objects
                    if o.type == "ARMATURE" and o.name in outfit_objs), None)
    log("resolved: out_mesh=%s body_mesh=%s body_arm=%s out_arm=%s" %
        (out_mesh, body_mesh, body_arm, out_arm))
    if not (out_mesh and body_mesh and body_arm):
        raise RuntimeError("objects missing")

    # перенос одежды на арматуру тела
    for vgroup in list(out_mesh.vertex_groups):
        if vgroup.name not in body_arm.data.bones and vgroup.name not in out_arm.data.bones:
            pass  # оставляем как есть
    mod = out_mesh.modifiers.get("Armature")
    if mod is None:
        mod = out_mesh.modifiers.new("Armature", 'ARMATURE')
    mod.object = body_arm
    out_mesh.parent = body_arm
    log("outfit reparented")
    # удалить арматуру одежды
    if out_arm:
        bpy.data.objects.remove(out_arm, do_unlink=True)
    log("outfit armature removed")

    # MToon-ready albedo wiring
    def wire(mat, img_path, img_key):
        if img_path and os.path.exists(img_path):
            img = bpy.data.images.get(img_key)
            if img is None:
                img = bpy.data.images.load(img_path, check_existing=True)
            nt = mat.node_tree
            tex = next((n for n in nt.nodes if n.type == "TEX_IMAGE" and
                        n.image and n.image.name == img_key), None)
            if tex is None:
                tex = nt.nodes.new("ShaderNodeTexImage")
                tex.image = img
                tex.location = (-400, 0)
            bsdf = next((n for n in nt.nodes
                         if n.type == "BSDF_PRINCIPLED"), None)
            if bsdf is None:
                bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
            outn = next((n for n in nt.nodes
                         if n.type == "OUTPUT_MATERIAL" and n.is_active_output),
                        None)
            if outn is None:
                outn = nt.nodes.new("ShaderNodeOutputMaterial")
            nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
            nt.links.new(bsdf.outputs["BSDF"], outn.inputs["Surface"])
            return img_key
        return None

    wired, miss = [], []
    for o in (body_mesh, out_mesh):
        for ms in o.material_slots:
            m = ms.material
            if not m:
                continue
            base = m.name
            nt = m.node_tree
            if nt is None:
                continue
            imgs = [n.image.name for n in nt.nodes
                    if n.type == "TEX_IMAGE" and n.image]
            # albedo: MT_CT > MT > light
            cand = None
            for suf in ("_MT_CT.png", "_MT.png", "_light.png"):
                for iname in imgs:
                    if iname.lower().endswith(suf):
                        cand = (iname, bpy.data.images.get(iname))
                        break
                if cand:
                    pass  # prefer MT_CT order, first found wins
                if cand:
                    break
            if cand is None:
                # no image in tree: try folder by material base name
                for suf in ("_MT_CT.png", "_MT.png"):
                    p = os.path.join(ROOT_DIR, "Outfit 00", base + suf)
                    p2 = os.path.join(ROOT_DIR, base + suf)
                    if os.path.exists(p):
                        cand = (base + suf, None, p)
                        break
                    elif os.path.exists(p2):
                        cand = (base + suf, None, p2)
                        break
            if cand:
                if len(cand) == 3:
                    key = wire(m, cand[2], cand[0])
                else:
                    wire(m, None, cand[0])
                    key = cand[0]
                wired.append((base, key))
            else:
                miss.append(base)
    log("wired %d; miss %s" % (len(wired), repr(miss)[:300]))

    # линзы прозрачные
    lens = None
    for m in bpy.data.materials:
        if 'lens' in m.name.lower():
            lens = m
            break
    if lens and lens.node_tree:
        bsdf = next((n for n in lens.node_tree.nodes
                     if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf:
            bsdf.inputs["Alpha"].default_value = 0.25
            lens.blend_method = 'BLEND'
            log("lens alpha set on " + lens.name)

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    log("SAVED " + OUT_BLEND)
    # верификация фита: грудь
    import mathutils
    wo = out_mesh.matrix_world
    front_out = max(((wo @ p.center).z, (wo @ p.center).y)
                    for p in out_mesh.data.polygons
                    if abs((wo @ p.center).x) < 0.10 and (wo @ p.center).y < 0
                    and 1.0 <= (wo @ p.center).z <= 1.35)
    wb = body_mesh.matrix_world
    front_body = max(((wb @ p.center).z, (wb @ p.center).y)
                     for p in body_mesh.data.polygons
                     if abs((wb @ p.center).x) < 0.10 and (wb @ p.center).y < 0
                     and 1.0 <= (wb @ p.center).z <= 1.35)
    log("front OUT z=%.4f | BODY z=%.4f | poke=%.4f" %
        (front_out[0], front_body[0], front_body[0] - front_out[0]))
    log("STAGE_A_OK")


try:
    main()
except Exception:
    log("EXC:\n" + traceback.format_exc())
    log("STAGE_A_FAIL")