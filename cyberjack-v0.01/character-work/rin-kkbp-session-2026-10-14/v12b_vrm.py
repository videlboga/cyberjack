#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v12b: finish wiring (hair/megane baked, dupes, tongue), drop Bonelyfans,
VRM ops (T-pose, expressions, springbones), MToon convert, export v5."""
import bpy, os, traceback, importlib
from pathlib import Path

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
BLEND = D + "/Rin_MMD_v5.blend"
OUT_VRM = D + "/Rin_MMD_v5.vrm"
ROOT_DIR = ("/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine "
            "BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/"
            "Export_PMX/20261014190816_春野千佳")
LOG = D + "/v12b.log"


def log(m):
    with open(LOG, "a", encoding="utf8") as f:
        f.write(str(m) + "\n")
    print(m, flush=True)


def link_tex(mat, img):
    nt = mat.node_tree
    tex = next((n for n in nt.nodes if n.type == "TEX_IMAGE" and
                n.image and n.image == img), None)
    if tex is None:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        tex.location = (-400, -200)
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    outn = next((n for n in nt.nodes
                 if n.type == "OUTPUT_MATERIAL" and n.is_active_output) or
                [None], None) or nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], outn.inputs["Surface"])


def main():
    log("=== v12b")
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.vrm")

    # ---- догиревка недостающих
    fixed_ids = []
    for m in sorted(bpy.data.materials, key=lambda x: x.name):
        if m.name.startswith("Outline"):
            continue
        if not m.name.startswith(('Bonelyfans', 'cf_m_namida', 'cf_m_sirome',
                                  'cf_m_tang', 'cf_m_hair', 'acs_m_megane',
                                  'acs_m_lens')):
            continue
        base = m.name.split('.')[0]           # cf_m_namida_00.001 -> cf_m_namida_00
        base = base[:len(base) - len(base.lstrip())] or base
        # candidates: pre_light root, MT_CT root, baked dir
        for cand, key in (
            (ROOT_DIR + "/pre_light/" + base + "_light.png", None),
            (D + "/baked/" + base + "_light.png", None),
            (ROOT_DIR + "/" + base + "_MT_CT.png", None),
            (ROOT_DIR + "/Outfit 00/" + base + "_MT_CT.png", None),
        ):
            key = key or base + "_" + os.path.basename(cand)
            if os.path.exists(cand):
                img = bpy.data.images.get(base + "_" + os.path.basename(cand))
                if img is None:
                    img = bpy.data.images.load(cand)
                link_tex(m, img)
                fixed_ids.append((m.name, base + "_" + os.path.basename(cand)))
                break
    log("fixed: " + repr(fixed_ids)[:400])

    # у Bonelyfans убрать из экспорта: полигонов не должно быть
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        slots = o.material_slots
        kill = [i for i, ms in enumerate(slots)
                if ms.material and 'Bonelyfan' in ms.material.name]
        if kill:
            bpy.context.view_layer.objects.active = o
            o.select_set(True)
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='DESELECT')
            for p in o.data.polygons:
                if p.material_index in kill:
                    p.select = True
            bpy.ops.mesh.delete(type='VERT')
            bpy.ops.object.mode_set(mode='OBJECT')
            log("bonelyfan polys removed from " + o.name)

    # ---- дубли материалов с одинаковыми именами не удаляем (separate slots ok)

    # ---- VRM ops
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    wm = bpy.context.window_manager
    win = wm.windows[0] if wm.windows else bpy.context.window
    area = next(a for a in win.screen.areas if a.type == "VIEW_3D")
    region = next(r for r in area.regions if r.type == "WINDOW")
    ctx = dict(window=win, screen=win.screen, area=area, region=region,
               object=arm, active_object=arm, selected_objects=[arm])
    with bpy.context.temp_override(**ctx):
        bpy.ops.vrm.assign_vrm1_humanoid_human_bones_automatically()
        bpy.ops.vrm.apply_humanoid_t_pose()
        bpy.ops.vrm.assign_vrm1_expressions_automatically()
        bpy.ops.vrm.assign_spring_bone1_automatically()
    arm.data.vrm_addon_extension.spec_version = "1.0"
    arm.data.vrm_addon_extension.vrm1.meta.vrm_name = "Рин"
    arm.data.vrm_addon_extension.vrm1.meta.author = "cyberkitty"
    log("vrm ops + tpose + expressions + springbones OK")

    # ---- MToon convert всех материалов
    ok, bad = 0, []
    for m in bpy.data.materials:
        if m.name.startswith("Outline") or not m.use_nodes:
            continue
        try:
            bpy.ops.vrm.convert_material_to_mtoon1(material_name=m.name)
            ok += 1
        except Exception as e:
            bad.append((m.name, repr(e)[:60]))
    log("mtoon converted %d / bad %s" % (ok, repr(bad)[:200]))

    # линзы прозрачные заново после конверта
    for m in bpy.data.materials:
        if 'lens' in m.name.lower() and m.vrm_addon_extension.mtoon1:
            mm = m.vrm_addon_extension.mtoon1
            mm.enabled = True
            try:
                mm.pbr_metallic_roughness.base_color_factor = (1, 1, 1, 0.25)
                mm.pbr_metallic_roughness.base_color_texture.index.source = None
                mm.alpha_mode = 'BLEND'
                log("lens mtoon alpha ok")
            except Exception as e:
                log("lens err " + repr(e)[:100])

    # даунскейл >2048
    for img in bpy.data.images:
        if img.size[0] > 2048 and img.users and not img.packed_file:
            try:
                img.scale(2048, max(1, int(img.size[1] * 2048 / img.size[0])))
            except Exception:
                pass

    bpy.ops.wm.save_as_mainfile(filepath=D + "/Rin_MMD_v5_final.blend")
    log("saved blend")

    # ---- экспорт
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
    log("export size " + str(os.path.getsize(OUT_VRM) if
                             os.path.exists(OUT_VRM) else -1))
    log("VRM_EXPORT_OK" if os.path.exists(OUT_VRM) else "VRM_EXPORT_FAIL")
    bpy.ops.wm.quit_blender()


try:
    main()
except Exception:
    log("EXC:\n" + traceback.format_exc())
    log("VRM_EXPORT_FAIL")