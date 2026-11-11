import * as THREE from 'three';
export function createBodyStage({vrm,camera,controls,renderer,send}){
 let config={zones:[],tool:null,busy:false,cinematic:true,reduced:false},focusId='systemic',transition=false,cinematicUntil=0,lastCinematic=-99,down=null,hover=null;
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),offset=new THREE.Vector3(),savedTarget=new THREE.Vector3(),savedCamera=new THREE.Vector3();
 const canvas=renderer.domElement;
 const tip=document.createElement('div');tip.style.cssText='position:fixed;pointer-events:none;z-index:30;max-width:260px;padding:7px 9px;background:#fffffff2;border:1px solid #555;color:#222;font:12px Arial;display:none';document.body.append(tip);
 const marker=new THREE.Mesh(new THREE.SphereGeometry(.018,12,8),new THREE.MeshBasicMaterial({color:0x303030,wireframe:true,transparent:true,opacity:.5,depthTest:false}));marker.visible=false;marker.renderOrder=1000;vrm.scene.parent.add(marker);
 const bone=(name)=>vrm.humanoid.getRawBoneNode(name)?.getWorldPosition(new THREE.Vector3());
 const centers={head:['head'],face:['head'],hair:['head'],lips:['head'],neck:['neck'],shoulders:['leftShoulder','rightShoulder'],arms:['leftLowerArm','rightLowerArm'],hands:['leftHand','rightHand'],feet:['leftFoot','rightFoot'],legs:['leftUpperLeg','rightUpperLeg'],inner_thighs:['leftUpperLeg','rightUpperLeg'],chest:['chest'],nipples:['chest'],belly:['spine'],back:['chest'],waist:['hips'],buttocks:['hips'],vagina:['hips'],vulva:['hips'],clitoris:['hips'],anus:['hips']};
 function target(id){const points=(centers[id]||[]).map(bone).filter(Boolean);if(!points.length)return new THREE.Vector3(0,.86,0);const p=points.reduce((a,v)=>a.add(v),new THREE.Vector3()).multiplyScalar(1/points.length);if(['head','face','hair','lips'].includes(id))p.y+=.08;return p}
 function focus(id){focusId=id;cinematicUntil=0;transition=true;const distance=id==='systemic'?3.6:['face','head','hair','lips','neck'].includes(id)?.75:['feet','hands'].includes(id)?1.0:1.6;offset.copy(camera.position).sub(controls.target).normalize().multiplyScalar(distance);if(id==='systemic')offset.set(.15,.09,3.6);else if(['back','buttocks','anus'].includes(id))offset.set(0,.05,-distance);else if(['face','head','lips','neck','chest','belly','waist','nipples'].includes(id))offset.set(offset.x*.25,offset.y*.25,Math.max(.2,Math.abs(offset.z))).normalize().multiplyScalar(distance);send('cyberjack-vrm-focus',{pointId:id})}
 // CPU skinning every triangle on pointermove was ~666 ms per query.
 // These invisible interaction capsules follow the live bones, with no mesh traversal.
 const boneNames=['head','neck','leftShoulder','rightShoulder','leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftHand','rightHand','leftMiddleProximal','rightMiddleProximal','chest','spine','hips','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg','leftFoot','rightFoot','leftToes','rightToes'];
 const nodes=new Map(boneNames.map(n=>[n,vrm.humanoid.getRawBoneNode(n)])),positions=new Map(boneNames.map(n=>[n,new THREE.Vector3()]));
 const rayPoint=new THREE.Vector3(),segmentPoint=new THREE.Vector3(),headCenter=new THREE.Vector3(),hairCenter=new THREE.Vector3(),faceCenter=new THREE.Vector3(),footEnd=[new THREE.Vector3(),new THREE.Vector3()];
 function pick(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);for(const [name,node]of nodes)if(node)positions.get(name).setFromMatrixPosition(node.matrixWorld);
  let closest=Infinity,result=null;
  function capsule(id,a,b,radius){if(!a||!b)return;const d=ray.ray.distanceSqToSegment(a,b,rayPoint,segmentPoint);if(d>radius*radius)return;const distance=ray.ray.origin.distanceTo(rayPoint)-Math.sqrt(radius*radius-d);if(distance<0||distance>=closest)return;closest=distance;result={id,point:ray.ray.at(distance,new THREE.Vector3())}}
  const pos=name=>nodes.get(name)?positions.get(name):null;
  if(pos('head')){headCenter.copy(pos('head')).add(new THREE.Vector3(0,.08,0));faceCenter.copy(headCenter).add(new THREE.Vector3(0,0,.035));hairCenter.copy(headCenter).add(new THREE.Vector3(0,.03,-.035));capsule('hair',hairCenter,hairCenter,.125);capsule('face',faceCenter,faceCenter,.105)}
  capsule('neck',pos('neck'),pos('head'),.047);capsule('shoulders',pos('leftShoulder'),pos('rightShoulder'),.055);
  capsule('chest',pos('chest'),pos('chest'),.135);capsule('belly',pos('spine'),pos('hips'),.12);capsule('waist',pos('hips'),pos('hips'),.125);
  for(const [i,side]of ['left','right'].entries()){
   capsule('arms',pos(side+'UpperArm'),pos(side+'LowerArm'),.075);capsule('arms',pos(side+'LowerArm'),pos(side+'Hand'),.057);
   capsule('hands',pos(side+'Hand'),pos(side+'MiddleProximal')||pos(side+'Hand'),.045);
   capsule('legs',pos(side+'UpperLeg'),pos(side+'LowerLeg'),.08);capsule('legs',pos(side+'LowerLeg'),pos(side+'Foot'),.052);
   if(pos(side+'Foot')){footEnd[i].copy(pos(side+'Toes')||pos(side+'Foot'));if(!pos(side+'Toes'))footEnd[i].z+=.08;footEnd[i].y-=.015;capsule('feet',pos(side+'Foot'),footEnd[i],.045)}
  }
  if(result?.id==='arms'&&['leftHand','rightHand'].some(name=>pos(name)&&result.point.distanceToSquared(pos(name))<.075*.075))result.id='hands';
  if(result&&['chest','belly','waist'].includes(result.id)&&result.point.z<(pos('hips')?.z||0)-.03)result.id='back';return result;
 }
 let lastHover=0;
 function availability(id){const zone=config.zones.find(z=>z.id===id);if(!zone)return {ok:false,text:'Эта область недоступна'};if(zone.blocked)return {ok:false,text:'Область заблокирована текущими условиями'};if(config.busy)return {ok:false,text:'Дождитесь завершения действия'};if(config.tool?.reason)return {ok:false,text:config.tool.reason};if(config.tool&&!config.tool.targets.includes(id))return {ok:false,text:config.tool.label+' · здесь недоступно'};return {ok:true,text:config.tool?config.tool.label+' · '+zone.label:'Фокус · '+zone.label}}
 canvas.addEventListener('pointermove',e=>{if(down||e.timeStamp-lastHover<33)return;lastHover=e.timeStamp;hover=pick(e);if(!hover){tip.style.display='none';marker.visible=false;canvas.style.cursor='grab';return}const a=availability(hover.id);tip.textContent=a.text+(config.tool?' · Alt: только фокус':'');tip.style.display='block';tip.style.left=Math.min(innerWidth-275,e.clientX+14)+'px';tip.style.top=Math.max(6,e.clientY-42)+'px';marker.position.copy(hover.point);marker.visible=true;marker.material.color.set(a.ok?'#333333':'#a94444');canvas.style.cursor=a.ok?'pointer':'not-allowed'});
 canvas.addEventListener('pointerleave',()=>{tip.style.display='none';marker.visible=false;down=null});
 canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,t:e.timeStamp,button:e.button};transition=false;if(cinematicUntil){cinematicUntil=0;focus(focusId);transition=false}});
 canvas.addEventListener('pointerup',e=>{const start=down;down=null;if(!start||start.button!==0||Math.hypot(e.clientX-start.x,e.clientY-start.y)>6||e.timeStamp-start.t>1000)return;const hit=pick(e);if(!hit)return;const zone=config.zones.find(z=>z.id===hit.id);if(!zone)return;if(e.altKey||!config.tool){focus(hit.id);send('cyberjack-vrm-body',{pointId:hit.id,apply:false});return}if(availability(hit.id).ok)send('cyberjack-vrm-body',{pointId:hit.id,apply:true})});
 window.addEventListener('keydown',e=>{if(e.key==='Escape')send('cyberjack-vrm-clear')});
 canvas.addEventListener('wheel',()=>{transition=false;cinematicUntil=0},{passive:true});
 return {hitTest(x,y){return pick({clientX:x,clientY:y})?.id||null},configure(c){const previousTool=config.tool?.id,previousBusy=config.busy;config={...config,...c};if(previousTool!==config.tool?.id||previousBusy!==config.busy){tip.style.display='none';marker.visible=false}},focus,cinematic(now){if(!config.cinematic||config.reduced||now-lastCinematic<6||down)return;lastCinematic=now;cinematicUntil=now+2.7;savedTarget.copy(controls.target);savedCamera.copy(camera.position);transition=true;offset.set(.12,.035,.9)},get state(){return {focusId,cinematic:Boolean(cinematicUntil),tool:config.tool?.id||null,transitioning:transition,distance:camera.position.distanceTo(controls.target)}},update(dt,now){
  if(cinematicUntil&&now>cinematicUntil){cinematicUntil=0;transition=true;offset.copy(savedCamera).sub(savedTarget)}
  const t=cinematicUntil?target('face'):target(focusId);if(transition){const a=config.reduced?1:1-Math.exp(-dt*5);controls.target.lerp(t,a);camera.position.lerp(t.clone().add(offset),a);if(camera.position.distanceTo(t.clone().add(offset))<.015)transition=false}
 }};
}
