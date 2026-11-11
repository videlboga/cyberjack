const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
(async () => {
  const [url, out] = process.argv.slice(2);
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,pipe:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:1300,height:900}});
  try {
    const page = await browser.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
    await page.goto(url,{waitUntil:'load'});
    await page.waitForFunction(()=>window.__studio&&window.__studio.ready===true,{timeout:240000});
    const res = await page.evaluate(async ()=>{
      const ws = window.__studio.workspace;
      if(!ws) return {error:'no workspace'};
      const keys = (ws.catalog||[]).filter(r=>r.kind==='skp').slice(0,3).map(r=>r.key);
      let added=null;
      try { added = await ws.addObject('skp:SexMachineModel-080'); } catch(e) { return {error:e.message, keys}; }
      return {keys, added: !!added, objects: ws.objects?.length};
    });
    await new Promise(r=>setTimeout(r,1500));
    await page.evaluate(()=>{const s=window.__studio;s.controls.target.set(0,1,0);s.camera.position.set(2.2,1.6,2.2);s.controls.update();s.renderNow();});
    await new Promise(r=>setTimeout(r,500));
    await page.screenshot({path:out});
    console.log(JSON.stringify(res),'| errors',JSON.stringify(errs));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
