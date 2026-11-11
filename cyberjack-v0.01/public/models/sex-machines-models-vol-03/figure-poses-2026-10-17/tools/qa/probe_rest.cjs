const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
(async () => {
  const base = process.argv[2];
  const browser = await puppeteer.launch({executablePath: '/usr/bin/chromium', headless: true, pipe: true,
    args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'], defaultViewport:{width:900,height:700}});
  try {
    const page = await browser.newPage();
    await page.goto(`${base}?vrm=${encodeURIComponent('models/x20/outfits/Rin_outfit_03.vrm')}`, {waitUntil:'load'});
    await page.waitForFunction(() => window.__studio && window.__studio.ready === true, {timeout:240000});
    const out = await page.evaluate(() => {
      const vrm = window.__studio.vrm;
      const rest = vrm.humanoid.normalizedRestPose;
      const res = {};
      for (const b of ['hips','leftUpperArm','leftLowerLeg']) {
        const raw = vrm.humanoid.getRawBoneNode(b);
        const norm = vrm.humanoid.getNormalizedBoneNode(b);
        res[b] = {
          raw: raw ? [raw.quaternion.x, raw.quaternion.y, raw.quaternion.z, raw.quaternion.w].map(v=>+v.toFixed(4)) : null,
          rest: rest?.[b]?.rotation ? [rest[b].rotation.x, rest[b].rotation.y, rest[b].rotation.z, rest[b].rotation.w].map(v=>+v.toFixed(4)) : null,
          norm: norm ? [norm.quaternion.x, norm.quaternion.y, norm.quaternion.z, norm.quaternion.w].map(v=>+v.toFixed(4)) : null,
        };
      }
      return res;
    });
    console.log(JSON.stringify(out, null, 1));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
