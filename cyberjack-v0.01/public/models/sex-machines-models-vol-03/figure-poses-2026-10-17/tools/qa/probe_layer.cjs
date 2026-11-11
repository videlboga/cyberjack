const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
(async () => {
  const [base, mid] = process.argv.slice(2);
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,pipe:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:1000,height:800}});
  try {
    const page = await browser.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
    await page.goto(`${base}?machine=${mid}&char=${encodeURIComponent('x20/outfits/Rin_outfit_03.vrm')}&ghost=0&layer=layer68-full.json`,{waitUntil:'load'});
    await page.waitForFunction(()=>window.__mp&&window.__mp.ready===true,{timeout:240000});
    const sample = async (lx, ly) => page.evaluate((lx,ly)=>{
      for (const [id,v] of [['lx',lx],['ly',ly]]) { const el=document.querySelector('#'+id); if(el){el.value=v; el.dispatchEvent(new Event('input'));} }
      const pos = window.__mpNodePosByName('cf_s_siri_L');
      const q = window.__mpNodeQuatByName ? window.__mpNodeQuatByName('cf_j_siri_L') : null;
      const hips = window.__mpBonePos('hips');
      return {pos, q, hips, info: document.querySelector('#layerinfo')?.textContent};
    }, lx, ly);
    const a = await sample(0.0,0.5), b = await sample(1.0,0.5), c = await sample(0.5,1.0);
    const d = (p,q)=>p&&q?Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2])*100:null;
    console.log('info:', a.info);
    console.log('siri child at X=0:', a.pos && a.pos.map(v=>+v.toFixed(4)), '| quat', a.q && a.q.map(v=>+v.toFixed(3)));
    console.log('siri child at X=1:', b.pos && b.pos.map(v=>+v.toFixed(4)), '| quat', b.q && b.q.map(v=>+v.toFixed(3)));
    console.log('siri child at Y=1:', c.pos && c.pos.map(v=>+v.toFixed(4)), '| quat', c.q && c.q.map(v=>+v.toFixed(3)));
    console.log('сдвиг siri_L X0->X1:', d(a.pos,b.pos)?.toFixed(1), 'см | X0->Y1:', d(a.pos,c.pos)?.toFixed(1), 'см');
    console.log('errors:', JSON.stringify(errs));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
