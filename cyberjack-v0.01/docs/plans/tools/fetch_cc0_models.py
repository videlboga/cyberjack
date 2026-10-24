"""Скачать открытые CC0-модели реквизита (Poly Haven) для комнат лаборатории.

Лицензия всех моделей — CC0. Качается gltf 1k вместе с текстурами и .bin,
раскладка: assets/cc0/models/<id>/<id>_1k.gltf + textures/ + .bin.

Запуск: python3 tools/fetch_cc0_models.py
Выход: assets/cc0/models/, assets/cc0/models_manifest.json
"""
import json, os, urllib.request

ROOT = '/home/cyberkitty/Projects/cyberjack/assets/cc0'
API = 'https://api.polyhaven.com/files/'
UA = 'Mozilla/5.0 (compatible; cyberjack-lab-assets/1.0; +https://polyhaven.com)'

# id: назначение в комнатах
MODELS = {
    'medical_box': 'медбокс: аптечка на стену, медблок и калибровочная',
    'chemistry_set': 'химия: колбы и реагенты, калибровочная и склад',
    'steel_frame_shelves_01': 'стеллаж: склад, техузел, медблок',
    'metal_office_desk': 'стол: пост наблюдения, комната персонала',
    'metal_stool_01': 'табурет: рабочие места у станций',
    'tool_cart': 'тележка инструментов: ремонтный бокс, станции',
    'wheelchair_01': 'кресло-каталка: медблок',
    'utility_box_01': 'настенный щиток: технические узлы всех комнат',
    'security_camera_01': 'камера наблюдения: пост, коридоры',
    'plastic_crate_01': 'контейнер: склад, перевозка образцов',
    'drawer_cabinet': 'тумба с ящиками: калибровочная, пост',
    'clipboard': 'планшет с бумагами: рабочие поверхности',
    'desk_lamp_arm_01': 'лампа на кронштейне: столы и посты',
    'projector_screen': 'экран: пост наблюдения, камера',
}


def _open(url, timeout=120):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    return urllib.request.urlopen(req, timeout=timeout)


def download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 512:
        return 'skip'
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.part'
    with _open(url) as r, open(tmp, 'wb') as f:
        while True:
            chunk = r.read(1 << 16)
            if not chunk:
                break
            f.write(chunk)
    os.replace(tmp, path)
    return 'ok'


def main():
    manifest = {'license': 'CC0', 'source': 'polyhaven.com', 'models': []}
    for mid, role in MODELS.items():
        try:
            files = json.load(_open(API + mid))
        except Exception as e:
            print('MISS', mid, e)
            continue
        gltf = files.get('gltf', {}).get('1k', {}).get('gltf')
        if not gltf:
            print('NO GLTF', mid)
            continue
        base = os.path.join(ROOT, 'models', mid)
        main_file = os.path.join(base, os.path.basename(gltf['url']))
        download(gltf['url'], main_file)
        for rel, info in (gltf.get('include') or {}).items():
            download(info['url'], os.path.join(base, rel))
        size = sum(os.path.getsize(os.path.join(dp, f))
                   for dp, _, fs in os.walk(base) for f in fs)
        print('MODEL', mid, f'{size/1e6:.1f} MB')
        manifest['models'].append({'id': mid, 'role': role,
                                   'file': os.path.relpath(main_file, ROOT),
                                   'bytes': size})
    with open(os.path.join(ROOT, 'models_manifest.json'), 'w') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print('MANIFEST', len(manifest['models']), 'models')


if __name__ == '__main__':
    main()
