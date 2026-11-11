#!/usr/bin/env python3
"""Вынимает вещь одежды из zipmod Koikatsu в GLB, пригодный для нашего гардероба.

Скелет в GLB — кости VRM-тела (имена + inverseBindMatrices один-в-один), поэтому вещь
пришивается к телу тем же способом, что и вынутая из запечённых аутфитов.

Запуск:
  python3 extract_zipmod_garment.py --vrm characters/mira/Mira_outfit_03.vrm \
      --rig animations/source_rigs.json \
      --zipmod "<...>/Sideloader Modpack/[mat]Tops v1.1.zipmod" \
      --mesh o_top_ofcard_a --slot top --out wardrobe/items/mira-kk
"""
import argparse, io, json, os, struct, sys, zipfile
import numpy as np
import UnityPy

FMT_SIZE = {0: 4, 1: 2, 2: 4, 3: 1}   # float32, float16, (color), uint8
GLB_MAGIC, CHUNK_JSON, CHUNK_BIN = 0x46546C67, 0x4E4F534A, 0x004E4942


# ---------- VRM ----------
def read_glb(path):
    with open(path, 'rb') as f:
        magic, ver, length = struct.unpack('<III', f.read(12))
        chunks = {}
        while f.tell() < length:
            clen, ctype = struct.unpack('<II', f.read(8))
            chunks[ctype] = f.read(clen)
    return json.loads(chunks[CHUNK_JSON].decode()), chunks.get(CHUNK_BIN, b'')


def vrm_skeleton(vrm_path):
    doc, bin_ = read_glb(vrm_path)
    skin = doc['skins'][0]
    names = [doc['nodes'][i].get('name') for i in skin['joints']]
    acc = doc['accessors'][skin['inverseBindMatrices']]
    bv = doc['bufferViews'][acc['bufferView']]
    off = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
    ibm = np.frombuffer(bin_, dtype=np.float32, count=acc['count'] * 16, offset=off).reshape(-1, 16)
    return names, ibm


# ---------- KK ----------
def find_garment(zipmod, mesh_name):
    with zipfile.ZipFile(zipmod) as z:
        for entry in z.namelist():
            if not entry.endswith('.unity3d'):
                continue
            try:
                env = UnityPy.load(io.BytesIO(z.read(entry)))
            except Exception:
                continue
            for obj in env.objects:
                if obj.type.name != 'SkinnedMeshRenderer':
                    continue
                try:
                    smr = obj.read()
                    mesh = smr.m_Mesh.read()
                except Exception:
                    continue
                if mesh.m_Name == mesh_name:
                    return smr, mesh, env
    raise SystemExit('не нашёл меш %s в %s' % (mesh_name, os.path.basename(zipmod)))


