const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,pipe:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:1200,height:850}});
  try {
    const page = await browser.newPage(); const logs=[];
    page.on('pageerror',e=>logs.push('ERR '+e.message)); page.on('console',m=>logs.push(m.type()+': '+m.text().slice(0,140)));
    await page.goto('http://127.0.0.1:8766/vrm_view.html?vrm='+encodeURIComponent('models/x20/outfits/Rin_outfit_03.vrm'),{waitUntil:'load'});
    await page.waitForFunction(()=>window.__studio&&window.__studio.ready===true,{timeout:240000});
    await page.evaluate(()=>window.__studio.poseEditor.enable(true));
    await sleep(700);
    const out = await page.evaluate(async ()=>{
      const q=s=>document.querySelector(s), pe=window.__studio.poseEditor, d=pe.__debug();
      const seek=t=>{const el=q('.pe-time');el.value=String(t);el.dispatchEvent(new Event('input'));};
      const bone='leftLowerArm', id=d.record().human[bone];
      const snap=()=>d.frames.map(k=>{const t=k.poses&&k.poses[d.actorId]&&k.poses[d.actorId].nodes[id];return {t:+k.time.toFixed(2),x:t?+t.q[0].toFixed(4):null,y:t?+t.q[1].toFixed(4):null,z:t?+t.q[2].toFixed(4):null};});
      const b=q('.pe-bone'); b.value=bone; b.dispatchEvent(new Event('change'));
      const m=q('.pe-mode'); m.value='rotate'; m.dispatchEvent(new Event('change'));
      seek(0); q('.pe-key').click(); seek(1); q('.pe-key').click();
      const before=snap();
      const x=q('.pe-x'); x.value=String(Number(x.value)+20); x.dispatchEvent(new Event('input'));
      await new Promise(r=>setTimeout(r,600));
      const after=snap();
      const toggle=!!q('.pe-all'), toggleOn=q('.pe-all')?.checked;
      // возврат на ключ 0: поза должна вернуться к значению ключа 0, без «размазывания»
      seek(0); await new Promise(r=>setTimeout(r,300));
      const back={live:+d.record().nodes.get(id).quaternion.x.toFixed(4), key0:before[0].x};
      return {bone, id, before, after, toggle, toggleOn, back, liveX:+d.record().nodes.get(id).quaternion.x.toFixed(4)};
    });
    console.log(JSON.stringify(out,null,1));
    console.log('LOGS',JSON.stringify(logs.filter(l=>!l.includes('WebGL')).slice(-4)));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
