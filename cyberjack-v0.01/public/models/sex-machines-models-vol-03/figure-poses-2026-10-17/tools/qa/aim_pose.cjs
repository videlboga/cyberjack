// Deterministic aim solver: sets normalized-bone local quats so each bone->child direction matches the
// mannequin targets, using SWING-ONLY rotations (no twist around the bone axis) + per-joint angle limits.
// This avoids the candy-wrapper distortion that free quaternion IK produces.
// Usage: node aim_pose.cjs <poseJson> <url> <machine> <char> <targetsJson> [limits|none]
const fs = require('fs');
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');

// per-joint max rotation from rest (degrees) — anatomical sanity net
const LIMITS = {
  spine: 40, chest: 40, upperChest: 35, neck: 45, head: 45,
  leftUpperArm: 160, leftLowerArm: 150, leftHand: 40,
  rightUpperArm: 160, rightLowerArm: 150, rightHand: 40,
  leftUpperLeg: 110, leftLowerLeg: 150, leftFoot: 105,
  rightUpperLeg: 110, rightLowerLeg: 150, rightFoot: 105,
};

(async () => {
  const posePath = process.argv[2];
  const base = process.argv[3];
  const mid = process.argv[4];
  const char = process.argv[5] || 'x20/outfits/Rin_outfit_00.vrm';
  const targets = JSON.parse(fs.readFileSync(process.argv[6], 'utf8')); // {bone: [dir], ...} in solve order
  const useLimits = (process.argv[7] || 'limits') !== 'none';
  const pose = JSON.parse(fs.readFileSync(posePath, 'utf8'));
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

    const res = await page.evaluate((pose, targets, LIMITS, useLimits) => {
      const PARENT = {
        spine: 'hips', chest: 'spine', upperChest: 'chest', neck: 'upperChest', head: 'neck',
        leftUpperArm: 'leftShoulder', leftLowerArm: 'leftUpperArm', leftHand: 'leftLowerArm',
        rightUpperArm: 'rightShoulder', rightLowerArm: 'rightUpperArm', rightHand: 'rightLowerArm',
        leftUpperLeg: 'hips', leftLowerLeg: 'leftUpperLeg', leftFoot: 'leftLowerLeg',
        rightUpperLeg: 'hips', rightLowerLeg: 'rightUpperLeg', rightFoot: 'rightLowerLeg',
      };
      const CHILD = {
        spine: 'chest', chest: 'upperChest', upperChest: 'neck', neck: 'head',
        leftUpperArm: 'leftLowerArm', leftLowerArm: 'leftHand',
        rightUpperArm: 'rightLowerArm', rightLowerArm: 'rightHand',
        leftUpperLeg: 'leftLowerLeg', leftLowerLeg: 'leftFoot', leftFoot: 'leftToes',
        rightUpperLeg: 'rightLowerLeg', rightLowerLeg: 'rightFoot', rightFoot: 'rightToes',
      };
      // ---- quaternion helpers (xyzw)
      const qm = (a, b) => [
        a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
        a[3] * b[1] + a[1] * b[3] + a[2] * b[0] - a[0] * b[2],
        a[3] * b[2] + a[2] * b[3] + a[0] * b[1] - a[1] * b[0],
        a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
      const qc = a => [-a[0], -a[1], -a[2], a[3]];
      const qn = a => { const l = Math.hypot(a[0], a[1], a[2], a[3]) || 1; return [a[0] / l, a[1] / l, a[2] / l, a[3] / l]; };
      const qrot = (q, v) => { const p = qm(qm(q, [v[0], v[1], v[2], 0]), qc(q)); return [p[0], p[1], p[2]]; };
      const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
      const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      // minimal rotation taking unit u to unit v
      const swing = (u, v) => {
        u = norm(u); v = norm(v);
        const d = dot(u, v);
        if (d > 0.999999) return [0, 0, 0, 1];
        if (d < -0.999999) { // 180 deg: any perpendicular axis
          let ax = cross(u, [0, 1, 0]); if (Math.hypot(...ax) < 1e-6) ax = cross(u, [1, 0, 0]);
          ax = norm(ax); return [ax[0], ax[1], ax[2], 0];
        }
        const c = cross(u, v); const w = 1 + d;
        return qn([c[0], c[1], c[2], w]);
      };
      const qAngle = q => 2 * Math.acos(Math.min(1, Math.max(-1, Math.abs(q[3]))));
      const qSlerpFromIdentity = (q, t) => { // scale rotation angle to t*angle
        const ang = qAngle(q); if (ang < 1e-6) return [0, 0, 0, 1];
        const h = ang * t / 2, s = Math.sin(h), s0 = Math.sin(ang / 2);
        const k = s / s0;
        return qn([q[0] * k, q[1] * k, q[2] * k, Math.cos(h)]);
      };

      // reset to rest, then apply only the whole-body (hips) rotation from the pose
      window.__mpRestAll();
      window.__mpSetLocalQuat('hips', pose.quats.hips);

      const log = [];
      const out = { hips: pose.quats.hips.slice() };
      for (const bone of Object.keys(targets)) {
        const d = norm(targets[bone]);
        const par = PARENT[bone];
        const uLoc = window.__mpSegLocalDir(bone, CHILD[bone]);
        const qw0 = window.__mpWorldQuat(bone);
        const parQ = window.__mpWorldQuat(par);
        if (!uLoc || !qw0 || !parQ) { log.push([bone, 'missing']); continue; }
        const uW = norm(qrot(qw0, uLoc));
        const dq = swing(uW, d);
        const qwNew = qn(qm(dq, qw0));            // no twist added: pure swing from the current world pose
        let qLocal = qn(qm(qc(parQ), qwNew));
        let clamped = false;
        if (useLimits) {
          const ang = qAngle(qLocal) * 180 / Math.PI;
          const lim = LIMITS[bone] || 180;
          if (ang > lim) { qLocal = qSlerpFromIdentity(qLocal, lim / ang); clamped = true; }
        }
        window.__mpSetLocalQuat(bone, qLocal);
        out[bone] = qLocal.map(v => +v.toFixed(6));
        // achieved direction (after clamp)
        const qw1 = window.__mpWorldQuat(bone);
        const u1 = window.__mpSegLocalDir(bone, CHILD[bone]);
        const achieved = norm(qrot(qw1, u1));
        const err = Math.acos(Math.min(1, Math.max(-1, dot(achieved, d)))) * 180 / Math.PI;
        log.push([bone, +err.toFixed(1), clamped]);
      }
      // remaining bones of the JSON that we do not drive stay at rest
      for (const b of Object.keys(pose.quats)) if (!(b in out)) out[b] = [0, 0, 0, 1];
      return { quats: out, log };
    }, pose, targets, LIMITS, useLimits);

    pose.quats = res.quats;
    fs.writeFileSync(posePath, JSON.stringify(pose, null, 1) + '\n');
    console.log('bone        err_deg  clamped');
    for (const [b, e, c] of res.log) console.log('  ' + String(b).padEnd(14), String(e).padStart(6), c ? 'CLAMP' : '');
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) });