def mesh_arrays(mesh):
    vd = mesh.m_VertexData
    n = vd.m_VertexCount
    raw = bytes(vd.m_DataSize)
    ch = {i: c for i, c in enumerate(vd.m_Channels)}

    def stride(stream):
        return max((c.offset + c.dimension * FMT_SIZE.get(c.format, 4)
                    for c in ch.values() if c.dimension and c.stream == stream), default=0)
    s0 = stride(0)
    base1 = n * s0
    pos_off = ch[0].offset
    nrm_off = ch[1].offset if 1 in ch and ch[1].dimension else pos_off
    w_off = ch[7].offset if 7 in ch and ch[7].dimension else None
    uv_off = (base1 + ch[3].offset) if 3 in ch and ch[3].dimension else None

    # потоки интерливованные: позиция/нормаль/веса лежат в потоке 0 с шагом stride0
    f0 = s0 // 4
    arr0 = np.frombuffer(raw, dtype=np.float32, count=n * f0, offset=0).reshape(n, f0)
    pos = arr0[:, pos_off // 4: pos_off // 4 + 3].astype(np.float32, copy=True)
    nrm = arr0[:, nrm_off // 4: nrm_off // 4 + 3].astype(np.float32, copy=True)
    w_off_f = (w_off // 4) if w_off is not None else None
    wts_stream = (arr0[:, w_off_f: w_off_f + 4].astype(np.float32, copy=True)
                  if w_off_f is not None else None)
    if uv_off is not None:
        f1 = (len(raw) - n * s0) // (4 * n)
        arr1 = np.frombuffer(raw, dtype=np.float32, count=n * f1, offset=n * s0).reshape(n, f1)
        uv = arr1[:, (uv_off - n * s0) // 4: (uv_off - n * s0) // 4 + 2].astype(np.float32, copy=True)
    else:
        uv = np.zeros((n, 2), np.float32)

    skin = mesh.m_Skin
    idx = np.zeros((n, 4), np.uint16)
    wts = np.zeros((n, 4), np.float32)
    for i in range(n):
        bw = skin[i]
        idx[i] = [bw.boneIndex_0_, bw.boneIndex_1_, bw.boneIndex_2_, bw.boneIndex_3_]
        # веса берём из m_Skin: канал 7 в потоке — не веса (проверено, сумма не 1)
        wts[i] = [bw.weight_0_, bw.weight_1_, bw.weight_2_, bw.weight_3_]
    tot = wts.sum(1, keepdims=True)
    wts = np.divide(wts, np.where(tot == 0, 1, tot), out=np.zeros_like(wts), where=tot != 0)

    ib = bytes(mesh.m_IndexBuffer)
    fmt = mesh.m_IndexFormat
    dt = np.uint32 if (fmt in (1, 2) or len(ib) >= mesh.m_SubMeshes[0].indexCount * 4) else np.uint16
    try:
        idxs = np.frombuffer(ib, dtype=dt, count=mesh.m_SubMeshes[0].indexCount).astype(np.uint32)
    except ValueError:
        idxs = np.frombuffer(ib, dtype=np.uint16, count=mesh.m_SubMeshes[0].indexCount).astype(np.uint32)
    return pos, nrm, uv, idx, wts, idxs


def mesh_texture(env, material, mesh_name=''):
    """PNG-байты основной текстуры. Слоты перебираем: у части модов _MainTex пустой,
    а картинка лежит в _DetailMask/_ColorMask; если у материала вообще нет картинки —
    ищем в бандле материал с тем же префиксом имени."""
    BAD = ('ramp', 'normal', 'alpha', 'liquidmask', 'linemask', 'outline')

    def tex_of(mat):
        props = getattr(mat, 'm_SavedProperties', None)
        entries = list(getattr(props, 'm_TexEnvs', None) or [])
        prio = {'_MainTex': 0, '_DetailMask': 1, '_ColorMask': 2}
        def rank(e):
            k = (getattr(e, 'first', None) or (e[0] if isinstance(e, tuple) else '') or '')
            if any(b in k.lower() for b in BAD):
                return 9
            return prio.get(k, 5)
        for entry in sorted(entries, key=rank):
            key = getattr(entry, 'first', None) or (entry[0] if isinstance(entry, tuple) else None)
            val = getattr(entry, 'second', None) or (entry[1] if isinstance(entry, tuple) else None)
            pptr = getattr(val, 'm_Texture', None)
            if pptr is None or not getattr(pptr, 'm_PathID', 0):
                continue
            try:
                tex = pptr.read()
                buf = io.BytesIO()
                tex.image.save(buf, format='PNG')
                return buf.getvalue(), tex.m_Width, tex.m_Height
            except Exception:
                continue
        return None, 0, 0

    png, w, h = tex_of(material)
    if png:
        return png, w, h
    base = (getattr(material, 'm_Name', '') or '').split('_low')[0]
    for o in env.objects:
        if o.type.name != 'Material':
            continue
        try:
            m = o.read()
        except Exception:
            continue
        if base and not (getattr(m, 'm_Name', '') or '').startswith(base[:8]):
            continue
        png, w, h = tex_of(m)
        if png:
            return png, w, h
    return None, 0, 0


# ---------- матрицы ----------
def quat_matrix(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                     [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                     [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]], np.float32)


def rig_world_matrices(rig_path):
    """мировые матрицы rest-скелета KK (наши клипы и VRM используют тот же скелет)"""
    rig = json.load(open(rig_path))
    bones = rig['rigs'][[r['name'] for r in rig['rigs']].index('p_cf_body_bone')]['bones']
    by = {b['name']: b for b in bones}
    out = {}
    for name in by:
        chain, cur = [], name
        while cur and cur in by:
            chain.append(by[cur])
            cur = by[cur].get('parent')
        M = np.eye(4, dtype=np.float32)
        for b in reversed(chain):
            T = np.eye(4, dtype=np.float32)
            T[:3, :3] = quat_matrix(b['rotation'])
            T[:3, 3] = b['position']
            M = M @ T
        out[name] = M
    return out


def _mirrored(M, mirror_x):
    """зеркало по X для матрицы: S·M·S (позиция меняет знак, поворот остаётся собственным)"""
    if not mirror_x:
        return M
    S = np.diag([-1.0, 1.0, 1.0, 1.0]).astype(np.float32)
    return (S @ M @ S).astype(np.float32)


def bindposes(mesh):
    out = []
    for b in mesh.m_BindPose:
        out.append(np.array([[b.e00, b.e01, b.e02, b.e03], [b.e10, b.e11, b.e12, b.e13],
                             [b.e20, b.e21, b.e22, b.e23], [b.e30, b.e31, b.e32, b.e33]], np.float32))
    return np.stack(out)


# ---------- кости ----------
def build_bone_map(vrm_names, rig_path):
    """имя кости KK → индекс кости VRM (или предок, если такой кости в VRM нет)."""
    vrm_index = {n: i for i, n in enumerate(vrm_names)}
    rig = json.load(open(rig_path))
    bones = rig['rigs'][[r['name'] for r in rig['rigs']].index('p_cf_body_bone')]['bones']
    parent = {b['name']: b.get('parent') for b in bones}
    cache = {}

    def resolve(name):
        if name in cache:
            return cache[name]
        if name in vrm_index:
            cache[name] = vrm_index[name]
            return cache[name]
        for alt in (name.replace('cf_j_', 'cf_s_', 1), name.replace('cf_s_', 'cf_j_', 1)):
            if alt in vrm_index:
                cache[name] = vrm_index[alt]
                return cache[name]
        # пальцы: cf_j_index02_L → IndexFinger2_L (в VRM они под этими именами)
        import re as _re
        m = _re.match(r'cf_j_(index|middle|ring|little|thumb)0?(\d)_([LR])$', name)
        if m:
            human = {'index': 'IndexFinger', 'middle': 'MiddleFinger', 'ring': 'RingFinger',
                     'little': 'LittleFinger', 'thumb': 'Thumb'}[m.group(1)]
            alt = f'{human}{m.group(2)}_{m.group(3)}'
            if alt in vrm_index:
                cache[name] = vrm_index[alt]
                return cache[name]
        # предка НЕ подставляем: если кости нет — вернём None, вызывающий сделает
        # подстановочный сустав (иначе туфли «прилипают» к голеностопу и уезжают на 7 см)
        cache[name] = None
        return None
    return resolve


# ---------- GLB ----------
def write_glb(path, doc, binary):
    doc = dict(doc, buffers=[{'byteLength': len(binary)}])
    js = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    bn = binary + b'\x00' * ((4 - len(binary) % 4) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', GLB_MAGIC, 2, 12 + 8 + len(js) + 8 + len(bn)))
        f.write(struct.pack('<II', len(js), CHUNK_JSON)); f.write(js)
        f.write(struct.pack('<II', len(bn), CHUNK_BIN)); f.write(bn)


class Packer:
    def __init__(self):
        self.bin = bytearray()
        self.views, self.accessors = [], []

    def add(self, array, comp_type, type_str, target=None, minmax=False):
        data = array.tobytes()
        while len(self.bin) % 4:
            self.bin.append(0)
        off = len(self.bin)
        self.bin += data
        view = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target:
            view['target'] = target
        self.views.append(view)
        acc = {'bufferView': len(self.views) - 1, 'componentType': comp_type,
               'count': len(array), 'type': type_str}
        if minmax:
            acc['min'] = [float(x) for x in array.min(0)]
            acc['max'] = [float(x) for x in array.max(0)]
        self.accessors.append(acc)
        return len(self.accessors) - 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--vrm', required=True)
    ap.add_argument('--rig', required=True)
    ap.add_argument('--zipmod', required=True)
    ap.add_argument('--mesh', required=True)
    ap.add_argument('--slot', default='top')
    ap.add_argument('--id', default=None)
    ap.add_argument('--out', required=True, help='каталог для .glb')
    ap.add_argument('--bone-map', default='viewer/vrm_studio_assets/bone-map.json',
                    help='карта cf_* → humanoid (для родителя подстановочного сустава)')
    ap.add_argument('--mirror-x', dest='mirror_x', action='store_true', default=True,
                    help='зеркалить по X (KK Left = −X, VRM Left = +X); по умолчанию включено')
    ap.add_argument('--no-mirror-x', dest='mirror_x', action='store_false')
    ap.add_argument('--heel-height', type=float, default=0.0,
                    help='высота каблука, м: обувь нарисована под уже поднятую пятку')
    ap.add_argument('--force-bone', action='append', default=[],
                    help='переименовать кость источника, например root=cf_j_head (можно несколько)')
    a = ap.parse_args()

    vrm_names, ibm = vrm_skeleton(a.vrm)
    resolve = build_bone_map(vrm_names, a.rig)
    smr, mesh, env = find_garment(a.zipmod, a.mesh)
    bones = [p.read().m_GameObject.read().m_Name for p in smr.m_Bones]
    pos, nrm, uv, idx, wts, ind = mesh_arrays(mesh)

    # вершины Koikatsu лежат в своей локальной системе: переносим в bind-пространство тела
    # v_body = Σ w_i · (W_i · B_i) · v, где W — rest-скелет нашего рига, B — bindpose меша
    forced = dict(x.split('=') for x in a.force_bone)
    if forced:
        bones = [forced.get(b, b) for b in bones]
        print('подменены кости:', forced)
    _rig = json.load(open(a.rig))
    _bones = _rig['rigs'][[r['name'] for r in _rig['rigs']].index('p_cf_body_bone')]['bones']
    rig_parent_map = {b['name']: b.get('parent') for b in _bones}
    W = rig_world_matrices(a.rig)
    B = bindposes(mesh)[:len(bones)]
    h = np.concatenate([pos.astype(np.float32), np.ones((len(pos), 1), np.float32)], 1)
    acc = np.zeros((len(pos), 3), np.float32)
    for k in range(4):
        bi = np.clip(idx[:, k], 0, len(bones) - 1)
        wm = np.stack([W.get(bones[i], np.eye(4, dtype=np.float32)) for i in range(len(bones))])
        M = np.einsum('nij,njk->nik', wm[bi], B[bi])
        v = np.einsum('nij,nj->ni', M, h)[:, :3]
        acc += wts[:, k:k + 1] * v
    # KK и VRM зеркальны по X: в риге Left = −X, в VRM Left = +X.
    # Для симметричной одежды это незаметно, для обуви/асимметрии — критично.
    if a.mirror_x:
        acc[:, 0] = -acc[:, 0]
        print('зеркало по X применено (KK → VRM)')
    print(f'bbox после переноса в bind-пространство: {np.round(acc.min(0), 2)} → {np.round(acc.max(0), 2)}')
    pos = acc
    print(f'меш {mesh.m_Name}: вершин {len(pos)}, индексов {len(ind)}, костей в SMR {len(bones)}')

    # ремап костей KK → кости VRM; чего нет в теле — подстановочный сустав (не «предок молча»)
    rig_rest = rig_world_matrices(a.rig)
    hand_map = {}
    if os.path.exists(a.bone_map):
        _m = json.load(open(a.bone_map))
        hand_map = _m.get('map') or _m

    def parent_target(name):
        """куда вешать подстановочный сустав: ближайший предок, который ЕСТЬ в теле и двигается
        (сначала ручная карта humanoid: cf_j_leg03_L → Left ankle, иначе — имя/подмена)"""
        cur = rig_parent_map.get(name)
        while cur:
            if cur in hand_map and hand_map[cur] in vrm_names:
                return hand_map[cur]
            if cur in vrm_names:
                return cur
            alt = (cur.replace('cf_s_', 'cf_j_', 1) if cur.startswith('cf_s_')
                   else (cur.replace('cf_j_', 'cf_s_', 1) if cur.startswith('cf_j_') else cur))
            if alt in vrm_names:
                return alt
            cur = rig_parent_map.get(cur)
        return None
    mapped, substitutes, missing = {}, [], []
    next_free = len(vrm_names)
    for bi, name in enumerate(bones):
        vi = resolve(name)
        if vi is None:
            anc = parent_target(name)
            substitutes.append({
                'index': next_free,
                'source': name,
                'parent': anc,
                'restWorld': np.round(_mirrored(rig_rest.get(name, np.eye(4, dtype=np.float32)), a.mirror_x), 6).ravel().tolist(),
                'bind': np.round(B[bi], 6).ravel().tolist(),
            })
            missing.append(name)
            vi = next_free
            next_free += 1
        mapped[bi] = vi
    dropped = len(substitutes)
    jidx = np.zeros_like(idx)
    jwts = np.zeros_like(wts)
    for bi in range(len(bones)):
        col = (idx == bi)
        if not col.any():
            continue
        vi = mapped[bi]
        if vi is None:
            continue
        jidx[col] = vi
        jwts[col] = wts[col]
    tot = jwts.sum(1, keepdims=True)
    empty = int((tot.ravel() == 0).sum())
    jwts = np.divide(jwts, np.where(tot == 0, 1, tot), out=np.zeros_like(jwts), where=tot != 0)
    joint_map = {}
    for bi, name in enumerate(bones):
        vi = mapped[bi]
        if vi is not None and vi < len(vrm_names):
            joint_map[name] = vrm_names[vi]
    print(f'костей без цели в VRM: {dropped} (подстановочные суставы: {missing}); вершин без весов: {empty}')

    mat = smr.m_Materials[0].read()
    png, tw, th = mesh_texture(env, mat, a.mesh)
    print(f'материал {getattr(mat, "m_Name", "?")}: текстура {"да " + str(tw) + "x" + str(th) if png else "нет"}')

    p = Packer()
    a_pos = p.add(pos.astype(np.float32), 5126, 'VEC3', 34962, minmax=True)
    a_nrm = p.add(nrm.astype(np.float32), 5126, 'VEC3', 34962)
    a_uv = p.add(uv.astype(np.float32), 5126, 'VEC2', 34962)
    a_j = p.add(jidx.astype(np.uint16), 5123, 'VEC4', 34962)
    a_w = p.add(jwts.astype(np.float32), 5126, 'VEC4', 34962)
    a_i = p.add(ind.astype(np.uint16 if ind.max() < 65536 else np.uint32),
                5123 if ind.max() < 65536 else 5125, 'SCALAR', 34963)
    a_ibm = p.add(ibm.astype(np.float32), 5126, 'MAT4')
    image_index = None
    if png:
        while len(p.bin) % 4:
            p.bin.append(0)
        off = len(p.bin); p.bin += png
        p.views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(png)})
        image_index = len(p.views) - 1

    material = {'name': os.path.basename(a.mesh), 'alphaMode': 'MASK', 'alphaCutoff': 0.5,
                'doubleSided': False,
                'pbrMetallicRoughness': {'metallicFactor': 0.0, 'roughnessFactor': 1.0,
                                         'baseColorFactor': [0.55, 0.5, 0.62, 1.0]},
                'extensions': {'KHR_materials_unlit': {}}}
    textures = []
    if png:
        material['pbrMetallicRoughness']['baseColorTexture'] = {'index': 0}
        textures = [{'sampler': 0, 'source': 0}]

    nodes = [{'name': mesh.m_Name, 'mesh': 0, 'skin': 0}]
    nodes += [{'name': n} for n in vrm_names]
    doc = {
        'asset': {'version': '2.0', 'generator': 'cyberjack/extract_zipmod_garment'},
        'extensionsUsed': ['KHR_materials_unlit'],
        'scene': 0, 'scenes': [{'nodes': [0, 1]}],
        'nodes': nodes, 'meshes': [{'name': mesh.m_Name, 'primitives': [{
            'attributes': {'POSITION': a_pos, 'NORMAL': a_nrm, 'TEXCOORD_0': a_uv,
                           'JOINTS_0': a_j, 'WEIGHTS_0': a_w},
            'indices': a_i, 'material': 0}]}],
        'materials': [material],
        'textures': textures,
        'images': ([{'bufferView': image_index, 'mimeType': 'image/png'}] if png else []),
        'samplers': ([{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}] if png else []),
        'skins': [{'joints': list(range(1, len(vrm_names) + 1)), 'inverseBindMatrices': a_ibm}],
        'accessors': p.accessors, 'bufferViews': p.views,
    }
    os.makedirs(a.out, exist_ok=True)
    item_id = a.id or ('kk-' + mesh.m_Name.lower().replace('_', '-'))
    path = os.path.join(a.out, item_id + '.glb')
    write_glb(path, doc, bytes(p.bin))
    sidecar = {
        'id': a.id, 'slot': a.slot, 'mesh': mesh.m_Name,
        'vrm': os.path.basename(a.vrm), 'jointCount': len(vrm_names),
        'jointMap': joint_map, 'substitutes': substitutes, 'missing': missing,
        'heelHeight': a.heel_height,
        'bake': 'v_body = Σ w·(W_rig·B)·v, W по rest-скелету source_rigs.json',
    }
    side_path = os.path.join(a.out, a.id + '.bones.json')
    with open(side_path, 'w') as f:
        json.dump(sidecar, f, ensure_ascii=False, indent=1)
    print(f'готово: {path} ({os.path.getsize(path)/1e6:.2f} МБ) · костей VRM {len(vrm_names)}'
          f' · подстановочных {len(substitutes)} · слот {a.slot}')
    print(f'паспорт костей: {side_path}')


if __name__ == '__main__':
    main()
