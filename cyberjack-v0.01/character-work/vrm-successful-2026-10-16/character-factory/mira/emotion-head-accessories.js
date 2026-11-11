import {solidRibbon} from './emotion-bow-ribbon.js?v=mika29';
import * as THREE from 'three';
// Optional portrait jewelry in canonical Y-up coordinates; follows the head sculpt cage.
export class HeadAccessories{
 constructor(head){this.head=head;this.group=null;this.key='';this.socket=null;this.bowsGroup=null;}
 update(config){
  const h=this.head,hairNode=[...(h.portraitHair?.builtin?.nodes.values()||[])].find(n=>n.userData.sourcePreset===config?.bows?.asset),key=JSON.stringify([h.faceEditor?.key,config,hairNode?.uuid]);if(this.bowsGroup&&hairNode){hairNode.updateMatrix();this.bowsGroup.matrix.copy(hairNode.matrix);this.bowsGroup.visible=hairNode.visible;}if(this.key===key&&this.socket===h.socketMesh)return;
  this.clear();this.key=key;this.socket=h.socketMesh;if(!config||!h.socketMesh)return;
  const root=this.group=new THREE.Group();root.name='Портрет · банты и украшения';h.socketMesh.add(root);
  const map=p=>new THREE.Vector3(...(h.faceEditor?.cage?.sample(p)||p));
  const silver=new THREE.MeshStandardMaterial({color:'#e1bee7',metalness:0,roughness:.85});
  const pearl=new THREE.MeshStandardMaterial({color:'#fff2f5',metalness:.15,roughness:.22});
  const ribbon=new THREE.MeshStandardMaterial({color:config.color||'#6550a8',roughness:.48,metalness:.15,side:THREE.DoubleSide});
  const cord=new THREE.MeshStandardMaterial({color:'#735387',roughness:.5});
  const sphere=new THREE.SphereGeometry(1,16,12);
  const bead=(p,r,m=pearl,scale=[1,1,1])=>{const o=new THREE.Mesh(sphere,m);o.position.copy(map(p));o.scale.set(r*scale[0],r*scale[1],r*scale[2]);root.add(o);return o;};
  const tube=(points,r,m,closed=false)=>{const curve=new THREE.CatmullRomCurve3(points.map(map),closed,'centripetal');const o=new THREE.Mesh(new THREE.TubeGeometry(curve,closed?96:40,r,8,closed),m);root.add(o);return o;};
  if(config.earrings)for(const sign of [-1,1]){
   const [cx,cy,cz]=config.earrings.position;
   const anchor=map([sign*cx,cy,cz]),radius=config.earrings.radius||.021;
   // The circle passes through the lobe. Its plane is oblique to the face,
   // so it remains a circle in 3D rather than a front-facing painted oval.
   const angle=(config.earrings.angle||.7)*sign,axis=new THREE.Vector3(Math.cos(angle),0,-Math.sin(angle));
   const center=anchor.clone().add(new THREE.Vector3(0,-radius+.001,0));
   const curve=new THREE.CatmullRomCurve3(Array.from({length:128},(_,i)=>{const a=i/128*Math.PI*2;return center.clone().addScaledVector(axis,radius*Math.sin(a)).add(new THREE.Vector3(0,radius*Math.cos(a),0));}),true,'centripetal');
   const plastic=new THREE.MeshStandardMaterial({color:sign<0?'#c6a5db':'#a8cdd5',metalness:0,roughness:.84});
   const hoop=new THREE.Mesh(new THREE.TubeGeometry(curve,128,.0016,10,true),plastic);hoop.name='Серьга-кольцо · '+sign;hoop.userData.lobe=anchor.toArray();root.add(hoop);
  }
  if(config.bows&&hairNode){
   const bows=this.bowsGroup=new THREE.Group();bows.name='Банты · крепление к корням хвостов';// Share the hair layer transform without entering its paint/disposal traversal.
   (hairNode.parent||hairNode).add(bows);bows.matrixAutoUpdate=false;hairNode.updateMatrix();bows.matrix.copy(hairNode.matrix);bows.visible=hairNode.visible;
   for(const [i,source]of config.bows.roots.entries()){
    const sign=Math.sign(source[0]),style=config.bows.styles?.[i]||{},sz=config.bows.size*(style.scale||1),angle=style.angle||0;
    // Same VRoid-to-Z-up conversion as strandGeometry. The band follows the
    // short lifted root; no face cage or independent head offsets are involved.
    const base=new THREE.Vector3(source[0]*.72,-source[2]*.72-.016,source[1]*.72);
    const p=config.bows.ties?.[i]||source;const tie=new THREE.Vector3(p[0]*.72,-p[2]*.72-.016,p[1]*.72);
    const bow=new THREE.Group();bow.position.copy(tie);bow.name='Бант · '+sign;bow.userData.root=base.toArray();bows.add(bow);
    const fabric=ribbon.clone();fabric.color.set(style.color||config.color||'#6550a8');fabric.roughness=.73;fabric.metalness=0;
    const mount=new THREE.Group();mount.rotation.z=sign*.12;bow.add(mount);
    const knot=new THREE.Mesh(sphere,fabric);knot.position.set(0,config.bows.gatheredRoot ? -.009 : -.012,0);knot.scale.set(sz*.19,sz*(config.bows.gatheredRoot ? .28 : .25),sz*.30);mount.add(knot);
    const cloth=(side,tail=false)=>{
     const geometry=solidRibbon((t,u)=>{
      let x,y,depth;
      if(tail){const drape=THREE.MathUtils.smoothstep(t,0,.25);x=side*sz*(.14+.22*t)+u*sz*(config.bows.tailWidth||.16)*(.28+.72*drape);y=-sz*(.12+1.65*t)+Math.abs(u)*sz*.12*t;depth=sz*(.85*Math.sin(t*Math.PI/2)+.07*u*u*t);}
      else{const arch=Math.sin(Math.PI*t),fold=.72*Math.cos(t*Math.PI*2),width=.43*(.20+.80*arch)**.60*(1-.48*arch**8);x=side*sz*(.08+.96*arch);y=sz*(.18*arch+u*width*Math.cos(fold));depth=sz*(.15*Math.sin(t*Math.PI*2)+u*width*Math.sin(fold)*.30);}
      const xx=sign*x*Math.cos(angle)-y*Math.sin(angle),yy=sign*x*Math.sin(angle)+y*Math.cos(angle);
      return [xx,-(config.bows.gatheredRoot ? .021 : .012)-depth,yy];
     },tail?32:64,12,.0007);
     const mesh=new THREE.Mesh(geometry,fabric);mesh.name=tail?'Свободная лента · объёмный край':'Замкнутая петля банта';mount.add(mesh);
    };
    for(const side of [-1,1]){cloth(side);cloth(side,true);}
   }
  }

  if(config.necklace){
   const [y,z]=config.necklace.position,r=config.necklace.radius;
   const path=Array.from({length:64},(_,i)=>{const a=i/64*Math.PI*2;return[r*Math.sin(a),y-.010*Math.cos(a),z+.040*Math.cos(a)];});tube(path,.0007,cord,true);
   for(let i=0;i<22;i++){const a=i/22*Math.PI*2;bead([r*Math.sin(a),y-.010*Math.cos(a),z+.040*Math.cos(a)],.0038);}
  }
  if(config.heartPendant){
   const c=config.heartPendant,center=c.position||[0,1.33,.024],size=c.size||.010;
   const cordMaterial=new THREE.MeshStandardMaterial({color:c.cordColor||'#7a6265',roughness:.85});
   const cordPoints=c.cordPath||[[-.037,1.374,-.020],[-.037,1.363,.017],[-.025,1.347,.020],[center[0],center[1]+size*.65,center[2]],[.025,1.347,.020],[.037,1.363,.017],[.037,1.374,-.020],[0,1.377,-.040]];
   if(c.fitToNeck&&h.bodyMesh){
    // Fit every curve sample to the actual body-owned neck, after head scaling.
    // Moving only control points lets the spline cut through the neck between them.
    h.parent.updateWorldMatrix(true,true);root.updateWorldMatrix(true,false);
    const toParent=h.parent.matrixWorld.clone().invert().multiply(root.matrixWorld),toLocal=toParent.clone().invert();
    const ray=new THREE.Raycaster(),baseCurve=new THREE.CatmullRomCurve3(cordPoints.map(map),true,'centripetal');
    const fit=p=>{
     const q=p.clone().applyMatrix4(toParent),axis=new THREE.Vector3(0,0,q.z),radial=q.clone().sub(axis).normalize();
     const origin=axis.clone().addScaledVector(radial,.3).applyMatrix4(h.parent.matrixWorld);
     const direction=radial.clone().negate().transformDirection(h.parent.matrixWorld);
     ray.set(origin,direction);const hit=ray.intersectObject(h.bodyMesh,false)[0];
     if(hit){const surface=h.parent.worldToLocal(hit.point.clone());const radius=surface.distanceTo(axis)+.0012;
      if(q.distanceTo(axis)<radius)q.copy(axis).addScaledVector(radial,radius);
     }
     return q.applyMatrix4(toLocal);
    };
    const fitted=new THREE.Curve();fitted.getPoint=(t,target=new THREE.Vector3())=>target.copy(fit(baseCurve.getPoint(t)));
    const necklace=new THREE.Mesh(new THREE.TubeGeometry(fitted,256,.00055,8,true),cordMaterial);necklace.name='Шнурок · посадка по поверхности шеи';root.add(necklace);
   }else tube(cordPoints,.00055,cordMaterial,true);
   const shape=new THREE.Shape();
   for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,x=Math.sin(a)**3,y=(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))/16;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);}
   const geometry=new THREE.ExtrudeGeometry(shape,{depth:.0014,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.0008,bevelThickness:.0006,curveSegments:32});
   // Shape is unit size; scale XY only so the bevel stays a fine metal edge.
   const a=geometry.attributes.position;for(let i=0;i<a.count;i++){const p=map([center[0]+a.getX(i)*size,center[1]+a.getY(i)*size,center[2]+a.getZ(i)]);a.setXYZ(i,p.x,p.y,p.z);}geometry.computeVertexNormals();
   const metal=new THREE.MeshStandardMaterial({color:c.color||'#e687a2',metalness:.22,roughness:.35});const pendant=new THREE.Mesh(geometry,metal);pendant.name='Кулон · розовое сердце';root.add(pendant);
   bead([center[0],center[1]+size*.8,center[2]],.0012,metal,[1,1.5,.6]);
  }
  // Keep only materials referenced by meshes in the disposal traversal.
  for(const m of [silver,pearl,ribbon,cord])if(!root.children.some(o=>o.material===m))m.dispose();
 }
 clear(){const gs=new Set(),ms=new Set();for(const group of [this.group,this.bowsGroup]){if(!group)continue;group.removeFromParent();group.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of [].concat(o.material||[]))ms.add(m);});}gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());this.group=null;this.bowsGroup=null;}
 dispose(){this.clear();this.key='';this.socket=null;}
}
