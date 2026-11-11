"""Export item prefabs to OBJ + MTL + PNG textures, in prefab-root space.

Mesh data is decoded straight from the VertexData streams (positions at channel 0 offset 0, UV0 at the
channel that has dimension 2) because the library exporter drops UVs, and materials/textures are taken
from the renderer of each part.
"""
import json
import struct
from pathlib import Path

import numpy as np
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler

root = Path(__file__).resolve().parents[2]
table = json.loads((root / 'motion-analysis/data/item-table.json').read_text())['items']
game = Path('/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine BetterRepack/'
            '[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/abdata')
out_dir = root / 'motion-analysis/review/items'
tex_dir = out_dir / 'tex'
tex_dir.mkdir(parents=True, exist_ok=True)

exported_textures = {}


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


def parse_mesh(mesh):
    """Positions, UV0 and indices via MeshHandler, which decodes the VertexData streams."""
    handler = MeshHandler(mesh)
    try:
        handler.process()
    except Exception:
        pass
    vertices = np.array([[v[0], v[1], v[2]] for v in (handler.m_Vertices or [])], dtype=float)
    uvs = np.array([[uv[0], uv[1]] for uv in (handler.m_UV0 or [])], dtype=float)
    if not len(vertices):
        return vertices, uvs, []
    indices = handler.m_IndexBuffer or []
    triangles = [indices[i:i + 3] for i in range(0, len(indices) - 2, 3)]
    return vertices, uvs, triangles


def renderer_of(go):
    for component in go.m_Components:
        if component.type.name not in ('MeshRenderer', 'SkinnedMeshRenderer'):
            continue
        try:
            return component.read()
        except Exception:
            return None
    return None


def material_of(renderer):
    if renderer is None or not renderer.m_Materials:
        return None
    try:
        return renderer.m_Materials[0].read()
    except Exception:
        return None


def texture_of(material):
    if material is None:
        return None
    try:
        for key, value in material.m_SavedProperties.m_TexEnvs:
            if key != '_MainTex':
                continue
            texture = value.m_Texture.read()
            name = getattr(texture, 'm_Name', '') or 'tex'
            path = tex_dir / (name + '.png')
            if name not in exported_textures:
                image = texture.image
                if image is None:
                    return None
                image.save(path)
                exported_textures[name] = path.name
            return exported_textures[name]
        return None
    except Exception:
        return None


def walk(transform, parent, parts):
    matrix = parent @ local_matrix(transform)
    go = transform.m_GameObject.read()
    for component in go.m_Components:
        if component.type.name not in ('MeshFilter', 'SkinnedMeshRenderer'):
            continue
        try:
            mesh = component.read().m_Mesh.read()
        except Exception:
            continue
        vertices, uvs, tris = parse_mesh(mesh)
        if not len(tris):
            continue
        renderer = renderer_of(go)
        material = material_of(renderer)
        parts.append({
            'name': getattr(material, 'm_Name', None) or 'item',
            'texture': texture_of(material),
            'vertices': np.hstack([vertices, np.ones((len(vertices), 1))]) @ matrix.T,
            'uvs': uvs,
            'tris': tris,
        })
    for child in transform.m_Children:
        try:
            walk(child.read(), matrix, parts)
        except Exception:
            continue


def export_prefab(env, name, obj_path):
    for obj in env.objects:
        if obj.type.name != 'GameObject':
            continue
        go = obj.read()
        if go.m_Name != name:
            continue
        roots = [c.read() for c in go.m_Components if c.type.name == 'Transform']
        if not roots:
            return 0, []
        parts = []
        walk(roots[0], np.eye(4), parts)
        if not parts:
            return 0, []
        lines = ['# item prefab ' + name, 'mtllib ' + obj_path.stem + '.mtl']
        v_offset = vt_offset = 1
        materials = []
        for part in parts:
            if part['name'] not in materials:
                materials.append(part['name'])
            lines.append('usemtl ' + part['name'])
            for vertex in part['vertices'][:, :3]:
                lines.append(f'v {vertex[0]:.5f} {vertex[1]:.5f} {vertex[2]:.5f}')
            for uv in part['uvs']:
                lines.append(f'vt {uv[0]:.5f} {uv[1]:.5f}')
            for tri in part['tris']:
                lines.append('f ' + ' '.join(f'{index + v_offset}/{index + vt_offset}' for index in tri))
            v_offset += len(part['vertices'])
            vt_offset += len(part['uvs'])
        obj_path.write_text('\n'.join(lines) + '\n')
        mtl_path = obj_path.with_suffix('.mtl')
        mtl_lines = []
        for part in parts:
            mtl_lines.append('newmtl ' + part['name'])
            mtl_lines.append('Kd 0.78 0.78 0.78')
            if part['texture']:
                mtl_lines.append('map_Kd tex/' + part['texture'])
            mtl_lines.append('')
        mtl_path.write_text('\n'.join(mtl_lines))
        return len(parts), materials
    return 0, []


cache = {}
manifest = {}
for item_name, record in table.items():
    for param in record['params']:
        asset, obj = param['asset'], param['object']
        if not asset or not obj or obj == 'p_null':
            continue
        if asset not in cache:
            cache[asset] = UnityPy.load(str(game / asset))
        target = out_dir / (obj + '.obj')
        parts, materials = export_prefab(cache[asset], obj, target)
        if parts:
            print(f"{obj}: частей {parts}, материалов {len(materials)} → {target.name} ({target.stat().st_size // 1024} КБ)")
            manifest[obj] = {'file': 'items/' + obj + '.obj', 'mtl': 'items/' + obj + '.mtl',
                             'materials': materials, 'asset': asset}
        else:
            print(f'{obj}: меш не найден')

(root / 'motion-analysis/data/item-meshes.json').write_text(
    json.dumps({'format': 'item-meshes-v2', 'meshes': manifest}, ensure_ascii=False))
print('готово:', len(manifest), 'префабов,', len(exported_textures), 'текстур')
