#!/usr/bin/env python3
"""Инвентаризация скачанных клипов: что принесли — то и разбираем.

Складывать сюда: motion-analysis/incoming/<источник>/<файлы>
Поддерживается: .bvh, .fbx, .vmd, .blend, .zip/.7z, .anim, .png (сцены KK Studio), .unity3d

Запуск: python3 tools/external/ingest_clips.py
"""
import json
import os
import sys
import zipfile

ROOT = 'motion-analysis/incoming'
BVH_LIB = os.path.expanduser('~/.hermes/profiles/qwen8/cache/scratch')

FORMATS = {
    '.bvh': ('BVH', 'готов сразу: наш bvh_lib.py читает его без конвертации'),
    '.fbx': ('FBX', 'нужен ретаргет: tools/external/pilot_transfer.py (проверено 0.1° по колену)'),
    '.vmd': ('VMD (MMD)', 'нужен Blender: импорт MMD-плагином → FBX → ретаргет'),
    '.blend': ('Blender', 'экспорт в FBX из Blender, затем ретаргет'),
    '.anim': ('Unity anim', 'читается UnityPy, как клипы из zipmod'),
    '.unity3d': ('Unity bundle', 'читается UnityPy (AnimationClip внутри)'),
    '.png': ('KK Studio scene', 'сцена Koikatsu: персонаж+анимация, KK-native'),
    '.zip': ('архив', 'распаковать и прогнать заново'),
    '.7z': ('архив', 'распаковать и прогнать заново'),
}


def human(n):
    for unit in ('Б', 'КБ', 'МБ', 'ГБ'):
        if n < 1024:
            return f'{n:.1f} {unit}'
        n /= 1024
    return f'{n:.1f} ТБ'


def scan():
    if not os.path.isdir(ROOT):
        print(f'папки {ROOT} нет — создаю')
        os.makedirs(ROOT, exist_ok=True)
        return []
    found = []
    for dirpath, _, files in os.walk(ROOT):
        for f in files:
            p = os.path.join(dirpath, f)
            ext = os.path.splitext(f)[1].lower()
            kind, note = FORMATS.get(ext, ('неизвестно', 'посмотреть вручную'))
            found.append({'path': p, 'ext': ext, 'kind': kind, 'note': note,
                          'bytes': os.path.getsize(p)})
    return found


def main():
    items = scan()
    if not items:
        print('пусто. Кладите файлы в', ROOT)
        return
    by_kind = {}
    for it in items:
        by_kind.setdefault(it['kind'], []).append(it)
    print(f'файлов: {len(items)} · суммарно {human(sum(i["bytes"] for i in items))}\n')
    for kind, group in sorted(by_kind.items(), key=lambda kv: -len(kv[1])):
        print(f'{kind}: {len(group)} · {human(sum(i["bytes"] for i in group))}')
        for it in group[:6]:
            print(f'   {os.path.relpath(it["path"], ROOT)}  ({human(it["bytes"])}) — {it["note"]}')
        if len(group) > 6:
            print(f'   … ещё {len(group) - 6}')
        print()

    # архивы: показать, что внутри
    for it in [i for i in items if i['ext'] == '.zip']:
        try:
            with zipfile.ZipFile(it['path']) as z:
                names = z.namelist()
                ext_count = {}
                for n in names:
                    e = os.path.splitext(n)[1].lower()
                    ext_count[e] = ext_count.get(e, 0) + 1
                print(f'архив {os.path.basename(it["path"])}: {len(names)} файлов, {ext_count}')
        except Exception as exc:
            print('архив не открылся:', it['path'], exc)

    with open(os.path.join(ROOT, '_inventory.json'), 'w') as f:
        json.dump(items, f, ensure_ascii=False, indent=1)
    print(f'\nинвентарь записан: {os.path.join(ROOT, "_inventory.json")}')


if __name__ == '__main__':
    main()
