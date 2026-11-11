const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,pipe:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:1200,height:850}});
  try {
    const page = await browser.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>errs.push(m.type()+': '+m.text().slice(0,160)));
    await page.goto('http://127.0.0.1:8766/vrm_view.html?vrm='+encodeURIComponent('models/x20/outfits/Rin_outfit_03.vrm'),{waitUntil:'load'});
    await page.waitForFunction(()=>window.__studio&&window.__studio.ready===true,{timeout:240000});
    await page.evaluate(()=>window.__studio.poseEditor.enable(true));
    await sleep(700);
    const setBone = async () => page.evaluate(()=>{const b=document.querySelector('.pe-bone');b.value='__root';b.dispatchEvent(new Event('change'));});
    const seek = async t => page.evaluate(t=>{const el=document.querySelector('.pe-time');el.value=String(t);el.dispatchEvent(new Event('input'));},t);
    const key = async () => page.evaluate(()=>document.querySelector('.pe-key').click());
    await page.evaluate(()=>{const m=document.querySelector('.pe-mode');m.value='translate';m.dispatchEvent(new Event('change'));const sp=document.querySelector('.pe-space');if(sp){sp.value='local';sp.dispatchEvent(new Event('change'));}});
    await setBone(); await sleep(200);
    await seek(0); await sleep(200); await key(); await sleep(300);
    await seek(1); await sleep(300);
    const before = await page.evaluate(()=>({x:Number(document.querySelector('.pe-x').value)}));
    await page.evaluate(()=>{const x=document.querySelector('.pe-x');x.value=String(Number(x.value)+0.5);x.dispatchEvent(new Event('input'));});
    await sleep(600);
    await key(); await sleep(400);
    const out = await page.evaluate(()=>{
      const doc=window.__studio.poseEditor.exportProject();
      const keys=(doc.keys||[]).map(k=>{const ids=Object.keys(k.poses||{});const r=ids.length?k.poses[ids[0]].root:null;return {t:+k.time.toFixed(2),rootX:r&&r.p?+r.p[0].toFixed(3):null};});
      const live=window.__studio.vrm.scene.position.x;
      return {keys, liveX:+live.toFixed(3), timeline:document.querySelectorAll('.pe-keys button').length};
    });
    console.log('до сдвига x=',before.x,JSON.stringify(out));console.log('LOGS', JSON.stringify(errs.slice(-12)));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
