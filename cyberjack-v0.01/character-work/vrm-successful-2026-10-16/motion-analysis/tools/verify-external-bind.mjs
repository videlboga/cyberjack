// Готовность внешних клипов к стенду: проверяем ровно то, что делает вьювер —
// сопоставление имён костей с bone-map и корректность кватернионов/таймингов.
import fs from 'node:fs';

const [boneMapFile, clipsFile] = process.argv.slice(2);
const boneMap = JSON.parse(fs.readFileSync(boneMapFile, 'utf8'));
const doc = JSON.parse(fs.readFileSync(clipsFile, 'utf8'));
const targets = new Map(Object.entries(boneMap).map(([k, v]) => [k, v]));
const seenVrm = new Set();

let fail = 0;
for (const clip of doc.clips) {
  let bound = 0, skipped = [], badQuat = 0, badTime = 0;
  const n = clip.tracks[0]?.times?.length || 0;
  for (const t of clip.tracks) {
    const vrm = targets.get(t.bone);
    if (!vrm) { skipped.push(t.bone); continue; }
    if (seenVrm.has(vrm) && clip === doc.clips[0]) { /* цель уникальна в рамках скелета */ }
    bound++;
    if (t.times.length !== n) badTime++;
    for (let i = 0; i < t.times.length; i++) {
      const q = [t.rotations[i*4], t.rotations[i*4+1], t.rotations[i*4+2], t.rotations[i*4+3]];
      if (q.some(v => !Number.isFinite(v))) { badQuat++; continue; }
      const len = Math.hypot(...q);
      if (Math.abs(len - 1) > 0.01) badQuat++;
    }
    for (let i = 1; i < t.times.length; i++) if (t.times[i] <= t.times[i-1]) badTime++;
  }
  const dt = clip.tracks[0].times[1] - clip.tracks[0].times[0];
  const ok = bound >= 19 && badQuat === 0 && badTime === 0;
  if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${clip.id.padEnd(24)} костей ${bound}/${clip.tracks.length}` +
    ` | кадров ${n} | шаг ${dt.toFixed(4)} с (${(1/dt).toFixed(0)} fps)` +
    ` | длительность ${clip.duration} с` +
    (skipped.length ? ` | вне VRM: ${skipped.join(',')}` : '') +
    (badQuat ? ` | битых кватернионов ${badQuat}` : '') +
    (badTime ? ` | сломан тайминг ${badTime}` : ''));
}
console.log(fail ? `\nпровалов: ${fail}` : '\nвсе клипы готовы к мержу в bank.clips');
