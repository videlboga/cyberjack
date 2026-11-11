// Material-based face probe: which way do the face materials (eye/face/nose/mouth) sit relative to the head bone?
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
    const out = await page.evaluate(() => window.__mpFaceProbe());
    console.log(JSON.stringify(out, null, 1));
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) });
