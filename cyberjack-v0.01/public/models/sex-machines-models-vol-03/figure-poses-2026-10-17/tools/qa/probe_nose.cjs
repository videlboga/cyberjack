// Which way does the SKINNED MESH face? Finds the head vertices, takes the point farthest from the
// head-bone axis (nose) and reports the direction. Also reports the hips bone forward (-Z) for comparison.
// Usage: node probe_nose.cjs <url> <machine> [char] [poseFile]
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
(async () => {
  const base = process.argv[2], mid = process.argv[3];
  const char = process.argv[4] || 'x20/outfits/Rin_outfit_03.vrm';
  const pf = process.argv[5];
  const browser = await puppeteer.launch({
    executablePath: process.env.BROWSER_BIN || '/usr/bin/chromium', headless: true, pipe: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
    defaultViewport: { width: 900, height: 700 }
  });
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    const q = `?machine=${mid}&char=${encodeURIComponent(char)}${pf ? '&pose=' + pf : ''}`;
    await page.goto(base + q, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__mp && window.__mp.ready === true, { timeout: 240000 });
    const out = await page.evaluate(() => {
      // find the avatar root: the parent of the hips normalized bone
      const hips = window.__mpBonePos('hips');
      const head = window.__mpBonePos('head');
      const neck = window.__mpBonePos('neck');
      let root = null;
      // walk the scene from the renderer's root: use __mp debug hook if present
      const cands = [];
      document.querySelectorAll('canvas'); // no-op, keeps linters quiet
      // VRM scene is reachable through the bone node's ancestors
      const node = window.__mpBoneNode ? window.__mpBoneNode('head') : null;
      return { hips, head, neck, needNode: !node };
    });
    // second pass with explicit hooks (added to the page)
    const res = await page.evaluate(() => {
      const H = window.__mpHeadMeshProbe ? window.__mpHeadMeshProbe(120) : null;
      return H;
    });
    console.log(JSON.stringify({ probe: out, headMesh: res }, null, 1));
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) });
