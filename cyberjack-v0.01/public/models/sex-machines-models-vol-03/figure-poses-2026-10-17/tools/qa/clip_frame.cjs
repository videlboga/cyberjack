// Extract a frozen frame of a library clip as normalized-bone local quaternions (machine-pose format).
// Usage: node clip_frame.cjs <studioUrl> <clipId> <timeSeconds> [charVrm]
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const BONES = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot'];
(async () => {
  const base = process.argv[2];
  const clipId = process.argv[3];
  const t = parseFloat(process.argv[4] || '0.5');
  const char = process.argv[5] || 'models/x20/outfits/Rin_outfit_03.vrm';
  const browser = await puppeteer.launch({
    executablePath: process.env.BROWSER_BIN || '/usr/bin/chromium', headless: true, pipe: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
    defaultViewport: { width: 1000, height: 800 }
  });
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto(`${base}?vrm=${encodeURIComponent(char)}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__studio && window.__studio.ready === true, { timeout: 240000 });
    await page.waitForFunction(() => window.__studio.library && window.__studio.library.selectClip, { timeout: 120000 });
    const res = await page.evaluate(async (clipId, t, BONES) => {
      await window.__studio.library.selectClip(clipId);
      const clip = window.__studio.currentClip();
      const dur = clip && clip.duration ? clip.duration : 1;
      const tt = Math.max(0, Math.min(dur - 1e-3, t));
      window.__studio.sampleBody(tt);
      const vrm = window.__studio.vrm;
      vrm.scene.updateMatrixWorld(true);
      const q = {};
      for (const b of BONES) {
        const n = vrm.humanoid.getRawBoneNode(b) || vrm.humanoid.getNormalizedBoneNode(b);
        if (n) q[b] = [n.quaternion.x, n.quaternion.y, n.quaternion.z, n.quaternion.w].map(v => +v.toFixed(6));
      }
      return { clip: clip?.id, name: clip?.name, duration: dur, time: tt, quats: q };
    }, clipId, t, BONES);
    console.log(JSON.stringify(res));
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) });
