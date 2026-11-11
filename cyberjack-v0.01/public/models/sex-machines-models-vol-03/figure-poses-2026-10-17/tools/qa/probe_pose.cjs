// Numeric probe of machine_pose.html: VRM bone world positions vs the target landmarks.
// Usage: node probe_pose.cjs <url> <machine> [char]
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
(async () => {
  const base = process.argv[2];
  const mid = process.argv[3];
  const char = process.argv[4] || 'x20/outfits/Rin_outfit_00.vrm';
  const browser = await puppeteer.launch({
    executablePath: process.env.BROWSER_BIN || '/usr/bin/chromium', headless: true, pipe: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
    defaultViewport: { width: 1200, height: 900 }
  });
  try {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(`${base}?machine=${mid}&char=${encodeURIComponent(char)}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__mp && window.__mp.ready === true, { timeout: 240000 });
    const out = await page.evaluate(() => {
      const d = window.__mp.debugProbe();
      const vrm = window.__mp_vrm || null;
      return d;
    });
    const pose = await page.evaluate(() => null);
    console.log(JSON.stringify(out, null, 1));
    console.log('errors', JSON.stringify(errs));
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) });
