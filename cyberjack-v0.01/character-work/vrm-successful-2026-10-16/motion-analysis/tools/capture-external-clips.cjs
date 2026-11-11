// Снимаем пилотные внешние клипы покадрово с VRM (Mira) → PNG-секвенция для ffmpeg.
// Запуск: node tools/capture-external-clips.cjs [url] [frames] [outDir]
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('/home/cyberkitty/.npm/_npx/e65ceaa76006e709/node_modules/puppeteer-core');

const url = process.argv[2] || 'http://127.0.0.1:8799/motion-analysis/qa-external-clips.html';
const frames = Number(process.argv[3] || 122);
const outDir = process.argv[4] || '/tmp/clips-frames';

(async () => {
  fs.rmSync(outDir, {recursive: true, force: true});
  fs.mkdirSync(outDir, {recursive: true});
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewport({width: 980, height: 1400, deviceScaleFactor: 1});
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 120000});
    await page.waitForFunction('window.__clips && window.__clips.ready', {timeout: 180000});
    const info = await page.evaluate(() => ({duration: window.__clips.duration, bones: window.__clips.bones, labels: window.__clips.labels}));
    console.log('клипы:', info.labels.join(' | '), '| костей на VRM:', info.bones, '| длительность:', info.duration);
    const fps = 30;
    for (let i = 0; i < frames; i++) {
      const t = (i % Math.round(info.duration * fps)) / fps;
      await page.evaluate(tt => window.__clips.seek(tt), t);
      await page.screenshot({path: path.join(outDir, String(i).padStart(4, '0') + '.png')});
      if (i % 20 === 0) process.stdout.write(`\rкадр ${i}/${frames}`);
    }
    process.stdout.write(`\rкадр ${frames}/${frames}\n`);
    if (errors.length) console.log('ошибки страницы:', errors.slice(0, 5));
    console.log('готово:', outDir);
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
