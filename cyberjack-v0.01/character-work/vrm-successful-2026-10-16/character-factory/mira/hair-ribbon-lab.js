import * as T from 'three';
import {OrbitControls} from './vendor/three/controls/OrbitControls.js';
const scene=new T.Scene();scene.background=new T.Color('#14171e');
const camera=new T.PerspectiveCamera(40,innerWidth/innerHeight,.01,30);camera.position.set(3,2.2,3.5);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.9,0);controls.update();scene.add(new T.HemisphereLight(0xdce9ff,0x484052,2.8));const light=new T.DirectionalLight(0xffffff,3);light.position.set(2,4,3);scene.add(light);
const sphere=new T.Vector3(0,.92,0),radius=.38,skin=.008;
const shoulder=new T.Mesh(new T.SphereGeometry(radius,40,24),new T.MeshStandardMaterial({color:0xa8b8c8,roughness:.8}));shoulder.position.copy(sphere);scene.add(shoulder);
const floor=new T.Mesh(new T.PlaneGeometry(8,8),new T.MeshStandardMaterial({color:0x323b4b,roughness:1}));floor.rotation.x=-Math.PI/2;scene.add(floor);scene.add(new T.GridHelper(8,40,0x637289,0x414c5d));
const N=41,C=5,width=.32;
// Each row has a rest spread; longitudinal guides retain their own arc lengths.
function spread(t){return .32+.68*Math.pow(Math.sin(Math.PI*(t*.94+.05)),.7)*(1-.48*Math.exp(-Math.pow((t-.64)/.09,2)));}
function xAt(r,c){return (c/(C-1)-.5)*width*spread(r/(N-1));}let ds=2.8/(N-1);const dw=width/(C-1),p=[],old=[],links=[];let time=0,running=true,acc=0;
const ui={move:document.querySelector('#move'),curl:document.querySelector('#curl'),twist:document.querySelector('#twist'),height:document.querySelector('#root-height'),bend:document.querySelector('#bend-strength')};
for(let i=0;i<N*C;i++){p.push(new T.Vector3());old.push(new T.Vector3());}
function link(a,b,length,stiff=1){links.push({a,b,length,stiff});}
function restTurn(t){const ramp=Math.max(0,(t-.25)/.75);return Number(ui.curl.value)*.65*ramp*ramp;}
function build(){links.length=0;for(let r=0;r<N;r++)for(let c=0;c<C;c++){const a=r*C+c;if(c&&(r<N-12||c%2===1))link(a-1,a,width*spread(r/(N-1))/(C-1),.32);if(r)link(a-C,a,Math.hypot(Math.max(ds*.35,ds-xAt(r,c)*restTurn(r/(N-1))),xAt(r,c)-xAt(r-1,c)));if(r&&c&&(r<N-12||c%2===1)){link(a-C-1,a,Math.hypot(ds,xAt(r,c)-xAt(r-1,c-1)),.12);link(a-C,a-1,Math.hypot(ds,xAt(r,c-1)-xAt(r-1,c)),.12);}if(c>1&&r<N-12)link(a-2,a,width*spread(r/(N-1))*2/(C-1),.05);}}
build();const positions=new Float32Array(N*6*3),indices=[];
// Two surfaces share their inner edge until the split opens continuously.
for(let r=0;r<N-1;r++)for(let branch=0;branch<2;branch++)for(let cell=0;cell<2;cell++){const a=r*6+branch*3+cell;indices.push(a,a+6,a+1,a+1,a+6,a+7);}
const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setIndex(indices);const material=new T.MeshStandardMaterial({color:0x686080,side:T.DoubleSide,roughness:.55});const ribbon=new T.Mesh(geometry,material);ribbon.frustumCulled=false;scene.add(ribbon);
function reset(){time=0;acc=0;for(let r=0;r<N;r++)for(let c=0;c<C;c++){const q=p[r*C+c];q.set(xAt(r,c)+(Number(ui.height.value)<1.35?-.6:0),Number(ui.height.value)-r*ds,.08+.12*Math.sin(r/N*Math.PI));if(q.y<skin&&document.querySelector('#loop').checked){const arc=skin-q.y,rad=.28,phi=arc/rad,offset=xAt(r,c);q.x=rad*(1-Math.cos(phi))+offset*Math.cos(phi)+(Number(ui.height.value)<1.35?-.6:0);q.z=.08+.12*Math.sin(r/N*Math.PI)+rad*Math.sin(phi)-offset*Math.sin(phi);q.y=skin;}else if(q.y<skin){q.z+=skin-q.y;q.y=skin;}old[r*C+c].copy(q);}}
reset();const delta=new T.Vector3(),before=new T.Vector3(),normal=new T.Vector3(),along=new T.Vector3(),across=new T.Vector3(),surface=new T.Vector3(),target=new T.Vector3(),curvature=new T.Vector3();
const incoming=new T.Vector3(),outgoing=new T.Vector3(),wanted=new T.Vector3();
function bend(){
 const curl=Number(ui.curl.value),twist=Number(ui.twist.value),strength=Number(ui.bend.value);
 for(let r=2;r<N-1;r++){
  across.subVectors(p[r*C+C-1],p[r*C]).normalize();
  along.subVectors(p[r*C+2],p[(r-1)*C+2]).normalize();
  surface.crossVectors(across,along).normalize();
  const t=r/(N-1),ramp=Math.max(0,(t-.25)/.75);
  for(let c=0;c<C;c++){
   const a=p[(r-1)*C+c],b=p[r*C+c],d=p[(r+1)*C+c];
   incoming.subVectors(b,a);outgoing.subVectors(d,b);
   // Rest turning lives in the material frame, independent of scene orientation.
   const split=Math.max(0,(t-.75)/.25);const signed=restTurn(t)*(1+split*split*(c<2?.18:-.18));
   wanted.copy(incoming).applyAxisAngle(surface,signed).applyAxisAngle(along,twist*ramp*.01);
   const length=outgoing.length();wanted.normalize().multiplyScalar(length);
   curvature.copy(outgoing).sub(wanted).multiplyScalar(.12*strength);
   a.addScaledVector(curvature,-.5);b.add(curvature);d.addScaledVector(curvature,-.5);
  }
 }
}
function contact(i){const q=p[i];normal.subVectors(q,sphere);const d=normal.length();if(d<radius+skin){normal.divideScalar(d||1);q.copy(sphere).addScaledVector(normal,radius+skin);delta.subVectors(q,old[i]);const vn=delta.dot(normal);if(vn<0)old[i].addScaledVector(normal,vn);old[i].addScaledVector(delta,.008);}if(q.y<skin){q.y=skin;if(old[i].y>q.y)old[i].y=q.y;old[i].x+=(q.x-old[i].x)*.018;old[i].z+=(q.z-old[i].z)*.018;}}
function step(h){time+=h;for(let i=C;i<p.length;i++){before.copy(p[i]);p[i].addScaledVector(delta.subVectors(p[i],old[i]),.997);p[i].y-=9.81*h*h;old[i].copy(before);}for(let pass=0;pass<16;pass++){if(pass%4===0)bend();for(let c=0;c<C;c++)p[c].set(xAt(0,c)+(Number(ui.height.value)<1.35?-.6:0),Number(ui.height.value),.08+(ui.move.checked?Math.sin(time*.8)*.16:0));for(const l of links){delta.subVectors(p[l.b],p[l.a]);const d=delta.length();if(!d)continue;const wa=l.a<C?0:1,wb=l.b<C?0:1;if(!wa&&!wb)continue;delta.multiplyScalar((d-l.length)/d*l.stiff/(wa+wb));p[l.a].addScaledVector(delta,wa);p[l.b].addScaledVector(delta,-wb);}for(let i=C;i<p.length;i++)contact(i);}}
ui.curl.oninput=build;document.querySelector('#loop').onchange=reset;ui.height.oninput=reset;
document.querySelector('#length').oninput=e=>{ds=Number(e.target.value)/(N-1);build();reset();};
document.querySelector('#play').onclick=()=>{running=!running;document.querySelector('#play').textContent=running?'Пауза':'Продолжить';};document.querySelector('#reset').onclick=reset;document.querySelector('#wire').onchange=e=>material.wireframe=e.target.checked;
let last=performance.now(),count=0,total=0;function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.04);last=now;const start=performance.now();if(running){acc=Math.min(acc+dt,.05);while(acc>=1/120){step(1/120);acc-=1/120;}}for(let row=0;row<N;row++){
 const t=row/(N-1),f=Math.max(0,Math.min(1,(t-.65)/.35)),k=f*f*(3-2*f),gap=.7*k;
 const bounds=[0,.5-gap*.5,.5+gap*.5,1];
 for(let branch=0;branch<2;branch++){
 const lo=bounds[branch*2],hi=bounds[branch*2+1],mid=(lo+hi)*.5,taper=1-.98*k;
 for(let edge=0;edge<3;edge++){
 const u=mid+(edge-1)*(hi-lo)*.5*taper,q=u*(C-1),col=Math.min(C-2,Math.floor(q));
 before.copy(p[row*C+col]).lerp(p[row*C+col+1],q-col);before.toArray(positions,(row*6+branch*3+edge)*3);
 }
 }
}geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();total+=performance.now()-start;if(++count%30===0){let penetration=0;for(let i=C;i<p.length;i++)penetration=Math.max(penetration,radius-p[i].distanceTo(sphere),-p[i].y);document.querySelector('#stats').textContent=`205 узлов · 120 Гц · расчёт ${(total/30).toFixed(2)} мс/кадр · проникновение узлов ${(Math.max(0,penetration)*1000).toFixed(1)} мм`;total=0;}renderer.render(scene,camera);}requestAnimationFrame(frame);addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
