// Acceptance screenshots via puppeteer-core waiting for READY title.
const path = require('path');
const PUP = '/home/cyberkitty/.npm/_npx/e65ceaa76006e709/node_modules/puppeteer-core';
const puppeteer = require(PUP);

const PAGE = 'file:///home/cyberkitty/Projects/control-room/dashboard-frontend/vrm_accept.html';
const D = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14';
const VRM = D + '/Rin_Hybrid_v12.vrm';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--allow-file-access-from-files',
           '--use-gl=angle', '--use-angle=swiftshader'],
    defaultViewport: { width: 700, height: 1050 },
  });
  for (const [rot, name] of [['180', 'rin2_front.png'], ['215', 'rin2_threeq.png']]) {
    const page = await browser.newPage();
    await page.goto(`${PAGE}?vrm=${encodeURIComponent(VRM)}&rot=${rot}`,
                    { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.title.includes('READY'),
                               { timeout: 300000 });
    await page.screenshot({ path: path.join(D, name) });
    console.log('shot', name);
    await page.close();
  }
  await browser.close();
  console.log('SHOTS_DONE');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });