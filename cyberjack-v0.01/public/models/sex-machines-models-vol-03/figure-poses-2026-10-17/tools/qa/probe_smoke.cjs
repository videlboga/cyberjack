const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,pipe:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:1300,height:900}});
  try {
    const page = await browser.newPage(); const logs=[];
    page.on('pageerror',e=>logs.push('ERR '+e.message));
    await page.goto('http://127.0.0.1:8766/vrm_view.html?vrm='+encodeURIComponent('models/x20/outfits/Rin_outfit_03.vrm')+'&layer=layer68-full.json&machine=080&pose=pose-SexMachineModel-080.json',{waitUntil:'load'});
    await page.waitForFunction(()=>window.__studio&&window.__studio.ready===true,{timeout:240000});
    await page.evaluate(()=>window.__studio.poseEditor.enable(true));
    await sleep(800);
    const out = await page.evaluate(()=>{
      const pe=window.__studio.poseEditor, d=pe.__debug();
      const q=s=>document.querySelector(s);
      const hasReset=!!q('.pe-cleardraft'), hasToggle=!!q('.pe-all');
      // нормальная поза применяется: сравниваем живые кости с T-позой клипа
      const hips=d.record().vrm.humanoid.getRawBoneNode('hips');
      const qq=hips.quaternion;
      return {hasReset, hasToggle, toggleOn:q('.pe-all')?.checked, sidebarSections:document.querySelectorAll('.model-section').length, layerUI:document.body.innerText.includes('Слой контроллера'), machineUI:document.body.innerText.includes('Поза машины'), hipsQ:[+qq.x.toFixed(3),+qq.y.toFixed(3),+qq.z.toFixed(3),+qq.w.toFixed(3)],
        clip:window.__studio.state.pose, dev:0};
    });
    console.log(JSON.stringify(out),'LOGS',JSON.stringify(logs.slice(-3)));
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)});
