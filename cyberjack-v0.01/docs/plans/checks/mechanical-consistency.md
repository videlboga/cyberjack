# Mechanical consistency check — machine modules

Generated 2026-11-10T18:36:55+03:00 by `docs/plans/tools/qa_mechanical_consistency.py` (v1.0.0). **Read-only**: no model, catalog, contract or viewer file is touched.

## Verdict

| metric | value |
|---|---|
| components scanned | 96 |
| checks run | 735 |
| pass | 729 |
| warn | 3 |
| fail | 2 |
| skipped | 1 |
| overall | **FAIL** |

## By area

| area | pass | warn | fail | skipped |
|---|---|---|---|---|
| general | 673 | 0 | 0 | 0 |
| hierarchy_drivers | 28 | 1 | 0 | 0 |
| crank_slider | 8 | 0 | 0 | 0 |
| piston_cam | 6 | 0 | 2 | 0 |
| winch | 7 | 1 | 0 | 1 |
| capsule_transparency | 7 | 1 | 0 | 0 |

## Failures (2)

| check | component | detail |
|---|---|---|
| `cam.contact_sweep` | motion_piston_cam | tangency holds over 72 phases; follower travel 0.1061 m, max step 0.0952 m, residual 1.39e-02 m |
| `cam.stroke_sweep` | motion_piston_cam | cam-demanded follower travel 0.1061 m vs required 0.060 m |

## Warnings (3)

| check | component | detail |
|---|---|---|
| `kin.members_parented` | motion_linear_x | members not under driver node: {'screw': ['screw', 'screw_ring_00', 'screw_ring_01', 'screw_ring_02', 'screw_ring_03', 'screw_ring_04', 'screw_ring_05', 'screw_ring_06', 'screw_ring_07', 'screw_ring_08', 'screw_ring_09', 'screw_ring_10', 'screw_ring_11', 'screw_ring_12', 'screw_ring_13', 'screw_ring_14', 'screw_ring_15', 'screw_ring_16', 'screw_ring_17', 'screw_ring_18', 'screw_ring_19', 'screw_ring_20', 'screw_ring_21', 'screw_ring_22', 'screw_ring_23', 'screw_ring_24', 'screw_ring_25', 'screw_ring_26', 'screw_ring_27', 'screw_ring_28']} |
| `winch.hide_thresholds` | motion_winch | hide thresholds strictly monotone (outside 0..0.3 m: [0.425, 0.39375, 0.3625, 0.33125]) |
| `struct.rounded_nodes` | structure_stall_row | 2 rounded/filleted nodes, e.g. ['pod_pads', 'occupancy_lenses'] |

## Skipped (1)

| check | component | reason |
|---|---|---|
| `winch.drum_axis_declared` | motion_winch | no drum kinematics in catalog/contracts |

## 1. Hierarchy and drivers

Rule: every declared driver node exists in the GLB, driver ids are unique, every `members` entry
resolves, axes are limited to `x/y/z`, constraint members reference real drivers, and no part sits
in two rotating groups at once (checked over all revolute pairs).

| component | drivers | source | status |
|---|---|---|---|
| motion_linear_x | 2 | component-catalog.json | warn |
| motion_oscillating | 3 | component-catalog.json | pass |
| motion_piston_cam | 2 | component-catalog.json | pass |
| work_tickle_pair | 2 | component-catalog.json | pass |

## 2. Crank-slider (motion_oscillating)

- measured crank radius 0.02000 m, rod 0.20400 m, rest phase 90.00°
- rod length over 36 phases: 0.204000 … 0.204000 m, drift 0.000000 m (tol 0.000500) → **pass**
- eye fit: big eye 0.000000 m, small eye 0.000000 m → **pass**
- slider stroke 0.0400 m vs catalog 0.0400 m → **pass**
- artifact: `docs/plans/checks/kinematics_oscillating.json`

## 3. Cam (motion_piston_cam)

