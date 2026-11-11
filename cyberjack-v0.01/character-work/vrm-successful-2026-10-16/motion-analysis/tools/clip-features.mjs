// Геометрические признаки клипа: закрытость, экспозиция регионов, силуэт, контакт.
//
// Зачем: правка позы («сделай закрытее») требует чисел, которые (а) считаются детерминированно,
// (б) сравнимы между клипами, (в) имеют физический смысл. VLM такие числа дать не может.
//
// Конвенция клипов: `tracks[].bone` — имя кости рига p_cf_body_bone, `rotations` — абсолютные локальные
// кватернионы (xyzw) покадрово, позиции не экспортируются (in-place). Позиции берём из rest-скелета
// `animations/source_rigs.json`, мир строим FK.
//
// Запуск:
//   node tools/clip-features.mjs --in ../external-library/clips/cmu.json --out ../data/clip-features.jsonl
//   node tools/clip-features.mjs --pilot --out ../data/clip-features-pilot.jsonl

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

// Пороги — одной константой: править должен один diff (опыт с PART_THRESHOLDS).
export const FEATURE_PARAMS = {
  armAdduction: 90,     // град: плечо вниз = 0, в сторону = 90
  elbowFlexion: 160,    // град: полностью согнут
  thighSpread: 45,      // град: бёдра вместе = 0, разведены = 45+
  kneeFlexion: 140,     // град: согнут в пятку
  torsoCurl: 45,        // град: наклон от вертикали
  headTuck: 40,         // град: подбородок вниз
  groundTolerance: 0.03, // м: что считаем контактом с полом
  selfContact: 0.10,    // м: капсулы ближе — самоконтакт
  viewer: [0, 0, 1],    // направление «на наблюдателя» (фронтальный вид)
};

// ---------- кватернионы/векторы без внешних зависимостей ----------
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qnorm = (q) => {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
};
const qrot = (q, v) => {
  const [x, y, z, w] = q;
  const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
  return [
    v[0] + w * t[0] + (y * t[2] - z * t[1]),
    v[1] + w * t[1] + (z * t[0] - x * t[2]),
    v[2] + w * t[2] + (x * t[1] - y * t[0]),
  ];
};
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v) => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const deg = (r) => (r * 180) / Math.PI;
const angle = (a, b) => deg(Math.acos(Math.min(1, Math.max(-1, dot(norm(a), norm(b))))));
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// ---------- риг и FK ----------
export function loadRig(rigPath = path.join(ROOT, 'animations/source_rigs.json')) {
  const rig = JSON.parse(fs.readFileSync(rigPath, 'utf8'));
  const body = rig.rigs.find((r) => r.name === 'p_cf_body_bone') || rig.rigs[0];
  const bones = body.bones;
  const index = new Map(bones.map((b, i) => [b.name, i]));
  const parent = bones.map((b) => (b.parent ? index.get(b.parent) ?? -1 : -1));
  const restPos = bones.map((b) => b.position || [0, 0, 0]);
  const restQ = bones.map((b) => qnorm(b.rotation || [0, 0, 0, 1]));
  return { bones, index, parent, restPos, restQ };
}

function fkFrame(rig, frameRot) {
  const n = rig.bones.length;
  const pos = new Array(n);
  const quat = new Array(n);
  for (let i = 0; i < n; i++) {
    const local = frameRot.get(i) || rig.restQ[i];
    const q = qnorm(local);
    const p = rig.restPos[i];
    const pi = rig.parent[i];
    if (pi >= 0) {
      const offset = qrot(quat[pi], p);
      pos[i] = add(pos[pi], offset);
      quat[i] = qnorm(qmul(quat[pi], q));
    } else {
      pos[i] = p.slice();
      quat[i] = q;
    }
  }
  return { pos, quat };
}

