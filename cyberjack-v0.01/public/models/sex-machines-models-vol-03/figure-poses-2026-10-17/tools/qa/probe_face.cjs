// Orientation probe: reports, in the machine frame, which way the character's face / chest / toes point.
// Usage: node probe_face.cjs <url> <machine> [char]
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
(async () => {
  const base = process.argv[2], mid = process.argv[3];
  const char = process.argv[4] || 'x20/outfits/Rin_outfit_03.vrm';
  const browser = await puppeteer.launch({
    executablePath: process.env.BROWSER_BIN || '/usr/bin/chromium', headless: true, pipe: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
    defaultViewport: { width: 900, height: 700 }
  });
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto(`${base}?machine=${mid}&char=${encodeURIComponent(char)}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__mp && window.__mp.ready === true, { timeout: 240000 });
    const out = await page.evaluate(() => {
      const P = n => window.__mpBonePos(n);
      const dir = (a, b) => { const p = P(b), q = P(a); if (!p || !q) return null; const v = [p[0] - q[0], p[1] - q[1], p[2] - q[2]]; const l = Math.hypot(...v) || 1; return v.map(x => +(x / l).toFixed(3)); };
      const qh = window.__mpWorldQuat('head');
      // world direction of the head bone's local -Z (VRM face forward at rest)
      const qrot = (q, v) => {
        const [x, y, z, w] = q;
        const uv = [y * v[2] - z * v[1] + w * v[0], z * v[0] - x * v[2] + w * v[1], x * v[1] - y * v[0] + w * v[2]];
        const uuv = [y * uv[2] - z * uv[1], z * uv[0] - x * uv[2], x * uv[1] - y * uv[0]];
        return [v[0] + 2 * uuv[0], v[1] + 2 * uuv[1], v[2] + 2 * uuv[2]].map(a => +a.toFixed(3));
      };
      const qh0 = window.__mpWorldQuat('hips');
      return {
        headForward: qrot(qh, [0, 0, -1]),
        hipsForward: qrot(qh0, [0, 0, -1]),
        chestToHead: dir('chest', 'head'),
        hipToKneeL: dir('hips', 'kneeL'),
        kneeToFootL: dir('kneeL', 'footL'),
        footToToeL: dir('footL', 'leftToes'),
        footToToeR: dir('footR', 'rightToes'),
        footToAnkleL: dir('kneeL', 'footL'),
        hands: [P('handL'), P('handR')],
        hipsW: P('hips'),
      };
    });
    console.log(JSON.stringify(out, null, 1));
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) });
