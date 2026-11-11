import {cyanIrisPixels} from './emotion-iris-cyan.js?v=kai49b';
import {HeadAccessories} from './emotion-head-accessories.js?v=sumi46';
import {amberIrisPixels} from './emotion-iris-amber.js?v=mai23b';
import {HeadFlowers} from './emotion-head-flowers.js?v=mai22';
import * as THREE from 'three';
import {portraitIrisPixels} from './emotion-surface.js?v=13';
// Optional soft-square contour and head wrap, in canonical head coordinates.
// Legacy profiles keep exactly the original ellipse, bridge and temple paths.
export function portraitGlassesPaths(c){
 const cy=c.centerY||1.497,z=c.depth||.091,rx=c.radiusX||.033,ry=c.radiusY||.029,cx=c.centerX||.043;
 if(c.shape!=='roundedRect')return {rims:[-1,1].map(sign=>Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2;return[sign*cx+rx*Math.cos(a),cy+ry*Math.sin(a),z-.003*Math.cos(a)**2];})),arms:[-1,1].map(sign=>[[sign*(cx+rx),cy+.006,z-.003],[sign*.082,cy+.004,.064],[sign*.085,cy+.001,.02]]),bridge:[[-cx+rx,cy+.006,z-.003],[0,cy+.011,z+.001],[cx-rx,cy+.006,z-.003]]};
 const power=c.cornerPower??3.2,wrap=c.wrapDepth??.022,tilt=c.tilt??.08;
 const depth=(x,y)=>z-wrap*(Math.abs(x)/(cx+rx))**2+tilt*(y-cy);
 const point=(sign,a)=>{const co=Math.cos(a),si=Math.sin(a),x=sign*cx+rx*Math.sign(co)*Math.abs(co)**(2/power),y=cy+ry*Math.sign(si)*Math.abs(si)**(2/power);return[x,y,depth(x,y)];};
 const rims=[-1,1].map(sign=>Array.from({length:64},(_,i)=>point(sign,i/64*Math.PI*2)));
 const hingeY=cy+.004,hingeX=cx+rx*(1-(.004/ry)**power)**(1/power);
 const arms=[-1,1].map(sign=>[[sign*hingeX,hingeY,depth(hingeX,hingeY)],[sign*.078,cy+.003,.032],[sign*.085,cy+.001,.008]]);
 const innerY=cy+.006,innerX=cx-rx*(1-(.006/ry)**power)**(1/power);
 const bridge=[[-innerX,innerY,depth(innerX,innerY)],[0,cy+.010,z+.001],[innerX,innerY,depth(innerX,innerY)]];
 return {rims,arms,bridge};
}
// Identity details share the sculpt cage and the actual head transform.
export class HeadPortraitDetails{
 constructor(head){this.head=head;this.flowers=new HeadFlowers(head);this.accessories=new HeadAccessories(head);this.irisRecords=new Map();this.toothRecords=new Map();this.frame=null;this.key='';}
 update(profile,character){
  const h=this.head,config=profile.characters?.[character]?.portrait||{},iris=['amber','cyan'].includes(config.iris)||Boolean(profile.portraitIris),hex=h.settings.appearance.iris||'#559b94',irisKey=JSON.stringify([config.iris,hex,h.settings.appearance.irisTone,h.settings.appearance.irisHighlights]);
  this.flowers.update(config.flowers);this.accessories.update(config.accessories);
  for(const mesh of h.meshes){const names=[].concat(h.originalMaterials.get(mesh)||mesh.material).map(m=>m.name||'');if(!names.some(n=>n.startsWith('KK cf_m_tooth')))continue;
   const old=this.toothRecords.get(mesh),color=profile.portraitTeeth;if(old&&mesh.material===old.output&&old.color===color)continue;if(old){if(mesh.material===old.output)mesh.material=old.source;old.output.dispose();this.toothRecords.delete(mesh);}if(!color)continue;
   const source=mesh.material,output=new THREE.MeshStandardMaterial({name:'Teeth · enamel',color,roughness:.75,side:THREE.DoubleSide});mesh.material=output;this.toothRecords.set(mesh,{source,output,color});
  }
  for(const mesh of h.meshes){const names=[].concat(h.originalMaterials.get(mesh)||mesh.material).map(m=>m.name||'');if(!names.some(n=>n.startsWith('KK cf_m_hitomi_00')))continue;
   const old=this.irisRecords.get(mesh);if(old&&mesh.material===old.output&&old.key===irisKey&&iris)continue;
   if(old){if(mesh.material===old.output)mesh.material=old.source;old.materials.forEach(m=>m.dispose());old.textures.forEach(t=>t.dispose());this.irisRecords.delete(mesh);}if(!iris)continue;
   const source=mesh.material,textures=[],materials=[].concat(source).map(material=>{if(!material.map?.image)return material;const image=material.map.image,canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height);data.data.set((config.iris==='amber'?amberIrisPixels:config.iris==='cyan'?cyanIrisPixels:portraitIrisPixels)(data.data,canvas.width,canvas.height,hex,h.settings.appearance));ctx.putImageData(data,0,0);const texture=material.map.clone();texture.source=new THREE.Source(canvas);texture.needsUpdate=true;textures.push(texture);const clone=material.clone();clone.map=texture;if(clone.shadeMultiplyTexture)clone.shadeMultiplyTexture=texture;clone.needsUpdate=true;return clone;});const output=Array.isArray(source)?materials:materials[0];mesh.material=output;this.irisRecords.set(mesh,{source,output,materials:materials.filter(m=>![].concat(source).includes(m)),textures,hex,key:irisKey});
  }
  const key=JSON.stringify([h.faceEditor?.key,config.glasses]);if(key===this.key)return;this.key=key;this.clearFrame();if(!config.glasses||!h.socketMesh)return;
  const c=config.glasses,group=this.frame=new THREE.Group();group.name='Портрет · оправа';h.socketMesh.add(group);const material=new THREE.MeshStandardMaterial({color:c.color||'#49434e',roughness:.42,metalness:.45});group.userData.material=material;
  const map=p=>new THREE.Vector3(...(h.faceEditor?.cage?.sample(p)||p));
  const tube=(points,closed=false,radius=c.thickness||.00065)=>{const curve=new THREE.CatmullRomCurve3(points.map(map),closed,'centripetal');const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,closed?80:24,radius,6,closed),material);group.add(mesh);};
  const paths=portraitGlassesPaths(c);for(const points of paths.rims)tube(points,true);for(const points of paths.arms)tube(points);tube(paths.bridge,false,(c.thickness||.00065)*.8);
 }
 clearFrame(){if(!this.frame)return;this.frame.removeFromParent();this.frame.traverse(o=>o.geometry?.dispose());this.frame.userData.material.dispose();this.frame=null;}
 dispose(){this.flowers.dispose();this.accessories.dispose();this.clearFrame();for(const[mesh,r]of this.toothRecords){if(mesh.material===r.output)mesh.material=r.source;r.output.dispose();}this.toothRecords.clear();for(const [mesh,r]of this.irisRecords){if(mesh.material===r.output)mesh.material=r.source;r.materials.forEach(m=>m.dispose());r.textures.forEach(t=>t.dispose());}this.irisRecords.clear();}
}
