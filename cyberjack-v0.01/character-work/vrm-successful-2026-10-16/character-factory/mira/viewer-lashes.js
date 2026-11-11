import * as THREE from 'three';
export const lashControls=[['lashVolumeFan','Веер объёмных ресниц',0,1,.01,0],['lashVolumeThickness','Толщина объёмных ресниц',0,1,.01,0],['lashVolumeVariation','Неравномерность ресниц',0,1,.01,0],['lashVolumeDensity','Густота объёмных ресниц',0,1,.01,0],['lashVolume','Объёмные ресницы',0,1,.01,0],['lashLength','Длина ресниц',-1,1,.01,0],['lashThickness','Толщина подводки',-1,1,.01,0],['lashDensity','Дополнительные ресницы',0,1,.01,0],['lashBand','Тонкая линия верхнего века',0,1,.01,0],['lowerLiner','Связность нижнего контура',0,1,.01,0]];
// Work in the existing eyelid UVs: the inner alpha contour is the attachment
// line, so the painted lashes keep following every native blink morph.
export function lashPixels(source,width,height,values,lower=false){
 // With real lashes, omit the separate painted crease that crosses their
 // stems on lowered lids. Preserve the principal eyeliner island and its AA.
 if(!lower&&values.lashVolume){
  const labels=new Int32Array(width*height),queue=new Int32Array(labels.length);let label=0,largest=0,size=0;
  for(let start=0;start<labels.length;start++){if(labels[start]||source[start*4+3]<32)continue;label++;let read=0,write=1;queue[0]=start;labels[start]=label;
   while(read<write){const id=queue[read++],x=id%width,y=Math.floor(id/width);for(const next of [x>0?id-1:-1,x<width-1?id+1:-1,y>0?id-width:-1,y<height-1?id+width:-1]){if(next<0||labels[next]||source[next*4+3]<32)continue;labels[next]=label;queue[write++]=next;}}
   if(write>size){size=write;largest=label;}
  }
  source=source.slice();for(let id=0;id<labels.length;id++){if(labels[id]&&labels[id]!==largest)source[id*4+3]=0;}
  // The native painted forks bend with the flat card and look like hooked
  // volume lashes at the outer canthus. Round-opening removes narrow forks
  // while keeping the broad liner; real strands supply the fringe.
  const radius=Math.max(1,Math.round(width*9/512)),offsets=[];
  for(let y=-radius;y<=radius;y++)for(let x=-radius;x<=radius;x++)if(x*x+y*y<=radius*radius)offsets.push([x,y]);
  const eroded=new Uint8Array(width*height),opened=new Uint8Array(width*height);
  for(let y=radius;y<height-radius;y++)for(let x=radius;x<width-radius;x++){let a=255;for(const [dx,dy]of offsets){a=Math.min(a,source[((y+dy)*width+x+dx)*4+3]);if(!a)break;}eroded[y*width+x]=a;}
  for(let y=radius;y<height-radius;y++)for(let x=radius;x<width-radius;x++){let a=0;for(const [dx,dy]of offsets){a=Math.max(a,eroded[(y+dy)*width+x+dx]);if(a===255)break;}opened[y*width+x]=a;}
  for(let id=0;id<opened.length;id++)source[id*4+3]=opened[id];
 }
 // A volume fringe already supplies length. Keep its underlying native
 // contact band intact rather than thinning it away from the skin rim.
 const band=values.lashVolume?0:values.lashBand||0;
 const roots=new Float32Array(width),edges=new Float32Array(width),valid=new Uint8Array(width);
 for(let x=0;x<width;x++){let total=0;for(let y=0;y<height;y++)total+=source[(y*width+x)*4+3];if(total<255)continue;const threshold=total*(lower?.1:.9),outerThreshold=total*(lower?.8:.2);let sum=0,root=0,edge=-1;for(let y=0;y<height;y++){const a=source[(y*width+x)*4+3];sum+=a;if(sum>=outerThreshold&&edge<0)edge=y;if(sum>=threshold&&root===0)root=y;}roots[x]=root;edges[x]=edge;valid[x]=1;}
 const smoothRoots=roots.slice();for(let x=0;x<width;x++){let sum=0,n=0;for(let d=-6;d<=6;d++){const i=x+d;if(i>=0&&i<width&&valid[i]){sum+=roots[i];n++;}}if(n)smoothRoots[x]=sum/n;}
 const out=new Uint8ClampedArray(source.length),scale=values.lashVolume?1:1+(values.lashLength||0)*.35,thickness=Math.round((values.lashThickness||0)*3),color=values.lashColor?[1,3,5].map(i=>parseInt(values.lashColor.slice(i,i+2),16)):null;
 for(let x=0;x<width;x++)for(let y=0;y<height;y++){const dst=(y*width+x)*4;if(!valid[x])continue;const root=smoothRoots[x],direction=lower?1:-1,distance=(y-root)*direction,anchor=edges[x],sy=(y-anchor)*direction>0?anchor+(y-anchor)/scale:y;let alpha=thickness<0?255:0,best=Math.max(0,Math.min(height-1,Math.round(sy)));
  const sampleY=!lower&&band&&distance>0?root+(sy-root)/(1-.65*band):sy;const radius=Math.abs(thickness);for(let d=0;d<=radius;d++){const yy=Math.round(sampleY-direction*d*(thickness<0?-1:1));const a=yy>=0&&yy<height?source[(yy*width+x)*4+3]:0;if(thickness<0)alpha=Math.min(alpha,a);else if(a>=alpha){alpha=a;best=Math.max(0,Math.min(height-1,yy));}}
  // Leave the contact edge unchanged; modifications grow out from the lid.
  if(distance<2){const i=(Math.max(0,Math.min(height-1,Math.round(sy)))*width+x)*4;alpha=source[i+3];best=Math.max(0,Math.min(height-1,Math.round(sy)));}
  const src=(best*width+x)*4;for(let k=0;k<3;k++)out[dst+k]=color?color[k]:source[src+k];out[dst+3]=alpha;
 }
 return {pixels:out,roots:smoothRoots,edges,valid};
}
export function lashTexture(source,values,lower=false){
 if(!source?.image||typeof document==='undefined')return null;const canvas=document.createElement('canvas');canvas.width=source.image.width;canvas.height=source.image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source.image,0,0);const input=ctx.getImageData(0,0,canvas.width,canvas.height),{pixels,roots,edges,valid}=lashPixels(input.data,canvas.width,canvas.height,values,lower);ctx.putImageData(new ImageData(pixels,canvas.width,canvas.height),0,0);
 const count=Math.round((values.lashDensity||0)*(lower?6:14)),direction=lower?1:-1;ctx.fillStyle=values.lashColor||'#241c28';
 for(let i=0;i<count;i++){const t=(i+.5)/count,x=Math.round(canvas.width*(.22+t*.53));if(!valid[x])continue;const edge=edges[x]+(!lower?(roots[x]-edges[x])*.65*(values.lashBand||0):0),length=(lower?5:12)*(1+(values.lashLength||0)*.5)*(1+.5*Math.sin(i*2.4)),y=edge+direction*-2,w=1.1+(values.lashThickness||0)*.4,tipX=x+(t-.5)*length,tipY=y+direction*length;ctx.beginPath();ctx.moveTo(x-w,y);ctx.quadraticCurveTo(x,tipY,tipX,tipY);ctx.quadraticCurveTo(x+2*w,y+direction*length*.35,x+w,y);ctx.closePath();ctx.fill();}
 if(lower&&values.lowerLiner){
  const xs=Array.from(valid,(_,i)=>i).filter(i=>valid[i]);if(xs.length>1){
   ctx.strokeStyle=values.lashColor||'#241c28';ctx.globalAlpha=values.lowerLiner*.75;ctx.lineWidth=1.5+2*values.lowerLiner;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(xs[0],roots[xs[0]]);
   for(let i=1;i<xs.length;i++){const x=xs[i],prev=xs[i-1];ctx.quadraticCurveTo(prev,roots[prev],(x+prev)/2,(roots[x]+roots[prev])/2);}ctx.stroke();ctx.globalAlpha=1;
  }
 }
 const texture=source.clone();texture.source=new THREE.Source(canvas);texture.needsUpdate=true;return texture;
}
