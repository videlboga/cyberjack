const assert=require('node:assert/strict');
const fs=require('node:fs');
const puppeteer=require('/home/cyberkitty/.npm/_npx/e65ceaa76006e709/node_modules/puppeteer-core');
(async()=>{
 const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 const page=await browser.newPage();await page.setViewport({width:900,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5174/vrm-stage/index.html?character=mira');await page.waitForFunction(()=>window.__gameVrm,{timeout:120000});
 const send=async legs=>page.evaluate(legs=>postMessage({type:'cyberjack-vrm-state',character:'mira',postureContexts:[{actionId:'pose_sitting'},...(legs?[{actionId:'posture_leg_'+legs+'_forward'}]:[])]},location.origin),legs);
 const settle=async()=>page.evaluate(()=>new Promise(resolve=>{let frames=0;function frame(){if(++frames>=40)resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)}));
 const measure=()=>page.evaluate(()=>{const vrm=window.__gameVrm.vrm;vrm.scene.updateMatrixWorld(true);const p=name=>{const n=vrm.humanoid.getRawBoneNode(name);return n.getWorldPosition(n.position.clone())};const result={};for(const side of ['left','right']){const upper=p(side+'UpperLeg'),knee=p(side+'LowerLeg'),foot=p(side+'Foot');result[side]={knee:180-upper.clone().sub(knee).angleTo(foot.clone().sub(knee))*180/Math.PI,foot:foot.toArray(),thigh:upper.toArray()}}result.hips=p('hips').toArray();return result});
 const cases=[];
 for(const side of ['left','right']){
  await send(null);await settle();const before=await measure();
  await send(side);await page.waitForFunction(()=>['playing','fallback'].includes(window.__gameVrm.state.library?.phase),{timeout:120000});await settle();
  const state=await page.evaluate(()=>window.__gameVrm.state),after=await measure(),other=side==='left'?'right':'left';
  assert.equal(state.library.phase,'playing',state.library.label);assert.equal(state.posture.base,'pose_sitting');assert.ok(before[side].knee-after[side].knee>50,'Selected knee must extend');assert.ok(after[side].knee<30,'Selected leg must be almost straight');assert.ok(Math.abs(before[other].knee-after[other].knee)<1,'Other knee must stay');assert.ok(after[side].foot[1]-after[other].foot[1]>.2,'Selected foot must lift');
  cases.push({side,before,after,state});await page.screenshot({path:'artifacts/vrm-'+side+'-leg.png'});
 }
 await send(null);await page.waitForFunction(()=>window.__gameVrm.state.library.phase==='idle');assert.deepEqual(errors,[]);
 fs.writeFileSync('artifacts/vrm-leg-browser.json',JSON.stringify(cases,null,2));console.log(cases.map(x=>({side:x.side,before:x.before[x.side].knee,after:x.after[x.side].knee,donor:x.state.library.donorId})));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
