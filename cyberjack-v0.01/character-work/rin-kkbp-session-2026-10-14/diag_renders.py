#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Diagnostic render: Cycles-CPU, wide fov, 2 angles + numeric gates."""
import bpy, os, math
from mathutils import Vector

BLEND = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v1.blend"
OUT = os.path.dirname(BLEND)
bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = 16
sc.render.resolution_x = 768
sc.render.resolution_y = 1152
world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.35, 0.35, 0.4, 1.0)
bg.inputs[1].default_value = 1.5

arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
for o in bpy.data.objects:
    if o.type == "MESH":
        o.hide_render = False
        o.hide_viewport = False

mn = Vector((1e9,) * 3)
mx = Vector((-1e9,) * 3)
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    for corner in o.bound_box:
        c = o.matrix_world @ Vector(corner)
        mn = Vector(map(min, mn, c))
        mx = Vector(map(max, mx, c))
center = (mn + mx) / 2
height = mx.z - mn.z
print("BBOX", mn, mx, height, flush=True)

cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 35
cam = bpy.data.objects.new("cam", cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
dist = (height * 0.62) / math.tan(math.radians(38) / 2) * 1.1
print("DIST", dist, flush=True)


def shot(rz_deg, fname):
    rz = math.radians(rz_deg)
    loc = (center.x + dist * math.sin(rz), center.y - dist * math.cos(rz),
           center.z + height * 0.02)
    cam.location = loc
    forward = Vector((center.x, center.y, center.z)) - cam.location  # LOOK AT
    cam.rotation_euler = forward.to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(OUT, fname)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", fname, flush=True)


shot(0, "diag_front.png")
shot(40, "diag_three_q.png")
print("DIAG_OK", flush=True)