const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,pipe:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:1200,height:850}});
  try {
    const page = await browser.newPage(); const logs=[];
    page.on('pageerror',e=>logs.push('ERR '+e.message));
    await page.goto('http://127.0.0.1:8766/vrm_view.html?vrm='+encodeURIComponent('models/x20/outfits/Rin_outfit_03.vrm'),{waitUntil:'load'});
    await page.waitForFunction(()=>window.__studio&&window.__studio.ready===true,{timeout:240000});
    await sleep(1500);
    const state = await page.evaluate(()=>{
      const s=window.__studio;
      s.setPose('Idle_00_00',false); s.step(0.3);
      const h=s.vrm.humanoid.getRawBoneNode('hips').getWorldPosition(new (s.scene.position.constructor)());
      s.controls.target.copy(h); s.camera.position.set(h.x+1.6,h.y+0.6,h.z+1.6); s.controls.update(); s.renderNow();
      return {pose:s.state.pose, editorActive:!!document.querySelector('.pe-enable')?.checked};
    });
    await sleep(500); await page.screenshot({path:process.argv[2]+'-clips.png'});
    await page.evaluate(()=>{const s=window.__studio;s.poseEditor.enable(true);});
    await sleep(1200);
    await page.evaluate(()=>{const s=window.__studio;s.step(0.2);s.renderNow();});
    await sleep(400); await page.screenshot({path:process.argv[2]+'-editor.png'});
    console.log(JSON.stringify(state),'LOGS',JSON.stringify(logs.slice(-3)));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
