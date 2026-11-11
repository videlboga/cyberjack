import {buildRig, analyze} from './geometry.mjs';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const root = process.argv[2];
const rigFile = process.argv[3];
const ids = process.argv.slice(4);
const sr = JSON.parse(fs.readFileSync(rigFile, 'utf8'));
const rig = buildRig(sr.rigs.find(r => r.name === 'p_cf_body_bone').bones);
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'animations/catalog.json'), 'utf8'));
const byId = new Map(catalog.clips.map(c => [c.id, c]));
const out = [];
for (const id of ids) {
  const c = byId.get(id);
  if (!c) { out.push({id, error: 'not-in-catalog'}); continue; }
  try {
    const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'animations', c.asset))));
    const a = analyze(data, rig, {preview: true});
    const frames = a.preview.frames, names = a.preview.names;
    const ix = n => names.indexOf(n);
    const sub = (a, b) => a.map((v, i) => v - b[i]);
    const len = v => Math.hypot(...v);
    const ang = (u, v) => {
      const lu = len(u), lv = len(v);
      return Math.acos(Math.max(-1, Math.min(1, (u[0]*v[0]+u[1]*v[1]+u[2]*v[2])/(lu*lv))))*180/Math.PI;
    };
    const knee = [], elbow = [], lean = [];
    for (const f of frames) {
      for (const s of ['L', 'R']) {
        knee.push(ang(sub(f[ix('cf_j_leg01_'+s)], f[ix('cf_j_thigh00_'+s)]), sub(f[ix('cf_j_foot_'+s)], f[ix('cf_j_leg01_'+s)])));
        elbow.push(ang(sub(f[ix('cf_j_forearm01_'+s)], f[ix('cf_j_arm00_'+s)]), sub(f[ix('cf_j_hand_'+s)], f[ix('cf_j_forearm01_'+s)])));
      }
      const up = sub(f[ix('cf_j_neck')], f[ix('cf_j_hips')]);
      lean.push(Math.atan2(Math.hypot(up[0], up[2]), up[1])*180/Math.PI);
      void up;
    }
    const rng = a => [Math.round(Math.min(...a)), Math.round(Math.max(...a))];
    out.push({id, name: c.name, category: c.category, rig: c.rig, duration: +c.duration.toFixed(2),
      status: a.status, coverage: a.coverage, posture: a.posture,
      rootTravel: a.rootTravel, speed_h_s: +(a.rootTravel / (a.duration || 1)).toFixed(3),
      knee_deg: rng(knee), elbow_deg: rng(elbow), lean_deg: rng(lean),
      kneeMedian: a.legs?.L?.kneeMedianDeg, activity: a.activity});
  } catch (e) {
    out.push({id, name: c.name, error: String(e.message || e)});
  }
}
console.log(JSON.stringify(out, null, 1));
