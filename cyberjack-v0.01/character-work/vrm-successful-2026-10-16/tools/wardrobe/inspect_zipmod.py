#!/usr/bin/env python3
"""Инспектор zipmod: какие меши внутри, скиненные или статические, к какой кости привязаны."""
import io, os, sys, zipfile
import UnityPy


def walk_parents(obj, depth=12):
    """цепочка имён Transform вверх — нужна для статических аксессуаров (к чему привязаны)"""
    names = []
    cur = obj
    for _ in range(depth):
        try:
            go = cur.read().m_GameObject.read()
        except Exception:
            break
        names.append(go.m_Name)
        father = getattr(go, 'm_Father', None)
        if not father:
            break
        try:
            cur = father.read().m_Children and cur
        except Exception:
            pass
        break
    return names


def inspect(path):
    with zipfile.ZipFile(path) as z:
        targets = [n for n in z.namelist()
                   if n.endswith('.unity3d') and 'thumb' not in n and '_th.' not in n]
        for target in targets:
            env = UnityPy.load(io.BytesIO(z.read(target)))
            print(f'--- {os.path.basename(target)}')
            for o in env.objects:
                if o.type.name not in ('SkinnedMeshRenderer', 'MeshRenderer'):
                    continue
                try:
                    d = o.read()
                    mesh = d.m_Mesh.read()
                except Exception:
                    continue
                vc = getattr(mesh.m_VertexData, 'm_VertexCount', 0)
                if o.type.name == 'SkinnedMeshRenderer':
                    bones = []
                    for p in d.m_Bones:
                        try:
                            bones.append(p.read().m_GameObject.read().m_Name)
                        except Exception:
                            bones.append('?')
                    print(f'  SKIN {mesh.m_Name}: {vc} вершин, костей {len(bones)},'
                          f' примеры {bones[:4]}')
                else:
                    go = d.m_GameObject.read()
                    parent = ''
                    try:
                        f = go.m_Father
                        while f and not parent:
                            fg = f.read().m_GameObject.read()
                            if fg.m_Name.startswith(('cf_', 'a_n_', 'k_f_', 'o_')):
                                parent = fg.m_Name
                                break
                            f = fg.m_Father
                    except Exception:
                        pass
                    print(f'  MESH {mesh.m_Name}: {vc} вершин, объект {go.m_Name}, родитель-кость {parent or "не найдена"}')
    print()


if __name__ == '__main__':
    for p in sys.argv[1:]:
        print('=====', os.path.basename(p))
        inspect(p)
