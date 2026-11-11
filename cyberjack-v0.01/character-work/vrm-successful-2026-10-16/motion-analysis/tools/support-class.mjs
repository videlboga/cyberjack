// Candidate replacement for support.set: one floor per clip, torso orientation taken from world up,
// and the lowest-contact set decided per frame from absolute heights.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { buildRig, analyze } from '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16/motion-analysis/tools/geometry.mjs';

const root = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16';
const catalog = new Map(JSON.parse(fs.readFileSync(root + '/animations/catalog.json')).clips.map((c) => [c.id, c]));
const rigs = JSON.parse(fs.readFileSync(root + '/animations/source_rigs.json')).rigs;
const by = { female: buildRig(rigs.find((r) => r.name === 'p_cf_body_bone').bones), male: buildRig(rigs.find((r) => r.name === 'p_cm_body_00').bones) };
by.shared = by.female;
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

function geometry(id) {
  const c = catalog.get(id);
  const res = analyze(JSON.parse(zlib.gunzipSync(fs.readFileSync(root + '/animations/' + c.asset))), by[c.rig], { preview: true, anatomy: true });
  const { frames, names } = res.preview;
  const at = (f, n) => f[names.indexOf(n)];
  let floor = Infinity;
  for (const f of frames) for (const n of ['cf_j_foot_L', 'cf_j_foot_R', 'cf_j_toes_L', 'cf_j_toes_R', 'cf_j_leg01_L', 'cf_j_leg01_R', 'cf_j_hand_L', 'cf_j_hand_R', 'cf_j_hips', 'cf_j_head']) floor = Math.min(floor, at(f, n)[1]);
  const rows = frames.map((f) => {
    const pelvis = at(f, 'cf_j_hips'), neck = at(f, 'cf_j_neck');
    const up = [neck[0] - pelvis[0], neck[1] - pelvis[1], neck[2] - pelvis[2]];
    const len = Math.hypot(...up) || 1;
    const incl = (Math.acos(Math.max(-1, Math.min(1, up[1] / len))) * 180) / Math.PI;
    const h = (n) => at(f, n)[1] - floor;
    return { incl, pelvis: h('cf_j_hips'), knees: Math.min(h('cf_j_leg01_L'), h('cf_j_leg01_R')), hands: Math.min(h('cf_j_hand_L'), h('cf_j_hand_R')), handsMax: Math.max(h('cf_j_hand_L'), h('cf_j_hand_R')), feet: Math.min(h('cf_j_foot_L'), h('cf_j_foot_R')), chest: h('cf_j_spine03'), head: h('cf_j_head') };
  });
  const m = (k) => med(rows.map((r) => r[k]));
  const hands = (pick) => med(rows.map((r) => pick(r.handL, r.handR)));
  const anatomy = res.anatomy?.metrics || {};
  return { duration: res.duration, incl: m('incl'), pelvis: m('pelvis'), knees: m('knees'), hands: m('hands'), handsMax: m('handsMax'), feet: m('feet'), chest: m('chest'), head: m('head'), outward: Math.max(anatomy['L.leg.outward']?.mean ?? 0, anatomy['R.leg.outward']?.mean ?? 0), kneeFlex: Math.max(anatomy['L.leg.flexion']?.mean ?? 0, anatomy['R.leg.flexion']?.mean ?? 0) };
}

export function supportClass(g) {
  const horizontal = g.incl > 55, upright = g.incl < 40;
  const kneesDown = g.knees < 0.08, feetDown = g.feet < 0.08, handsDown = g.hands < 0.08, bothHands = (g.handsMax ?? g.hands) < 0.10;
  const pelvisLow = g.pelvis <= 0.17, pelvisHigh = g.pelvis > 0.18;
  // Knees and a raised pelvis decide first: the torso angle only says whether the body is folded over them.
  if (kneesDown && pelvisHigh) {
    if (bothHands) return horizontal ? 'quadruped' : 'kneeling-hand';
    if (handsDown) return 'kneeling-hand';
    return g.incl > 45 ? 'kneeling-fold' : 'kneeling';
  }
  if (horizontal) return 'lying';
  if (pelvisLow) {
    if (!kneesDown && g.knees > 0.2 && handsDown) return 'three-point';
    if (g.outward > 0.45) return 'butt-side';
    if (feetDown && kneesDown) return 'butt-folded';
    return 'butt';
  }
  if (feetDown && g.pelvis > 0.3) return 'feet';
  return 'other';
}

if (import.meta.filename === process.argv[1]) {
  for (const id of process.argv.slice(2)) {
    const g = geometry(id);
    console.log(id.slice(0, 8), supportClass(g).padEnd(14), 'incl', g.incl.toFixed(0), 'pelvis', g.pelvis.toFixed(2), 'knees', g.knees.toFixed(2), 'hands', g.hands.toFixed(2), 'feet', g.feet.toFixed(2), 'outward', g.outward.toFixed(2));
  }
}
