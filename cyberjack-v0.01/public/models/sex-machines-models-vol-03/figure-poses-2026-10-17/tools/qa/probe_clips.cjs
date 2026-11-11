const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,pipe:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:1300,height:900}});
  try {
    const page = await browser.newPage(); const logs=[];
    page.on('pageerror',e=>logs.push('ERR '+e.message));
    await page.goto('http://127.0.0.1:8766/vrm_view.html?vrm='+encodeURIComponent('models/x20/outfits/Rin_outfit_03.vrm'),{waitUntil:'load'});
    await page.waitForFunction(()=>window.__studio&&window.__studio.ready===true,{timeout:240000});
    await sleep(1200);
    const out = await page.evaluate(async ()=>{
      const s=window.__studio, v=s.vrm, THREE=s.scene.position.constructor;
      const names=['hips','head','leftHand','rightHand','leftFoot','rightFoot'];
      const rows=[];
      const ids=(s.library?[]:[]);
      const clips=[...document.querySelectorAll('#pose-list .pose-card')].map(b=>b.dataset.pose);
      for(const id of clips.slice(0,10)){
        try{ s.setPose(id,false); s.step(0.15); }catch(e){ rows.push({id,err:e.message}); continue; }
        v.scene.updateMatrixWorld(true);
        let nan=0, span={min:1e9,max:-1e9};
        const pts={};
        for(const n of names){const b=v.humanoid.getRawBoneNode(n); if(!b){continue;} const p=b.getWorldPosition(new THREE()); if(!Number.isFinite(p.x+p.y+p.z))nan++; pts[n]=[+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)];}
        rows.push({id, nan, hipsY:pts.hips?pts.hips[1]:null, headY:pts.head?pts.head[1]:null, handL:pts.leftHand, footY:pts.leftFoot?pts.leftFoot[1]:null});
      }
      return rows;
    });
    console.log(JSON.stringify(out,null,1).slice(0,2400));
    console.log('LOGS',JSON.stringify(logs.slice(-3)));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
