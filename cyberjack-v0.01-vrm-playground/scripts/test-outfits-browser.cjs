const fs=require('node:fs'),assert=require('node:assert/strict');
const puppeteer=require('/home/cyberkitty/.npm/_npx/e65ceaa76006e709/node_modules/puppeteer-core');
(async()=>{const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5174/vrm-stage/index.html?character=mira&outfit=01');await page.waitForFunction(()=>window.__gameVrm,{timeout:120000});assert.equal(await page.evaluate(()=>window.__gameVrm.state.outfit),'01');await page.evaluate(()=>postMessage({type:'cyberjack-vrm-state',character:'mira',postureContexts:[{actionId:'pose_sitting'}]},location.origin));await page.waitForFunction(()=>window.__gameVrm.state.posture.base==='pose_sitting');assert.deepEqual(errors,[]);
 const state=await page.evaluate(()=>window.__gameVrm.state);fs.writeFileSync('artifacts/outfit-render.json',JSON.stringify(state,null,2));console.log('PASS alternate outfit VRM load and seated state');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
