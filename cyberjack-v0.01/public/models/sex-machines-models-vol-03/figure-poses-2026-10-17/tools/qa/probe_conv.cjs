const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
(async () => {
  const base = process.argv[2], mid = process.argv[3];
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,pipe:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:900,height:700}});
  try {
    const page = await browser.newPage();
    await page.goto(`${base}?machine=${mid}&char=${encodeURIComponent('x20/outfits/Rin_outfit_03.vrm')}`,{waitUntil:'load'});
    await page.waitForFunction(()=>window.__mp&&window.__mp.ready===true,{timeout:240000});
    const out = await page.evaluate(() => ({
      arm: window.__mpConvTest('leftUpperArm', 30),
      leg: window.__mpConvTest('leftUpperLeg', 30),
    }));
    console.log(JSON.stringify(out, null, 1));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
