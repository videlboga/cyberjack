"""Export the remaining aibu item prefabs (vibe, hands, fingers, tongue) to OBJ + MTL."""
import json
from pathlib import Path

import numpy as np
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler

root = Path(__file__).resolve().parents[2]
game = Path('/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine BetterRepack/'
            '[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/abdata')
out_dir = root / 'motion-analysis/review/items'
tex_dir = out_dir / 'tex'
tex_dir.mkdir(parents=True, exist_ok=True)

WANTED = ['p_item_vibe', 'p_handL', 'p_handR', 'p_fingerL', 'p_fingerR', 'p_tang']


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
    handler = MeshHandler(mesh)
    try:
        handler.process()
    except Exception:
        pass
    vertices = np.array([[v[0], v[1], v[2]] for v in (handler.m_Vertices or [])], dtype=float)
    uvs = np.array([[uv[0], uv[1]] for uv in (handler.m_UV0 or [])], dtype=float)
    indices = handler.m_IndexBuffer or []
    return vertices, uvs, [indices[i:i + 3] for i in range(0, len(indices) - 2, 3)]


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
        material = None
        for candidate in go.m_Components:
            if candidate.type.name in ('MeshRenderer', 'SkinnedMeshRenderer'):
                try:
                    renderer = candidate.read()
                    if renderer.m_Materials:
                        material = renderer.m_Materials[0].read()
                except Exception:
                    pass
                break
        texture = None
        if material is not None:
            try:
                for key, value in material.m_SavedProperties.m_TexEnvs:
                    if key == '_MainTex':
                        image = value.m_Texture.read()
                        path = tex_dir / ((getattr(image, 'm_Name', '') or 'tex') + '.png')
                        if not path.exists():
                            image.image.save(path)
                        texture = path.name
                        break
            except Exception:
                pass
        parts.append({
            'name': getattr(material, 'm_Name', 'prop') or 'prop',
            'texture': texture,
            'vertices': np.hstack([vertices, np.ones((len(vertices), 1))]) @ matrix.T,
            'uvs': uvs,
            'tris': tris,
        })
    for child in transform.m_Children:
        try:
            walk(child.read(), matrix, parts)
        except Exception:
            continue


def export(env, name):
    for obj in env.objects:
        if obj.type.name != 'GameObject':
            continue
        go = obj.read()
        if go.m_Name != name:
            continue
        roots = [c.read() for c in go.m_Components if c.type.name == 'Transform']
        if not roots:
            return 0
        parts = []
        walk(roots[0], np.eye(4), parts)
        if not parts:
            return 0
        target = out_dir / (name + '.obj')
        lines = ['# prop prefab ' + name, 'mtllib ' + name + '.mtl']
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
                lines.append('f ' + ' '.join(f'{i + v_offset}/{i + vt_offset}' for i in tri))
            v_offset += len(part['vertices'])
            vt_offset += len(part['uvs'])
        target.write_text('\n'.join(lines) + '\n')
        mtl = ['']
        for part in parts:
            mtl += ['newmtl ' + part['name'], 'Kd 0.78 0.78 0.78']
            if part['texture']:
                mtl.append('map_Kd tex/' + part['texture'])
            mtl.append('')
        (out_dir / (name + '.mtl')).write_text('\n'.join(mtl))
        return len(parts)
    return 0


for bundle in ('h/common/01.unity3d', 'h/common/71.unity3d'):
    env = UnityPy.load(str(game / bundle))
    for name in WANTED:
        if (out_dir / (name + '.obj')).exists():
            continue
        parts = export(env, name)
        print(f'{bundle}: {name} → частей {parts}')
