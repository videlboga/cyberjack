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
    await sleep(900);
    const info = await page.evaluate(()=>{
      const q=s=>document.querySelector(s), pe=window.__studio.poseEditor, d=pe.__debug();
      const b=q('.pe-bone'); b.value='__root'; b.dispatchEvent(new Event('change'));
      const m=q('.pe-mode'); m.value='translate'; m.dispatchEvent(new Event('change'));
      const helper=d.gizmo.getHelper?d.gizmo.getHelper():d.gizmo;
      const s=window.__studio, canvas=s.renderer.domElement;
      const V=helper.position.constructor, cam=s.camera;
      const pick=[];
      helper.traverse(o=>{ if(o.name && /^(X|Y|Z|XYZ)$/.test(o.name)) pick.push(o); });
      const out=[];
      for(const o of pick.slice(0,6)){
        const p=new V(); o.getWorldPosition(p); p.project(cam);
        out.push({name:o.name, vis:o.visible,
          x:Math.round((p.x*0.5+0.5)*canvas.clientWidth), y:Math.round((-p.y*0.5+0.5)*canvas.clientHeight)});
      }
      return {handles:out, canvas:{w:canvas.clientWidth,h:canvas.clientHeight}, rootX:+d.record().vrm.scene.position.x.toFixed(3)};
    });
    console.log('HANDLES',JSON.stringify(info));
    const h=info.handles.find(x=>x.name==='X'&&x.vis)||info.handles[0];
    let moved=null;
    if(h){
      await page.mouse.move(h.x,h.y); await page.mouse.down();
      for(let i=1;i<=6;i++){await page.mouse.move(h.x+i*12,h.y); await sleep(30);}
      await page.mouse.up(); await sleep(300);
      moved = await page.evaluate(()=>{
        const d=window.__studio.poseEditor.__debug();
        return {rootX:+d.record().vrm.scene.position.x.toFixed(3),
          keys:d.frames.map(k=>{const t=k.poses&&k.poses[d.actorId]&&k.poses[d.actorId].root;return t?+t.p[0].toFixed(3):null;})};
      });
    }
    console.log('AFTER DRAG',JSON.stringify(moved),'LOGS',JSON.stringify(logs.slice(-3)));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
