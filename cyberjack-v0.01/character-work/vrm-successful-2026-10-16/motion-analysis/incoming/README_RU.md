# Куда класть скачанные клипы

Структура: `incoming/<источник>/<файлы>` — например `incoming/smutbase/`, `incoming/loverslab/`, `incoming/mmd/`.

Разбор: `python3 tools/external/ingest_clips.py` (определяет формат и что с ним делать).

## Что качать под BDSM-темы (проверено 2026-10-21)

| источник | пак | формат | доступ |
|---|---|---|---|
| LoversLab | Gray's Bondage Animations (Beta) | blend/HKX | нужен аккаунт, Cloudflare режет curl |
| LoversLab | ⛧ Alchemist's Animations ⛧ (со звуком) | blend | нужен аккаунт |
| LoversLab | Fallout 4 Blender Animation Kit | blend | нужен аккаунт |
| SmutBase | Sex Animations Ultimate (13 анимаций) | blend | нужен аккаунт (бесплатный) |
| RenderHub | Tough Love 25 Animation Pack (Genesis 8) | Daz/FBX | платно |
| RenderHub | Gay Spanking Pose Set 1 (10 поз + реквизит) | Daz | платно |
| animationshopee | Spanking (mocap) | FBX | платно |
| hub.virtamate.com | KittyMocap, D Room K009 (spanking) | VAM → FBX | нужен аккаунт |
| BowlRoll | MMD R18 motions | VMD | свободно, но нужен ID файла |

## Что важно при выборе
- **KK-native** (сцены Koikatsu, `abdata/h/anim/*.unity3d`) — лучший вариант: тот же скелет, без ретаргета.
- **BVH** — берётся сразу (`~/.hermes/profiles/qwen8/cache/scratch/bvh_lib.py`).
- **FBX** — ретаргет через `tools/external/pilot_transfer.py`.
- **HKX (Skyrim/Fallout)** — сначала конвертация в FBX (HKXPack/Catwife), потом наш ретаргет.
