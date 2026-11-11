#!/usr/bin/env python3
"""Проверка пригодности вещи из zipmod: можно ли её поставить мостом через кости.

Три числа на вещь:
  prefab↔риг   — скелет префаба против нашего rest (если ~0, вещь сделана под эту фигуру)
  bind↔prefab  — bindpose меша против скелета префаба (если большое, mesh в бандле не совпадает
                 со скелетом: вещь нельзя поставить по костям, только подгонкой)
  вердикт      — OK / только подгонка

Запуск: python3 check_item.py <zipmod> <имя меша> [ещё пары...]
"""
import io, json, sys, zipfile
import numpy as np
import UnityPy


def trs(tr):
    p, q, s = tr.m_LocalPosition, tr.m_LocalRotation, tr.m_LocalScale
    x, y, z, w = q.x, q.y, q.z, q.w
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4)
    M[:3, :3] = R * np.array([s.x, s.y, s.z])
    M[:3, 3] = [p.x, p.y, p.z]
    return M


def world_of(cur):
    chain = []
    while cur is not None:
        chain.append(trs(cur))
        f = getattr(cur, 'm_Father', None)
        if not f or not getattr(f, 'm_PathID', 0):
            break
        cur = f.read()
    M = np.eye(4)
    for T in reversed(chain):
        M = M @ T
    return M


def rig_worlds():
    rig = json.load(open('animations/source_rigs.json'))
    bones = rig['rigs'][[r['name'] for r in rig['rigs']].index('p_cf_body_bone')]['bones']
    by = {b['name']: b for b in bones}

    def qmat(q):
        x, y, z, w = q
        return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    out = {}
    for name in by:
        chain, cur = [], name
        while cur and cur in by:
            chain.append(by[cur]); cur = by[cur].get('parent')
        M = np.eye(4)
        for b in reversed(chain):
            T = np.eye(4); T[:3, :3] = qmat(b['rotation']); T[:3, 3] = b['position']
            M = M @ T
        out[name] = M
    return out


def find_smr(zpath, mesh_name):
    with zipfile.ZipFile(zpath) as z:
        for inner in [n for n in z.namelist() if n.endswith('.unity3d') and 'thumb' not in n]:
            try:
                env = UnityPy.load(io.BytesIO(z.read(inner)))
            except Exception:
                continue
            best = None
            for o in env.objects:
                if o.type.name != 'SkinnedMeshRenderer':
                    continue
                try:
                    d = o.read()
                    m = d.m_Mesh.read()
                except Exception:
                    continue
                if m.m_Name != mesh_name:
                    continue
                if best is None or len(d.m_Bones) > len(best[0].m_Bones):
                    best = (d, m)
            if best:
                return best, inner
    return None, None


def check(zpath, mesh_name, rig):
    (smr, mesh), inner = find_smr(zpath, mesh_name)
    if smr is None:
        return {'mesh': mesh_name, 'error': 'меш не найден'}
    names, pre = [], []
    for ptr in smr.m_Bones:
        W = world_of(ptr.read())
        try:
            names.append(ptr.read().m_GameObject.read().m_Name)
        except Exception:
            names.append('?')
        pre.append(W[:3, 3])
    pre = np.array(pre)
    B = np.stack([np.array([[b.e00, b.e01, b.e02, b.e03], [b.e10, b.e11, b.e12, b.e13],
                            [b.e20, b.e21, b.e22, b.e23], [b.e30, b.e31, b.e32, b.e33]], float)
                  for b in mesh.m_BindPose])[:len(names)]
    imp = np.array([np.linalg.inv(b)[:3, 3] for b in B])
    common = [(i, n) for i, n in enumerate(names) if n in rig]
    if not common:
        return {'mesh': mesh_name, 'error': 'нет общих костей с ригом'}
    d_pr = np.mean([np.linalg.norm(pre[i] - rig[n][:3, 3]) for i, n in common]) * 1000
    d_bp = np.mean([np.linalg.norm(pre[i] - imp[i]) for i, n in common]) * 1000
    d_br = np.mean([np.linalg.norm(imp[i] - rig[n][:3, 3]) for i, n in common]) * 1000
    ok = d_pr < 10 and d_bp < 10
    return {'mesh': mesh_name, 'bundle': inner, 'bones': len(names), 'common': len(common),
            'prefab_vs_rig_mm': round(float(d_pr), 1), 'bind_vs_prefab_mm': round(float(d_bp), 1),
            'bind_vs_rig_mm': round(float(d_br), 1), 'verdict': 'OK' if ok else 'только подгонка'}


if __name__ == '__main__':
    rig = rig_worlds()
    args = sys.argv[1:]
    print(f'{"меш":22} {"кост":>5} {"prefab↔риг":>12} {"bind↔prefab":>12} {"вердикт":>16}')
    for i in range(0, len(args), 2):
        r = check(args[i], args[i + 1], rig)
        if 'error' in r:
            print(f'{r["mesh"]:22} {r["error"]}')
            continue
        print(f'{r["mesh"]:22} {r["bones"]:5d} {r["prefab_vs_rig_mm"]:12.1f} {r["bind_vs_prefab_mm"]:12.1f} {r["verdict"]:>16}')
