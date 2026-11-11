#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Phase1 v2: albedo->Principled wiring + official convert op per material."""
import bpy, os

BLEND_IN = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v1.blend"
BLEND_OUT = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v2.blend"
LOG = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/mtoon.log"


def log(msg):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(msg) + "\n")
    print(msg, flush=True)


def walk_images(nt, seen=None):
    seen = seen or set()
    out = []
    for n in nt.nodes:
        if n.type == "TEX_IMAGE" and n.image:
            out.append((n, n.image))
        elif n.type == "GROUP" and n.node_tree and n.node_tree.name not in seen:
            seen.add(n.node_tree.name)
            out += walk_images(n.node_tree, seen)
    return out


def prepare_kk_material(m, allow_transparent):
    """Create top TEX_IMAGE + Principled; return albedo image"""
    if not m.use_nodes:
        return None
    if any(n.type == "BSDF_PRINCIPLED" for n in m.node_tree.nodes):
        return None  # уже стандартный
    imgs = walk_images(m.node_tree)
    albedo = None
    for _n, img in imgs:
        if not img or img.size[0] == 0:
            continue
        iname = img.name.lower()
        if iname.endswith("_dark.png") or "_NMP" in iname.upper() \
           or "_NMPD" in iname.upper() or iname.endswith("_lm.png"):
            continue
        if albedo is None or img.size[0] * img.size[1] > \
                albedo.size[0] * albedo.size[1]:
            albedo = img
    nt = m.node_tree
    out = next((n for n in nt.nodes
                if n.type == "OUTPUT_MATERIAL" and n.is_active_output), None)
    if out is None:
        out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    if albedo:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = albedo
        tex.location = (-600, 0)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if allow_transparent:
            nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return albedo


def main():
    log("=== phase1 v2 start")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")

    # eye (hitomi) materials -> fresh simple materials first
    replaced = 0
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        for si, ms in enumerate(o.material_slots):
            old = ms.material
            if old and 'hitomi' in old.name and old.name.startswith("KK"):
                imgs = walk_images(old.node_tree)
                albedo = None
                for _n, img in imgs:
                    if not img or img.size[0] == 0:
                        continue
                    iname = img.name.lower()
                    if iname.endswith("_dark.png") or "_NMP" in iname.upper():
                        continue
                    if albedo is None or img.size[0] * img.size[1] > \
                            albedo.size[0] * albedo.size[1]:
                        albedo = img
                new = bpy.data.materials.new("MT eye " + str(replaced))
                new.use_nodes = True
                nt = new.node_tree
                out = nt.nodes.new("ShaderNodeOutputMaterial")
                bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
                if albedo:
                    t = nt.nodes.new("ShaderNodeTexImage")
                    t.image = albedo
                    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
                nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
                ms.material = new
                replaced += 1
    log("eyes replaced: %d" % replaced)

    mats = {ms.material for o in bpy.data.objects if o.type == "MESH"
            for ms in o.material_slots if ms.material}
    converted, skipped = [], []
    for m in sorted(mats, key=lambda x: x.name):
        name = m.name
        if name.startswith("Outline") or name.startswith("."):
            try:
                nt = m.node_tree
                out = next((n for n in nt.nodes
                            if n.type == "OUTPUT_MATERIAL" and n.is_active_output), None)
                if out and not any(n.type == "BSDF_PRINCIPLED" for n in nt.nodes):
                    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
                    p.inputs["Alpha"].default_value = 0.0
                    p.inputs["Base Color"].default_value = (0, 0, 0, 0)
                    nt.links.new(p.outputs["BSDF"], out.inputs["Surface"])
                skipped.append(name)
            except Exception as e:
                log("outline err " + name + " " + repr(e)[:80])
            continue
        allow_tr = name.startswith("KK cf_m_hair") or "sirome" in name \
            or "hitomi" in name
        prepare_kk_material(m, allow_tr)
        try:
            res = bpy.ops.vrm.convert_material_to_mtoon1(material_name=name)
            converted.append((name, str(res)))
            if res != {"FINISHED"}:
                log("conv not finished: " + name + " " + str(res))
            try:
                mm = m.vrm_addon_extension.mtoon1
                if mm.enabled and (name.startswith("KK cf_m_hair")
                                   or "sirome" in name or "hitomi" in name):
                    mm.alpha_mode = "BLEND"
            except Exception:
                pass
        except Exception as e:
            log("conv err " + name + " " + repr(e)[:120])
    log("converted: %d skipped: %d" % (len(converted), len(skipped)))
    for c in converted:
        log("   " + str(c))

    # даунскейл
    for img in bpy.data.images:
        if img.size[0] > 2048 and img.users and not img.packed_file:
            try:
                img.scale(2048, max(1, int(img.size[1] * 2048 / img.size[0])))
            except Exception:
                pass

    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    bpy.context.view_layer.objects.active = arm
    meta = arm.data.vrm_addon_extension.vrm1.meta
    meta.vrm_name = "Рин"
    meta.author = "cyberkitty"
    arm.data.vrm_addon_extension.spec_version = "1.0"
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    log("saved " + BLEND_OUT)
    log("CONVERT_DONE")


try:
    main()
except Exception:
    import traceback
    log("EXC:\n" + traceback.format_exc())
    log("CONVERT_FAIL")