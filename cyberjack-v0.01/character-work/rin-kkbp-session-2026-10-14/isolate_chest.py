#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Isolate Outfit vs Body rendering; find the chest hole."""
import bpy, os, math
from mathutils import Vector

D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14"
bpy.ops.wm.open_mainfile(filepath=os.path.join(D, "Rin_KKBP_v3.blend"))
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = 16
sc.render.resolution_x = 700
sc.render.resolution_y = 1050
w = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
sc.world = w
w.use_nodes = True
bg = w.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.6, 0.6, 0.7, 1.0)
bg.inputs[1].default_value = 1.5

outfit = bpy.data.objects.get("Outfit 00 春野千佳")
body = bpy.data.objects.get("Body 春野千佳")


def render_set(modes, prefix):
    o.set("show", modes)
    sc.render.filepath = os.path.join(D, prefix + ".png")
    bpy.ops.render.render(write_still=True)
    print("shot", prefix, flush=True)


def shot(prefix, visible):
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.hide_render = o.name not in visible
    cam_data = bpy.data.cameras.get("qa_cam") or bpy.data.cameras.new("qa_cam")
    cam_data.lens = 35
    if not bpy.data.objects.get("qa_cam"):
        cam = bpy.data.objects.new("qa_cam", cam_data)
        sc.collection.objects.link(cam)
        sc.camera = cam
    cam = bpy.data.objects["qa_cam"]
    cam.location = (0.0, -3.2, 1.15)
    fwd = Vector((0, -0.1, 1.15)) - cam.location
    cam.rotation_euler = fwd.to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(D, prefix + ".png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", prefix, flush=True)


shot("only_outfit", [outfit.name, "Hair Outfit 00 春野千佳"])
shot("only_body", [body.name])
print("DONE", flush=True)