// ---------- признаки ----------
function convexHullArea(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return 0;
  const cross2 = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross2(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross2(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  let area = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(area) / 2;
}

function raySegmentDistance(origin, dir, a, b) {
  // минимальное расстояние между лучом origin+dir*t (t>0) и отрезком ab
  const u = dir;
  const v = sub(b, a);
  const w0 = sub(origin, a);
  const a1 = dot(u, u), b1 = dot(u, v), c1 = dot(v, v);
  const d1 = dot(u, w0), e1 = dot(v, w0);
  const denom = a1 * c1 - b1 * b1;
  let sc, tc;
  if (Math.abs(denom) < 1e-9) { sc = 0; tc = c1 > 1e-9 ? e1 / c1 : 0; } else {
    sc = (b1 * e1 - c1 * d1) / denom;
    tc = (a1 * e1 - b1 * d1) / denom;
  }
  if (sc < 0) { sc = 0; tc = c1 > 1e-9 ? e1 / c1 : 0; }
  if (tc < 0) { tc = 0; sc = a1 > 1e-9 ? -d1 / a1 : 0; }
  if (tc > 1) { tc = 1; sc = a1 > 1e-9 ? (b1 - d1) / a1 : 0; }
  const p = add(origin, mul(u, Math.max(0, sc)));
  const q = add(a, mul(v, tc));
  return len(sub(p, q));
}

export function measureFrame(rig, frameRot, height = 1) {
  const { pos, quat } = fkFrame(rig, frameRot);
  const at = (name) => pos[rig.index.get(name)];
  const qAt = (name) => quat[rig.index.get(name)];
  const hips = at('cf_j_hips'), neck = at('cf_j_neck'), head = at('cf_j_head');

  // --- закрытость ---------------------------------------------------------
  const armDown = [0, -1, 0];
  // насколько рука приведена к корпусу: 0° — висит вдоль тела, 90° — отведена в сторону
  const adduction = (s) => {
    // направление плеча = arm00 → forearm01 (собственный поворот arm00 влияет на детей, не на свою позицию)
    const up = at(`cf_j_arm00_${s}`), lo = at(`cf_j_forearm01_${s}`);
    return angle(sub(lo, up), armDown);
  };
  // сгиб локтя: 0° — рука прямая, 180° — полностью согнута
  const elbow = (s) => {
    const up = at(`cf_j_arm00_${s}`), el = at(`cf_j_forearm01_${s}`), hand = at(`cf_j_hand_${s}`);
    return angle(sub(el, up), sub(hand, el));
  };
  // сгиб колена: 0° — нога прямая
  const knee = (s) => {
    const th = at(`cf_j_thigh00_${s}`), kn = at(`cf_j_leg01_${s}`), ft = at(`cf_j_leg03_${s}`);
    return angle(sub(kn, th), sub(ft, kn));
  };
  // разведение ног = угол МЕЖДУ бёдрами: устойчив к повороту корпуса, в отличие от проекции на боковую ось
  const thighDirOf = (s) => norm(sub(at(`cf_j_leg01_${s}`), at(`cf_j_thigh00_${s}`)));
  const legsSpread = angle(thighDirOf('L'), thighDirOf('R'));
  const torsoIncl = deg(Math.acos(Math.min(1, Math.max(-1, dot(norm(sub(neck, hips)), [0, 1, 0])))));
  const headFwd = qrot(qAt('cf_j_head'), [0, 0, 1]);
  const headTuck = Math.max(0, -deg(Math.asin(Math.min(1, Math.max(-1, headFwd[1])))));

  const comp = {
    armAdduction: clamp01(1 - Math.max(adduction('L'), adduction('R')) / FEATURE_PARAMS.armAdduction),
    elbowFlexion: clamp01(Math.max(elbow('L'), elbow('R')) / FEATURE_PARAMS.elbowFlexion),
    thighSpread: clamp01(1 - legsSpread / FEATURE_PARAMS.thighSpread),
    kneeFlexion: clamp01(Math.max(knee('L'), knee('R')) / FEATURE_PARAMS.kneeFlexion),
    torsoCurl: clamp01(torsoIncl / FEATURE_PARAMS.torsoCurl),
    headTuck: clamp01(headTuck / FEATURE_PARAMS.headTuck),
  };
  const closure = (comp.armAdduction + comp.elbowFlexion + comp.thighSpread + comp.kneeFlexion
    + comp.torsoCurl + comp.headTuck) / 6;

  // --- силуэт (фронтальная проекция всех суставов, в ростах) ---------------
  const names = rig.bones.map((b) => b.name).filter((n) => /cf_j_(hips|neck|head|shoulder|arm00|forearm01|hand|thigh00|leg01|leg03|toes|spine02|spine03)/.test(n));
  const proj = names.map((n) => {
    const p = at(n);
    return [p[0] / height, p[1] / height];
  });
  const silhouette = convexHullArea(proj);

  // --- экспозиция регионов ------------------------------------------------
  const viewer = norm(FEATURE_PARAMS.viewer);
  const right = norm(sub(at('cf_j_shoulder_R'), at('cf_j_shoulder_L')));
  const upAxis = norm(sub(neck, hips));
  const torsoNormal = norm(cross(right, upAxis));
  const chestPoint = add(mul(at('cf_j_spine02'), 0.5), mul(at('cf_j_spine03'), 0.5));
  const hipsPoint = hips;
  const hipNormal = norm(cross(norm(sub(at('cf_j_thigh00_R'), at('cf_j_thigh00_L'))), upAxis));

  const limbs = [];
  for (const s of ['L', 'R']) {
    limbs.push([at(`cf_j_shoulder_${s}`), at(`cf_j_arm00_${s}`)]);
    limbs.push([at(`cf_j_arm00_${s}`), at(`cf_j_forearm01_${s}`)]);
    limbs.push([at(`cf_j_forearm01_${s}`), at(`cf_j_hand_${s}`)]);
    limbs.push([at(`cf_j_thigh00_${s}`), at(`cf_j_leg01_${s}`)]);
  }
  const occluded = (point) => {
    const toViewer = norm(viewer);
    let blocked = 0;
    for (const [a, b] of limbs) {
      if (raySegmentDistance(point, toViewer, a, b) < 0.06) blocked++;
    }
    return Math.min(1, blocked / 4);
  };
  const exposureOf = (normal, point) => {
    const facing = Math.max(0, dot(normal, viewer));
    return clamp01(facing * (1 - occluded(point)));
  };
  const exposure = {
    chest: exposureOf(torsoNormal, chestPoint),
    hips: exposureOf(hipNormal, hipsPoint),
  };

  // --- контакт и самоконтакт ---------------------------------------------
  const lowest = ['cf_j_toes_L', 'cf_j_toes_R', 'cf_j_leg03_L', 'cf_j_leg03_R']
    .map((n) => at(n)[1]);
  const minY = Math.min(...lowest);
  const ground = minY < FEATURE_PARAMS.groundTolerance ? 1 : 0;
  const pairs = [
    ['cf_j_hand_L', 'cf_j_hand_R'],
    ['cf_j_hand_L', 'cf_j_neck'],
    ['cf_j_hand_R', 'cf_j_neck'],
    ['cf_j_hand_L', 'cf_j_hips'],
    ['cf_j_hand_R', 'cf_j_hips'],
    ['cf_j_leg03_L', 'cf_j_leg03_R'],
  ];
  const selfContact = pairs.some(([a, b]) => len(sub(at(a), at(b))) < FEATURE_PARAMS.selfContact) ? 1 : 0;

  return {
    closure, comp, silhouette, exposure, ground, selfContact,
    minY: minY,
    head: { yaw: 0, pitch: headTuck },
  };
}

// ---------- клип ----------
export function measureClip(clip, rig, opts = {}) {
  const stride = opts.stride || 1;
  const names = clip.tracks.map((t) => t.bone);
  const frames = Math.min(...clip.tracks.map((t) => t.rotations.length / 4));
  const rows = [];
  for (let f = 0; f < frames; f += stride) {
    const frameRot = new Map();
    clip.tracks.forEach((t, ti) => {
      const bi = rig.index.get(names[ti]);
      if (bi === undefined) return;
      const o = f * 4;
      frameRot.set(bi, [t.rotations[o], t.rotations[o + 1], t.rotations[o + 2], t.rotations[o + 3]]);
    });
    rows.push(measureFrame(rig, frameRot, opts.height || 1));
  }
  const med = (arr) => {
    const s = arr.slice().sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };
  const pct = (arr, p) => {
    const s = arr.slice().sort((a, b) => a - b);
    return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0;
  };
  const pick = (k, sub2) => rows.map((r) => (sub2 ? r[sub2][k] : r[k]));
  return {
    id: clip.id,
    name: clip.name,
    dataset: clip.dataset,
    frames,
    fps: clip.fps,
    duration: clip.duration,
    closure: { median: +med(pick('closure')).toFixed(3), p10: +pct(pick('closure'), 0.1).toFixed(3), p90: +pct(pick('closure'), 0.9).toFixed(3) },
    components: {
      armAdduction: +med(pick('armAdduction', 'comp')).toFixed(3),
      elbowFlexion: +med(pick('elbowFlexion', 'comp')).toFixed(3),
      thighSpread: +med(pick('thighSpread', 'comp')).toFixed(3),
      kneeFlexion: +med(pick('kneeFlexion', 'comp')).toFixed(3),
      torsoCurl: +med(pick('torsoCurl', 'comp')).toFixed(3),
      headTuck: +med(pick('headTuck', 'comp')).toFixed(3),
    },
    exposure: { chest: +med(pick('chest', 'exposure')).toFixed(3), hips: +med(pick('hips', 'exposure')).toFixed(3) },
    silhouette: +med(pick('silhouette')).toFixed(4),
    groundFraction: +(rows.filter((r) => r.ground).length / (rows.length || 1)).toFixed(2),
    selfContactFraction: +(rows.filter((r) => r.selfContact).length / (rows.length || 1)).toFixed(2),
    series: rows.map((r) => [
      +r.closure.toFixed(3), +r.exposure.chest.toFixed(3), +r.exposure.hips.toFixed(3), +r.silhouette.toFixed(4),
    ]),
  };
}

// ---------- CLI ----------
export function selfTest() {
  const rig = loadRig();
  const rest = new Map(rig.restQ.map((q, i) => [i, q]));
  const m = measureFrame(rig, rest, 1);
  console.log('rest-поза (ожидаем: руки в стороны → adduction 0, локти 0, колени 0):');
  console.log(JSON.stringify(m.comp, null, 1));
  console.log('closure:', m.closure.toFixed(3), '| силуэт:', m.silhouette.toFixed(3));
  return m;
}

if (process.argv[1] && process.argv[1].endsWith('clip-features.mjs')) {
  const args = process.argv.slice(2);
  const arg = (k, d) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : d;
  };
  const inPath = arg('--in', null);
  const outPath = arg('--out', path.join(ROOT, 'motion-analysis/data/clip-features.jsonl'));
  const stride = Number(arg('--stride', 1));
  if (args.includes('--self-test')) {
    selfTest();
    process.exit(0);
  }
  if (!inPath) {
    console.log('нужен --in <clips.json>');
    process.exit(1);
  }
  const rig = loadRig();
  const doc = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const out = fs.createWriteStream(outPath);
  let n = 0;
  for (const clip of doc.clips) {
    const rec = measureClip(clip, rig, { stride });
    out.write(JSON.stringify(rec) + '\n');
    n++;
  }
  out.end();
  console.log(`клипов ${n} → ${outPath}`);
}
