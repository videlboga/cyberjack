# Original Koikatsu Sunshine idle animation extraction

`koikatsu-idles.json` contains seven original nonsexual stand/idle loops from the installed Koikatsu Sunshine EX BetterRepack R6 `abdata/adv/motion/controller/adv/00.unity3d` bundle. These are decoded original quaternion curves, not procedural replacements.

Format `koikatsu-generic-v1`:
- `sourceRig`: 565 original female skeleton transforms from `abdata/chara/oo_base.unity3d`, prefab `p_cf_body_bone`; local `position`, quaternion `rotation` (xyzw), `scale`, and parent name.
- `clips`: Idle_00_00, Stand_00_00, Stand_01_00, Stand_03_00, Stand_07_00, Stand_17_00, Stand_Joy_01. Each clip includes 326 local rotation tracks sampled at 30 fps, 41 frames across approximately 1.33333 seconds. Track `rotations` is flat xyzw; `times` is seconds.
- `sourcePathId`, source bundle, and provenance identify original Unity assets.

Coordinate system is original Unity left-handed. Mirror Z to right-handed using quaternion `[-x,-y,z,w]`. Rotations are absolute source local transforms. Compute source animated world orientation through the full hierarchy, compare against source rest world orientation, then apply the world delta to the target skeleton rest orientation. Direct local quaternion assignment to Blender-exported VRM bone bases is incorrect.

All 3430 float channels in each original clip were decoded and accounted for, from streamed cubic-polynomial channels, dense sample arrays, and constant channels. Generic transform bindings were resolved using CRC32 of Avatar m_TOS path suffixes. Only rotation channels are exported; root translation and facial animation are not part of this asset set. This retains idle body motion without altering target body proportions or root location.

`extract.py` is a reproducible read-only extraction script. It does not alter the installed game or model.

For the supplied Rin KKBP/PMX avatar, the source and target X directions are reversed. The viewer therefore uses mirror-X [x,-y,-z,w] for world rotation deltas, calibrated against matching left/right rest joints. The generic mirror-Z instruction above applies to a differently oriented target.
