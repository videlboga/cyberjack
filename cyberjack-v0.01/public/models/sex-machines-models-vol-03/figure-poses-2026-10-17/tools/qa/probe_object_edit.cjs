const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,pipe:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:1200,height:850}});
  try {
    const page = await browser.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
    await page.goto('http://127.0.0.1:8766/vrm_view.html?vrm='+encodeURIComponent('models/x20/outfits/Rin_outfit_03.vrm'),{waitUntil:'load'});
    await page.waitForFunction(()=>window.__studio&&window.__studio.ready===true,{timeout:240000});
    const out = await page.evaluate(async ()=>{
      
      const ws = window.__studio.workspace;
      await ws.addObject('skp:SexMachineModel-080');
      const o = ws.objects.at(-1);
      const before = {p:o.group.position.toArray().map(v=>+v.toFixed(2)), tab:ws.tab};
      // числовое поле позиции
      const inp = document.querySelector('.ws-transform input[data-field="position.x"]');
      const disabled = inp?inp.disabled:null;
      if (inp) { inp.value = String((+inp.value||0) + 1); inp.dispatchEvent(new Event('change')); }
      const after = {p:o.group.position.toArray().map(v=>+v.toFixed(2))};
      // состояние гизмо
      const helper = window.__studio.scene.children.find(c=>c.type==='Object3D'&&c.children.some(x=>x.type==='TransformControlsRoot'))||null;
      
      let helpers=[];
      window.__studio.scene.traverse(n=>{ if(/TransformControls/i.test(n.type||'')||/TransformControls/i.test(n.name||''))helpers.push({t:n.type,name:n.name,vis:n.visible,kids:n.children.length}); });
      const gizmoVisible=helpers.length?helpers.map(h=>h.vis):null, gizmoKids=helpers.length;
      const box = new (Object.getPrototypeOf(o.group).constructor)();
      return {before, after, inputDisabled:disabled, tab:ws.tab, gizmoVisible, gizmoKids,
        objects: ws.objects.length, hasHelper: !!helper};
    });
    console.log(JSON.stringify(out,null,1),'| errors',JSON.stringify(errs));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
