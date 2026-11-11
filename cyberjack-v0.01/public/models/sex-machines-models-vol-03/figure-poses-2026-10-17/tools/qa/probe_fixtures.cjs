// Fixture fit check: distances from the character's joints to machine-080 restraint points.
// Usage: node probe_fixtures.cjs <url> <machine> <char> [poseFile]
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
// machine-080 fixtures (metres, prepared frame)
const FIX = {
  protrusion: [2.061, 1.555, -3.547],   // выступ на уступе -> пах
  hexL: [2.403, 1.889, -3.676],         // шестигранное гнездо под кисть (левое, -Z)
  hexR: [2.403, 1.889, -3.418],
  archL: [2.105, 1.292, -3.677],        // арка под щиколотку
  archR: [2.105, 1.292, -3.417],
  roller: [2.044, 1.232, -3.548],       // валик под ступни
};
(async () => {
  const base = process.argv[2], mid = process.argv[3];
  const char = process.argv[4] || 'x20/outfits/Rin_outfit_03.vrm';
  const poseFile = process.argv[5];
  const browser = await puppeteer.launch({
    executablePath: process.env.BROWSER_BIN || '/usr/bin/chromium', headless: true, pipe: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
    defaultViewport: { width: 900, height: 700 }
  });
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    const q = `?machine=${mid}&char=${encodeURIComponent(char)}${poseFile ? '&pose=' + poseFile : ''}`;
    await page.goto(base + q, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__mp && window.__mp.ready === true, { timeout: 240000 });
    const out = await page.evaluate(() => {
      const P = n => window.__mpBonePos(n);
      return {
        hips: P('hips'), pelvisLow: P('leftUpperLeg'), kneeL: P('leftLowerLeg'), kneeR: P('rightLowerLeg'),
        ankleL: P('leftFoot'), ankleR: P('rightFoot'),
        handL: P('leftHand'), handR: P('rightHand'),
        head: P('head'), toeL: P('leftToes'), toeR: P('rightToes'),
        foreL: P('leftLowerArm'), foreR: P('rightLowerArm'),
      };
    });
    const d = (a, b) => a && b ? +(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100).toFixed(1) : null;
    console.log(JSON.stringify({
      hips: out.hips && out.hips.map(v => +v.toFixed(3)),
      crotch_to_protrusion_cm: d(out.pelvisLow, FIX.protrusion),
      handL_to_hexL_cm: d(out.handL, FIX.hexL), handR_to_hexR_cm: d(out.handR, FIX.hexR),
      elbowL_to_hexL_cm: d(out.foreL, FIX.hexL),
      ankleL_to_archL_cm: d(out.ankleL, FIX.archL), ankleR_to_archR_cm: d(out.ankleR, FIX.archR),
      toeL_to_roller_cm: d(out.toeL, FIX.roller), toeR_to_roller_cm: d(out.toeR, FIX.roller),
      points: out,
    }, null, 1));
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) });
