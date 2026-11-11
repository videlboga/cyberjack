// Contact sheet of clips where the presented part was measured as feet: skeletons in side view.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { buildRig, analyze } from '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16/motion-analysis/tools/geometry.mjs';
import { measurePoseParts } from '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16/motion-analysis/tools/pose-parts.mjs';

const root = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16';
const catalog = JSON.parse(fs.readFileSync(root + '/animations/catalog.json')).clips;
const rigs = JSON.parse(fs.readFileSync(root + '/animations/source_rigs.json')).rigs;
const by = { female: buildRig(rigs.find((r) => r.name === 'p_cf_body_bone').bones), male: buildRig(rigs.find((r) => r.name === 'p_cm_body_00').bones) };
by.shared = by.female;
const rows = new Map(JSON.parse(fs.readFileSync('/tmp/libsnap.json')).rows.map((r) => [r.id, r]));
const cat = new Map(catalog.map((c) => [c.id, c]));

const CHAINS = [
  ['cf_j_hips', 'cf_j_spine01', 'cf_j_spine02', 'cf_j_spine03', 'cf_j_neck', 'cf_j_head'],
  ['cf_j_hips', 'cf_j_thigh00_L', 'cf_j_leg01_L', 'cf_j_foot_L', 'cf_j_toes_L'],
  ['cf_j_hips', 'cf_j_thigh00_R', 'cf_j_leg01_R', 'cf_j_foot_R', 'cf_j_toes_R'],
  ['cf_j_spine03', 'cf_j_arm00_L', 'cf_j_forearm01_L', 'cf_j_hand_L'],
  ['cf_j_spine03', 'cf_j_arm00_R', 'cf_j_forearm01_R', 'cf_j_hand_R'],
];

const candidates = [...rows.values()].filter((r) => (r.goals || []).includes('foot.presented')).slice(0, 60);
const picked = [];
for (const r of candidates) {
  const c = cat.get(r.id);
  if (!c) continue;
  const res = analyze(JSON.parse(zlib.gunzipSync(fs.readFileSync(root + '/animations/' + c.asset))), by[c.rig], { preview: true });
  if (!res.preview) continue;
  const parts = measurePoseParts({ frames: res.preview.frames, names: res.preview.names });
  if (parts.label !== "feet" || parts.feet < 0.35) continue;
  picked.push({ id: r.id, name: r.name, posture: r.posture, energy: r.energy, parts, preview: res.preview });
  if (picked.length >= 8) break;
}

const W = 260, H = 210;
const panels = picked.map((p) => {
  const { frames, names } = p.preview;
  const idx = (n) => names.indexOf(n);
  const moments = [0.25, 0.55, 0.85].map((f) => frames[Math.min(frames.length - 1, Math.floor(f * frames.length))]);
  const cells = moments.map((f) => {
    // side view: horizontal = z (depth), vertical = y (height); one unit = 1 body height
    const px = (v) => 20 + (v[2] + 0.45) * 230;
    const py = (v) => H - 12 - v[1] * 175;
    const polylines = CHAINS.map((chain) => {
      const pts = chain.filter((n) => idx(n) >= 0).map((n) => `${px(f[idx(n)]).toFixed(1)},${py(f[idx(n)]).toFixed(1)}`).join(' ');
      return `<polyline points="${pts}" fill="none" stroke="#333" stroke-width="1.6" stroke-linecap="round"/>`;
    }).join('');
    const foot = f[idx('cf_j_foot_L')], foot2 = f[idx('cf_j_foot_R')];
    const markers = [foot, foot2].map((v) => `<circle cx="${px(v).toFixed(1)}" cy="${py(v).toFixed(1)}" r="3.4" fill="#c2185b"/>`).join('');
    const ground = `<line x1="10" y1="${H - 12}" x2="${W - 10}" y2="${H - 12}" stroke="#bbb" stroke-dasharray="3 3"/>`;
    return `<svg width="${W / 3}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#fff">${ground}${polylines}${markers}</svg>`;
  }).join('');
  return `<div style="display:inline-block;margin:0 8px 14px 0;font:12px system-ui;border:1px solid #ddd;border-radius:6px;padding:6px">
    <div style="display:flex">${cells}</div>
    <div style="margin-top:4px"><b>${p.name}</b> · ${p.posture} · ${p.energy}</div>
    <div style="color:#666">feet ${p.parts.feet.toFixed(2)} · hands ${p.parts.hands.toFixed(2)} · hips ${p.parts.hips.toFixed(2)} → <b style="color:#c2185b">${p.parts.label}</b></div>
  </div>`;
});

const html = `<!doctype html><html><body style="margin:12px;background:#fff"><div style="font:13px system-ui;margin-bottom:8px">Демонстрируемая часть = стопы (вид сбоку: по горизонтали глубина, по вертикали высота). Красные точки — стопы.</div>${panels.join('')}</body></html>`;
fs.writeFileSync(root + '/motion-analysis/data/feet-presented-sheet.html', html);
console.log('clips:', picked.length, picked.map((p) => p.name + ' ' + p.parts.feet.toFixed(2)).join(' | '));
