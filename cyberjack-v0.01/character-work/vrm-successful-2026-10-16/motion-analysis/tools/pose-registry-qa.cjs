const puppeteer = require('/home/cyberkitty/.npm/_npx/e65ceaa76006e709/node_modules/puppeteer-core');
const BASE = 'http://127.0.0.1:5174';
const CASES = [
  ['pose_all_fours', 'Base_all_fours'],
  ['pose_kneeling', 'Base_kneeling'],
  ['pose_spread_eagle', 'Base_spread_eagle'],
  ['act_present_feet', 'Base_feet'],
  ['pose_sitting', 'Base_sitting'],
  ['pose_lying_down', 'Base_lying'],
];
(async () => {
  const browser = await puppeteer.launch({executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const results = [];
  try {
    for (const [pose, expected] of CASES) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setViewport({width: 900, height: 800});
      await page.goto(BASE + '/vrm-stage/qa-harness.html?pose=' + pose, {waitUntil: 'domcontentloaded', timeout: 120000});
      await page.waitForFunction(() => {
        const t = document.querySelector('#out')?.textContent || '';
        return t.includes('"clip"') || t.includes('"error"');
      }, {timeout: 240000, polling: 1000});
      const raw = await page.$eval('#out', (e) => e.textContent);
      let state = {};
      try { state = JSON.parse(raw); } catch { state = {raw}; }
      results.push({pose, expected, clip: state.clip, ready: state.ready, errors});
      await page.close();
    }
  } finally {
    await browser.close();
  }
  let failed = 0;
  for (const r of results) {
    const ok = r.clip === r.expected && !r.errors.length;
    if (!ok) failed++;
    console.log((ok ? 'ok  ' : 'FAIL') + ' ' + r.pose.padEnd(20) + ' clip=' + r.clip + ' (ожидался ' + r.expected + ')' + (r.errors.length ? ' errors=' + r.errors.join(' | ') : ''));
  }
  console.log(failed ? 'FAILED ' + failed : 'PASS all ' + results.length + ' poses drive the expected stage clip');
  process.exitCode = failed ? 1 : 0;
})();
