#!/usr/bin/env python3
"""Три-сторонний замер: где на самом деле стоит скелет вещи из zipmod.

Сравниваем для каждой кости SkinnedMeshRenderer'а:
  A) префаб: мировые матрицы из иерархии GameObject'ов бандла (то, чем скинит Unity)
  B) bindpose: B^-1, то есть поза, при которой вещь «лежит как нарисована»
  C) наш риг: rest-скелет из source_rigs.json (по нему идёт кеш клипов)

Если A ≈ C, а B отличается — вещь можно ставить как есть.
Если A ≈ B, а C отличается — вещь собрана под другую позу, нужна подгонка.
"""
import io, json, sys, zipfile
import numpy as np
import UnityPy


def trs(tr):
    p = tr.m_LocalPosition
    q = tr.m_LocalRotation
    s = tr.m_LocalScale
    x, y, z, w = q.x, q.y, q.z, q.w
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]], float)
    M = np.eye(4)
    M[:3, :3] = R * np.array([s.x, s.y, s.z])
    M[:3, 3] = [p.x, p.y, p.z]
    return M


def world(tr_ptr):
    chain, cur = [], None
    try:
        cur = tr_ptr.read()
    except Exception:
        return None, '?'
    name = ''
    try:
        name = cur.m_GameObject.read().m_Name
    except Exception:
        pass
    while cur is not None:
        chain.append(trs(cur))
        f = getattr(cur, 'm_Father', None)
        if not f or not getattr(f, 'm_PathID', 0):
            break
        try:
            cur = f.read()
        except Exception:
            break
    M = np.eye(4)
    for T in reversed(chain):
        M = M @ T
    return M, name


def main(zipmod, inner, mesh_name):
    with zipfile.ZipFile(zipmod) as z:
        env = UnityPy.load(io.BytesIO(z.read(inner)))
    smr = mesh = None
    for o in env.objects:
        if o.type.name != 'SkinnedMeshRenderer':
            continue
        d = o.read()
        try:
            m = d.m_Mesh.read()
        except Exception:
            continue
        if m.m_Name == mesh_name and len(d.m_Bones) >= 2:
            smr, mesh = d, m
            break
    if smr is None:
        raise SystemExit('SMR не найден')

    rig = json.load(open('animations/source_rigs.json'))
    bones = rig['rigs'][[r['name'] for r in rig['rigs']].index('p_cf_body_bone')]['bones']
    by = {b['name']: b for b in bones}

    def qmat(q):
        x, y, z, w = q
        return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])

    def rig_world(name):
        chain, cur = [], name
        while cur and cur in by:
            chain.append(by[cur])
            cur = by[cur].get('parent')
        M = np.eye(4)
        for b in reversed(chain):
            T = np.eye(4)
            T[:3, :3] = qmat(b['rotation'])
            T[:3, 3] = b['position']
            M = M @ T
        return M

    bind = []
    for b in mesh.m_BindPose:
        bind.append(np.array([[b.e00, b.e01, b.e02, b.e03], [b.e10, b.e11, b.e12, b.e13],
                              [b.e20, b.e21, b.e22, b.e23], [b.e30, b.e31, b.e32, b.e33]], float))

    print(f'{"кость":14} {"префаб":>24} {"bindpose^-1":>24} {"наш риг":>24} {"A-B, мм":>8} {"A-C, мм":>8}')
    rows = []
    for i, ptr in enumerate(smr.m_Bones):
        A, name = world(ptr)
        if A is None or name not in by:
            continue
        B = np.linalg.inv(bind[i]) if i < len(bind) else None
        C = rig_world(name)
        a, b, c = A[:3, 3], (B[:3, 3] if B is not None else np.full(3, np.nan)), C[:3, 3]
        rows.append((name, a, b, c))
        print(f'{name:14} {str(np.round(a, 3)):>24} {str(np.round(b, 3)):>24} {str(np.round(c, 3)):>24} '
              f'{np.linalg.norm(a - b) * 1000:8.1f} {np.linalg.norm(a - c) * 1000:8.1f}')

    if rows:
        ab = np.mean([np.linalg.norm(r[1] - r[2]) for r in rows]) * 1000
        ac = np.mean([np.linalg.norm(r[1] - r[3]) for r in rows]) * 1000
        bc = np.mean([np.linalg.norm(r[2] - r[3]) for r in rows]) * 1000
        print(f'\nсредние расхождения: префаб↔bindpose {ab:.0f} мм · префаб↔риг {ac:.0f} мм · bindpose↔риг {bc:.0f} мм')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
