const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,pipe:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:900,height:700}});
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:8766/machine_pose.html?machine=080&char=${encodeURIComponent('x20/outfits/Rin_outfit_03.vrm')}`,{waitUntil:'load'});
    await page.waitForFunction(()=>window.__mp&&window.__mp.ready===true,{timeout:240000});
    const out = await page.evaluate(() => {
      const res = {matches:[], skinnedBones:0, hasSiriInSkeleton:false};
      const vrm = window.__mpVrmGet ? window.__mpVrmGet() : null;
      return (function(){
        const found=[];
        vrm.scene.traverse(n=>{ if(n.name==='cf_j_siri_L') found.push({name:n.name, isBone:!!n.isBone, children:(n.children||[]).map(c=>c.name).slice(0,8), parent:n.parent?.name}); });
        let sk=0; const skel=new Set();
        vrm.scene.traverse(n=>{ if(n.isSkinnedMesh&&n.skeleton){ sk++; for(const b of n.skeleton.bones) skel.add(b.name); } });
        return {found, skinnedMeshes:sk, skeletonHasSiri:[...skel].filter(x=>/siri|waist/.test(x)).slice(0,12), skeletonSize:skel.size};
      })();
    });
    console.log(JSON.stringify(out, null, 1));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
