const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,pipe:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:1200,height:850}});
  try {
    const page = await browser.newPage(); const logs=[];
    page.on('pageerror',e=>logs.push('ERR '+e.message)); page.on('console',m=>logs.push(m.type()+': '+m.text().slice(0,160)));
    await page.goto('http://127.0.0.1:8766/vrm_view.html?vrm='+encodeURIComponent('models/x20/outfits/Rin_outfit_03.vrm'),{waitUntil:'load'});
    await page.waitForFunction(()=>window.__studio&&window.__studio.ready===true,{timeout:240000});
    await page.evaluate(()=>window.__studio.poseEditor.enable(true));
    await sleep(700);
    const out = await page.evaluate(async ()=>{
      const q=s=>document.querySelector(s), pe=window.__studio.poseEditor, d=pe.__debug();
      const b=q('.pe-bone'); b.value='__root'; b.dispatchEvent(new Event('change'));
      const seek=t=>{const el=q('.pe-time');el.value=String(t);el.dispatchEvent(new Event('input'));};
      const snap=()=>d.frames.map(k=>{const ids=Object.keys(k.poses||{});const r=ids.length?k.poses[ids[0]].root:null;return {t:+k.time.toFixed(2),x:r&&r.p?+r.p[0].toFixed(3):null,w:r&&r.q?+r.q[3].toFixed(4):null};});
      const drag=(mutator,run)=>{
        d.gizmo.dragging=true; d.gizmo.dispatchEvent({type:'dragging-changed',value:true});
        mutator(); d.proxy.updateMatrixWorld(true);
        d.gizmo.dispatchEvent({type:'objectChange'});
        d.gizmo.dragging=false; d.gizmo.dispatchEvent({type:'dragging-changed',value:false});
      };
      seek(0); q('.pe-key').click(); seek(1); q('.pe-key').click();
      const mode=q('.pe-mode'); mode.value='translate'; mode.dispatchEvent(new Event('change'));
      await new Promise(r=>setTimeout(r,50));
      const before=snap();
      drag(()=>{d.proxy.position.x+=0.5;});
      const afterMove=snap();
      mode.value='rotate'; mode.dispatchEvent(new Event('change'));
      await new Promise(r=>setTimeout(r,50));
      drag(()=>{const E=d.proxy.rotation.constructor;d.proxy.quaternion.setFromEuler(new E(0,0.5236,0));});
      const afterRot=snap();
      // страховка: сдвиг БЕЗ событий гизмо, потом переход по времени
      d.record().vrm.scene.position.x+=0.25;
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const afterFrame=snap();
      return {before, afterMove, afterRot, afterFrame, rootX:+d.record().vrm.scene.position.x.toFixed(3)};
    });
    console.log(JSON.stringify(out,null,1));
    console.log('LOGS',JSON.stringify(logs.filter(l=>!l.includes('WebGL')).slice(-5)));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
