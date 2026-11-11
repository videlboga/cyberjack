# MetaHuman UI Anchor Mapping (Unreal Engine 5)

This guide maps the existing `partId` system from Unity to MetaHuman bone structure.

## Skeleton: Body (metahuman_base_skel)
Used for all torso, limb and systemic anchors.

| partId | MetaHuman Bone | Offset Recommendation |
| :--- | :--- | :--- |
| `belly` | `pelvis` | center |
| `back` | `spine_02` | offset back (-X or -Y depending on export) |
| `Chest` | `spine_05` | center |
| `arms_l` | `upperarm_l` / `lowerarm_l` | mid-bone |
| `arms_r` | `upperarm_r` / `lowerarm_r` | mid-bone |
| `legs_l` | `thigh_l` / `calf_l` | mid-bone |
| `legs_r` | `thigh_r` / `calf_r` | mid-bone |
| `shoulders` | `clavicle_l` / `clavicle_r` | center |
| `hands` | `hand_l` / `hand_r` | center |
| `feet` | `foot_l` / `foot_r` | center |
| `groin` | `pelvis` | offset down-forward |
| `nipples` | `spine_04` | L/R lateral offsets |
| `buttocks` | `pelvis` | offset back-down |

## Skeleton: Face (Face_Archetype_Skeleton)
Used for head and facial interactions. Note that MetaHuman face uses a separate SkeletalMesh component.

| partId | MetaHuman Bone | Note |
| :--- | :--- | :--- |
| `head` | `head` | top of the head |
| `face` | `head` | offset forward (front of face) |
| `Lips` | `jaw` or `mouth_lower_lip_mid_m` | |
| `mind_state`| `head` | float above head |

## Implementation Strategy in UE5
1. **Detection**: Use `LineTraceByChannel` on a custom Collision Channel (e.g., `UIInteractable`).
2. **Identification**: Give each anchor component a `Tag` (e.g. `cyber_part:belly`).
3. **Projection**: Use `ProjectWorldLocationToScreen` in the PlayerController to send coordinates to React UI.
