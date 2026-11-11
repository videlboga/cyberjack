"""Export the item prefabs referenced by the H-scene item table to OBJ, in prefab-root space.

Each prefab is a hierarchy of MeshFilters; a merged OBJ per prefab is enough to show the prop next to the
skeleton without materials.
"""
import json
from pathlib import Path

import numpy as np
import UnityPy

root = Path(__file__).resolve().parents[2]
table = json.loads((root / 'motion-analysis/data/item-table.json').read_text())['items']
game = Path('/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine BetterRepack/'
            '[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/abdata')
out_dir = root / 'motion-analysis/review/items'
out_dir.mkdir(parents=True, exist_ok=True)


def quat_matrix(q):
    x, y, z, w = q.x, q.y, q.z, q.w
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0],
        [0, 0, 0, 1],
    ], dtype=float)


def local_matrix(t):
    m = quat_matrix(t.m_LocalRotation)
    m[:3, 0] *= t.m_LocalScale.x
    m[:3, 1] *= t.m_LocalScale.y
    m[:3, 2] *= t.m_LocalScale.z
    m[:3, 3] = [t.m_LocalPosition.x, t.m_LocalPosition.y, t.m_LocalPosition.z]
    return m


def walk(transform, parent, acc):
    matrix = parent @ local_matrix(transform)
    go = transform.m_GameObject.read()
    for component in go.m_Components:
        if component.type.name not in ('MeshFilter', 'SkinnedMeshRenderer'):
            continue
        try:
            data = component.read()
            mesh = data.m_Mesh.read()
        except Exception:
            continue
        obj = mesh.export()
        vertices, faces = [], []
        for line in obj.splitlines():
            if line.startswith('v '):
                _, x, y, z = line.split()[:4]
                vertices.append([float(x), float(y), float(z), 1.0])
            elif line.startswith('f '):
                faces.append([int(p.split('/')[0]) for p in line.split()[1:]])
        if vertices:
            acc.append((np.array(vertices) @ matrix.T, faces))
    for child in transform.m_Children:
        try:
            walk(child.read(), matrix, acc)
        except Exception:
            continue


def export_prefab(env, name, path):
    for obj in env.objects:
        if obj.type.name != 'GameObject':
            continue
        go = obj.read()
        if go.m_Name != name:
            continue
        roots = [c.read() for c in go.m_Components if c.type.name == 'Transform']
        if not roots:
            return 0
        acc = []
        walk(roots[0], np.eye(4), acc)
        if not acc:
            return 0
        offset = 1
        lines = ['# item prefab ' + name]
        for vertices, faces in acc:
            for v in vertices:
                lines.append(f'v {v[0]:.5f} {v[1]:.5f} {v[2]:.5f}')
            for f in faces:
                lines.append('f ' + ' '.join(str(i + offset - 1) for i in f))
            offset += len(vertices)
        path.write_text('\n'.join(lines) + '\n')
        return len(acc)
    return 0


cache = {}
manifest = {}
for item_name, record in table.items():
    for param in record['params']:
        asset, obj = param['asset'], param['object']
        if not asset or not obj:
            continue
        if asset not in cache:
            cache[asset] = UnityPy.load(str(game / asset))
        target = out_dir / (obj + '.obj')
        if not target.exists():
            parts = export_prefab(cache[asset], obj, target)
            print(f'{obj}: {parts} меш(ей) → {target.name} ({target.stat().st_size // 1024} КБ)' if parts else f'{obj}: меш не найден')
        manifest[obj] = {'file': 'items/' + obj + '.obj', 'asset': asset, 'parts': 1}

(root / 'motion-analysis/data/item-meshes.json').write_text(json.dumps({'format': 'item-meshes-v1', 'meshes': manifest}, ensure_ascii=False))
print('готово:', len(manifest), 'префабов')
