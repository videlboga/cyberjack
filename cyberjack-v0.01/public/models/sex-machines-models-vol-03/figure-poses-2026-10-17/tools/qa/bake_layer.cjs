// Bake a layered clip (masked sub-animation) on top of the machine pose:
// base = pose-SexMachineModel-<mid>.json, layer = a controller-layer clip from the library.
// Only bones that actually move inside the layer clip are overridden (approximation of the layer's
// Transform mask); the hips keep the machine orientation.
// Usage: node bake_layer.cjs <studioUrl> <layerClipId> <frames> <weight> <poseJson> <outJson>
const fs = require('fs');
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');

const BONES = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot'];

(async () => {
  const [studioUrl, clipId, framesArg, weightArg, posePath, outPath] = process.argv.slice(2);
  const N = parseInt(framesArg || '30');
  const W = parseFloat(weightArg || '1');
  const base = JSON.parse(fs.readFileSync(posePath, 'utf8'));
  const browser = await puppeteer.launch({
    executablePath: process.env.BROWSER_BIN || '/usr/bin/chromium', headless: true, pipe: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
    defaultViewport: { width: 900, height: 700 }
  });
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto(`${studioUrl}?vrm=${encodeURIComponent('models/x20/outfits/Rin_outfit_03.vrm')}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__studio && window.__studio.ready === true, { timeout: 240000 });
    await page.waitForFunction(() => window.__studio.library && window.__studio.library.selectClip, { timeout: 120000 });
    const res = await page.evaluate(async (clipId, N, BONES) => {
      window.__forceLayerClip = true;
      const rec = (window.__studio.library.clips || []).find(x => x.id === clipId);
      if (rec) rec.runtimePlayable = true;
      await window.__studio.library.selectClip(clipId);
      const clip = window.__studio.currentClip();
      const dur = clip && clip.duration ? clip.duration : 1;
      const vrm = window.__studio.vrm;
      const frames = [];
      for (let i = 0; i < N; i++) {
        const t = (i / N) * dur;
        window.__studio.sampleBody(t);
        vrm.scene.updateMatrixWorld(true);
        const q = {};
        for (const b of BONES) {
          const n = vrm.humanoid.getRawBoneNode(b) || vrm.humanoid.getNormalizedBoneNode(b);
          if (n) q[b] = [n.quaternion.x, n.quaternion.y, n.quaternion.z, n.quaternion.w];
        }
        frames.push(q);
      }
      return { id: clip?.id, name: clip?.name, duration: dur, frames };
    }, clipId, N, BONES);

    // mask approximation: layer clips are full-body poses, so take the bones whose rotation
    // VARIES over the clip (the actual sway) instead of every bone that is merely off rest.
    const ang = (a, b) => {
      const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
      return 2 * Math.acos(Math.min(1, d));
    };
    const amp = {};
    for (const b of BONES) {
      if (b === 'hips') continue;
      let mx = 0;
      for (const f of res.frames) {
        if (!f[b]) continue;
        for (const g of res.frames) if (g[b]) mx = Math.max(mx, ang(f[b], g[b]));
      }
      amp[b] = mx;
    }
    const sorted = Object.entries(amp).sort((a, b) => b[1] - a[1]);
    const MAXK = parseInt(process.env.MASK_BONES || '6', 10);
    const active = new Set();
    for (const [b, a] of sorted) {
      if (active.size >= MAXK) break;
      if (a < 0.02) break;              // < ~1.1 deg: essentially static
      active.add(b);
    }
    console.error('amplitudes:', sorted.slice(0, 8).map(([b, a]) => b + '=' + (a * 180 / Math.PI).toFixed(1) + 'deg').join(', '));
    console.log('clip', res.name, 'dur', res.duration.toFixed(3), '| active bones:', [...active].join(', ') || '(none)');

    // compose base + layer
    const slerp = (a, b, t) => {
      let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
      let bb = b.slice();
      if (d < 0) { d = -d; bb = bb.map(v => -v); }
      if (d > 0.9995) return a.map((v, i) => v + (bb[i] - v) * t);
      const th = Math.acos(Math.min(1, d)), s = Math.sin(th);
      const w1 = Math.sin((1 - t) * th) / s, w2 = Math.sin(t * th) / s;
      return a.map((v, i) => v * w1 + bb[i] * w2);
    };
    const out = { source: { clip: res.id, name: res.name, duration: res.duration, weight: W, activeBones: [...active] },
      base: posePath.split('/').pop(), scale: base.scale, hipsPoint: base.hipsPoint,
      frames: res.frames.map(f => {
        const q = {};
        for (const b of BONES) {
          const baseQ = base.quats[b] || [0, 0, 0, 1];
          q[b] = active.has(b) && f[b] ? slerp(baseQ, f[b], W).map(v => +v.toFixed(6)) : baseQ;
        }
        return q;
      }) };
    fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
    console.log('written', outPath, 'frames', out.frames.length);
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) });
