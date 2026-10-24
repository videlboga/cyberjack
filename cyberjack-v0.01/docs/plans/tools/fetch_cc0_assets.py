"""Скачать открытые CC0-ассеты (Poly Haven) для общего визуального языка лаборатории.

Материалы и HDR — лицензия CC0, источник Poly Haven (polyhaven.com).
Скрипт идемпотентен: существующие файлы не перекачивает.

Запуск: python3 tools/fetch_cc0_assets.py
Выход: assets/cc0/textures/<id>/, assets/cc0/hdr/, assets/cc0/manifest.json
"""
import json, os, sys, urllib.request, urllib.error

ROOT = '/home/cyberkitty/Projects/cyberjack/assets/cc0'
API = 'https://api.polyhaven.com/files/'

# (id, назначение в проекте)
TEXTURES = [
    ('interior_tiles', 'пол: крупная плитка'),
    ('metal_plate_02', 'металл: панели, кромки, рамки'),
    ('painted_concrete', 'стены: окрашенные панели'),
    ('ceiling_interior', 'потолок и потолочные панели'),
    ('leather_white', 'обивка: матрас, сиденья'),
    ('grey_tiles', 'тёмные вставки, цоколи, швы'),
]
HDRIS = [
    ('blocky_photo_studio', 'студийный свет для помещений'),
    ('studio_small_09', 'мягкий студийный свет для крупных планов'),
]


UA = 'Mozilla/5.0 (compatible; cyberjack-lab-assets/1.0; +https://polyhaven.com)'


def _open(url, timeout=60):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    return urllib.request.urlopen(req, timeout=timeout)


def get_json(url):
    with _open(url) as r:
        return json.load(r)


def download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 1024:
        return 'skip'
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.part'
    with _open(url, timeout=180) as r, open(tmp, 'wb') as f:
        while True:
            chunk = r.read(1 << 16)
            if not chunk:
                break
            f.write(chunk)
    os.replace(tmp, path)
    return 'ok'


def pick(node, *keys):
    """Достать ссылку 1k из дерева файлов Poly Haven."""
    cur = node
    for k in keys:
        if not isinstance(cur, dict) or k not in cur:
            return None
        cur = cur[k]
    return cur.get('url') if isinstance(cur, dict) else None


def main():
    manifest = {'license': 'CC0', 'source': 'polyhaven.com', 'textures': [], 'hdris': []}
    for tid, role in TEXTURES:
        try:
            files = get_json(API + tid)
        except urllib.error.HTTPError as e:
            print('MISS', tid, e.code)
            continue
        got = {}
        for map_name, keys in (('diffuse', ('Diffuse', '1k', 'jpg')),
                               ('normal', ('nor_gl', '1k', 'jpg')),
                               ('roughness', ('Rough', '1k', 'jpg')),
                               ('ao', ('AO', '1k', 'jpg'))):
            url = pick(files, *keys)
            if not url:
                url = pick(files, 'Diffuse', '1k', 'png')
            if url:
                dest = os.path.join(ROOT, 'textures', tid, f'{tid}_{map_name}{os.path.splitext(url)[1]}')
                got[map_name] = download(url, dest)
        print('TEX', tid, got)
        manifest['textures'].append({'id': tid, 'role': role, 'maps': got})

    for hid, role in HDRIS:
        try:
            files = get_json(API + hid)
        except urllib.error.HTTPError as e:
            print('MISS', hid, e.code)
            continue
        url = pick(files, 'hdri', '1k', 'hdr')
        if not url:
            print('NO HDR', hid)
            continue
        dest = os.path.join(ROOT, 'hdr', f'{hid}_1k.hdr')
        res = download(url, dest)
        print('HDR', hid, res)
        manifest['hdris'].append({'id': hid, 'role': role, 'file': dest})

    os.makedirs(ROOT, exist_ok=True)
    with open(os.path.join(ROOT, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print('MANIFEST', os.path.join(ROOT, 'manifest.json'))


if __name__ == '__main__':
    main()
