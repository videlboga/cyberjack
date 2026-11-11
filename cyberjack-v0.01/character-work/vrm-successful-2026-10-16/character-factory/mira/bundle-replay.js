import {auditRibbonBody} from './bundle-contact-audit.js?v=5';
// Deterministic replay of the actual viewer rig/mesh, without a second body
// reconstruction and without running two physics clocks at the same time.
export function installBundleReplay({bundle,body,setPose,step,setRunning,ready,duration}){
 if(!bundle?.panel)return;
 const button=document.createElement('button'),output=document.createElement('output');button.textContent='Прогон клипа · проверка';output.style.cssText='display:block;max-width:520px;margin-top:5px';bundle.panel.append(button,output);
 let active=false,cancel=false,lastWorst=null,frozen=false;
 const inspect=document.createElement('button');inspect.textContent='Худший кадр · снимок';inspect.disabled=true;bundle.panel.append(inspect);
 inspect.onclick=()=>{
  if(frozen){frozen=false;setRunning(false);inspect.textContent='Худший кадр · снимок';return;}
  if(!lastWorst||active)return;
  setRunning(true);setPose(lastWorst.time);step(0);
  lastWorst.controlPoints.forEach((p,i)=>{bundle.rig.points[i].fromArray(p);bundle.rig.previous[i].fromArray(p);});
  frozen=true;inspect.textContent='Продолжить физику';
 };
 button.onclick=async()=>{
  if(active){cancel=true;return;}if(!ready()){output.textContent='Дождитесь загрузки головы и волос.';return;}
  frozen=false;inspect.disabled=true;inspect.textContent='Худший кадр · снимок';active=true;cancel=false;button.textContent='Остановить проверку';setRunning(true);
  const records=[],solveTimes=[];let worst=null;const yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
  try{
   setPose(0);bundle.initial=false;
   for(let i=0;i<60;i++){step(1/60);if(i%4===3)await yieldFrame();}
   const frames=Math.ceil(duration*60);
   for(let frame=0;frame<=frames&&!cancel;frame++){
    const time=Math.min(duration,frame/60);if(frame%2===0||frame===frames)setPose(time);step(1/60);solveTimes.push(bundle.lastSolveMS||0);
    if(frame%30===0||frame===frames){
     const report=auditRibbonBody(bundle.rig,bundle.mesh.geometry,body,{snapshot:false});
     records.push({time,crossings:report.crossings,inside:report.inside,maxDepth:report.maxDepth});
     if(!worst||report.crossings>worst.crossings){worst={...report,time,rigMatrix:bundle.matrix.toArray(),controlPoints:bundle.rig.points.map(p=>p.toArray()),bodySnapshot:{positions:Array.from(body.geometry.attributes.position.array),indices:Array.from(body.geometry.index.array),matrix:body.matrixWorld.toArray()},colliders:bundle.currentColliders?.map(c=>({a:c.a.toArray(),b:c.b.toArray(),radius:c.radius,depthScale:c.depthScale,capScale:c.capScale,depthAxis:c.depthAxis.toArray(),bodyPart:c.bodyPart}))};}
     output.textContent=`Прогон ${time.toFixed(2)} / ${duration.toFixed(2)} с · максимум ${worst.crossings} пересекающих рёбер (${worst.time.toFixed(2)} с)`;
    }
    if(frame%2===1)await yieldFrame();
   }
   solveTimes.sort((a,b)=>a-b);output.dataset.timing=JSON.stringify({median:solveTimes[Math.floor(solveTimes.length*.5)],p95:solveTimes[Math.floor(solveTimes.length*.95)]});output.dataset.records=JSON.stringify(records);output.dataset.worst=JSON.stringify(worst);lastWorst=worst;inspect.disabled=!worst;
   output.textContent=`${cancel?'Остановлено':'Готово'} · ${records.length} снимков · максимум ${worst?.crossings??0} пересекающих рёбер на ${worst?.time.toFixed(2)} с. Проверяется только тело, без головы и стыка шеи.`;
  }catch(error){output.textContent='Ошибка проверки: '+error.message;}
  finally{active=false;button.textContent='Прогон клипа · проверка';setRunning(false);}
 };
}
