import {lookPigments} from './viewer-face-look.js?v=kai65b';
import {sourceMouthRows} from './viewer-mouth-bound.js?v=lip-rolls-2';
import * as THREE from 'three';
export const paintControls=[['lipCoverage','Ширина окраски губ',0,1,.01,0],['noseShade','Прорисовка носа',0,1,.01,0],['noseContour','Контур переносицы',0,1,.01,0],['freckles','Веснушки',0,1,.01,0],['freckleSize','Размер веснушек',.5,2,.05,1],['freckleDensity','Количество веснушек',0,1,.01,.6],['blush','Румянец',0,1,.01,0],['lips','Оттенок губ',0,1,.01,0]];
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
// A tapered contour in canonical skin coordinates; UV paint follows every morph.
const noseContourSegments=[];
for(const [a,b,c] of [
 [[-.0045,1.508],[-.006,1.490],[-.010,1.472]],
 [[-.010,1.472],[-.010,1.462],[-.005,1.457]]
]){
 let previous=a;
 for(let i=1;i<=24;i++){
  const t=i/24,u=1-t,next=[u*u*a[0]+2*u*t*b[0]+t*t*c[0],u*u*a[1]+2*u*t*b[1]+t*t*c[1]];
  noseContourSegments.push([previous,next]);previous=next;
 }
}
export function noseContourWeight(x,y,z){
 if(x<-.012||x>-.002||y<1.455||y>1.510||z<.045)return 0;
 let distance=Infinity;
 for(const [a,b] of noseContourSegments){
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
  distance=Math.min(distance,(x-a[0]-t*dx)**2+(y-a[1]-t*dy)**2);
 }
 return Math.exp(-2*distance/.00045**2)*smooth(1.457,1.461,y)*(1-smooth(1.500,1.508,y))*smooth(.045,.065,z);
}
export class FacePaint{
 constructor(head,size=1024){
  this.head=head;this.size=size;const mesh=head.socketMesh,c=head.faceEditor.cache.get(mesh),uv=mesh.geometry.attributes.uv,idx=mesh.geometry.index.array;this.points=new Float32Array(size*size*3);this.valid=new Uint8Array(size*size);const p=new THREE.Vector3();const positions=[];for(let i=0;i<c.position.length;i+=3)positions.push(p.fromArray(c.position,i).applyMatrix4(c.matrix).toArray());
  // Bake rest-space surface positions into the original UV atlas once. Paint
  // subsequently follows the same skin and expression morphs as the face.
  for(let k=0;k<idx.length;k+=3){const ids=Array.from(idx.slice(k,k+3)),t=ids.map(i=>[uv.getX(i)*size,uv.getY(i)*size]),[a,b,d]=t,det=(b[1]-d[1])*(a[0]-d[0])+(d[0]-b[0])*(a[1]-d[1]);if(Math.abs(det)<1e-8)continue;
   const minX=Math.max(0,Math.floor(Math.min(...t.map(v=>v[0])))),maxX=Math.min(size-1,Math.ceil(Math.max(...t.map(v=>v[0])))),minY=Math.max(0,Math.floor(Math.min(...t.map(v=>v[1])))),maxY=Math.min(size-1,Math.ceil(Math.max(...t.map(v=>v[1]))));
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const u=((b[1]-d[1])*(x+.5-d[0])+(d[0]-b[0])*(y+.5-d[1]))/det,v=((d[1]-a[1])*(x+.5-d[0])+(a[0]-d[0])*(y+.5-d[1]))/det,w=1-u-v;if(Math.min(u,v,w)<-1e-6)continue;const pixel=y*size+x;this.valid[pixel]=1;for(let j=0;j<3;j++)this.points[pixel*3+j]=u*positions[ids[0]][j]+v*positions[ids[1]][j]+w*positions[ids[2]][j];}
  }
  let seed=81237;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};this.spots=Array.from({length:200},()=>({x:(random()*2-1)*.066,y:1.464+random()*.022,r:.00055+random()*.00075,opacity:.35+random()*.6,aspect:.7+random()*.6}));
  // Cache a dense spot field for each size/density pair, independent of tint.
  this.spotKey=null;this.spotMask=null;
 }
 mask(values){const key=[values.freckleSize??1,values.freckleDensity??.6].join(':');if(this.spotKey===key)return this.spotMask;this.spotKey=key;const out=new Float32Array(this.valid.length),size=values.freckleSize??1,spots=this.spots.slice(0,Math.round((values.freckleDensity??.6)*200));for(let i=0;i<this.valid.length;i++){if(!this.valid[i])continue;const x=this.points[i*3],y=this.points[i*3+1],z=this.points[i*3+2];if(z<.035||y<1.460||y>1.490)continue;let value=0;for(const s of spots){const d=((x-s.x)**2+((y-s.y)/s.aspect)**2)/(s.r*size)**2;if(d<2)value=Math.max(value,(1-smooth(.35,1.4,d))*s.opacity);}out[i]=value*smooth(.035,.055,z)*Math.max(Math.exp(-(((Math.abs(x)-.038)/.032)**2+((y-1.474)/.011)**2)),.65*Math.exp(-((x/.025)**2+((y-1.476)/.007)**2)));}this.spotMask=out;return out;}
 pixels(values){const out=new Uint8ClampedArray(this.valid.length*4),spots=(values.freckles||0)>0?this.mask(values):null,freckle=rgb(values.freckleColor||'#85432b'),blush=rgb(values.blushColor||'#fa7a85'),lip=rgb(values.lipColor||'#c65370'),shadowColor=rgb(values.eyeShadowColor||'#9b6f85'),bound=Boolean(this.head?.settings.face.mouthCurve_binding);out.fill(255);if(values.lipColorLift)for(let i=3;i<out.length;i+=4)out[i]=0;
  for(let i=0;i<this.valid.length;i++){if(!this.valid[i])continue;const x=this.points[i*3],y=this.points[i*3+1],z=this.points[i*3+2],front=smooth(.035,.055,z),cheek=Math.exp(-(((Math.abs(x)-.043)/.021)**2*2+((y-(1.468+.005*(values.blushHeight||0)))/.012)**2*2))*front,lipEdge=Math.max(0,1-(x/.017)**2),coverage=1+.75*(values.lipCoverage||0),upperLip=Math.exp(-2*Math.pow((y-(1.4365+.0007*Math.exp(-Math.pow((Math.abs(x)-.004)/.003,2))))/((.0012+.0010*lipEdge)*coverage),2)),lowerLip=Math.exp(-2*Math.pow((y-1.4339)/((.0012+.0014*lipEdge)*coverage),2)),lips=Math.max(upperLip*.9,lowerLip)*Math.exp(-2*Math.pow(x/.016,6))*smooth(.055,.063,z);
   let pigment=lips;if(bound&&Math.abs(x)<.020){const rows=sourceMouthRows(x),edge=.0006*(1+(values.lipCoverage||0)),near=Math.min(rows.upper[1],rows.lower[1]);pigment=smooth(rows.lower[0]-edge,rows.lower[0]+edge,y)*(1-smooth(rows.upper[0]-edge,rows.upper[0]+edge,y))*(1-smooth(.013,.020,Math.abs(x)))*smooth(near-.006,near-.001,z);}
   if((values.lipDefinition||0)>0&&Math.abs(x)<.023){
    const u=Math.abs(x)/.014,span=Math.sqrt(Math.max(0,1-u*u)),seam=1.4355+.00025*u*u;
    const cupid=Math.exp(-(((Math.abs(x)-.004)/.0028)**2));
    const upper=seam+span*(.0008+.00125*cupid),lower=seam-span*.00165;
    const precise=smooth(lower-.00035,lower+.00035,y)*(1-smooth(upper-.00035,upper+.00035,y))*(1-smooth(.0125,.0145,Math.abs(x)))*smooth(.055,.063,z);
    pigment= pigment*(1-values.lipDefinition)+precise*values.lipDefinition;
   }
   if(values.lipColorLift)out[i*4+3]=Math.round(255*Math.max(0,Math.min(1,pigment)));
   const nose=(.65*Math.exp(-(((Math.abs(x)-.004)/.0022)**2*2+((y-1.4555)/.0018)**2*2))+.18*Math.exp(-(((Math.abs(x)-.008)/.004)**2*2+((y-1.463)/.009)**2*2)))*smooth(.060,.071,z);
   const beauty=lookPigments([x,y,z],values);const masks=[beauty.shadow*(.55+.4*(values.eyeShadowSpread||0)),(values.noseShade||0)*nose,(values.blush||0)*cheek*.65,(values.lips||0)*pigment*.85,(values.freckles||0)*(spots?.[i]||0)*.9,(values.noseContour||0)*noseContourWeight(x,y,z)],colors=[shadowColor,[.42,.24,.22],blush,lip,freckle,[.30,.19,.15]];for(let k=0;k<3;k++){let v=1;for(let j=0;j<masks.length;j++)v*=1-masks[j]*(1-colors[j][k]);v+=(1-v)*beauty.gloss*.7*Math.min(1,(values.lips||0)*3)*pigment;out[i*4+k]=Math.round(v*255);}
  }return out;
 }
 lipMaskTexture(values){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=this.size;
  const pixels=this.pixels({...values,lipColorLift:1});
  for(let i=0;i<pixels.length;i+=4){const mask=pixels[i+3];pixels[i]=pixels[i+1]=pixels[i+2]=mask;pixels[i+3]=255;}
  canvas.getContext('2d').putImageData(new ImageData(pixels,this.size,this.size),0,0);
  const texture=new THREE.Texture(canvas);texture.flipY=false;texture.needsUpdate=true;return texture;
 }
 texture(values,source=null){if(typeof document==='undefined')return null;const canvas=document.createElement('canvas');canvas.width=canvas.height=this.size;const ctx=canvas.getContext('2d'),pixels=this.pixels({...values,lipColorLift:0});if(source?.image){ctx.drawImage(source.image,0,0,this.size,this.size);const original=ctx.getImageData(0,0,this.size,this.size);for(let i=0;i<pixels.length;i+=4){for(let k=0;k<3;k++)pixels[i+k]=pixels[i+k]*original.data[i+k]/255;pixels[i+3]=original.data[i+3];}}ctx.putImageData(new ImageData(pixels,this.size,this.size),0,0);const t=source?source.clone():new THREE.Texture();t.source=new THREE.Source(canvas);t.flipY=source?.flipY??false;t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;}
}
