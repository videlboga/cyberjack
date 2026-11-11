// QA harness for machine_pose.html: opens a page per machine/char, waits for ready and takes screenshots.
// Usage: node check_machine_pose.cjs <hostUrlBase> <outDir> <machine=char[,char2]> [...]
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
(async () => {
  const base = process.argv[2] || 'http://127.0.0.1:8766/machine_pose.html';
  const outDir = process.argv[3] || '.';
  const pairs = process.argv.slice(4); // e.g. "065=x20/outfits/Rin_outfit_00.vrm" or "065"
  const browser = await puppeteer.launch({
    executablePath: process.env.BROWSER_BIN || '/usr/bin/chromium', headless: true, pipe: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
    defaultViewport: { width: 1400, height: 1000 }
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const pair of pairs) {
      let [mid, char = 'x20/outfits/Rin_outfit_00.vrm'] = pair.split('=');
      char = char.replace(/^\.\//, '');
      const shots = JSON.parse(process.env.SHOTS_JSON || 'null') || [
        [35, 18, 2.2], [35, 55, 2.0], [125, 18, 2.2]];
      for (let i = 0; i < shots.length; i++) {
        const [az, el, dist] = shots[i];
        const extra = process.env.EXTRA_QS || '';
        const url = `${base}?machine=${mid}&char=${encodeURIComponent(char)}&camaz=${az}&camel=${el}&camdist=${dist}${extra ? '&' + extra : ''}`;
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__mp && window.__mp.ready === true, { timeout: 240000 });
        await page.evaluate(async (az, el, dist) => { window.__mp.setCam(az, el, dist); }, az, el, dist);
        await new Promise(r => setTimeout(r, 900));
        const file = `${outDir}/mp-${mid}-${i}${char.includes('Rin') ? '' : '-' + char.split('/').pop().replace(/\.vrm$/, '')}.png`;
        await page.screenshot({ path: file });
        console.log('shot', file);
        const st = await page.evaluate(() => document.querySelector('#status').textContent);
        console.log('  status:', st.split('\n')[0]);
      }
    }
    console.log(JSON.stringify({ errors }));
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) });