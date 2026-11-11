const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
(async () => {
  const [url, out] = process.argv.slice(2);
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,pipe:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:1300,height:900}});
  try {
    const page = await browser.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
    await page.goto(url,{waitUntil:'load'});
    await page.waitForFunction(()=>window.__studio&&window.__studio.ready===true,{timeout:240000});
    await page.waitForFunction(()=>window.__machinePostUpdate,{timeout:120000}).catch(()=>{});
    await new Promise(r=>setTimeout(r,1500));
    await page.evaluate(()=>{const s=window.__studio,v=s.vrm;v.scene.updateMatrixWorld(true);
      const h=v.humanoid.getNormalizedBoneNode('hips').getWorldPosition(new (v.scene.position.constructor)());
      s.controls.target.copy(h);s.camera.position.set(h.x+1.5,h.y+0.55,h.z+1.5);s.controls.update();s.renderNow();});
    await new Promise(r=>setTimeout(r,700));
    await page.screenshot({path:out});
    const dbg=await page.evaluate(()=>({ticks:window.__machineTicks||0,pose:window.__studio?!!window.__studio.vrm:false}));console.log('shot',out,'| ticks',dbg.ticks,'| errors',JSON.stringify(errs));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
