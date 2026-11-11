#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Phase1 v3: force-link _light albedo into EVERY KK material's principled,
then official mtoon1 convert op; verify per-material result."""
import bpy, os

BLEND_IN = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v1.blend"
BLEND_OUT = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v3.blend"
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


def pick_albedo(imgs):
    light, big = None, None
    for _n, img in imgs:
        if not img or img.size[0] == 0:
            continue
        iname = img.name.lower()
        if "_NMP" in iname.upper() or "_NMPD" in iname.upper():
            continue
        if iname.endswith("_light.png"):
            return img
        if iname.endswith("_dark.png") or iname.endswith("_lm.png"):
            continue
        if big is None or img.size[0] * img.size[1] > big.size[0] * big.size[1]:
            big = img
    return light or big


def main():
    log("=== phase1 v3 (force-light) start")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")

    # eyes -> fresh materials
    replaced = 0
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        for ms in o.material_slots:
            old = ms.material
            if old and 'hitomi' in old.name and old.name.startswith("KK"):
                albedo = pick_albedo([n for n in walk_images(old.node_tree)])
                new = bpy.data.materials.new("MT eye " + str(replaced))
                new.use_nodes = True
                nt = new.node_tree
                outn = nt.nodes.new("ShaderNodeOutputMaterial")
                bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
                t = nt.nodes.new("ShaderNodeTexImage")
                if albedo:
                    t.image = albedo
                    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
                nt.links.new(bsdf.outputs["BSDF"], outn.inputs["Surface"])
                ms.material = new
                replaced += 1
    log("eyes replaced: %d" % replaced)

    mats = {ms.material for o in bpy.data.objects if o.type == "MESH"
            for ms in o.material_slots if ms.material}
    results, missing = [], []
    for m in sorted(mats, key=lambda x: x.name):
        name = m.name
        if name.startswith("Outline"):
            continue
        if not m.use_nodes:
            continue
        imgs = walk_images(m.node_tree)
        albedo = pick_albedo(imgs)
        base = name[3:] if name.startswith("KK ") else name
        want = base + "_light.png"
        if albedo is None or albedo.name != want:
            missing.append((name, albedo.name if albedo else None))
        if albedo is None:
            log("NO ALBEDO: " + name)
            continue
        nt = m.node_tree
        texnode = next((n for n in nt.nodes
                        if n.type == "TEX_IMAGE" and n.image == albedo
                        and n.parent is None), None)
        if texnode is None:
            texnode = nt.nodes.new("ShaderNodeTexImage")
            texnode.image = albedo
        principled = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if principled is None:
            principled = nt.nodes.new("ShaderNodeBsdfPrincipled")
        nt.links.new(texnode.outputs["Color"], principled.inputs["Base Color"])
        outn = next((n for n in nt.nodes
                     if n.type == "OUTPUT_MATERIAL" and n.is_active_output), None)
        if outn is None:
            outn = nt.nodes.new("ShaderNodeOutputMaterial")
        if not principled.outputs["BSDF"].links or \
                outn.inputs["Surface"].links[0].from_node != principled:
            nt.links.new(principled.outputs["BSDF"], outn.inputs["Surface"])
        try:
            res = bpy.ops.vrm.convert_material_to_mtoon1(material_name=name)
        except Exception as e:
            log("convert EXC " + name + " " + repr(e)[:100])
            continue
        # verify
        m2 = bpy.data.materials[name]
        imgs2 = [(n.image.name) for n in m2.node_tree.nodes
                 if n.type == "TEX_IMAGE" and n.image]
        ok = any(albedo.name == x for x in imgs2)
        results.append((name, str(res), ok))
        if not ok:
            log("VERIFY FAIL (no light in tree): " + name + " " + str(imgs2[:4]))
    log("results: %d / missing-light: %s" %
        (len(results), repr(missing)[:500]))
    bad = [r for r in results if r[2] is False]
    log("bad conversions: " + repr(bad)[:400])

    # outline невидимые
    hidden = 0
    for m in mats:
        if not m.name.startswith("Outline"):
            continue
        try:
            nt = m.node_tree
            outn = next((n for n in nt.nodes
                         if n.type == "OUTPUT_MATERIAL" and n.is_active_output), None)
            if outn and not any(n.type == "BSDF_PRINCIPLED" for n in nt.nodes):
                p = nt.nodes.new("ShaderNodeBsdfPrincipled")
                p.inputs["Alpha"].default_value = 0.0
                nt.links.new(p.outputs["BSDF"], outn.inputs["Surface"])
            hidden += 1
        except Exception:
            pass
    log("outlines: %d" % hidden)

    for img in bpy.data.images:
        if img.size[0] > 2048 and img.users and not img.packed_file:
            try:
                img.scale(2048, max(1, int(img.size[1] * 2048 / img.size[0])))
            except Exception:
                pass
    log("downscale done")

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