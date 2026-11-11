// Screenshot the studio with the machine backdrop + a chosen clip frame.
// Usage: node studio_machine.cjs <url> <clipId> <time> <out.png> [camAz] [camEl]
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
(async () => {
  const [base, clipId, t, out] = process.argv.slice(2);
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,pipe:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:1300,height:900}});
  try {
    const page = await browser.newPage();
    const errs=[]; page.on('pageerror',e=>errs.push(e.message));
    await page.goto(base,{waitUntil:'load'});
    await page.waitForFunction(()=>window.__studio&&window.__studio.ready===true,{timeout:240000});
    await page.waitForFunction(()=>window.__studio.machineBackdrop,{timeout:120000}).catch(()=>{});
    if (clipId && clipId !== 'none') {
      await page.waitForFunction(()=>window.__studio.library&&window.__studio.library.selectClip,{timeout:120000});
      await page.evaluate(async (id,tt)=>{await window.__studio.library.selectClip(id);window.__studio.setPlaying(false);window.__studio.sampleBody(tt);},clipId,parseFloat(t||'0.6'));
    }
    await new Promise(r=>setTimeout(r,1500));
    await page.evaluate(()=>{const s=window.__studio;const v=s.vrm;v.scene.updateMatrixWorld(true);const cam=s.camera,ctrl=s.controls;const hips=v.humanoid.getNormalizedBoneNode('hips').getWorldPosition(new (v.scene.position.constructor)());ctrl.target.copy(hips.clone().add(new (v.scene.position.constructor)(0,0.15,0)));cam.position.copy(ctrl.target).add(new (v.scene.position.constructor)(1.6,0.9,1.6));ctrl.update();s.renderNow();});
    await new Promise(r=>setTimeout(r,600));
    await page.screenshot({path:out});
    console.log('shot',out,'| errors',JSON.stringify(errs));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
