// Probe machine_pose.html scene state
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
(async () => {
  const url = process.argv[2];
  const browser = await puppeteer.launch({
    executablePath: process.env.BROWSER_BIN || '/usr/bin/chromium', headless: true, pipe: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
    defaultViewport: { width: 1200, height: 900 }
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__mp && (window.__mp.ready || window.__mp.error), { timeout: 240000 });
    const state = await page.evaluate(() => {
      const root = document.querySelector('main canvas');
      return window.__mp.debugProbe ? window.__mp.debugProbe() : { note: 'no debugProbe' };
    });
    console.log(JSON.stringify({ state, errors }, null, 1));
  } finally { await browser.close() }
})().catch(e => { console.error('FAIL', e); process.exit(1) });