- `cam.profile`: profile r 0.0300..0.0900 m, stroke 0.0600 m, roller R 0.0161 m → **pass**
- `cam.stroke`: measured stroke 0.0600 m vs required 0.060 m → **pass**
- `cam.law_vs_profile`: follower uses measured cam_profile table → **pass**
- artifact: `docs/plans/checks/cam_profile_motion_piston_cam.json`

## 4. Winch (motion_winch)

- `winch.rope_nodes`: all 15 rope nodes present → **pass**
- `winch.branch_length`: rope_branch spans 0.3000 m (expected 0.300) → **pass**
- `winch.branch_declared`: catalog payout.length_m 0.300 vs measured 0.3000 → **pass**
- `winch.branch_direction`: rope end offset 0.3000 m along y → **pass**
- `winch.hide_thresholds`: hide thresholds strictly monotone (outside 0..0.3 m: [0.425, 0.39375, 0.3625, 0.33125]) → **warn**
- `winch.turn_indices`: turn_index matches node suffix → **pass**
- `winch.drum_axis_x`: drum bbox 0.252/0.143/0.143 m, long axis x → **pass**
- `winch.drum_axis_declared`: no drum kinematics in catalog/contracts → **skipped**
- `winch.payout_axis`: payout axis 'y' → **pass**

## 5. Capsule transparency (structure_cage, structure_stall_row)

- `struct.glass_alpha` (structure_cage): 2 transparent material(s), alphas [0.2, 0.26] → **pass**
- `struct.opaque_facade` (structure_cage): max opaque envelope coverage 24.7% (limit 50%, band 0.12 m) → **pass**
- `struct.flat_panels` (structure_cage): 78 flat opaque parts, none covering >50% of a facade upright → **pass**
- `struct.rounded_nodes` (structure_cage): 50 rounded/filleted nodes, e.g. ['ring_bottom', 'ring_top', 'ring_belt', 'post_corner_fr_collar', 'post_corner_br_collar', 'post_corner_bl_collar'] → **pass**
- `struct.glass_alpha` (structure_stall_row): 2 transparent material(s), alphas [0.26, 0.2] → **pass**
- `struct.opaque_facade` (structure_stall_row): max opaque envelope coverage 25.1% (limit 50%, band 0.12 m) → **pass**
- `struct.flat_panels` (structure_stall_row): 8 flat opaque parts, none covering >50% of a facade upright → **pass**
- `struct.rounded_nodes` (structure_stall_row): 2 rounded/filleted nodes, e.g. ['pod_pads', 'occupancy_lenses'] → **warn**

## 6. Library-wide checks (all 96 components)

Per component: model file resolves and parses, node-name prefix, no cameras/lights, no dead or
non-finite meshes, alpha/alphaMode consistency, unique node names, catalog node count.

| check | pass | warn | fail |
|---|---|---|---|
| `gen.alpha_mode` | 96 | 0 | 0 |
| `gen.cameras_lights` | 96 | 0 | 0 |
| `gen.geometry` | 96 | 0 | 0 |
| `gen.library_size` | 1 | 0 | 0 |
| `gen.model_file` | 96 | 0 | 0 |
| `gen.node_count` | 96 | 0 | 0 |
| `gen.prefix` | 96 | 0 | 0 |
| `gen.unique_names` | 96 | 0 | 0 |

## Method

The tool re-derives everything from the shipped GLB: it composes node world transforms
(TRS/matrix chains), reads POSITION accessors, measures the cam profile as a polar radius
envelope about the `anim` axis, measures crank radius, rod length and eye centres from mesh
centroids, and rasterises opaque triangles onto all four vertical facades for the occlusion
fraction. Contract values from `component-catalog.json` / `component-contracts.json` are only
compared against these measurements, never used as the measurement itself.

Reproduce:

```
python3 docs/plans/tools/qa_mechanical_consistency.py
python3 docs/plans/tools/qa_mechanical_consistency.py --no-runtime   # geometry only
```

