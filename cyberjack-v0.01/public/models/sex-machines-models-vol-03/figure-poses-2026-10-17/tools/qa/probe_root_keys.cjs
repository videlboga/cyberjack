const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,pipe:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:1200,height:850}});
  try {
    const page = await browser.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
    await page.goto('http://127.0.0.1:8766/vrm_view.html?vrm='+encodeURIComponent('models/x20/outfits/Rin_outfit_03.vrm'),{waitUntil:'load'});
    await page.waitForFunction(()=>window.__studio&&window.__studio.ready===true,{timeout:240000});
    await page.evaluate(()=>window.__studio.poseEditor.enable(true));
    await sleep(600);
    // ключ на 0 с
    await page.evaluate(()=>{const q=s=>document.querySelector(s);const bs=q('.pe-bone');bs.value='__root';bs.dispatchEvent(new Event('change'));});
    await sleep(200);
    await page.evaluate(()=>document.querySelector('.pe-key').click());
    await sleep(300);
    // на 1 с
    await page.evaluate(()=>{const t=document.querySelector('.pe-time');t.value='1';t.dispatchEvent(new Event('change'));});
    await sleep(300);
    // сдвиг всей модели на +0.5 по X
    const before = await page.evaluate(()=>{const x=document.querySelector('.pe-x');return Number(x.value)});
    await page.evaluate(()=>{const x=document.querySelector('.pe-x');x.value=String(Number(x.value)+0.5);x.dispatchEvent(new Event('input'));});
    await sleep(500);
    await page.evaluate(()=>document.querySelector('.pe-key').click());
    await sleep(400);
    const out = await page.evaluate(()=>{
      const pe=window.__studio.poseEditor; const doc=pe.exportProject();
      const tl=document.querySelectorAll('.pe-keys button').length;
      const keyBtn=document.querySelector('.pe-key');
      window.__dbg={tl, disabled:keyBtn?.disabled, keys:Object.keys(doc), sample:(doc.frames||[]).slice(0,1)};
      const frames=(doc.keys||[]).map(f=>{const ids=Object.keys(f.poses||{});const r=ids.length?f.poses[ids[0]].root:null;return {t:+f.time.toFixed(2),p:r&&r.p?r.p.map(v=>+v.toFixed(3)):null};});
      return {frames, tl, disabled:keyBtn?.disabled, docKeys:Object.keys(doc), sample:JSON.stringify((doc.frames||[])[0]||null).slice(0,220)};
    });
    console.log('root.x до сдвига:', before, JSON.stringify(out),'| errors',JSON.stringify(errs));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
