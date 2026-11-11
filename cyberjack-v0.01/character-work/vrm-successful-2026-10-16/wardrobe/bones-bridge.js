/**
 * Мост через настоящие кости: подстановочные суставы.
 *
 * В VRM нет части костей KK (`cf_j_foot`, `cf_j_toes`, `waist02`, часть `cf_s_bust*`).
 * Раньше выгрузка молча сливала их на предка — туфли «прилипали» к голеностопу и уезжали на 7 см.
 * Теперь выгрузка кладёт рядом паспорт `<id>.bones.json`:
 *   { substitutes: [{index, source, parent, restWorld[16], bind[16]}], jointMap, heelHeight }
 *
 * Здесь по паспорту:
 *   1) создаются THREE.Bone в позе автора (restWorld), родитель — кость тела;
 *   2) скелет тела расширяется: bones + подстановочные, boneInverses = старые + inverse(restWorld);
 *   3) все меши тела перепривязываются к расширенному скелету (индексы старых костей не меняются);
 *   4) JOINTS_0 вещи (971, 972…) теперь указывает на подстановочный сустав.
 */
import * as THREE from 'three';

const fromArray = a => new THREE.Matrix4().fromArray(a);

export function applyBoneBridge(vrm, sidecar) {
  const body = vrm.scene.getObjectByProperty('isSkinnedMesh', true);
  if (!body) throw new Error('в VRM не найден SkinnedMesh');
  const old = body.skeleton;
  const subs = sidecar.substitutes || [];
  if (!subs.length) return { skeleton: old, applied: 0, missing: sidecar.missing || [] };

  const bones = old.bones.slice();
  const inverses = old.boneInverses.slice();
  const maxIndex = Math.max(...subs.map(s => s.index));
  while (bones.length <= maxIndex) {
    bones.push(new THREE.Bone());
    inverses.push(new THREE.Matrix4());
  }

  const restOf = name => {
    const i = old.bones.findIndex(b => b.name === name);
    if (i < 0) return null;
    return new THREE.Matrix4().copy(old.boneInverses[i]).invert();   // поза кости тела в bind
  };

  for (const s of subs) {
    const bone = new THREE.Bone();
    bone.name = `sub:${s.source}`;
    bone.userData.source = s.source;
    const rest = fromArray(s.restWorld);
    bone.userData.restWorld = rest.clone();
    const pRest = s.parent ? restOf(s.parent) : null;
    const local = pRest ? new THREE.Matrix4().copy(pRest).invert().multiply(rest) : rest.clone();
    local.decompose(bone.position, bone.quaternion, bone.scale);
    const parentBone = s.parent ? old.bones.find(b => b.name === s.parent) : null;
    (parentBone || vrm.scene).add(bone);
    bone.updateMatrix();

    bones[s.index] = bone;
    inverses[s.index] = new THREE.Matrix4().copy(rest).invert();
  }

  const skeleton = new THREE.Skeleton(bones, inverses);
  vrm.scene.traverse(o => {
    if (o.isSkinnedMesh && o.skeleton === old) {
      o.skeleton = skeleton;
      o.bindMatrix.copy(body.bindMatrix);
      o.bindMatrixInverse.copy(body.bindMatrixInverse);
    }
  });
  vrm.scene.updateMatrixWorld(true);
  return { skeleton, applied: subs.length, missing: sidecar.missing || [] };
}

/**
 * Поза каблука: обувь нарисована под уже поднятую пятку (высота каблука ≈ смещение низа обуви).
 * Наклоняем стопу носком вниз и поднимаем фигуру, чтобы носок остался на полу.
 */
export function applyHeelPose(vrm, heelHeight, footLength = 0.22) {
  if (!heelHeight) return 0;
  const angle = Math.atan2(heelHeight, footLength);
  for (const key of ['leftFoot', 'rightFoot']) {
    const node = vrm.humanoid.getRawBoneNode(key);
    if (node) node.rotation.x += angle;
  }
  vrm.scene.position.y += heelHeight * 0.92;
  vrm.scene.updateMatrixWorld(true);
  return angle;
}
