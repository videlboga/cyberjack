const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
(async () => {
  const [base, mrot] = process.argv.slice(2);
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,pipe:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:1100,height:800}});
  try {
    const page = await browser.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
    await page.goto(`${base}?vrm=${encodeURIComponent('models/x20/outfits/Rin_outfit_03.vrm')}&machine=080&msm=0.74&mrot=${mrot}`,{waitUntil:'load'});
    await page.waitForFunction(()=>window.__studio&&window.__studio.ready===true,{timeout:240000});
    await page.waitForFunction(()=>window.__machineDebug,{timeout:120000}).catch(()=>{});
    await new Promise(r=>setTimeout(r,1200));
    const d = await page.evaluate(()=>window.__machineDebug?window.__machineDebug():null);
    console.log(JSON.stringify(d), '| errors', JSON.stringify(errs));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
