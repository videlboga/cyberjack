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
      const q=s=>document.querySelector(s), pe=window.__studio.poseEditor;
      const b=q('.pe-bone'); b.value='__root'; b.dispatchEvent(new Event('change'));
      const seek=t=>{const el=q('.pe-time');el.value=String(t);el.dispatchEvent(new Event('input'));};
      seek(0); q('.pe-key').click(); seek(1); q('.pe-key').click();
      const d=pe.__debug();
      const snap=()=>d.frames.map(k=>{const ids=Object.keys(k.poses||{});const r=ids.length?k.poses[ids[0]].root:null;return {t:+k.time.toFixed(2),x:r&&r.p?+r.p[0].toFixed(3):null};});
      const before={sel:d.selected, actor:d.actorId, keys:snap(), rootX:+d.record().vrm.scene.position.x.toFixed(3)};
      // === эмуляция перетаскивания гизмо ===
      d.gizmo.dragging=true; d.gizmo.dispatchEvent({type:'dragging-changed',value:true});
      const hasDragStart=!!d.dragStart;
      const diag={draggingAfterSet:d.gizmo.dragging, mode:q('.pe-mode').value, active:pe.active,
        proxyWorld:[+d.proxy.position.x.toFixed(2),+d.proxy.position.y.toFixed(2),+d.proxy.position.z.toFixed(2)],
        rootPosParent:d.record().vrm.scene.parent?.type||null};
      d.proxy.position.x+=0.5; d.proxy.updateMatrixWorld(true);
      d.gizmo.dispatchEvent({type:'objectChange'});
      d.gizmo.dragging=false; d.gizmo.dispatchEvent({type:'dragging-changed',value:false});
      const after={keys:snap(), rootX:+d.record().vrm.scene.position.x.toFixed(3), hasDragStart};
      return {before, after, diag};
    });
    console.log(JSON.stringify(out,null,1));
    console.log('LOGS',JSON.stringify(logs.filter(l=>!l.includes('WebGL')).slice(-6)));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
