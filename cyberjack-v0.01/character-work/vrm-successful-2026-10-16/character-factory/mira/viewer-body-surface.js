import * as T from './vendor/three/three.module.js';
const MAX_SEGMENTS=32,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const number=(v,d,a,b)=>{v=v??d;if(!Number.isFinite(v)||v<a||v>b)throw Error('Параметр слоя вне диапазона');return v;};
const color=(v,d)=>{v=v??d;if(!/^#[0-9a-f]{6}$/i.test(v))throw Error('Некорректный цвет слоя');return v;};
export function cleanBodyLayers(value){
 if(value==null)return {version:1,layers:[]};if(value.version!==1||!Array.isArray(value.layers)||value.layers.length>8)throw Error('Неверный формат слоёв кожи');let segments=0,freckles=0;
 const layers=value.layers.map((l,i)=>{if(!l||!['freckles','scar'].includes(l.type))throw Error('Неизвестный тип слоя кожи');const out={...l,id:String(l.id||'layer-'+i),name:String(l.name||l.type),enabled:l.enabled!==false,opacity:number(l.opacity,.5,0,1),color:color(l.color,l.type==='scar'?'#d8b9be':'#b97960')};
 if(l.type==='freckles'){if(++freckles>1)throw Error('Допустим один слой веснушек');out.density=number(l.density,.45,0,1);out.size=number(l.size,1,.4,2);out.seed=number(l.seed,701,0,1000000);}
 else{if(!Array.isArray(l.points)||l.points.length<2||l.points.length>12||l.points.some(p=>!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isFinite(v)||Math.abs(v)>2)))throw Error('Некорректный контур шрама');out.points=l.points.map(p=>[...p]);out.width=number(l.width,.0012,.0003,.006);segments+=l.points.length-1;}
 return out;});if(segments>MAX_SEGMENTS)throw Error('Слишком много сегментов шрамов');return {...value,version:1,layers};
}
export function mapBodyRest(base,count,sourceMap=null){
 if(!sourceMap){if(count*3!==base.length)throw Error('Неизвестная топология тела для слоёв');return new Float32Array(base);}
 if(sourceMap.length!==count)throw Error('Неполная привязка слоёв к шее');const out=new Float32Array(count*3);for(let i=0;i<count;i++)for(const [id,w]of sourceMap[i])for(let k=0;k<3;k++)out[i*3+k]+=base[id*3+k]*w;return out;
}
function freckleTexture(layer){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');let seed=layer?.seed||701;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 // RGB marks a sparse subset, alpha the full set; regional density keeps the spots crisp.
 for(let i=0;i<Math.round(80+220*(layer?.density||0));i++){const x=rand()*512,y=rand()*512,r=.7+Math.pow(rand(),1.8)*2.1,sy=.6+rand()*.7,sparse=rand()<.18,ink=sparse?255:0;ctx.fillStyle='rgba('+ink+','+ink+','+ink+','+(.55+rand()*.35)+')';ctx.beginPath();for(let j=0;j<8;j++){const a=j*Math.PI*2/8,rr=r*(.7+rand()*.5),px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr*sy;j?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();}
 const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;return texture;
}
export function createBodySurface({base,host,initial='',onHideHair=()=>{},onFocus=()=>{}}){
 let state=cleanBodyLayers(null),texture=null,textureKey='',character='custom',hairHidden=false;const starts=Array.from({length:MAX_SEGMENTS},()=>new T.Vector3()),ends=starts.map(()=>new T.Vector3()),inks=starts.map(()=>new T.Vector4()),widths=new Float32Array(MAX_SEGMENTS);
 const uniforms={cjFreckles:{value:null},cjFreckleColor:{value:new T.Color()},cjFreckleParams:{value:new T.Vector2(0,1)},cjScarCount:{value:0},cjScarStart:{value:starts},cjScarEnd:{value:ends},cjScarInk:{value:inks},cjScarWidth:{value:widths}};
 const panel=document.createElement('details');panel.id='editor-body-surface';host.append(panel);
 function sync(){
  const layer=state.layers.find(l=>l.type==='freckles'),key=JSON.stringify(layer&&[layer.seed,layer.density]);if(key!==textureKey||!texture){texture?.dispose();texture=freckleTexture(layer);textureKey=key;uniforms.cjFreckles.value=texture;}
  uniforms.cjFreckleParams.value.set(layer?.enabled?layer.opacity:0,layer?.size||1);uniforms.cjFreckleColor.value.set(layer?.color||'#b97960');let n=0;for(const l of state.layers.filter(l=>l.type==='scar'&&l.enabled))for(let i=1;i<l.points.length;i++){starts[n].fromArray(l.points[i-1]);ends[n].fromArray(l.points[i]);const c=new T.Color(l.color);inks[n].set(c.r,c.g,c.b,l.opacity);widths[n++]=l.width;}uniforms.cjScarCount.value=n;const editor=panel.querySelector('textarea');if(editor)editor.value=JSON.stringify(state,null,2);
 }
 function renderUI(){
  panel.replaceChildren();const title=document.createElement('summary');title.textContent='Кожа тела · отдельные слои';panel.append(title);const info=document.createElement('p');info.className='sub';info.textContent='Слои следуют за формой тела и позой. Исходная окраска и анатомические морфы остаются отдельными.';panel.append(info);const hairToggle=document.createElement('input');hairToggle.type='checkbox';hairToggle.checked=hairHidden;hairToggle.setAttribute('aria-label','Скрыть волосы для осмотра тела');hairToggle.onchange=()=>{hairHidden=hairToggle.checked;onHideHair(hairHidden);};const hairLabel=document.createElement('label');hairLabel.append(hairToggle,' Скрыть волосы для осмотра тела');panel.append(hairLabel);const focus=document.createElement('button');focus.textContent='Корпус крупно';focus.onclick=onFocus;panel.append(focus);
  if(['kate','mira','iona','nika','sumi','rin','mai','mika','eli'].includes(character)){const ref=document.createElement('details'),caption=document.createElement('summary'),img=document.createElement('img');caption.textContent='Референс фигуры';img.alt='Референс фигуры · '+character;img.style.cssText='width:100%;max-height:550px;object-fit:contain';img.src=character==='kate'?'./assets/body-references/kate/standing.png':'/public/character-images/rendered/'+character+'/standing__'+(character==='mika'?'nude':'underwear')+'__none__neutral.png';ref.append(caption,img);panel.append(ref);}

  for(const layer of state.layers){const box=document.createElement('details');box.open=true;const name=document.createElement('summary');name.textContent=layer.name;box.append(name);const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=layer.enabled;enabled.setAttribute('aria-label',layer.name+' · включён');enabled.onchange=()=>{layer.enabled=enabled.checked;sync();};const label=document.createElement('label');label.append(enabled,' Включён');box.append(label);
   addSlider(box,layer,'opacity','Насыщенность',0,1,.01);if(layer.type==='freckles'){addSlider(box,layer,'density','Плотность',0,1,.01);addSlider(box,layer,'size','Масштаб',.4,2,.05);}else addSlider(box,layer,'width','Ширина',.0003,.006,.0001);
   const input=document.createElement('input');input.type='color';input.value=layer.color;input.setAttribute('aria-label',layer.name+' · цвет');input.oninput=()=>{layer.color=input.value;sync();};box.append(input);panel.append(box);
  }
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Редактировать слои JSON';const text=document.createElement('textarea');text.rows=12;text.style.width='100%';text.setAttribute('aria-label','Слои кожи тела JSON');text.value=JSON.stringify(state,null,2);const button=document.createElement('button'),status=document.createElement('p');button.textContent='Применить слои кожи';button.onclick=()=>{try{setState(JSON.parse(text.value));status.textContent='Слои применены';}catch(e){status.textContent=e.message;}};details.append(summary,text,button,status);panel.append(details);
 }
 function addSlider(box,l,key,label,min,max,step){const row=document.createElement('label');row.style.cssText='display:grid;gap:4px;margin:8px 0';const output=document.createElement('output');output.textContent=label+' · '+l[key];const input=document.createElement('input');Object.assign(input,{type:'range',min,max,step,value:l[key]});input.setAttribute('aria-label',l.name+' · '+label);input.oninput=()=>{l[key]=Number(input.value);output.textContent=label+' · '+l[key];sync();};row.append(output,input);box.append(row);}
 function setState(value){state=cleanBodyLayers(value);sync();renderUI();}
 function readHash(hash){const p=new URLSearchParams(hash.replace(/^#/,''));character=p.get('character_id')||'custom';setState(p.has('body_layers')?JSON.parse(p.get('body_layers')):null);}
 readHash(initial);
 return {get hairHidden(){return hairHidden;},get state(){return structuredClone(state);},setState,readHash,hash(){const p=new URLSearchParams();if(state.layers.length)p.set('body_layers',JSON.stringify(state));return p.toString();},mapGeometry(geometry,socket){const map=geometry===socket?.geometry?socket.sourceMap:null;geometry.setAttribute('cjBodyRest',new T.BufferAttribute(mapBodyRest(base,geometry.attributes.position.count,map),3));},
 patchMaterial(material){const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);material.onBeforeCompile=function(shader,...args){previous.call(this,shader,...args);Object.assign(shader.uniforms,uniforms);
 shader.vertexShader='attribute vec3 cjBodyRest;\nvarying vec3 vCjBodyRest;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCjBodyRest=cjBodyRest;');
 shader.fragmentShader=`varying vec3 vCjBodyRest;
uniform sampler2D cjFreckles;uniform vec3 cjFreckleColor;uniform vec2 cjFreckleParams;
uniform int cjScarCount;uniform vec3 cjScarStart[32];uniform vec3 cjScarEnd[32];uniform vec4 cjScarInk[32];uniform float cjScarWidth[32];
`+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec3 cp=vCjBodyRest;
 if(cjFreckleParams.x>0.){
  vec3 weights=pow(abs(normalize(cross(dFdx(cp),dFdy(cp)))),vec3(4.));weights/=max(dot(weights,vec3(1.)),.0001);
  float tile=.20*cjFreckleParams.y;
  vec4 fx=texture2D(cjFreckles,cp.yz/tile),fy=texture2D(cjFreckles,cp.xz/tile+vec2(.37,.19)),fz=texture2D(cjFreckles,cp.xy/tile+vec2(.61,.43));
  float fullSpots=fx.a*weights.x+fy.a*weights.y+fz.a*weights.z;
  float sparseSpots=fx.r*fx.a*weights.x+fy.r*fy.a*weights.y+fz.r*fz.a*weights.z;
  float shoulder=smoothstep(1.10,1.22,cp.z)*(1.-smoothstep(1.30,1.40,cp.z));
  float arms=smoothstep(.13,.23,abs(cp.x))*(1.-smoothstep(.34,.43,abs(cp.x)));
  float exposure=max(shoulder,arms*.55)*(1.-smoothstep(1.34,1.41,cp.z));
  diffuseColor.rgb=mix(diffuseColor.rgb,cjFreckleColor,clamp(mix(sparseSpots,fullSpots,exposure)*cjFreckleParams.x,0.,1.));
 }
 for(int i=0;i<32;i++){if(i>=cjScarCount)break;vec3 ab=cjScarEnd[i]-cjScarStart[i];float t=clamp(dot(cp-cjScarStart[i],ab)/max(dot(ab,ab),.000001),0.,1.);float distanceToScar=length(cp-cjScarStart[i]-t*ab);float w=cjScarWidth[i];float scar=1.-smoothstep(w*.35,w*1.3,distanceToScar);float halo=1.-smoothstep(w*1.1,w*2.4,distanceToScar);vec3 pigment=cjScarInk[i].rgb;diffuseColor.rgb=mix(diffuseColor.rgb,pigment,cjScarInk[i].a*(scar*.7+halo*.12));}
`);};material.customProgramCacheKey=()=>key()+'|body-surface-v83';material.needsUpdate=true;}
 };
}
