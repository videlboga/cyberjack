import {VolumeLashes} from './viewer-volume-lashes.js?v=kate78';
import {lookControls,softenFaceMaterial,tintLipMaterial} from './viewer-face-look.js?v=kai65b';
import {lashControls,lashTexture} from './viewer-lashes.js?v=kate78';
import {FacePaint,paintControls} from './viewer-face-paint.js?v=kai65b';
export const detailControls=[...paintControls,...lashControls,...lookControls,['irisTone','Приглушённость радужки',0,1,.01,0],['irisHighlights','Приглушить блики глаз',0,1,.01,0],['browThickness','Толщина бровей',-1,1,.01,0]];
export {paintControls};
import * as THREE from 'three';
export const appearanceFields={noseLineColor:'Цвет носового контура',eyeShadowColor:'Цвет теней для век',skin:'Цвет кожи',tongue:'Цвет языка',iris:'Цвет радужки',brows:'Цвет бровей',freckleColor:'Цвет веснушек',blushColor:'Цвет румянца',lipColor:'Цвет губ',lashColor:'Цвет ресниц'};
export const appearanceDefaults={noseLineColor:'#8f635d',eyeShadowColor:'#9b6f85',skin:'#99959b',tongue:'#98525b',iris:'#18caed',brows:'#392c36',freckleColor:'#85432b',blushColor:'#fa7a85',lipColor:'#c65370',lashColor:'#241c28'};
export const portraitPalettes={mira:{skin:'#eedcda',iris:'#55bce5',brows:'#302c3c'},kai:{skin:'#79503d',iris:'#24d5ee',brows:'#d8be83'},kate:{skin:'#edb19b',iris:'#99b342',brows:'#b34826',freckles:.55,freckleSize:.85,freckleDensity:.5,blush:.25,lips:.3}};
export function cleanAppearance(value={}){const result={};for(const key of Object.keys(appearanceFields))if(value[key]!=null){if(typeof value[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(value[key]))throw Error('Некорректный цвет: '+key);result[key]=value[key].toLowerCase();}for(const [key,,min,max] of detailControls)if(value[key]!=null){if(typeof value[key]!=='number'||!Number.isFinite(value[key]))throw Error('Некорректный параметр: '+key);result[key]=Math.max(min,Math.min(max,value[key]));}return result;}
// Recolour pixels, rather than multiply a blue iris by a new colour. Neutral
// highlights, dark pupils, texture transforms and alpha are kept intact.
export function recolorPixels(source,hex,kind,values={}){
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),hi=Math.max(...rgb),lo=Math.min(...rgb),saturation=hi?(hi-lo)/hi:0,hue=rgb.map(v=>hi===lo?0:(v-lo)/(hi-lo)),out=new Uint8ClampedArray(source);
 for(let i=0;i<out.length;i+=4){const r=source[i]/255,g=source[i+1]/255,b=source[i+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),sat=max?(max-min)/max:0;
  for(let k=0;k<3;k++)out[i+k]=255*(kind==='brows'?rgb[k]*(.65+.35*max):max*(1-sat*saturation+sat*saturation*hue[k]));
 }
 if(kind==='iris'&&values.irisTone){for(let i=0;i<out.length;i+=4){const max=Math.max(source[i],source[i+1],source[i+2]),min=Math.min(source[i],source[i+1],source[i+2]),sat=max?(max-min)/max:0,f=1-values.irisTone*.48*Math.min(1,sat*3);for(let k=0;k<3;k++)out[i+k]*=f;}}
 if(kind==='iris'&&values.irisHighlights){for(let i=0;i<out.length;i+=4){const max=Math.max(source[i],source[i+1],source[i+2]),min=Math.min(source[i],source[i+1],source[i+2]),neutral=Math.max(0,1-(max-min)/40),bright=Math.max(0,(min-160)/95),f=1-.7*values.irisHighlights*neutral*bright;for(let k=0;k<3;k++)out[i+k]*=f;}}
 return out;
}
// Scale the alpha silhouette around each column's own centre, preserving its arch.
export function thickenBrows(pixels,width,height,amount){
 const out=new Uint8ClampedArray(pixels),factor=1+amount*.85;
 for(let x=0;x<width;x++){let sum=0,centre=0;for(let y=0;y<height;y++){const a=pixels[(y*width+x)*4+3];sum+=a;centre+=y*a;}if(!sum)continue;centre/=sum;
  for(let y=0;y<height;y++){const sy=centre+(y-centre)/factor,y0=Math.floor(sy),t=sy-y0,i=(y*width+x)*4;const alpha=yy=>yy<0||yy>=height?0:pixels[(yy*width+x)*4+3];out[i+3]=alpha(y0)*(1-t)+alpha(y0+1)*t;}
 }return out;
}
export class FaceAppearance{
 constructor(head){this.head=head;this.key=null;this.materials=new Map();this.ownedTextures=[];this.bodyColor=head.clay.color.clone();this.pixels=new Map();this.paint=null;this.clayFace=null;this.volumeLashes=null;}
 texture(source,hex,kind,values){
  if(!source?.image||typeof document==='undefined')return null;
  let pixels=this.pixels.get(source);if(!pixels){const canvas=document.createElement('canvas');canvas.width=source.image.width;canvas.height=source.image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source.image,0,0);pixels=ctx.getImageData(0,0,canvas.width,canvas.height);this.pixels.set(source,pixels);}
  const canvas=document.createElement('canvas');canvas.width=pixels.width;canvas.height=pixels.height;let data=recolorPixels(pixels.data,hex,kind,values);if(kind==='brows'&&values.browThickness)data=thickenBrows(data,pixels.width,pixels.height,values.browThickness);canvas.getContext('2d').putImageData(new ImageData(data,pixels.width,pixels.height),0,0);const texture=source.clone();texture.source=new THREE.Source(canvas);texture.needsUpdate=true;this.ownedTextures.push(texture);return texture;
 }
 apply(values){
  const key=JSON.stringify([values,this.head.settings.face.mouthCurve_binding||0]);if(key===this.key)return;this.key=key;this.volumeLashes?.dispose();this.volumeLashes=null;
  for(const list of this.materials.values())for(const m of [].concat(list))m.dispose();this.materials.clear();for(const t of this.ownedTextures)t.dispose();this.ownedTextures=[];
  this.clayFace?.dispose();this.clayFace=null;
  this.head.clay.color.copy(this.bodyColor);if(values.skin)this.head.clay.color.set(values.skin);
  const lashes=Boolean(values.lashLength||values.lashThickness||values.lashDensity||values.lashColor||values.lashBand||values.lowerLiner);
  const painted=(values.eyeShadow||0)+(values.noseShade||0)+(values.noseContour||0)+(values.freckles||0)+(values.blush||0)+(values.lips||0)>0;if(painted&&!this.paint)this.paint=new FacePaint(this.head);
  if(painted||values.faceSoftness){this.clayFace=this.head.clay.clone();if(painted)this.clayFace.map=this.paint.texture(values);if(painted&&this.clayFace.map)this.ownedTextures.push(this.clayFace.map);softenFaceMaterial(this.clayFace,values.faceSoftness);if(values.lipColorLift&&this.paint){const mask=this.paint.lipMaskTexture(values);if(mask){this.ownedTextures.push(mask);tintLipMaterial(this.clayFace,values.lipColorLift,new THREE.Color(values.lipColor||appearanceDefaults.lipColor),mask);}}this.clayFace.needsUpdate=true;}
  for(const [mesh,source] of this.head.originalMaterials){if(values.tongue&&[].concat(source).some(m=>/cf_m_tang$/.test(m.name))){this.materials.set(mesh,new THREE.MeshStandardMaterial({name:'Tongue · colour',color:values.tongue,roughness:.85,side:THREE.DoubleSide}));continue;}const part=this.head.meshes.indexOf(mesh);if(part===2&&(values.noseLineOpacity!=null||values.noseLineColor)){const original=[].concat(source).find(m=>!m.isOutline)||[].concat(source)[0],texture=this.texture(original.map,values.noseLineColor||'#8f635d','brows',{}),opacity=values.noseLineOpacity??1;const material=new THREE.MeshBasicMaterial({name:original.name,map:texture||original.map,color:texture?'#ffffff':values.noseLineColor||'#8f635d',opacity,transparent:true,depthWrite:false,alphaTest:.005,side:THREE.DoubleSide});material.visible=opacity>0;this.materials.set(mesh,material);continue;}const kind=part===0?'skin':part===1?'brows':part===7||part===8?'iris':part===4||part===5?'lashes':null,hex=values[kind]||((kind==='iris'&&(values.irisTone||values.irisHighlights))||(kind==='brows'&&values.browThickness)?appearanceDefaults[kind]:null);if(!hex&&!(part===0&&painted)&&!(kind==='lashes'&&lashes))continue;
   if(kind==='lashes'){
    const original=[].concat(source).find(m=>!m.isOutline)||[].concat(source)[0],texture=lashTexture(original.map,values,part===4);if(texture)this.ownedTextures.push(texture);
    const material=new THREE.MeshBasicMaterial({name:original.name,map:texture||original.map,color:0xffffff,alphaTest:original.alphaTest||.35,side:THREE.DoubleSide});this.materials.set(mesh,material);continue;
   }
   const result=[].concat(source).map(original=>{
    const material=original.clone();
    // Expanded outline shells create duplicate black contours on sculpted lips.
    if(kind==='skin'&&this.head.settings.face.mouthCurve_binding&&material.isOutline)material.visible=false;
    if(kind==='skin'){if(hex){material.color.set(hex);material.shadeColorFactor?.set(hex);}if(painted){for(const slot of ['map','shadeMultiplyTexture']){const texture=this.paint.texture(values,original[slot]);if(texture){material[slot]=texture;this.ownedTextures.push(texture);}}}}else{for(const name of ['map','shadeMultiplyTexture'])if(original[name]){const tex=this.texture(original[name],hex,kind,values);if(tex)material[name]=tex;}if(!original.map||typeof document==='undefined')material.color.set(hex);else material.color.set('#ffffff');}
    material.needsUpdate=true;return material;
   });this.materials.set(mesh,Array.isArray(source)?result:result[0]);
  }
 }
 updateLashes(){if(!this.head.settings.appearance.lashVolume)return;if(!this.volumeLashes)this.volumeLashes=new VolumeLashes(this.head,this.head.settings.appearance);this.volumeLashes.update();}
 clayMaterial(){return this.clayFace||this.head.clay;}
 material(mesh){return this.materials.get(mesh)||this.head.originalMaterials.get(mesh);}
}
