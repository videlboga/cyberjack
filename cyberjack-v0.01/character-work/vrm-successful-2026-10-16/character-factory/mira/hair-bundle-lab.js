import * as T from 'three';
import {HairBundleRig} from './hair-bundle-rig.js?v=perf-4';
const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,innerWidth/innerHeight,.01,20);camera.position.set(1.6,.3,2.5);camera.lookAt(-.15,-.5,0);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);document.body.append(renderer.domElement);scene.add(new T.HemisphereLight(0xffffff,0x42405b,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(2,3,4);scene.add(light);
const rig=new HairBundleRig(),matrix=new T.Matrix4(),sphere=new T.Vector3(0,-.55,-.12),radius=.16;
const obstacle=new T.Mesh(new T.SphereGeometry(radius,32,24),new T.MeshLambertMaterial({color:0x58758b}));obstacle.position.copy(sphere);scene.add(obstacle);
// All eighteen disconnected ribbons share one buffer and one draw call.
const geometry=new T.BufferGeometry(),positions=new Float32Array(18*81*2*3),colors=new Float32Array(positions.length),ix=[],bindings=[],rows=[],blends=[],skinWeights=[],derivatives=[];
for(let j=0;j<18;j++){
 const seed=Math.sin(j*2.399),angle=j*Math.PI*2/18+.055*seed,width=.19*(.66+(j%5)*.14),end=.90+.10*(.5+.5*Math.sin(j*1.79)),color=new T.Color().setHSL(.77,.16,.40+(j%4)*.045);
 for(let i=0;i<80;i++){const a=j*162+i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2);}
 for(let i=0;i<=80;i++){
  const u=i/80,t=u<=rig.gather?u:rig.gather+(u-rig.gather)*(end-rig.gather)/(1-rig.gather),tail=Math.max(0,(u-rig.gather)/(1-rig.gather)),taper=Math.min(1,(1-u)*(9+(j%4)*2));
  const free=Math.sin(Math.PI*t)**2*(1-Math.exp(-(((t-rig.gather)/.07)**2))),radial=1+free*(.065*seed+.055*Math.sin(t*12+j*1.8))+.13*tail*Math.sin(j*2.2),sweep=.065*Math.sin(t*6+j)*free+.22*tail*tail*seed;
  for(let k=0;k<2;k++){
   const f=t*(rig.rows-1),row=Math.min(rig.rows-2,Math.floor(f)),blend=f-row,a=angle+sweep+(k?1:-1)*width*taper,c=Math.cos(a)*radial,d=Math.sin(a)*radial/Math.sqrt(3),weights=[(1-c)/3+c,(1-c)/3+d,(1-c)/3-d];
   bindings.push({row:row*3,blend,weights});rows.push(row*3);blends.push(blend);skinWeights.push(...weights);const dc=-Math.sin(a)*radial,dd=Math.cos(a)*radial/Math.sqrt(3);derivatives.push(2*dc/3,-dc/3+dd,-dc/3-dd);color.toArray(colors,(j*162+i*2+k)*3);
  }
 }
}
geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.setIndex(ix);
geometry.setAttribute('normal',new T.BufferAttribute(new Float32Array(positions.length),3));
geometry.setAttribute('bundleRow',new T.Float32BufferAttribute(rows,1));geometry.setAttribute('bundleBlend',new T.Float32BufferAttribute(blends,1));geometry.setAttribute('bundleWeights',new T.Float32BufferAttribute(skinWeights,3));geometry.setAttribute('bundleDerivative',new T.Float32BufferAttribute(derivatives,3));
// Only 75 control points cross the CPU/GPU boundary. Ribbon vertices and
// analytical normals are evaluated by the vertex shader from fixed bindings.
const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
material.onBeforeCompile=shader=>{
 shader.uniforms.bundleNodes={value:rig.points};
 shader.vertexShader=`uniform vec3 bundleNodes[75];
 attribute float bundleRow;attribute float bundleBlend;attribute vec3 bundleWeights;attribute vec3 bundleDerivative;
 vec3 bundleSample(int r,vec3 w){return bundleNodes[r]*w.x+bundleNodes[r+1]*w.y+bundleNodes[r+2]*w.z;}
 `+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`
 int br=int(bundleRow);vec3 ba=bundleSample(br,bundleWeights),bb=bundleSample(br+3,bundleWeights);
 vec3 across=mix(bundleSample(br,bundleDerivative),bundleSample(br+3,bundleDerivative),bundleBlend);
 vec3 objectNormal=normalize(cross(across,bb-ba)+vec3(0.00000001));
 `).replace('#include <begin_vertex>','vec3 transformed=mix(ba,bb,bundleBlend);');
};
material.customProgramCacheKey=()=> 'bundle-gpu-v1';
const hair=new T.Mesh(geometry,material);hair.frustumCulled=false;scene.add(hair);
const extraRigs=[],extraMeshes=[];
for(let i=0;i<3;i++){
 const other=new HairBundleRig();other.reset(matrix);extraRigs.push(other);
 const mat=material.clone();mat.onBeforeCompile=shader=>{material.onBeforeCompile(shader);shader.uniforms.bundleNodes.value=other.points;};mat.customProgramCacheKey=()=> 'bundle-gpu-v1';
 const mesh=new T.Mesh(geometry,mat);mesh.position.x=(i+1)*.22;mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);extraMeshes.push(mesh);
}
const gl=renderer.getContext(),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');let pendingGPU=null;
const modes=[['Пустая сцена',0,false],['Статичный пучок',1,false],['Только физика',0,true],['Полный пучок',1,true],['4 пучка',4,true]];
let benchmark=null;
const percentile=(values,p)=>{const a=[...values].sort((a,b)=>a-b);return a.length?a[Math.floor((a.length-1)*p)]:null;};
const fmt=v=>v===null?'—':v.toFixed(2);
document.querySelector('#benchmark').onclick=()=>{
 benchmark={index:0,start:performance.now(),frames:[],cpu:[],gpu:[],rows:[]};document.querySelector('#benchmark').disabled=true;document.querySelector('#bench-results').innerHTML='<tr><th>Режим</th><th>Кадр p95</th><th>CPU p95</th><th>GPU p95</th></tr>';renderer.setPixelRatio(1);
};
function finishMode(now){
 const b=benchmark;if(!b)return;
 document.querySelector('#bench-status').textContent=`${modes[b.index][0]} · ${Math.floor((now-b.start)/1000)} / 10 с · фиксированное разрешение`;
 if(now-b.start<10000)return;
 const row={mode:modes[b.index][0],frame95:percentile(b.frames,.95),cpu95:percentile(b.cpu,.95),gpu95:percentile(b.gpu,.95),frames:b.frames.length};b.rows.push(row);
 document.querySelector('#bench-results').insertAdjacentHTML('beforeend',`<tr><td>${row.mode}</td><td>${fmt(row.frame95)}</td><td>${fmt(row.cpu95)}</td><td>${fmt(row.gpu95)}</td></tr>`);
 if(++b.index===modes.length){document.querySelector('#bench-status').textContent='Готово · все времена в мс · первые 2 с каждого режима исключены';document.querySelector('#benchmark').disabled=false;benchmark=null;return;}
 b.start=now;b.frames=[];b.cpu=[];b.gpu=[];
}
const lines=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:0x8cffe0}));scene.add(lines);
const sample=new T.Vector3(),collisionDelta=new T.Vector3();
const rigControl=document.querySelector('#rig'),obstacleControl=document.querySelector('#obstacle');
const linePositions=new Float32Array(rig.links.length*6);lines.geometry.setAttribute('position',new T.BufferAttribute(linePositions,3));
let run=true,time=0,last=performance.now(),acc=0,cpuAverage=0,frameAverage=16.7,reportAt=0,scale=1,slowWindows=0;const frameSamples=[],cpuSamples=[];rig.reset(matrix);
document.querySelector('#play').onclick=e=>{run=!run;e.target.textContent=run?'Пауза':'Продолжить';};document.querySelector('#reset').onclick=()=>{time=0;matrix.identity();rig.reset(matrix);};
document.querySelector('#stats').textContent=`${rig.points.length} узлов · 18 отдельных лент · перехват 72% длины`;
function frame(now){if(document.hidden){last=now;acc=0;requestAnimationFrame(frame);return;}const cpuStart=performance.now();const elapsed=now-last;frameAverage=frameAverage*.95+elapsed*.05;frameSamples.push(elapsed);if(frameSamples.length>600)frameSamples.shift();requestAnimationFrame(frame);acc+=Math.min((now-last)/1000,.05);last=now;
 const mode=benchmark?modes[benchmark.index]:['Обычный',1,true];const collide=obstacleControl.checked?(p,r)=>{const d=collisionDelta.copy(p).sub(sphere),n=d.length();if(n<radius+r)p.copy(sphere).addScaledVector(d,(radius+r)/(n||1));}:null;let substeps=0;if(run&&mode[2])while(acc>=1/60&&substeps++<2){time+=1/60;matrix.makeRotationZ(Math.sin(time*1.2)*.55);matrix.setPosition(Math.sin(time*.8)*.12,.06*Math.sin(time),0);rig.step(1/60,matrix,collide);for(let n=0;n<(mode[1]===4?3:0);n++)extraRigs[n].step(1/60,matrix,collide);acc-=1/60;}else acc=0;acc=Math.min(acc,1/60);

 lines.visible=rigControl.checked;if(lines.visible){let offset=0;for(const c of rig.links){rig.points[c.a].toArray(linePositions,offset);rig.points[c.b].toArray(linePositions,offset+3);offset+=6;}lines.geometry.attributes.position.needsUpdate=true;}
 hair.visible=mode[1]>0;extraMeshes.forEach(m=>m.visible=mode[1]===4);obstacle.visible=obstacleControl.checked&&mode[1]>0;
 if(pendingGPU&&gl.getQueryParameter(pendingGPU,gl.QUERY_RESULT_AVAILABLE)){
  if(!gl.getParameter(timer.GPU_DISJOINT_EXT)&&benchmark&&now-benchmark.start>2000)benchmark.gpu.push(gl.getQueryParameter(pendingGPU,gl.QUERY_RESULT)/1e6);
  gl.deleteQuery(pendingGPU);pendingGPU=null;
 }
 const query=timer&&!pendingGPU?gl.createQuery():null;if(query)gl.beginQuery(timer.TIME_ELAPSED_EXT,query);
 const renderStart=performance.now();renderer.render(scene,camera);
 if(query){gl.endQuery(timer.TIME_ELAPSED_EXT);pendingGPU=query;}

 const cpu=performance.now()-cpuStart;cpuAverage=cpuAverage*.95+cpu*.05;cpuSamples.push(cpu);if(cpuSamples.length>600)cpuSamples.shift();
 if(benchmark&&now-benchmark.start>2000){benchmark.frames.push(elapsed);benchmark.cpu.push(cpu);}finishMode(now);
 if(now-reportAt>1000){
  const sorted=[...frameSamples].sort((a,b)=>a-b),cpus=[...cpuSamples].sort((a,b)=>a-b),p95=sorted[Math.floor((sorted.length-1)*.95)]||0,cpu95=cpus[Math.floor((cpus.length-1)*.95)]||0;

  document.querySelector('#stats').textContent=`${Math.round(1000/frameAverage)} FPS · кадр p95 ${p95.toFixed(1)} мс · CPU p95 ${cpu95.toFixed(1)} мс · разрешение ${Math.round(scale*100)}% · GPU-деформация`;
  reportAt=now;
 }
}requestAnimationFrame(frame);addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
