// In-browser IK polish of a machine pose: optimises normalized-bone local quats so the segment
// directions in the REAL three-vrm rig match the mannequin targets (machine frame, Y-up).
// The analytic FK in pose_solve.py assumes world-aligned bone frames; three-vrm rest orientations
// differ (esp. arms), so this step is required for arms/shins to land correctly.
// Usage: node ik_fit.cjs <poseJson> <url> <machine> [char]
const fs = require('fs');
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');

const DEFAULT_SEGS = [
  ['spine', 'hips', 'neck', [0.15, 0.99, 0.0], 2.4],
  ['spineLow', 'hips', 'chest', [0.15, 0.99, 0.0], 1.6],
  ['spineMid', 'chest', 'neck', [0.15, 0.99, 0.0], 1.6],
  ['head', 'neck', 'head', [0.02, 1.0, 0.0], 1.0],
  ['thighL', 'hips', 'kneeL', [-0.30, -0.45, -0.84], 1.6],
  ['shinL', 'kneeL', 'footL', [0.01, -0.55, 0.83], 1.2],
  ['thighR', 'hips', 'kneeR', [-0.30, -0.45, 0.84], 1.6],
  ['shinR', 'kneeR', 'footR', [0.01, -0.55, -0.83], 1.2],
  ['upperArmL', 'shoulderL', 'elbowL', [0.53, -0.84, 0.09], 1.2],
  ['lowerArmL', 'elbowL', 'handL', [0.03, -0.98, 0.19], 1.0],
  ['upperArmR', 'shoulderR', 'elbowR', [0.53, -0.84, -0.09], 1.2],
  ['lowerArmR', 'elbowR', 'handR', [0.03, -0.98, -0.19], 1.0],
  // keep the torso untwisted: shoulder line must stay along -Z (the body's left)
  ['shoulderSpan', 'shoulderR', 'shoulderL', [0.0, 0.0, -1.0], 2.0],
];
const BONE_OF = { hips: 'hips', neck: 'neck', head: 'head', chest: 'chest', kneeL: 'leftLowerLeg', footL: 'leftFoot',
  kneeR: 'rightLowerLeg', footR: 'rightFoot', shoulderL: 'leftUpperArm', elbowL: 'leftLowerArm',
  handL: 'leftHand', shoulderR: 'rightUpperArm', elbowR: 'rightLowerArm', handR: 'rightHand' };
// shoulders stay at rest: rotating them shifts the shoulder joint and made the arms lopsided.
const FREE = ['spine', 'chest', 'upperChest', 'neck', 'head',
  'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot'];

(async () => {
  const posePath = process.argv[2];
  const base = process.argv[3] || 'http://127.0.0.1:8766/machine_pose.html';
  const mid = process.argv[4];
  const char = process.argv[5] || 'x20/outfits/Rin_outfit_00.vrm';
  const pose = JSON.parse(fs.readFileSync(posePath, 'utf8'));
  const segsPath = process.argv[6] || process.env.SEGS_JSON;
  const SEGS = segsPath ? JSON.parse(fs.readFileSync(segsPath, 'utf8')) : DEFAULT_SEGS;
  const browser = await puppeteer.launch({
    executablePath: process.env.BROWSER_BIN || '/usr/bin/chromium', headless: true, pipe: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
    defaultViewport: { width: 1200, height: 900 }
  });
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto(`${base}?machine=${mid}&char=${encodeURIComponent(char)}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__mp && window.__mp.ready === true, { timeout: 240000 });
    const res = await page.evaluate((pose, SEGS, BONE_OF, FREE) => {
      const V = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const N = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const pos = k => window.__mpBonePos(BONE_OF[k]);
      const q = {};
      for (const [b, v] of Object.entries(pose.quats)) q[b] = v.slice();
      const apply = () => window.__mpSetQuats(q);
      const loss = () => {
        apply();
        let L = 0; const parts = {};
        for (const [name, a, c, t, w] of SEGS) {
          const pa = pos(a), pc = pos(c);
          if (!pa || !pc) continue;
          const d = N(V(pc, pa));
          const e = (1 - dot(d, t)) * w;
          parts[name] = +(e.toFixed(4));
          L += e;
        }
        return [L, parts];
      };
      const qmul = (a, b) => [
        a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
        a[3] * b[1] + a[1] * b[3] + a[2] * b[0] - a[0] * b[2],
        a[3] * b[2] + a[2] * b[3] + a[0] * b[1] - a[1] * b[0],
        a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
      const dq = (ax, deg) => {
        const h = deg * Math.PI / 360, s = Math.sin(h);
        const v = [0, 0, 0]; v[ax] = s;
        return [v[0], v[1], v[2], Math.cos(h)];
      };
      let [best, parts] = loss();
      const start = best;
      for (const step of [24, 12, 6, 3, 1.5]) {
        for (let pass = 0; pass < 3; pass++) {
          let improved = false;
          for (const b of FREE) {
            if (!q[b]) continue;
            for (let ax = 0; ax < 3; ax++) {
              for (const sgn of [1, -1]) {
                const old = q[b].slice();
                q[b] = qmul(old, dq(ax, step * sgn));
                const [L] = loss();
                if (L < best - 1e-9) { best = L; improved = true; } else { q[b] = old; }
              }
            }
          }
          if (!improved) break;
        }
      }
      const [, finalParts] = loss();
      return { quats: q, lossStart: start, lossEnd: best, parts: finalParts };
    }, pose, SEGS, BONE_OF, FREE);
    pose.quats = res.quats;
    pose.fitLossStart = +res.lossStart.toFixed(4);
    pose.fitLoss = +res.lossEnd.toFixed(4);
    fs.writeFileSync(posePath, JSON.stringify(pose, null, 1) + '\n');
    console.log(JSON.stringify({ lossStart: res.lossStart, lossEnd: res.lossEnd, parts: res.parts }, null, 1));
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) });
