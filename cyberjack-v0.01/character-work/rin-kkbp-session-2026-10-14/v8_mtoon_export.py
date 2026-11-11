#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MToon material conversion + re-export (run under xvfb via timer)."""
import bpy, os, traceback

BLEND_IN = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v1.blend"
BLEND_OUT = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v2.blend"
OUT_VRM = os.path.splitext(BLEND_OUT)[0] + ".vrm"
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
            out.append(n)
        elif n.type == "GROUP" and n.node_tree and n.node_tree.name not in seen:
            seen.add(n.node_tree.name)
            out += walk_images(n.node_tree, seen)
    return out


def main():
    log("=== MToon conversion start")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND_IN)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")

    mats = {ms.material for o in bpy.data.objects if o.type == "MESH"
            for ms in o.material_slots if ms.material}
    converted, failed = [], []
    for m in mats:
        name = m.name
        if not name.startswith("KK "):
            continue  # Outline * и прочие служебные
        try:
            imgs = walk_images(m.node_tree) if m.use_nodes else []
            albedo = None
            shade = None
            biggest = None
            for n in imgs:
                iname = n.image.name.lower()
                area = n.image.size[0] * n.image.size[1]
                if iname.endswith("_dark.png"):
                    shade = n
                elif "_NMP" in iname or "_NMPD" in iname or iname.endswith("_lm_00.png"):
                    pass
                else:
                    if biggest is None or area > biggest.image.size[0] * biggest.image.size[1]:
                        biggest = n
            if biggest is not None and biggest.image.size[0] > 0:
                albedo = biggest
            mtoon = m.vrm_addon_extension.mtoon1
            log("   enabled: " + name)
            mtoon.enabled = True
            top = m.node_tree.nodes

            def ensure_node(existing):
                if existing is None:
                    return None
                for n in top:
                    if n.type == "TEX_IMAGE" and n.image == existing.image:
                        return n
                nn = top.new(type="ShaderNodeTexImage")
                nn.image = existing.image
                nn.name = "MT_" + existing.image.name[:40]
                return nn

            if albedo is not None:
                a = ensure_node(albedo)
                log("   base node: " + name)
                if hasattr(mtoon.base_color_texture, "texture"):
                    mtoon.base_color_texture.texture = a
                    log("   base assigned: " + name)
            if shade is not None and hasattr(mtoon, "shade_multiply_texture"):
                s = ensure_node(shade)
                mtoon.shade_multiply_texture.texture = s
                log("   shade assigned: " + name)
            if m.blend_method in ("BLEND", "HASHED", "CLIP"):
                try:
                    mtoon.alpha_mode = ("BLEND" if m.blend_method == "BLEND"
                                        else "MASK" if m.blend_method == "CLIP"
                                        else "MASK")
                    mtoon.alpha_cutoff = 0.5
                    log("   alpha: " + name)
                except Exception:
                    pass
            if albedo is not None:
                converted.append(name)
            else:
                failed.append((name, "no albedo image"))
        except Exception as e:
            failed.append((name, repr(e)[:120]))

    log("converted: %d" % len(converted))
    log("failed: " + repr(failed)[:600])

    # Outline materials -> invisible (alpha 0), чтобы не рисовать белые оболочки
    hidden = 0
    for m in mats:
        if m.name.startswith("Outline") and m.use_nodes:
            try:
                outn = next((n for n in m.node_tree.nodes
                             if n.type == "OUTPUT_MATERIAL" and n.is_active_output), None)
                if outn is None:
                    continue
                src = outn.inputs["Surface"].links
                # самый простой надёжный путь: прозрачный Principled в активный выход
                p = m.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
                p.inputs["Alpha"].default_value = 0.0
                p.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 0.0)
                m.node_tree.links.new(p.outputs["BSDF"], outn.inputs["Surface"])
                mtoon = m.vrm_addon_extension.mtoon1
                if hasattr(mtoon, "enabled"):
                    mtoon.enabled = False
                hidden += 1
            except Exception as e:
                log("outline err " + m.name + " " + repr(e)[:100])
    log("outlines neutralized: %d" % hidden)

    # Даунскейл больших текстур (размер-буджет)
    for img in bpy.data.images:
        if img.size[0] > 2048 and img.users:
            try:
                img.scale(2048, max(1, int(img.size[1] * 2048 / img.size[0])))
            except Exception:
                pass
    log("textures downscaled to <=2048")

    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    bpy.context.view_layer.objects.active = arm
    meta = arm.data.vrm_addon_extension.vrm1.meta
    meta.vrm_name = "Рин"
    meta.author = "cyberkitty"
    arm.data.vrm_addon_extension.spec_version = "1.0"
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    log("saved " + BLEND_OUT)

    # экспорт (проверенный путь)
    import importlib
    exporter = importlib.import_module(
        "bl_ext.user_default.vrm.exporter.export_scene")
    from pathlib import Path

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

    wm = bpy.context.window_manager
    win = wm.windows[0]
    area = next(a for a in win.screen.areas if a.type == "VIEW_3D")
    region = next(r for r in area.regions if r.type == "WINDOW")
    log("export start -> " + OUT_VRM)
    with bpy.context.temp_override(window=win, screen=win.screen, area=area,
                                   region=region, object=arm,
                                   active_object=arm, selected_objects=[arm]):
        exporter._export_vrm(Path(OUT_VRM), Shim(), bpy.context,
                             armature_object_name=arm.name)
    ok = os.path.exists(OUT_VRM)
    log("export size: " + str(os.path.getsize(OUT_VRM) if ok else -1))
    log("VRM_EXPORT_OK" if ok else "VRM_EXPORT_FAIL")
    bpy.ops.wm.quit_blender()


try:
    main()
except Exception:
    log("EXCEPTION:\n" + traceback.format_exc())
    log("VRM_EXPORT_FAIL")
    try:
        bpy.ops.wm.quit_blender()
    except Exception:
        pass