#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Phase 1: convert KK -> MToon materials (crash-safe: blacklist file + fresh
material replacement for segfaulting eye materials). Saves Rin_KKBP_v2.blend."""
import bpy, os

BLEND_IN = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v1.blend"
BLEND_OUT = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v2.blend"
LOG = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/mtoon.log"
BLACKLIST = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/mtoon_blacklist.txt"


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


def main():
    bl = []
    if os.path.exists(BLACKLIST):
        bl = [s.strip() for s in open(BLACKLIST) if s.strip()]
    log("blacklist: " + repr(bl))

    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")

    # собрать (mesh, slot) для глазных материалов -> заменить свежими
    eye_replace = {}
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        for si, ms in enumerate(o.material_slots):
            m = ms.material
            if m and 'hitomi' in m.name and m.name.startswith("KK"):
                eye_replace.setdefault(m.name, []).append((o, si))

    # fresh eye materials with own image texture (из группы старого материала)
    for mname, slots in eye_replace.items():
        old = bpy.data.materials[mname]
        imgs = walk_images(old.node_tree)
        tex = None
        for _n, img in imgs:
            if img and not img.name.lower().endswith("_dark.png") \
               and "_NMP" not in img.name.upper() and img.size[0] > 0:
                tex = img if tex is None or img.size[0] * img.size[1] > \
                    tex.size[0] * tex.size[1] else tex
        new = bpy.data.materials.new("MT " + mname[3:])
        new.use_nodes = True
        nt = new.node_tree
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        if tex:
            tnode = nt.nodes.new("ShaderNodeTexImage")
            tnode.image = tex
            nt.links.new(tnode.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.35
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
        new.vrm_addon_extension.mtoon1.enabled = True
        mt = new.vrm_addon_extension.mtoon1
        if tex:
            mt.base_color_texture.texture = tnode
        for (o, si) in slots:
            o.material_slots[si].material = new
        bl.append(mname)
        log("eye replaced: " + mname + " -> MT (tex=" +
            (tex.name if tex else "NONE") + ")")

    # сохранить блэклист для будущих прогонов
    with open(BLACKLIST, "w") as f:
        f.write("\n".join(sorted(set(bl))) + "\n")

    mats = {ms.material for o in bpy.data.objects if o.type == "MESH"
            for ms in o.material_slots if ms.material}
    converted, failed, skipped = [], [], []
    for m in sorted(mats, key=lambda x: x.name):
        name = m.name
        if not name.startswith("KK "):
            continue
        if name in bl:
            skipped.append(name)
            continue
        try:
            imgs = walk_images(m.node_tree) if m.use_nodes else []
            albedo = None
            shade = None
            big = None
            for n, img in imgs:
                iname = img.name.lower()
                area = img.size[0] * img.size[1]
                if iname.endswith("_dark.png"):
                    shade = n
                elif "_NMP" not in iname.upper() and "_NMPD" not in iname.upper():
                    if big is None or area > big[1].size[0] * big[1].size[1]:
                        big = (n, img)
            if big:
                albedo = big
            mtoon = m.vrm_addon_extension.mtoon1
            mtoon.enabled = True
            top = m.node_tree.nodes

            def ensure(existing):
                if existing is None:
                    return None
                for n in top:
                    if n.type == "TEX_IMAGE" and n.image == existing.image:
                        return n
                nn = top.new(type="ShaderNodeTexImage")
                nn.image = existing.image
                return nn

            if albedo:
                mtoon.base_color_texture.texture = ensure(albedo)
            if shade and hasattr(mtoon, "shade_multiply_texture"):
                mtoon.shade_multiply_texture.texture = ensure(shade)
            try:
                if m.blend_method == "BLEND":
                    mtoon.alpha_mode = "BLEND"
                elif m.blend_method == "CLIP":
                    mtoon.alpha_mode = "MASK"
                    mtoon.alpha_cutoff = 0.5
            except Exception:
                pass
            if albedo:
                converted.append(name)
            else:
                failed.append((name, "no albedo"))
        except Exception as e:
            failed.append((name, repr(e)[:100]))

    log("converted: %d skipped(bl): %d failed: %s" %
        (len(converted), len(skipped), repr(failed)[:400]))

    # Outline материалы -> невидимые
    hidden = 0
    for m in mats:
        if m.name.startswith("Outline") and m.use_nodes \
           and not m.name.startswith("MT"):
            try:
                nt = m.node_tree
                out = next((n for n in nt.nodes
                            if n.type == "OUTPUT_MATERIAL" and n.is_active_output), None)
                if out:
                    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
                    p.inputs["Alpha"].default_value = 0.0
                    p.inputs["Base Color"].default_value = (0, 0, 0, 0)
                    nt.links.new(p.outputs["BSDF"], out.inputs["Surface"])
                m.vrm_addon_extension.mtoon1.enabled = False
                hidden += 1
            except Exception as e:
                log("outline err " + m.name + " " + repr(e)[:80])
    log("outlines off: %d" % hidden)

    for img in bpy.data.images:
        if img.size[0] > 2048 and img.users and not img.packed_file:
            try:
                img.scale(2048, max(1, int(img.size[1] * 2048 / img.size[0])))
            except Exception:
                pass
    log("big textures downscaled")

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
except Exception as e:
    log("EXC: " + repr(e)[:300])
    log("CONVERT_FAIL")