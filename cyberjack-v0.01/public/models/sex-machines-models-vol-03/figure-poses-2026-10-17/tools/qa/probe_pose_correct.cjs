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
    await page.evaluate(()=>window.__studio.poseEditor.enable(true));
    await sleep(700);
    const out = await page.evaluate(async ()=>{
      const q=s=>document.querySelector(s), pe=window.__studio.poseEditor, d=pe.__debug(), r=d.record();
      const seek=t=>{const el=q('.pe-time');el.value=String(t);el.dispatchEvent(new Event('input'));};
      const b=q('.pe-bone'); b.value='leftLowerArm'; b.dispatchEvent(new Event('change'));
      const m=q('.pe-mode'); m.value='rotate'; m.dispatchEvent(new Event('change'));
      seek(0); q('.pe-key').click();
      // правка на ключе 0
      const x=q('.pe-x'); x.value=String(Number(x.value)+25); x.dispatchEvent(new Event('input'));
      await new Promise(res=>setTimeout(res,500));
      q('.pe-key').click();
      seek(1); q('.pe-key').click();
      // правка на ключе 1 (другая)
      const x2=q('.pe-x'); x2.value=String(Number(x2.value)+25); x2.dispatchEvent(new Event('input'));
      await new Promise(res=>setTimeout(res,500));
      q('.pe-key').click();
      // проверяем: на каждом ключе живые кости = значения ключа
      const report=[];
      for(const t of [0,1]){
        seek(t); await new Promise(res=>setTimeout(res,250));
        let maxd=0, worst=null;
        for(const [id,node] of r.nodes){
          for(const key of d.frames){
            if(Math.abs(key.time-t)>0.01) continue;
            const st=key.poses[d.actorId]?.nodes?.[id];
            if(!st) continue;
            const cur=node.quaternion;
            const dq=Math.max(Math.abs(cur.x-st.q[0]),Math.abs(cur.y-st.q[1]),Math.abs(cur.z-st.q[2]),Math.abs(cur.w-st.q[3]));
            if(dq>maxd){maxd=dq;worst=id;}
          }
        }
        report.push({t, keys:d.frames.length, maxDeviation:+maxd.toFixed(5), worst});
      }
      return {report, toggled:q('.pe-all')?.checked};
    });
    console.log(JSON.stringify(out),'LOGS',JSON.stringify(logs.slice(-3)));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
