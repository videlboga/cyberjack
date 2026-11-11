"""Prop side of the vibrator scenes: prefab meshes and the motion tracks the paired object clips carry.

The game plays two clips at once: the character layer (e.g. Denma_kokan_C_ositukeru_B) and an object clip
of the same name plus _L/_R from h/anim/parts. The object clip is muscle-space with no bone paths, so it
only moves the prop root; this script decodes that motion and exports the prefab it belongs to.
"""
import base64
import json
import re
import struct
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
catalog = json.loads((root / 'animations/catalog.json').read_text())['clips']
by_name = {}
for clip in catalog:
    if clip['rig'] == 'object':
        # Object clips share their name with the body clip, so they need their own map.
        by_name.setdefault('object:' + clip['name'], clip)
    by_name.setdefault(clip['name'], clip)


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


def export_prefab(env, name):
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


def decode_track(clip):
    path = root / 'animations' / clip['asset']
    data = json.loads(path.read_text() if not str(clip['asset']).endswith('.gz') else __import__('gzip').open(path).read())
    dense = data['clip']['m_MuscleClip']['m_Clip']['data']['m_DenseClip']
    curves = dense['m_CurveCount']
    array = dense['m_SampleArray']
    values = struct.unpack(f'<{array["count"]}f', base64.b64decode(array['data']))
    if curves < 3 or not values:
        return None
    frames = [values[i * curves:(i + 1) * curves] for i in range(dense['m_FrameCount'])]
    frames = [f for f in frames if len(f) >= 3]
    if not frames:
        return None
    fps = float(dense['m_SampleRate']) or 30.0
    points = [[round(f[0], 5), round(f[1], 5), round(f[2], 5)] for f in frames]
    # With ten curves the layout is position(0..2), three constant floats (3..5) and a unit quaternion in 6..9:
    # its norm is exactly 1.000 on every frame, which is how the rotation was identified.
    # Ten curves: position 0..2, three constant floats, unit quaternion 6..9.
    # Seven curves: position 0..2 and the quaternion right after it (3..6), as in the dildo clips.
    quats = None
    if curves >= 10:
        quats = [[round(f[6], 5), round(f[7], 5), round(f[8], 5), round(f[9], 5)] for f in frames]
    elif curves >= 7:
        quats = [[round(f[3], 5), round(f[4], 5), round(f[5], 5), round(f[6], 5)] for f in frames]
    return {'curves': curves, 'fps': fps, 'points': points, 'quaternions': quats,
            'duration': len(points) / fps if fps else 0}


prefab_cache = {}
links = {}
motion = {}
exported = set()
def prefab_for(stem, side):
    if stem.startswith('Denma'):
        return 'p_item_denma_' + side
    if stem.startswith('Dildo'):
        return 'p_item_dildo'
    if stem.startswith('Vibe'):
        return 'p_item_vibe'
    if stem.startswith('Rotor'):
        return 'p_item_rotor_' + side
    return None

for key, clip in list(by_name.items()):
    if not key.startswith('object:'):
        continue
    name = key[len('object:'):]
    # Sided clips are the L/R variants; the rest (dildo, vibe, base) carry the same name as the body clip and
    # belong to a single centre slot.
    if name.endswith('_L') or name.endswith('_R'):
        stem, side = name[:-2], name[-1]
    else:
        stem, side = name, 'C'
    # Base clips have no body counterpart: they are the item's idle animation and are the natural default
    # when the item is applied to a clip of another family.
    is_base = bool(re.search(r'_base', name, re.I))
    if stem not in by_name and not is_base:
        continue
    prefab = prefab_for(stem, side)
    entry = links.setdefault(stem, {})
    entry[side] = {'clip': name, 'clipId': clip['id'], 'prefab': prefab}
    track = decode_track(clip)
    if track:
        motion[clip['id']] = track

env = UnityPy.load(str(game / 'h/common/01.unity3d'))
for prefab in ('p_item_denma_L', 'p_item_denma_R'):
    parts = export_prefab(env, prefab)
    print(prefab, '→ частей', parts)

out = root / 'motion-analysis/data/prop-links.json'
out.write_text(json.dumps({'format': 'prop-links-v1', 'links': links, 'motion': motion}, ensure_ascii=False))
print('связок персонаж↔предмет:', len(links), '| треков:', len(motion))
sample = next(iter(links.items()))
print('пример:', sample[0], '→', json.dumps(sample[1], ensure_ascii=False)[:200])
