const puppeteer = require('/home/cyberkitty/.npm/_npx/e65ceaa76006e709/node_modules/puppeteer-core');
(async () => {
  const b = await puppeteer.launch({executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']});
  try {
    const p = await b.newPage(), errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.setViewport({width: 1500, height: 1050});
    await p.setRequestInterception(true);
    p.on('request', (r) => r.url().includes('/api/motion-library/hentai-review') && r.method() === 'POST' ? r.respond({status: 200, contentType: 'application/json', body: r.postData()}) : r.continue());
    await p.goto('http://127.0.0.1:8782/motion-library.html', {waitUntil: 'networkidle0', timeout: 120000});
    await p.waitForFunction(() => document.querySelectorAll('#hbase option').length > 3, {timeout: 120000});
    await p.waitForFunction(() => document.querySelectorAll('#results article').length > 0, {timeout: 120000});
    const overview = await p.$eval('#overview', (e) => e.textContent);
    if (!overview.includes('Слой описаний H')) throw Error('Слой описаний не показан в шапке');

    await p.select('#hbase', 'lying');
    await p.select('#hact', 'intercourse');
    await p.waitForFunction(() => document.querySelector('#status').textContent.includes('кандидатов'), {timeout: 120000});
    const status = await p.$eval('#status', (e) => e.textContent);
    if (!/кандидатов/.test(status)) throw Error('Фильтр H не вернул статус: ' + status);
    await p.waitForFunction(() => [...document.querySelectorAll('#results article')].every((a) => a.querySelector('.hentai-line')), {timeout: 30000});
    const line = await p.$eval('#results article .hentai-line', (e) => e.textContent);
    if (!line.includes('Что происходит')) throw Error('В карточке нет строки описания');

    await p.click('#results article button');
    await p.waitForFunction(() => document.querySelector('#detail .hentai'), {timeout: 60000});
    const block = await p.$eval('#detail .hentai', (e) => e.textContent);
    for (const needle of ['Сцена «', 'Фаза:', 'Измерено:', 'Не определено:']) if (!block.includes(needle)) throw Error('В блоке описания нет «' + needle + '»: ' + block.slice(0, 200));
    if (!block.includes('По всей сцене')) throw Error('Нет статистики сцены');

    await p.select('#hentai-base', 'seated');
    await p.select('#hentai-act', 'oral');
    await p.$eval('#hentai-note', (e) => {e.value = 'QA intercepted';});
    await p.click('#hentai-save');
    await p.waitForFunction(() => document.querySelector('#detail').textContent.includes('Сохранено. Описание'), {timeout: 30000});

    await p.select('#hphase', 'loop-s');
    await p.waitForFunction(() => document.querySelectorAll('#results article').length > 0, {timeout: 60000});
    await p.screenshot({path: __dirname + '/../data/hentai-library-ui.png', fullPage: true});
    if (errors.length) throw Error(errors.join('\n'));
    console.log('PASS hentai layer browser:', overview.split('Слой описаний H:')[1]?.split('.')[0]?.trim());
    console.log('card:', line.slice(0, 120));
    console.log('detail:', block.replace(/\s+/g, ' ').slice(0, 320));
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
