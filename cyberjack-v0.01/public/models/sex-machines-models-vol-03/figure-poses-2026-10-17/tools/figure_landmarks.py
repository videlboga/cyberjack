# Voxel figure landmarks: candidate pickers per machine figure + annotated scene QC renders.
# Machine frame = prepared-2026-10-16 GLB frame (metres, Y-up). Anchor matrix maps figure into the machine.
import sys, os, json, math, pickle
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from skp_glb_figure import parse_glb, extract_figure_triangles, node_world_matrices, read_accessor
from render_scene import scene_render, rot, project

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REP = os.path.join(BASE, 'reports')


def fig_voxels(mid):
    j, b = parse_glb(f"{BASE}/../prepared-2026-10-16/reference-full/SexMachineModel-{mid}.glb")
    V, F = extract_figure_triangles(j, b)
    spacing = float(np.clip((V.max(0) - V.min(0)).min() / 70, 0.008, 0.018))
    from skp_figure_pose import voxelize, to_solid if False else voxelize  # placeholder
    return V, F


def vox_solid(V, F, spacing):
    import importlib.util as iu
    spec = iu.spec_from_file_location("sfp", os.path.join(os.path.dirname(os.path.abspath(__file__)), "skp_figure_pose.py"))
    return None