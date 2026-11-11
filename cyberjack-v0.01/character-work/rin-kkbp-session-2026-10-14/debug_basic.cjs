const PUP = '/home/cyberkitty/.npm/_npx/e65ceaa76006e709/node_modules/puppeteer-core';
const puppeteer = require(PUP);
const D = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14';
const PAGE = 'file:///home/cyberkitty/Projects/control-room/dashboard-frontend/vrm_accept.html';
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox','--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader'],
    defaultViewport: { width: 700, height: 1050 } });
  const page = await browser.newPage();
  await page.goto(PAGE + '?vrm=' + encodeURIComponent(D + '/Rin_MMD_v6.vrm') + '&debug=basic&rot=180', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.title.includes('READY') || document.title.includes('LOAD'), { timeout: 300000 });
  await page.screenshot({ path: D + '/debug_basic.png' });
  console.log('title:', await page.title());
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });