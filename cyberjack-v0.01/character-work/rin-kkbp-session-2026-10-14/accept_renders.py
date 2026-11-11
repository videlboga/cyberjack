#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Textured acceptance renders (front/3q/profile) from the KKBP blend."""
import bpy, os, math
from mathutils import Vector

BLEND = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v1.blend"
OUT = os.path.dirname(BLEND)
bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT" if hasattr(bpy.types, "SceneEEVEE") and getattr(
    sc.eevee, "taa_render_samples", 1) == 1 else "BLENDER_EEVEE"
sc.render.resolution_x = 900
sc.render.resolution_y = 1400
sc.render.film_transparent = False
try:
    sc.eevee.taa_render_samples = 16
except Exception:
    pass
world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.28, 0.28, 0.32, 1.0)
bg.inputs[1].default_value = 1.2

arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
bpy.context.view_layer.objects.active = arm
for o in bpy.data.objects:
    if o.type == "MESH":
        o.hide_render = False
        o.hide_viewport = False

# bbox in world space incl. children
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
print("bbox", mn, mx, "h=", height, flush=True)

cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
dist = (height / 2) / math.tan(math.radians(cam_data.angle / 2)) * 1.05

def shot(angle_deg, fname):
    rz = math.radians(angle_deg)
    cam.location = (center.x + dist * math.sin(rz), center.y - dist * math.cos(rz),
                    center.z)
    forward = Vector((center.x, center.y, center.z + height * 0.02)) - cam.location
    cam.rotation_euler = forward.to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(OUT, fname)
    bpy.ops.render.render(write_still=True)
    print("rendered", fname, flush=True)

shot(0, "accept_front.png")
shot(35, "accept_three_q.png")
shot(90, "accept_profile.png")
print("RENDERS_OK", flush=True)